import { useEffect, useState } from 'react';
import { geoArea } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { decodeTopoJSON, TopoJSONTopology } from '../utils/topojsonDecoder';

interface MapTopologyState {
  countriesGeoJson: FeatureCollection<Geometry> | null;
  admin1GeoJson: FeatureCollection<Geometry> | null;
  isLoadingCountries: boolean;
  isLoadingAdmin1: boolean;
  error: string | null;
}

const topologyCache = new Map<string, FeatureCollection<Geometry>>();

function normalizeGeoJsonWinding(
  collection: FeatureCollection<Geometry>
): FeatureCollection<Geometry> {
  const features: Feature<Geometry>[] = collection.features.map((feat) => {
    const geom = feat.geometry;
    if (!geom) return feat;
    try {
      if (geom.type === 'Polygon') {
        if (geoArea(geom) > 2 * Math.PI) {
          return {
            ...feat,
            geometry: {
              ...geom,
              coordinates: geom.coordinates.map((ring) => [...ring].reverse()),
            },
          };
        }
      } else if (geom.type === 'MultiPolygon') {
        const fixed = geom.coordinates.map((polyCoords) => {
          const singlePoly: Geometry = { type: 'Polygon', coordinates: polyCoords };
          if (geoArea(singlePoly) > 2 * Math.PI) {
            return polyCoords.map((ring) => [...ring].reverse());
          }
          return polyCoords;
        });
        return {
          ...feat,
          geometry: {
            ...geom,
            coordinates: fixed,
          },
        };
      }
    } catch {
      return feat;
    }
    return feat;
  });

  return {
    ...collection,
    features,
  };
}

export function useMapTopology(
  countriesTopoJsonUrl: string,
  admin1GeoJsonUrl: string,
  enableAdmin1: boolean,
  useHighResCountries: boolean = false
): MapTopologyState {
  const fallback50mUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

  const [countries50m, setCountries50m] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(fallback50mUrl) ?? null
  );
  const [countriesPrimary, setCountriesPrimary] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(countriesTopoJsonUrl) ?? null
  );
  const [admin1GeoJson, setAdmin1GeoJson] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(admin1GeoJsonUrl) ?? null
  );
  const [isLoadingCountries, setIsLoadingCountries] = useState<boolean>(
    !topologyCache.has(fallback50mUrl) && !topologyCache.has(countriesTopoJsonUrl)
  );
  const [isLoadingAdmin1, setIsLoadingAdmin1] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Always load lightweight 50m polygons immediately (< 80ms) for smooth 60fps mobile panning below 6x zoom
  useEffect(() => {
    let cancelled = false;
    if (topologyCache.has(fallback50mUrl)) {
      setCountries50m(topologyCache.get(fallback50mUrl)!);
      setIsLoadingCountries(false);
      return;
    }

    setIsLoadingCountries(true);
    fetch(fallback50mUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch 50m world topology (${res.status})`);
        return res.json();
      })
      .then((topo50m: TopoJSONTopology) => {
        if (cancelled) return;
        const decoded50m = decodeTopoJSON(topo50m, 'countries');
        topologyCache.set(fallback50mUrl, decoded50m);
        setCountries50m(decoded50m);
        setIsLoadingCountries(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (!topologyCache.has(countriesTopoJsonUrl)) {
          setError(err instanceof Error ? err.message : 'Failed to load world map topology');
        }
        setIsLoadingCountries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countriesTopoJsonUrl]);

  // 2. Load high-resolution 10m polygons when zoomed in (>= 6x) or if primary URL is different
  useEffect(() => {
    if (!useHighResCountries && countriesTopoJsonUrl.includes('countries-10m.json')) {
      return;
    }

    let cancelled = false;
    if (topologyCache.has(countriesTopoJsonUrl)) {
      setCountriesPrimary(topologyCache.get(countriesTopoJsonUrl)!);
      setIsLoadingCountries(false);
      return;
    }

    fetch(countriesTopoJsonUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch high-res world topology (${res.status})`);
        }
        return res.json();
      })
      .then((topology: TopoJSONTopology) => {
        if (cancelled) return;
        const decoded = decodeTopoJSON(topology, 'countries');
        topologyCache.set(countriesTopoJsonUrl, decoded);
        setCountriesPrimary(decoded);
        setIsLoadingCountries(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingCountries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countriesTopoJsonUrl, useHighResCountries]);

  useEffect(() => {
    if (!enableAdmin1) return;

    let cancelled = false;
    if (topologyCache.has(admin1GeoJsonUrl)) {
      setAdmin1GeoJson(topologyCache.get(admin1GeoJsonUrl)!);
      setIsLoadingAdmin1(false);
      return;
    }

    setIsLoadingAdmin1(true);
    fetch(admin1GeoJsonUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch Admin-1 boundaries (${res.status})`);
        }
        return res.json();
      })
      .then((geojson: FeatureCollection<Geometry>) => {
        if (cancelled) return;
        const normalized = normalizeGeoJsonWinding(geojson);
        topologyCache.set(admin1GeoJsonUrl, normalized);
        setAdmin1GeoJson(normalized);
        setIsLoadingAdmin1(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingAdmin1(false);
      });

    return () => {
      cancelled = true;
    };
  }, [admin1GeoJsonUrl, enableAdmin1]);

  const countriesGeoJson =
    useHighResCountries && countriesPrimary ? countriesPrimary : (countries50m ?? countriesPrimary);

  return {
    countriesGeoJson,
    admin1GeoJson,
    isLoadingCountries,
    isLoadingAdmin1,
    error,
  };
}
