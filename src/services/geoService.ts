import type { OverpassResponse, GeoJSONCollection } from '../interface/Map';

function overpassToGeoJSON(data: OverpassResponse): GeoJSONCollection {
  const features = data.elements
    .filter((el) => el.geometry && el.geometry.length > 0)
    .map((el) => {
      let coordinates: number[][][] | number[][];

      if (el.type === 'relation' && el.members) {
        const outer = el.members
          .filter((m) => m.role === 'outer' && m.geometry)
          .flatMap((m) => m.geometry!.map((g) => [g.lon, g.lat] as [number, number]));
        if (outer.length === 0) return null;
        coordinates = [outer];
      } else if (el.geometry) {
        const pts = el.geometry.map((g) => [g.lon, g.lat] as [number, number]);
        if (el.type === 'way' && pts.length > 0) {
          coordinates = pts;
        } else if (el.type === 'node') {
          coordinates = pts;
        } else {
          coordinates = [pts];
        }
      } else {
        return null;
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: el.type === 'relation' || (el.type === 'way' && el.geometry && el.geometry.length >= 3 && el.geometry[0]?.lat === el.geometry[el.geometry.length - 1]?.lat && el.geometry[0]?.lon === el.geometry[el.geometry.length - 1]?.lon)
            ? 'Polygon'
            : 'LineString',
          coordinates,
        },
        properties: { ...el.tags, osmId: el.id, osmType: el.type },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return { type: 'FeatureCollection', features };
}

export async function fetchAdminBoundaries(): Promise<GeoJSONCollection> {
  const url = import.meta.env.VITE_LIMIT_URL;
  if (!url) throw new Error('VITE_LIMIT_URL is not defined');

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);
  const data: OverpassResponse = await resp.json();
  return overpassToGeoJSON(data);
}

function extractBoundaryRings(data: GeoJSONCollection): [number, number][][] {
  const rings: [number, number][][] = [];

  for (const feat of data.features) {
    const geom = feat.geometry;

    if (geom.type === 'Polygon') {
      rings.push((geom.coordinates as number[][][])[0].map((c) => [c[0], c[1]] as [number, number]));
    } else if (geom.type === 'MultiPolygon') {
      const polys = geom.coordinates as unknown as number[][][][];
      for (const poly of polys) {
        rings.push(poly[0].map((c) => [c[0], c[1]] as [number, number]));
      }
    }
  }

  return rings;
}

export function createBoundaryMask(boundaryData: GeoJSONCollection): GeoJSONCollection {
  const rings = extractBoundaryRings(boundaryData);
  if (rings.length === 0) return boundaryData;

  const worldExtent: [number, number][] = [
    [43, -25],
    [51, -25],
    [51, -18],
    [43, -18],
    [43, -25],
  ];

  const coordinates: number[][][] = [worldExtent, ...rings];

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: coordinates,
        },
        properties: { role: 'mask' },
      },
    ],
  };
}

