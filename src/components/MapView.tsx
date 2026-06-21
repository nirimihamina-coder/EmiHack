import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { MapViewProps, GeoJSONFeature } from '../interface/Map';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const TILES = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'OpenStreetMap' },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'OpenTopoMap' },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
  },
} as const;

type TileKey = keyof typeof TILES;

const DEFAULT_STYLES: Record<string, L.PathOptions> = {
  adminBoundary: { color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.08 },
  roadPrimary: { color: '#ea580c', weight: 3, fillOpacity: 0 },
  roadSecondary: { color: '#ca8a04', weight: 2.5, fillOpacity: 0 },
  roadTertiary: { color: '#6b7280', weight: 2, fillOpacity: 0 },
  roadResidential: { color: '#9ca3af', weight: 1.5, fillOpacity: 0 },
  selected: { color: '#10b981', weight: 5, fillOpacity: 0 },
};

function getDefaultStyleForKey(key: string): L.PathOptions {
  return DEFAULT_STYLES[key] ?? DEFAULT_STYLES.roadPrimary;
}

function getLayerStyleKey(feature: GeoJSONFeature): string {
  const props = feature.properties as Record<string, unknown> | undefined;
  const type = props?.type as string | undefined;
  if (type === 'primary') return 'roadPrimary';
  if (type === 'secondary') return 'roadSecondary';
  if (type === 'tertiary') return 'roadTertiary';
  if (type === 'residential') return 'roadResidential';
  return 'roadPrimary';
}

function getFeatureId(feature: GeoJSONFeature, layerId: string): string {
  const props = feature.properties ?? {};
  return (props.id as string) ?? `${layerId}-${(props.osmId as string) ?? Math.random()}`;
}

export default function MapView({
  center,
  zoom,
  layers = [],
  selectedFeatureIds = new Set(),
  onFeatureClick,
  onMapReady,
  className = '',
  children,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerMapRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const clickHandlerRef = useRef(onFeatureClick);
  clickHandlerRef.current = onFeatureClick;

  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const [tileKey, setTileKey] = useState<TileKey>('osm');

  const mapReadyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, zoom);
    mapRef.current = map;
    tileRef.current = L.tileLayer(TILES.osm.url, { attribution: TILES.osm.attribution, maxZoom: 19 }).addTo(map);

    mapReadyRef.current = true;
    onMapReadyRef.current?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerMapRef.current.clear();
      mapReadyRef.current = false;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    if (tileRef.current.options.attribution === TILES[tileKey].attribution) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[tileKey].url, { attribution: TILES[tileKey].attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  const prevLayersJson = useRef('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentJson = JSON.stringify(layers.map((l) => l.id));
    if (currentJson === prevLayersJson.current) return;
    prevLayersJson.current = currentJson;

    const existing = layerMapRef.current;
    const newIds = new Set(layers.map((l) => l.id));

    existing.forEach((geoLayer, id) => {
      if (!newIds.has(id)) {
        map.removeLayer(geoLayer);
        existing.delete(id);
      }
    });

    layers.forEach((layer) => {
      if (existing.has(layer.id)) return;

      const geoLayer = L.geoJSON(layer.data as unknown as GeoJSON.GeoJsonObject, {
        style: (f) => {
          const gf = f as unknown as GeoJSONFeature;
          const key = getLayerStyleKey(gf);
          return layer.style ?? getDefaultStyleForKey(key);
        },
        onEachFeature: (_f, l) => {
          const f = _f as unknown as GeoJSONFeature;
          layer.onEachFeature?.(f, l);
          if (layer.interactive ?? true) {
            l.on('click', () => {
              const fid = getFeatureId(f, layer.id);
              clickHandlerRef.current?.(fid, layer.id);
            });
          }
        },
      });
      geoLayer.addTo(map);
      existing.set(layer.id, geoLayer);
    });
  }, [layers]);

  useEffect(() => {
    layerMapRef.current.forEach((geoLayer, layerId) => {
      const layerConfig = layers.find((l) => l.id === layerId);
      if (!layerConfig) return;

      geoLayer.eachLayer((path) => {
        const feat = (path as unknown as { feature?: GeoJSONFeature }).feature;
        if (!feat) return;
        const lPath = path as L.Path;

        const fid = getFeatureId(feat, layerId);
        if (selectedFeatureIds.has(fid)) {
          lPath.setStyle(layerConfig.selectedStyle ?? DEFAULT_STYLES.selected);
        } else {
          const key = getLayerStyleKey(feat);
          lPath.setStyle(layerConfig.style ?? getDefaultStyleForKey(key));
        }
      });
    });
  }, [selectedFeatureIds, layers]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {layers.length > 0 && (
        <div className="absolute top-2 left-2 z-[1000] flex gap-1">
          {(Object.keys(TILES) as TileKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTileKey(k)}
              className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${
                tileKey === k
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white/80 text-gray-600 border-gray-300 hover:bg-white'
              }`}
            >
              {k === 'osm' ? 'Carte' : k === 'topo' ? 'Relief' : 'Satellite'}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
