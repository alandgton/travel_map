import { TransitMode, TransitModeStyleConfig } from './types';

export const TRANSIT_MODES_CONFIG: Record<TransitMode, TransitModeStyleConfig> = {
  Flight: {
    mode: 'Flight',
    label: 'Flight',
    color: '#38bdf8', // sky blue
    strokeDasharray: 'none',
    baseStrokeWidth: 1.85,
    description: 'Commercial aviation (solid sky-blue line)',
  },
  Train: {
    mode: 'Train',
    label: 'Train',
    color: '#10b981', // emerald
    strokeDasharray: '6, 4',
    baseStrokeWidth: 2.0,
    description: 'High-speed & regional rail (dashed emerald line)',
  },
  Drive: {
    mode: 'Drive',
    label: 'Drive',
    color: '#f59e0b', // amber
    strokeDasharray: '2, 3.5',
    baseStrokeWidth: 1.95,
    description: 'Overland driving transit (dotted amber line)',
  },
  Bike: {
    mode: 'Bike',
    label: 'Bike',
    color: '#f43f5e', // rose
    strokeDasharray: '6, 2.5, 1.5, 2.5',
    baseStrokeWidth: 2.1,
    description: 'Shimanami Kaido island cycling (dash-dot rose line)',
  },
};

export function isValidTransitMode(mode: unknown): mode is TransitMode {
  return mode === 'Flight' || mode === 'Train' || mode === 'Drive' || mode === 'Bike';
}

/**
 * Scales an SVG stroke-dasharray string inversely with the D3 zoom factor
 * so dashed/dotted/dash-dot patterns remain crisp and proportional at high zoom.
 */
export function scaleStrokeDasharray(dashArray: string, invScale: number): string | undefined {
  if (!dashArray || dashArray === 'none') {
    return undefined;
  }
  return dashArray
    .split(',')
    .map((part) => {
      const num = parseFloat(part.trim());
      if (Number.isNaN(num)) return part.trim();
      return (num * invScale).toFixed(3);
    })
    .join(', ');
}
