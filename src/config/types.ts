export type TransitMode = 'Flight' | 'Train' | 'Drive' | 'Bike';

export interface TransitModeStyleConfig {
  mode: TransitMode;
  label: string;
  color: string;
  strokeDasharray: string;
  baseStrokeWidth: number;
  description: string;
}

export interface CityConfig {
  id: string;
  name: string;
  country: string;
  fullName: string;
  /** [longitude, latitude] in decimal degrees */
  coordinates: [number, number];
}

export interface ItineraryOriginStopInput {
  city: string;
  startDate?: string;
  endDate?: string;
  transport?: TransitMode;
}

export interface ItineraryTransitStopInput {
  startDate: string;
  endDate: string;
  city: string;
  transport: TransitMode;
}

export type ItineraryStopInput = ItineraryOriginStopInput | ItineraryTransitStopInput;

export interface ItineraryLegConfig {
  /** Monotonically increasing 1-based leg number (1..N) */
  id: number;
  startDate: string;
  endDate: string;
  /** Automatically computed from (endDate - startDate) in days; 0 indicates an intraday stop */
  nights: number;
  /** Derived from stops[i - 1].city */
  source: string;
  /** Derived from stops[i].city */
  dest: string;
  transport: TransitMode;
}

export interface RegionCameraConfig {
  id: string;
  label: string;
  shortLabel: string;
  /** [longitude, latitude] center coordinate */
  center: [number, number];
  zoom: number;
  /** Optional list of city IDs to dynamically fit in the unobstructed viewport */
  fitCities?: string[];
  description?: string;
}

export interface MapRenderConfig {
  /** Logical SVG coordinate space width */
  width: number;
  /** Logical SVG coordinate space height */
  height: number;
  /** d3.geoNaturalEarth1().scale(projectionScale) */
  projectionScale: number;
  /** d3.geoNaturalEarth1().translate([width / 2, height / translateYDivisor]) */
  translateYDivisor: number;
  /** d3.geoNaturalEarth1().rotate(rotation) */
  rotation: [number, number];
  /** d3.zoom().scaleExtent(scaleExtent) */
  scaleExtent: [number, number];
  /** Exponent for zoom-invariant scaling: 1 / Math.pow(zoomK, zoomInvariantExponent) */
  zoomInvariantExponent: number;
  /** Perpendicular parallel offset (in base px) for bidirectional straight line pairs */
  bidirectionalParallelOffset: number;
  /** Fraction of map width above which a transit line splits across the Pacific seam */
  antimeridianThresholdRatio: number;
  /** Remote TopoJSON URL for countries / landmass */
  countriesTopoJsonUrl: string;
  /** Remote GeoJSON URL for Admin-1 state/province boundary lines */
  admin1GeoJsonUrl: string;
}

export interface TravelMapConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  regions: Record<string, RegionCameraConfig>;
  itinerary: ItineraryLegConfig[];
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  mapConfig: MapRenderConfig;
}

export interface CityComputedStats {
  city: CityConfig;
  totalNights: number;
  visitCount: number;
  arrivals: ItineraryLegConfig[];
  departures: ItineraryLegConfig[];
  firstArrivalDate: string | null;
  lastDepartureDate: string | null;
}
