import React, { useMemo, useState } from 'react';
import { geoGraticule, geoPath, GeoProjection } from 'd3-geo';
import { ZoomTransform } from 'd3-zoom';
import type { FeatureCollection, Geometry } from 'geojson';
import {
  CityComputedStats,
  CityConfig,
  ItineraryLegConfig,
  MapRenderConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../config/types';
import { scaleStrokeDasharray } from '../config/transit.config';
import { SETO_INLAND_ISLANDS } from '../config/setoInlandIslands.config';
import {
  buildArrowheadPath,
  computeDirectionalTransitLine,
  ComputedTransitLine,
} from '../utils/arcMath';
import {
  indexGeoJsonFeatures,
  mapCitiesToAdmin1Features,
  mapCitiesToCountryFeatures,
} from '../utils/regionHitTesting';
import { computeSmartLabelLayout, LabelInputNode } from '../utils/labelLayout';

interface TravelMapCanvasProps {
  svgRef: React.RefObject<SVGSVGElement>;
  cameraGroupRef: React.RefObject<SVGGElement>;
  projection: GeoProjection;
  transform: ZoomTransform;
  zoomK: number;
  invScale: number;
  labelScaleBoost: number;
  mapConfig: MapRenderConfig;
  cities: Record<string, CityConfig>;
  cityStats: Record<string, CityComputedStats>;
  itinerary: ItineraryLegConfig[];
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  visibleModes: Record<TransitMode, boolean>;
  countriesGeoJson: FeatureCollection<Geometry> | null;
  admin1GeoJson: FeatureCollection<Geometry> | null;
  showAdmin1: boolean;
  showGraticule: boolean;
  showLabels: boolean;
  selectedCityId: string | null;
  selectedLegId: number | null;
  isTimelineEnabled: boolean;
  currentTimelineLegIndex: number; // 0-based index into itinerary
  onSelectCity: (cityId: string) => void;
  onSelectLeg: (leg: ItineraryLegConfig) => void;
  onClearSelection: () => void;
}

interface HoverTooltipState {
  type: 'city' | 'leg';
  x: number;
  y: number;
  cityId?: string;
  leg?: ItineraryLegConfig;
}

export const TravelMapCanvas: React.FC<TravelMapCanvasProps> = React.memo(({
  svgRef,
  cameraGroupRef,
  projection,
  transform,
  zoomK,
  invScale,
  labelScaleBoost,
  mapConfig,
  cities,
  cityStats,
  itinerary,
  transitModes,
  visibleModes,
  countriesGeoJson,
  admin1GeoJson,
  showAdmin1,
  showGraticule,
  showLabels,
  selectedCityId,
  selectedLegId,
  isTimelineEnabled,
  currentTimelineLegIndex,
  onSelectCity,
  onSelectLeg,
  onClearSelection,
}) => {
  const [hoverInfo, setHoverInfo] = useState<HoverTooltipState | null>(null);
  // Stable primitive so the arrow layer memo only recomputes when the hovered leg changes (not on every mousemove)
  const hoveredLegId = hoverInfo?.type === 'leg' ? (hoverInfo.leg?.id ?? null) : null;

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const spherePath = useMemo(() => {
    return pathGenerator({ type: 'Sphere' }) || '';
  }, [pathGenerator]);

  const graticulePath = useMemo(() => {
    const graticule = geoGraticule().step([15, 15]);
    return pathGenerator(graticule()) || '';
  }, [pathGenerator]);

  const indexedCountries = useMemo(
    () => indexGeoJsonFeatures(countriesGeoJson),
    [countriesGeoJson]
  );

  const indexedAdmin1 = useMemo(
    () => (showAdmin1 ? indexGeoJsonFeatures(admin1GeoJson) : []),
    [admin1GeoJson, showAdmin1]
  );

  const cityToCountryFeatureIds = useMemo(
    () => mapCitiesToCountryFeatures(indexedCountries, cities),
    [indexedCountries, cities]
  );

  const { cityToAdmin1Ids, subdividedCountryNames } = useMemo(
    () => mapCitiesToAdmin1Features(indexedAdmin1, cities),
    [indexedAdmin1, cities]
  );

  const countryPaths = useMemo(() => {
    return indexedCountries
      .map((item) => ({
        id: item.id,
        normName: item.normName,
        d: pathGenerator(item.feature) || '',
      }))
      .filter((item) => Boolean(item.d));
  }, [indexedCountries, pathGenerator]);

  const admin1Paths = useMemo(() => {
    if (!showAdmin1 || indexedAdmin1.length === 0) return [];
    return indexedAdmin1
      .map((item) => ({
        id: item.id,
        name: item.normName,
        d: pathGenerator(item.feature) || '',
      }))
      .filter((item) => Boolean(item.d));
  }, [indexedAdmin1, pathGenerator, showAdmin1]);

  const setoIslandPaths = useMemo(() => {
    return SETO_INLAND_ISLANDS.features
      .map((item) => ({
        id: item.id as string,
        name: (item.properties?.name as string) || 'Island',
        d: pathGenerator(item) || '',
      }))
      .filter((item) => Boolean(item.d));
  }, [pathGenerator]);

  // Precompute projected coordinates for all cities
  const projectedCities = useMemo(() => {
    const map: Record<string, { city: CityConfig; x: number; y: number }> = {};
    for (const [id, city] of Object.entries(cities)) {
      const pt = projection(city.coordinates);
      if (pt) {
        map[id] = { city, x: pt[0], y: pt[1] };
      }
    }
    return map;
  }, [cities, projection]);

  // Precompute all directional straight transit lines (with parallel offset for bidirectional pairs)
  const computedLines = useMemo(() => {
    const directedPairs = new Set<string>();
    for (const leg of itinerary) {
      directedPairs.add(`${leg.source}__${leg.dest}`);
    }

    const list: Array<{
      leg: ItineraryLegConfig;
      index: number;
      line: ComputedTransitLine;
    }> = [];

    itinerary.forEach((leg, index) => {
      const sourceCity = cities[leg.source];
      const destCity = cities[leg.dest];
      if (!sourceCity || !destCity) return;

      const isBidirectional = directedPairs.has(`${leg.dest}__${leg.source}`);
      const parallelOffsetPx = isBidirectional
        ? mapConfig.bidirectionalParallelOffset * invScale
        : 0;

      const sourceNights = cityStats[leg.source]?.totalNights ?? 0;
      const destNights = cityStats[leg.dest]?.totalNights ?? 0;
      const sourceBaseR = sourceNights === 0 ? 2.4 : 2.8 + Math.min(2.0, Math.sqrt(sourceNights) * 0.38);
      const destBaseR = destNights === 0 ? 2.4 : 2.8 + Math.min(2.0, Math.sqrt(destNights) * 0.38);
      const sourcePinR = (sourceBaseR + 0.75) * invScale;
      const destPinR = (destBaseR + 0.75) * invScale;

      const line = computeDirectionalTransitLine(
        sourceCity.coordinates,
        destCity.coordinates,
        projection,
        mapConfig.width,
        parallelOffsetPx,
        mapConfig.antimeridianThresholdRatio,
        sourcePinR,
        destPinR
      );
      if (line) {
        list.push({ leg, index, line });
      }
    });

    return list;
  }, [
    cities,
    cityStats,
    invScale,
    itinerary,
    mapConfig.antimeridianThresholdRatio,
    mapConfig.bidirectionalParallelOffset,
    mapConfig.width,
    projection,
  ]);

  const homeCityId = itinerary[0]?.source ?? 'NYC';
  const activeTimelineLeg = isTimelineEnabled ? itinerary[currentTimelineLegIndex] : null;

  // Determine which cities are visited up to the current timeline step
  const visitedCitiesInTimeline = useMemo(() => {
    if (!isTimelineEnabled) return null;
    const set = new Set<string>();
    for (let i = 0; i <= currentTimelineLegIndex && i < itinerary.length; i++) {
      set.add(itinerary[i].source);
      set.add(itinerary[i].dest);
    }
    return set;
  }, [currentTimelineLegIndex, isTimelineEnabled, itinerary]);

  const labelFontSize = 8.6 * invScale * labelScaleBoost;

  // Compute collision-free multi-direction label placements for all projected cities
  const smartLabelPlacements = useMemo(() => {
    if (!showLabels) return {};

    const nodes: LabelInputNode[] = Object.values(projectedCities).map(({ city, x, y }) => {
      const stats = cityStats[city.id];
      const totalNights = stats?.totalNights ?? 0;
      const connectionCount =
        (stats?.arrivals.length ?? 0) + (stats?.departures.length ?? 0);

      const isSelected = selectedCityId === city.id;
      const isHomeCity = city.id === homeCityId;
      const isTimelineActiveDest = activeTimelineLeg?.dest === city.id;
      const isTimelineActiveSource = activeTimelineLeg?.source === city.id;
      const isConnectedToSelectedCity =
        selectedCityId !== null &&
        itinerary.some(
          (l) =>
            (l.source === selectedCityId && l.dest === city.id) ||
            (l.dest === selectedCityId && l.source === city.id)
        );

      const nightBonus =
        totalNights === 0 ? -0.4 : Math.min(2.0, Math.sqrt(totalNights) * 0.38);
      // Home city uses a fixed base size equal to the largest regular pin (2.8 + max nightBonus 2.0)
      const baseRadius = (isHomeCity ? 4.8 : 2.8 + nightBonus) * invScale;
      const radius =
        isSelected || isTimelineActiveDest
          ? baseRadius * 1.35
          : isTimelineActiveSource || isConnectedToSelectedCity
            ? baseRadius * 1.15
            : baseRadius;

      let priority = totalNights * 100 + connectionCount * 15;
      if (isSelected) priority += 100000;
      if (isTimelineActiveDest) priority += 90000;
      if (isTimelineActiveSource) priority += 80000;
      if (isHomeCity) priority += 75000;
      if (isConnectedToSelectedCity) priority += 50000;

      return {
        id: city.id,
        name: city.name,
        x,
        y,
        radius,
        priority,
        forceShow: isSelected || isTimelineActiveDest || isTimelineActiveSource || isHomeCity,
      };
    });

    return computeSmartLabelLayout(nodes, invScale, labelFontSize, zoomK);
  }, [
    activeTimelineLeg?.dest,
    activeTimelineLeg?.source,
    cityStats,
    homeCityId,
    invScale,
    itinerary,
    labelFontSize,
    projectedCities,
    selectedCityId,
    showLabels,
    zoomK,
  ]);

  // Compute highlighted country feature IDs and Admin-1 province/state feature IDs
  const {
    visitedCountryFeatureIds,
    activeCountryFeatureIds,
    visitedAdmin1FeatureIds,
    activeAdmin1FeatureIds,
  } = useMemo(() => {
    const visitedCountries = new Set<string>();
    const activeCountries = new Set<string>();
    const visitedAdmin1 = new Set<string>();
    const activeAdmin1 = new Set<string>();

    const activeCityIds = visitedCitiesInTimeline
      ? Array.from(visitedCitiesInTimeline)
      : Object.keys(cities);

    for (const cityId of activeCityIds) {
      for (const cId of cityToCountryFeatureIds[cityId] ?? []) {
        visitedCountries.add(cId);
      }
      for (const aId of cityToAdmin1Ids[cityId] ?? []) {
        visitedAdmin1.add(aId);
      }
    }

    const focusCityId = selectedCityId ?? activeTimelineLeg?.dest ?? null;
    if (focusCityId) {
      for (const cId of cityToCountryFeatureIds[focusCityId] ?? []) {
        activeCountries.add(cId);
      }
      for (const aId of cityToAdmin1Ids[focusCityId] ?? []) {
        activeAdmin1.add(aId);
      }
    }

    return {
      visitedCountryFeatureIds: visitedCountries,
      activeCountryFeatureIds: activeCountries,
      visitedAdmin1FeatureIds: visitedAdmin1,
      activeAdmin1FeatureIds: activeAdmin1,
    };
  }, [
    activeTimelineLeg?.dest,
    cities,
    cityToAdmin1Ids,
    cityToCountryFeatureIds,
    selectedCityId,
    visitedCitiesInTimeline,
  ]);

  const isJapanVisited = useMemo(() => {
    return (
      visitedCountryFeatureIds.has('392') ||
      Array.from(visitedCountryFeatureIds).some((id) => id.toLowerCase().includes('japan'))
    );
  }, [visitedCountryFeatureIds]);

  const isJapanActive = useMemo(() => {
    return (
      activeCountryFeatureIds.has('392') ||
      Array.from(activeCountryFeatureIds).some((id) => id.toLowerCase().includes('japan'))
    );
  }, [activeCountryFeatureIds]);

  const handleBackgroundClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget || (e.target as SVGElement).dataset.bg === 'true') {
      onClearSelection();
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Subtle radial atmospheric glow behind the globe */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.4) 55%, rgba(6, 9, 19, 0.95) 100%)',
        }}
      />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${mapConfig.width} ${mapConfig.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
        onClick={handleBackgroundClick}
      >
        <defs>
          <radialGradient id="oceanGradient" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#0b1528" />
            <stop offset="70%" stopColor="#070d19" />
            <stop offset="100%" stopColor="#040811" />
          </radialGradient>

          <filter id="glow-active" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation={1.8 * invScale} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          width={mapConfig.width}
          height={mapConfig.height}
          fill="transparent"
          data-bg="true"
        />

        {/* D3 Zoom/Pan Transform Container (updated directly via DOM ref during gestures for 60-120fps) */}
        <g ref={cameraGroupRef} transform={transform.toString()}>
          {/* Globe Sphere / Ocean Outline */}
          {spherePath && (
            <path
              d={spherePath}
              fill="url(#oceanGradient)"
              stroke="#1e293b"
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
              data-bg="true"
            />
          )}

          {/* Country Polygons (Memoized with non-scaling-stroke so 0 paths re-render during zoom/pan) */}
          {useMemo(
            () => (
              <g className="countries-layer">
                {countryPaths.map((country) => {
                  const isSubdividedInAdmin1 =
                    showAdmin1 &&
                    admin1Paths.length > 0 &&
                    Boolean(country.normName && subdividedCountryNames.has(country.normName));

                  const isVisitedCountry =
                    !isSubdividedInAdmin1 && visitedCountryFeatureIds.has(country.id);
                  const isActiveCountry =
                    !isSubdividedInAdmin1 && activeCountryFeatureIds.has(country.id);

                  return (
                    <path
                      key={country.id}
                      d={country.d}
                      fill={
                        isActiveCountry
                          ? '#203e66'
                          : isVisitedCountry
                            ? '#183052'
                            : '#111b2e'
                      }
                      stroke={
                        isActiveCountry
                          ? '#38bdf8'
                          : isVisitedCountry
                            ? '#2b5485'
                            : '#26354d'
                      }
                      strokeWidth={isActiveCountry ? 1.25 : isVisitedCountry ? 0.95 : 0.7}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      data-bg="true"
                    />
                  );
                })}
              </g>
            ),
            [
              activeCountryFeatureIds,
              admin1Paths.length,
              countryPaths,
              showAdmin1,
              subdividedCountryNames,
              visitedCountryFeatureIds,
            ]
          )}

          {/* Optional Admin-1 State/Province Polygons & Boundary Lines */}
          {useMemo(
            () =>
              showAdmin1 && admin1Paths.length > 0 ? (
                <g className="admin1-layer pointer-events-none">
                  {admin1Paths.map((prov) => {
                    const isVisitedProv = visitedAdmin1FeatureIds.has(prov.id);
                    const isActiveProv = activeAdmin1FeatureIds.has(prov.id);

                    return (
                      <path
                        key={prov.id}
                        d={prov.d}
                        fill={
                          isActiveProv
                            ? '#203e66'
                            : isVisitedProv
                              ? '#183052'
                              : 'none'
                        }
                        stroke={
                          isActiveProv
                            ? '#38bdf8'
                            : isVisitedProv
                              ? '#38bdf8'
                              : '#334155'
                        }
                        strokeOpacity={isActiveProv ? 0.85 : isVisitedProv ? 0.55 : 0.5}
                        strokeWidth={isActiveProv ? 1.1 : isVisitedProv ? 0.85 : 0.5}
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </g>
              ) : null,
            [activeAdmin1FeatureIds, admin1Paths, showAdmin1, visitedAdmin1FeatureIds]
          )}

          {/* Seto Inland Sea Islands Layer (Onomichi -> Setoda -> Omishima -> Imabari -> Matsuyama corridor) */}
          {useMemo(
            () => (
              <g className="seto-islands-layer">
                {setoIslandPaths.map((island) => (
                  <path
                    key={island.id}
                    d={island.d}
                    fill={
                      isJapanActive
                        ? '#203e66'
                        : isJapanVisited
                          ? '#183052'
                          : '#111b2e'
                    }
                    stroke={
                      isJapanActive
                        ? '#38bdf8'
                        : isJapanVisited
                          ? '#2b5485'
                          : '#26354d'
                    }
                    strokeWidth={isJapanActive ? 1.25 : isJapanVisited ? 0.95 : 0.7}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    data-bg="true"
                  >
                    <title>{island.name}</title>
                  </path>
                ))}
              </g>
            ),
            [isJapanActive, isJapanVisited, setoIslandPaths]
          )}

          {/* Graticule Grid (Rendered above land/admin1 polygons so lat/lon lines remain visible across continents) */}
          {showGraticule && graticulePath && (
            <path
              d={graticulePath}
              fill="none"
              stroke="#38bdf8"
              strokeOpacity={0.28}
              strokeWidth={0.75}
              vectorEffect="non-scaling-stroke"
              className="graticule-layer pointer-events-none"
            />
          )}

          {/* Directional Straight Transit Lines Layer */}
          {useMemo(
            () => (
              <g className="transit-lines-layer">
                {computedLines.map(({ leg, index, line }) => {
                  if (!visibleModes[leg.transport]) return null;

                  const isCurrentTimeline = isTimelineEnabled && index === currentTimelineLegIndex;
                  const isFutureTimeline = isTimelineEnabled && index > currentTimelineLegIndex;

                  if (isFutureTimeline) {
                    return null;
                  }

                  const modeStyle = transitModes[leg.transport];
                  const isSelectedLeg = selectedLegId === leg.id || isCurrentTimeline;
                  const isConnectedToSelectedCity =
                    selectedCityId !== null &&
                    (leg.source === selectedCityId || leg.dest === selectedCityId);

                  // Compute opacity based on selection / timeline state
                  let strokeOpacity = 0.84;
                  if (isTimelineEnabled) {
                    strokeOpacity = isCurrentTimeline ? 1 : 0.72;
                  } else if (selectedLegId !== null) {
                    strokeOpacity = isSelectedLeg ? 1 : 0.25;
                  } else if (selectedCityId !== null) {
                    strokeOpacity = isConnectedToSelectedCity ? 0.96 : 0.22;
                  }

                  const strokeMultiplier = isSelectedLeg
                    ? 1.55
                    : isConnectedToSelectedCity
                      ? 1.25
                      : 1.0;

                  const strokeWidth = modeStyle.baseStrokeWidth * strokeMultiplier * invScale;
                  const scaledDash = scaleStrokeDasharray(modeStyle.strokeDasharray, invScale);

                  return (
                    <g
                      key={leg.id}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLeg(leg);
                      }}
                      onMouseEnter={(e) => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) {
                          setHoverInfo({
                            type: 'leg',
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            leg,
                          });
                        }
                      }}
                      onMouseMove={(e) => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) {
                          setHoverInfo({
                            type: 'leg',
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            leg,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoverInfo(null)}
                    >
                      {/* Invisible wider hit-target path for easy clicking */}
                      <path
                        d={line.pathData}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={10 * invScale}
                      />

                      {/* Subtle outer glow for active or selected leg */}
                      {(isSelectedLeg || isConnectedToSelectedCity) && (
                        <path
                          d={line.pathData}
                          fill="none"
                          stroke={modeStyle.color}
                          strokeWidth={strokeWidth * 2.4}
                          strokeOpacity={0.22}
                          strokeLinecap="round"
                        />
                      )}

                      {/* Primary Directional Straight Line Path */}
                      <path
                        d={line.pathData}
                        fill="none"
                        stroke={modeStyle.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={scaledDash}
                        strokeOpacity={strokeOpacity}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </g>
            ),
            [
              computedLines,
              currentTimelineLegIndex,
              invScale,
              isTimelineEnabled,
              onSelectLeg,
              selectedCityId,
              selectedLegId,
              svgRef,
              transitModes,
              visibleModes,
            ]
          )}

          {/* City Pins Layer */}
          {useMemo(
            () => (
              <g className="cities-layer">
                {Object.values(projectedCities).map(({ city, x, y }) => {
                  const stats = cityStats[city.id];
                  const totalNights = stats?.totalNights ?? 0;

                  const isSelected = selectedCityId === city.id;
                  const isTimelineActiveDest = activeTimelineLeg?.dest === city.id;
                  const isTimelineActiveSource = activeTimelineLeg?.source === city.id;
                  const isVisitedInTimeline = visitedCitiesInTimeline
                    ? visitedCitiesInTimeline.has(city.id)
                    : true;

                  const isConnectedToSelectedCity =
                    selectedCityId !== null &&
                    itinerary.some(
                      (l) =>
                        (l.source === selectedCityId && l.dest === city.id) ||
                        (l.dest === selectedCityId && l.source === city.id)
                    );
                  const isHomeCity = city.id === homeCityId;

                  // Base pin radius scales slightly with total nights stayed + zoom-invariant invScale
                  const nightBonus =
                    totalNights === 0 ? -0.4 : Math.min(2.0, Math.sqrt(totalNights) * 0.38);
                  // Home city uses a fixed base size equal to the largest regular pin
                  const baseRadius = (isHomeCity ? 4.8 : 2.8 + nightBonus) * invScale;
                  const radius =
                    isSelected || isTimelineActiveDest
                      ? baseRadius * 1.35
                      : isTimelineActiveSource || isConnectedToSelectedCity
                        ? baseRadius * 1.15
                        : baseRadius;

                  const pinOpacity =
                    isTimelineEnabled && !isVisitedInTimeline
                      ? 0.22
                      : selectedCityId &&
                          !isSelected &&
                          !isConnectedToSelectedCity &&
                          !isTimelineActiveDest
                        ? 0.45
                        : 1;

                  return (
                    <g
                      key={city.id}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer"
                      style={{ opacity: pinOpacity }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCity(city.id);
                      }}
                      onMouseEnter={(e) => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) {
                          setHoverInfo({
                            type: 'city',
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            cityId: city.id,
                          });
                        }
                      }}
                      onMouseMove={(e) => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (rect) {
                          setHoverInfo({
                            type: 'city',
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            cityId: city.id,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoverInfo(null)}
                    >
                      {/* Invisible hit circle for easy clicking */}
                      <circle r={Math.max(8 * invScale, radius * 2.2)} fill="transparent" />

                      {/* Outer dark halo for contrast against transit lines */}
                      <circle
                        r={radius + 0.75 * invScale}
                        fill="#060913"
                        fillOpacity={0.88}
                      />

                      {isHomeCity ? (
                        <>
                          {/* Home City Pin: amber circle with a house glyph */}
                          <circle
                            r={radius}
                            fill="#f59e0b"
                            stroke="#0f172a"
                            strokeWidth={0.75 * invScale}
                          />
                          {/* House glyph drawn in unit space [-1, 1] and scaled to the pin radius */}
                          <path
                            transform={`scale(${radius})`}
                            d="M 0 -0.62 L 0.6 -0.08 L 0.42 -0.08 L 0.42 0.52 L 0.12 0.52 L 0.12 0.18 L -0.12 0.18 L -0.12 0.52 L -0.42 0.52 L -0.42 -0.08 L -0.6 -0.08 Z"
                            fill="#0f172a"
                          />
                        </>
                      ) : (
                        /* Main City Pin Circle (uniform color & style for every non-home city) */
                        <circle
                          r={radius}
                          fill="#f8fafc"
                          stroke="#0f172a"
                          strokeWidth={0.75 * invScale}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            ),
            [
              activeTimelineLeg?.dest,
              activeTimelineLeg?.source,
              cityStats,
              homeCityId,
              invScale,
              isTimelineEnabled,
              itinerary,
              onSelectCity,
              projectedCities,
              selectedCityId,
              svgRef,
              visitedCitiesInTimeline,
            ]
          )}

          {/* Directional Arrowheads Layer (Rendered above pin halos so short-hop arrows are never occluded) */}
          {useMemo(
            () =>
              isTimelineEnabled ? null : (
                <g className="transit-arrows-layer pointer-events-none">
                  {computedLines.map(({ leg, line }) => {
                    if (!visibleModes[leg.transport]) return null;

                    const modeStyle = transitModes[leg.transport];
                    const isSelectedLeg = selectedLegId === leg.id;
                    const isConnectedToSelectedCity =
                      selectedCityId !== null &&
                      (leg.source === selectedCityId || leg.dest === selectedCityId);
                    const isHoveredLeg = hoveredLegId === leg.id;

                    // Arrows are hidden by default to reduce visual clutter; only show them on
                    // legs the user is focusing on (selected, hovered, or connected to selected city)
                    if (!isSelectedLeg && !isHoveredLeg && !isConnectedToSelectedCity) {
                      return null;
                    }

                    let strokeOpacity = 0.88;
                    if (selectedLegId !== null) {
                      strokeOpacity = isSelectedLeg ? 1 : 0.28;
                    } else if (selectedCityId !== null) {
                      strokeOpacity = isConnectedToSelectedCity ? 0.98 : 0.25;
                    }

                    if (isHoveredLeg) strokeOpacity = Math.max(strokeOpacity, 0.95);

                    const arrowSizeMultiplier = isSelectedLeg
                      ? 1.3
                      : isConnectedToSelectedCity || isHoveredLeg
                        ? 1.12
                        : 0.92;

                    return (
                      <g key={`arrow-${leg.id}`}>
                        {line.segments.map((seg, segIdx) => {
                          // Never shrink arrowheads below 72% of invScale so short-hop arrows remain clearly visible
                          const arrowScale = Math.max(
                            invScale * 0.72,
                            Math.min(invScale, seg.length / (7.5 * arrowSizeMultiplier))
                          );
                          const segArrowPath = buildArrowheadPath(arrowScale, arrowSizeMultiplier);
                          return (
                            <path
                              key={segIdx}
                              d={segArrowPath}
                              fill={modeStyle.color}
                              fillOpacity={Math.min(1, strokeOpacity + 0.12)}
                              stroke="#060913"
                              strokeWidth={0.85 * arrowScale}
                              paintOrder="stroke"
                              transform={`translate(${seg.arrowX}, ${seg.arrowY}) rotate(${seg.arrowAngleDeg})`}
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              ),
            [
              computedLines,
              hoveredLegId,
              invScale,
              isTimelineEnabled,
              selectedCityId,
              selectedLegId,
              transitModes,
              visibleModes,
            ]
          )}

          {/* Zoom-Invariant City Labels Layer (Topmost SVG Layer) */}
          {useMemo(
            () => (
              <g className="city-labels-layer pointer-events-none">
                {Object.values(projectedCities).map(({ city, x, y }) => {
                  const isSelected = selectedCityId === city.id;
                  const isHomeCity = city.id === homeCityId;
                  const isTimelineActiveDest = activeTimelineLeg?.dest === city.id;
                  const isVisitedInTimeline = visitedCitiesInTimeline
                    ? visitedCitiesInTimeline.has(city.id)
                    : true;
                  const isConnectedToSelectedCity =
                    selectedCityId !== null &&
                    itinerary.some(
                      (l) =>
                        (l.source === selectedCityId && l.dest === city.id) ||
                        (l.dest === selectedCityId && l.source === city.id)
                    );

                  const labelPlacement = smartLabelPlacements[city.id];
                  const shouldShowLabel = Boolean(showLabels && labelPlacement?.visible);
                  if (!shouldShowLabel || !labelPlacement) return null;

                  const labelOpacity =
                    isTimelineEnabled && !isVisitedInTimeline
                      ? 0.22
                      : selectedCityId &&
                          !isSelected &&
                          !isConnectedToSelectedCity &&
                          !isTimelineActiveDest
                        ? 0.45
                        : 1;

                  return (
                    <g
                      key={`label-${city.id}`}
                      transform={`translate(${x}, ${y})`}
                      style={{ opacity: labelOpacity }}
                    >
                      <text
                        x={labelPlacement.dx}
                        y={labelPlacement.dy}
                        textAnchor={labelPlacement.textAnchor}
                        fontSize={labelFontSize * (isHomeCity ? 1.06 : 1)}
                        fontWeight={isSelected || isTimelineActiveDest || isHomeCity ? 700 : 500}
                        fill={
                          isHomeCity
                            ? '#fde68a'
                            : isSelected || isTimelineActiveDest
                              ? '#f8fafc'
                              : '#cbd5e1'
                        }
                        stroke="#060913"
                        strokeWidth={2.4 * invScale * Math.sqrt(labelScaleBoost)}
                        paintOrder="stroke"
                        className="font-sans tracking-tight"
                      >
                        {city.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            ),
            [
              activeTimelineLeg?.dest,
              homeCityId,
              invScale,
              isTimelineEnabled,
              itinerary,
              labelFontSize,
              labelScaleBoost,
              projectedCities,
              selectedCityId,
              showLabels,
              smartLabelPlacements,
              visitedCitiesInTimeline,
            ]
          )}
        </g>
      </svg>

      {/* Floating Hover Tooltip */}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-30 max-w-xs rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl backdrop-blur-md"
          style={{
            left: Math.min(hoverInfo.x + 14, window.innerWidth - 260),
            top: Math.max(hoverInfo.y - 12, 12),
          }}
        >
          {hoverInfo.type === 'city' && hoverInfo.cityId && cityStats[hoverInfo.cityId] && (
            <div>
              <div className="font-semibold text-white flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span>{cityStats[hoverInfo.cityId].city.fullName}</span>
                  {hoverInfo.cityId === homeCityId && (
                    <span className="rounded bg-amber-500/25 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      Home Base
                    </span>
                  )}
                </span>
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                  {cityStats[hoverInfo.cityId].totalNights === 0
                    ? '0 nights (intraday)'
                    : `${cityStats[hoverInfo.cityId].totalNights} nights`}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-3">
                <span>{cityStats[hoverInfo.cityId].arrivals.length} arrival(s)</span>
                <span>·</span>
                <span>{cityStats[hoverInfo.cityId].departures.length} departure(s)</span>
              </div>
              <div className="mt-0.5 text-[10px] text-sky-400/90">Click pin to inspect legs</div>
            </div>
          )}

          {hoverInfo.type === 'leg' && hoverInfo.leg && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-slate-400">
                  Leg #{hoverInfo.leg.id}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${transitModes[hoverInfo.leg.transport].color}22`,
                    color: transitModes[hoverInfo.leg.transport].color,
                  }}
                >
                  {hoverInfo.leg.transport}
                </span>
              </div>
              <div className="mt-1 font-semibold text-white">
                {cities[hoverInfo.leg.source]?.name ?? hoverInfo.leg.source} →{' '}
                {cities[hoverInfo.leg.dest]?.name ?? hoverInfo.leg.dest}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                {hoverInfo.leg.startDate} → {hoverInfo.leg.endDate} (
                {hoverInfo.leg.nights === 0
                  ? '0 nights · intraday stop'
                  : `${hoverInfo.leg.nights} ${hoverInfo.leg.nights === 1 ? 'night' : 'nights'}`}
                )
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
