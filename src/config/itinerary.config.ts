import { ItineraryLegConfig, ItineraryStopInput, TransitMode } from './types';

const MS_PER_DAY = 86_400_000;

/**
 * Computes the number of nights between two ISO YYYY-MM-DD dates using UTC midnight.
 * A value of 0 is valid and represents an intraday stop (startDate === endDate).
 */
export function calculateNightsBetween(startDate: string, endDate: string): number {
  const startMs = Date.parse(`${startDate.trim()}T00:00:00Z`);
  const endMs = Date.parse(`${endDate.trim()}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.max(0, Math.round((endMs - startMs) / MS_PER_DAY));
}

/**
 * Converts an ordered sequence of city stops into directed transit legs.
 * - `stops[0]` is the initial origin city.
 * - Each subsequent `stops[i]` (`i >= 1`) defines arrival/departure dates at `stops[i].city`
 *   and the `transport` mode used to travel from `stops[i - 1].city` to `stops[i].city`.
 */
export function resolveItineraryStops(stops: ItineraryStopInput[]): ItineraryLegConfig[] {
  const legs: ItineraryLegConfig[] = [];
  for (let i = 1; i < stops.length; i++) {
    const prevStop = stops[i - 1];
    const currStop = stops[i];
    const startDate = currStop.startDate ?? '';
    const endDate = currStop.endDate ?? startDate;
    const transport: TransitMode = currStop.transport ?? 'Flight';

    legs.push({
      id: i,
      startDate,
      endDate,
      nights: calculateNightsBetween(startDate, endDate),
      source: prevStop.city,
      dest: currStop.city,
      transport,
    });
  }
  return legs;
}

/**
 * Converts a resolved array of legs back into the ordered stops representation.
 */
export function legsToStopsInput(legs: ItineraryLegConfig[]): ItineraryStopInput[] {
  if (legs.length === 0) return [];
  const stops: ItineraryStopInput[] = [{ city: legs[0].source }];
  for (const leg of legs) {
    stops.push({
      startDate: leg.startDate,
      endDate: leg.endDate,
      city: leg.dest,
      transport: leg.transport,
    });
  }
  return stops;
}

export const ITINERARY_STOPS: ItineraryStopInput[] = [
  { city: 'NYC' },
  { startDate: '2026-08-20', endDate: '2026-08-24', city: 'SF', transport: 'Flight' },
  { startDate: '2026-08-24', endDate: '2026-08-26', city: 'NYC', transport: 'Flight' },
  { startDate: '2026-08-26', endDate: '2026-08-30', city: 'Stockholm', transport: 'Flight' },
  { startDate: '2026-08-30', endDate: '2026-09-02', city: 'Copenhagen', transport: 'Train' },
  { startDate: '2026-09-02', endDate: '2026-09-04', city: 'Zurich', transport: 'Flight' },
  { startDate: '2026-09-04', endDate: '2026-09-09', city: 'Grindelwald', transport: 'Train' },
  { startDate: '2026-09-09', endDate: '2026-09-13', city: 'Vienna', transport: 'Flight' },
  { startDate: '2026-09-13', endDate: '2026-09-17', city: 'Budapest', transport: 'Train' },
  { startDate: '2026-09-17', endDate: '2026-09-21', city: 'Prague', transport: 'Flight' },
  { startDate: '2026-09-21', endDate: '2026-09-25', city: 'Berlin', transport: 'Train' },
  { startDate: '2026-09-25', endDate: '2026-09-27', city: 'Leipzig', transport: 'Train' },
  { startDate: '2026-09-27', endDate: '2026-09-30', city: 'Nuremberg', transport: 'Train' },
  { startDate: '2026-09-30', endDate: '2026-10-04', city: 'Munich', transport: 'Train' },
  { startDate: '2026-10-04', endDate: '2026-10-08', city: 'Cairo', transport: 'Flight' },
  { startDate: '2026-10-08', endDate: '2026-10-10', city: 'Luxor', transport: 'Flight' },
  { startDate: '2026-10-10', endDate: '2026-10-10', city: 'Cairo', transport: 'Flight' },
  { startDate: '2026-10-10', endDate: '2026-10-12', city: 'Dubai', transport: 'Flight' },
  { startDate: '2026-10-12', endDate: '2026-10-15', city: 'Singapore', transport: 'Flight' },
  { startDate: '2026-10-15', endDate: '2026-10-18', city: 'Chengdu', transport: 'Flight' },
  { startDate: '2026-10-18', endDate: '2026-10-20', city: 'Jiuzhaigou', transport: 'Drive' },
  { startDate: '2026-10-20', endDate: '2026-10-22', city: 'Emeishan', transport: 'Drive' },
  { startDate: '2026-10-22', endDate: '2026-10-23', city: 'Chengdu', transport: 'Drive' },
  { startDate: '2026-10-23', endDate: '2026-10-25', city: 'Chongqing', transport: 'Train' },
  { startDate: '2026-10-25', endDate: '2026-10-26', city: 'Wulong', transport: 'Drive' },
  { startDate: '2026-10-26', endDate: '2026-10-29', city: 'Zhangjiajie', transport: 'Drive' },
  { startDate: '2026-10-29', endDate: '2026-10-30', city: 'Fenghuang', transport: 'Drive' },
  { startDate: '2026-10-30', endDate: '2026-10-31', city: 'Changsha', transport: 'Drive' },
  { startDate: '2026-10-31', endDate: '2026-11-02', city: 'Hangzhou', transport: 'Train' },
  { startDate: '2026-11-02', endDate: '2026-11-05', city: 'Sanya', transport: 'Flight' },
  { startDate: '2026-11-05', endDate: '2026-11-06', city: 'Haikou', transport: 'Train' },
  { startDate: '2026-11-06', endDate: '2026-11-09', city: 'Guangzhou', transport: 'Flight' },
  { startDate: '2026-11-09', endDate: '2026-11-12', city: 'HK', transport: 'Train' },
  { startDate: '2026-11-12', endDate: '2026-11-14', city: 'Chaozhou', transport: 'Train' },
  { startDate: '2026-11-14', endDate: '2026-11-17', city: 'Shanghai', transport: 'Flight' },
  { startDate: '2026-11-17', endDate: '2026-11-18', city: 'Nanjing', transport: 'Train' },
  { startDate: '2026-11-18', endDate: '2026-11-18', city: 'Shanghai', transport: 'Train' },
  { startDate: '2026-11-18', endDate: '2026-11-24', city: 'Seoul', transport: 'Flight' },
  { startDate: '2026-11-24', endDate: '2026-11-27', city: 'Busan', transport: 'Train' },
  { startDate: '2026-11-27', endDate: '2026-11-30', city: 'Fukuoka', transport: 'Flight' },
  { startDate: '2026-11-30', endDate: '2026-12-03', city: 'Hiroshima', transport: 'Train' },
  { startDate: '2026-12-03', endDate: '2026-12-07', city: 'Kyoto', transport: 'Train' },
  { startDate: '2026-12-07', endDate: '2026-12-08', city: 'Onomichi', transport: 'Train' },
  { startDate: '2026-12-08', endDate: '2026-12-09', city: 'Setoda', transport: 'Bike' },
  { startDate: '2026-12-09', endDate: '2026-12-10', city: 'Omishima', transport: 'Bike' },
  { startDate: '2026-12-10', endDate: '2026-12-10', city: 'Imabari', transport: 'Bike' },
  { startDate: '2026-12-10', endDate: '2026-12-13', city: 'Matsuyama', transport: 'Train' },
  { startDate: '2026-12-13', endDate: '2026-12-16', city: 'Tokyo', transport: 'Flight' },
  { startDate: '2026-12-16', endDate: '2026-12-16', city: 'Sapporo', transport: 'Flight' },
  { startDate: '2026-12-16', endDate: '2026-12-18', city: 'Niseko', transport: 'Drive' },
  { startDate: '2026-12-18', endDate: '2026-12-20', city: 'Sapporo', transport: 'Drive' },
  { startDate: '2026-12-20', endDate: '2026-12-27', city: 'Tokyo', transport: 'Flight' },
  { startDate: '2026-12-27', endDate: '2027-01-04', city: 'LA', transport: 'Flight' },
  { startDate: '2027-01-04', endDate: '2027-01-14', city: 'NYC', transport: 'Flight' },
];

export const ITINERARY: ItineraryLegConfig[] = resolveItineraryStops(ITINERARY_STOPS);
