import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Layers, RefreshCw, Loader2, Crosshair, Route } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { mapService } from '../../services/mapService';

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ca8a04', '#9333ea',
  '#ea580c', '#0d9488', '#4f46e5', '#be123c', '#15803d',
];

const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

// ── Helpers ─────────────────────────────────────────────────────

function mergeSegmentsIntoRings(segments: number[][][]): number[][][] {
  if (segments.length === 0) return [];
  const remaining = segments.map((s) => [...s]);
  const rings: number[][][] = [];
  while (remaining.length > 0) {
    let ring = [...remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];
        const ringStart = ring[0];
        const eq = (a: number[], b: number[]) =>
          Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
        if (eq(ringEnd, segStart)) {
          ring = [...ring, ...seg.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (eq(ringEnd, segEnd)) {
          ring = [...ring, ...[...seg].reverse().slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (eq(ringStart, segEnd)) {
          ring = [...seg, ...ring.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (eq(ringStart, segStart)) {
          ring = [...[...seg].reverse(), ...ring.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-6 || Math.abs(first[1] - last[1]) > 1e-6)
      ring.push([...first]);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function elementsToGeoJSON(elements: any[]) {
  return elements
    .map((el: any) => {
      const outerSegments: number[][][] = (el.members || [])
        .filter((m: any) => m.role === 'outer' && m.geometry?.length > 1)
        .map((m: any) => m.geometry.map((g: any) => [g.lon, g.lat]));
      const innerSegments: number[][][] = (el.members || [])
        .filter((m: any) => m.role === 'inner' && m.geometry?.length > 1)
        .map((m: any) => m.geometry.map((g: any) => [g.lon, g.lat]));
      if (!outerSegments.length) return null;
      const outerRings = mergeSegmentsIntoRings(outerSegments);
      const innerRings = mergeSegmentsIntoRings(innerSegments);
      if (!outerRings.length) return null;
      return {
        type: 'Feature' as const,
        properties: {
          id: el.id,
          name: el.tags?.name || `Fokontany #${el.id}`,
        },
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: outerRings.map((outer) => [outer, ...innerRings]),
        },
      };
    })
    .filter(Boolean);
}

function snapToPolyline(latlng: L.LatLng, coords: number[][], map: L.Map): L.LatLng {
  const p = map.latLngToLayerPoint(latlng);
  let minDistSq = Infinity;
  let bestX = p.x, bestY = p.y;
  for (let i = 0; i < coords.length - 1; i++) {
    const c1 = coords[i], c2 = coords[i + 1];
    const p1 = map.latLngToLayerPoint(L.latLng(c1[1], c1[0]));
    const p2 = map.latLngToLayerPoint(L.latLng(c2[1], c2[0]));
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = p1.x + t * dx, projY = p1.y + t * dy;
    const dSq = (p.x - projX) ** 2 + (p.y - projY) ** 2;
    if (dSq < minDistSq) { minDistSq = dSq; bestX = projX; bestY = projY; }
  }
  return map.layerPointToLatLng(L.point(bestX, bestY));
}

function findClosestIntersectionToRoutes(latlng: L.LatLng, clickedRoute: any, allRoutes: any[], map: L.Map): L.LatLng | null {
  const p = map.latLngToLayerPoint(latlng);
  let bestPoint: L.Point | null = null;
  let minDistSq = Infinity;

  const intersectSegments = (p0: L.Point, p1: L.Point, p2: L.Point, p3: L.Point) => {
    const s1_x = p1.x - p0.x, s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x, s2_y = p3.y - p2.y;
    const denom = -s2_x * s1_y + s1_x * s2_y;
    if (Math.abs(denom) < 1e-6) return null;
    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / denom;
    const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      return L.point(p0.x + (t * s1_x), p0.y + (t * s1_y));
    }
    return null;
  };

  const eq = (a: L.Point, b: L.Point) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;

  const c1 = clickedRoute.coordinates;
  for (let i = 0; i < c1.length - 1; i++) {
    const p0 = map.latLngToLayerPoint(L.latLng(c1[i][1], c1[i][0]));
    const p1 = map.latLngToLayerPoint(L.latLng(c1[i + 1][1], c1[i + 1][0]));

    for (const otherRoute of allRoutes) {
      if (otherRoute.id === clickedRoute.id) continue;
      const c2 = otherRoute.coordinates;
      for (let j = 0; j < c2.length - 1; j++) {
        const p2 = map.latLngToLayerPoint(L.latLng(c2[j][1], c2[j][0]));
        const p3 = map.latLngToLayerPoint(L.latLng(c2[j + 1][1], c2[j + 1][0]));

        const intersection = intersectSegments(p0, p1, p2, p3);
        if (intersection) {
          const dSq = (p.x - intersection.x) ** 2 + (p.y - intersection.y) ** 2;
          if (dSq < minDistSq) { minDistSq = dSq; bestPoint = intersection; }
        } else {
          if (eq(p0, p2) || eq(p0, p3)) {
            const dSq = (p.x - p0.x) ** 2 + (p.y - p0.y) ** 2;
            if (dSq < minDistSq) { minDistSq = dSq; bestPoint = p0; }
          }
          if (eq(p1, p2) || eq(p1, p3)) {
            const dSq = (p.x - p1.x) ** 2 + (p.y - p1.y) ** 2;
            if (dSq < minDistSq) { minDistSq = dSq; bestPoint = p1; }
          }
        }
      }
    }
  }

  if (bestPoint) {
    return map.layerPointToLatLng(bestPoint);
  }
  return null;
}

export default function FokontanyPage() {
  const user = useAuthStore((s) => s.user);
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonsRef = useRef<L.LayerGroup | null>(null);
  const highlightRef = useRef<L.LayerGroup | null>(null);
  const routesRef = useRef<L.LayerGroup | null>(null);

  const geoDataRef = useRef<any>(null);

  const [fokontany, setFokontany] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [queryMode, setQueryMode] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [signalementMode, setSignalementMode] = useState(false);
  const [intersectionMode, setIntersectionMode] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const routesDataRef = useRef<any[]>([]);
  useEffect(() => { routesDataRef.current = routes; }, [routes]);
  const intersectionsRef = useRef<L.LayerGroup | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{ route: any; lat: number; lng: number; fokontany: string } | null>(null);
  const [showIntersectionModal, setShowIntersectionModal] = useState(false);
  const [intersectionModalData, setIntersectionModalData] = useState<{ route: any; lat: number; lng: number; allRoutes: any[] } | null>(null);
  const queryMarkerRef = useRef<L.Marker | null>(null);
  const queryModeRef = useRef(queryMode);
  useEffect(() => { queryModeRef.current = queryMode; }, [queryMode]);
  const signalementModeRef = useRef(signalementMode);
  useEffect(() => { signalementModeRef.current = signalementMode; }, [signalementMode]);
  const intersectionModeRef = useRef(intersectionMode);
  useEffect(() => { intersectionModeRef.current = intersectionMode; }, [intersectionMode]);
  const queryResultRef = useRef<{ name: string; id: number | null; lat: number; lng: number } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const bbox = await mapService.fetchFianarantsoaBbox();

      // Étape 1 — IDs uniquement (rapide, pas de géométrie)
      const idsQuery = `[out:json][timeout:20];
      (
        relation["boundary"="administrative"]["admin_level"="10"](${bbox});
      );
      out tags;`;
      const idsData = await mapService.overpassQuery(idsQuery);
      const relations = idsData.elements?.filter((e: any) => e.type === 'relation' && e.tags);
      if (!relations?.length) throw new Error('Aucune relation trouvée');

      // Étape 2 — géométries par ID direct (évite le scan spatial lent)
      const idList = relations.map((r: any) => r.id).join(',');
      const geomQuery = `[out:json][timeout:20][maxsize:134217728];
rel(id:${idList});
out geom;`;
      const geomData = await mapService.overpassQuery(geomQuery);
      if (!geomData.elements?.length) throw new Error('Aucune géométrie récupérée');

      const features = elementsToGeoJSON(geomData.elements);
      if (!features.length) throw new Error('Aucune géométrie valide');

      geoDataRef.current = features;
      setFokontany(features);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mapElRef.current && !mapRef.current) {
      const map = L.map(mapElRef.current, { zoomControl: true }).setView([-21.45249, 47.085447], 13);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      polygonsRef.current = L.layerGroup().addTo(map);
      highlightRef.current = L.layerGroup().addTo(map);
      routesRef.current = L.layerGroup().addTo(map);
      intersectionsRef.current = L.layerGroup().addTo(map);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ── Query mode cleanup ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlightRef.current) return;

    if (queryMode) {
      highlightRef.current.clearLayers();
      setQueryResult(null);
      queryResultRef.current = null;
    } else {
      if (queryMarkerRef.current) { map.removeLayer(queryMarkerRef.current); queryMarkerRef.current = null; }
      highlightRef.current.clearLayers();
      setQueryResult(null);
      queryResultRef.current = null;
    }
  }, [queryMode]);

  // ── Signalement (routes) ───────────────────────────────────────
  const routePolylinesRef = useRef<L.Polyline[]>([]);
  const routeClickingRef = useRef(false);
  const routePopupRef = useRef<L.Popup | null>(null);
  const lastRouteClickRef = useRef<{ route: any; lat: number; lng: number } | null>(null);

  const getIntersectionRadius = (zoom: number) => Math.min(12, Math.max(3, Math.pow(1.3, zoom - 13) * 5));

  const updateRouteWeights = useCallback((zoom: number) => {
    const w = Math.min(20, Math.max(3, Math.pow(1.4, zoom - 13) * 3));
    routePolylinesRef.current.forEach((pl) => pl.setStyle({ weight: w }));
    
    const r = getIntersectionRadius(zoom);
    if (intersectionsRef.current) {
      intersectionsRef.current.eachLayer((layer: any) => {
        if (layer.setRadius) layer.setRadius(r);
      });
    }
  }, []);

  const getRouteWeight = (zoom: number) => Math.min(20, Math.max(3, Math.pow(1.4, zoom - 13) * 3));

  // ── Fetch intersections ────────────────────────────────────────
  const fetchIntersections = useCallback(async () => {
    if (!intersectionsRef.current) return;
    intersectionsRef.current.clearLayers();
    try {
      const items = await mapService.fetchIntersections();
      items.forEach((item: any) => {
        const lat = item.lat ?? item.location?.lat ?? item.coordinates?.[1];
        const lon = item.lon ?? item.location?.lon ?? item.lng ?? item.coordinates?.[0];
        if (lat == null || lon == null) return;
        const currentZoom = mapRef.current?.getZoom() || 13;
        L.circleMarker([lat, lon], {
          radius: getIntersectionRadius(currentZoom), color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.7, weight: 2,
        })
          .addTo(intersectionsRef.current!)
          .bindPopup(`<strong>${item.name || 'Intersection'}</strong><br/>Type: ${(item.type || 'inconnu').replace(/_/g, ' ')}`);
      });
    } catch { /* ignore */ }
  }, []);

  const showIntersectionForm = useCallback(({ route, lat, lng, map }: { route: any; lat: number; lng: number; map: L.Map }) => {
    const baseUrl = 'https://emihack.onrender.com';
    const prefix = `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const formId = `int-form-${prefix}`;
    const statusId = `${formId}-status`;
    const otherRoutes = routesDataRef.current.filter((r) => r.id !== route.id);

    if (window.innerWidth < 768) {
      setIntersectionModalData({ route, lat, lng, allRoutes: routesDataRef.current });
      setShowIntersectionModal(true);
      return;
    }

    if (routePopupRef.current) map.closePopup();

    const typeOptions = ['roundabout', 'crossroad', 't_junction', 'y_junction', 'traffic_lights', 'other'];
    const allRoutes = routesDataRef.current;
    const allRoutesOpts = allRoutes.map((r) => `<option value="${r.id}"${r.id === route.id ? ' selected' : ''}>${r.name || r.id.slice(0, 8)}</option>`).join('');
    const allRoutesOptsNoSelect = allRoutes.map((r) => `<option value="${r.id}">${r.name || r.id.slice(0, 8)}</option>`).join('');

    const formHtml = `<style>
  .int-popup .leaflet-popup-content-wrapper { max-width:100vw !important; border-radius:10px; }
  .int-popup .leaflet-popup-content { width:auto !important; margin:12px; }
</style>
<div style="position:relative;min-width:280px;font-size:13px;line-height:1.5">
  <button id="close-${formId}" style="position:absolute;top:-8px;right:-8px;width:28px;height:28px;border:none;border-radius:50%;background:#6b7280;color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1">&times;</button>
  <h3 style="margin:0 0 8px;font-weight:700;font-size:15px">Ajouter une intersection</h3>
  <p style="margin:0 0 6px;color:#555;font-size:12px">Route: ${route.name || route.id.slice(0, 8)}</p>
  <form id="${formId}" style="display:flex;flex-direction:column;gap:8px">
    <div style="background:#f3f0ff;border-radius:6px;padding:8px;margin:0 -4px">
      <p style="margin:0 0 6px;font-weight:700;font-size:12px;color:#6d28d9">Intersection</p>
      <div>
        <label style="font-size:11px;font-weight:600;color:#444">Nom</label>
        <input name="name" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box;background:#fff" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#444">Type</label>
        <select name="type" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff">
          ${typeOptions.map((t) => `<option value="${t}">${t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>`).join('')}
        </select>
      </div>
      <p style="margin:4px 0 0;font-size:10px;color:#888">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
    </div>
      <div style="background:#f0f7ff;border-radius:6px;padding:8px;margin:0 -4px">
      <p style="margin:0 0 6px;font-weight:700;font-size:12px;color:#1d4ed8">Route intersection</p>
      <div>
        <label style="font-size:11px;font-weight:600;color:#444">Première route</label>
        <select name="routeId1" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff">
          ${allRoutesOpts}
        </select>
      </div>
      <div style="margin-top:6px">
        <label style="font-size:11px;font-weight:600;color:#444">Deuxième route</label>
        <select name="routeId2" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff">
          <option value="">Sélectionner...</option>
          ${allRoutesOptsNoSelect}
        </select>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <div style="flex:1;min-width:80px">
          <label style="font-size:11px;font-weight:600;color:#444">Position route 1 (%)</label>
          <input type="number" name="positionOnRoute1" min="0" max="100" value="50" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box;background:#fff" />
        </div>
        <div style="flex:1;min-width:80px">
          <label style="font-size:11px;font-weight:600;color:#444">Position route 2 (%)</label>
          <input type="number" name="positionOnRoute2" min="0" max="100" value="50" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box;background:#fff" />
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#444">Route prioritaire</label>
        <select name="priorityRouteId" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff">
          <option value="${route.id}">${route.name || route.id.slice(0, 8)} (actuelle)</option>
          ${otherRoutes.map((r) => `<option value="${r.id}">${r.name || r.id.slice(0, 8)}</option>`).join('')}
        </select>
      </div>
    </div>
    <button type="submit" style="padding:10px 12px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:14px;cursor:pointer">Ajouter l'intersection</button>
    <p id="${statusId}" style="margin:0;font-size:11px;display:none"></p>
  </form>
</div>`;

    routePopupRef.current = L.popup({ closeButton: false, className: 'int-popup' }).setLatLng([lat, lng]).setContent(formHtml).openOn(map);

    setTimeout(() => {
      const form = document.getElementById(formId) as HTMLFormElement;
      const statusEl = document.getElementById(statusId) as HTMLElement;
      if (!form) return;
      document.getElementById(`close-${formId}`)?.addEventListener('click', () => { if (routePopupRef.current) { map.closePopup(); routePopupRef.current = null; } });
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        const name = (fd.get('name') as string) || 'Intersection sans nom';
        const type = (fd.get('type') as string) || 'crossroad';
        const routeId2 = fd.get('routeId2') as string;
        const pos1 = parseInt(fd.get('positionOnRoute1') as string, 10) || 50;
        const pos2 = parseInt(fd.get('positionOnRoute2') as string, 10) || 50;
        const priorityRouteId = (fd.get('priorityRouteId') as string) || route.id;

        if (!routeId2) { statusEl.textContent = 'Veuillez sélectionner une deuxième route'; statusEl.style.color = '#dc2626'; statusEl.style.display = 'block'; return; }

        statusEl.style.display = 'block';
        statusEl.textContent = 'Création intersection...';
        statusEl.style.color = '#555';
        try {
          // Step 1: create the intersection
          const intRes = await fetch(`${baseUrl}/intersections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, lat, lon: lng, type }),
          });
          if (!intRes.ok) { const msg = await intRes.text().catch(() => ''); throw new Error(`Erreur intersection: ${msg}`); }
          const intData = await intRes.json();
          const intersectionId = intData.id || intData._id;

          // Step 2: link routes to the intersection
          const routeId1 = fd.get('routeId1') as string;
          const linkRes = await fetch(`${baseUrl}/route-intersections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intersectionId, routeId1, routeId2, priorityRouteId, positionOnRoute1: pos1, positionOnRoute2: pos2 }),
          });
          if (!linkRes.ok) { const msg = await linkRes.text().catch(() => ''); throw new Error(`Erreur liaison: ${msg}`); }

          statusEl.textContent = '✓ Intersection ajoutée';
          statusEl.style.color = '#16a34a';
          (form.querySelector('button[type=submit]') as HTMLButtonElement).disabled = true;
          fetchIntersections();
        } catch (err: any) {
          statusEl.textContent = `✗ ${err.message}`;
          statusEl.style.color = '#dc2626';
        }
      };
    }, 0);
  }, [fetchIntersections]);

  const showRouteForm = useCallback(({ route, lat, lng, map }: { route: any; lat: number; lng: number; map: L.Map }) => {
    const baseUrl = 'https://emihack.onrender.com';
    const formId = `sig-form-${route.id}`;
    const statusId = `${formId}-status`;
    const fokId = `${formId}-fok`;

    if (window.innerWidth < 768) {
      setModalData({ route, lat, lng, fokontany: '' });
      setShowModal(true);
      if (queryModeRef.current) {
        mapService.overpassQuery(`[out:json][timeout:15];is_in(${lat},${lng})->.a;(relation(pivot.a)["boundary"="administrative"]["admin_level"="10"];);out body;`)
          .then((d) => { const el = d.elements?.[0]; if (el) setModalData((prev) => prev ? { ...prev, fokontany: el.tags?.name || `ID ${el.id}` } : prev); })
          .catch(() => {});
      }
      return;
    }

    if (routePopupRef.current) map.closePopup();

    const formHtml = `<style>
  .route-popup .leaflet-popup-content-wrapper { max-width:100vw !important; border-radius:10px; }
  .route-popup .leaflet-popup-content { width:auto !important; margin:12px; }
  @keyframes rspin { to { transform:rotate(360deg) } }
  .rspin { animation:rspin .8s linear infinite; }
</style>
<div style="position:relative;min-width:260px;font-size:13px;line-height:1.5">
  <button id="close-${formId}" style="position:absolute;top:-8px;right:-8px;width:28px;height:28px;border:none;border-radius:50%;background:#6b7280;color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1">&times;</button>
  <h3 style="margin:0 0 6px;font-weight:700;font-size:15px;padding-right:20px">${route.name}</h3>
  <p style="margin:0 0 8px;color:#555;font-size:12px">${route.type} — ${(route.distance / 1000).toFixed(1)} km<span id="${fokId}">${queryModeRef.current ? ' <span style="display:inline-flex;align-items:center;gap:4px"><svg class="rspin" width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="#888" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="10" stroke-linecap="round"/></svg><em style="font-size:11px;color:#888">Chargement fokontany…</em></span>' : ''}</span></p>
  <form id="${formId}" style="display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:100px">
        <label style="font-size:11px;font-weight:600;color:#444">Type</label>
        <select name="type" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff">
          <option value="accident">Accident</option>
          <option value="traffic_jam">Embouteillage</option>
          <option value="road_work">Travaux</option>
          <option value="hazard">Danger</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div style="flex:1;min-width:100px">
        <label style="font-size:11px;font-weight:600;color:#444">Sévérité</label>
        <select name="severity" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff">
          <option value="low">Faible</option>
          <option value="medium">Moyen</option>
          <option value="high">Élevé</option>
          <option value="critical">Critique</option>
        </select>
      </div>
    </div>
    <div>
      <label style="font-size:11px;font-weight:600;color:#444">Description</label>
      <textarea name="description" rows="2" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box"></textarea>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:80px">
        <label style="font-size:11px;font-weight:600;color:#444">Position sur la route (%)</label>
        <input type="number" name="positionOnRoute" min="0" max="100" value="50" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box" />
      </div>
      <div style="flex:1;min-width:80px">
        <label style="font-size:11px;font-weight:600;color:#444">Voies bloquées</label>
        <input type="number" name="lanesBlocked" min="1" value="1" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box" />
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:100px">
        <label style="font-size:11px;font-weight:600;color:#444">Fokontany</label>
        <input name="fokontanyName" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box" />
      </div>
      <div style="flex:1;min-width:100px">
        <label style="font-size:11px;font-weight:600;color:#444">Fin estimée</label>
        <input type="datetime-local" name="endTime" style="width:100%;padding:7px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box" />
      </div>
    </div>
    <p style="margin:0;font-size:11px;color:#777">Coords : ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
    <button type="submit" style="padding:10px 12px;background:#ea580c;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:14px;cursor:pointer">Envoyer le signalement</button>
    <p id="${statusId}" style="margin:0;font-size:11px;display:none"></p>
  </form>
</div>`;

    routePopupRef.current = L.popup({ closeButton: false, className: 'route-popup' }).setLatLng([lat, lng]).setContent(formHtml).openOn(map);

    setTimeout(() => {
      const form = document.getElementById(formId) as HTMLFormElement;
      const statusEl = document.getElementById(statusId) as HTMLElement;
      if (!form) return;
      document.getElementById(`close-${formId}`)?.addEventListener('click', () => { if (routePopupRef.current) { map.closePopup(); routePopupRef.current = null; } });
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        const endTimeVal = fd.get('endTime') as string;
        const payload: any = {
          type: fd.get('type') || 'accident',
          severity: fd.get('severity') || 'medium',
          routeId: route.id,
          lat,
          lon: lng,
          fokontanyName: fd.get('fokontanyName') || '',
          positionOnRoute: parseInt(fd.get('positionOnRoute') as string, 10) || 50,
          description: fd.get('description') || '',
          lanesBlocked: parseInt(fd.get('lanesBlocked') as string, 10) || 1,
          reportedBy: user?.id || 'anonymous',
        };
        if (endTimeVal) payload.endTime = new Date(endTimeVal).toISOString();
        statusEl.style.display = 'block';
        statusEl.textContent = 'Envoi...';
        statusEl.style.color = '#555';
        try {
          const r = await fetch(`${baseUrl}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!r.ok) { const msg = await r.text().catch(() => ''); throw new Error(`Erreur ${r.status}: ${msg}`); }
          statusEl.textContent = '✓ Signalement envoyé';
          statusEl.style.color = '#16a34a';
          (form.querySelector('button[type=submit]') as HTMLButtonElement).disabled = true;
        } catch {
          statusEl.textContent = "✗ Échec de l'envoi";
          statusEl.style.color = '#dc2626';
        }
      };
    }, 0);

    if (queryModeRef.current) {
      mapService.overpassQuery(`[out:json][timeout:15];is_in(${lat},${lng})->.a;(relation(pivot.a)["boundary"="administrative"]["admin_level"="10"];);out body;`)
        .then((d) => {
          const el = d.elements?.[0];
          if (el) {
            const el2 = document.getElementById(fokId);
            if (el2) el2.innerHTML = `<br/><strong>Fokontany :</strong> ${el.tags?.name || `ID ${el.id}`}`;
            const ni = document.querySelector(`#${formId} input[name="fokontanyName"]`) as HTMLInputElement;
            if (ni && !ni.value) ni.value = el.tags?.name || `ID ${el.id}`;
          }
        }).catch(() => {});
    }
  }, [user, setModalData, setShowModal]);

  const fetchRoutes = useCallback(async () => {
    if (!routesRef.current) return;
    routesRef.current.clearLayers();
    routePolylinesRef.current = [];
    try {
      const data = await mapService.fetchRoutes();
      setRoutes(data);
      const zoom = mapRef.current?.getZoom() ?? 14;
      data.forEach((route: any, idx: number) => {
        const latlngs = route.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
        const pl = L.polyline(latlngs, {
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
          weight: getRouteWeight(zoom),
          opacity: 0.5,
        }).addTo(routesRef.current!);
        routePolylinesRef.current.push(pl);

        pl.on('click', async (e) => {
          routeClickingRef.current = true;
          setTimeout(() => { routeClickingRef.current = false; }, 500);
          const map = mapRef.current;
          if (!map) return;
          let snapped = snapToPolyline(e.latlng, route.coordinates, map);
          
          if (intersectionModeRef.current) {
            const closestInt = findClosestIntersectionToRoutes(e.latlng, route, routesDataRef.current, map);
            if (closestInt) {
              snapped = closestInt;
            }
          }
          
          const { lat, lng } = snapped;

          // Place marker immediately
          if (queryMarkerRef.current) map.removeLayer(queryMarkerRef.current);
          lastRouteClickRef.current = { route, lat, lng };
          const showForm = intersectionModeRef.current ? showIntersectionForm : showRouteForm;
          queryMarkerRef.current = L.marker([lat, lng], {
            icon: L.divIcon({ className: '', html: '<div style="width:12px;height:12px;background:#dc2626;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)" />', iconSize: [12, 12], iconAnchor: [6, 6] }),
          }).addTo(map).on('click', () => { if (lastRouteClickRef.current) showForm({ ...lastRouteClickRef.current, map }); });

          showForm({ route, lat, lng, map });
        });
      });
    } catch {
      // ignore
    }
  }, [showRouteForm, showIntersectionForm]);

  // ── Zoom-based route weight update ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!signalementMode && !intersectionMode)) return;
    const handler = () => updateRouteWeights(map.getZoom());
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [signalementMode, intersectionMode, updateRouteWeights]);

  useEffect(() => {
    if (!routesRef.current) return;
    if (signalementMode || intersectionMode) {
      fetchRoutes();
    } else {
      routesRef.current.clearLayers();
      routePolylinesRef.current = [];
      setRoutes([]);
    }
  }, [signalementMode, intersectionMode, fetchRoutes]);

  // ── Clear highlight when signalement/intersection turns on in query mode ────
  useEffect(() => {
    if (queryMode && (signalementMode || intersectionMode) && highlightRef.current) {
      highlightRef.current.clearLayers();
    }
  }, [queryMode, signalementMode, intersectionMode]);

  const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
    if (!queryMode || !mapRef.current) return;
    if (routeClickingRef.current) return;
    const { lat, lng } = e.latlng;

    if (queryMarkerRef.current) mapRef.current.removeLayer(queryMarkerRef.current);
    queryMarkerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div style="width:12px;height:12px;background:#dc2626;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)" />', iconSize: [12, 12], iconAnchor: [6, 6] }),
    }).addTo(mapRef.current);

    if (highlightRef.current) highlightRef.current.clearLayers();

    const loadingPopup = L.popup()
      .setLatLng([lat, lng])
      .setContent('<em>Chargement...</em>')
      .openOn(mapRef.current);

    const query = `[out:json][timeout:25];
is_in(${lat}, ${lng})->.a;
(relation(pivot.a)["boundary"="administrative"]["admin_level"="10"];);
out geom;`;
    try {
      const data = await mapService.overpassQuery(query);
      const el = data.elements?.[0];
      if (!el) {
        loadingPopup.setContent('<strong>Aucun fokontany trouvé</strong>');
        setQueryResult({ name: 'Aucun fokontany trouvé', id: null, lat, lng });
        return;
      }

      if (!signalementModeRef.current && !intersectionModeRef.current) {
        const feat = elementsToGeoJSON([el])[0];
        if (feat && highlightRef.current) {
          L.geoJSON(feat, {
            style: { color: '#dc2626', weight: 5, fillColor: '#dc2626', fillOpacity: 0.15, opacity: 1 },
          }).addTo(highlightRef.current);
        }
      }
      loadingPopup.setContent(`<strong>${el.tags?.name || `ID ${el.id}`}</strong>`);
      const qr = { name: el.tags?.name || `ID ${el.id}`, id: el.id, lat, lng };
      queryResultRef.current = qr;
      setQueryResult(qr);
    } catch {
      loadingPopup.setContent('<strong>Erreur de requête</strong>');
      setQueryResult({ name: 'Erreur de requête', id: null, lat, lng });
    }
  }, [queryMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (queryMode) {
      map.on('click', handleMapClick);
    } else {
      map.off('click', handleMapClick);
    }
    return () => { map.off('click', handleMapClick); };
  }, [queryMode, handleMapClick]);

  useEffect(() => {
    if (!polygonsRef.current || fokontany.length === 0) return;
    polygonsRef.current.clearLayers();

    const allCoords: [number, number][] = [];
    const isHidden = queryMode;

    fokontany.forEach((feature, idx) => {
      const color = COLORS[idx % COLORS.length];
      const props = feature.properties;

      for (const polygon of feature.geometry.coordinates) {
        const rings = polygon.map((ring: number[][]) =>
          ring.map(([lng, lat]: number[]) => [lat, lng] as [number, number])
        );
        L.polygon(rings, {
          color, weight: 2, fillColor: color,
          fillOpacity: isHidden ? 0 : 0.12,
          opacity: isHidden ? 0 : 1,
          interactive: !isHidden,
        })
          .addTo(polygonsRef.current!)
          .bindPopup(`<strong>${props.name}</strong>`)
          .on('click', () => setSelectedId(props.id));
      }

      // collect coords for fitBounds
      feature.geometry.coordinates.forEach((geom: number[][][]) => {
        geom.forEach((ring: number[][]) => {
          ring.forEach(([lng, lat]: number[]) => { allCoords.push([lat, lng]); });
        });
      });
    });

    if (allCoords.length > 0) {
      mapRef.current?.fitBounds(L.latLngBounds(allCoords).pad(0.1));
    }
  }, [fokontany, queryMode]);

  useEffect(() => {
    if (!polygonsRef.current || fokontany.length === 0 || queryMode) return;
    polygonsRef.current.eachLayer((layer: L.Layer) => {
      const poly = layer as L.Polygon;
      fokontany.forEach((f) => {
        poly.setStyle({
          fillOpacity: f.properties.id === selectedId ? 0.35 : 0.12,
          weight: f.properties.id === selectedId ? 3 : 2,
        });
      });
    });
  }, [selectedId, fokontany, queryMode]);

  useEffect(() => { fetchData(); fetchIntersections(); }, []);

  const handleFlyTo = (feature: any) => {
    setSelectedId(feature.properties.id);
    const coords: [number, number][] = [];
    feature.geometry.coordinates.forEach((geom: number[][][]) => {
      geom.forEach((ring: number[][]) => {
        ring.forEach(([lng, lat]: number[]) => coords.push([lat, lng]));
      });
    });
    if (coords.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(coords).pad(0.15), { animate: true, duration: 1.2 });
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fokontany - Fianarantsoa</h1>
          <p className="text-sm text-gray-500 mt-1">
            {fokontany.length > 0
              ? `${fokontany.length} fokontany affichés`
              : 'Limites administratives de niveau 10 (Fokontany)'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setSignalementMode(false); setIntersectionMode((v) => !v); }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium border rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              intersectionMode
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Layers size={16} />
            {intersectionMode ? 'Intersection actif' : 'Intersection'}
          </button>
          <button
            onClick={() => setSignalementMode((v) => { if (!v) setIntersectionMode(false); return !v; })}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium border rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              signalementMode
                ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Route size={16} />
            {signalementMode ? 'Signalement actif' : 'Signalement'}
          </button>
          <button
            onClick={() => { setQueryMode((v) => !v); if (queryMode) setQueryResult(null); }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium border rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              queryMode
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Crosshair size={16} />
            {queryMode ? 'Mode requête actif' : 'Mode requête'}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {queryResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <MapPin size={16} />
          <span><strong>Point :</strong> {queryResult.lat.toFixed(5)}, {queryResult.lng.toFixed(5)} — <strong>Fokontany :</strong> {queryResult.name}</span>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_320px] gap-4 flex-1 min-h-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[500px] lg:min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg text-sm font-medium text-gray-600">
                <Loader2 size={18} className="animate-spin" />
                Chargement...
              </div>
            </div>
          )}
          <div ref={mapElRef} className="flex-1 z-10" />
          <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg shadow text-xs text-gray-500">
            <span className="flex items-center gap-1"><Layers size={14} />{fokontany.length} fokontany</span>
            {signalementMode && routes.length > 0 && <span className="flex items-center gap-1"><Route size={14} />{routes.length} routes</span>}
          </div>
        </div>

        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Liste des fokontany ({fokontany.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
            {fokontany.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                <MapPin size={32} className="opacity-30" />
                <p className="text-sm">Aucun fokontany</p>
              </div>
            )}
            {fokontany.map((f, idx) => {
              const color = COLORS[idx % COLORS.length];
              const isSelected = selectedId === f.properties.id;
              return (
                <button
                  key={f.properties.id}
                  onClick={() => handleFlyTo(f)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'ring-2 border-transparent'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  style={isSelected ? { borderColor: color } : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{f.properties.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {f.geometry.coordinates.length} polygone{f.geometry.coordinates.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ── Mobile modal ───────────────────────────────────── */}
      {showModal && modalData && (
        <div className="fixed inset-0 z-[9999] bg-black/20 flex items-end sm:items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-white/90 backdrop-blur-sm w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">{modalData.route.name}</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 cursor-pointer">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{modalData.route.type} — {(modalData.route.distance / 1000).toFixed(1)} km
              {modalData.fokontany
                ? <span> — {modalData.fokontany}</span>
                : <span className="inline-flex items-center gap-1.5 ml-1"><svg className="animate-spin" width="10" height="10" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="10" stroke-linecap="round"/></svg><em className="text-xs text-gray-400 not-italic">Chargement fokontany…</em></span>
              }
            </p>
            <SignalementForm route={modalData.route} lat={modalData.lat} lng={modalData.lng} fokontany={modalData.fokontany} onDone={() => setShowModal(false)} />
          </div>
        </div>
      )}

      {/* ── Mobile Intersection modal ────────────────────────── */}
      {showIntersectionModal && intersectionModalData && (
        <div className="fixed inset-0 z-[9999] bg-black/20 flex items-end sm:items-center justify-center" onClick={() => setShowIntersectionModal(false)}>
          <div className="bg-white/90 backdrop-blur-sm w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Ajouter une intersection</h3>
              <button onClick={() => setShowIntersectionModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 cursor-pointer">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Route: {intersectionModalData.route.name || intersectionModalData.route.id.slice(0, 8)}</p>
            <IntersectionForm route={intersectionModalData.route} lat={intersectionModalData.lat} lng={intersectionModalData.lng} allRoutes={intersectionModalData.allRoutes} onDone={() => { setShowIntersectionModal(false); fetchIntersections(); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SignalementForm({ route, lat, lng, fokontany, onDone }: { route: any; lat: number; lng: number; fokontany: string; onDone: () => void }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    type: 'accident', severity: 'medium', description: '',
    fokontanyName: '', positionOnRoute: 50, lanesBlocked: 1, endTime: ''
  });

  // Sync fokontany to fokontanyName when it arrives
  useEffect(() => {
    if (fokontany && !formData.fokontanyName) {
      setFormData((prev) => ({ ...prev, fokontanyName: fokontany }));
    }
  }, [fokontany, formData.fokontanyName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus('Envoi...');
    try {
      const payload: any = {
        type: formData.type,
        severity: formData.severity,
        routeId: route.id,
        lat,
        lon: lng,
        fokontanyName: formData.fokontanyName,
        positionOnRoute: formData.positionOnRoute,
        description: formData.description,
        lanesBlocked: formData.lanesBlocked,
        reportedBy: userId || 'anonymous',
      };
      if (formData.endTime) payload.endTime = new Date(formData.endTime).toISOString();
      await mapService.createReport(payload);
      setStatus('✓ Signalement envoyé');
      setTimeout(() => onDone(), 1000);
    } catch {
      setStatus("✗ Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500">Type</label>
          <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
            <option value="accident">Accident</option>
            <option value="traffic_jam">Embouteillage</option>
            <option value="road_work">Travaux</option>
            <option value="hazard">Danger</option>
            <option value="other">Autre</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500">Sévérité</label>
          <select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
            <option value="low">Faible</option>
            <option value="medium">Moyen</option>
            <option value="high">Élevé</option>
            <option value="critical">Critique</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500">Description</label>
        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-vertical" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500">Position sur la route (%)</label>
          <input type="number" value={formData.positionOnRoute} onChange={(e) => setFormData({ ...formData, positionOnRoute: Number(e.target.value) })} min={0} max={100} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500">Voies bloquées</label>
          <input type="number" value={formData.lanesBlocked} onChange={(e) => setFormData({ ...formData, lanesBlocked: Number(e.target.value) })} min={1} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500">Fokontany</label>
          <input value={formData.fokontanyName} onChange={(e) => setFormData({ ...formData, fokontanyName: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500">Fin estimée</label>
          <input type="datetime-local" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
      </div>
      <p className="text-xs text-gray-400">Coords : {lat.toFixed(5)}, {lng.toFixed(5)}</p>
      <button type="submit" disabled={sending} className="w-full py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 cursor-pointer">
        {sending ? 'Envoi...' : 'Envoyer le signalement'}
      </button>
      {status && <p className={`text-xs ${status.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{status}</p>}
    </form>
  );
}

function IntersectionForm({ route, lat, lng, allRoutes, onDone }: { route: any; lat: number; lng: number; allRoutes: any[]; onDone: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    name: '', type: 'roundabout', routeId1: route.id, routeId2: '', positionOnRoute1: 50, positionOnRoute2: 50, priorityRouteId: route.id
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.routeId2) { setStatus('Veuillez sélectionner une deuxième route'); return; }
    setSending(true);
    setStatus('Création intersection...');
    try {
      const intPayload = { name: formData.name || 'Intersection sans nom', lat, lon: lng, type: formData.type };
      const intRes = await mapService.createIntersection(intPayload);
      const intersectionId = intRes.data?.id || intRes.id;

      const linkPayload = {
        intersectionId, routeId1: formData.routeId1, routeId2: formData.routeId2,
        priorityRouteId: formData.priorityRouteId,
        positionOnRoute1: formData.positionOnRoute1,
        positionOnRoute2: formData.positionOnRoute2,
      };
      await mapService.linkRouteIntersection(linkPayload);

      setStatus('✓ Intersection ajoutée');
      setTimeout(() => onDone(), 1000);
    } catch (err: any) {
      setStatus(`✗ ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const typeOptions = ['roundabout', 'crossroad', 't_junction', 'y_junction', 'traffic_lights', 'other'];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="bg-purple-50 rounded-lg p-3 -mx-1">
        <p className="text-xs font-bold text-purple-700 mb-2">Intersection</p>
        <div>
          <label className="text-xs font-semibold text-gray-500">Nom</label>
          <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white" />
        </div>
        <div className="mt-2">
          <label className="text-xs font-semibold text-gray-500">Type</label>
          <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
            {typeOptions.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
      </div>
      <div className="bg-blue-50 rounded-lg p-3 -mx-1">
        <p className="text-xs font-bold text-blue-700 mb-2">Route intersection</p>
        <div>
          <label className="text-xs font-semibold text-gray-500">Première route</label>
          <select value={formData.routeId1} onChange={(e) => setFormData({ ...formData, routeId1: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
            {allRoutes.map((r) => <option key={r.id} value={r.id}>{r.name || r.id.slice(0, 8)}{r.id === route.id ? ' (actuelle)' : ''}</option>)}
          </select>
        </div>
        <div className="mt-2">
          <label className="text-xs font-semibold text-gray-500">Deuxième route</label>
          <select value={formData.routeId2} onChange={(e) => setFormData({ ...formData, routeId2: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
            <option value="">Sélectionner...</option>
            {allRoutes.map((r) => <option key={r.id} value={r.id}>{r.name || r.id.slice(0, 8)}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500">Position route 1 (%)</label>
            <input type="number" value={formData.positionOnRoute1} onChange={(e) => setFormData({ ...formData, positionOnRoute1: Number(e.target.value) })} min={0} max={100} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500">Position route 2 (%)</label>
            <input type="number" value={formData.positionOnRoute2} onChange={(e) => setFormData({ ...formData, positionOnRoute2: Number(e.target.value) })} min={0} max={100} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white" />
          </div>
        </div>
        <div className="mt-2">
          <label className="text-xs font-semibold text-gray-500">Route prioritaire</label>
          <select value={formData.priorityRouteId} onChange={(e) => setFormData({ ...formData, priorityRouteId: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
            {allRoutes.map((r) => <option key={r.id} value={r.id}>{r.name || r.id.slice(0, 8)}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" disabled={sending} className="w-full py-2.5 bg-purple-600 text-white font-semibold text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 cursor-pointer">
        {sending ? 'Création...' : 'Ajouter l\'intersection'}
      </button>
      {status && <p className={`text-xs ${status.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{status}</p>}
    </form>
  );
}
