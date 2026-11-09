import { useEffect, useMemo, useState } from 'react';
import { CityConfig, ItineraryLegConfig } from '../config/types';
import { geocodeCityAsync, resolveCitySync } from '../utils/cityGeocoder';

export interface UseResolvedCitiesReturn {
  cities: Record<string, CityConfig>;
  isGeocoding: boolean;
  unresolvedCities: string[];
}

/**
 * Automatically extracts all unique source & destination city names from the itinerary
 * and resolves their [longitude, latitude] coordinates without requiring city coordinates
 * in the user configuration.
 */
export function useResolvedCities(itinerary: ItineraryLegConfig[]): UseResolvedCitiesReturn {
  const uniqueCityIds = useMemo(() => {
    const set = new Set<string>();
    for (const leg of itinerary) {
      if (leg.source) set.add(leg.source);
      if (leg.dest) set.add(leg.dest);
    }
    return Array.from(set);
  }, [itinerary]);

  // 1. Synchronous pass for built-in gazetteer and localStorage cache hits
  const syncResult = useMemo(() => {
    const resolved: Record<string, CityConfig> = {};
    const pending: string[] = [];

    for (const cityId of uniqueCityIds) {
      const hit = resolveCitySync(cityId);
      if (hit) {
        resolved[cityId] = hit;
      } else {
        pending.push(cityId);
      }
    }

    return { resolved, pending };
  }, [uniqueCityIds]);

  const [asyncResolved, setAsyncResolved] = useState<Record<string, CityConfig>>({});
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [failedCities, setFailedCities] = useState<string[]>([]);

  // 2. Asynchronous geocoding pass for any newly added city names not in the cache
  useEffect(() => {
    const toFetch = syncResult.pending.filter((id) => !asyncResolved[id]);
    if (toFetch.length === 0) {
      setIsGeocoding(false);
      return;
    }

    let cancelled = false;
    setIsGeocoding(true);
    setFailedCities([]);

    Promise.all(
      toFetch.map(async (cityId) => {
        const result = await geocodeCityAsync(cityId);
        return { cityId, result };
      })
    ).then((outcomes) => {
      if (cancelled) return;
      const newlyFound: Record<string, CityConfig> = {};
      const notFound: string[] = [];

      for (const { cityId, result } of outcomes) {
        if (result) {
          newlyFound[cityId] = result;
        } else {
          notFound.push(cityId);
        }
      }

      if (Object.keys(newlyFound).length > 0) {
        setAsyncResolved((prev) => ({ ...prev, ...newlyFound }));
      }
      setFailedCities(notFound);
      setIsGeocoding(false);
    });

    return () => {
      cancelled = true;
    };
  }, [asyncResolved, syncResult.pending]);

  const cities = useMemo(() => {
    const merged: Record<string, CityConfig> = { ...syncResult.resolved };
    for (const cityId of uniqueCityIds) {
      if (!merged[cityId] && asyncResolved[cityId]) {
        merged[cityId] = asyncResolved[cityId];
      }
    }
    return merged;
  }, [asyncResolved, syncResult.resolved, uniqueCityIds]);

  return {
    cities,
    isGeocoding,
    unresolvedCities: failedCities,
  };
}
