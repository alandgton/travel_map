import {
  CityComputedStats,
  CityConfig,
  ItineraryLegConfig,
  TransitMode,
} from '../config/types';

/**
 * Computes comprehensive arrival, departure, and stay statistics for every city in the configuration.
 */
export function computeAllCityStats(
  cities: Record<string, CityConfig>,
  itinerary: ItineraryLegConfig[]
): Record<string, CityComputedStats> {
  const statsMap: Record<string, CityComputedStats> = {};

  for (const [cityId, city] of Object.entries(cities)) {
    const arrivals = itinerary.filter((leg) => leg.dest === cityId);
    const departures = itinerary.filter((leg) => leg.source === cityId);
    const totalNights = arrivals.reduce((sum, leg) => sum + (leg.nights || 0), 0);

    const allDates = [
      ...arrivals.map((l) => l.startDate),
      ...departures.map((l) => l.startDate),
    ]
      .filter(Boolean)
      .sort();

    statsMap[cityId] = {
      city,
      totalNights,
      visitCount: Math.max(arrivals.length, departures.length > 0 ? 1 : 0),
      arrivals,
      departures,
      firstArrivalDate: allDates[0] ?? null,
      lastDepartureDate:
        departures.length > 0
          ? departures[departures.length - 1].startDate
          : arrivals.length > 0
            ? arrivals[arrivals.length - 1].endDate
            : null,
    };
  }

  return statsMap;
}

export interface JourneySummaryStats {
  totalCities: number;
  totalCountries: number;
  totalLegs: number;
  totalNights: number;
  legsByMode: Record<TransitMode, number>;
  startDate: string;
  endDate: string;
}

export function computeJourneySummary(
  cities: Record<string, CityConfig>,
  itinerary: ItineraryLegConfig[]
): JourneySummaryStats {
  const visitedCityIds = new Set<string>();
  const countries = new Set<string>();
  const legsByMode: Record<TransitMode, number> = {
    Flight: 0,
    Train: 0,
    Drive: 0,
    Bike: 0,
  };

  let totalNights = 0;

  for (const leg of itinerary) {
    visitedCityIds.add(leg.source);
    visitedCityIds.add(leg.dest);
    totalNights += leg.nights || 0;
    legsByMode[leg.transport] = (legsByMode[leg.transport] || 0) + 1;
  }

  for (const cityId of visitedCityIds) {
    const city = cities[cityId];
    if (city?.country) {
      countries.add(city.country);
    }
  }

  return {
    totalCities: visitedCityIds.size,
    totalCountries: countries.size,
    totalLegs: itinerary.length,
    totalNights,
    legsByMode,
    startDate: itinerary[0]?.startDate ?? '',
    endDate: itinerary[itinerary.length - 1]?.endDate ?? '',
  };
}
