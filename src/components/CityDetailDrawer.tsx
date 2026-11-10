import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BedDouble,
  Calendar,
  Crosshair,
  Flag,
  MapPin,
  Route,
  Search,
  X,
} from 'lucide-react';
import {
  CityComputedStats,
  CityConfig,
  ItineraryLegConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../config/types';

interface CityDetailDrawerProps {
  isOpen: boolean;
  selectedCityId: string | null;
  selectedLegId: number | null;
  homeCityId?: string;
  cities: Record<string, CityConfig>;
  cityStats: Record<string, CityComputedStats>;
  itinerary: ItineraryLegConfig[];
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  onClose: () => void;
  onSelectCity: (cityId: string, flyTo?: boolean) => void;
  onSelectLeg: (leg: ItineraryLegConfig, jumpToTimeline?: boolean) => void;
  onFocusCityCamera: (cityId: string) => void;
}

export const CityDetailDrawer: React.FC<CityDetailDrawerProps> = ({
  isOpen,
  selectedCityId,
  selectedLegId,
  homeCityId = 'NYC',
  cities,
  cityStats,
  itinerary,
  transitModes,
  onClose,
  onSelectCity,
  onSelectLeg,
  onFocusCityCamera,
}) => {
  const [directoryTab, setDirectoryTab] = useState<'cities' | 'legs'>('cities');
  const [searchQuery, setSearchQuery] = useState('');

  const activeStats = selectedCityId ? cityStats[selectedCityId] : null;
  const activeLeg = useMemo(
    () => (selectedLegId !== null ? itinerary.find((l) => l.id === selectedLegId) ?? null : null),
    [itinerary, selectedLegId]
  );

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return Object.values(cityStats).filter((item) => {
      if (!q) return true;
      return (
        item.city.name.toLowerCase().includes(q) ||
        item.city.country.toLowerCase().includes(q) ||
        item.city.id.toLowerCase().includes(q)
      );
    });
  }, [cityStats, searchQuery]);

  const filteredLegs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return itinerary.filter((leg) => {
      if (!q) return true;
      const srcName = cities[leg.source]?.name.toLowerCase() ?? '';
      const dstName = cities[leg.dest]?.name.toLowerCase() ?? '';
      return (
        srcName.includes(q) ||
        dstName.includes(q) ||
        leg.source.toLowerCase().includes(q) ||
        leg.dest.toLowerCase().includes(q) ||
        leg.transport.toLowerCase().includes(q) ||
        String(leg.id).includes(q)
      );
    });
  }, [cities, itinerary, searchQuery]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="City and Transit Detail Drawer"
      className="fixed z-30 inset-x-0 bottom-0 max-h-[68vh] sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-96 flex flex-col rounded-t-2xl sm:rounded-none sm:rounded-l-2xl border-t sm:border-t-0 sm:border-l border-slate-800 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-xl transition-transform"
    >
      {/* Mobile Drag Handle */}
      <div className="flex justify-center pt-2 sm:hidden">
        <div className="h-1.5 w-12 rounded-full bg-slate-700" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/90 px-4 py-3.5">
        {activeStats ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  activeStats.city.id === homeCityId
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-sky-500/20 text-sky-400'
                }`}
              >
                {activeStats.city.id === homeCityId ? (
                  <Flag className="h-3.5 w-3.5" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
              </span>
              <h2 className="truncate text-base font-bold text-white">
                {activeStats.city.name}
              </h2>
              {activeStats.city.id === homeCityId && (
                <span className="shrink-0 rounded-md bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Home Base
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-2">
              <span>{activeStats.city.country}</span>
              <span>·</span>
              <span className="font-mono text-[11px] text-slate-500">
                [{activeStats.city.coordinates[0].toFixed(2)}°,{' '}
                {activeStats.city.coordinates[1].toFixed(2)}°]
              </span>
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-bold text-white">Journey Explorer</h2>
            <p className="text-xs text-slate-400">
              {Object.keys(cities).length} cities · {itinerary.length} transit legs
            </p>
          </div>
        )}

        <div className="flex items-center gap-1">
          {activeStats && (
            <>
              <button
                type="button"
                onClick={() => onFocusCityCamera(activeStats.city.id)}
                title="Center & Zoom Camera on City"
                className="rounded-lg border border-slate-700/80 bg-slate-800/80 p-1.5 text-sky-400 hover:bg-slate-700 hover:text-sky-300 transition"
              >
                <Crosshair className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onSelectCity('', false)}
                title="Back to All Cities & Legs"
                className="rounded-lg border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
              >
                All
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close Drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Selected Leg Highlight Banner (if a transit line was clicked) */}
      {activeLeg && (
        <div className="border-b border-slate-800/90 bg-sky-950/30 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-sky-400">
              Selected Transit Line · Leg #{activeLeg.id}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <div className="font-semibold text-white">
              <button
                type="button"
                onClick={() => onSelectCity(activeLeg.source, true)}
                className="hover:text-sky-300 underline decoration-slate-600"
              >
                {cities[activeLeg.source]?.name ?? activeLeg.source}
              </button>{' '}
              →{' '}
              <button
                type="button"
                onClick={() => onSelectCity(activeLeg.dest, true)}
                className="hover:text-sky-300 underline decoration-sky-500/60"
              >
                {cities[activeLeg.dest]?.name ?? activeLeg.dest}
              </button>
            </div>
            <span className="font-mono text-[11px] text-amber-300">
              {activeLeg.nights} {activeLeg.nights === 1 ? 'night' : 'nights'}
            </span>
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeStats ? (
          <>
            {/* Key Stay Metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <BedDouble className="h-3.5 w-3.5 text-sky-400" />
                  <span>Total Nights Stayed</span>
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-white">
                  {activeStats.totalNights}
                </div>
                <div className="text-[11px] text-slate-500">
                  Across {activeStats.arrivals.length}{' '}
                  {activeStats.arrivals.length === 1 ? 'stay' : 'stays'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Route className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Transit Connections</span>
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-white">
                  {activeStats.arrivals.length + activeStats.departures.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activeStats.arrivals.length} in · {activeStats.departures.length} out
                </div>
              </div>
            </div>

            {/* Arrival Legs Section */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                <span>Arrival Legs ({activeStats.arrivals.length})</span>
              </h3>

              {activeStats.arrivals.length === 0 ? (
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-500">
                  Initial origin city for this itinerary preset.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeStats.arrivals.map((leg) => {
                    const style = transitModes[leg.transport];
                    const fromCity = cities[leg.source];
                    return (
                      <div
                        key={leg.id}
                        onClick={() => onSelectLeg(leg, false)}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          selectedLegId === leg.id
                            ? 'border-sky-500/70 bg-sky-950/30'
                            : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-slate-400">
                            Leg #{leg.id}
                          </span>
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${style.color}20`,
                              color: style.color,
                              border: `1px solid ${style.color}40`,
                            }}
                          >
                            {leg.transport}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-white">
                            From{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCity(leg.source, true);
                              }}
                              className="text-sky-400 hover:underline"
                            >
                              {fromCity?.name ?? leg.source}
                            </button>
                          </div>
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
                            {leg.nights === 0
                              ? '0 nights (intraday)'
                              : `+${leg.nights} ${leg.nights === 1 ? 'night' : 'nights'}`}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            {leg.startDate} → {leg.endDate}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLeg(leg, true);
                            }}
                            className="text-sky-400 hover:text-sky-300 font-sans text-[11px]"
                          >
                            Playback →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Departure Legs Section */}
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-sky-400" />
                <span>Departure Legs ({activeStats.departures.length})</span>
              </h3>

              {activeStats.departures.length === 0 ? (
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-500">
                  Final destination city for this itinerary preset.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeStats.departures.map((leg) => {
                    const style = transitModes[leg.transport];
                    const toCity = cities[leg.dest];
                    return (
                      <div
                        key={leg.id}
                        onClick={() => onSelectLeg(leg, false)}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          selectedLegId === leg.id
                            ? 'border-sky-500/70 bg-sky-950/30'
                            : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-slate-400">
                            Leg #{leg.id}
                          </span>
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${style.color}20`,
                              color: style.color,
                              border: `1px solid ${style.color}40`,
                            }}
                          >
                            {leg.transport}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-white">
                            To{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCity(leg.dest, true);
                              }}
                              className="text-sky-400 hover:underline"
                            >
                              {toCity?.name ?? leg.dest}
                            </button>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            ({leg.nights === 0 ? 'intraday' : `${leg.nights}n`} at dest)
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            Departs {leg.startDate}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLeg(leg, true);
                            }}
                            className="text-sky-400 hover:text-sky-300 font-sans text-[11px]"
                          >
                            Playback →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Directory View when browsing all Cities & Legs */
          <div className="space-y-3">
            {/* Search & Tab Switcher */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter cities, countries, or legs…"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDirectoryTab('cities')}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    directoryTab === 'cities'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cities ({filteredCities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryTab('legs')}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    directoryTab === 'legs'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Legs ({filteredLegs.length})
                </button>
              </div>
            </div>

            {directoryTab === 'cities' ? (
              <div className="space-y-1.5">
                {filteredCities.map((item) => (
                  <button
                    key={item.city.id}
                    type="button"
                    onClick={() => onSelectCity(item.city.id, true)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-800/60 transition"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <span>{item.city.name}</span>
                        {item.city.id === homeCityId && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                            <Flag className="h-2.5 w-2.5" />
                            <span>Home Base</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.city.country}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-semibold text-sky-400">
                        {item.totalNights} {item.totalNights === 1 ? 'night' : 'nights'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.arrivals.length} in · {item.departures.length} out
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredLegs.map((leg) => {
                  const style = transitModes[leg.transport];
                  return (
                    <button
                      key={leg.id}
                      type="button"
                      onClick={() => onSelectLeg(leg, true)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-800/60 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">
                            #{leg.id}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {cities[leg.source]?.name ?? leg.source} →{' '}
                            {cities[leg.dest]?.name ?? leg.dest}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {leg.startDate} → {leg.endDate} ({leg.nights}n)
                        </div>
                      </div>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${style.color}20`,
                          color: style.color,
                        }}
                      >
                        {leg.transport}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
