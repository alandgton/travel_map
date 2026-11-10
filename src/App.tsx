import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoProjection } from 'd3-geo';
import { Loader2, Sparkles } from 'lucide-react';
import {
  DEFAULT_TRAVEL_MAP_CONFIG,
  ItineraryLegConfig,
  RegionCameraConfig,
  TransitMode,
} from './config';
import { useMapCamera } from './hooks/useMapCamera';
import { useMapTopology } from './hooks/useMapTopology';
import { useResolvedCities } from './hooks/useResolvedCities';
import { computeAllCityStats, computeJourneySummary } from './utils/itineraryStats';
import { CityDetailDrawer } from './components/CityDetailDrawer';
import { RegionSelectorBar } from './components/RegionSelectorBar';
import { JourneyPlayback } from './components/JourneyPlayback';
import { TransitLegendBar } from './components/TransitLegendBar';
import { TravelMapCanvas } from './components/TravelMapCanvas';

// Minimum and maximum on-screen leg span thresholds (in zoomed 1200x675 SVG viewBox units)
// within which Follow Camera holds its current zoom level and performs a pure pan.
const MIN_ZOOM_SPAN_THRESHOLD = 10;
const MAX_ZOOM_SPAN_THRESHOLD = 380;

// Default steady high-zoom level for Shimanami Kaido micro-cluster island hops
// and the intermediate approach zoom when arriving at the cluster origin (Onomichi).
const DEFAULT_MICRO_CLUSTER_ZOOM = 185;
const MICRO_CLUSTER_APPROACH_ZOOM = 32;

function isMicroClusterLeg(
  sourceCoords: [number, number] | undefined,
  destCoords: [number, number] | undefined,
  transport: TransitMode
): boolean {
  if (transport === 'Bike') return true;
  if (!sourceCoords || !destCoords) return false;
  const rawDLon = Math.abs(sourceCoords[0] - destCoords[0]);
  const dLon = Math.min(rawDLon, 360 - rawDLon);
  const dLat = Math.abs(sourceCoords[1] - destCoords[1]);
  return Math.hypot(dLon, dLat) < 0.35;
}

/**
 * Computes an adaptive camera zoom level for a leg with a screen-space min/max distance
 * deadband so consecutive regional stops (e.g. across Europe or Mainland China) or
 * micro-cluster island hops (Shimanami Kaido) pan smoothly at a constant zoom level
 * without unnecessary zooming in and out.
 */
function getContextualZoomForLeg(
  sourceCoords: [number, number] | undefined,
  destCoords: [number, number],
  transport: TransitMode,
  currentZoomK: number,
  projection: GeoProjection,
  microClusterZoom: number = DEFAULT_MICRO_CLUSTER_ZOOM,
  isApproachingMicroCluster: boolean = false
): number {
  if (isMicroClusterLeg(sourceCoords, destCoords, transport)) {
    return microClusterZoom;
  }
  if (isApproachingMicroCluster) {
    return MICRO_CLUSTER_APPROACH_ZOOM;
  }
  if (!sourceCoords) {
    return 5.8;
  }

  const rawDLon = Math.abs(sourceCoords[0] - destCoords[0]);
  const dLon = Math.min(rawDLon, 360 - rawDLon);
  const dLat = Math.abs(sourceCoords[1] - destCoords[1]);
  const span = Math.hypot(dLon, dLat);

  // Base zoom tiers:
  // - < 0.35°: Micro-cluster hops (Shimanami Kaido island chain) -> steady microClusterZoom
  // - 0.35°..18°: Regional travel (intra-Europe, Egypt, Mainland China, Korea & Japan) -> 5.8x
  // - 18°..42°: Cross-regional medium-haul flights (e.g. Munich->Cairo, Singapore->Chengdu) -> 3.6x
  // - >= 42°: Long-haul / intercontinental flights (e.g. NYC->SF, NYC->Stockholm, Tokyo->LA) -> 2.6x
  let idealZoom: number;
  if (span < 0.35) {
    idealZoom = microClusterZoom;
  } else if (span < 18) {
    idealZoom = 5.8;
  } else if (span < 42) {
    idealZoom = 3.6;
  } else {
    idealZoom = 2.6;
  }

  // Min/Max projected distance deadband:
  // When the leg's on-screen distance at currentZoomK is already within [MIN, MAX] and
  // currentZoomK is within the same regional tier band, hold currentZoomK for a pure pan.
  const pSource = projection(sourceCoords);
  const pDest = projection(destCoords);
  if (pSource && pDest && rawDLon < 180) {
    const projectedDist = Math.hypot(pDest[0] - pSource[0], pDest[1] - pSource[1]);
    const zoomedSpan = projectedDist * currentZoomK;
    const isWithinDistanceDeadband =
      zoomedSpan >= MIN_ZOOM_SPAN_THRESHOLD && zoomedSpan <= MAX_ZOOM_SPAN_THRESHOLD;
    const isWithinTierHysteresis =
      currentZoomK >= idealZoom * 0.78 && currentZoomK <= idealZoom * 1.35;

    if (isWithinDistanceDeadband && isWithinTierHysteresis) {
      return currentZoomK;
    }
  }

  return idealZoom;
}

export const App: React.FC = () => {
  const activeConfig = DEFAULT_TRAVEL_MAP_CONFIG;

  // Layer visibility toggles
  const [showAdmin1, setShowAdmin1] = useState<boolean>(false);
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  const [visibleModes, setVisibleModes] = useState<Record<TransitMode, boolean>>({
    Flight: true,
    Train: true,
    Drive: true,
    Bike: true,
  });

  // Selection & Drawer State
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Opt-In Journey Playback State
  const [isTimelineEnabled, setIsTimelineEnabled] = useState<boolean>(false);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState<number>(0);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(1400);

  const {
    svgRef,
    cameraGroupRef,
    projection,
    transform,
    zoomK,
    invScale,
    labelScaleBoost,
    activeRegionId,
    computeBoundsFit,
    flyToCoordinates,
    flyToRegion,
    zoomIn,
    zoomOut,
    resetCamera,
  } = useMapCamera(activeConfig.mapConfig);

  // Map Topology Hook (uses lightweight 50m below 6x zoom and upgrades to 10m high-res when zoomed >= 6x,
  // pausing 10m swaps while auto-playing timeline so high-zoom landings do not rebuild country paths mid-playback)
  const {
    countriesGeoJson,
    admin1GeoJson,
    isLoadingCountries,
    isLoadingAdmin1,
    error: topologyError,
  } = useMapTopology(
    activeConfig.mapConfig.countriesTopoJsonUrl,
    activeConfig.mapConfig.admin1GeoJsonUrl,
    showAdmin1,
    zoomK >= 6 && !isPlayingTimeline
  );

  // Automatically resolve city coordinates from the itinerary's source & dest city names
  const {
    cities: resolvedCities,
    isGeocoding,
    unresolvedCities,
  } = useResolvedCities(activeConfig.itinerary);

  // Compute responsive region presets (e.g. dynamic viewport fit for Shimanami Kaido's 4 bike stops)
  const effectiveRegions = useMemo(() => {
    const map: Record<string, RegionCameraConfig> = {};
    for (const [id, region] of Object.entries(activeConfig.regions)) {
      if (region.fitCities && region.fitCities.length >= 2) {
        const coordsList = region.fitCities
          .map((cid) => resolvedCities[cid]?.coordinates)
          .filter((c): c is [number, number] => Boolean(c));
        const fit = computeBoundsFit(coordsList, {
          minZoom: region.zoom * 0.75,
        });
        if (fit) {
          map[id] = {
            ...region,
            center: fit.center,
            zoom: fit.zoom,
          };
          continue;
        }
      }
      map[id] = region;
    }
    return map;
  }, [activeConfig.regions, computeBoundsFit, resolvedCities]);

  // Steady high-zoom level shared across the Shimanami Kaido stretch
  const shimanamiClusterZoom =
    effectiveRegions.shimanami?.zoom ?? DEFAULT_MICRO_CLUSTER_ZOOM;

  // Derived Statistics
  const cityStats = useMemo(
    () => computeAllCityStats(resolvedCities, activeConfig.itinerary),
    [resolvedCities, activeConfig.itinerary]
  );

  const journeySummary = useMemo(
    () => computeJourneySummary(resolvedCities, activeConfig.itinerary),
    [resolvedCities, activeConfig.itinerary]
  );

  // Track active camera zoom in a ref so Follow Camera deadband calculations always read
  // the latest target/committed zoom without re-triggering the timeline effect when zoom settles.
  const currentZoomKRef = useRef<number>(zoomK);
  useEffect(() => {
    currentZoomKRef.current = zoomK;
  }, [zoomK]);

  // Follow camera effect when timeline index advances (always enabled)
  const followLegDestination = useCallback(
    (legIndex: number) => {
      const leg = activeConfig.itinerary[legIndex];
      if (!leg) return;
      const destCity = resolvedCities[leg.dest];
      const sourceCity = resolvedCities[leg.source];
      if (!destCity) return;

      // Detect whether the upcoming leg enters a micro-cluster (e.g. Kyoto -> Onomichi before Onomichi -> Setoda)
      // so the camera steps into an intermediate approach zoom on arrival before zooming to cluster scale.
      const nextLeg = activeConfig.itinerary[legIndex + 1];
      const nextSourceCoords = nextLeg ? resolvedCities[nextLeg.source]?.coordinates : undefined;
      const nextDestCoords = nextLeg ? resolvedCities[nextLeg.dest]?.coordinates : undefined;
      const isCurrMicro = isMicroClusterLeg(
        sourceCity?.coordinates,
        destCity.coordinates,
        leg.transport
      );
      const isNextMicro = nextLeg
        ? isMicroClusterLeg(nextSourceCoords, nextDestCoords, nextLeg.transport)
        : false;
      const isApproachingMicroCluster = !isCurrMicro && isNextMicro;

      const targetZoom = getContextualZoomForLeg(
        sourceCity?.coordinates,
        destCity.coordinates,
        leg.transport,
        currentZoomKRef.current,
        projection,
        shimanamiClusterZoom,
        isApproachingMicroCluster
      );
      currentZoomKRef.current = targetZoom;
      flyToCoordinates(destCity.coordinates, targetZoom, Math.min(850, playbackSpeedMs * 0.75));
    },
    [
      resolvedCities,
      activeConfig.itinerary,
      flyToCoordinates,
      playbackSpeedMs,
      projection,
      shimanamiClusterZoom,
    ]
  );

  // Auto-advance timer when timeline playback is active
  useEffect(() => {
    if (!isTimelineEnabled || !isPlayingTimeline) return;

    const timer = window.setInterval(() => {
      setCurrentTimelineIndex((prev) => {
        const next = prev + 1;
        if (next >= activeConfig.itinerary.length) {
          setIsPlayingTimeline(false);
          return prev;
        }
        return next;
      });
    }, playbackSpeedMs);

    return () => window.clearInterval(timer);
  }, [activeConfig.itinerary.length, isPlayingTimeline, isTimelineEnabled, playbackSpeedMs]);

  // Derive effective selected leg ID so advancing currentTimelineIndex does not require a second cascading state update
  const effectiveSelectedLegId = isTimelineEnabled
    ? (activeConfig.itinerary[currentTimelineIndex]?.id ?? selectedLegId)
    : selectedLegId;

  // Trigger camera follow whenever currentTimelineIndex changes while timeline is enabled
  useEffect(() => {
    if (!isTimelineEnabled) return;
    const rafId = window.requestAnimationFrame(() => {
      followLegDestination(currentTimelineIndex);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentTimelineIndex, followLegDestination, isTimelineEnabled]);

  // Handlers
  const handleSelectRegion = useCallback(
    (region: RegionCameraConfig) => {
      const fitCoords = region.fitCities
        ?.map((cid) => resolvedCities[cid]?.coordinates)
        .filter((c): c is [number, number] => Boolean(c));
      flyToRegion(region, 850, fitCoords);
    },
    [flyToRegion, resolvedCities]
  );

  const handleToggleMode = useCallback((mode: TransitMode) => {
    setVisibleModes((prev) => ({
      ...prev,
      [mode]: !prev[mode],
    }));
  }, []);

  const handleSelectCity = useCallback(
    (cityId: string, shouldFly: boolean = false) => {
      if (!cityId) {
        setSelectedCityId(null);
        setSelectedLegId(null);
        setIsDrawerOpen(true);
        return;
      }
      setSelectedCityId(cityId);
      setIsDrawerOpen(true);
      if (shouldFly && resolvedCities[cityId]) {
        const targetZoom = Math.max(zoomK, 5.5);
        flyToCoordinates(resolvedCities[cityId].coordinates, targetZoom, 750);
      }
    },
    [resolvedCities, flyToCoordinates, zoomK]
  );

  const handleFocusCityCamera = useCallback(
    (cityId: string) => {
      const city = resolvedCities[cityId];
      if (!city) return;
      const isShimanami = ['Onomichi', 'Setoda', 'Omishima', 'Imabari', 'Matsuyama'].includes(cityId);
      flyToCoordinates(city.coordinates, isShimanami ? shimanamiClusterZoom : 7.5, 750);
    },
    [resolvedCities, flyToCoordinates, shimanamiClusterZoom]
  );

  const handleSelectLeg = useCallback(
    (leg: ItineraryLegConfig, jumpToTimeline: boolean = false) => {
      setSelectedLegId(leg.id);
      setSelectedCityId(leg.dest);
      setIsDrawerOpen(true);

      if (jumpToTimeline) {
        const idx = activeConfig.itinerary.findIndex((l) => l.id === leg.id);
        if (idx !== -1) {
          setIsTimelineEnabled(true);
          setIsPlayingTimeline(false);
          setCurrentTimelineIndex(idx);
        }
      }
    },
    [activeConfig.itinerary]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedCityId(null);
    setSelectedLegId(null);
    setIsDrawerOpen(false);
  }, []);

  const handleCanvasSelectCity = useCallback(
    (cityId: string) => {
      handleSelectCity(cityId, false);
    },
    [handleSelectCity]
  );

  const handleCanvasSelectLeg = useCallback(
    (leg: ItineraryLegConfig) => {
      handleSelectLeg(leg, false);
    },
    [handleSelectLeg]
  );

  const handleToggleTimelineEnabled = useCallback(
    (enabled: boolean) => {
      setIsTimelineEnabled(enabled);
      if (!enabled) {
        setIsPlayingTimeline(false);
        setSelectedLegId(null);
      } else {
        const leg = activeConfig.itinerary[currentTimelineIndex];
        if (leg) {
          setSelectedLegId(leg.id);
        }
      }
    },
    [activeConfig.itinerary, currentTimelineIndex]
  );

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Top HUD: Title, Layer Toggles, Zoom Controls & Config-Driven Region Selector */}
      <RegionSelectorBar
        title={activeConfig.title}
        subtitle={activeConfig.subtitle}
        regions={effectiveRegions}
        activeRegionId={activeRegionId}
        zoomK={zoomK}
        showAdmin1={showAdmin1}
        isLoadingAdmin1={isLoadingAdmin1}
        showGraticule={showGraticule}
        showLabels={showLabels}
        onSelectRegion={handleSelectRegion}
        onToggleAdmin1={() => setShowAdmin1((v) => !v)}
        onToggleGraticule={() => setShowGraticule((v) => !v)}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetCamera={resetCamera}
        onOpenDirectoryDrawer={() => {
          setIsDrawerOpen(true);
        }}
      />

      {/* Main Declarative SVG Map Canvas */}
      <main className="relative flex-1 w-full h-full">
        <TravelMapCanvas
          svgRef={svgRef}
          cameraGroupRef={cameraGroupRef}
          projection={projection}
          transform={transform}
          zoomK={zoomK}
          invScale={invScale}
          labelScaleBoost={labelScaleBoost}
          mapConfig={activeConfig.mapConfig}
          cities={resolvedCities}
          cityStats={cityStats}
          itinerary={activeConfig.itinerary}
          transitModes={activeConfig.transitModes}
          visibleModes={visibleModes}
          countriesGeoJson={countriesGeoJson}
          admin1GeoJson={admin1GeoJson}
          showAdmin1={showAdmin1}
          showGraticule={showGraticule}
          showLabels={showLabels}
          selectedCityId={selectedCityId}
          selectedLegId={effectiveSelectedLegId}
          isTimelineEnabled={isTimelineEnabled}
          currentTimelineLegIndex={currentTimelineIndex}
          onSelectCity={handleCanvasSelectCity}
          onSelectLeg={handleCanvasSelectLeg}
          onClearSelection={handleClearSelection}
        />

        {/* Loading / Geocoding Status Banners */}
        {(isLoadingCountries || isGeocoding) && (
          <div className="pointer-events-none absolute top-28 right-4 z-20 flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-slate-200 shadow-xl backdrop-blur-md">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            <span>
              {isLoadingCountries
                ? 'Decoding 50m World Vector Topology…'
                : 'Auto-geocoding new itinerary cities…'}
            </span>
          </div>
        )}

        {unresolvedCities.length > 0 && !isGeocoding && (
          <div className="pointer-events-auto absolute top-28 left-4 z-20 rounded-xl border border-amber-500/40 bg-amber-950/90 px-3.5 py-2 text-xs text-amber-200 shadow-lg">
            Could not auto-geocode: {unresolvedCities.join(', ')}
          </div>
        )}

        {topologyError && (
          <div className="pointer-events-auto absolute top-28 left-4 z-20 rounded-xl border border-rose-500/40 bg-rose-950/90 px-3.5 py-2 text-xs text-rose-200 shadow-lg">
            {topologyError}
          </div>
        )}
      </main>

      {/* Bottom HUD: Transit Legend + Opt-In Journey Playback */}
      <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-2 p-3 sm:p-4">
        <div className="flex w-full max-w-5xl flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <TransitLegendBar
              transitModes={activeConfig.transitModes}
              visibleModes={visibleModes}
              legsByMode={journeySummary.legsByMode}
              onToggleMode={handleToggleMode}
            />

            {/* Quick Stats Pill */}
            <div className="pointer-events-auto hidden xl:flex items-center gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>
                <strong className="font-mono text-white">{journeySummary.totalCities}</strong> cities
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-mono text-white">{journeySummary.totalCountries}</strong>{' '}
                countries
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-mono text-amber-300">{journeySummary.totalNights}</strong>{' '}
                total nights
              </span>
            </div>
          </div>

          <JourneyPlayback
            isEnabled={isTimelineEnabled}
            isPlaying={isPlayingTimeline}
            currentIndex={currentTimelineIndex}
            itinerary={activeConfig.itinerary}
            cities={resolvedCities}
            transitModes={activeConfig.transitModes}
            playbackSpeedMs={playbackSpeedMs}
            onToggleEnabled={handleToggleTimelineEnabled}
            onTogglePlay={() => {
              if (!isPlayingTimeline && currentTimelineIndex >= activeConfig.itinerary.length - 1) {
                setCurrentTimelineIndex(0);
              }
              setIsPlayingTimeline((p) => !p);
            }}
            onPrev={() => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex((i) => Math.max(0, i - 1));
            }}
            onNext={() => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex((i) => Math.min(activeConfig.itinerary.length - 1, i + 1));
            }}
            onScrub={(idx) => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex(idx);
            }}
            onChangeSpeed={setPlaybackSpeedMs}
            onInspectCity={(cityId) => handleSelectCity(cityId, false)}
          />
        </div>
      </footer>

      {/* Responsive Detail Drawer (Bottom sheet on mobile, right sidebar on desktop) */}
      <CityDetailDrawer
        isOpen={isDrawerOpen}
        selectedCityId={selectedCityId}
        selectedLegId={effectiveSelectedLegId}
        homeCityId={activeConfig.itinerary[0]?.source ?? 'NYC'}
        cities={resolvedCities}
        cityStats={cityStats}
        itinerary={activeConfig.itinerary}
        transitModes={activeConfig.transitModes}
        onClose={() => setIsDrawerOpen(false)}
        onSelectCity={handleSelectCity}
        onSelectLeg={handleSelectLeg}
        onFocusCityCamera={handleFocusCityCamera}
      />
    </div>
  );
};

export default App;
