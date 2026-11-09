import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, GeoProjection } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { MapRenderConfig, RegionCameraConfig } from '../config/types';

export interface UseMapCameraReturn {
  svgRef: React.RefObject<SVGSVGElement>;
  cameraGroupRef: React.RefObject<SVGGElement>;
  projection: GeoProjection;
  transform: ZoomTransform;
  zoomK: number;
  invScale: number;
  labelScaleBoost: number;
  activeRegionId: string | null;
  flyToCoordinates: (
    coords: [number, number],
    targetZoom?: number,
    durationMs?: number,
    regionId?: string | null
  ) => void;
  flyToRegion: (region: RegionCameraConfig, durationMs?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
}

export function useMapCamera(mapConfig: MapRenderConfig): UseMapCameraReturn {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraGroupRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const lastCommittedZoomKRef = useRef<number>(1);
  const rafIdRef = useRef<number | null>(null);
  const isProgrammaticFlightRef = useRef<boolean>(false);

  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [transform, setTransform] = useState<ZoomTransform>(() => zoomIdentity);
  const [scaleZoomK, setScaleZoomK] = useState<number>(1);
  const [activeRegionId, setActiveRegionId] = useState<string | null>('world');

  // Track responsive viewport width so mobile phones get readable text/pin scaling
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create the D3 Natural Earth 1 projection specified in prompt.md Section 1:
  // d3.geoNaturalEarth1().scale(225).translate([width / 2, height / 1.85]).rotate([-11, 0])
  const projection = useMemo(() => {
    return geoNaturalEarth1()
      .scale(mapConfig.projectionScale)
      .translate([mapConfig.width / 2, mapConfig.height / mapConfig.translateYDivisor])
      .rotate(mapConfig.rotation);
  }, [
    mapConfig.projectionScale,
    mapConfig.width,
    mapConfig.height,
    mapConfig.translateYDivisor,
    mapConfig.rotation,
  ]);

  const computeWorldDefaultTransform = useCallback((): ZoomTransform => {
    const isPhone = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isPhone) {
      return zoomIdentity;
    }
    // On portrait mobile screens, start at a closer 1.75x framing centered on the Northern Hemisphere travel belt
    const mobileZoom = 1.75;
    const projected = projection([18, 28]);
    if (!projected) return zoomIdentity;
    const tx = mapConfig.width / 2 - projected[0] * mobileZoom;
    const ty = mapConfig.height / 2 - projected[1] * mobileZoom;
    return zoomIdentity.translate(tx, ty).scale(mobileZoom);
  }, [mapConfig.height, mapConfig.width, projection]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent(mapConfig.scaleExtent)
      .on('start', (event) => {
        if (event.sourceEvent) {
          isProgrammaticFlightRef.current = false;
        }
      })
      .on('zoom', (event) => {
        const nextTransform: ZoomTransform = event.transform;

        // 1. Immediately update the SVG <g> transform attribute directly in the DOM
        //    for 60-120fps native pan/zoom with zero React VDOM overhead on every frame.
        if (cameraGroupRef.current) {
          cameraGroupRef.current.setAttribute('transform', nextTransform.toString());
        }

        if (event.sourceEvent) {
          isProgrammaticFlightRef.current = false;
          setActiveRegionId((prev) => (prev !== null ? null : prev));
        }

        // 2. During programmatic camera flights (e.g. Follow Camera in Journey Playback),
        //    freeze pin/label/line scaling and defer React state re-renders until the flight
        //    lands in .on('end') so the GPU transform animation runs with zero main-thread jank.
        if (isProgrammaticFlightRef.current) {
          return;
        }

        // 3. During manual user gestures, only trigger a React state re-render when zoomK
        //    changes by >= 14% (throttled via requestAnimationFrame). Pure panning triggers
        //    zero React re-renders during the drag.
        const prevK = lastCommittedZoomKRef.current;
        const relDiff = Math.abs(nextTransform.k - prevK) / (prevK || 1);
        if (relDiff >= 0.14 && rafIdRef.current === null) {
          rafIdRef.current = window.requestAnimationFrame(() => {
            rafIdRef.current = null;
            lastCommittedZoomKRef.current = nextTransform.k;
            setTransform(nextTransform);
            setScaleZoomK(nextTransform.k);
          });
        }
      })
      .on('end', (event) => {
        isProgrammaticFlightRef.current = false;
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        const finalTransform: ZoomTransform = event.transform;
        if (cameraGroupRef.current) {
          cameraGroupRef.current.setAttribute('transform', finalTransform.toString());
        }
        lastCommittedZoomKRef.current = finalTransform.k;
        setTransform(finalTransform);
        setScaleZoomK(finalTransform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgEl);
    selection.call(zoomBehavior);

    // Apply responsive initial framing on mount
    const initialTransform = computeWorldDefaultTransform();
    if (initialTransform.k !== 1) {
      selection.call(zoomBehavior.transform, initialTransform);
    }

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      selection.on('.zoom', null);
    };
  }, [computeWorldDefaultTransform, mapConfig.scaleExtent]);

  const flyToCoordinates = useCallback(
    (
      coords: [number, number],
      targetZoom: number = 5.5,
      durationMs: number = 850,
      regionId: string | null = null
    ) => {
      const svgEl = svgRef.current;
      const zoomBehavior = zoomBehaviorRef.current;
      if (!svgEl || !zoomBehavior) return;

      const clampedZoom = Math.max(
        mapConfig.scaleExtent[0],
        Math.min(mapConfig.scaleExtent[1], targetZoom)
      );

      let nextTransform: ZoomTransform;

      if (regionId === 'world' && clampedZoom === 1) {
        nextTransform = computeWorldDefaultTransform();
      } else {
        const projected = projection(coords);
        if (!projected) return;
        const [px, py] = projected;
        const tx = mapConfig.width / 2 - px * clampedZoom;
        const ty = mapConfig.height / 2 - py * clampedZoom;
        nextTransform = zoomIdentity.translate(tx, ty).scale(clampedZoom);
      }

      setActiveRegionId(regionId);

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isProgrammaticFlightRef.current = true;

      // When zooming IN, immediately pre-scale pins/labels/lines to the destination zoom level
      // so low-zoom text is never magnified into giant text while the camera flies closer.
      if (nextTransform.k > lastCommittedZoomKRef.current) {
        lastCommittedZoomKRef.current = nextTransform.k;
        setScaleZoomK(nextTransform.k);
      }

      select(svgEl)
        .transition()
        .duration(durationMs)
        .call(zoomBehavior.transform, nextTransform);
    },
    [computeWorldDefaultTransform, mapConfig.height, mapConfig.scaleExtent, mapConfig.width, projection]
  );

  const flyToRegion = useCallback(
    (region: RegionCameraConfig, durationMs: number = 850) => {
      flyToCoordinates(region.center, region.zoom, durationMs, region.id);
    },
    [flyToCoordinates]
  );

  const zoomIn = useCallback(() => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgEl || !zoomBehavior) return;
    setActiveRegionId(null);
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isProgrammaticFlightRef.current = true;
    const targetK = Math.min(mapConfig.scaleExtent[1], lastCommittedZoomKRef.current * 1.5);
    lastCommittedZoomKRef.current = targetK;
    setScaleZoomK(targetK);
    select(svgEl).transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
  }, [mapConfig.scaleExtent]);

  const zoomOut = useCallback(() => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgEl || !zoomBehavior) return;
    setActiveRegionId(null);
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isProgrammaticFlightRef.current = true;
    select(svgEl).transition().duration(300).call(zoomBehavior.scaleBy, 1 / 1.5);
  }, []);

  const resetCamera = useCallback(() => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgEl || !zoomBehavior) return;
    setActiveRegionId('world');
    const worldTransform = computeWorldDefaultTransform();
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isProgrammaticFlightRef.current = true;
    if (worldTransform.k > lastCommittedZoomKRef.current) {
      lastCommittedZoomKRef.current = worldTransform.k;
      setScaleZoomK(worldTransform.k);
    }
    select(svgEl).transition().duration(750).call(zoomBehavior.transform, worldTransform);
  }, [computeWorldDefaultTransform]);

  const zoomK = scaleZoomK;
  // Responsive mobile scaling:
  // On mobile phones (< 640px), the 1200-unit SVG viewBox is scaled down ~3x more than on desktop.
  // At global/continental views (zoomK <= 2.5), boost pin/line and label scale for legibility,
  // then smoothly taper both boosts down as the camera zooms in so zoomed-in city labels never look oversized.
  const isMobilePhone = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const deviceVisualMultiplier = isMobilePhone ? 1.45 : isTablet ? 1.18 : 1.0;
  const baseLabelScaleBoost = isMobilePhone ? 1.45 : isTablet ? 1.18 : 1.0;

  // Two-stage zoom-invariant scaling:
  // - Below 8x zoom: 1 / zoomK^0.82 preserves bold global & continental legibility.
  // - Above 8x zoom (up to 250x): transitions to 1 / zoomK^0.99 so pins, halos, and
  //   strokes do not bloat in screen pixels when inspecting micro-island clusters.
  const baseInvScale =
    zoomK <= 8
      ? 1 / Math.pow(zoomK, mapConfig.zoomInvariantExponent)
      : (1 / Math.pow(8, mapConfig.zoomInvariantExponent)) * Math.pow(8 / zoomK, 0.99);

  // Taper off the mobile pin/line multiplier as zoomK increases past 2.5x (reaching 1.0x by 10x zoom)
  const effectiveDeviceMultiplier =
    zoomK <= 2.5
      ? deviceVisualMultiplier
      : 1 + (deviceVisualMultiplier - 1) * Math.max(0, 1 - (zoomK - 2.5) / 7.5);

  // Taper off the mobile label boost earlier (between 2x and 5.5x zoom) and slightly
  // dampen high-zoom label size (>= 5.5x) to offset the zoomK^0.18 growth from baseInvScale.
  const labelScaleBoost =
    zoomK <= 2.0
      ? baseLabelScaleBoost
      : zoomK <= 5.5
        ? 1 + (baseLabelScaleBoost - 1) * (1 - (zoomK - 2.0) / 3.5)
        : Math.max(0.85, 1 - ((zoomK - 5.5) / 20) * 0.15);

  const invScale = baseInvScale * effectiveDeviceMultiplier;

  return {
    svgRef,
    cameraGroupRef,
    projection,
    transform,
    zoomK,
    invScale,
    labelScaleBoost,
    activeRegionId,
    flyToCoordinates,
    flyToRegion,
    zoomIn,
    zoomOut,
    resetCamera,
  };
}
