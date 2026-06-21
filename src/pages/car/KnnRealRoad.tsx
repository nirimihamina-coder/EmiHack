import { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number; }
interface ApiRoute { id: string; name: string; coordinates: [number, number][]; }
interface LocalRoute { id: string; name: string; points: Vec2[]; }
interface MergedNetwork {
  allPoints: Vec2[]; segments: Vec2[][]; intersections: Vec2[]; chains: Vec2[][];
  nodeAdj: Map<string, Set<string>>; nodePos: Map<string, Vec2>;
}
interface CarState {
  id: number; x: number; y: number; angle: number; vitesse: number;
  alive: boolean; score: number; sensors: number[]; stuckFrames: number;
  lastX: number; lastY: number; coverage: number;
}
interface KnnResult { targetX: number; targetY: number; speedFactor: number; neighbors: Vec2[]; }
interface RoadCodeStatus { conforme: boolean; vitesseMax: number; raison: string; }

interface TrainingSample {
  sensors: number[]; kValue: number; speedFactor: number; angleDiff: number;
  score: number; alive: boolean;
  context: 'straight' | 'intersection' | 'turn' | 'stuck' | 'danger';
}

interface KNNModel {
  id: string; name: string; timestamp: string;
  samples: TrainingSample[];
  metadata: {
    totalSamples: number; avgScore: number; bestScore: number;
    routesCount: number; intersectionsCount: number; trainingDuration: number;
  };
}

interface InferenceResult { speedFactor: number; angleDiff: number; confidence: number; }

interface SavedModel {
  id: string; name: string; timestamp: string;
  score: number; distance: number; coverage: number;
  totalIntersections: number; kValue: number;
  carData: { x: number; y: number; angle: number; vitesse: number; };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ══ CONSTANTES ════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

const ROAD_WIDTH_METERS = 10;
const ROAD_VISUAL_FACTOR = 1.8;
const CAR_LENGTH_METERS = 0.005;
const CAR_WIDTH_METERS = 0.004;
const NUM_SENSORS = 7;
const SENSOR_ANGLES = [-0.9, -0.5, -0.22, 0, 0.22, 0.5, 0.9];
const MAX_SPEED = 5;
const MIN_SPEED = 1.5;
const ACCEL_FACTOR = 0.08;
const STEER_FACTOR = 0.18;
const INTERSECTION_TOLERANCE = 0.00035;
const OSM_ZOOM = 17;
const LOOK_AHEAD_MIN = 35;
const ANTI_STUCK_FRAMES = 25;
const SPEED_LIMIT_KMH = 50;
const INTERSECTION_SLOWDOWN_RADIUS = 55;
const INTERSECTION_STOP_RADIUS = 22;
const SAFE_DISTANCE_FACTOR = 0.35;
const SENSOR_LENGTH_METERS = 28;
const RESPAWN_DELAY = 1500;
const MODEL_STORAGE_KEY = 'knn_road_models';
const KNN_MODEL_STORAGE_KEY = 'knn_brain_models';
const MIN_SAMPLES_FOR_INFERENCE = 20;

const WALL_THRESHOLD = 0.30;
const OPEN_THRESHOLD = 0.55;
const CURVE_THRESHOLD = 0.40;
const EMERGENCY_STOP = 0.12;

const MOCK_ROUTES: ApiRoute[] = [
  { id: 'mock-1', name: 'Route Nord-Sud', coordinates: [[47.080,-21.440],[47.082,-21.445],[47.084,-21.450],[47.085,-21.455],[47.085,-21.460],[47.086,-21.465],[47.087,-21.470],[47.088,-21.475]] },
  { id: 'mock-2', name: 'Route Est-Ouest', coordinates: [[47.070,-21.452],[47.073,-21.453],[47.076,-21.454],[47.079,-21.454],[47.082,-21.454],[47.085,-21.455],[47.088,-21.456],[47.091,-21.457],[47.094,-21.458]] },
];

//  Classe KNNBrain ──────────────────────────────────────────────────────────
class KNNBrain {
  private samples: TrainingSample[] = [];
  private isTraining: boolean = false;
  
  constructor(initialSamples: TrainingSample[] = []) { this.samples = initialSamples; }

  startTraining() { this.isTraining = true; }
  stopTraining() { this.isTraining = false; }
  getIsTraining() { return this.isTraining; }
  getSampleCount() { return this.samples.length; }
  getSamples() { return this.samples; }
  clear() { this.samples = []; }

  recordSample(sample: TrainingSample) {
    if (!this.isTraining) return;
    this.samples.push(sample);
    if (this.samples.length > 8000) this.samples = this.samples.slice(-6000);
  }

  predict(sensors: number[], k: number, currentContext: TrainingSample['context']): InferenceResult {
    if (this.samples.length < MIN_SAMPLES_FOR_INFERENCE) {
      return { speedFactor: 0.5, angleDiff: 0, confidence: 0 };
    }

    // ═══ ÉTAPE 2 : Calcul de la distance euclidienne ═══
    // d(x,y) = √Σ(xᵢ - y)²
    const distances = this.samples.map((s, idx) => ({
      idx,
      dist: Math.sqrt(s.sensors.reduce((sum, val, i) => sum + (val - sensors[i]) ** 2, 0)),
      context: s.context
    }));

    // ═══ ÉTAPE 3 : Trouver les K plus proches voisins ═══
    const sameContext = distances.filter(d => d.context === currentContext);
    const candidates = sameContext.length >= k ? sameContext : distances;
    candidates.sort((a, b) => a.dist - b.dist);
    const neighbors = candidates.slice(0, Math.min(k, candidates.length));

    if (neighbors.length === 0) return { speedFactor: 0.5, angleDiff: 0, confidence: 0 };

    // ═══ ÉTAPE 4 : Décision finale (régression pondérée) ═══
    // ŷ = (1/K) Σ yᵢ pondéré par l'inverse de la distance
    let totalWeight = 0, weightedSpeed = 0, weightedAngle = 0;
    for (const n of neighbors) {
      const sample = this.samples[n.idx];
      const weight = 1 / (n.dist + 0.001);
      const survivalBonus = sample.alive ? 2.0 : 0.5;
      const scoreBonus = Math.max(0.1, sample.score / 1000);
      const finalWeight = weight * survivalBonus * scoreBonus;
      weightedSpeed += sample.speedFactor * finalWeight;
      weightedAngle += sample.angleDiff * finalWeight;
      totalWeight += finalWeight;
    }

    const avgDist = neighbors.reduce((a, n) => a + n.dist, 0) / neighbors.length;
    const confidence = Math.max(0, 1 - avgDist * 2);

    return {
      speedFactor: weightedSpeed / totalWeight,
      angleDiff: weightedAngle / totalWeight,
      confidence
    };
  }

  exportModel(name: string, metadata: KNNModel['metadata']): KNNModel {
    return {
      id: `knn_${Date.now()}`, name, timestamp: new Date().toISOString(),
      samples: [...this.samples], metadata
    };
  }

  static importModel(model: KNNModel): KNNBrain {
    return new KNNBrain(model.samples);
  }
}

// ── Projection ────────────────────────────────────────────────────────────────
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const tx = Math.floor(((lng + 180) / 360) * n);
  const latRad = lat * Math.PI / 180;
  const ty = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { tx, ty };
}
function latLngToMercPixel(lat: number, lng: number, zoom: number) {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}
function getMetersPerPixel(lat: number, zoom: number) {
  return (Math.cos(lat * Math.PI / 180) * 2 * Math.PI * 6378137) / (256 * Math.pow(2, zoom));
}

const tileCache = new Map<string, HTMLImageElement>();
const tileLoading = new Set<string>();

function loadTile(tx: number, ty: number, zoom: number): HTMLImageElement | null {
  const key = `${zoom}/${tx}/${ty}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  if (tileLoading.has(key)) return null;
  tileLoading.add(key);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
  img.onload = () => { if (img.width > 0) tileCache.set(key, img); tileLoading.delete(key); };
  img.onerror = () => { tileLoading.delete(key); };
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) { clearTimeout(timer); throw e; }
}

function dist2D(a: Vec2, b: Vec2) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

function mergeRoutesAtIntersections(routes: LocalRoute[], tolerance: number): MergedNetwork {
  const grid = tolerance;
  const nodePos = new Map<string, Vec2>();
  const nodeKey = (p: Vec2) => `${Math.round(p.x / grid)}_${Math.round(p.y / grid)}`;
  const getOrCreateNode = (p: Vec2) => {
    const k = nodeKey(p);
    if (!nodePos.has(k)) nodePos.set(k, { x: p.x, y: p.y });
    else { const e = nodePos.get(k)!; e.x = (e.x + p.x) / 2; e.y = (e.y + p.y) / 2; }
    return k;
  };
  const nodeSequences: string[][] = [];
  for (const route of routes) {
    const seq: string[] = [];
    for (const p of route.points) seq.push(getOrCreateNode(p));
    nodeSequences.push(seq);
  }
  const nodeAdj = new Map<string, Set<string>>();
  const edgeSet = new Set<string>();
  const segments: Vec2[][] = [];
  const intersections: Vec2[] = [];
  const allPoints: Vec2[] = [];
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (edgeSet.has(ek)) return;
    edgeSet.add(ek);
    if (!nodeAdj.has(a)) nodeAdj.set(a, new Set());
    if (!nodeAdj.has(b)) nodeAdj.set(b, new Set());
    nodeAdj.get(a)!.add(b); nodeAdj.get(b)!.add(a);
  };
  for (const seq of nodeSequences) {
    const uniqueSeq: string[] = []; let last = '';
    for (const k of seq) { if (k !== last) { uniqueSeq.push(k); last = k; } }
    if (uniqueSeq.length < 2) continue;
    const segPoints = uniqueSeq.map((k) => nodePos.get(k)!);
    segments.push(segPoints); allPoints.push(...segPoints);
    for (let i = 0; i < uniqueSeq.length - 1; i++) addEdge(uniqueSeq[i], uniqueSeq[i + 1]);
  }
  for (const [k, neighbors] of nodeAdj) { if (neighbors.size > 2) intersections.push(nodePos.get(k)!); }
  const visitedEdges = new Set<string>();
  const chains: Vec2[][] = [];
  const ek = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const traceChain = (start: string, firstNeighbor: string): Vec2[] => {
    const chain = [nodePos.get(start)!];
    let curr = firstNeighbor;
    visitedEdges.add(ek(start, firstNeighbor));
    chain.push(nodePos.get(curr)!);
    while (true) {
      const neighbors = nodeAdj.get(curr);
      if (!neighbors) break;
      let nextKey: string | null = null;
      for (const n of neighbors) { if (!visitedEdges.has(ek(curr, n))) { nextKey = n; break; } }
      if (!nextKey) break;
      visitedEdges.add(ek(curr, nextKey));
      chain.push(nodePos.get(nextKey)!);
      const degree = nodeAdj.get(nextKey)?.size ?? 0;
      curr = nextKey;
      if (degree > 2) break;
    }
    return chain;
  };
  for (const [k, neighbors] of nodeAdj) {
    const degree = neighbors.size;
    if (degree === 1 || degree > 2) {
      for (const neighbor of neighbors) {
        if (!visitedEdges.has(ek(k, neighbor))) chains.push(traceChain(k, neighbor));
      }
    }
  }
  for (const [k, neighbors] of nodeAdj) {
    for (const neighbor of neighbors) {
      if (!visitedEdges.has(ek(k, neighbor))) chains.push(traceChain(k, neighbor));
    }
  }
  return { allPoints, segments, intersections, chains, nodeAdj, nodePos };
}

class SpatialGrid {
  grid: Map<string, {
    leftSegments: { a: Vec2; b: Vec2 }[];
    rightSegments: { a: Vec2; b: Vec2 }[];
    points: Vec2[];
    roadSegments: { a: Vec2; b: Vec2 }[];
  }> = new Map();

  constructor(smoothBorders: { left: Vec2[]; right: Vec2[] }[], allPoints: Vec2[], roadChains: Vec2[][]) {
    const getKeysForSegment = (a: Vec2, b: Vec2) => {
      const keys = new Set<string>();
      const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
      const startCellX = Math.floor(minX / 300), endCellX = Math.floor(maxX / 300);
      const startCellY = Math.floor(minY / 300), endCellY = Math.floor(maxY / 300);
      for (let cx = startCellX; cx <= endCellX; cx++) {
        for (let cy = startCellY; cy <= endCellY; cy++) keys.add(`${cx}_${cy}`);
      }
      return Array.from(keys);
    };

    const getCell = (key: string) => {
      let cell = this.grid.get(key);
      if (!cell) { cell = { leftSegments: [], rightSegments: [], points: [], roadSegments: [] }; this.grid.set(key, cell); }
      return cell;
    };

    for (const chain of smoothBorders) {
      for (let i = 0; i < chain.left.length - 1; i++) {
        const a = chain.left[i], b = chain.left[i + 1];
        for (const k of getKeysForSegment(a, b)) getCell(k).leftSegments.push({ a, b });
      }
      for (let i = 0; i < chain.right.length - 1; i++) {
        const a = chain.right[i], b = chain.right[i + 1];
        for (const k of getKeysForSegment(a, b)) getCell(k).rightSegments.push({ a, b });
      }
    }

    for (const p of allPoints) {
      const key = `${Math.floor(p.x / 300)}_${Math.floor(p.y / 300)}`;
      getCell(key).points.push(p);
    }

    for (const chain of roadChains) {
      for (let i = 0; i < chain.length - 1; i++) {
        const a = chain[i], b = chain[i + 1];
        for (const k of getKeysForSegment(a, b)) getCell(k).roadSegments.push({ a, b });
      }
    }
  }

  query(x: number, y: number) {
    const cx = Math.floor(x / 300), cy = Math.floor(y / 300);
    const leftSegments: { a: Vec2; b: Vec2 }[] = [];
    const rightSegments: { a: Vec2; b: Vec2 }[] = [];
    const points: Vec2[] = [];
    const roadSegments: { a: Vec2; b: Vec2 }[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = this.grid.get(`${cx + dx}_${cy + dy}`);
        if (cell) {
          leftSegments.push(...cell.leftSegments);
          rightSegments.push(...cell.rightSegments);
          points.push(...cell.points);
          roadSegments.push(...cell.roadSegments);
        }
      }
    }
    return { leftSegments, rightSegments, points, roadSegments };
  }
}

function knnOnWaypoints(car: CarState, network: MergedNetwork, k: number, localPoints: Vec2[]): KnnResult {
  const fwdX = Math.cos(car.angle), fwdY = Math.sin(car.angle);
  const NEAR_IX_DIST = 30;
  let nearIntersectionKey: string | null = null;
  for (const [key, pos] of network.nodePos) {
    if (dist2D({ x: car.x, y: car.y }, pos) < NEAR_IX_DIST) {
      const adj = network.nodeAdj.get(key);
      if (adj && adj.size > 2) { nearIntersectionKey = key; break; }
    }
  }
  if (nearIntersectionKey) {
    const neighbors = network.nodeAdj.get(nearIntersectionKey);
    if (neighbors && neighbors.size >= 2) {
      let bestScore = -Infinity, bestTargetX = car.x + fwdX * 40, bestTargetY = car.y + fwdY * 40, bestSpeedFactor = 0.5;
      for (const neighborKey of neighbors) {
        const branchTarget = network.nodePos.get(neighborKey);
        if (!branchTarget) continue;
        const bdx = branchTarget.x - car.x, bdy = branchTarget.y - car.y;
        const bDist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bDist < 1) continue;
        const alignment = (bdx * fwdX + bdy * fwdY) / bDist;
        let branchWaypoints = 0, branchWeightX = 0, branchWeightY = 0, branchTotalWeight = 0;
        const branchDirection = { x: bdx / bDist, y: bdy / bDist };
        for (const p of localPoints) {
          const pdx = p.x - car.x, pdy = p.y - car.y;
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pDist < 5 || pDist > 200) continue;
          const pAlign = (pdx * branchDirection.x + pdy * branchDirection.y) / pDist;
          if (pAlign > 0.3) {
            branchWaypoints++;
            const w = 1 / (pDist + 1e-6);
            branchWeightX += p.x * w; branchWeightY += p.y * w; branchTotalWeight += w;
          }
        }
        const score = alignment * 0.6 + Math.min(1, branchWaypoints / 10) * 0.4;
        if (score > bestScore && branchTotalWeight > 0) {
          bestScore = score;
          bestTargetX = branchWeightX / branchTotalWeight;
          bestTargetY = branchWeightY / branchTotalWeight;
          bestSpeedFactor = Math.max(0.2, Math.min(0.7, branchWaypoints / 15));
        }
      }
      return { targetX: bestTargetX, targetY: bestTargetY, speedFactor: bestSpeedFactor, neighbors: [] };
    }
  }
  
  const scored = localPoints.map((p) => {
    const dx = p.x - car.x, dy = p.y - car.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const forwardDot = dx * fwdX + dy * fwdY;
    return { point: p, dist, forwardDot };
  });
  
  let candidates = scored.filter((s) => s.forwardDot > -0.1 && s.dist > LOOK_AHEAD_MIN);
  if (candidates.length < 3) candidates = scored.filter((s) => s.dist > 5);
  if (candidates.length < 3) candidates = scored;
  
  const maxDist = Math.max(...candidates.map((c) => c.dist), 1);
  const normalized = candidates.map((c) => ({ 
    ...c, normDist: c.dist / maxDist, normForward: (c.forwardDot + maxDist) / (2 * maxDist)
  }));
  
  normalized.sort((a, b) => {
    const scoreA = a.normDist * 0.6 - a.normForward * 0.4;
    const scoreB = b.normDist * 0.6 - b.normForward * 0.4;
    return scoreA - scoreB;
  });
  
  const knnNeighbors = normalized.slice(0, Math.max(3, k));
  let totalWeight = 0, targetX = 0, targetY = 0;
  for (const n of knnNeighbors) {
    const w = 1 / (n.dist + 1e-6);
    totalWeight += w; targetX += n.point.x * w; targetY += n.point.y * w;
  }
  targetX /= totalWeight; targetY /= totalWeight;
  
  const avgDist = knnNeighbors.reduce((a, n) => a + n.dist, 0) / knnNeighbors.length;
  const speedFactor = Math.max(0.1, Math.min(1, 1 - avgDist * 0.12));
  
  return { targetX, targetY, speedFactor, neighbors: knnNeighbors.map((n) => n.point) };
}

function lineIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { x: p1.x + t * d1x, y: p1.y + t * d1y };
  return null;
}
function castRay(origin: Vec2, angle: number, maxLength: number, segments: { a: Vec2; b: Vec2 }[]): number {
  const dx = Math.cos(angle) * maxLength, dy = Math.sin(angle) * maxLength;
  const rayEnd = { x: origin.x + dx, y: origin.y + dy };
  let minDist = maxLength;
  for (let i = 0; i < segments.length; i++) {
    const inter = lineIntersection(origin, rayEnd, segments[i].a, segments[i].b);
    if (inter) { const d = dist2D(origin, inter); if (d < minDist) minDist = d; }
  }
  return minDist;
}
function buildBorders(points: Vec2[], halfWidth: number) {
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    left.push({ x: points[i].x + nx * halfWidth, y: points[i].y + ny * halfWidth });
    right.push({ x: points[i].x - nx * halfWidth, y: points[i].y - ny * halfWidth });
  }
  return { left, right };
}
function distPointToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return dist2D(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist2D(p, { x: a.x + t * dx, y: a.y + t * dy });
}
function sampleSmoothCenter(points: Vec2[], samplesPerSeg: number = 8): Vec2[] {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    const result: Vec2[] = [points[0]];
    for (let s = 1; s <= samplesPerSeg; s++) {
      const u = s / samplesPerSeg;
      result.push({ x: points[0].x + (points[1].x - points[0].x) * u, y: points[0].y + (points[1].y - points[0].y) * u });
    }
    return result;
  }
  const result: Vec2[] = []; const tension = 6;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / tension, cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension, cp2y = p2.y - (p3.y - p1.y) / tension;
    const n = (i === 0 || i === points.length - 2) ? samplesPerSeg * 2 : samplesPerSeg;
    for (let s = 0; s < n; s++) {
      const u = s / n, u2 = u * u, u3 = u2 * u, mu = 1 - u, mu2 = mu * mu, mu3 = mu2 * mu;
      result.push({ x: mu3 * p1.x + 3 * mu2 * u * cp1x + 3 * mu * u2 * cp2x + u3 * p2.x, y: mu3 * p1.y + 3 * mu2 * u * cp1y + 3 * mu * u2 * cp2y + u3 * p2.y });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}
function drawSmoothPath(ctx: CanvasRenderingContext2D, points: Vec2[]) {
  if (points.length < 2) return;
  if (points.length === 2) { ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[1].x, points[1].y); return; }
  const tension = 6;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / tension, p1.y + (p2.y - p0.y) / tension, p2.x - (p3.x - p1.x) / tension, p2.y - (p3.y - p1.y) / tension, p2.x, p2.y);
  }
}
function buildSmoothBorders(points: Vec2[], halfWidth: number) {
  const smooth = sampleSmoothCenter(points, 8);
  return buildBorders(smooth, halfWidth);
}

// ─ Gestion des modèles ────────────────────────────────────────────────────────
function getSavedModels(): SavedModel[] {
  try { const raw = localStorage.getItem(MODEL_STORAGE_KEY); if (!raw) return []; return JSON.parse(raw); }
  catch { return []; }
}
function saveModelToStorage(model: SavedModel): void {
  const models = getSavedModels();
  const existingIndex = models.findIndex(m => m.id === model.id);
  if (existingIndex >= 0) models[existingIndex] = model; else models.push(model);
  localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models));
}
function deleteModelFromStorage(id: string): void {
  const models = getSavedModels().filter(m => m.id !== id);
  localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models));
}
function getSavedKNNModels(): KNNModel[] {
  try { const raw = localStorage.getItem(KNN_MODEL_STORAGE_KEY); if (!raw) return []; return JSON.parse(raw); }
  catch { return []; }
}
function saveKNNModelToStorage(model: KNNModel): void {
  const models = getSavedKNNModels();
  const existingIndex = models.findIndex(m => m.id === model.id);
  if (existingIndex >= 0) models[existingIndex] = model; else models.push(model);
  localStorage.setItem(KNN_MODEL_STORAGE_KEY, JSON.stringify(models));
}
function deleteKNNModelFromStorage(id: string): void {
  const models = getSavedKNNModels().filter(m => m.id !== id);
  localStorage.setItem(KNN_MODEL_STORAGE_KEY, JSON.stringify(models));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ SYSTÈME D'ÉVITEMENT QUI FONCTIONNE VRAIMENT ═══════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

interface AvoidanceDecision {
  risk: number;
  correction: number;
  speedFactor: number;
  dangerLevel: 'safe' | 'warning' | 'critical';
  situation: string;
  overrideNavigation: boolean;
}

function computeAvoidanceDecision(
  sensors: number[],
  nearestIxDist: number
): AvoidanceDecision {
  const [extL, left, leftFront, center, rightFront, right, extR] = sensors;

  const leftSideOpen = left > OPEN_THRESHOLD && extL > OPEN_THRESHOLD * 0.8;
  const rightSideOpen = right > OPEN_THRESHOLD && extR > OPEN_THRESHOLD * 0.8;
  
  const frontBlocked = center < CURVE_THRESHOLD;
  const leftFrontBlocked = leftFront < CURVE_THRESHOLD;
  const rightFrontBlocked = rightFront < CURVE_THRESHOLD;
  
  if (center < EMERGENCY_STOP) {
    if (leftSideOpen && !rightSideOpen) {
      return { risk: 1.0, correction: -0.9, speedFactor: 0.05, dangerLevel: 'critical', situation: 'URGENCE: tourne gauche', overrideNavigation: true };
    }
    if (rightSideOpen && !leftSideOpen) {
      return { risk: 1.0, correction: 0.9, speedFactor: 0.05, dangerLevel: 'critical', situation: 'URGENCE: tourne droite', overrideNavigation: true };
    }
    const leftScore = left + leftFront;
    const rightScore = right + rightFront;
    if (leftScore > rightScore) {
      return { risk: 1.0, correction: -0.8, speedFactor: 0.05, dangerLevel: 'critical', situation: 'URGENCE: contourne gauche', overrideNavigation: true };
    } else {
      return { risk: 1.0, correction: 0.8, speedFactor: 0.05, dangerLevel: 'critical', situation: 'URGENCE: contourne droite', overrideNavigation: true };
    }
  }

  if (leftFrontBlocked && rightSideOpen && !rightFrontBlocked) {
    const urgency = 1 - leftFront;
    const correction = 0.5 + urgency * 0.4;
    return {
      risk: 0.4 + urgency * 0.3,
      correction,
      speedFactor: 0.5,
      dangerLevel: 'warning',
      situation: 'Virage à droite',
      overrideNavigation: true
    };
  }

  if (rightFrontBlocked && leftSideOpen && !leftFrontBlocked) {
    const urgency = 1 - rightFront;
    const correction = -(0.5 + urgency * 0.4);
    return {
      risk: 0.4 + urgency * 0.3,
      correction,
      speedFactor: 0.5,
      dangerLevel: 'warning',
      situation: 'Virage à gauche',
      overrideNavigation: true
    };
  }

  if (frontBlocked) {
    if (leftSideOpen && !rightSideOpen) {
      return { risk: 0.8, correction: -0.8, speedFactor: 0.2, dangerLevel: 'critical', situation: 'Contourne à gauche', overrideNavigation: true };
    }
    if (rightSideOpen && !leftSideOpen) {
      return { risk: 0.8, correction: 0.8, speedFactor: 0.2, dangerLevel: 'critical', situation: 'Contourne à droite', overrideNavigation: true };
    }
    const leftScore = left * 0.5 + leftFront * 0.5;
    const rightScore = right * 0.5 + rightFront * 0.5;
    if (leftScore > rightScore + 0.1) {
      return { risk: 0.7, correction: -0.7, speedFactor: 0.25, dangerLevel: 'critical', situation: 'Contourne gauche', overrideNavigation: true };
    } else if (rightScore > leftScore + 0.1) {
      return { risk: 0.7, correction: 0.7, speedFactor: 0.25, dangerLevel: 'critical', situation: 'Contourne droite', overrideNavigation: true };
    }
    return { risk: 0.6, correction: 0.5, speedFactor: 0.3, dangerLevel: 'critical', situation: 'Obstacle: contourne', overrideNavigation: true };
  }

  if (left < WALL_THRESHOLD && rightSideOpen) {
    return { risk: 0.4, correction: 0.5, speedFactor: 0.7, dangerLevel: 'warning', situation: 'Recentre vers droite', overrideNavigation: false };
  }
  if (right < WALL_THRESHOLD && leftSideOpen) {
    return { risk: 0.4, correction: -0.5, speedFactor: 0.7, dangerLevel: 'warning', situation: 'Recentre vers gauche', overrideNavigation: false };
  }

  const imbalance = (left - right);
  const gentleCorrection = -imbalance * 0.25;
  
  let speedFactor = 1.0;
  const frontClearance = (leftFront + center + rightFront) / 3;
  if (frontClearance < 0.5) speedFactor = 0.7;
  else if (frontClearance < 0.7) speedFactor = 0.85;
  
  return {
    risk: Math.max(0, 0.1 - frontClearance * 0.1),
    correction: gentleCorrection,
    speedFactor,
    dangerLevel: 'safe',
    situation: 'Route libre',
    overrideNavigation: false
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ tickCar AVEC ÉVITEMENT ACTIF ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function tickCar(
  car: CarState, 
  network: MergedNetwork, 
  grid: SpatialGrid, 
  kValue: number, 
  roadWidth: number, 
  carLengthPx: number, 
  carWidthPx: number, 
  sensorLength: number
): { car: CarState; collisionRisk: number; situation: string } {
  const updated = { ...car };
  const localQuery = grid.query(updated.x, updated.y);
  
  const sensorReadings: number[] = [];
  for (let i = 0; i < NUM_SENSORS; i++) {
    const rayAngle = updated.angle + SENSOR_ANGLES[i];
    const distLeft = castRay({ x: updated.x, y: updated.y }, rayAngle, sensorLength, localQuery.leftSegments);
    const distRight = castRay({ x: updated.x, y: updated.y }, rayAngle, sensorLength, localQuery.rightSegments);
    sensorReadings.push(Math.min(1, Math.min(distLeft, distRight) / sensorLength));
  }
  updated.sensors = sensorReadings;
  
  const knnResult = knnOnWaypoints(updated, network, kValue, localQuery.points);
  const dx = knnResult.targetX - updated.x, dy = knnResult.targetY - updated.y;
  const targetAngle = Math.atan2(dy, dx);
  let angleDiff = targetAngle - updated.angle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  let nearestIxDist = Infinity;
  for (const ix of network.intersections) {
    const d = dist2D({ x: updated.x, y: updated.y }, ix);
    if (d < nearestIxDist) nearestIxDist = d;
  }
  
  const decision = computeAvoidanceDecision(sensorReadings, nearestIxDist);
  const collisionRisk = decision.risk;
  
  let speedFactor = knnResult.speedFactor;
  let finalAngleDiff = angleDiff;
  
  if (decision.overrideNavigation) {
    speedFactor = decision.speedFactor;
    finalAngleDiff = decision.correction;
  } else if (decision.dangerLevel === 'warning') {
    speedFactor = Math.min(speedFactor, decision.speedFactor);
    finalAngleDiff = angleDiff * 0.3 + decision.correction * 0.7;
  } else {
    finalAngleDiff = angleDiff + decision.correction * 0.4;
  }
  
  const midIdx = Math.floor(NUM_SENSORS / 2);
  const frontClearance = sensorReadings[midIdx];
  
  if (frontClearance < EMERGENCY_STOP) {
    speedFactor = 0.05;
    if (decision.correction === 0) {
      const leftSpace = sensorReadings[1] + sensorReadings[2];
      const rightSpace = sensorReadings[4] + sensorReadings[5];
      finalAngleDiff = leftSpace > rightSpace ? -0.7 : 0.7;
    }
  } else if (frontClearance < SAFE_DISTANCE_FACTOR) {
    speedFactor = Math.min(speedFactor, frontClearance / SAFE_DISTANCE_FACTOR * 0.3);
  }
  
  if (nearestIxDist < INTERSECTION_STOP_RADIUS) {
    speedFactor = Math.min(speedFactor, 0.18);
  } else if (nearestIxDist < INTERSECTION_SLOWDOWN_RADIUS) {
    const t = (nearestIxDist - INTERSECTION_STOP_RADIUS) / (INTERSECTION_SLOWDOWN_RADIUS - INTERSECTION_STOP_RADIUS);
    speedFactor = Math.min(speedFactor, 0.18 + t * 0.42);
  }
  
  const legalSpeedFactor = Math.min(1, SPEED_LIMIT_KMH / (MAX_SPEED * 3.6));
  speedFactor = Math.min(speedFactor, legalSpeedFactor);
  
  finalAngleDiff = Math.max(-1.0, Math.min(1.0, finalAngleDiff));
  
  const targetSpeed = MAX_SPEED * speedFactor;
  updated.vitesse += (targetSpeed - updated.vitesse) * ACCEL_FACTOR;
  updated.vitesse = Math.max(MIN_SPEED * 0.3, Math.min(MAX_SPEED, updated.vitesse));
  
  updated.angle += finalAngleDiff * STEER_FACTOR;
  updated.x += Math.cos(updated.angle) * updated.vitesse;
  updated.y += Math.sin(updated.angle) * updated.vitesse;
  
  const progressDist = Math.sqrt((updated.x - updated.lastX) ** 2 + (updated.y - updated.lastY) ** 2);
  if (progressDist > 2) { updated.stuckFrames = 0; updated.lastX = updated.x; updated.lastY = updated.y; }
  else updated.stuckFrames++;
  
  if (updated.stuckFrames > ANTI_STUCK_FRAMES) {
    updated.angle += Math.PI / 4;
    updated.vitesse = Math.min(MAX_SPEED, MIN_SPEED * 1.5);
    updated.x += Math.cos(updated.angle) * updated.vitesse;
    updated.y += Math.sin(updated.angle) * updated.vitesse;
    updated.lastX = updated.x; 
    updated.lastY = updated.y; 
    updated.stuckFrames = 0;
  }
  
  const cosA = Math.cos(updated.angle), sinA = Math.sin(updated.angle);
  const hw = carWidthPx / 2, hl = carLengthPx / 2;
  const corners = [
    { x: updated.x + cosA * hl - sinA * hw, y: updated.y + sinA * hl + cosA * hw },
    { x: updated.x + cosA * hl + sinA * hw, y: updated.y + sinA * hl - cosA * hw },
    { x: updated.x - cosA * hl - sinA * hw, y: updated.y - sinA * hl + cosA * hw },
    { x: updated.x - cosA * hl + sinA * hw, y: updated.y - sinA * hl - cosA * hw },
  ];
  let anyCornerOutside = false;
  for (const c of corners) {
    let minCornerDist = Infinity;
    for (const seg of localQuery.roadSegments) {
      const d = distPointToSeg(c, seg.a, seg.b);
      if (d < minCornerDist) minCornerDist = d;
    }
    if (minCornerDist > roadWidth / 2) { anyCornerOutside = true; break; }
  }
  if (anyCornerOutside) updated.alive = false;
  if (updated.alive) {
    updated.score += updated.vitesse * 0.1;
    updated.coverage++;
  }
  
  return { car: updated, collisionRisk, situation: decision.situation };
}

// ══════════════════════════════════════════════════════════════════════════════
// ══ tickCarWithModel AVEC ÉVITEMENT ACTIF (mode inférence) ═════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function tickCarWithModel(
  car: CarState,
  network: MergedNetwork,
  grid: SpatialGrid,
  brain: KNNBrain,
  kValue: number,
  roadWidth: number,
  carLengthPx: number,
  carWidthPx: number,
  sensorLength: number
): { car: CarState; confidence: number; context: TrainingSample['context']; collisionRisk: number; situation: string } {
  const updated = { ...car };
  const localQuery = grid.query(updated.x, updated.y);

  const sensorReadings: number[] = [];
  for (let i = 0; i < NUM_SENSORS; i++) {
    const rayAngle = updated.angle + SENSOR_ANGLES[i];
    const distLeft = castRay({ x: updated.x, y: updated.y }, rayAngle, sensorLength, localQuery.leftSegments);
    const distRight = castRay({ x: updated.x, y: updated.y }, rayAngle, sensorLength, localQuery.rightSegments);
    sensorReadings.push(Math.min(1, Math.min(distLeft, distRight) / sensorLength));
  }
  updated.sensors = sensorReadings;

  let context: TrainingSample['context'] = 'straight';
  let nearestIxDist = Infinity;
  for (const ix of network.intersections) {
    const d = dist2D({ x: updated.x, y: updated.y }, ix);
    if (d < nearestIxDist) nearestIxDist = d;
  }
  if (nearestIxDist < INTERSECTION_SLOWDOWN_RADIUS) context = 'intersection';
  else if (Math.abs(sensorReadings[0] - sensorReadings[6]) > 0.3) context = 'turn';
  else if (updated.stuckFrames > 5) context = 'stuck';

  const decision = computeAvoidanceDecision(sensorReadings, nearestIxDist);
  const collisionRisk = decision.risk;

  const prediction = brain.predict(sensorReadings, kValue, context);

  let speedFactor = prediction.confidence > 0.2 ? prediction.speedFactor : 0.3;
  let angleDiff = prediction.confidence > 0.2 ? prediction.angleDiff : 0;

  if (decision.overrideNavigation) {
    speedFactor = decision.speedFactor;
    angleDiff = decision.correction;
    context = 'danger';
  } else if (decision.dangerLevel === 'warning') {
    speedFactor = Math.min(speedFactor, decision.speedFactor);
    angleDiff = angleDiff * 0.3 + decision.correction * 0.7;
    if (collisionRisk > 0.5) context = 'danger';
  } else {
    angleDiff = angleDiff + decision.correction * 0.4;
  }

  const midIdx = Math.floor(NUM_SENSORS / 2);
  const frontClearance = sensorReadings[midIdx];
  if (frontClearance < EMERGENCY_STOP) {
    speedFactor = 0.05;
    if (angleDiff === 0) {
      const leftSpace = sensorReadings[1] + sensorReadings[2];
      const rightSpace = sensorReadings[4] + sensorReadings[5];
      angleDiff = leftSpace > rightSpace ? -0.7 : 0.7;
    }
  } else if (frontClearance < SAFE_DISTANCE_FACTOR) {
    speedFactor = Math.min(speedFactor, frontClearance / SAFE_DISTANCE_FACTOR * 0.3);
  }
  if (nearestIxDist < INTERSECTION_STOP_RADIUS) speedFactor = Math.min(speedFactor, 0.18);
  else if (nearestIxDist < INTERSECTION_SLOWDOWN_RADIUS) {
    const t = (nearestIxDist - INTERSECTION_STOP_RADIUS) / (INTERSECTION_SLOWDOWN_RADIUS - INTERSECTION_STOP_RADIUS);
    speedFactor = Math.min(speedFactor, 0.18 + t * 0.42);
  }
  angleDiff = Math.max(-1.0, Math.min(1.0, angleDiff));

  const targetSpeed = MAX_SPEED * speedFactor;
  updated.vitesse += (targetSpeed - updated.vitesse) * ACCEL_FACTOR;
  updated.vitesse = Math.max(MIN_SPEED * 0.3, Math.min(MAX_SPEED, updated.vitesse));
  updated.angle += angleDiff * STEER_FACTOR;
  updated.x += Math.cos(updated.angle) * updated.vitesse;
  updated.y += Math.sin(updated.angle) * updated.vitesse;

  const progressDist = Math.sqrt((updated.x - updated.lastX) ** 2 + (updated.y - updated.lastY) ** 2);
  if (progressDist > 2) {
    updated.stuckFrames = 0;
    updated.lastX = updated.x;
    updated.lastY = updated.y;
  } else {
    updated.stuckFrames++;
  }
  if (updated.stuckFrames > ANTI_STUCK_FRAMES) {
    updated.angle += Math.PI / 4;
    updated.vitesse = Math.min(MAX_SPEED, MIN_SPEED * 1.5);
    updated.x += Math.cos(updated.angle) * updated.vitesse;
    updated.y += Math.sin(updated.angle) * updated.vitesse;
    updated.lastX = updated.x;
    updated.lastY = updated.y;
    updated.stuckFrames = 0;
  }

  const cosA = Math.cos(updated.angle), sinA = Math.sin(updated.angle);
  const hw = carWidthPx / 2, hl = carLengthPx / 2;
  const corners = [
    { x: updated.x + cosA * hl - sinA * hw, y: updated.y + sinA * hl + cosA * hw },
    { x: updated.x + cosA * hl + sinA * hw, y: updated.y + sinA * hl - cosA * hw },
    { x: updated.x - cosA * hl - sinA * hw, y: updated.y - sinA * hl + cosA * hw },
    { x: updated.x - cosA * hl + sinA * hw, y: updated.y - sinA * hl - cosA * hw },
  ];
  let anyCornerOutside = false;
  for (const c of corners) {
    let minCornerDist = Infinity;
    for (const seg of localQuery.roadSegments) {
      const d = distPointToSeg(c, seg.a, seg.b);
      if (d < minCornerDist) minCornerDist = d;
    }
    if (minCornerDist > roadWidth / 2) { anyCornerOutside = true; break; }
  }
  if (anyCornerOutside) updated.alive = false;
  if (updated.alive) {
    updated.score += updated.vitesse * 0.1;
    updated.coverage++;
  }

  return { car: updated, confidence: prediction.confidence, context, collisionRisk, situation: decision.situation };
}

// ═════════════════════════════════════════════════════════════════════════════
// ═ COMPOSANT PRINCIPAL ═══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export default function KnnRealRoad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const networkRef = useRef<MergedNetwork | null>(null);
  const gridRef = useRef<SpatialGrid | null>(null);
  const projMetaRef = useRef<{ centerX: number; centerY: number; centerLat: number; centerLng: number; tileZoom: number } | null>(null);
  const roadWidthRef = useRef(12);
  const carDimRef = useRef({ carLengthPx: 0.5, carWidthPx: 0.4, sensorLength: 25 });
  
  const carRef = useRef<CarState | null>(null);
  const zoomRef = useRef(1);
  const ghostTrailRef = useRef<Vec2[]>([]);
  const nextIdRef = useRef(0);
  const tilesVersionRef = useRef(0);
  const respawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRespawningRef = useRef(false);
  const totalDistanceRef = useRef(0);
  const lastPosRef = useRef<Vec2 | null>(null);

  const brainRef = useRef<KNNBrain>(new KNNBrain());
  const trainingStartTimeRef = useRef<number>(0);
  const lastKnnResultRef = useRef<KnnResult | null>(null);

  const [phase, setPhase] = useState<'init' | 'fetching' | 'ready'>('init');
  const [dataSource, setDataSource] = useState('...');
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const [tilesTotal, setTilesTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [kValue, setKValue] = useState(5);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [routesCount, setRoutesCount] = useState(0);
  const [intersectionsCount, setIntersectionsCount] = useState(0);
  
  const [alive, setAlive] = useState(false);
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [sensors, setSensors] = useState<number[]>([]);
  const [roadCode, setRoadCode] = useState<RoadCodeStatus>({ conforme: true, vitesseMax: SPEED_LIMIT_KMH, raison: 'Conforme' });
  const [showSensors, setShowSensors] = useState(true);
  const [respawnCount, setRespawnCount] = useState(0);
  const [showRespawn, setShowRespawn] = useState(false);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<SavedModel | null>(null);
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [modelName, setModelName] = useState('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const [mode, setMode] = useState<'manual' | 'training' | 'inference'>('manual');
  const [trainingSamples, setTrainingSamples] = useState(0);
  const [inferenceConfidence, setInferenceConfidence] = useState(0);
  const [inferenceContext, setInferenceContext] = useState<string>('—');
  const [savedKNNModels, setSavedKNNModels] = useState<KNNModel[]>([]);
  const [showKNNPanel, setShowKNNPanel] = useState(false);
  const [selectedKNNModel, setSelectedKNNModel] = useState<KNNModel | null>(null);
  const [knnModelName, setKnnModelName] = useState('');
  
  const [collisionRisk, setCollisionRisk] = useState(0);
  const [situation, setSituation] = useState('Route libre');
  const [apiRoutesLoaded, setApiRoutesLoaded] = useState(false);

  // ═══ NOUVEAU : Panneau éducatif KNN ═══
  const [showKnnGuide, setShowKnnGuide] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'formula' | 'steps' | 'types' | 'tips'>('formula');

  const createCar = (x: number, y: number, angle: number) => {
    const id = nextIdRef.current++;
    return { 
      id, x, y, angle, vitesse: 0, alive: true, score: 0, 
      sensors: new Array(NUM_SENSORS).fill(1), stuckFrames: 0, 
      lastX: x, lastY: y, coverage: 0 
    };
  };

  const spawnCarNearestRoad = () => {
    const network = networkRef.current;
    const car = carRef.current;
    if (!network || network.segments.length === 0 || !car) return;
    if (car.alive) return;
    
    let minDist = Infinity;
    let bestPoint: Vec2 | null = null;
    let bestAngle = 0;
    
    for (const segment of network.segments) {
      for (let i = 0; i < segment.length - 1; i++) {
        const a = segment[i];
        const b = segment[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.001) continue;
        const t = Math.max(0, Math.min(1, ((car.x - a.x) * dx + (car.y - a.y) * dy) / lenSq));
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const dist = dist2D({ x: projX, y: projY }, { x: car.x, y: car.y });
        if (dist < minDist) {
          minDist = dist;
          bestPoint = { x: projX, y: projY };
          bestAngle = Math.atan2(dy, dx);
        }
      }
    }
    
    if (bestPoint) {
      const offset = 5;
      bestPoint.x += (Math.random() - 0.5) * offset;
      bestPoint.y += (Math.random() - 0.5) * offset;
      carRef.current = createCar(bestPoint.x, bestPoint.y, bestAngle);
      lastPosRef.current = { x: bestPoint.x, y: bestPoint.y };
      ghostTrailRef.current = [];
      setAlive(true);
      setRespawnCount(prev => prev + 1);
      setShowRespawn(true);
      setIsModelLoaded(false);
      setTimeout(() => setShowRespawn(false), 2000);
    }
  };

  const spawnCar = () => {
    const network = networkRef.current;
    if (!network || network.segments.length === 0) return;
    const first = network.segments[0];
    const angle = Math.atan2(first[1].y - first[0].y, first[1].x - first[0].x);
    carRef.current = createCar(first[0].x, first[0].y, angle);
    lastPosRef.current = { x: first[0].x, y: first[0].y };
    ghostTrailRef.current = [];
    setAlive(true);
    setRespawnCount(0);
    setIsModelLoaded(false);
  };

  const loadModel = (model: SavedModel) => {
    if (!networkRef.current) return;
    const car = carRef.current;
    if (!car) return;
    carRef.current = createCar(model.carData.x, model.carData.y, model.carData.angle);
    carRef.current.vitesse = model.carData.vitesse;
    carRef.current.score = model.score;
    carRef.current.coverage = model.coverage;
    setScore(model.score);
    setSelectedModel(model);
    setIsModelLoaded(true);
    setShowModelPanel(false);
  };

  const saveCurrentModel = () => {
    const car = carRef.current;
    if (!car || !networkRef.current) return;
    const network = networkRef.current;
    const model: SavedModel = {
      id: `model_${Date.now()}`,
      name: modelName || `Modèle ${savedModels.length + 1}`,
      timestamp: new Date().toISOString(),
      score: car.score,
      distance: totalDistanceRef.current,
      coverage: car.coverage,
      totalIntersections: network.intersections.length,
      kValue: kValue,
      carData: { x: car.x, y: car.y, angle: car.angle, vitesse: car.vitesse }
    };
    saveModelToStorage(model);
    setSavedModels(getSavedModels());
    setModelName('');
    setShowModelPanel(false);
  };

  const deleteModel = (id: string) => {
    deleteModelFromStorage(id);
    setSavedModels(getSavedModels());
    if (selectedModel?.id === id) { setSelectedModel(null); setIsModelLoaded(false); }
  };

  const startTraining = () => {
    brainRef.current = new KNNBrain();
    brainRef.current.startTraining();
    trainingStartTimeRef.current = performance.now();
    setMode('training');
    setTrainingSamples(0);
    if (!carRef.current || !carRef.current.alive) spawnCar();
    setRunning(true);
  };

  const stopTrainingAndSave = () => {
    brainRef.current.stopTraining();
    const duration = performance.now() - trainingStartTimeRef.current;
    const model = brainRef.current.exportModel(
      knnModelName || `KNN_${new Date().toLocaleTimeString()}`, 
      {
        totalSamples: brainRef.current.getSampleCount(),
        avgScore: score / Math.max(1, respawnCount + 1),
        bestScore: score,
        routesCount,
        intersectionsCount,
        trainingDuration: duration
      }
    );
    saveKNNModelToStorage(model);
    setSavedKNNModels(getSavedKNNModels());
    setKnnModelName('');
    setMode('manual');
    setRunning(false);
  };

  const startInference = (model: KNNModel) => {
    brainRef.current = KNNBrain.importModel(model);
    setSelectedKNNModel(model);
    setMode('inference');
    setShowKNNPanel(false);
    if (!carRef.current || !carRef.current.alive) spawnCar();
    setRunning(true);
  };

  const deleteKNNModel = (id: string) => {
    deleteKNNModelFromStorage(id);
    setSavedKNNModels(getSavedKNNModels());
    if (selectedKNNModel?.id === id) { setSelectedKNNModel(null); setMode('manual'); }
  };

  useEffect(() => {
    setSavedModels(getSavedModels());
    setSavedKNNModels(getSavedKNNModels());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase('fetching');

    (async () => {
      const t0 = performance.now();
      let apiRoutes: ApiRoute[];
      try {
        const res = await fetchWithTimeout('https://emihack.onrender.com/routes/all', 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const routes: ApiRoute[] = Array.isArray(data) ? data : data.routes || [];
        const valid = routes.filter((r) => r.coordinates && r.coordinates.length >= 2);
        if (valid.length === 0) throw new Error('empty');
        apiRoutes = valid;
        if (!cancelled) {
          setDataSource(`API OpenStreetMap (${Math.round(performance.now() - t0)}ms)`);
          setApiRoutesLoaded(true);
        }
      } catch (err) {
        console.warn('API en échec, bascule sur mock local:', err);
        apiRoutes = MOCK_ROUTES;
        if (!cancelled) {
          setDataSource(`Mock local (${Math.round(performance.now() - t0)}ms)`);
          setApiRoutesLoaded(false);
        }
      }
      if (cancelled) return;

      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const r of apiRoutes) {
        for (const [lng, lat] of r.coordinates) {
          if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        }
      }
      const cLng = (minLng + maxLng) / 2, cLat = (minLat + maxLat) / 2;
      const cMerc = latLngToMercPixel(cLat, cLng, OSM_ZOOM);
      projMetaRef.current = { centerX: cMerc.x, centerY: cMerc.y, centerLat: cLat, centerLng: cLng, tileZoom: OSM_ZOOM };

      const localRoutes: LocalRoute[] = apiRoutes.map((r) => ({
        id: r.id, name: r.name,
        points: r.coordinates.map(([lng, lat]) => { const mp = latLngToMercPixel(lat, lng, OSM_ZOOM); return { x: mp.x, y: mp.y }; }),
      }));
      const tolerance = INTERSECTION_TOLERANCE * 256 * Math.pow(2, OSM_ZOOM) / 360;
      const network = mergeRoutesAtIntersections(localRoutes, tolerance);
      networkRef.current = network;

      const mpp = getMetersPerPixel(cLat, OSM_ZOOM);
      roadWidthRef.current = Math.max(8, Math.round(ROAD_WIDTH_METERS / mpp * ROAD_VISUAL_FACTOR));
      const ppm = 1 / mpp;
      carDimRef.current = {
        carLengthPx: Math.max(0.5, CAR_LENGTH_METERS * ppm * 100),
        carWidthPx: Math.max(0.4, CAR_WIDTH_METERS * ppm * 100),
        sensorLength: Math.max(1, SENSOR_LENGTH_METERS * ppm),
      };

      const segBorders: { left: Vec2[]; right: Vec2[] }[] = [];
      for (const chain of network.chains) {
        if (chain.length < 2) continue;
        const borders = buildSmoothBorders(chain, roadWidthRef.current / 2);
        segBorders.push(borders);
      }
      gridRef.current = new SpatialGrid(segBorders, network.allPoints, network.chains);

      setRoutesCount(apiRoutes.length);
      setIntersectionsCount(network.intersections.length);
      setPhase('ready');

      const z = OSM_ZOOM;
      const tl = latLngToTile(maxLat, minLng, z);
      const br = latLngToTile(minLat, maxLng, z);
      const totalTiles = Math.max(1, (br.tx - tl.tx + 1) * (br.ty - tl.ty + 1));
      setTilesTotal(totalTiles);
      let loaded = 0;
      for (let tx = tl.tx; tx <= br.tx; tx++) {
        for (let ty = tl.ty; ty <= br.ty; ty++) {
          const key = `${z}/${tx}/${ty}`;
          if (tileCache.has(key)) { loaded++; continue; }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
          img.onload = () => { if (img.width > 0) { tileCache.set(key, img); loaded++; setTilesLoaded(loaded); tilesVersionRef.current++; } };
          img.onerror = () => {};
        }
      }
      setTilesLoaded(loaded);
      spawnCar();
    })();

    return () => { 
      cancelled = true;
      if (respawnTimerRef.current) { clearTimeout(respawnTimerRef.current); respawnTimerRef.current = null; }
    };
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const network = networkRef.current;
    const grid = gridRef.current;
    const car = carRef.current;
    
    if (!canvas || !network || !grid || !car) { 
      animRef.current = requestAnimationFrame(animate); 
      return; 
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const meta = projMetaRef.current;

    if (car.alive && running) {
      const cd = carDimRef.current;
      let updated: CarState;
      let newCollisionRisk = 0;
      let newSituation = 'Route libre';
      
      if (mode === 'inference' && brainRef.current.getSampleCount() > 0) {
        const result = tickCarWithModel(
          car, network, grid, brainRef.current, kValue, 
          roadWidthRef.current, cd.carLengthPx, cd.carWidthPx, cd.sensorLength
        );
        updated = result.car;
        setInferenceConfidence(result.confidence);
        setInferenceContext(result.context);
        newCollisionRisk = result.collisionRisk;
        newSituation = result.situation;
      } else {
        const result = tickCar(
          car, network, grid, kValue, 
          roadWidthRef.current, cd.carLengthPx, cd.carWidthPx, cd.sensorLength
        );
        updated = result.car;
        newCollisionRisk = result.collisionRisk;
        newSituation = result.situation;
        
        if (mode === 'training' && brainRef.current.getIsTraining()) {
          const localQuery = grid.query(car.x, car.y);
          const knnResult = knnOnWaypoints(car, network, kValue, localQuery.points);
          lastKnnResultRef.current = knnResult;
          
          const dx = knnResult.targetX - car.x;
          const dy = knnResult.targetY - car.y;
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - car.angle;
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          
          const speedFactor = updated.vitesse / MAX_SPEED;
          let context: TrainingSample['context'] = 'straight';
          const nearestIxDist = network.intersections.reduce((min, ix) => 
            Math.min(min, dist2D({ x: car.x, y: car.y }, ix)), Infinity);
          if (nearestIxDist < INTERSECTION_SLOWDOWN_RADIUS) context = 'intersection';
          else if (Math.abs(car.sensors[0] - car.sensors[6]) > 0.3) context = 'turn';
          else if (car.stuckFrames > 5) context = 'stuck';
          if (newCollisionRisk > 0.5) context = 'danger';

          brainRef.current.recordSample({
            sensors: [...car.sensors],
            kValue,
            speedFactor,
            angleDiff,
            score: car.score,
            alive: updated.alive,
            context
          });
          setTrainingSamples(brainRef.current.getSampleCount());
        }
      }
      
      if (lastPosRef.current) {
        const dist = dist2D(lastPosRef.current, { x: updated.x, y: updated.y });
        totalDistanceRef.current += dist;
      }
      lastPosRef.current = { x: updated.x, y: updated.y };
      carRef.current = updated;
      
      const trail = ghostTrailRef.current;
      const last = trail[trail.length - 1];
      const pos = { x: updated.x, y: updated.y };
      if (!last || dist2D(last, pos) > 3) { trail.push(pos); if (trail.length > 500) trail.shift(); }
      
      setAlive(updated.alive);
      setScore(updated.score);
      setSpeed(updated.vitesse * 3.6);
      setSensors(updated.sensors);
      setCollisionRisk(newCollisionRisk);
      setSituation(newSituation);
      
      if (!updated.alive && !isRespawningRef.current) {
        isRespawningRef.current = true;
        if (respawnTimerRef.current) { clearTimeout(respawnTimerRef.current); respawnTimerRef.current = null; }
        respawnTimerRef.current = setTimeout(() => {
          if (carRef.current && !carRef.current.alive) spawnCarNearestRoad();
          isRespawningRef.current = false;
          respawnTimerRef.current = null;
        }, RESPAWN_DELAY);
      }
    }

    if (car) {
      let conforme = true, raison = 'Conforme';
      const midSensor = car.sensors[Math.floor(NUM_SENSORS / 2)] ?? 1;
      const speedKmh = car.vitesse * 3.6;
      let nearestIxDist = Infinity;
      for (const ix of network.intersections) {
        const d = dist2D({ x: car.x, y: car.y }, ix);
        if (d < nearestIxDist) nearestIxDist = d;
      }
      if (midSensor < 0.18) { conforme = false; raison = 'Freinage (distance de sécurité)'; }
      else if (nearestIxDist < INTERSECTION_STOP_RADIUS) { conforme = false; raison = 'Priorité à l\'intersection'; }
      else if (nearestIxDist < INTERSECTION_SLOWDOWN_RADIUS) { conforme = false; raison = 'Ralentissement (carrefour proche)'; }
      else if (speedKmh > SPEED_LIMIT_KMH + 1) { conforme = false; raison = 'Excès de vitesse'; }
      setRoadCode({ conforme, vitesseMax: SPEED_LIMIT_KMH, raison });
    }

    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    if (!meta || !car) { animRef.current = requestAnimationFrame(animate); return; }

    const camX = car.x, camY = car.y, zoom = zoomRef.current;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    const tileZoom = meta.tileZoom;
    const halfW = (W / 2) / zoom, halfH = (H / 2) / zoom;
    const tileLeft = Math.floor((camX - halfW) / 256);
    const tileTop = Math.floor((camY - halfH) / 256);
    const tileRight = Math.floor((camX + halfW) / 256);
    const tileBottom = Math.floor((camY + halfH) / 256);
    for (let tx = tileLeft; tx <= tileRight; tx++) {
      for (let ty = tileTop; ty <= tileBottom; ty++) {
        const img = loadTile(tx, ty, tileZoom);
        if (img) ctx.drawImage(img, tx * 256, ty * 256, 256, 256);
        else {
          ctx.fillStyle = '#1e293b'; ctx.fillRect(tx * 256, ty * 256, 256, 256);
          ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5; ctx.strokeRect(tx * 256, ty * 256, 256, 256);
        }
      }
    }

    const rw = roadWidthRef.current;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const chain of network.chains) {
      if (chain.length < 2) continue;
      const smooth = sampleSmoothCenter(chain, 8);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; ctx.lineWidth = rw + 6;
      ctx.beginPath(); drawSmoothPath(ctx, smooth); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = rw;
      ctx.beginPath(); drawSmoothPath(ctx, smooth); ctx.stroke();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([15, 12]);
      ctx.beginPath(); drawSmoothPath(ctx, smooth); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const ix of network.intersections) {
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(ix.x, ix.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2; ctx.stroke();
    }

    const trail = ghostTrailRef.current;
    if (trail.length > 2) {
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)'; ctx.lineWidth = 5;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke(); ctx.setLineDash([]);
    }

    const carL = carDimRef.current.carLengthPx, carW = carDimRef.current.carWidthPx, sLen = carDimRef.current.sensorLength;
    
    if (showSensors && car.alive) {
      const rayAngles = SENSOR_ANGLES.map((a) => car.angle + a);
      for (let i = 0; i < NUM_SENSORS; i++) {
        const len = car.sensors[i] * sLen;
        const endX = car.x + Math.cos(rayAngles[i]) * len, endY = car.y + Math.sin(rayAngles[i]) * len;
        const ratio = len / sLen;
        const r = Math.round((1 - ratio) * 255), g = Math.round(ratio * 255);
        ctx.strokeStyle = `rgba(${r}, ${g}, 50, 0.9)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(car.x, car.y); ctx.lineTo(endX, endY); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`${(car.sensors[i] * 100).toFixed(0)}%`, endX + 6, endY - 6);
      }
    }
    
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    let carColor = '#ef4444';
    if (mode === 'training') carColor = '#a855f7';
    else if (mode === 'inference') carColor = '#06b6d4';
    else if (isModelLoaded) carColor = '#22c55e';
    if (collisionRisk > 0.6 && car.alive) carColor = '#dc2626';
    else if (collisionRisk > 0.35 && car.alive) carColor = '#f59e0b';
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    ctx.fillStyle = car.alive ? carColor : '#444444';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    const r = Math.min(2, carW * 0.2);
    ctx.beginPath(); 
    // @ts-ignore
    if (ctx.roundRect) ctx.roundRect(-carW / 2, -carL / 2, carW, carL, r);
    else ctx.rect(-carW / 2, -carL / 2, carW, carL);
    ctx.fill(); ctx.stroke();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    const headX = carW * 0.35, headY = carL * 0.15;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(headX, -headY, carW * 0.12, carW * 0.12);
    ctx.fillRect(headX , headY - carW * 0.12, carW * 0.12, carW * 0.12);
    ctx.restore();
    ctx.restore();
    
    animRef.current = requestAnimationFrame(animate);
  }, [kValue, showSensors, isModelLoaded, mode, collisionRisk]);

  useEffect(() => {
    if (running) animRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animRef.current);
      if (respawnTimerRef.current) { clearTimeout(respawnTimerRef.current); respawnTimerRef.current = null; }
    };
  }, [running, animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) { canvas.width = e.contentRect.width; canvas.height = e.contentRect.height; }
    });
    if (canvas.parentElement) obs.observe(canvas.parentElement);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.2, Math.min(8, zoomRef.current * delta));
      zoomRef.current = newZoom; setZoomLevel(newZoom);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const handleZoomIn = () => { zoomRef.current = Math.min(8, zoomRef.current * 1.3); setZoomLevel(zoomRef.current); };
  const handleZoomOut = () => { zoomRef.current = Math.max(0.2, zoomRef.current / 1.3); setZoomLevel(zoomRef.current); };
  const handleZoomReset = () => { zoomRef.current = 1; setZoomLevel(1); };
  const toggleSensors = () => setShowSensors(!showSensors);

  const handleStart = () => {
    if (phase !== 'ready') return;
    if (!carRef.current || !carRef.current.alive) spawnCar();
    setRunning(true);
  };
  
  const handleStop = () => {
    setRunning(false);
    if (carRef.current?.alive && carRef.current.score > 0) {
      const car = carRef.current;
      const network = networkRef.current;
      if (network) {
        const autoModel: SavedModel = {
          id: `auto_${Date.now()}`,
          name: `Auto ${new Date().toLocaleTimeString()}`,
          timestamp: new Date().toISOString(),
          score: car.score,
          distance: totalDistanceRef.current,
          coverage: car.coverage,
          totalIntersections: network.intersections.length,
          kValue: kValue,
          carData: { x: car.x, y: car.y, angle: car.angle, vitesse: car.vitesse }
        };
        saveModelToStorage(autoModel);
        setSavedModels(getSavedModels());
      }
    }
  };
  
  const handleReset = () => {
    setRunning(false);
    setMode('manual');
    if (respawnTimerRef.current) { clearTimeout(respawnTimerRef.current); respawnTimerRef.current = null; }
    isRespawningRef.current = false;
    spawnCar();
    ghostTrailRef.current = [];
    totalDistanceRef.current = 0;
    lastPosRef.current = null;
    setScore(0);
    setSpeed(0);
    setSensors([]);
    setRespawnCount(0);
    setShowRespawn(false);
    setIsModelLoaded(false);
    setSelectedModel(null);
    setInferenceConfidence(0);
    setInferenceContext('—');
    setCollisionRisk(0);
    setSituation('Route libre');
  };

  const speedKmh = speed.toFixed(1);
  const sensorLabels = ['Extrême G', 'Gauche', 'Centre-G', 'Centre', 'Centre-D', 'Droite', 'Extrême D'];

  const getModeBadge = () => {
    switch (mode) {
      case 'training': return { text: '🧠 ENTRAÎNEMENT', color: 'bg-purple-600', textColor: 'text-purple-100' };
      case 'inference': return { text: ' KNN AUTONOME', color: 'bg-cyan-600', textColor: 'text-cyan-100' };
      default: return { text: '👤 MANUEL', color: 'bg-gray-600', textColor: 'text-gray-100' };
    }
  };
  const modeBadge = getModeBadge();

  return (
    <div className="h-full bg-gray-950 text-gray-100">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_420px] gap-3 h-full p-3">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden relative">
          <canvas ref={canvasRef} className="w-full h-full block" style={{ minHeight: 'calc(100vh - 200px)' }} />
          
          <div className={`absolute top-4 right-4 z-10 ${modeBadge.color} backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold ${modeBadge.textColor} border border-white/20 shadow-lg`}>
            {modeBadge.text}
          </div>

          <div className={`absolute top-4 left-4 z-10 backdrop-blur px-4 py-2 rounded-lg text-xs font-bold border shadow-lg transition-all duration-300 ${
            collisionRisk > 0.6 
              ? 'bg-red-900/90 text-red-100 border-red-500 animate-pulse' 
              : collisionRisk > 0.35 
              ? 'bg-amber-900/90 text-amber-100 border-amber-500' 
              : 'bg-emerald-900/90 text-emerald-100 border-emerald-500'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{collisionRisk > 0.6 ? '⚠️' : collisionRisk > 0.35 ? '⚡' : '✅'}</span>
              <div>
                <div className="text-[10px] opacity-70 uppercase tracking-wider">Risque collision</div>
                <div className="text-base font-mono font-bold">{(collisionRisk * 100).toFixed(0)}%</div>
              </div>
            </div>
            <div className="mt-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-200" style={{ 
                width: `${collisionRisk * 100}%`,
                backgroundColor: collisionRisk > 0.6 ? '#ef4444' : collisionRisk > 0.35 ? '#f59e0b' : '#22c55e'
              }} />
            </div>
            <div className="mt-1 text-[9px] opacity-80 italic">🎯 {situation}</div>
          </div>

          <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-1.5">
            <button onClick={handleZoomIn} className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold border border-gray-700 cursor-pointer transition-colors flex items-center justify-center">+</button>
            <button onClick={handleZoomReset} className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-gray-300 rounded-lg text-[10px] font-mono border border-gray-700 cursor-pointer transition-colors flex items-center justify-center">{zoomLevel.toFixed(1)}x</button>
            <button onClick={handleZoomOut} className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold border border-gray-700 cursor-pointer transition-colors flex items-center justify-center">−</button>
            <button onClick={toggleSensors} className={`w-8 h-8 ${showSensors ? 'bg-blue-600' : 'bg-gray-700'} hover:bg-blue-500 text-white rounded-lg text-xs font-bold border border-gray-700 cursor-pointer transition-colors flex items-center justify-center`}>📡</button>
            <button onClick={() => setShowModelPanel(!showModelPanel)} className="w-8 h-8 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold border border-gray-700 cursor-pointer transition-colors flex items-center justify-center">💾</button>
            <button onClick={() => setShowKNNPanel(!showKNNPanel)} className="w-8 h-8 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold border border-gray-700 cursor-pointer transition-colors flex items-center justify-center">🧠</button>
            <button onClick={() => setShowKnnGuide(!showKnnGuide)} className={`w-8 h-8 ${showKnnGuide ? 'bg-amber-500' : 'bg-amber-700'} hover:bg-amber-500 text-white rounded-lg text-xs font-bold border border-gray-700 cursor-pointer transition-colors flex items-center justify-center`} title="Guide KNN">📚</button>
          </div>
          
          {phase === 'fetching' && (
            <div className="absolute top-16 left-4 z-10 bg-gray-800/90 backdrop-blur px-4 py-2 rounded-full text-xs text-gray-300 border border-gray-700 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
              Chargement des routes OpenStreetMap…
            </div>
          )}
          {phase === 'ready' && (
            <div className="absolute top-16 left-4 z-10 bg-gray-800/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-gray-300 border border-gray-700 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${apiRoutesLoaded ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {apiRoutesLoaded ? 'Routes API chargées' : 'Routes mock'}
            </div>
          )}
          {phase === 'ready' && tilesLoaded < tilesTotal && (
            <div className="absolute top-28 left-4 z-10 bg-gray-800/80 backdrop-blur px-3 py-1.5 rounded-full text-[10px] text-gray-400 border border-gray-700">
              Tuiles OSM: {tilesLoaded}/{tilesTotal}
            </div>
          )}
          {showRespawn && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-green-900/90 backdrop-blur px-5 py-2.5 rounded-full text-sm text-green-200 border border-green-700 font-semibold animate-bounce">
              🔄 Réapparition au point le plus proche de la route
            </div>
          )}
          {!carRef.current?.alive && carRef.current && !showRespawn && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-red-900/90 backdrop-blur px-5 py-2.5 rounded-full text-sm text-red-200 border border-red-700 font-semibold animate-pulse">
              💥 Voiture détruite - Réapparition dans {RESPAWN_DELAY/1000}s...
            </div>
          )}
          {mode === 'inference' && (
            <div className="absolute bottom-20 left-4 z-10 bg-cyan-900/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-cyan-200 border border-cyan-700">
              🤖 Confiance: {(inferenceConfidence * 100).toFixed(0)}% | Contexte: {inferenceContext}
            </div>
          )}
          {mode === 'training' && (
            <div className="absolute bottom-20 left-4 z-10 bg-purple-900/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-purple-200 border border-purple-700 animate-pulse">
               Entraînement: {trainingSamples} échantillons
            </div>
          )}
        </div>

        <aside className="bg-gray-900 rounded-2xl border border-gray-800 p-4 overflow-y-auto flex flex-col gap-3 max-h-[calc(100vh-100px)]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">KNN Road Explorer</p>
            <h2 className="text-lg font-bold text-white">Suivi de route continu</h2>
            <p className="text-xs text-gray-500 mt-1">Voiture: {CAR_LENGTH_METERS*100}cm × {CAR_WIDTH_METERS*100}cm</p>
            <p className="text-[10px] text-gray-600 mt-1 font-mono flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${apiRoutesLoaded ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              {dataSource}
            </p>
            <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold ${modeBadge.color} ${modeBadge.textColor}`}>
              {modeBadge.text}
            </div>
          </div>
          <hr className="border-gray-800" />
          
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Contrôle</p>
            <div className="flex gap-2 flex-wrap">
              {mode === 'manual' && !running && (
                <button onClick={handleStart} disabled={phase !== 'ready'}
                  className={`flex-1 text-xs rounded-lg py-2.5 font-semibold transition-colors ${phase === 'ready' ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                  {phase === 'ready' ? '▶ Démarrer' : 'Chargement…'}
                </button>
              )}
              {mode === 'manual' && running && (
                <>
                  <button onClick={handleStop} className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2.5 font-semibold cursor-pointer transition-colors"> Pause</button>
                  <button onClick={startTraining} disabled={phase !== 'ready'} 
                    className={`flex-1 text-xs rounded-lg py-2.5 font-semibold transition-colors ${phase === 'ready' ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                    🧠 Entraîner
                  </button>
                </>
              )}
              {mode === 'training' && (
                <button onClick={stopTrainingAndSave} className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg py-2.5 font-semibold cursor-pointer transition-colors animate-pulse">
                  ⏹ Arrêter & Sauver ({trainingSamples})
                </button>
              )}
              {mode === 'inference' && (
                <>
                  <button onClick={handleStop} className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2.5 font-semibold cursor-pointer transition-colors">⏸ Pause KNN</button>
                  <button onClick={() => { setMode('manual'); setRunning(false); }} className="flex-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded-lg py-2.5 font-semibold cursor-pointer transition-colors"> Manuel</button>
                </>
              )}
              <button onClick={handleReset} className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 font-medium cursor-pointer transition-colors border border-gray-700">🔄 Reset</button>
            </div>
          </div>

          {mode === 'training' && (
            <div className="flex gap-2">
              <input type="text" placeholder="Nom du modèle KNN" value={knnModelName} onChange={(e) => setKnnModelName(e.target.value)}
                className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
          )}

          {showModelPanel && (
            <div className="bg-gray-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-semibold text-gray-400 mb-2">📂 Modèles sauvegardés ({savedModels.length})</p>
              {savedModels.length === 0 ? <p className="text-xs text-gray-500">Aucun modèle sauvegardé</p> :
                savedModels.map((model) => (
                  <div key={model.id} className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{model.name}</p>
                      <p className="text-[10px] text-gray-500">Score: {model.score.toFixed(0)} | Distance: {model.distance.toFixed(0)}m</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => loadModel(model)} className="text-[10px] px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors">Charger</button>
                      <button onClick={() => deleteModel(model.id)} className="text-[10px] px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors">×</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {showKNNPanel && (
            <div className="bg-gray-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-semibold text-gray-400 mb-2">🧠 Modèles KNN ({savedKNNModels.length})</p>
              {savedKNNModels.length === 0 ? <p className="text-xs text-gray-500">Aucun modèle KNN. Entraînez d'abord !</p> :
                savedKNNModels.map((model) => (
                  <div key={model.id} className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{model.name}</p>
                      <p className="text-[10px] text-gray-500">{model.metadata.totalSamples} samples | Score: {model.metadata.bestScore.toFixed(0)}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => startInference(model)} className="text-[10px] px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors">🤖 Utiliser</button>
                      <button onClick={() => deleteKNNModel(model.id)} className="text-[10px] px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors">×</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ═══ PANNEAU ÉDUCATIF KNN ══ */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showKnnGuide && (
            <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/30 rounded-lg p-3 border border-amber-700/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  📚 Comment fonctionne le KNN ?
                </p>
                <button onClick={() => setShowKnnGuide(false)} className="text-amber-400 hover:text-amber-200 text-xs">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-2 flex-wrap">
                {[
                  { id: 'formula' as const, label: '📐 Formule' },
                  { id: 'steps' as const, label: '🔢 Étapes' },
                  { id: 'types' as const, label: '⚖️ Types' },
                  { id: 'tips' as const, label: '💡 Tips' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveGuideTab(tab.id)}
                    className={`text-[10px] px-2 py-1 rounded transition-colors ${
                      activeGuideTab === tab.id
                        ? 'bg-amber-600 text-white font-bold'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Contenu des tabs */}
              <div className="text-[11px] text-amber-100/90 space-y-2 max-h-64 overflow-y-auto">
                {activeGuideTab === 'formula' && (
                  <>
                    <div className="bg-gray-900/60 rounded p-2 border border-amber-700/30">
                      <p className="text-[10px] text-amber-400 font-bold mb-1">📐 Distance Euclidienne (principale)</p>
                      <div className="bg-black/40 rounded p-2 font-mono text-center text-xs text-emerald-300">
                        d(x,y) = √ Σ(xᵢ - yᵢ)²
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1 italic">
                        Pour x=(x₁,x₂,...,xₙ) et y=(y₁,y₂,...,yₙ)
                      </p>
                    </div>
                    <div className="bg-gray-900/60 rounded p-2 border border-amber-700/30">
                      <p className="text-[10px] text-amber-400 font-bold mb-1">📏 Autres distances possibles</p>
                      <div className="space-y-1 text-[10px]">
                        <div className="bg-black/30 rounded px-2 py-1 font-mono text-cyan-300">
                          Manhattan: d = Σ|x - yᵢ|
                        </div>
                        <div className="bg-black/30 rounded px-2 py-1 font-mono text-purple-300">
                          Minkowski: généralisation
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeGuideTab === 'steps' && (
                  <div className="space-y-2">
                    {[
                      { num: '1', icon: '', title: 'Choisir un nombre K', desc: 'Ex: K = 3, 5, 7… (actuel: K=' + kValue + ')' },
                      { num: '2', icon: '📏', title: 'Calculer la distance', desc: 'Entre le nouveau point et tous les points d\'entraînement' },
                      { num: '3', icon: '🏆', title: 'Trouver les K plus proches', desc: 'On sélectionne les K points les plus proches' },
                      { num: '4', icon: '✅', title: 'Décision finale', desc: 'Classe majoritaire (classification) ou moyenne (régression)' }
                    ].map((step) => (
                      <div key={step.num} className="flex gap-2 bg-gray-900/60 rounded p-2 border border-amber-700/30">
                        <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {step.num}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-amber-200">{step.icon} {step.title}</p>
                          <p className="text-[10px] text-gray-300">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeGuideTab === 'types' && (
                  <div className="space-y-2">
                    <div className="bg-gradient-to-r from-blue-900/40 to-blue-800/20 rounded p-2 border border-blue-700/50">
                      <p className="text-[11px] font-bold text-blue-300 mb-1">🔹 Classification</p>
                      <p className="text-[10px] text-blue-100/80 mb-1">On prend la classe majoritaire :</p>
                      <div className="bg-black/40 rounded p-1.5 text-[10px] font-mono space-y-0.5">
                        <div>voisin 1 → A</div>
                        <div>voisin 2 → B</div>
                        <div>voisin 3 → A</div>
                        <div className="text-emerald-400 font-bold">➡️ Résultat = A</div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 rounded p-2 border border-emerald-700/50">
                      <p className="text-[11px] font-bold text-emerald-300 mb-1"> Régression</p>
                      <p className="text-[10px] text-emerald-100/80 mb-1">On prend la moyenne des valeurs :</p>
                      <div className="bg-black/40 rounded p-1.5 text-[10px] font-mono text-center">
                         = (1/K) Σ yᵢ
                      </div>
                    </div>
                  </div>
                )}

                {activeGuideTab === 'tips' && (
                  <div className="space-y-1.5">
                    {[
                      { icon: '✔', color: 'text-emerald-400', text: 'Pas d\'entraînement réel (lazy learning)' },
                      { icon: '✔', color: 'text-emerald-400', text: 'Sensible au choix de K' },
                      { icon: '✔', color: 'text-emerald-400', text: 'Sensible à l\'échelle (normalisation importante)' },
                      { icon: '✔', color: 'text-emerald-400', text: 'Simple mais coûteux pour grands datasets' }
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-900/60 rounded p-2 border border-amber-700/30">
                        <span className={`${tip.color} font-bold`}>{tip.icon}</span>
                        <span className="text-[10px] text-gray-200">{tip.text}</span>
                      </div>
                    ))}
                    <div className="bg-amber-900/40 rounded p-2 border border-amber-600/50 mt-2">
                      <p className="text-[10px] text-amber-200 font-bold">📌 Résumé simple</p>
                      <p className="text-[10px] text-amber-100/80 mt-1 italic">
                        KNN = "Regarde les K voisins les plus proches et décide selon eux"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <hr className="border-gray-800" />
          
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Statut</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">État</span>
                <span className={`font-mono font-bold ${carRef.current?.alive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {carRef.current?.alive ? '✅ En vie' : '❌ Détruite'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Score</span>
                <span className="font-mono text-amber-400">{score.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Distance</span>
                <span className="font-mono text-cyan-400">{totalDistanceRef.current.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Réapparitions</span>
                <span className="font-mono text-blue-400">{respawnCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Couverture</span>
                <span className="font-mono text-violet-400">{carRef.current?.coverage || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Risque collision</span>
                <span className={`font-mono font-bold ${collisionRisk > 0.6 ? 'text-red-400 animate-pulse' : collisionRisk > 0.35 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(collisionRisk * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-200" style={{ 
                  width: `${collisionRisk * 100}%`,
                  backgroundColor: collisionRisk > 0.6 ? '#ef4444' : collisionRisk > 0.35 ? '#f59e0b' : '#22c55e'
                }} />
              </div>
              <div className="text-[9px] text-gray-400 italic"> {situation}</div>
              {mode === 'inference' && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Confiance KNN</span><span className="font-mono text-cyan-400">{(inferenceConfidence * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Contexte</span><span className="font-mono text-purple-400">{inferenceContext}</span></div>
                </>
              )}
              {mode === 'training' && (
                <div className="flex justify-between"><span className="text-gray-500">Échantillons</span><span className="font-mono text-purple-400">{trainingSamples}</span></div>
              )}
            </div>
          </div>
          <hr className="border-gray-800" />
          
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">K = <span className="text-blue-400 font-mono font-bold">{kValue}</span></p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">1</span>
              <input type="range" min={1} max={20} step={1} value={kValue} onChange={(e) => setKValue(parseInt(e.target.value))} className="flex-1 h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
              <span className="text-xs text-gray-600">20</span>
            </div>
          </div>
          <hr className="border-gray-800" />
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Capteurs</p>
              <button onClick={toggleSensors} className={`text-[10px] px-2 py-0.5 rounded ${showSensors ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700/30 text-gray-400'} border ${showSensors ? 'border-blue-600/30' : 'border-gray-700/30'} transition-colors`}>
                {showSensors ? ' ON' : '📡 OFF'}
              </button>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
              {sensors.length > 0 ? sensors.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-16 text-[10px] text-gray-400 truncate">{sensorLabels[i]}</div>
                  <div className="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-150" style={{ 
                      width: `${(s || 0) * 100}%`,
                      backgroundColor: (s || 0) > 0.6 ? '#22c55e' : (s || 0) > 0.3 ? '#f59e0b' : '#ef4444'
                    }} />
                  </div>
                  <div className="w-12 text-right font-mono text-[10px] text-gray-300">{((s || 0) * 100).toFixed(0)}%</div>
                </div>
              )) : <div className="text-xs text-gray-500 text-center py-4">Aucune donnée capteur</div>}
            </div>
          </div>
          
          <hr className="border-gray-800" />
          
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Réseau</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Routes</span>
                <span className="font-mono text-white font-bold flex items-center gap-1">
                  {routesCount}
                  {apiRoutesLoaded && <span className="text-[8px] bg-emerald-600 px-1 rounded">API</span>}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Intersections</span><span className="font-mono text-violet-400 font-bold">{intersectionsCount}</span></div>
            </div>
          </div>
          <hr className="border-gray-800" />
          
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Code de la Route</p>
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${roadCode.conforme ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800' : 'bg-red-900/40 text-red-300 border-red-800'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${roadCode.conforme ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                {roadCode.conforme ? '✅ Conforme' : ' Non conforme'}
              </div>
              <p className="mt-1 text-[10px] opacity-70">{roadCode.raison}</p>
            </div>
          </div>
          <hr className="border-gray-800" />
          
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Vitesse : <span className="text-white font-mono text-sm">{speedKmh} km/h</span></p>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-100" style={{ 
                width: `${Math.min(100, (speed / (MAX_SPEED * 3.6)) * 100)}%`, 
                backgroundColor: speed > MAX_SPEED * 3.6 * 0.7 ? '#ef4444' : speed > MAX_SPEED * 3.6 * 0.4 ? '#f59e0b' : '#22c55e' 
              }} />
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
              <span>0</span><span>{SPEED_LIMIT_KMH} km/h</span><span>{(MAX_SPEED * 3.6).toFixed(0)} max</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}