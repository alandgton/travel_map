import { geoArea } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export interface TopoJSONTransform {
  scale: [number, number];
  translate: [number, number];
}

export interface TopoJSONGeometryObject {
  type: string;
  id?: string | number;
  properties?: Record<string, unknown>;
  arcs?: unknown;
  geometries?: TopoJSONGeometryObject[];
}

export interface TopoJSONTopology {
  type: 'Topology';
  transform?: TopoJSONTransform;
  objects: {
    countries?: TopoJSONGeometryObject;
    land?: TopoJSONGeometryObject;
    [key: string]: TopoJSONGeometryObject | undefined;
  };
  arcs: number[][][];
}

/**
 * Zero-dependency TopoJSON decoder that converts quantized delta-encoded
 * topology.arcs using topology.transform (scale and translate) into a standard
 * GeoJSON FeatureCollection for topology.objects.countries (with fallback to land).
 */
export function decodeTopoJSON(
  topology: TopoJSONTopology,
  preferredObjectKey: string = 'countries'
): FeatureCollection<Geometry> {
  if (!topology || !Array.isArray(topology.arcs)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const scale = topology.transform?.scale ?? [1, 1];
  const translate = topology.transform?.translate ?? [0, 0];
  const isDeltaEncoded = Boolean(topology.transform);

  // 1. Decode all delta-encoded quantized arcs into [lon, lat] coordinate arrays
  const decodedArcs: Position[][] = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((pt) => {
      if (isDeltaEncoded) {
        x += pt[0];
        y += pt[1];
        return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
      }
      return [pt[0], pt[1]];
    });
  });

  // Helper to stitch an array of signed arc indices into a single coordinate ring/line
  const stitchArcs = (arcIndices: number[]): Position[] => {
    const coords: Position[] = [];
    for (const rawIndex of arcIndices) {
      const arcIndex = rawIndex >= 0 ? rawIndex : ~rawIndex;
      const sourceArc = decodedArcs[arcIndex];
      if (!sourceArc || sourceArc.length === 0) continue;

      const pts = rawIndex >= 0 ? sourceArc : [...sourceArc].reverse();
      for (let i = 0; i < pts.length; i++) {
        // Avoid duplicate join vertices between consecutive stitched arcs
        if (i === 0 && coords.length > 0) {
          const prev = coords[coords.length - 1];
          if (prev[0] === pts[0][0] && prev[1] === pts[0][1]) {
            continue;
          }
        }
        coords.push(pts[i]);
      }
    }
    return coords;
  };

  // Ensure spherical winding order compatibility with d3.geoPath (steradians <= 2*PI)
  const normalizeSphericalWinding = (geom: Geometry): Geometry => {
    try {
      if (geom.type === 'Polygon') {
        if (geoArea(geom) > 2 * Math.PI) {
          return {
            ...geom,
            coordinates: geom.coordinates.map((ring) => [...ring].reverse()),
          };
        }
      } else if (geom.type === 'MultiPolygon') {
        const fixedPolys = geom.coordinates.map((polyCoords) => {
          const singlePoly: Geometry = { type: 'Polygon', coordinates: polyCoords };
          if (geoArea(singlePoly) > 2 * Math.PI) {
            return polyCoords.map((ring) => [...ring].reverse());
          }
          return polyCoords;
        });
        return {
          ...geom,
          coordinates: fixedPolys,
        };
      }
    } catch {
      // Fallback to original geometry if spherical area check fails
    }
    return geom;
  };

  const convertGeometry = (obj: TopoJSONGeometryObject): Geometry | null => {
    switch (obj.type) {
      case 'Polygon': {
        const rings = (obj.arcs as number[][]).map(stitchArcs).filter((r) => r.length >= 4);
        if (rings.length === 0) return null;
        return normalizeSphericalWinding({
          type: 'Polygon',
          coordinates: rings,
        });
      }
      case 'MultiPolygon': {
        const polygons = (obj.arcs as number[][][])
          .map((polyArcs) => polyArcs.map(stitchArcs).filter((r) => r.length >= 4))
          .filter((poly) => poly.length > 0);
        if (polygons.length === 0) return null;
        return normalizeSphericalWinding({
          type: 'MultiPolygon',
          coordinates: polygons,
        });
      }
      case 'LineString': {
        const line = stitchArcs(obj.arcs as number[]);
        if (line.length < 2) return null;
        return {
          type: 'LineString',
          coordinates: line,
        };
      }
      case 'MultiLineString': {
        const lines = (obj.arcs as number[][]).map(stitchArcs).filter((l) => l.length >= 2);
        if (lines.length === 0) return null;
        return {
          type: 'MultiLineString',
          coordinates: lines,
        };
      }
      default:
        return null;
    }
  };

  const targetObject =
    topology.objects?.[preferredObjectKey] ??
    topology.objects?.countries ??
    topology.objects?.land ??
    Object.values(topology.objects || {})[0];

  if (!targetObject) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: Feature<Geometry>[] = [];

  if (targetObject.type === 'GeometryCollection' && Array.isArray(targetObject.geometries)) {
    for (const geomObj of targetObject.geometries) {
      const geometry = convertGeometry(geomObj);
      if (geometry) {
        features.push({
          type: 'Feature',
          id: geomObj.id,
          properties: geomObj.properties ?? {},
          geometry,
        });
      }
    }
  } else {
    const geometry = convertGeometry(targetObject);
    if (geometry) {
      features.push({
        type: 'Feature',
        id: targetObject.id,
        properties: targetObject.properties ?? {},
        geometry,
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
