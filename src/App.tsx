import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TimelineScrubber } from './components/TimelineScrubber';
import { TransitLegendBar } from './components/TransitLegendBar';
import { TravelMapCanvas } from './components/TravelMapCanvas';

/**
 * Computes an adaptive camera zoom level for a leg based on the geographic span
 * between source and destination so short island-hopping bike legs zoom in closely
 * while intercontinental flights frame a wider region around the destination.
 */
function getContextualZoomForLeg(
  sourceCoords: [number, number] | undefined,
  destCoords: [number, number],
  transport: TransitMode
): number {
  if (transport === 'Bike') {
    return 42;
  }
  if (!sourceCoords) {
    return 5.5;
  }
  const dLon = Math.abs(sourceCoords[0] - destCoords[0]);
  const dLat = Math.abs(sourceCoords[1] - destCoords[1]);
  const span = Math.hypot(dLon, dLat);

  if (span < 0.6) return 38;
  if (span < 1.2) return 16;
  if (span < 3.5) return 7.5;
  if (span < 8) return 6.0;
  if (span < 20) return 4.8;
  if (span < 50) return 3.6;
  return 2.6;
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

  // Opt-In Chronological Timeline Scrubber State
  const [isTimelineEnabled, setIsTimelineEnabled] = useState<boolean>(false);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  // Section 4 requirement: Follow Toggle (autoFollowCamera) is enabled (true) by default
  const [autoFollowCamera, setAutoFollowCamera] = useState<boolean>(true);
  const [showFutureLegsInTimeline, setShowFutureLegsInTimeline] = useState<boolean>(true);
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
    flyToCoordinates,
    flyToRegion,
    zoomIn,
    zoomOut,
    resetCamera,
  } = useMapCamera(activeConfig.mapConfig);

  // Map Topology Hook (uses lightweight 50m below 6x zoom and upgrades to 10m high-res when zoomed >= 6x)
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
    zoomK >= 6
  );

  // Automatically resolve city coordinates from the itinerary's source & dest city names
  const {
    cities: resolvedCities,
    isGeocoding,
    unresolvedCities,
  } = useResolvedCities(activeConfig.itinerary);

  // Derived Statistics
  const cityStats = useMemo(
    () => computeAllCityStats(resolvedCities, activeConfig.itinerary),
    [resolvedCities, activeConfig.itinerary]
  );

  const journeySummary = useMemo(
    () => computeJourneySummary(resolvedCities, activeConfig.itinerary),
    [resolvedCities, activeConfig.itinerary]
  );

  // Follow camera effect when timeline index advances and autoFollowCamera is enabled
  const followLegDestination = useCallback(
    (legIndex: number) => {
      if (!autoFollowCamera) return;
      const leg = activeConfig.itinerary[legIndex];
      if (!leg) return;
      const destCity = resolvedCities[leg.dest];
      const sourceCity = resolvedCities[leg.source];
      if (!destCity) return;

      const targetZoom = getContextualZoomForLeg(
        sourceCity?.coordinates,
        destCity.coordinates,
        leg.transport
      );
      flyToCoordinates(destCity.coordinates, targetZoom, Math.min(850, playbackSpeedMs * 0.75));
    },
    [resolvedCities, activeConfig.itinerary, autoFollowCamera, flyToCoordinates, playbackSpeedMs]
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

  // Trigger camera follow whenever currentTimelineIndex changes while timeline is enabled
  useEffect(() => {
    if (!isTimelineEnabled) return;
    const leg = activeConfig.itinerary[currentTimelineIndex];
    if (leg) {
      setSelectedLegId(leg.id);
      followLegDestination(currentTimelineIndex);
    }
  }, [activeConfig.itinerary, currentTimelineIndex, followLegDestination, isTimelineEnabled]);

  // Handlers
  const handleSelectRegion = useCallback(
    (region: RegionCameraConfig) => {
      flyToRegion(region, 850);
    },
    [flyToRegion]
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
      const isShimanami = ['Onomichi', 'Setoda', 'Omishima', 'Imabari'].includes(cityId);
      flyToCoordinates(city.coordinates, isShimanami ? 42 : 7.5, 750);
    },
    [resolvedCities, flyToCoordinates]
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
        regions={activeConfig.regions}
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
          selectedLegId={selectedLegId}
          isTimelineEnabled={isTimelineEnabled}
          currentTimelineLegIndex={currentTimelineIndex}
          showFutureLegsInTimeline={showFutureLegsInTimeline}
          onSelectCity={(cityId) => handleSelectCity(cityId, false)}
          onSelectLeg={(leg) => handleSelectLeg(leg, false)}
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

      {/* Bottom HUD: Transit Legend + Opt-In Chronological Timeline Scrubber */}
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

          <TimelineScrubber
            isEnabled={isTimelineEnabled}
            isPlaying={isPlayingTimeline}
            autoFollowCamera={autoFollowCamera}
            showFutureLegs={showFutureLegsInTimeline}
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
            onReset={() => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex(0);
            }}
            onScrub={(idx) => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex(idx);
            }}
            onToggleAutoFollow={setAutoFollowCamera}
            onToggleShowFutureLegs={setShowFutureLegsInTimeline}
            onChangeSpeed={setPlaybackSpeedMs}
            onInspectCity={(cityId) => handleSelectCity(cityId, false)}
          />
        </div>
      </footer>

      {/* Responsive Detail Drawer (Bottom sheet on mobile, right sidebar on desktop) */}
      <CityDetailDrawer
        isOpen={isDrawerOpen}
        selectedCityId={selectedCityId}
        selectedLegId={selectedLegId}
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
