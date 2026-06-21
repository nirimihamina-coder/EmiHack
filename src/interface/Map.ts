import type L from 'leaflet';

export interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    ref: number;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][] | number[][];
  };
  properties?: Record<string, unknown>;
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface MapLayerConfig {
  id: string;
  name: string;
  data: GeoJSONCollection;
  visible?: boolean;
  style?: L.PathOptions;
  selectedStyle?: L.PathOptions;
  interactive?: boolean;
  onEachFeature?: (feature: GeoJSONFeature, layer: L.Layer) => void;
}

export interface RoadProperties {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'tertiary' | 'residential';
  lanes?: number;
  maxSpeed?: number;
}

export interface MapViewProps {
  center: [number, number];
  zoom: number;
  layers?: MapLayerConfig[];
  selectedFeatureIds?: Set<string>;
  onFeatureClick?: (featureId: string, layerId: string) => void;
  onMapReady?: (map: L.Map) => void;
  className?: string;
  children?: React.ReactNode;
}
