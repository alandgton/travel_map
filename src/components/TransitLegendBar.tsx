import React from 'react';
import { TransitMode, TransitModeStyleConfig } from '../config/types';

interface TransitLegendBarProps {
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  visibleModes: Record<TransitMode, boolean>;
  legsByMode: Record<TransitMode, number>;
  onToggleMode: (mode: TransitMode) => void;
}

export const TransitLegendBar: React.FC<TransitLegendBarProps> = ({
  transitModes,
  visibleModes,
  legsByMode,
  onToggleMode,
}) => {
  const modes = Object.values(transitModes);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3 py-1.5 shadow-lg backdrop-blur-md">
      <span className="text-[11px] font-medium text-slate-400 mr-1 hidden sm:inline">
        Transit Modes:
      </span>
      {modes.map((style) => {
        const isVisible = visibleModes[style.mode];
        const count = legsByMode[style.mode] ?? 0;

        return (
          <button
            key={style.mode}
            type="button"
            onClick={() => onToggleMode(style.mode)}
            title={`${style.description} — Click to toggle visibility`}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition ${
              isVisible
                ? 'border-slate-700/90 bg-slate-800/70 text-slate-100 hover:bg-slate-800'
                : 'border-slate-800/50 bg-slate-900/40 text-slate-500 opacity-55 hover:opacity-80'
            }`}
          >
            {/* SVG Pattern Preview matching Section 3 spec */}
            <svg width="26" height="10" viewBox="0 0 26 10" className="shrink-0">
              <line
                x1="1"
                y1="5"
                x2="21"
                y2="5"
                stroke={style.color}
                strokeWidth="2.2"
                strokeDasharray={
                  style.strokeDasharray === 'none' ? undefined : style.strokeDasharray
                }
                strokeLinecap="round"
              />
              <polygon points="25,5 19,2 20.5,5 19,8" fill={style.color} />
            </svg>
            <span className="font-medium">{style.label}</span>
            <span className="rounded bg-slate-950/70 px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
