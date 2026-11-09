import { ITINERARY } from './itinerary.config';
import { MAP_CONFIG } from './map.config';
import { REGIONS_CONFIG } from './regions.config';
import { TRANSIT_MODES_CONFIG } from './transit.config';
import { TravelMapConfig } from './types';

export const DEFAULT_TRAVEL_MAP_CONFIG: TravelMapConfig = {
  id: 'garden-leave-full',
  title: 'Garden Leave Odyssey',
  subtitle: 'August 2026 – January 2027 · 46 Cities · 50 Transit Legs',
  description:
    'Complete 5-month garden leave itinerary spanning North America, Europe, Egypt & the Gulf, Southwest & Coastal China, South Korea, and Japan.',
  regions: REGIONS_CONFIG,
  itinerary: ITINERARY,
  transitModes: TRANSIT_MODES_CONFIG,
  mapConfig: MAP_CONFIG,
};
