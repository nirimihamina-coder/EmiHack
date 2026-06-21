import type { GeoJSONCollection, RoadProperties } from '../interface/Map';

const ROADS: (RoadProperties & { coords: [number, number][] })[] = [
  {
    id: 'rn7-1',
    name: 'RN7 - Nord',
    type: 'primary',
    lanes: 2,
    maxSpeed: 60,
    coords: [
      [-21.392, 47.070],
      [-21.400, 47.072],
      [-21.410, 47.074],
      [-21.420, 47.077],
      [-21.430, 47.079],
      [-21.440, 47.082],
      [-21.445, 47.084],
    ],
  },
  {
    id: 'rn7-2',
    name: 'RN7 - Centre',
    type: 'primary',
    lanes: 2,
    maxSpeed: 50,
    coords: [
      [-21.445, 47.084],
      [-21.450, 47.086],
      [-21.455, 47.088],
      [-21.460, 47.090],
      [-21.465, 47.092],
      [-21.470, 47.094],
    ],
  },
  {
    id: 'rn7-3',
    name: 'RN7 - Sud',
    type: 'primary',
    lanes: 2,
    maxSpeed: 60,
    coords: [
      [-21.470, 47.094],
      [-21.480, 47.097],
      [-21.490, 47.100],
      [-21.500, 47.103],
      [-21.510, 47.106],
    ],
  },
  {
    id: 'av-independance',
    name: "Avenue de l'Indépendance",
    type: 'secondary',
    lanes: 2,
    maxSpeed: 40,
    coords: [
      [-21.448, 47.080],
      [-21.447, 47.083],
      [-21.446, 47.086],
      [-21.445, 47.089],
      [-21.444, 47.092],
    ],
  },
  {
    id: 'rue-commerce',
    name: 'Rue du Commerce',
    type: 'secondary',
    lanes: 1,
    maxSpeed: 30,
    coords: [
      [-21.440, 47.082],
      [-21.443, 47.085],
      [-21.446, 47.088],
      [-21.449, 47.090],
    ],
  },
  {
    id: 'boulevard-est',
    name: 'Boulevard Est',
    type: 'tertiary',
    lanes: 1,
    maxSpeed: 35,
    coords: [
      [-21.435, 47.092],
      [-21.440, 47.094],
      [-21.445, 47.096],
      [-21.450, 47.098],
      [-21.455, 47.100],
      [-21.460, 47.102],
    ],
  },
  {
    id: 'boulevard-ouest',
    name: 'Boulevard Ouest',
    type: 'tertiary',
    lanes: 1,
    maxSpeed: 35,
    coords: [
      [-21.435, 47.075],
      [-21.440, 47.077],
      [-21.445, 47.079],
      [-21.450, 47.081],
      [-21.455, 47.083],
      [-21.460, 47.085],
    ],
  },
  {
    id: 'rue-ecole',
    name: "Rue de l'École",
    type: 'residential',
    lanes: 1,
    maxSpeed: 25,
    coords: [
      [-21.442, 47.085],
      [-21.445, 47.086],
      [-21.448, 47.087],
    ],
  },
  {
    id: 'rue-marche',
    name: 'Rue du Marché',
    type: 'residential',
    lanes: 1,
    maxSpeed: 20,
    coords: [
      [-21.450, 47.083],
      [-21.452, 47.086],
      [-21.454, 47.089],
    ],
  },
  {
    id: 'rn7-bypass',
    name: 'Contournement RN7',
    type: 'primary',
    lanes: 2,
    maxSpeed: 70,
    coords: [
      [-21.430, 47.065],
      [-21.440, 47.070],
      [-21.450, 47.075],
      [-21.460, 47.080],
      [-21.470, 47.085],
      [-21.480, 47.090],
    ],
  },
];

export function getRoadsGeoJSON(): GeoJSONCollection {
  return {
    type: 'FeatureCollection',
    features: ROADS.map((r) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: r.coords.map(([lat, lng]) => [lng, lat] as [number, number]),
      },
      properties: { ...r },
    })),
  };
}

export function getRoadById(id: string) {
  return ROADS.find((r) => r.id === id) ?? null;
}

export function getAllRoads() {
  return ROADS;
}
