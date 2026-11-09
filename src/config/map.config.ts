import { MapRenderConfig } from './types';

export const MAP_CONFIG: MapRenderConfig = {
  width: 1200,
  height: 675,
  projectionScale: 225,
  translateYDivisor: 1.85,
  rotation: [-11, 0],
  scaleExtent: [1, 250],
  zoomInvariantExponent: 0.82,
  bidirectionalParallelOffset: 2.6,
  antimeridianThresholdRatio: 0.5,
  countriesTopoJsonUrl: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json',
  admin1GeoJsonUrl:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',
};
