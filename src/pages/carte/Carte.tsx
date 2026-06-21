import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  X,
  Clock,
  Ruler,
  AlertTriangle,
  Route,
  ChevronRight,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Zap
} from 'lucide-react';
import boundaryData from '../../data/fianarantsoa-boundary.json';
import { useRoadsStore } from '../../stores/roads';
import { useReportsStore } from '../../stores/reports';
import type { GeoJSONCollection } from '../../interface/Map';
import type { Report } from '../../services/reportService';

// ============================================================
// 🔑 Types Overpass / limite
// ============================================================
interface OverpassElement {
  type: string;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; geometry?: { lat: number; lon: number }[] }[];
}
interface OverpassResponse {
  elements: OverpassElement[];
}

// ============================================================
// 🔑 Extraction segments → rings
// ============================================================
function extractSegments(data: OverpassResponse): [number, number][][] {
  const segments: [number, number][][] = [];
  if (!data?.elements) return segments;
  data.elements.forEach((el) => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 1) {
      segments.push(el.geometry.map((g) => [g.lat, g.lon] as [number, number]));
    }
    if (el.type === 'relation' && el.members) {
      el.members.forEach((member) => {
        if (member.type === 'way' && member.geometry && member.geometry.length > 1) {
          segments.push(member.geometry.map((g) => [g.lat, g.lon] as [number, number]));
        }
      });
    }
  });
  return segments;
}

function mergeSegmentsIntoRings(segments: [number, number][][]): [number, number][][] {
  if (segments.length === 0) return [];
  const remaining: [number, number][][] = segments.map((s) => [...s]);
  const rings: [number, number][][] = [];
  const eq = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

  while (remaining.length > 0) {
    let ring: [number, number][] = [...remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];
        const ringStart = ring[0];
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
    if (!eq(first, last)) ring.push(first);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

const WORLD_BOUNDS: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180]
];

function drawBoundary(bLayer: L.LayerGroup, data: OverpassResponse) {
  if (!bLayer) return;
  bLayer.clearLayers();
  const segments = extractSegments(data);
  if (segments.length === 0) return;
  const rings = mergeSegmentsIntoRings(segments);
  if (rings.length === 0) return;

  rings.forEach((ring) => {
    L.polygon(ring, {
      color: '#1e40af',
      weight: 2.5,
      fillColor: '#1e3a5f',
      fillOpacity: 0.06,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(bLayer);
  });

  if (rings.length > 0) {
    L.polygon([WORLD_BOUNDS, ...rings], {
      color: 'transparent',
      fillColor: '#0f172a',
      fillOpacity: 0.4,
      interactive: false
    }).addTo(bLayer);
  }
}

// ============================================================
// 🔑 Routes du backend
// ============================================================
interface DisplayRoute {
  id: string;
  name: string;
  type: string;
  polyline: [number, number][];
  color: string;
  weight: number;
}

function getRouteColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('nationale') || t.includes('rn') || t === 'primary') return '#dc2626';
  if (t.includes('secondaire') || t === 'secondary') return '#f59e0b';
  if (t.includes('tertiaire') || t === 'tertiary') return '#10b981';
  if (t.includes('urbain') || t.includes('residentiel') || t === 'residential') return '#6366f1';
  return '#6b7280';
}

function getRouteWeight(type: string): number {
  const t = type.toLowerCase();
  if (t.includes('nationale') || t.includes('rn') || t === 'primary') return 4;
  if (t.includes('secondaire') || t === 'secondary') return 3;
  if (t.includes('tertiaire') || t === 'tertiary') return 2.5;
  return 2;
}

function geoJSONToDisplayRoutes(geoJSON: GeoJSONCollection | null): DisplayRoute[] {
  if (!geoJSON || !geoJSON.features) return [];
  return geoJSON.features
    .map((feature: any) => {
      if (!feature.geometry || feature.geometry.type !== 'LineString') return null;
      const coords = feature.geometry.coordinates as number[][];
      if (coords.length < 2) return null;
      const polyline: [number, number][] = coords.map((c) => [c[1], c[0]] as [number, number]);
      const type = feature.properties?.type || 'primary';
      return {
        id: feature.properties?.id || feature.properties?.osmId || String(Math.random()),
        name: feature.properties?.name || 'Route',
        type,
        polyline,
        color: getRouteColor(type),
        weight: getRouteWeight(type)
      };
    })
    .filter((r): r is DisplayRoute => r !== null);
}

// ============================================================
// 🔑 Signalements
// ============================================================
const DEFAULT_REPORT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#cbd5e1"/><text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="40" fill="#64748b">?</text></svg>'
  );

function getSeverityColor(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'high' || s === 'critical') return '#dc2626';
  if (s === 'medium') return '#f59e0b';
  return '#22c55e';
}

function makeReportIcon(report: Report): L.DivIcon {
  const avatar = report.reporter?.avatar || DEFAULT_REPORT_AVATAR;
  const borderColor = getSeverityColor(report.severity);
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;border-radius:50%;border:3px solid ${borderColor};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:white">
      <img src="${avatar}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'" />
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function drawReports(layerGroup: L.LayerGroup, reports: Report[]) {
  layerGroup.clearLayers();
  reports.forEach((report) => {
    if (report.lat == null || report.lon == null) return;
    const sevColor = getSeverityColor(report.severity);
    const reporterName = report.reporter ? `${report.reporter.firstName} ${report.reporter.lastName}` : 'Anonyme';
    L.marker([report.lat, report.lon], { icon: makeReportIcon(report) }).addTo(layerGroup)
      .bindPopup(`<div style="min-width:160px;font-family:sans-serif">
        <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px">${reporterName}</div>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${sevColor};color:white">${report.severity}</span>
        <p style="font-size:12px;color:#334155;margin:6px 0">${report.description}</p>
        ${report.lanesBlocked > 0 ? `<div style="font-size:11px;color:#dc2626">🚧 ${report.lanesBlocked} voie(s) bloquée(s)</div>` : ''}
      </div>`);
  });
}

// ============================================================
// 🔑 Distance point → segment
// ============================================================
function pointToSegmentDist(lat: number, lng: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((lat - ax) ** 2 + (lng - ay) ** 2) * 111320;
  let t = ((lat - ax) * dx + (lng - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((lat - (ax + t * dx)) ** 2 + (lng - (ay + t * dy)) ** 2) * 111320;
}

function findBlockingReports(polyline: [number, number][], reports: Report[], thresholdMeters = 50): Report[] {
  return reports.filter((r) => {
    for (let i = 1; i < polyline.length; i++) {
      if (
        pointToSegmentDist(r.lat, r.lon, polyline[i - 1][0], polyline[i - 1][1], polyline[i][0], polyline[i][1]) <
        thresholdMeters
      )
        return true;
    }
    return false;
  });
}

function buildAvoidPolygon(lat: number, lon: number, sizeMeters = 150): number[][] {
  const latDelta = sizeMeters / 111320;
  const lonDelta = sizeMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - lonDelta, lat - latDelta],
    [lon + lonDelta, lat - latDelta],
    [lon + lonDelta, lat + latDelta],
    [lon - lonDelta, lat + latDelta],
    [lon - lonDelta, lat - latDelta]
  ];
}

// ============================================================
// 🆕 Similarité entre deux polylignes (overlap 0..1)
// ============================================================
function polylineOverlapRatio(
  polyA: [number, number][],
  polyB: [number, number][],
  samplePoints = 24,
  thresholdMeters = 35
): number {
  if (polyA.length < 2 || polyB.length < 2) return 0;
  let overlapCount = 0;
  for (let i = 0; i <= samplePoints; i++) {
    const t = i / samplePoints;
    const idxFloat = t * (polyA.length - 1);
    const idx = Math.min(Math.floor(idxFloat), polyA.length - 2);
    const frac = idxFloat - idx;
    const p: [number, number] = [
      polyA[idx][0] + (polyA[idx + 1][0] - polyA[idx][0]) * frac,
      polyA[idx][1] + (polyA[idx + 1][1] - polyA[idx][1]) * frac
    ];
    let minDist = Infinity;
    for (let j = 1; j < polyB.length; j++) {
      const d = pointToSegmentDist(p[0], p[1], polyB[j - 1][0], polyB[j - 1][1], polyB[j][0], polyB[j][1]);
      if (d < minDist) minDist = d;
      if (minDist < thresholdMeters) break;
    }
    if (minDist < thresholdMeters) overlapCount++;
  }
  return overlapCount / (samplePoints + 1);
}

// ============================================================
// 🆕 Buffer autour d'une polyligne (enveloppe convexe)
// ============================================================
function cross2D(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points.slice();
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross2D(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross2D(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Construit un polygone d'évitement autour d'une polyligne.
 * @param bufferMeters Distance à laquelle la déviation doit rester de la route originale.
 *                     Plus grand = déviation plus éloignée.
 */
function polylineToAvoidPolygon(polyline: [number, number][], bufferMeters = 120): number[][][] {
  if (polyline.length < 2) return [];
  const expanded: [number, number][] = [];
  polyline.forEach((p) => {
    const latDelta = bufferMeters / 111320;
    const lonDelta = bufferMeters / (111320 * Math.cos((p[0] * Math.PI) / 180));
    expanded.push([p[1] - lonDelta, p[0] - latDelta]);
    expanded.push([p[1] + lonDelta, p[0] - latDelta]);
    expanded.push([p[1] + lonDelta, p[0] + latDelta]);
    expanded.push([p[1] - lonDelta, p[0] + latDelta]);
  });
  const hull = convexHull(expanded);
  if (hull.length < 3) return [];
  return [hull];
}

// ============================================================
// 🆕 Overpass : zones bâties à éviter
// ============================================================
interface BuiltUpArea {
  type: 'building' | 'residential' | 'industrial';
  coords: [number, number][];
}

async function fetchBuiltUpAreas(center: [number, number], radiusMeters = 600): Promise<BuiltUpArea[]> {
  const latDelta = radiusMeters / 111320;
  const lonDelta = radiusMeters / (111320 * Math.cos((center[0] * Math.PI) / 180));
  const south = (center[0] - latDelta).toFixed(6);
  const north = (center[0] + latDelta).toFixed(6);
  const west = (center[1] - lonDelta).toFixed(6);
  const east = (center[1] + lonDelta).toFixed(6);

  const query = `[out:json][timeout:25];(way["building"](${south},${west},${north},${east});way["landuse"="residential"](${south},${west},${north},${east});way["landuse"="industrial"](${south},${west},${north},${east}););out geom;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!res.ok) return [];
    const data = await res.json();
    const areas: BuiltUpArea[] = [];
    (data.elements || []).forEach((el: any) => {
      if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
        const ring: [number, number][] = el.geometry.map((g: any) => [g.lat, g.lon] as [number, number]);
        const type =
          el.tags?.landuse === 'residential'
            ? 'residential'
            : el.tags?.landuse === 'industrial'
              ? 'industrial'
              : 'building';
        areas.push({ type, coords: ring });
      }
    });
    return areas;
  } catch {
    return [];
  }
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInBuiltUpArea(point: [number, number], areas: BuiltUpArea[], bufferMeters = 8): boolean {
  if (areas.length === 0) return false;
  for (const area of areas) {
    if (pointInPolygon(point, area.coords)) return true;
  }
  for (const area of areas) {
    for (const vertex of area.coords) {
      const d = haversineMeters(point, vertex);
      if (d < bufferMeters) return true;
    }
  }
  return false;
}

// ============================================================
// 🔑 Distance approximative entre 2 points (mètres)
// ============================================================
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = sinDLat * sinDLat + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

// ============================================================
// 🆕 Détour local "terrain libre" — décalé loin de la route
// ============================================================
function offsetPoint(lat: number, lon: number, bearingRad: number, distMeters: number): [number, number] {
  const R = 6371000;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const angDist = distMeters / R;
  const sinLatRaw = Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearingRad);
  const sinLatClamped = Math.max(-1, Math.min(1, sinLatRaw));
  const lat2 = Math.asin(sinLatClamped);
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );
  const result: [number, number] = [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
  if (Number.isNaN(result[0]) || Number.isNaN(result[1])) {
    return [lat, lon];
  }
  return result;
}

function bearingBetween(a: [number, number], b: [number, number]): number {
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

interface LocalDetourResult {
  polyline: [number, number][];
  distance: number;
}

/**
 * Construit un détour local DÉCALÉ loin de la route originale.
 * Le rayon de contournement est volontairement grand pour que la
 * déviation passe bien à l'écart de la route bloquée.
 */
async function buildLocalDetour(
  polyline: [number, number][],
  blockingReports: Report[],
  builtUpAreas: BuiltUpArea[] = [],
  safetyRadiusMeters = 160,
  arcPoints = 20
): Promise<LocalDetourResult | null> {
  if (polyline.length < 2 || blockingReports.length === 0) return null;

  const dists = polyline.map((p) => {
    let min = Infinity;
    blockingReports.forEach((r) => {
      const d = haversineMeters(p, [r.lat, r.lon]);
      if (d < min) min = d;
    });
    return min;
  });

  let startIdx = -1,
    endIdx = -1;
  for (let i = 0; i < dists.length; i++) {
    if (dists[i] < safetyRadiusMeters) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  }
  if (startIdx === -1) return null;

  // Points d'entrée/sortie plus en amont/aval pour une courbe douce
  const entryIdx = Math.max(0, startIdx - 3);
  const exitIdx = Math.min(polyline.length - 1, endIdx + 3);
  const entryPoint = polyline[entryIdx];
  const exitPoint = polyline[exitIdx];

  const centerLat = blockingReports.reduce((s, r) => s + r.lat, 0) / blockingReports.length;
  const centerLon = blockingReports.reduce((s, r) => s + r.lon, 0) / blockingReports.length;
  const center: [number, number] = [centerLat, centerLon];

  const bearingToEntry = bearingBetween(center, entryPoint);
  const bearingToExit = bearingBetween(center, exitPoint);

  const startAngle = bearingToEntry;
  let diff = bearingToExit - startAngle;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  if (Math.abs(diff) < Math.PI / 2) {
    diff = diff >= 0 ? diff + Math.PI : diff - Math.PI;
  }

  // 🆕 Rayons candidats bien plus grands pour décaler la déviation loin de la route
  // Minimum ~250m, jusqu'à ~500m de la route originale
  const candidateRadii = [
    safetyRadiusMeters * 1.6, // ~256m
    safetyRadiusMeters * 2.1, // ~336m
    safetyRadiusMeters * 2.7, // ~432m
    safetyRadiusMeters * 3.3 // ~528m
  ];

  let bestArc: [number, number][] | null = null;
  let bestScore = Infinity;

  for (const radius of candidateRadii) {
    const arc: [number, number][] = [];
    for (let i = 0; i <= arcPoints; i++) {
      const t = i / arcPoints;
      arc.push(offsetPoint(center[0], center[1], startAngle + diff * t, radius));
    }

    // Score : pénalité pour proximité avec la route originale + zones bâties
    let builtUpHits = 0;
    if (builtUpAreas.length > 0) {
      for (const p of arc) {
        if (isPointInBuiltUpArea(p, builtUpAreas, 15)) builtUpHits++;
      }
    }

    // Vérifier distance minimale à la route originale
    let minDistToOriginal = Infinity;
    for (const arcPt of arc) {
      for (let j = 1; j < polyline.length; j++) {
        const d = pointToSegmentDist(
          arcPt[0],
          arcPt[1],
          polyline[j - 1][0],
          polyline[j - 1][1],
          polyline[j][0],
          polyline[j][1]
        );
        if (d < minDistToOriginal) minDistToOriginal = d;
      }
    }

    // Score combiné : on privilégie un arc loin de la route ET sans bâtiments
    const score = builtUpHits * 1000 - minDistToOriginal;

    if (score < bestScore) {
      bestScore = score;
      bestArc = arc;
      if (builtUpHits === 0 && minDistToOriginal > safetyRadiusMeters * 0.9) break;
    }
  }

  if (!bestArc) return null;

  // Repousser les points qui tombent en zone bâtie
  const safeArc = bestArc.map((p) => {
    if (builtUpAreas.length === 0) return p;
    if (!isPointInBuiltUpArea(p, builtUpAreas, 15)) return p;
    const b = bearingBetween(center, p);
    const currentDist = haversineMeters(center, p);
    return offsetPoint(center[0], center[1], b, currentDist + 80);
  });

  // Sécurité : repousser tout point encore trop proche d'un signalement
  const finalArc = safeArc.map((p) => {
    const nearest = blockingReports.reduce((a, b) =>
      haversineMeters(p, [a.lat, a.lon]) < haversineMeters(p, [b.lat, b.lon]) ? a : b
    );
    const d = haversineMeters(p, [nearest.lat, nearest.lon]);
    if (d >= safetyRadiusMeters * 0.9) return p;
    const b = bearingBetween([nearest.lat, nearest.lon], p);
    return offsetPoint(nearest.lat, nearest.lon, b, safetyRadiusMeters * 1.15);
  });

  const newPolyline: [number, number][] = [
    ...polyline.slice(0, entryIdx + 1),
    ...finalArc,
    ...polyline.slice(exitIdx)
  ].filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

  if (newPolyline.length < 2) return null;

  let distance = 0;
  for (let i = 1; i < newPolyline.length; i++) {
    distance += haversineMeters(newPolyline[i - 1], newPolyline[i]);
  }
  if (!Number.isFinite(distance)) return null;
  return { polyline: newPolyline, distance };
}

// ============================================================
// 🔑 API ORS
// ============================================================
const ORS_API_KEY = (import.meta.env.VITE_ORS_API_KEY as string) || '';

interface ORSFeature {
  type: string;
  properties: {
    segments: { distance: number; duration: number; steps: any[] }[];
    summary?: { distance: number; duration: number };
  };
  geometry: { coordinates: number[][]; type: string };
}
interface ORSResponse {
  type: string;
  features: ORSFeature[];
}

interface AltRoute {
  id: string;
  name: string;
  polyline: [number, number][];
  distance: number;
  duration: number;
  color: string;
  weight: number;
  isAvoidance?: boolean;
  isTerrainLibre?: boolean;
  sourceRouteId?: string;
  sourceRouteName?: string;
}

function orsFetch(body: Record<string, unknown>): Promise<Response> {
  const profileMap: Record<string, string> = {
    voiture: 'driving-car',
    bus: 'driving-hgv',
    moto: 'driving-car',
    velo: 'cycling-regular'
  };
  const orsProfile = profileMap[body.profile as string] || 'driving-car';
  const bodyClean = { ...body };
  delete bodyClean.profile;
  return fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`, {
    method: 'POST',
    headers: {
      Authorization: ORS_API_KEY,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/geo+json'
    },
    body: JSON.stringify(bodyClean)
  });
}

function parseORSResponse(data: ORSResponse, sourceRouteId?: string, sourceRouteName?: string): AltRoute[] {
  if (!data.features || data.features.length === 0) return [];
  const GREENS = ['#16a34a', '#15803d', '#166534', '#4ade80', '#22c55e'];
  return data.features.map((feature, idx) => {
    const coords = feature.geometry.coordinates;
    const polyline: [number, number][] = coords.map((c) => [c[1], c[0]] as [number, number]);
    const segments = feature.properties.segments || [];
    const totalDistance = segments.reduce((s, seg) => s + seg.distance, 0);
    const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
    return {
      id: `ors-${sourceRouteId}-${idx}`,
      name: `Alternative ${idx + 1}`,
      polyline,
      distance: totalDistance || feature.properties.summary?.distance || 0,
      duration: totalDuration || feature.properties.summary?.duration || 0,
      color: GREENS[idx % GREENS.length],
      weight: idx === 0 ? 5 : 3,
      sourceRouteId,
      sourceRouteName
    };
  });
}

/**
 * Récupère des alternatives via ORS.
 * @param forceDeviation Si true, ajoute la route originale comme zone à éviter
 *   (avec un grand buffer) pour forcer ORS à proposer une déviation éloignée.
 */
async function fetchAlternativesForRoute(
  pointA: [number, number],
  pointB: [number, number],
  blockingReports: Report[] | undefined,
  sourceRouteId: string,
  sourceRouteName: string,
  originalPolyline?: [number, number][],
  forceDeviation = false
): Promise<AltRoute[]> {
  if (!ORS_API_KEY) return [];
  try {
    const body: Record<string, unknown> = {
      profile: 'voiture',
      coordinates: [
        [pointA[1], pointA[0]],
        [pointB[1], pointB[0]]
      ],
      format: 'geojson'
    };

    const avoidPolygons: number[][][] = [];

    if (blockingReports && blockingReports.length > 0) {
      const validReports = blockingReports.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
      // 🆕 Zone d'évitement plus grande autour des signalements
      validReports.forEach((r) => avoidPolygons.push(buildAvoidPolygon(r.lat, r.lon, 200)));
    }

    // 🆕 Route originale avec un buffer plus grand pour décaler la déviation
    if (forceDeviation && originalPolyline && originalPolyline.length >= 2) {
      const originalAvoid = polylineToAvoidPolygon(originalPolyline, 150);
      avoidPolygons.push(...originalAvoid);
    }

    if (avoidPolygons.length > 0) {
      body['options'] = {
        avoid_polygons: {
          type: 'MultiPolygon',
          coordinates: avoidPolygons
        }
      };
    } else {
      body['alternative_routes'] = { share_factor: 0.6, target_count: 2 };
    }

    const res = await orsFetch(body);
    if (!res.ok) return [];
    const data: ORSResponse = await res.json();
    let alts = parseORSResponse(data, sourceRouteId, sourceRouteName);

    if (forceDeviation && originalPolyline && originalPolyline.length >= 2) {
      alts = alts.filter((alt) => {
        const overlap = polylineOverlapRatio(alt.polyline, originalPolyline, 24, 40);
        return overlap < 0.65;
      });
    }

    return alts;
  } catch {
    return [];
  }
}

// ============================================================
// 🆕 Construit la route "détour terrain libre" (AltRoute)
// ============================================================
async function buildLocalDetourAltRoute(
  originalPolyline: [number, number][],
  blockingReports: Report[],
  sourceRouteId: string,
  sourceRouteName: string,
  idSuffix = ''
): Promise<AltRoute | null> {
  const centerLat = blockingReports.reduce((s, r) => s + r.lat, 0) / blockingReports.length;
  const centerLon = blockingReports.reduce((s, r) => s + r.lon, 0) / blockingReports.length;
  // 🆕 Rayon de recherche plus grand pour couvrir la zone de déviation éloignée
  const builtUpAreas = await fetchBuiltUpAreas([centerLat, centerLon], 800);

  const detour = await buildLocalDetour(originalPolyline, blockingReports, builtUpAreas);
  if (!detour) return null;

  const hasBuiltUpData = builtUpAreas.length > 0;
  return {
    id: `local-detour-${sourceRouteId}${idSuffix}`,
    name: hasBuiltUpData
      ? '🟢 Détour terrain libre (éloigné, évite les zones bâties)'
      : '🟢 Détour local éloigné (terrain libre estimé)',
    polyline: detour.polyline,
    distance: detour.distance,
    duration: detour.distance / 8.33,
    color: '#16a34a',
    weight: 5,
    isAvoidance: true,
    isTerrainLibre: hasBuiltUpData,
    sourceRouteId,
    sourceRouteName
  };
}

// ============================================================
// 🔑 Dessin routes alternatives globales (vertes)
// ============================================================
function drawInnovativeRoutes(layerGroup: L.LayerGroup, routes: AltRoute[], visible: boolean) {
  layerGroup.clearLayers();
  if (!visible) return;
  routes.forEach((route) => {
    const validPolyline = route.polyline.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (validPolyline.length < 2) return;
    const line = L.polyline(validPolyline, {
      color: route.color,
      weight: route.weight,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '1, 6'
    }).addTo(layerGroup);

    const tagLabel = route.isTerrainLibre
      ? 'Détour terrain libre éloigné (zones bâties évitées via Overpass)'
      : route.isAvoidance
        ? 'Détour local éloigné (sans données ORS)'
        : 'Route innovante proposée par ORS';

    line.bindPopup(
      `<div style="font-family:sans-serif;min-width:170px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <div style="width:10px;height:10px;border-radius:50%;background:${route.color}"></div>
          <strong style="font-size:13px;color:#166534">🟢 ${route.name}</strong>
        </div>
        <div style="font-size:11px;color:#374151;margin-bottom:4px">
          Route source : <em>${route.sourceRouteName || '—'}</em>
        </div>
        <div style="display:flex;gap:10px;font-size:12px;color:#4b5563">
          <span>📏 ${(route.distance / 1000).toFixed(1)} km</span>
          <span>⏱ ${Math.round(route.duration / 60)} min</span>
        </div>
        <div style="margin-top:6px;font-size:10px;color:#6b7280">
          ${tagLabel}
        </div>
      </div>`
    );
  });
}

// ============================================================
// 🔑 Dessin routes alternatives au clic
// ============================================================
function drawAltRoutes(layerGroup: L.LayerGroup, routes: AltRoute[], selectedId: string | null) {
  layerGroup.clearLayers();
  routes.forEach((route) => {
    const validPolyline = route.polyline.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (validPolyline.length < 2) return;
    const isSelected = route.id === selectedId;
    L.polyline(validPolyline, {
      color: route.color,
      weight: isSelected ? route.weight + 2 : route.weight,
      opacity: isSelected ? 1 : 0.7,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: isSelected ? undefined : '8, 6'
    })
      .addTo(layerGroup)
      .bindPopup(
        `<strong>${route.name}</strong><br/>${(route.distance / 1000).toFixed(1)} km • ${Math.round(route.duration / 60)} min${route.isTerrainLibre ? '<br/><em style="font-size:10px;color:#16a34a">✓ Zones bâties évitées</em>' : ''}`
      );
  });
}

// ============================================================
// 🔑 Résultat de l'analyse globale
// ============================================================
interface AnalysisResult {
  routeId: string;
  routeName: string;
  alternatives: AltRoute[];
  hasBlocking: boolean;
}

// ============================================================
// 🔑 Composant principal
// ============================================================
export default function CartePage() {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null);
  const roadsLayerRef = useRef<L.LayerGroup | null>(null);
  const reportsLayerRef = useRef<L.LayerGroup | null>(null);
  const altRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const innovativeLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedRoadPolylineRef = useRef<L.Polyline | null>(null);
  const analyzeAbortRef = useRef<boolean>(false);

  const { geoJSON, loading: roadsLoading, load: loadRoutes } = useRoadsStore();
  const { reports, load: loadReports } = useReportsStore();

  const [selectedRoute, setSelectedRoute] = useState<DisplayRoute | null>(null);
  const [blockingReports, setBlockingReports] = useState<Report[]>([]);
  const [altRoutes, setAltRoutes] = useState<AltRoute[]>([]);
  const [selectedAltId, setSelectedAltId] = useState<string | null>(null);
  const [loadingAlt, setLoadingAlt] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);
  const [roadCount, setRoadCount] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [innovativeRoutes, setInnovativeRoutes] = useState<AltRoute[]>([]);
  const [showInnovative, setShowInnovative] = useState(true);
  const [selectedResultRoute, setSelectedResultRoute] = useState<AnalysisResult | null>(null);

  const displayRoutesRef = useRef<DisplayRoute[]>([]);

  useEffect(() => {
    loadRoutes();
    loadReports();
  }, [loadRoutes, loadReports]);

  const initMap = useCallback(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView([-21.45249, 47.085447], 14);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    boundaryLayerRef.current = L.layerGroup().addTo(map);
    roadsLayerRef.current = L.layerGroup().addTo(map);
    reportsLayerRef.current = L.layerGroup().addTo(map);
    innovativeLayerRef.current = L.layerGroup().addTo(map);
    altRoutesLayerRef.current = L.layerGroup().addTo(map);
    drawBoundary(boundaryLayerRef.current, boundaryData as OverpassResponse);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cleanup = initMap();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [initMap]);

  const drawRoutesInteractive = useCallback((routes: DisplayRoute[]) => {
    if (!roadsLayerRef.current || !mapRef.current) return;
    roadsLayerRef.current.clearLayers();
    displayRoutesRef.current = routes;

    routes.forEach((route) => {
      const line = L.polyline(route.polyline, {
        color: route.color,
        weight: route.weight,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(roadsLayerRef.current!);

      line.on('click', () => {
        if (selectedRoadPolylineRef.current) {
          selectedRoadPolylineRef.current.setStyle({ opacity: 0.6 });
        }
        line.setStyle({ weight: route.weight + 3, opacity: 1 });
        selectedRoadPolylineRef.current = line;
        setSelectedRoute(route);
        setAltRoutes([]);
        setSelectedAltId(null);
        setAltError(null);
        setSelectedResultRoute(null);
      });

      line.bindTooltip(route.name, { sticky: true });
    });
  }, []);

  useEffect(() => {
    if (!geoJSON || !mapRef.current) return;
    const routes = geoJSONToDisplayRoutes(geoJSON);
    setRoadCount(routes.length);
    drawRoutesInteractive(routes);
  }, [geoJSON, drawRoutesInteractive]);

  useEffect(() => {
    if (reportsLayerRef.current) drawReports(reportsLayerRef.current, reports);
  }, [reports]);

  useEffect(() => {
    if (!selectedRoute) return;
    const polyline = selectedRoute.polyline;
    if (polyline.length < 2) return;

    let cancelled = false;
    const blocking = findBlockingReports(polyline, reports);
    setBlockingReports(blocking);
    const pointA = polyline[0];
    const pointB = polyline[polyline.length - 1];
    setLoadingAlt(true);
    setAltError(null);
    setAltRoutes([]);

    (async () => {
      const isBlocked = blocking.length > 0;
      const routes = await fetchAlternativesForRoute(
        pointA,
        pointB,
        isBlocked ? blocking : undefined,
        selectedRoute.id,
        selectedRoute.name,
        isBlocked ? polyline : undefined,
        isBlocked
      );

      if (cancelled) return;
      setLoadingAlt(false);

      if (routes.length === 0 && isBlocked) {
        const detourRoute = await buildLocalDetourAltRoute(polyline, blocking, selectedRoute.id, selectedRoute.name);
        if (cancelled) return;
        if (detourRoute) {
          setAltRoutes([detourRoute]);
          setSelectedAltId(detourRoute.id);
          setAltError(null);
          return;
        }
      }

      if (routes.length === 0) {
        setAltError(
          !ORS_API_KEY
            ? 'Clé API ORS manquante (VITE_ORS_API_KEY)'
            : 'Aucune déviation trouvée (la route originale est évitée pour garantir une vraie alternative)'
        );
        return;
      }
      setAltRoutes(routes);
      setSelectedAltId(routes[0].id);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute, reports]);

  useEffect(() => {
    if (!altRoutesLayerRef.current) return;
    drawAltRoutes(altRoutesLayerRef.current, altRoutes, selectedAltId);
  }, [altRoutes, selectedAltId]);

  useEffect(() => {
    if (!innovativeLayerRef.current) return;
    drawInnovativeRoutes(innovativeLayerRef.current, innovativeRoutes, showInnovative);
  }, [innovativeRoutes, showInnovative]);

  const analyzeAllRoutes = useCallback(async () => {
    const routes = displayRoutesRef.current;
    if (routes.length === 0 || analyzing) return;
    if (!ORS_API_KEY) {
      alert('Clé API ORS manquante (VITE_ORS_API_KEY dans .env)');
      return;
    }

    analyzeAbortRef.current = false;
    setAnalyzing(true);
    setAnalysisDone(false);
    setAnalysisResults([]);
    setInnovativeRoutes([]);
    setSelectedResultRoute(null);

    const eligibleRoutes = routes.filter((r) => {
      if (r.polyline.length < 2) return false;
      const dist = haversineMeters(r.polyline[0], r.polyline[r.polyline.length - 1]);
      return dist > 150;
    });

    setAnalyzeProgress({ current: 0, total: eligibleRoutes.length });

    const DELAY_MS = 1600;
    const results: AnalysisResult[] = [];
    const allInnovative: AltRoute[] = [];

    for (let i = 0; i < eligibleRoutes.length; i++) {
      if (analyzeAbortRef.current) break;

      const route = eligibleRoutes[i];
      const blocking = findBlockingReports(route.polyline, reports);
      const pointA = route.polyline[0];
      const pointB = route.polyline[route.polyline.length - 1];

      if (blocking.length === 0) {
        const alts = await fetchAlternativesForRoute(pointA, pointB, undefined, route.id, route.name);
        const innovative = alts.slice(1);
        if (innovative.length > 0) {
          results.push({
            routeId: route.id,
            routeName: route.name,
            alternatives: innovative,
            hasBlocking: false
          });
          allInnovative.push(
            ...innovative.map((a, idx) => ({
              ...a,
              id: `innov-${route.id}-${idx}`,
              color: pickGreen(results.length)
            }))
          );
          setInnovativeRoutes([...allInnovative]);
        }
      } else {
        const deviations = await fetchAlternativesForRoute(
          pointA,
          pointB,
          blocking,
          route.id,
          route.name,
          route.polyline,
          true
        );
        let finalDeviations = deviations;

        if (finalDeviations.length === 0) {
          const detourRoute = await buildLocalDetourAltRoute(route.polyline, blocking, route.id, route.name);
          if (detourRoute) finalDeviations = [detourRoute];
        }

        if (finalDeviations.length > 0) {
          results.push({
            routeId: route.id,
            routeName: route.name,
            alternatives: finalDeviations,
            hasBlocking: true
          });
          allInnovative.push(
            ...finalDeviations.map((a, idx) => ({
              ...a,
              id: `innov-${route.id}-dev-${idx}`,
              color: a.isAvoidance ? '#16a34a' : '#06b6d4'
            }))
          );
          setInnovativeRoutes([...allInnovative]);
        }
      }

      setAnalyzeProgress({ current: i + 1, total: eligibleRoutes.length });
      setAnalysisResults([...results]);

      if (i < eligibleRoutes.length - 1 && !analyzeAbortRef.current) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    setAnalyzing(false);
    setAnalysisDone(true);
  }, [analyzing, reports]);

  function pickGreen(index: number): string {
    const greens = ['#16a34a', '#15803d', '#4ade80', '#86efac', '#22c55e', '#166534', '#dcfce7'];
    return greens[index % greens.length];
  }

  const stopAnalysis = () => {
    analyzeAbortRef.current = true;
    setAnalyzing(false);
    setAnalysisDone(true);
  };

  const resetAnalysis = () => {
    analyzeAbortRef.current = true;
    setAnalyzing(false);
    setAnalysisDone(false);
    setAnalysisResults([]);
    setInnovativeRoutes([]);
    setSelectedResultRoute(null);
    if (innovativeLayerRef.current) innovativeLayerRef.current.clearLayers();
  };

  const closePanel = () => {
    setSelectedRoute(null);
    setAltRoutes([]);
    setAltError(null);
    setBlockingReports([]);
    if (selectedRoadPolylineRef.current) {
      selectedRoadPolylineRef.current.setStyle({ opacity: 0.6 });
      selectedRoadPolylineRef.current = null;
    }
    if (altRoutesLayerRef.current) altRoutesLayerRef.current.clearLayers();
  };

  const focusOnResult = (result: AnalysisResult) => {
    setSelectedResultRoute(result);
    if (!mapRef.current || result.alternatives.length === 0) return;
    const allCoords: [number, number][] = [];
    result.alternatives.forEach((a) => allCoords.push(...a.polyline));
    if (allCoords.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(allCoords).pad(0.2));
    }
  };

  const progressPct =
    analyzeProgress.total > 0 ? Math.round((analyzeProgress.current / analyzeProgress.total) * 100) : 0;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Carte routière — Fianarantsoa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cliquez sur une route ou lancez l'analyse globale pour découvrir toutes les alternatives (déviation éloignée
            sur terrain libre)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {roadsLoading && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              <Loader2 size={14} className="animate-spin" />
              Chargement...
            </div>
          )}
          {!analyzing && !analysisDone && (
            <button
              onClick={analyzeAllRoutes}
              disabled={roadsLoading || displayRoutesRef.current.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg shadow transition-all"
            >
              <Sparkles size={15} />
              Analyser toutes les routes
            </button>
          )}
          {analyzing && (
            <button
              onClick={stopAnalysis}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg shadow transition-all"
            >
              <X size={14} />
              Arrêter
            </button>
          )}
          {analysisDone && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInnovative((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                  showInnovative
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                {showInnovative ? <Eye size={14} /> : <EyeOff size={14} />}
                {showInnovative ? 'Masquer' : 'Afficher'} routes innovantes
              </button>
              <button
                onClick={resetAnalysis}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                <RotateCcw size={14} />
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </div>

      {(analyzing || (analysisDone && analysisResults.length > 0)) && (
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {analyzing ? (
                <Loader2 size={15} className="animate-spin text-emerald-600" />
              ) : (
                <CheckCircle2 size={15} className="text-emerald-600" />
              )}
              <span className="text-sm font-semibold text-gray-800">
                {analyzing
                  ? `Analyse en cours… ${analyzeProgress.current}/${analyzeProgress.total} routes`
                  : `✅ Analyse terminée — ${analysisResults.length} routes avec alternatives trouvées`}
              </span>
            </div>
            {analyzing && <span className="text-sm font-bold text-emerald-600">{progressPct}%</span>}
          </div>
          {analyzing && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
          {!analyzing && analysisDone && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-emerald-700">{innovativeRoutes.length}</p>
                <p className="text-[10px] text-emerald-600">Routes innovantes</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-blue-700">
                  {analysisResults.filter((r) => !r.hasBlocking).length}
                </p>
                <p className="text-[10px] text-blue-600">Alternatives libres</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-red-700">{analysisResults.filter((r) => r.hasBlocking).length}</p>
                <p className="text-[10px] text-red-600">Déviations éloignées</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_300px] gap-3 flex-1 min-h-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[400px] lg:min-h-0">
          <div ref={mapElRef} className="flex-1 z-10" />
        </div>

        <aside className="flex flex-col gap-3 overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Ville</p>
            <h2 className="text-lg font-bold text-gray-800">Fianarantsoa</h2>
            <p className="text-xs text-gray-500">Haute Matsiatra, Madagascar</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-gray-400 text-[10px] mb-0.5">Routes</p>
                <p className="font-bold text-gray-700">{roadCount}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-gray-400 text-[10px] mb-0.5">Signalements</p>
                <p className="font-bold text-gray-700">{reports.length}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-emerald-600 text-[10px] mb-0.5">Alternatives</p>
                <p className="font-bold text-emerald-700">{innovativeRoutes.length}</p>
              </div>
            </div>
          </div>

          {analysisDone && analysisResults.length > 0 && (
            <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-emerald-600" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                  Routes innovantes ({analysisResults.length})
                </p>
              </div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {analysisResults.map((result) => (
                  <button
                    key={result.routeId}
                    onClick={() => focusOnResult(result)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                      selectedResultRoute?.routeId === result.routeId
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        {result.hasBlocking ? (
                          <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                        ) : (
                          <Zap size={11} className="text-emerald-500 flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-medium text-gray-700 truncate max-w-[140px]">
                          {result.routeName}
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                        +{result.alternatives.length}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedRoute && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedRoute.color }}
                  />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{selectedRoute.name}</p>
                    <p className="text-[11px] text-gray-500 capitalize">{selectedRoute.type}</p>
                  </div>
                </div>
                <button
                  onClick={closePanel}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1"
                >
                  <X size={14} />
                </button>
              </div>

              {blockingReports.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={13} className="text-red-500" />
                    <p className="text-xs font-semibold text-red-700">
                      {blockingReports.length} signalement(s) bloquant(s)
                    </p>
                  </div>
                  {blockingReports.map((r) => (
                    <div key={r.id} className="text-[11px] text-red-600 flex items-center gap-1">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getSeverityColor(r.severity) }}
                      />
                      {r.type} — {r.lanesBlocked > 0 ? `${r.lanesBlocked} voie(s) bloquée(s)` : r.severity}
                    </div>
                  ))}
                  <p className="text-[10px] text-red-700 mt-2 italic">
                    🔎 Recherche d'une déviation <strong>éloignée</strong> sur terrain libre...
                  </p>
                </div>
              )}

              {blockingReports.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2">
                  <Navigation size={13} className="text-emerald-600" />
                  <p className="text-xs text-emerald-700 font-medium">Route libre — Alternatives ORS ci-dessous</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Route size={13} className="text-indigo-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {blockingReports.length > 0 ? 'Déviations éloignées (terrain libre)' : 'Alternatives'}
                  </p>
                </div>
                {loadingAlt && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                    <Loader2 size={13} className="animate-spin text-indigo-500" />
                    {blockingReports.length > 0
                      ? 'Recherche de terrain libre éloigné (Overpass + ORS)...'
                      : 'Recherche via OpenRouteService...'}
                  </div>
                )}
                {altError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                    {altError}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {altRoutes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedAltId(route.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                        selectedAltId === route.id
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: route.color }}
                          />
                          <span className="text-xs font-semibold text-gray-700">{route.name}</span>
                        </div>
                        <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                      </div>
                      <div className="flex gap-3 mt-1 ml-4 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Ruler size={10} />
                          {(route.distance / 1000).toFixed(1)} km
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Clock size={10} />
                          {Math.round(route.duration / 60)} min
                        </span>
                        {route.isTerrainLibre && (
                          <span className="text-[10px] text-emerald-600 font-medium">✓ zones bâties évitées</span>
                        )}
                        {route.isAvoidance && !route.isTerrainLibre && (
                          <span className="text-[10px] text-emerald-600 font-medium">détour éloigné</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Légende</p>
            <div className="flex flex-col gap-1.5">
              {[
                { color: '#dc2626', label: 'Route nationale' },
                { color: '#f59e0b', label: 'Route secondaire' },
                { color: '#10b981', label: 'Route tertiaire' },
                { color: '#6366f1', label: 'Rue résidentielle' },
                { color: '#1e40af', label: 'Limite Fianarantsoa' }
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div
                    className="w-5 h-1 rounded-full bg-emerald-500"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg,#16a34a 0,#16a34a 4px,transparent 4px,transparent 10px)'
                    }}
                  />
                  <span className="font-medium text-emerald-700">🟢 Déviation éloignée (terrain libre)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-5 h-0.5 bg-cyan-400 rounded-full" />
                  <span>Déviation ORS (route bloquée)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-4 h-4 rounded-full border-2 border-red-500 flex-shrink-0" />
                  <span>Signalement bloquant</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-800">
                Quand une route est bloquée, la déviation est tracée <strong>à bonne distance</strong> de la route
                originale (buffer ~150m côté ORS, arc de contournement à ~250-500m côté détour local). Les bâtiments et
                zones résidentielles sont évités via Overpass pour passer sur des{' '}
                <strong>terres libres sans maison</strong>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
