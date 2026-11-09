export interface LabelInputNode {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  priority: number;
  forceShow?: boolean;
}

export interface LabelPlacement {
  visible: boolean;
  dx: number;
  dy: number;
  textAnchor: 'middle' | 'start' | 'end';
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

interface CandidateSlot {
  name: 'top' | 'bottom' | 'right' | 'left' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  dx: number;
  dy: number;
  textAnchor: 'middle' | 'start' | 'end';
  box: BoundingBox;
  dirX: number;
  dirY: number;
}

/**
 * Computes collision-free multi-direction label placements for city pins in SVG space.
 *
 * 1. Initializes pin circles as obstacles so labels never cover neighboring pins.
 * 2. Sorts cities by priority (selected/active -> connected -> nights stayed).
 * 3. Evaluates 8 candidate anchor directions around each pin, preferring directions
 *    pointing away from nearby neighbor pins, and culls any label that cannot fit
 *    without overlapping a higher-priority label or pin.
 */
export function computeSmartLabelLayout(
  nodes: LabelInputNode[],
  invScale: number,
  fontSize: number,
  zoomK: number = 1
): Record<string, LabelPlacement> {
  const result: Record<string, LabelPlacement> = {};
  if (nodes.length === 0) return result;

  // Give slightly more breathing room between labels at global zoom (zoomK < 2.2)
  const densityMultiplier = zoomK < 2.2 ? 1.35 : 1.0;

  const pinBoxes: Array<{ id: string; box: BoundingBox }> = nodes.map((n) => {
    const pad = n.radius + 1.6 * invScale * densityMultiplier;
    return {
      id: n.id,
      box: {
        minX: n.x - pad,
        minY: n.y - pad,
        maxX: n.x + pad,
        maxY: n.y + pad,
      },
    };
  });

  const placedLabelBoxes: BoundingBox[] = [];
  const sortedNodes = [...nodes].sort((a, b) => b.priority - a.priority);

  const labelPadX = 2.6 * invScale * densityMultiplier;
  const labelPadY = 1.6 * invScale * densityMultiplier;

  for (const node of sortedNodes) {
    // Estimate text bounding dimensions in SVG units
    const estWidth = (node.name.length * 0.56 + 0.6) * fontSize;
    const estHeight = fontSize * 1.05;
    const gap = node.radius + 2.8 * invScale;
    const diagGap = (node.radius + 2.2 * invScale) * 0.78;

    // Compute local repulsion vector away from close neighboring pins
    let repulseX = 0;
    let repulseY = -0.25; // slight default preference for 'top' when isolated
    const neighborRadius = 42 * invScale;

    for (const other of nodes) {
      if (other.id === node.id) continue;
      const vx = node.x - other.x;
      const vy = node.y - other.y;
      const dist = Math.hypot(vx, vy);
      if (dist > 0.001 && dist < neighborRadius) {
        const weight = (neighborRadius - dist) / neighborRadius;
        repulseX += (vx / dist) * weight;
        repulseY += (vy / dist) * weight;
      }
    }

    const candidates: CandidateSlot[] = [
      // Top-center
      {
        name: 'top',
        dx: 0,
        dy: -gap,
        textAnchor: 'middle',
        dirX: 0,
        dirY: -1,
        box: {
          minX: node.x - estWidth / 2 - labelPadX,
          minY: node.y - gap - estHeight - labelPadY,
          maxX: node.x + estWidth / 2 + labelPadX,
          maxY: node.y - gap + labelPadY,
        },
      },
      // Bottom-center
      {
        name: 'bottom',
        dx: 0,
        dy: gap + estHeight * 0.82,
        textAnchor: 'middle',
        dirX: 0,
        dirY: 1,
        box: {
          minX: node.x - estWidth / 2 - labelPadX,
          minY: node.y + gap - labelPadY,
          maxX: node.x + estWidth / 2 + labelPadX,
          maxY: node.y + gap + estHeight + labelPadY,
        },
      },
      // Right-middle
      {
        name: 'right',
        dx: gap + 1.0 * invScale,
        dy: estHeight * 0.32,
        textAnchor: 'start',
        dirX: 1,
        dirY: 0,
        box: {
          minX: node.x + gap - labelPadX * 0.5,
          minY: node.y - estHeight / 2 - labelPadY,
          maxX: node.x + gap + estWidth + labelPadX,
          maxY: node.y + estHeight / 2 + labelPadY,
        },
      },
      // Left-middle
      {
        name: 'left',
        dx: -(gap + 1.0 * invScale),
        dy: estHeight * 0.32,
        textAnchor: 'end',
        dirX: -1,
        dirY: 0,
        box: {
          minX: node.x - gap - estWidth - labelPadX,
          minY: node.y - estHeight / 2 - labelPadY,
          maxX: node.x - gap + labelPadX * 0.5,
          maxY: node.y + estHeight / 2 + labelPadY,
        },
      },
      // Top-right
      {
        name: 'top-right',
        dx: diagGap + 1.0 * invScale,
        dy: -diagGap,
        textAnchor: 'start',
        dirX: 0.707,
        dirY: -0.707,
        box: {
          minX: node.x + diagGap - labelPadX * 0.5,
          minY: node.y - diagGap - estHeight - labelPadY,
          maxX: node.x + diagGap + estWidth + labelPadX,
          maxY: node.y - diagGap + labelPadY,
        },
      },
      // Top-left
      {
        name: 'top-left',
        dx: -(diagGap + 1.0 * invScale),
        dy: -diagGap,
        textAnchor: 'end',
        dirX: -0.707,
        dirY: -0.707,
        box: {
          minX: node.x - diagGap - estWidth - labelPadX,
          minY: node.y - diagGap - estHeight - labelPadY,
          maxX: node.x - diagGap + labelPadX * 0.5,
          maxY: node.y - diagGap + labelPadY,
        },
      },
      // Bottom-right
      {
        name: 'bottom-right',
        dx: diagGap + 1.0 * invScale,
        dy: diagGap + estHeight * 0.8,
        textAnchor: 'start',
        dirX: 0.707,
        dirY: 0.707,
        box: {
          minX: node.x + diagGap - labelPadX * 0.5,
          minY: node.y + diagGap - labelPadY,
          maxX: node.x + diagGap + estWidth + labelPadX,
          maxY: node.y + diagGap + estHeight + labelPadY,
        },
      },
      // Bottom-left
      {
        name: 'bottom-left',
        dx: -(diagGap + 1.0 * invScale),
        dy: diagGap + estHeight * 0.8,
        textAnchor: 'end',
        dirX: -0.707,
        dirY: 0.707,
        box: {
          minX: node.x - diagGap - estWidth - labelPadX,
          minY: node.y + diagGap - labelPadY,
          maxX: node.x - diagGap + labelPadX * 0.5,
          maxY: node.y + diagGap + estHeight + labelPadY,
        },
      },
    ];

    // Sort candidates so directions aligned with the repulsion vector (away from neighbors) are tried first
    candidates.sort((a, b) => {
      const scoreA = a.dirX * repulseX + a.dirY * repulseY;
      const scoreB = b.dirX * repulseX + b.dirY * repulseY;
      return scoreB - scoreA;
    });

    let chosen: CandidateSlot | null = null;

    for (const cand of candidates) {
      // Check against other city pins
      let collidesWithPin = false;
      for (const pin of pinBoxes) {
        if (pin.id === node.id) continue;
        if (boxesOverlap(cand.box, pin.box)) {
          collidesWithPin = true;
          break;
        }
      }
      if (collidesWithPin) continue;

      // Check against already placed higher-priority labels
      let collidesWithLabel = false;
      for (const placed of placedLabelBoxes) {
        if (boxesOverlap(cand.box, placed)) {
          collidesWithLabel = true;
          break;
        }
      }
      if (!collidesWithLabel) {
        chosen = cand;
        break;
      }
    }

    if (chosen) {
      placedLabelBoxes.push(chosen.box);
      result[node.id] = {
        visible: true,
        dx: chosen.dx,
        dy: chosen.dy,
        textAnchor: chosen.textAnchor,
      };
    } else if (node.forceShow) {
      // Always show explicitly selected / active timeline city even in extreme density
      const fallback = candidates[0];
      placedLabelBoxes.push(fallback.box);
      result[node.id] = {
        visible: true,
        dx: fallback.dx,
        dy: fallback.dy,
        textAnchor: fallback.textAnchor,
      };
    } else {
      result[node.id] = {
        visible: false,
        dx: 0,
        dy: -gap,
        textAnchor: 'middle',
      };
    }
  }

  return result;
}
