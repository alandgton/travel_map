import { CityConfig } from '../config/types';

const LOCAL_STORAGE_CACHE_KEY = 'garden_leave_travel_map_city_geocache_v1';

interface GazetteerEntry {
  name: string;
  country: string;
  coordinates: [number, number];
  aliases?: string[];
}

/**
 * Built-in offline gazetteer for instant (0ms) resolution of the itinerary cities
 * and common global travel hubs. Any city not in this table is automatically resolved
 * via the Open-Meteo / Nominatim Geocoding APIs and cached in localStorage.
 */
const BUILTIN_GAZETTEER: Record<string, GazetteerEntry> = {
  NYC: {
    name: 'New York City',
    country: 'USA',
    coordinates: [-74.006, 40.7128],
    aliases: ['New York', 'New York City', 'New York, USA', 'JFK', 'EWR'],
  },
  SF: {
    name: 'San Francisco',
    country: 'USA',
    coordinates: [-122.4194, 37.7749],
    aliases: ['San Francisco', 'San Francisco, USA', 'SFO'],
  },
  LA: {
    name: 'Los Angeles',
    country: 'USA',
    coordinates: [-118.2437, 34.0522],
    aliases: ['Los Angeles', 'Los Angeles, USA', 'LAX'],
  },
  Stockholm: {
    name: 'Stockholm',
    country: 'Sweden',
    coordinates: [18.0686, 59.3293],
  },
  Copenhagen: {
    name: 'Copenhagen',
    country: 'Denmark',
    coordinates: [12.5683, 55.6761],
  },
  Zurich: {
    name: 'Zurich',
    country: 'Switzerland',
    coordinates: [8.5417, 47.3769],
    aliases: ['Zürich'],
  },
  Grindelwald: {
    name: 'Grindelwald',
    country: 'Switzerland',
    coordinates: [8.0414, 46.6242],
  },
  Vienna: {
    name: 'Vienna',
    country: 'Austria',
    coordinates: [16.3738, 48.2082],
    aliases: ['Wien'],
  },
  Budapest: {
    name: 'Budapest',
    country: 'Hungary',
    coordinates: [19.0402, 47.4979],
  },
  Prague: {
    name: 'Prague',
    country: 'Czechia',
    coordinates: [14.4378, 50.0755],
    aliases: ['Praha'],
  },
  Berlin: {
    name: 'Berlin',
    country: 'Germany',
    coordinates: [13.405, 52.52],
  },
  Leipzig: {
    name: 'Leipzig',
    country: 'Germany',
    coordinates: [12.3731, 51.3397],
  },
  Nuremberg: {
    name: 'Nuremberg',
    country: 'Germany',
    coordinates: [11.0767, 49.4521],
    aliases: ['Nürnberg'],
  },
  Munich: {
    name: 'Munich',
    country: 'Germany',
    coordinates: [11.582, 48.1351],
    aliases: ['München'],
  },
  Cairo: {
    name: 'Cairo',
    country: 'Egypt',
    coordinates: [31.2357, 30.0444],
  },
  Luxor: {
    name: 'Luxor',
    country: 'Egypt',
    coordinates: [32.6396, 25.6872],
  },
  Dubai: {
    name: 'Dubai',
    country: 'UAE',
    coordinates: [55.2708, 25.2048],
  },
  Singapore: {
    name: 'Singapore',
    country: 'Singapore',
    coordinates: [103.8198, 1.3521],
    aliases: ['SIN'],
  },
  Chengdu: {
    name: 'Chengdu',
    country: 'China',
    coordinates: [104.0668, 30.5728],
  },
  Jiuzhaigou: {
    name: 'Jiuzhaigou',
    country: 'China',
    coordinates: [103.9186, 33.26],
  },
  'Emeishan': {
    name: 'Emeishan',
    country: 'China',
    coordinates: [103.4844, 29.6012],
    aliases: ['Emeishan', 'Mt Emei', 'Mt. Emei'],
  },
  Chongqing: {
    name: 'Chongqing',
    country: 'China',
    coordinates: [106.5516, 29.563],
  },
  Wulong: {
    name: 'Wulong',
    country: 'China',
    coordinates: [107.76, 29.325],
  },
  Zhangjiajie: {
    name: 'Zhangjiajie',
    country: 'China',
    coordinates: [110.4792, 29.1171],
  },
  Fenghuang: {
    name: 'Fenghuang',
    country: 'China',
    coordinates: [109.599, 27.948],
  },
  Changsha: {
    name: 'Changsha',
    country: 'China',
    coordinates: [112.9388, 28.2282],
  },
  Hangzhou: {
    name: 'Hangzhou',
    country: 'China',
    coordinates: [120.1551, 30.2741],
  },
  Sanya: {
    name: 'Sanya',
    country: 'China',
    coordinates: [109.5119, 18.2528],
  },
  Haikou: {
    name: 'Haikou',
    country: 'China',
    coordinates: [110.1983, 20.044],
  },
  Guangzhou: {
    name: 'Guangzhou',
    country: 'China',
    coordinates: [113.2644, 23.1291],
  },
  HK: {
    name: 'Hong Kong',
    country: 'China (SAR)',
    coordinates: [114.1694, 22.3193],
    aliases: ['Hong Kong', 'HKG'],
  },
  Chaozhou: {
    name: 'Chaozhou',
    country: 'China',
    coordinates: [116.682, 23.5],
    aliases: ['Shantou', 'Shantou / Chaozhou'],
  },
  Shanghai: {
    name: 'Shanghai',
    country: 'China',
    coordinates: [121.4737, 31.2304],
  },
  Seoul: {
    name: 'Seoul',
    country: 'South Korea',
    coordinates: [126.978, 37.5665],
  },
  Busan: {
    name: 'Busan',
    country: 'South Korea',
    coordinates: [129.0756, 35.1796],
  },
  Fukuoka: {
    name: 'Fukuoka',
    country: 'Japan',
    coordinates: [130.4017, 33.5902],
  },
  Hiroshima: {
    name: 'Hiroshima',
    country: 'Japan',
    coordinates: [132.4553, 34.3853],
  },
  Kyoto: {
    name: 'Kyoto',
    country: 'Japan',
    coordinates: [135.7681, 35.0116],
  },
  Onomichi: {
    name: 'Onomichi',
    country: 'Japan',
    coordinates: [133.205, 34.409],
  },
  Setoda: {
    name: 'Setoda (Ikuchijima)',
    country: 'Japan',
    coordinates: [133.085, 34.305],
    aliases: ['Setoda (Ikuchijima)', 'Ikuchijima'],
  },
  Omishima: {
    name: 'Omishima',
    country: 'Japan',
    coordinates: [133.003, 34.248],
  },
  Imabari: {
    name: 'Imabari',
    country: 'Japan',
    coordinates: [132.9978, 34.0661],
  },
  Matsuyama: {
    name: 'Matsuyama',
    country: 'Japan',
    coordinates: [132.7656, 33.8392],
  },
  Tokyo: {
    name: 'Tokyo',
    country: 'Japan',
    coordinates: [139.6503, 35.6762],
  },
  Niseko: {
    name: 'Niseko',
    country: 'Japan',
    coordinates: [140.6874, 42.8048],
  },
  Sapporo: {
    name: 'Sapporo',
    country: 'Japan',
    coordinates: [141.3545, 43.0618],
  },
  // Additional common global hubs for instant offline preset testing
  London: { name: 'London', country: 'UK', coordinates: [-0.1276, 51.5072] },
  Paris: { name: 'Paris', country: 'France', coordinates: [2.3522, 48.8566] },
  Rome: { name: 'Rome', country: 'Italy', coordinates: [12.4964, 41.9028] },
  Madrid: { name: 'Madrid', country: 'Spain', coordinates: [-3.7038, 40.4168] },
  Barcelona: { name: 'Barcelona', country: 'Spain', coordinates: [2.1686, 41.3874] },
  Amsterdam: { name: 'Amsterdam', country: 'Netherlands', coordinates: [4.9041, 52.3676] },
  Geneva: { name: 'Geneva', country: 'Switzerland', coordinates: [6.1432, 46.2044] },
  Istanbul: { name: 'Istanbul', country: 'Turkey', coordinates: [28.9784, 41.0082] },
  Bangkok: { name: 'Bangkok', country: 'Thailand', coordinates: [100.5018, 13.7563] },
  Taipei: { name: 'Taipei', country: 'Taiwan', coordinates: [121.5654, 25.033] },
  Osaka: { name: 'Osaka', country: 'Japan', coordinates: [135.5023, 34.6937] },
  Beijing: { name: 'Beijing', country: 'China', coordinates: [116.4074, 39.9042] },
  Shenzhen: { name: 'Shenzhen', country: 'China', coordinates: [114.0579, 22.5431] },
  Sydney: { name: 'Sydney', country: 'Australia', coordinates: [151.2093, -33.8688] },
  Melbourne: { name: 'Melbourne', country: 'Australia', coordinates: [144.9631, -37.8136] },
  Toronto: { name: 'Toronto', country: 'Canada', coordinates: [-79.3832, 43.6532] },
  Vancouver: { name: 'Vancouver', country: 'Canada', coordinates: [-123.1207, 49.2827] },
  Chicago: { name: 'Chicago', country: 'USA', coordinates: [-87.6298, 41.8781] },
  Seattle: { name: 'Seattle', country: 'USA', coordinates: [-122.3321, 47.6062] },
  Boston: { name: 'Boston', country: 'USA', coordinates: [-71.0589, 42.3601] },
  Miami: { name: 'Miami', country: 'USA', coordinates: [-80.1918, 25.7617] },
};

// Build case-insensitive lookup index
const NORMALIZED_GAZETTEER_INDEX = new Map<string, GazetteerEntry>();
for (const [key, entry] of Object.entries(BUILTIN_GAZETTEER)) {
  NORMALIZED_GAZETTEER_INDEX.set(key.trim().toLowerCase(), entry);
  NORMALIZED_GAZETTEER_INDEX.set(entry.name.trim().toLowerCase(), entry);
  NORMALIZED_GAZETTEER_INDEX.set(`${entry.name}, ${entry.country}`.toLowerCase(), entry);
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      NORMALIZED_GAZETTEER_INDEX.set(alias.trim().toLowerCase(), entry);
    }
  }
}

const memoryGeoCache = new Map<string, CityConfig>();

function loadLocalStorageCache(): Record<string, CityConfig> {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CityConfig>;
  } catch {
    return {};
  }
}

function saveToLocalStorageCache(cityId: string, config: CityConfig): void {
  try {
    const current = loadLocalStorageCache();
    current[cityId.trim().toLowerCase()] = config;
    window.localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

/**
 * Synchronously resolves a city identifier if it exists in the built-in gazetteer
 * or in the localStorage / memory geocoding cache.
 */
export function resolveCitySync(cityId: string): CityConfig | null {
  const trimmed = cityId.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();

  if (memoryGeoCache.has(key)) {
    const cached = memoryGeoCache.get(key)!;
    return { ...cached, id: cityId };
  }

  const builtIn = NORMALIZED_GAZETTEER_INDEX.get(key);
  if (builtIn) {
    const resolved: CityConfig = {
      id: cityId,
      name: builtIn.name,
      country: builtIn.country,
      fullName:
        builtIn.name === builtIn.country
          ? builtIn.name
          : `${builtIn.name}, ${builtIn.country}`,
      coordinates: builtIn.coordinates,
    };
    memoryGeoCache.set(key, resolved);
    return resolved;
  }

  const stored = loadLocalStorageCache()[key];
  if (stored && Array.isArray(stored.coordinates) && stored.coordinates.length === 2) {
    const resolved: CityConfig = { ...stored, id: cityId };
    memoryGeoCache.set(key, resolved);
    return resolved;
  }

  return null;
}

/**
 * Asynchronously geocodes an unknown city name using the free Open-Meteo Geocoding API
 * (with fallback to OpenStreetMap Nominatim) and caches the result in localStorage.
 */
export async function geocodeCityAsync(cityId: string): Promise<CityConfig | null> {
  const syncHit = resolveCitySync(cityId);
  if (syncHit) return syncHit;

  const trimmed = cityId.trim();
  const key = trimmed.toLowerCase();
  const queryName = trimmed.split(',')[0].trim();

  // 1. Primary: Open-Meteo Geocoding API (fast, CORS-enabled, no API key required)
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      queryName
    )}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const first = data?.results?.[0];
      if (first && typeof first.longitude === 'number' && typeof first.latitude === 'number') {
        const name = String(first.name || queryName);
        const country = String(first.country || first.country_code || '');
        const resolved: CityConfig = {
          id: cityId,
          name,
          country,
          fullName: country && name !== country ? `${name}, ${country}` : name,
          coordinates: [Number(first.longitude), Number(first.latitude)],
        };
        memoryGeoCache.set(key, resolved);
        saveToLocalStorageCache(cityId, resolved);
        return resolved;
      }
    }
  } catch {
    // Proceed to fallback geocoder
  }

  // 2. Fallback: OpenStreetMap Nominatim API
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const results = await res.json();
      const first = results?.[0];
      if (first && first.lon && first.lat) {
        const displayParts = String(first.display_name || trimmed).split(',');
        const name = displayParts[0]?.trim() || trimmed;
        const country = displayParts[displayParts.length - 1]?.trim() || '';
        const resolved: CityConfig = {
          id: cityId,
          name,
          country,
          fullName: country && name !== country ? `${name}, ${country}` : name,
          coordinates: [ parseFloat(first.lon), parseFloat(first.lat) ],
        };
        memoryGeoCache.set(key, resolved);
        saveToLocalStorageCache(cityId, resolved);
        return resolved;
      }
    }
  } catch {
    // Both geocoders failed
  }

  return null;
}
