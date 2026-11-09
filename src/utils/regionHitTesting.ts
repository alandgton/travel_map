import { geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { CityConfig } from '../config/types';

function computeFastFeatureBounds(
  feature: Feature<Geometry>
): [[number, number], [number, number]] {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;
  let found = false;

  const visitCoord = (pt: Position) => {
    const lon = pt[0];
    const lat = pt[1];
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    found = true;
  };

  const geom = feature.geometry;
  if (geom) {
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        for (const pt of ring) visitCoord(pt);
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) {
          for (const pt of ring) visitCoord(pt);
        }
      }
    }
  }

  if (!found) {
    return [
      [-180, -90],
      [180, 90],
    ];
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export interface IndexedFeature {
  id: string;
  feature: Feature<Geometry>;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  normName: string;
  normAdmin: string;
}

const COUNTRY_NAME_ALIASES: Record<string, string[]> = {
  usa: ['united states of america', 'united states', 'us', 'usa'],
  uk: ['united kingdom', 'great britain', 'uk'],
  uae: ['united arab emirates', 'uae'],
  czechia: ['czechia', 'czech republic'],
  'south korea': ['south korea', 'korea, republic of', 'republic of korea', 'korea'],
  'china (sar)': ['hong kong', 'china'],
  china: ['china'],
  sweden: ['sweden'],
  denmark: ['denmark'],
  switzerland: ['switzerland'],
  austria: ['austria'],
  hungary: ['hungary'],
  germany: ['germany'],
  egypt: ['egypt'],
  singapore: ['singapore'],
  japan: ['japan'],
};

// Compass probe offsets (in degrees) to handle coastal/harbor cities on simplified 50m coastlines
const COASTAL_PROBE_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [0.08, 0],
  [-0.08, 0],
  [0, 0.08],
  [0, -0.08],
  [0.08, 0.08],
  [-0.08, 0.08],
  [0.08, -0.08],
  [-0.08, -0.08],
  [0.2, 0],
  [-0.2, 0],
  [0, 0.2],
  [0, -0.2],
];

/**
 * Pre-indexes a GeoJSON FeatureCollection with bounding boxes and normalized property names
 * for fast point-in-polygon and country/province matching.
 */
export function indexGeoJsonFeatures(
  collection: FeatureCollection<Geometry> | null
): IndexedFeature[] {
  if (!collection || !Array.isArray(collection.features)) return [];

  return collection.features.map((feature, idx) => {
    const id = String(feature.id ?? feature.properties?.adm1_code ?? feature.properties?.name ?? idx);
    const bounds = computeFastFeatureBounds(feature);
    const props = feature.properties ?? {};
    const rawName = String(props.name ?? props.name_en ?? props.ADMIN ?? '').trim().toLowerCase();
    const rawAdmin = String(
      props.admin ?? props.adm0_name ?? props.gu_a3 ?? props.iso_a2 ?? ''
    )
      .trim()
      .toLowerCase();

    return {
      id,
      feature,
      minLon: bounds[0][0],
      minLat: bounds[0][1],
      maxLon: bounds[1][0],
      maxLat: bounds[1][1],
      normName: rawName,
      normAdmin: rawAdmin,
    };
  });
}

function isPointNearBounds(
  lon: number,
  lat: number,
  item: IndexedFeature,
  marginDeg: number = 0.35
): boolean {
  // Handle features that cross the antimeridian (minLon > maxLon)
  if (item.minLon > item.maxLon) {
    return lat >= item.minLat - marginDeg && lat <= item.maxLat + marginDeg;
  }
  return (
    lon >= item.minLon - marginDeg &&
    lon <= item.maxLon + marginDeg &&
    lat >= item.minLat - marginDeg &&
    lat <= item.maxLat + marginDeg
  );
}

/**
 * Maps each city ID to its containing country Feature ID(s) in the countries GeoJSON.
 * Uses both normalized country property matching and spherical d3.geoContains with coastal probing.
 */
export function mapCitiesToCountryFeatures(
  indexedCountries: IndexedFeature[],
  cities: Record<string, CityConfig>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (indexedCountries.length === 0) return result;

  for (const [cityId, city] of Object.entries(cities)) {
    const matchedIds = new Set<string>();
    const [lon, lat] = city.coordinates;
    const countryKey = (city.country || '').trim().toLowerCase();
    const candidateNames = COUNTRY_NAME_ALIASES[countryKey] ?? (countryKey ? [countryKey] : []);

    // 1. Property name match (instant & handles small islands / SARs cleanly)
    if (candidateNames.length > 0) {
      for (const item of indexedCountries) {
        if (item.normName && candidateNames.includes(item.normName)) {
          matchedIds.add(item.id);
        }
      }
    }

    // 2. Spatial point-in-polygon check (with coastal probe fallback)
    if (matchedIds.size === 0) {
      for (const [dLon, dLat] of COASTAL_PROBE_OFFSETS) {
        const probeLon = lon + dLon;
        const probeLat = lat + dLat;
        for (const item of indexedCountries) {
          if (!isPointNearBounds(probeLon, probeLat, item)) continue;
          if (geoContains(item.feature, [probeLon, probeLat])) {
            matchedIds.add(item.id);
            break;
          }
        }
        if (matchedIds.size > 0) break;
      }
    }

    result[cityId] = Array.from(matchedIds);
  }

  return result;
}

/**
 * Maps each city ID to its containing Admin-1 state/province Feature ID(s),
 * and identifies which countries are covered by the Admin-1 dataset.
 */
export function mapCitiesToAdmin1Features(
  indexedAdmin1: IndexedFeature[],
  cities: Record<string, CityConfig>
): {
  cityToAdmin1Ids: Record<string, string[]>;
  subdividedCountryNames: Set<string>;
} {
  const cityToAdmin1Ids: Record<string, string[]> = {};
  const subdividedCountryNames = new Set<string>();

  for (const item of indexedAdmin1) {
    if (item.normAdmin) {
      subdividedCountryNames.add(item.normAdmin);
    }
  }

  if (indexedAdmin1.length === 0) {
    return { cityToAdmin1Ids, subdividedCountryNames };
  }

  for (const [cityId, city] of Object.entries(cities)) {
    const [lon, lat] = city.coordinates;
    const matchedIds = new Set<string>();

    for (const [dLon, dLat] of COASTAL_PROBE_OFFSETS) {
      const probeLon = lon + dLon;
      const probeLat = lat + dLat;
      for (const item of indexedAdmin1) {
        if (!isPointNearBounds(probeLon, probeLat, item)) continue;
        if (geoContains(item.feature, [probeLon, probeLat])) {
          matchedIds.add(item.id);
          if (item.normAdmin) {
            subdividedCountryNames.add(item.normAdmin);
          }
          break;
        }
      }
      if (matchedIds.size > 0) break;
    }

    cityToAdmin1Ids[cityId] = Array.from(matchedIds);
  }

  return { cityToAdmin1Ids, subdividedCountryNames };
}
