# Garden Leave — Interactive 2D Travel Map (2026–2027)

An interactive, config-driven 2D vector travel map built with **React + TypeScript (Vite) + D3.js (`d3-geo`, `d3-zoom`) + Tailwind CSS + `lucide-react`**.

## Quick Start

```bash
npm install
npm run dev
```

To build for Cloudflare Pages (`dist/` static output):

```bash
npm run build
```

## Multi-Page Site Layout (alanton.at)

Vite builds several HTML entries (`rollupOptions.input` in `vite.config.ts`), each served from its own subpath on Cloudflare Pages:

| Entry HTML | React entry | URL |
|---|---|---|
| `index.html` | `src/sites/landing/main.tsx` | `/` |
| `home/index.html` | `src/sites/home/main.tsx` | `/home/` |
| `work/index.html` | `src/sites/work/main.tsx` | `/work/` |
| `gardenleave/index.html` | `src/main.tsx` (travel map) | `/gardenleave/` |

To add a new subpath site: create `<name>/index.html` and `src/sites/<name>/main.tsx`, register it in `vite.config.ts` (`rollupOptions.input`) and `tailwind.config.js` (`content`), and add a link to `SITE_LINKS` in `src/sites/landing/LandingPage.tsx`.

## Project Structure & Abstractions

- `src/config/types.ts` — Core TypeScript interfaces (`TravelMapConfig`, `CityConfig`, `ItineraryLegConfig`, `RegionCameraConfig`, `TransitModeStyleConfig`, `MapRenderConfig`).
- `src/config/regions.config.ts` — `REGIONS_CONFIG` camera presets (`world`, `us`, `europe`, `mena`, `china`, `east_asia`, `shimanami`).
- `src/config/itinerary.config.ts` — `ITINERARY_STOPS` ordered sequence of city stops (`[{ city: 'NYC' }, { startDate, endDate, city, transport }, ...]`); `resolveItineraryStops` automatically derives 1-based `id`, `source`, `dest`, and `nights` (`endDate - startDate`, supporting `0` for intraday stops).
- `src/config/transit.config.ts` — `TRANSIT_MODES_CONFIG` for the 4 distinct SVG patterns (`Flight`, `Train`, `Drive`, `Bike`) and zoom-invariant `stroke-dasharray` scaling.
- `src/config/map.config.ts` — `MAP_CONFIG` (`d3.geoNaturalEarth1().scale(225).translate([width / 2, height / 1.85]).rotate([-11, 0])`, `scaleExtent([1, 250])`, `countries-10m.json` high-res coastlines).
- `src/config/presets.config.ts` — `DEFAULT_TRAVEL_MAP_CONFIG` combining all configuration modules.
- `src/utils/cityGeocoder.ts` & `src/hooks/useResolvedCities.ts` — Automatic city coordinate resolution from itinerary `source` and `dest` names using a built-in gazetteer + Open-Meteo / Nominatim geocoding API fallback cached in `localStorage`.
- `src/utils/topojsonDecoder.ts` — Zero-dependency TopoJSON decoder (`decodeTopoJSON`) with spherical winding verification (`d3.geoArea`).
- `src/utils/regionHitTesting.ts` — Spatial point-in-polygon (`d3.geoContains` + coastal probing) and property matcher that highlights visited countries and Admin-1 states/provinces progressively.
- `src/utils/labelLayout.ts` — Priority-based collision culling and 8-direction repulsion label placement (`computeSmartLabelLayout`) so city names never overlap.
- `src/utils/arcMath.ts` — Directional straight line generator (`computeDirectionalTransitLine`) with perpendicular parallel offset for bidirectional pairs, Pacific antimeridian seam splitter (`Tokyo -> LA`), and arrowhead builder (`buildArrowheadPath`).
- `src/utils/itineraryStats.ts` — Per-city stay aggregation (`computeAllCityStats`) and trip summary calculator (`computeJourneySummary`).
- `src/hooks/useMapTopology.ts` — Fetches & caches adaptive LOD (`50m` below `6x` zoom, `10m` high-res at `>= 6x` zoom) country polygons and optional Admin-1 state/province boundaries.
- `src/hooks/useMapCamera.ts` — Manages `d3-zoom` physics (`1x–250x`), direct DOM `<g>` transforms for `60–120fps` mobile pan/zoom, responsive mobile label/pin scaling, and two-stage `invScale`.
- `src/components/` — Declarative SVG map (`TravelMapCanvas`), regional camera bar (`RegionSelectorBar`), transit legend (`TransitLegendBar`), opt-in journey playback (`JourneyPlayback`), and responsive city/leg detail drawer (`CityDetailDrawer`).
