import type { GeoProjection } from 'd3-geo';

export interface StraightLineSegment {
  /** SVG path 'M x1 y1 L x2 y2' */
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Segment length in SVG units */
  length: number;
  /** Exposed gap length between source and destination pin edges */
  exposedLength: number;
  /** Directional arrow position & angle (degrees) along the straight line */
  arrowX: number;
  arrowY: number;
  arrowAngleDeg: number;
}

export interface ComputedTransitLine {
  /** Combined SVG path string for all straight segments */
  pathData: string;
  /** Individual straight line segments (1 for standard, 2 for Pacific wrap) */
  segments: StraightLineSegment[];
  /** Whether the leg wraps across the Pacific seam */
  isPacificSplit: boolean;
  /** Primary label/badge anchor point */
  midpoint: [number, number];
}

function buildStraightSegment(
  rawX1: number,
  rawY1: number,
  rawX2: number,
  rawY2: number,
  parallelOffsetPx: number = 0,
  sourceTrimRadius: number = 0,
  destTrimRadius: number = 0
): StraightLineSegment {
  const rawDx = rawX2 - rawX1;
  const rawDy = rawY2 - rawY1;
  const length = Math.hypot(rawDx, rawDy) || 1;

  // Unit normal perpendicular to source -> dest vector: (-rawDy / length, rawDx / length).
  // Reversing source and dest flips the sign of (rawDx, rawDy), shifting return legs
  // to the opposite side so bidirectional straight lines sit parallel side-by-side.
  const nx = -rawDy / length;
  const ny = rawDx / length;

  const ox = nx * parallelOffsetPx;
  const oy = ny * parallelOffsetPx;

  const x1 = rawX1 + ox;
  const y1 = rawY1 + oy;
  const x2 = rawX2 + ox;
  const y2 = rawY2 + oy;

  const d = `M ${x1.toFixed(3)} ${y1.toFixed(3)} L ${x2.toFixed(3)} ${y2.toFixed(3)}`;

  // Compute the exposed gap between the outer edges of the source and destination pins
  // so the directional arrowhead is centered symmetrically in the visible space between pins.
  const dStart = Math.min(length * 0.48, sourceTrimRadius);
  const dEnd = Math.max(length * 0.52, length - destTrimRadius);
  const arrowT = (dStart + dEnd) / (2 * length);

  const exposedLength = Math.max(0.05, length - sourceTrimRadius - destTrimRadius);
  const arrowX = x1 + rawDx * arrowT;
  const arrowY = y1 + rawDy * arrowT;
  const arrowAngleDeg = (Math.atan2(rawDy, rawDx) * 180) / Math.PI;

  return {
    d,
    x1,
    y1,
    x2,
    y2,
    length,
    exposedLength,
    arrowX,
    arrowY,
    arrowAngleDeg,
  };
}

/**
 * Computes the directional straight line path for a transit leg,
 * applying a perpendicular parallel offset when the city pair is bidirectional
 * and splitting across the Pacific map seam when Math.abs(rawDx) > mapWidth * thresholdRatio.
 */
export function computeDirectionalTransitLine(
  sourceCoords: [number, number],
  destCoords: [number, number],
  projection: GeoProjection,
  mapWidth: number,
  parallelOffsetPx: number = 0,
  antimeridianThresholdRatio: number = 0.5,
  sourceTrimRadius: number = 0,
  destTrimRadius: number = 0
): ComputedTransitLine | null {
  const p1 = projection(sourceCoords);
  const p2 = projection(destCoords);
  if (!p1 || !p2) return null;

  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const rawDx = x2 - x1;

  // Check for Pacific Ocean / Antimeridian wrapping (e.g. Leg #49 Tokyo -> LA)
  if (Math.abs(rawDx) > mapWidth * antimeridianThresholdRatio) {
    const midLat = (sourceCoords[1] + destCoords[1]) / 2;
    const [rotLon] = projection.rotate();
    // With rotate([-11, 0]), the antimeridian cut is at lon = 180 - (-11) -> -169 deg
    const cutLon = (((-rotLon + 180 + 180) % 360) + 360) % 360 - 180;
    const rightSeamLon = cutLon - 0.08 < -180 ? cutLon - 0.08 + 360 : cutLon - 0.08;
    const leftSeamLon = cutLon + 0.08 > 180 ? cutLon + 0.08 - 360 : cutLon + 0.08;

    const rightSeamPt = projection([rightSeamLon, midLat]) ?? [mapWidth * 0.96, (y1 + y2) / 2];
    const leftSeamPt = projection([leftSeamLon, midLat]) ?? [mapWidth * 0.04, (y1 + y2) / 2];

    const goingEast = x1 > x2; // e.g., Tokyo (right side) -> LA (left side)
    const exitSeam = goingEast ? rightSeamPt : leftSeamPt;
    const entrySeam = goingEast ? leftSeamPt : rightSeamPt;

    // Proportional Y interpolation at the Pacific seam
    const d1 = Math.abs(exitSeam[0] - x1);
    const d2 = Math.abs(x2 - entrySeam[0]);
    const totalHoriz = d1 + d2 || 1;
    const seamY = y1 + (y2 - y1) * (d1 / totalHoriz);

    const seg1 = buildStraightSegment(
      x1,
      y1,
      exitSeam[0],
      seamY,
      parallelOffsetPx,
      sourceTrimRadius,
      0
    );
    const seg2 = buildStraightSegment(
      entrySeam[0],
      seamY,
      x2,
      y2,
      parallelOffsetPx,
      0,
      destTrimRadius
    );

    return {
      pathData: `${seg1.d} ${seg2.d}`,
      segments: [seg1, seg2],
      isPacificSplit: true,
      midpoint: [seg2.arrowX, seg2.arrowY],
    };
  }

  const seg = buildStraightSegment(
    x1,
    y1,
    x2,
    y2,
    parallelOffsetPx,
    sourceTrimRadius,
    destTrimRadius
  );
  return {
    pathData: seg.d,
    segments: [seg],
    isPacificSplit: false,
    midpoint: [seg.arrowX, seg.arrowY],
  };
}

/**
 * Generates an SVG polygon/path string for a crisp directional arrowhead centered at (x, y)
 * rotated by angleDeg and scaled by effectiveScale.
 */
export function buildArrowheadPath(effectiveScale: number, sizeMultiplier: number = 1): string {
  const len = 5.4 * effectiveScale * sizeMultiplier;
  const halfWidth = 3.1 * effectiveScale * sizeMultiplier;
  const backInset = 1.3 * effectiveScale * sizeMultiplier;
  // Arrow pointing along +X axis, symmetrically centered at (0, 0) from -len * 0.5 to +len * 0.5
  const tipX = len * 0.5;
  const tailX = -len * 0.5;
  const notchX = tailX + backInset;
  return `M ${tipX.toFixed(3)} 0 L ${tailX.toFixed(3)} ${(-halfWidth).toFixed(3)} L ${notchX.toFixed(3)} 0 L ${tailX.toFixed(3)} ${halfWidth.toFixed(3)} Z`;
}
