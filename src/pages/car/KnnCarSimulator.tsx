import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types & Interfaces ───────────────────────────────────────────────────────

/** Point 2D générique */
interface Vec2 { x: number; y: number; }

/** Données d'entraînement kNN : entrée capteurs → sortie action */
interface TrainingData {
  sensors: [number, number, number]; // [dist_gauche, dist_centre, dist_droite]
  action: { angleBraquage: number; acceleration: number };
}

/** Sortie de prédiction kNN */
interface Action {
  angleBraquage: number;
  acceleration: number;
}

/** État complet de la voiture */
interface CarState {
  x: number;
  y: number;
  angle: number;     // radians
  vitesse: number;    // m/s
  alive: boolean;
  score: number;
  sensors: [number, number, number];
}

/** Bordure de route (polyline) */
interface RoadSegment {
  centerline: Vec2[];
  leftBorder: Vec2[];
  rightBorder: Vec2[];
}

/** Statut code de la route */
interface RoadCodeStatus {
  conforme: boolean;
  raison: string;
}

// ─── Dataset d'entraînement kNN ───────────────────────────────────────────────
// Chaque entrée = [distance_gauche, distance_centre, distance_droite] normalisées [0-1]
// Sortie = { angleBraquage [-1,1], acceleration [-1,1] }

const TRAINING_DATA: TrainingData[] = [
  // Route droite, obstacles éloignés
  { sensors: [1, 1, 1], action: { angleBraquage: 0, acceleration: 0.6 } },
  { sensors: [0.9, 1, 0.9], action: { angleBraquage: 0, acceleration: 0.5 } },

  // Route droite, côté gauche proche → tourner à droite
  { sensors: [0.2, 0.8, 1], action: { angleBraquage: 0.3, acceleration: 0.3 } },
  { sensors: [0.1, 0.7, 1], action: { angleBraquage: 0.5, acceleration: 0.2 } },
  { sensors: [0.05, 0.6, 0.9], action: { angleBraquage: 0.7, acceleration: 0.1 } },

  // Route droite, côté droit proche → tourner à gauche
  { sensors: [1, 0.8, 0.2], action: { angleBraquage: -0.3, acceleration: 0.3 } },
  { sensors: [1, 0.7, 0.1], action: { angleBraquage: -0.5, acceleration: 0.2 } },
  { sensors: [0.9, 0.6, 0.05], action: { angleBraquage: -0.7, acceleration: 0.1 } },

  // Virage à droite (gauche loin, centre et droit proches)
  { sensors: [1, 0.3, 0.2], action: { angleBraquage: 0.6, acceleration: -0.2 } },
  { sensors: [0.9, 0.2, 0.1], action: { angleBraquage: 0.8, acceleration: -0.3 } },
  { sensors: [1, 0.1, 0.05], action: { angleBraquage: 0.9, acceleration: -0.4 } },

  // Virage à gauche (droit loin, centre et gauche proches)
  { sensors: [0.2, 0.3, 1], action: { angleBraquage: -0.6, acceleration: -0.2 } },
  { sensors: [0.1, 0.2, 0.9], action: { angleBraquage: -0.8, acceleration: -0.3 } },
  { sensors: [0.05, 0.1, 1], action: { angleBraquage: -0.9, acceleration: -0.4 } },

  // Route complètement bloquée → freiner
  { sensors: [0.1, 0.05, 0.1], action: { angleBraquage: 0, acceleration: -1 } },
  { sensors: [0.05, 0.02, 0.05], action: { angleBraquage: 0, acceleration: -1 } },
  { sensors: [0, 0, 0], action: { angleBraquage: 0, acceleration: -1 } },

  // Légère déviation gauche
  { sensors: [0.6, 0.9, 0.8], action: { angleBraquage: 0.15, acceleration: 0.4 } },
  { sensors: [0.7, 0.95, 0.85], action: { angleBraquage: 0.1, acceleration: 0.5 } },

  // Légère déviation droite
  { sensors: [0.8, 0.9, 0.6], action: { angleBraquage: -0.15, acceleration: 0.4 } },
  { sensors: [0.85, 0.95, 0.7], action: { angleBraquage: -0.1, acceleration: 0.5 } },

  // Fin de route proche → freiner
  { sensors: [0.5, 0.15, 0.5], action: { angleBraquage: 0, acceleration: -0.8 } },
  { sensors: [0.4, 0.1, 0.4], action: { angleBraquage: 0, acceleration: -0.9 } },

  // Cas asymétriques mixtes
  { sensors: [0.3, 0.5, 0.8], action: { angleBraquage: 0.2, acceleration: 0.1 } },
  { sensors: [0.8, 0.5, 0.3], action: { angleBraquage: -0.2, acceleration: 0.1 } },
  { sensors: [0.4, 0.6, 0.9], action: { angleBraquage: 0.15, acceleration: 0.3 } },
  { sensors: [0.9, 0.6, 0.4], action: { angleBraquage: -0.15, acceleration: 0.3 } },
];

// ─── Génération automatique de données supplémentaires ─────────────────────────
function generateMoreTrainingData(): TrainingData[] {
  const extra: TrainingData[] = [];
  for (let g = 0; g <= 1; g += 0.1) {
    for (let c = 0; c <= 1; c += 0.1) {
      for (let d = 0; d <= 1; d += 0.1) {
        const sensors: [number, number, number] = [
          Math.round(g * 10) / 10,
          Math.round(c * 10) / 10,
          Math.round(d * 10) / 10,
        ];
        // Logique déterministe pour générer des actions
        const lateralBalance = g - d;
        const angleBraquage = Math.max(-1, Math.min(1, -lateralBalance * 1.5));
        const speedFactor = Math.min(g, c, d);
        const acceleration = Math.max(-1, Math.min(1, speedFactor * 0.8 - 0.2));
        extra.push({
          sensors,
          action: {
            angleBraquage: Math.round(angleBraquage * 100) / 100,
            acceleration: Math.round(acceleration * 100) / 100,
          },
        });
      }
    }
  }
  return extra;
}

const FULL_DATASET: TrainingData[] = [...TRAINING_DATA, ...generateMoreTrainingData()];

// ─── Algorithme kNN ───────────────────────────────────────────────────────────
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function knnPredict(
  sensors: [number, number, number],
  dataset: TrainingData[],
  k: number
): Action {
  // Calculer les distances et trier
  const distances = dataset.map((d) => ({
    dist: euclideanDistance(sensors, d.sensors),
    action: d.action,
  }));
  distances.sort((a, b) => a.dist - b.dist);

  // Prendre les k plus proches voisins
  const neighbors = distances.slice(0, Math.max(1, k));

  // Pondérer par l'inverse de la distance (plus proche = plus de poids)
  let totalWeight = 0;
  let weightedAngle = 0;
  let weightedAccel = 0;
  for (const n of neighbors) {
    const w = 1 / (n.dist + 1e-6);
    totalWeight += w;
    weightedAngle += n.action.angleBraquage * w;
    weightedAccel += n.action.acceleration * w;
  }

  return {
    angleBraquage: Math.max(-1, Math.min(1, weightedAngle / totalWeight)),
    acceleration: Math.max(-1, Math.min(1, weightedAccel / totalWeight)),
  };
}

// ─── Génération de route OSM simulée ──────────────────────────────────────────
function generateRoad(width: number, numPoints: number): RoadSegment {
  const centerline: Vec2[] = [];
  const leftBorder: Vec2[] = [];
  const rightBorder: Vec2[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    // Trajectoire sinusoïdale réaliste
    const x = t * 1800;
    const y = 500
      + Math.sin(t * Math.PI * 2) * 120
      + Math.sin(t * Math.PI * 4.5) * 50
      + Math.cos(t * Math.PI * 1.3) * 80;
    centerline.push({ x, y });
  }

  // Calculer les bordures gauche/droite via les normales
  for (let i = 0; i < centerline.length; i++) {
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Normale perpendicular
    const nx = -dy / len;
    const ny = dx / len;
    leftBorder.push({ x: centerline[i].x + (nx * width) / 2, y: centerline[i].y + (ny * width) / 2 });
    rightBorder.push({ x: centerline[i].x - (nx * width) / 2, y: centerline[i].y - (ny * width) / 2 });
  }

  return { centerline, leftBorder, rightBorder };
}

// ─── Ray-casting : distance du rayon à la bordure ─────────────────────────────
function castRay(
  origin: Vec2,
  angle: number,
  maxLength: number,
  border: Vec2[]
): number {
  const dx = Math.cos(angle) * maxLength;
  const dy = Math.sin(angle) * maxLength;
  const rayEnd: Vec2 = { x: origin.x + dx, y: origin.y + dy };

  let minDist = maxLength;
  for (let i = 0; i < border.length - 1; i++) {
    const a = border[i];
    const b = border[i + 1];
    const inter = lineIntersection(origin, rayEnd, a, b);
    if (inter) {
      const d = Math.sqrt((inter.x - origin.x) ** 2 + (inter.y - origin.y) ** 2);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

/** Intersection entre deux segments (formule de paramètres) */
function lineIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * d1x, y: p1.y + t * d1y };
  }
  return null;
}

/** Distance minimale d'un point à un segment */
function distPointToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

// ─── Constantes physique ──────────────────────────────────────────────────────
const MAX_SPEED = 4.0;        // m/s (~14 km/h)
const MIN_SPEED = 0;
const ACCEL_FACTOR = 0.04;    // facteur d'accélération par tick
const STEER_FACTOR = 0.04;    // facteur de braquage par tick
const SENSOR_LENGTH = 80;     // longueur max des rayons en pixels
const ROAD_WIDTH = 60;        // largeur de la route en pixels
const NUM_RAYS = 5;           // nombre de capteurs
const SENSOR_ANGLES = [-0.6, -0.3, 0, 0.3, 0.6]; // angles relatif en radians

// ─── Composant principal ──────────────────────────────────────────────────────
export default function KnnCarSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const roadRef = useRef<RoadSegment | null>(null);
  const carRef = useRef<CarState>({
    x: 0, y: 0, angle: 0, vitesse: 0, alive: true, score: 0,
    sensors: [1, 1, 1],
  });

  const [running, setRunning] = useState(false);
  const [kValue, setKValue] = useState(3);
  const [carState, setCarState] = useState<CarState>({
    x: 0, y: 0, angle: 0, vitesse: 0, alive: true, score: 0,
    sensors: [1, 1, 1],
  });
  const [roadCode, setRoadCode] = useState<RoadCodeStatus>({ conforme: true, raison: 'Aucune' });

  // Générer la route au montage
  useEffect(() => {
    roadRef.current = generateRoad(ROAD_WIDTH, 600);
    if (roadRef.current) {
      const start = roadRef.current.centerline[0];
      const next = roadRef.current.centerline[1];
      const angle = Math.atan2(next.y - start.y, next.x - start.x);
      carRef.current = {
        x: start.x, y: start.y, angle, vitesse: 0, alive: true, score: 0,
        sensors: [1, 1, 1],
      };
      setCarState({ ...carRef.current });
    }
  }, []);

  // ─── Boucle d'animation ───────────────────────────────────────────────────
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const road = roadRef.current;
    const car = carRef.current;
    if (!canvas || !road || !car.alive) {
      if (!car.alive) setRunning(false);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // ── 1. Calcul des capteurs (ray-casting) ──
    const sensorReadings: [number, number, number] = [0, 0, 0];
    const rayAngles = SENSOR_ANGLES.map((a) => car.angle + a);

    for (let i = 0; i < NUM_RAYS; i++) {
      const angle = rayAngles[i];
      const distLeft = castRay({ x: car.x, y: car.y }, angle, SENSOR_LENGTH, road.leftBorder);
      const distRight = castRay({ x: car.x, y: car.y }, angle, SENSOR_LENGTH, road.rightBorder);
      const minDist = Math.min(distLeft, distRight);
      const normalized = Math.min(1, minDist / SENSOR_LENGTH);
      // Mapping : 0=gauche, 2=droite → index dans le tuple
      if (i === 0) sensorReadings[0] = normalized;
      else if (i === NUM_RAYS - 1) sensorReadings[2] = normalized;
      else if (i === Math.floor(NUM_RAYS / 2)) sensorReadings[1] = normalized;
      else {
        // Moyenne pour les capteurs intermédiaires
        const targetIdx = i < NUM_RAYS / 2 ? 0 : 2;
        sensorReadings[targetIdx] = Math.max(sensorReadings[targetIdx], normalized);
      }
    }

    // ── 2. Prédiction kNN ──
    const prediction = knnPredict(sensorReadings, FULL_DATASET, kValue);

    // ── 3. Règles de sécurité du code de la route ──
    let finalAccel = prediction.acceleration;
    let finalAngle = prediction.angleBraquage;
    let conforme = true;
    let raison = 'Conforme';

    // Règle 1 : Si le capteur central détecte obstacle/fin de route → FORCER freinage
    if (sensorReadings[1] < 0.15) {
      finalAccel = -1;
      conforme = false;
      raison = 'Freinage d\'urgence (obstacle central)';
    }

    // Règle 2 : Si virage serré → FORCER ralentissement
    if (Math.abs(finalAngle) > 0.4) {
      finalAccel = Math.min(finalAccel, 0.1);
      if (Math.abs(finalAngle) > 0.7) {
        finalAccel = Math.min(finalAccel, -0.1);
      }
      if (!conforme) { /* garder */ } else if (Math.abs(finalAngle) > 0.6) {
        conforme = false;
        raison = 'Ralentissement (virage serré)';
      }
    }

    // Règle 3 : Limiter la vitesse max
    if (car.vitesse > MAX_SPEED * 0.9) {
      finalAccel = Math.min(finalAccel, -0.2);
    }

    // ── 4. Mise à jour physique ──
    car.vitesse += finalAccel * ACCEL_FACTOR;
    car.vitesse = Math.max(MIN_SPEED, Math.min(MAX_SPEED, car.vitesse));
    car.angle += finalAngle * STEER_FACTOR * (car.vitesse / MAX_SPEED);
    car.x += Math.cos(car.angle) * car.vitesse;
    car.y += Math.sin(car.angle) * car.vitesse;

    // ── 5. Vérification débordement de route ──
    let minBorderDist = SENSOR_LENGTH;
    for (const border of [road.leftBorder, road.rightBorder]) {
      for (let i = 0; i < border.length - 1; i++) {
        const d = distPointToSeg(car, border[i], border[i + 1]);
        if (d < minBorderDist) minBorderDist = d;
      }
    }
    if (minBorderDist < 3) {
      car.alive = false;
      conforme = false;
      raison = 'CRASH — Sortie de route !';
    }

    // ── 6. Score ──
    if (car.alive) car.score += car.vitesse * 0.1;

    car.sensors = sensorReadings;
    setCarState({ ...car });
    setRoadCode({ conforme, raison });

    // ── 7. Rendu Canvas ──
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);

    // Décalage pour centrer la route dans le canvas
    const offsetX = W / 2 - car.x;
    const offsetY = H / 2 - car.y;
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Fond herbe
    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(car.x - W, car.y - H, W * 2, H * 2);

    // Dessiner bordures de route
    const drawBorder = (points: Vec2[], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    };

    // Surface de la route
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.moveTo(road.leftBorder[0].x, road.leftBorder[0].y);
    for (let i = 1; i < road.leftBorder.length; i++) ctx.lineTo(road.leftBorder[i].x, road.leftBorder[i].y);
    for (let i = road.rightBorder.length - 1; i >= 0; i--) ctx.lineTo(road.rightBorder[i].x, road.rightBorder[i].y);
    ctx.closePath();
    ctx.fill();

    // Ligne centrale pointillée
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(road.centerline[0].x, road.centerline[0].y);
    for (let i = 1; i < road.centerline.length; i++) ctx.lineTo(road.centerline[i].x, road.centerline[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bordures blanches
    drawBorder(road.leftBorder, '#e5e7eb', 2.5);
    drawBorder(road.rightBorder, '#e5e7eb', 2.5);

    // ── 8. Dessiner les capteurs (rayons) ──
    for (let i = 0; i < NUM_RAYS; i++) {
      const angle = rayAngles[i];
      const len = sensorReadings[i === 0 ? 0 : i === NUM_RAYS - 1 ? 2 : 1] * SENSOR_LENGTH;
      const endX = car.x + Math.cos(angle) * len;
      const endY = car.y + Math.sin(angle) * len;

      const ratio = len / SENSOR_LENGTH;
      const r = Math.round((1 - ratio) * 255);
      const g = Math.round(ratio * 255);

      ctx.strokeStyle = `rgb(${r}, ${g}, 50)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Point d'impact
      ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 9. Dessiner la voiture ──
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Corps de la voiture
    ctx.fillStyle = car.alive ? '#ef4444' : '#6b7280';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -8, 28, 16, 4);
    ctx.fill();
    ctx.stroke();

    // Pare-brise
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(6, -5, 6, 10);

    // Phares
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(12, -6, 3, 3);
    ctx.fillRect(12, 3, 3, 3);

    ctx.restore();

    // ── 10. Indicateur de direction (petite flèche devant la voiture) ──
    if (car.alive) {
      const arrowDist = 30;
      const arrowX = car.x + Math.cos(car.angle) * arrowDist;
      const arrowY = car.y + Math.sin(car.angle) * arrowDist;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(arrowX, arrowY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    animRef.current = requestAnimationFrame(animate);
  }, [kValue]);

  // Lancer / arrêter
  useEffect(() => {
    if (running) {
      animRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [running, animate]);

  // Redimensionner le canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        canvas.width = e.contentRect.width;
        canvas.height = e.contentRect.height;
      }
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  const handleStart = () => {
    if (!carRef.current.alive) handleReset();
    setRunning(true);
  };

  const handleStop = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
    const road = roadRef.current;
    if (road) {
      const start = road.centerline[0];
      const next = road.centerline[1];
      carRef.current = {
        x: start.x, y: start.y,
        angle: Math.atan2(next.y - start.y, next.x - start.x),
        vitesse: 0, alive: true, score: 0, sensors: [1, 1, 1],
      };
      setCarState({ ...carRef.current });
      setRoadCode({ conforme: true, raison: 'Aucune' });
    }
  };

  const speedKmh = (carState.vitesse * 3.6).toFixed(1);

  return (
    <div className="h-full bg-gray-950 text-gray-100">
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[1fr_340px] gap-3 h-full p-3">

        {/* ── Canvas ──────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden relative">
          <canvas ref={canvasRef} className="w-full h-full block" style={{ minHeight: 'calc(100vh - 200px)' }} />
          {!running && carState.alive && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-gray-800/90 backdrop-blur px-5 py-2.5 rounded-full text-sm text-gray-300 border border-gray-700 pointer-events-none">
              Cliquez sur « Lancer » pour démarrer la simulation
            </div>
          )}
          {!carState.alive && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-red-900/90 backdrop-blur px-5 py-2.5 rounded-full text-sm text-red-200 border border-red-700 font-semibold animate-pulse">
              CRASH — Sortie de route !
            </div>
          )}
        </div>

        {/* ── Dashboard ───────────────────────────────────── */}
        <aside className="bg-gray-900 rounded-2xl border border-gray-800 p-4 overflow-y-auto flex flex-col gap-4">

          {/* Titre */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
              Voiture Autonome
            </p>
            <h2 className="text-lg font-bold text-white">Simulateur kNN</h2>
            <p className="text-xs text-gray-500 mt-1">
              Algorithme des k-Plus Proches Voisins — Canvas 2D
            </p>
          </div>

          <hr className="border-gray-800" />

          {/* Contrôles */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Contrôle</p>
            <div className="flex gap-2">
              {!running ? (
                <button onClick={handleStart}
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 font-semibold cursor-pointer transition-colors">
                  Lancer
                </button>
              ) : (
                <button onClick={handleStop}
                  className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2.5 font-semibold cursor-pointer transition-colors">
                  Pause
                </button>
              )}
              <button onClick={handleReset}
                className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 font-medium cursor-pointer transition-colors border border-gray-700">
                Réinitialiser
              </button>
            </div>
          </div>

          {/* Sélecteur K */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Valeur de K : <span className="text-blue-400 font-mono">{kValue}</span>
            </p>
            <div className="flex gap-1.5">
              {[1, 3, 5, 7, 9].map((k) => (
                <button key={k}
                  onClick={() => { setKValue(k); if (running) { setRunning(false); setTimeout(() => setRunning(true), 50); } }}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-mono cursor-pointer transition-all ${
                    kValue === k
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                  }`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* Statut code de la route */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Code de la Route</p>
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${
              roadCode.conforme
                ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800'
                : 'bg-red-900/40 text-red-300 border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${roadCode.conforme ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                {roadCode.conforme ? 'Conforme' : 'Non conforme'}
              </div>
              <p className="mt-1 text-[10px] opacity-70">{roadCode.raison}</p>
            </div>
          </div>

          {/* État de la voiture */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">État du véhicule</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Position</span>
                <span className="font-mono text-gray-300">{carState.x.toFixed(0)}, {carState.y.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Direction</span>
                <span className="font-mono text-gray-300">{((carState.angle * 180) / Math.PI % 360).toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statut</span>
                <span className={`font-semibold ${carState.alive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {carState.alive ? 'En route' : 'Arrêté'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Score</span>
                <span className="font-mono text-amber-400">{carState.score.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* Vitesse */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Vitesse : <span className="text-white font-mono text-sm">{speedKmh} km/h</span>
            </p>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${Math.min(100, (carState.vitesse / MAX_SPEED) * 100)}%`,
                  backgroundColor: carState.vitesse > MAX_SPEED * 0.7 ? '#ef4444' : carState.vitesse > MAX_SPEED * 0.4 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
          </div>

          {/* Capteurs */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Capteurs (Ray-casting)</p>
            <div className="flex flex-col gap-2">
              {['Gauche', 'Centre', 'Droite'].map((label, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono text-gray-300">{(carState.sensors[i] * SENSOR_LENGTH).toFixed(1)} px</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-100"
                      style={{
                        width: `${carState.sensors[i] * 100}%`,
                        backgroundColor: carState.sensors[i] > 0.6 ? '#22c55e' : carState.sensors[i] > 0.3 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions kNN */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Décision kNN</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Braquage</span>
                <span className="font-mono text-gray-300">
                  {(() => {
                    const pred = knnPredict(carState.sensors, FULL_DATASET, kValue);
                    return `${pred.angleBraquage > 0 ? '→' : pred.angleBraquage < 0 ? '←' : '↑'} ${Math.abs(pred.angleBraquage).toFixed(2)}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Accélération</span>
                <span className="font-mono text-gray-300">
                  {(() => {
                    const pred = knnPredict(carState.sensors, FULL_DATASET, kValue);
                    return `${pred.acceleration > 0 ? '+' : ''}${pred.acceleration.toFixed(2)}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dataset</span>
                <span className="font-mono text-gray-400">{FULL_DATASET.length} échantillons</span>
              </div>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}