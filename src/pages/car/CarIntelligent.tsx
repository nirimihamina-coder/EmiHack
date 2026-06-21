import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoutes, fetchRouteCoordinates } from '../../services/roadService';
import type { ApiRoute } from '../../services/roadService';

// Correction des icônes Leaflet sans dépendre des imports d'images locaux qui bloquent TypeScript
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Neural Network ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'emihack_best_car_model';

class NeuralNetwork {
  private weights: number[][][] = [];
  private biases: number[][] = [];

  constructor(layers: number[]) {
    for (let i = 0; i < layers.length - 1; i++) {
      const w: number[][] = [];
      const b: number[] = [];
      for (let j = 0; j < layers[i + 1]; j++) {
        w.push(Array.from({ length: layers[i] }, () => (Math.random() - 0.5) * 2));
        b.push((Math.random() - 0.5) * 2);
      }
      this.weights.push(w);
      this.biases.push(b);
    }
  }

  setWeights(layer: number, w: number[][]) { this.weights[layer] = w; }
  setBiases(layer: number, b: number[]) { this.biases[layer] = b; }

  forward(input: number[]): number[] {
    let current = input;
    for (let l = 0; l < this.weights.length; l++) {
      const next: number[] = [];
      for (let j = 0; j < this.weights[l].length; j++) {
        let sum = this.biases[l][j];
        for (let k = 0; k < current.length; k++) {
          sum += this.weights[l][j][k] * current[k];
        }
        next.push(Math.tanh(sum));
      }
      current = next;
    }
    return current;
  }

  clone(): NeuralNetwork {
    const nn = new NeuralNetwork([]);
    nn.weights = this.weights.map(l => l.map(n => [...n]));
    nn.biases = this.biases.map(l => [...l]);
    return nn;
  }

  mutate(rate = 0.1, amount = 0.3) {
    for (let l = 0; l < this.weights.length; l++) {
      for (let j = 0; j < this.weights[l].length; j++) {
        for (let k = 0; k < this.weights[l][j].length; k++) {
          if (Math.random() < rate) this.weights[l][j][k] += (Math.random() - 0.5) * 2 * amount;
        }
      }
      for (let j = 0; j < this.biases[l].length; j++) {
        if (Math.random() < rate) this.biases[l][j] += (Math.random() - 0.5) * 2 * amount;
      }
    }
  }

  serialize(): string {
    return JSON.stringify({ weights: this.weights, biases: this.biases });
  }

  static deserialize(json: string): NeuralNetwork | null {
    try {
      const data = JSON.parse(json);
      const nn = new NeuralNetwork([]);
      nn.weights = data.weights;
      nn.biases = data.biases;
      return nn;
    } catch { return null; }
  }

  static loadBest(): NeuralNetwork | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return NeuralNetwork.deserialize(raw);
  }

  saveBest() {
    localStorage.setItem(STORAGE_KEY, this.serialize());
  }

  static clearBest() {
    localStorage.removeItem(STORAGE_KEY);
  }

  getWeights() { return this.weights; }
  getBiases() { return this.biases; }
}

// ── Intersection pre-computation ───────────────────────────────────────────────
interface Intersection {
  routeA: number;
  waypointA: number;
  routeB: number;
  waypointB: number;
  latlng: [number, number];
}

interface SensorReading {
  angle: number;       // degrees relative to heading (-30, -15, 0, 15, 30)
  distance: number;    // lookahead in waypoints
  curvature: number;   // road curvature at that point [0-1]
  hitLatLng: [number, number]; // where the sensor lands on the road
  lateralOffset: number; // how far from center [-1 to 1, negative=left, positive=right]
}

const INTERSECTION_THRESHOLD = 0.003;
const RIGHT_OFFSET = 0.002;

// ── Intelligent Car Controller ─────────────────────────────────────────────────
class IntelligentCar {
  routesCoords: [number, number][][] = [];
  intersections: Intersection[] = [];
  currentRouteIndex = 0;
  progress = 0;
  speed = 0;
  maxSpeed = 0.0035;
  network: NeuralNetwork;
  waypointIndex = 0;
  direction: 1 | -1 = 1;
  deviationChance = 0.008;
  history: { speed: number; inputs: number[]; outputs: number[] }[] = [];
  speedMultiplier = 1;
  zoom = 14;

  private get effectiveOffset() {
    return RIGHT_OFFSET / Math.pow(2, this.zoom - 14);
  }

  // Fitness tracking
  fitnessScore = 0;
  fitnessSamples = 0;
  bestFitness = 0;
  generation = 1;

  // Sensor readings
  sensors: SensorReading[] = [];
  sensorAngles = [-25, -12, 0, 12, 25];
  sensorLookaheads = [15, 15, 15, 15, 15];

  get routeCoords() {
    return this.routesCoords[this.currentRouteIndex] ?? [];
  }

  constructor(loadBest = false) {
    const saved = loadBest ? NeuralNetwork.loadBest() : null;
    if (saved && saved.getWeights().length > 0) {
      this.network = saved;
      const raw = localStorage.getItem('emihack_best_gen');
      this.generation = raw ? parseInt(raw) : 1;
      this.bestFitness = parseFloat(localStorage.getItem('emihack_best_fitness') || '0');
    } else {
      this.network = new NeuralNetwork([8, 8, 1]);
      this.initDrivingPolicy();
    }
  }

  private initDrivingPolicy() {
    const w0 = this.network.getWeights()[0];
    const b0 = this.network.getBiases()[0];

    // Keep existing 6 hidden neurons preset, expand row 0–5 col 0–3 for old 4 inputs
    if (w0.length >= 6 && w0[0].length >= 8) {
      const preset = [
        [0.3, -2.5, -1.8, -0.1],
        [-1.2, 0.5, 0.3, 0.1],
        [0.1, 1.8, 2.2, 0.3],
        [-0.2, -0.5, -2.0, -0.2],
        [2.0, -1.0, -1.0, 0.5],
        [0.0, 0.0, 0.0, 0.0],
      ];
      const presetB = [0.5, 0.0, -0.5, 0.0, -0.3, 0.0];
      for (let j = 0; j < 6; j++) {
        for (let k = 0; k < 4; k++) w0[j][k] = preset[j][k];
        b0[j] = presetB[j];
      }
    }

    // Output layer preset
    const w1 = this.network.getWeights()[1];
    const b1 = this.network.getBiases()[1];
    if (w1.length >= 1 && w1[0].length >= 8) {
      const outPreset = [1.2, -2.5, -1.0, -0.5, 2.0, 0.0];
      for (let k = 0; k < 6; k++) w1[0][k] = outPreset[k];
      b1[0] = 0.0;
    }
  }

  setRoutes(coordsList: [number, number][][]) {
    this.routesCoords = coordsList.filter((c) => c.length >= 2);
    this.currentRouteIndex = 0;
    this.progress = 0;
    this.speed = 0;
    this.waypointIndex = 0;
    this.direction = 1;
    this.history = [];
    this.fitnessScore = 0;
    this.fitnessSamples = 0;
    this.sensors = [];
    this.computeIntersections();
  }

  private computeIntersections() {
    this.intersections = [];
    const T = INTERSECTION_THRESHOLD;
    for (let a = 0; a < this.routesCoords.length; a++) {
      for (let b = a + 1; b < this.routesCoords.length; b++) {
        const ra = this.routesCoords[a];
        const rb = this.routesCoords[b];
        for (let ai = 0; ai < ra.length; ai++) {
          let bestB = -1;
          let bestD = T;
          for (let bi = 0; bi < rb.length; bi++) {
            const d = this.dist(ra[ai], rb[bi]);
            if (d < bestD) { bestD = d; bestB = bi; }
          }
          if (bestB >= 0) {
            this.intersections.push({
              routeA: a, waypointA: ai,
              routeB: b, waypointB: bestB,
              latlng: ra[ai],
            });
          }
        }
      }
    }
  }

  private getCurvature(index: number): number {
    const rc = this.routeCoords;
    if (index <= 0 || index >= rc.length - 1) return 0;
    const prev = rc[index - 1];
    const curr = rc[index];
    const next = rc[index + 1];
    const a = Math.atan2(curr[0] - prev[0], curr[1] - prev[1]);
    const b = Math.atan2(next[0] - curr[0], next[1] - curr[1]);
    let diff = b - a;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) / Math.PI;
  }

  private dist(a: [number, number], b: [number, number]): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
  }

  /** Compute sensor readings: project rays ahead along the road */
  private computeSensors(): SensorReading[] {
    const rc = this.routeCoords;
    if (rc.length < 2) return [];
    const total = rc.length - 1;
    const rawIdx = this.progress * total;
    const idx = Math.min(Math.floor(rawIdx), total - 1);
    const t = rawIdx - idx;
    const a = rc[idx];
    const b = rc[idx + 1];
    const dir = this.direction;

    return this.sensorAngles.map((angleDeg, si) => {
      const lookahead = this.sensorLookaheads[si];
      let hitIdx = idx;
      let hitLatLng: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      let curvature = 0;

      for (let step = 0; step < lookahead; step++) {
        const nextIdx = dir === 1
          ? Math.min(hitIdx + 1, rc.length - 2)
          : Math.max(0, hitIdx - 1);
        if (nextIdx === hitIdx) break;
        hitIdx = nextIdx;
        hitLatLng = rc[hitIdx];
        curvature = Math.max(curvature, this.getCurvature(hitIdx));
      }

      // Project the sensor angle offset onto the perpendicular
      const lateralOffset = Math.sin((angleDeg * Math.PI) / 180) * lookahead * 0.01;

      return {
        angle: angleDeg,
        distance: lookahead,
        curvature,
        hitLatLng,
        lateralOffset: Math.max(-1, Math.min(1, lateralOffset)),
      };
    });
  }

  tick() {
    const rc = this.routeCoords;
    if (rc.length < 2) {
      if (this.routesCoords.length > 0) this.switchRoute(0);
      return;
    }

    const rawIdx = this.progress * (rc.length - 1);
    const idx = Math.min(Math.floor(rawIdx), rc.length - 2);
    this.waypointIndex = idx;

    // Compute sensor readings
    this.sensors = this.computeSensors();

    const currSpeed = this.speed / this.maxSpeed;
    const lookIdx = this.direction === 1
      ? Math.min(idx + 1, rc.length - 2)
      : Math.max(1, idx);
    const curvature = this.getCurvature(lookIdx);
    const avgCurvature3 = (() => {
      let sum = 0, count = 0;
      for (let i = 0; i < 4; i++) {
        const li = this.direction === 1
          ? Math.min(lookIdx + i, rc.length - 2)
          : Math.max(1, lookIdx - i);
        if (li > 0 && li < rc.length - 1) { sum += this.getCurvature(li); count++; }
      }
      return count > 0 ? sum / count : 0;
    })();
    const distToEnd = this.direction === 1 ? 1 - this.progress : this.progress;

    // Sensor-derived features
    const leftSensors = this.sensors.filter(s => s.angle < -5);
    const centerSensors = this.sensors.filter(s => s.angle >= -5 && s.angle <= 5);
    const rightSensors = this.sensors.filter(s => s.angle > 5);
    const leftCurv = leftSensors.reduce((a, s) => a + s.curvature, 0) / Math.max(1, leftSensors.length);
    const centerCurv = centerSensors.reduce((a, s) => a + s.curvature, 0) / Math.max(1, centerSensors.length);
    const rightCurv = rightSensors.reduce((a, s) => a + s.curvature, 0) / Math.max(1, rightSensors.length);
    const maxLateral = Math.max(...this.sensors.map(s => Math.abs(s.lateralOffset)), 0.001);

    // 8 inputs: [currSpeed, curvature, avgCurvature3, distToEnd, leftCurv, centerCurv, rightCurv, maxLateral]
    const inputs = [currSpeed, curvature, avgCurvature3, distToEnd, leftCurv, centerCurv, rightCurv, maxLateral];
    const outputs = this.network.forward(inputs);
    const targetSpeed = Math.max(0.005, (outputs[0] + 1) / 2) * this.maxSpeed * this.speedMultiplier;
    const t = 0.1;
    this.speed += (targetSpeed - this.speed) * t;

    this.progress += this.speed * this.direction;

    if (this.progress >= 1) { this.progress = 1; this.direction = -1; }
    if (this.progress <= 0) { this.progress = 0; this.direction = 1; }

    if (Math.random() < this.deviationChance) this.tryDeviate();

    // Fitness: reward high speed with smoothness penalty on curves
    const curvePenalty = 1 - curvature * 0.5;
    const sampleScore = currSpeed * curvePenalty;
    this.fitnessScore += sampleScore;
    this.fitnessSamples++;
    if (this.fitnessSamples > 500) {
      this.fitnessScore *= 0.9;
      this.fitnessSamples *= 0.9;
    }
    const avgFitness = this.fitnessSamples > 0 ? this.fitnessScore / this.fitnessSamples : 0;
    if (avgFitness > this.bestFitness) {
      this.bestFitness = avgFitness;
      this.network.saveBest();
      localStorage.setItem('emihack_best_fitness', this.bestFitness.toString());
      localStorage.setItem('emihack_best_gen', this.generation.toString());
    }

    this.history.push({ speed: this.speed, inputs, outputs: [targetSpeed] });
    if (this.history.length > 200) this.history.shift();
  }

  private tryDeviate() {
    if (this.intersections.length === 0) return;
    const pos = this.getPosition();
    if (!pos) return;

    const candidates = this.intersections.filter(
      (ix) => ix.routeA === this.currentRouteIndex || ix.routeB === this.currentRouteIndex
    );
    if (candidates.length === 0) return;

    for (const ix of candidates) {
      const d = this.dist(pos, ix.latlng);
      if (d < INTERSECTION_THRESHOLD) {
        const targetRoute = ix.routeA === this.currentRouteIndex ? ix.routeB : ix.routeA;
        const targetWp = ix.routeA === this.currentRouteIndex ? ix.waypointB : ix.waypointA;
        if (targetRoute >= this.routesCoords.length) continue;
        const targetLen = this.routesCoords[targetRoute].length;
        const dir: 1 | -1 = targetWp < targetLen - 1 ? 1 : -1;
        this.switchRoute(targetRoute, targetWp, dir);
        return;
      }
    }
  }

  private switchRoute(index: number, waypoint?: number, dir?: 1 | -1) {
    this.currentRouteIndex = index;
    const rc = this.routeCoords;
    this.progress = waypoint !== undefined
      ? waypoint / (rc.length - 1)
      : 0;
    this.direction = dir ?? 1;
    this.speed *= 0.5;
  }

  nextGeneration() {
    this.network.mutate(0.15, 0.4);
    this.generation++;
    this.fitnessScore = 0;
    this.fitnessSamples = 0;
    this.progress = 0;
    this.speed = 0;
    this.direction = 1;
    this.history = [];
  }

  /** Centerline position */
  getPosition(): [number, number] | null {
    const rc = this.routeCoords;
    if (rc.length < 2) return null;
    const total = rc.length - 1;
    const rawIdx = this.progress * total;
    const idx = Math.min(Math.floor(rawIdx), total - 1);
    const t = rawIdx - idx;
    const a = rc[idx];
    const b = rc[idx + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /** Right‑side offset position (keep‑right rule) */
  getRightPosition(): [number, number] | null {
    const rc = this.routeCoords;
    if (rc.length < 2) return null;
    const total = rc.length - 1;
    const rawIdx = this.progress * total;
    const idx = Math.min(Math.floor(rawIdx), total - 1);
    const t = rawIdx - idx;
    const a = rc[idx];
    const b = rc[idx + 1];

    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) return [a[0], a[1]];

    const nx = dx / len;
    const ny = dy / len;
    const rx = -ny;
    const ry = nx;
    const sign = this.direction;
    const offset = this.effectiveOffset;

    return [
      a[0] + dx * t + rx * offset * sign,
      a[1] + dy * t + ry * offset * sign,
    ];
  }

  getIntersections(): Intersection[] { return this.intersections; }
  getSensors(): SensorReading[] { return this.sensors; }

  getState() {
    const avgFitness = this.fitnessSamples > 0 ? this.fitnessScore / this.fitnessSamples : 0;
    return {
      speed: this.speed / this.maxSpeed,
      waypointIndex: this.waypointIndex,
      progress: this.progress,
      direction: this.direction,
      currentRouteIndex: this.currentRouteIndex,
      totalRoutes: this.routesCoords.length,
      fitness: avgFitness,
      bestFitness: this.bestFitness,
      generation: this.generation,
      speedMultiplier: this.speedMultiplier,
      lastInputs: this.history.length > 0 ? this.history[this.history.length - 1].inputs : [0, 0, 0, 0, 0, 0, 0, 0],
      lastOutput: this.history.length > 0 ? this.history[this.history.length - 1].outputs[0] : 0,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const TILES = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'OpenStreetMap' },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'OpenTopoMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
};

type TileKey = keyof typeof TILES;

const ROUTE_COLORS = ['#ea580c', '#ca8a04', '#6b7280', '#2563eb', '#059669', '#7c3aed', '#db2777', '#0891b2'];

// ── Merge selected routes into one continuous path at intersections ────────────
function mergeRoutes(routesCoords: [number, number][][]): [number, number][] {
  if (routesCoords.length === 0) return [];
  if (routesCoords.length === 1) return routesCoords[0];

  let merged = [...routesCoords[0]];

  for (let i = 1; i < routesCoords.length; i++) {
    const next = routesCoords[i];
    let bestDist = Infinity;
    let bestMergedIdx = -1;
    let bestNextIdx = -1;

    const checkRange = Math.min(100, merged.length);
    for (let mi = merged.length - checkRange; mi < merged.length; mi++) {
      for (let ni = 0; ni < Math.min(100, next.length); ni++) {
        const d = Math.sqrt((merged[mi][0] - next[ni][0]) ** 2 + (merged[mi][1] - next[ni][1]) ** 2);
        if (d < bestDist) { bestDist = d; bestMergedIdx = mi; bestNextIdx = ni; }
      }
    }

    if (bestDist < INTERSECTION_THRESHOLD * 3) {
      merged = merged.slice(0, bestMergedIdx + 1);
      merged.push(...next.slice(bestNextIdx));
    } else {
      merged.push(...next);
    }
  }

  // Deduplicate: remove consecutive waypoints that are too close
  const minDist = INTERSECTION_THRESHOLD * 0.5;
  const deduped: [number, number][] = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    const prev = deduped[deduped.length - 1];
    const d = Math.sqrt((merged[i][0] - prev[0]) ** 2 + (merged[i][1] - prev[1]) ** 2);
    if (d >= minDist) deduped.push(merged[i]);
  }

  return deduped;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CarIntelligent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const carMarkerRef = useRef<L.CircleMarker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const intersectionMarkersRef = useRef<L.CircleMarker[]>([]);
  const sensorLinesRef = useRef<L.Polyline[]>([]);
  const sensorDotsRef = useRef<L.CircleMarker[]>([]);
  const carRef = useRef<IntelligentCar | null>(null);
  const animRef = useRef<number>(0);

  const [tileKey, setTileKey] = useState<TileKey>('osm');
  const [routes, setRoutes] = useState<(ApiRoute & { coords: [number, number][] })[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [followCar, setFollowCar] = useState(false);
  const [mapZoom, setMapZoom] = useState(13);
  const [carState, setCarState] = useState({ speed: 0, waypointIndex: 0, progress: 0, direction: 1, currentRouteIndex: 0, totalRoutes: 0, fitness: 0, bestFitness: 0, generation: 1, speedMultiplier: 1, lastInputs: [0, 0, 0, 0, 0, 0, 0, 0], lastOutput: 0 });

  const prepareCar = useCallback((ids: Set<string>) => {
    const selected = routes.filter((r) => ids.has(r.id));
    if (selected.length === 0) return;
    const merged = mergeRoutes(selected.map((r) => r.coords));
    const car = new IntelligentCar(true);
    car.setRoutes([merged]);
    carRef.current = car;
    trailRef.current?.remove();
    trailRef.current = null;
    
    // Create car marker at start position
    const startPos = merged[0];
    if (startPos && mapRef.current) {
      if (carMarkerRef.current) carMarkerRef.current.remove();
      carMarkerRef.current = L.circleMarker(startPos, {
        radius: 12, color: '#fff', weight: 4, fillColor: '#ef4444', fillOpacity: 1,
      }).addTo(mapRef.current);
      mapRef.current.setView(startPos, 17, { animate: false });
    }
    // Remove old sensor viz
    sensorLinesRef.current.forEach((l) => l.remove());
    sensorLinesRef.current = [];
    sensorDotsRef.current.forEach((d) => d.remove());
    sensorDotsRef.current = [];
    // Add intersection markers
    intersectionMarkersRef.current.forEach((m) => m.remove());
    intersectionMarkersRef.current = [];
    if (mapRef.current) {
      car.getIntersections().forEach((ix) => {
        const m = L.circleMarker(ix.latlng, {
          radius: 4,
          color: '#a78bfa',
          weight: 2,
          fillColor: '#c4b5fd',
          fillOpacity: 0.7,
        }).addTo(mapRef.current!);
        intersectionMarkersRef.current.push(m);
      });
    }
    setRunning(false);
    setCarState(car.getState());
  }, [routes]);

  const toggleRoute = useCallback((id: string) => {
    if (running) return;
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [running]);

  // Fetch routes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const apiRoutes = await fetchRoutes();
        if (cancelled) return;
        const withCoords = await Promise.all(
          apiRoutes.map(async (r) => {
            try {
              const coords = await fetchRouteCoordinates(r.id);
              const latLng = coords.map((c) => [c[1], c[0]] as [number, number]);
              return { ...r, coords: latLng };
            } catch { return null; }
          })
        );
        if (cancelled) return;
        const valid = withCoords.filter((r): r is NonNullable<typeof r> => r !== null && r.coords.length >= 2);
        setRoutes(valid);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Init map
  useEffect(() => {
    if (loading || !containerRef.current || mapRef.current) return;
    const el = containerRef.current;
    const map = L.map(el, { zoomControl: true }).setView([-21.45, 47.085], 13);
    mapRef.current = map;
    tileRef.current = L.tileLayer(TILES.osm.url, { attribution: TILES.osm.attribution, maxZoom: 19 }).addTo(map);
    map.on('zoomend', () => setMapZoom(map.getZoom()));
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
    return () => { map.remove(); mapRef.current = null; };
  }, [loading]);

  // Switch tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    if (tileRef.current.options.attribution === TILES[tileKey].attribution) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[tileKey].url, { attribution: TILES[tileKey].attribution, maxZoom: 19 }).addTo(map);
  }, [tileKey]);

  // Display routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routeLinesRef.current.forEach((l) => l.remove());
    routeLinesRef.current = [];

    routes.forEach((route, i) => {
      if (route.coords.length < 2) return;
      const isSelected = selectedRouteIds.has(route.id);
      const line = L.polyline(route.coords, {
        color: isSelected ? '#f59e0b' : ROUTE_COLORS[i % ROUTE_COLORS.length],
        weight: isSelected ? Math.round(2 * Math.pow(1.5, mapZoom - 13)) : Math.round(1.5 * Math.pow(1.5, mapZoom - 13)),
        opacity: isSelected ? 0.9 : 0.4,
        dashArray: isSelected ? undefined : '6,8',
        fill: false,
      }).addTo(map);

      line.on('click', () => toggleRoute(route.id));

      routeLinesRef.current.push(line);
    });
  }, [routes, selectedRouteIds, toggleRoute, mapZoom]);

  // Highlight active route when car transitions
  useEffect(() => {
    routeLinesRef.current.forEach((line, i) => {
      const route = routes[i];
      if (!route) return;
      const isActive = carRef.current && route.id === routes[carState.currentRouteIndex]?.id;
      const isSelected = selectedRouteIds.has(route.id);
      const w = (w0: number) => Math.round(w0 * Math.pow(1.5, mapZoom - 13));
      if (isActive) {
        line.setStyle({ color: '#10b981', weight: w(4), opacity: 1, dashArray: undefined });
      } else if (isSelected) {
        line.setStyle({ color: '#f59e0b', weight: w(2), opacity: 0.9, dashArray: undefined });
      } else {
        line.setStyle({ color: ROUTE_COLORS[i % ROUTE_COLORS.length], weight: w(1.5), opacity: 0.4, dashArray: '6,8' });
      }
    });
  }, [carState.currentRouteIndex, selectedRouteIds, routes, mapZoom]);

  // Auto-prepare car when routes are selected
  useEffect(() => {
    if (selectedRouteIds.size > 0 && !running) {
      prepareCar(selectedRouteIds);
    }
  }, [selectedRouteIds, prepareCar, running]);

  // Animation loop
  const animate = useCallback(() => {
    if (!carRef.current || !mapRef.current) return;
    carRef.current.tick();
    carRef.current.zoom = mapRef.current.getZoom();
    const centerPos = carRef.current.getPosition();
    if (centerPos) {
      const col = '#ef4444';
      if (!carMarkerRef.current) {
        const zoom = mapRef.current.getZoom();
        const tw = Math.round(6 * Math.pow(1.5, zoom - 13));
        carMarkerRef.current = L.circleMarker(centerPos, {
          radius: 12, color: '#fff', weight: 4, fillColor: col, fillOpacity: 1,
        }).addTo(mapRef.current);
        trailRef.current = L.polyline([], { color: '#f59e0b', weight: tw, opacity: 0.5, dashArray: '4,6' }).addTo(mapRef.current);
      } else {
        carMarkerRef.current.setStyle({ fillColor: col });
        carMarkerRef.current.setLatLng(centerPos);
        const zoom = mapRef.current.getZoom();
        const tw = Math.round(6 * Math.pow(1.5, zoom - 13));
        const trail = trailRef.current;
        if (trail) {
          trail.setStyle({ weight: tw });
          const latlngs = trail.getLatLngs() as L.LatLng[];
          latlngs.push(L.latLng(centerPos[0], centerPos[1]));
          if (latlngs.length > 50) latlngs.splice(0, latlngs.length - 50);
          trail.setLatLngs(latlngs);
        }
      }

      // Update sensor visualization
      const sensors = carRef.current.getSensors();
      const map = mapRef.current;

      // Remove old sensor elements
      sensorLinesRef.current.forEach((l) => l.remove());
      sensorLinesRef.current = [];
      sensorDotsRef.current.forEach((d) => d.remove());
      sensorDotsRef.current = [];

      // Draw sensor beams
      sensors.forEach((s) => {
        const curvature = s.curvature;
        let sensorCol = '#22c55e';
        if (curvature >= 0.65) sensorCol = '#ef4444';
        else if (curvature >= 0.35) sensorCol = '#f59e0b';

        // Line from car to sensor endpoint
        const line = L.polyline([centerPos, s.hitLatLng], {
          color: sensorCol,
          weight: 1.5,
          opacity: 0.4,
          dashArray: '2,4',
        }).addTo(map);
        sensorLinesRef.current.push(line);

        // Endpoint dot
        const dot = L.circleMarker(s.hitLatLng, {
          radius: 3,
          color: sensorCol,
          weight: 2,
          fillColor: sensorCol,
          fillOpacity: 0.8,
        }).addTo(map);
        sensorDotsRef.current.push(dot);
      });

      // Follow car
      if (followCar && mapRef.current) {
        mapRef.current.setView(centerPos, 18, { animate: false });
      }
    }
    setCarState(carRef.current.getState());
    animRef.current = requestAnimationFrame(animate);
  }, [followCar]);

  const handleStart = useCallback(() => {
    if (selectedRouteIds.size === 0) return;
    if (!carRef.current) prepareCar(selectedRouteIds);
    setRunning(true);
    animRef.current = requestAnimationFrame(animate);
  }, [animate, selectedRouteIds, prepareCar]);

  const handleStop = useCallback(() => {
    setRunning(false);
    cancelAnimationFrame(animRef.current);
  }, []);

  const handleReset = useCallback(() => {
    handleStop();
    sensorLinesRef.current.forEach((l) => l.remove());
    sensorLinesRef.current = [];
    sensorDotsRef.current.forEach((d) => d.remove());
    sensorDotsRef.current = [];
    prepareCar(selectedRouteIds);
  }, [handleStop, selectedRouteIds, prepareCar]);

  const inputLabels = ['Vitesse', 'Courbure', 'Courbure moy.', 'Dist. fin', 'Courb. gauche', 'Courb. centre', 'Courb. droite', 'Décalage latéral'];

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        Chargement des routes intelligentes...
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_320px] gap-3 h-full">
        {/* Map */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm relative">
          <div ref={containerRef} className="w-full" style={{ height: 'calc(100vh - 190px)', minHeight: '400px' }} />

          <div className="absolute top-2 left-2 z-1000 flex gap-1">
            {(Object.keys(TILES) as TileKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setTileKey(k)}
                className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${
                  tileKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/80 text-gray-600 border-gray-300 hover:bg-white'
                }`}
              >
                {k === 'osm' ? 'Carte' : k === 'topo' ? 'Relief' : 'Satellite'}
              </button>
            ))}
          </div>

          {selectedRouteIds.size === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-1000 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-xs text-gray-500 border border-gray-200 pointer-events-none">
              Cliquez sur plusieurs routes, puis lancez la voiture
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Voiture Intelligente
            </p>
            <h2 className="text-lg font-bold text-gray-800">RNA - Conduite autonome</h2>
            <p className="text-xs text-gray-400 mt-1">
              Réseau de neurones artificiels (8→8→1) contrôlant la vitesse via senseurs avant
            </p>
          </div>

          <hr className="border-gray-100" />

          {/* Route selector */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Routes sélectionnées ({selectedRouteIds.size})
            </p>
            {selectedRouteIds.size > 0 ? (
              <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                {routes.filter((r) => selectedRouteIds.has(r.id)).map((route) => {
                  const isRunning = running && selectedRouteIds.size > 1;
                  return (
                    <div key={route.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
                      isRunning ? 'bg-emerald-50 border border-emerald-200' : ''
                    }`}>
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ROUTE_COLORS[routes.indexOf(route) % ROUTE_COLORS.length] }}
                      />
                      <span className="truncate text-gray-700">{route.name}</span>
                      {isRunning && <span className="text-[9px] text-emerald-600 font-medium ml-auto shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Cliquez sur des routes dans la carte</p>
            )}
          </div>

          {/* Controls */}
          {selectedRouteIds.size > 0 && (
            <>
              <hr className="border-gray-100" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Contrôle</p>
                <div className="flex gap-2">
                  {!running ? (
                    <button
                      onClick={handleStart}
                      className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium cursor-pointer transition-colors"
                    >
                      Démarrer
                    </button>
                  ) : (
                    <button
                      onClick={handleStop}
                      className="flex-1 text-xs bg-amber-100 text-amber-700 rounded-lg py-2 font-medium hover:bg-amber-200 cursor-pointer transition-colors"
                    >
                      Pause
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex-1 text-xs bg-gray-100 text-gray-500 rounded-lg py-2 font-medium hover:bg-gray-200 cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Speed slider */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Multiplicateur de vitesse
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={carState.speedMultiplier}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (carRef.current) {
                        carRef.current.speedMultiplier = v;
                        setCarState({ ...carRef.current.getState() });
                      }
                    }}
                    className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-xs font-mono font-medium text-gray-700 w-8 text-right">
                    {carState.speedMultiplier.toFixed(1)}x
                  </span>
                </div>
              </div>

              {/* Follow car toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFollowCar((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                    followCar ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {followCar ? 'Suivi ON' : 'Suivi OFF'}
                </button>
                <span className="text-[10px] text-gray-400">Suivre la voiture</span>
              </div>

              <hr className="border-gray-100" />

              {/* Car state + Fitness */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">État de la voiture</p>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Route active</span>
                    <span className="font-medium text-gray-700">
                      {selectedRouteIds.size > 1
                        ? `${selectedRouteIds.size} routes fusionnées`
                        : routes[carState.currentRouteIndex]?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Vitesse</span>
                    <span className="font-medium text-gray-700">{(carState.speed * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Direction</span>
                    <span className={`font-medium ${carState.direction === 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {carState.direction === 1 ? 'Aller →' : 'Retour ←'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Waypoint</span>
                    <span className="font-medium text-gray-700">{carState.waypointIndex}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Progression</span>
                    <span className="font-medium text-gray-700">{(carState.progress * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cible vitesse</span>
                    <span className="font-medium text-gray-700">{((carState.lastOutput + 1) * 50).toFixed(1)}%</span>
                  </div>
                  <hr className="border-gray-100 my-1" />
                  <div className="flex justify-between">
                    <span className="text-gray-400">Génération</span>
                    <span className="font-medium text-gray-700">#{carState.generation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fitness</span>
                    <span className="font-medium text-gray-700">{carState.fitness.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Meilleure fitness</span>
                    <span className="font-medium text-emerald-600">{carState.bestFitness.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Speed bar */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Vitesse</p>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${carState.speed * 100}%`,
                      backgroundColor: carState.speed > 0.6 ? '#10b981' : carState.speed > 0.3 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>

              {/* Neural Network Inputs */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Entrées du réseau de neurones
                </p>
                <div className="flex flex-col gap-2">
                  {carState.lastInputs.map((val, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-500">{inputLabels[i]}</span>
                        <span className="font-mono font-medium text-gray-700">{val.toFixed(3)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.min(100, Math.max(0, val * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Architecture */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Architecture RNA
                </p>
                <div className="flex items-center justify-center gap-2 py-2">
                  {[8, 8, 1].map((n, l) => (
                    <div key={l} className="flex flex-col items-center gap-0.5">
                      <div className="text-[10px] font-mono text-gray-400 mb-1">{n}</div>
                      {Array.from({ length: Math.min(n, 8) }).map((_, j) => (
                        <div
                          key={j}
                          className="w-5 h-5 rounded-full border border-gray-300"
                          style={{
                            backgroundColor: l === 2
                              ? `hsl(${120 + (carState.lastOutput * 60)}, 70%, 50%)`
                              : l === 0
                              ? `hsl(${220 + carState.lastInputs[j] * 40}, 50%, 60%)`
                              : '#e5e7eb',
                          }}
                        />
                      ))}
                      {l < 2 && <div className="text-gray-300 text-xs mt-1">→</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Model management */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Modèle</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      if (carRef.current) {
                        carRef.current.network.saveBest();
                        localStorage.setItem('emihack_best_fitness', carRef.current.bestFitness.toString());
                        localStorage.setItem('emihack_best_gen', carRef.current.generation.toString());
                        setCarState({ ...carRef.current.getState() });
                      }
                    }}
                    className="text-xs bg-emerald-100 text-emerald-700 rounded px-2 py-1.5 hover:bg-emerald-200 cursor-pointer transition-colors"
                  >
                    Sauver
                  </button>
                  <button
                    onClick={() => {
                      const saved = NeuralNetwork.loadBest();
                      if (saved && carRef.current) {
                        carRef.current.network = saved;
                        const raw = localStorage.getItem('emihack_best_gen');
                        carRef.current.generation = raw ? parseInt(raw) : 1;
                        carRef.current.bestFitness = parseFloat(localStorage.getItem('emihack_best_fitness') || '0');
                        carRef.current.fitnessScore = 0;
                        carRef.current.fitnessSamples = 0;
                        setCarState({ ...carRef.current.getState() });
                      }
                    }}
                    className="text-xs bg-amber-100 text-amber-700 rounded px-2 py-1.5 hover:bg-amber-200 cursor-pointer transition-colors"
                  >
                    Charger
                  </button>
                  <button
                    onClick={() => {
                      NeuralNetwork.clearBest();
                      localStorage.removeItem('emihack_best_fitness');
                      localStorage.removeItem('emihack_best_gen');
                      if (carRef.current) {
                        carRef.current.bestFitness = 0;
                        setCarState({ ...carRef.current.getState() });
                      }
                    }}
                    className="text-xs bg-red-100 text-red-700 rounded px-2 py-1.5 hover:bg-red-200 cursor-pointer transition-colors"
                  >
                    Effacer
                  </button>
                  <button
                    onClick={() => {
                      if (!carRef.current) return;
                      carRef.current.nextGeneration();
                      setCarState({ ...carRef.current.getState() });
                    }}
                    className="text-xs bg-violet-100 text-violet-700 rounded px-2 py-1.5 hover:bg-violet-200 cursor-pointer transition-colors"
                  >
                    Nouvelle génération
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Route list */}
          <hr className="border-gray-100" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Routes disponibles ({routes.length})
            </p>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {routes.map((route, i) => (
                <button
                  key={route.id}
                  onClick={() => toggleRoute(route.id)}
                  className={`flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    selectedRouteIds.has(route.id) ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedRouteIds.has(route.id) ? '#f59e0b' : ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
                  <span className="truncate">{route.name}</span>
                  {selectedRouteIds.has(route.id) && <span className="text-[9px] text-amber-500 ml-auto shrink-0">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}