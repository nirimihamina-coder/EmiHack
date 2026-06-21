import type {
  Vehicle,
  SimulationConfig,
  VehiclePosition,
  VehicleType,
  Intersection,
  RouteIntersection,
  TrafficIncident,
  Bottleneck,
  Suggestion,
} from './types';
import {
  updateVehicleSpeed,
  updateVehiclePosition,
  getPositionOnRoute,
} from './vehiclePhysics';
import { IntersectionManager } from './intersectionManager';
import { IncidentManager } from './incidentManager';
import { CongestionDetector } from './congestionDetector';
import { SuggestionEngine } from './suggestionEngine';

const VEHICLE_TYPES: VehicleType[] = ['car', 'motorcycle', 'bike'];
const VEHICLE_WEIGHTS = [0.7, 0.2, 0.1];

function randomVehicleType(): VehicleType {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < VEHICLE_TYPES.length; i++) {
    cumulative += VEHICLE_WEIGHTS[i];
    if (r < cumulative) return VEHICLE_TYPES[i];
  }
  return 'car';
}

// ✅ NOUVEAU : Fonction pour fusionner tous les segments d'un MultiLineString
function flattenMultiLineString(lines: number[][][]): [number, number][] {
  if (lines.length === 0) return [];
  const result: [number, number][] = [];
  for (const line of lines) {
    for (const coord of line) {
      result.push([coord[0], coord[1]]);
    }
  }
  return result;
}

export class SimulationEngine {
  private vehicles: Map<string, Vehicle> = new Map();
  private configs: Map<string, SimulationConfig> = new Map();
  private routeCoordinates: Map<string, [number, number][]> = new Map();
  private onUpdate: ((positions: VehiclePosition[]) => void) | null = null;
  private animationFrame: number | null = null;
  private lastTime = 0;
  private readonly timeScale = 20;
  private spawnAccumulator: Map<string, number> = new Map();
  private simTime = 0;

  private intersectionManager!: IntersectionManager;
  private incidentManager = new IncidentManager();
  private congestionDetector = new CongestionDetector();
  private suggestionEngine = new SuggestionEngine();

  private intersections: Intersection[] = [];

  constructor(roadFeatures: any[]) {
    console.log('🛣️ SimulationEngine: initialisation avec', roadFeatures.length, 'routes');

    for (const feature of roadFeatures) {
      const props = feature.properties as Record<string, unknown> | undefined;
      const id = (props?.id as string) ?? feature.id;
      let coordinates: [number, number][] | undefined;

      const geom = feature.geometry;
      if (geom?.type === 'LineString') {
        // ✅ Garder le format [lng, lat] tel quel
        coordinates = (geom.coordinates as number[][]).map(([lng, lat]) => [lng, lat] as [number, number]);
      } else if (geom?.type === 'MultiLineString') {
        const lines = geom.coordinates as number[][][];
        // ✅ Garder le format [lng, lat] tel quel
        coordinates = flattenMultiLineString(lines).map(([lng, lat]) => [lng, lat] as [number, number]);
      }

      if (id && coordinates && coordinates.length >= 2) {
        this.routeCoordinates.set(id, coordinates);
        console.log(`  ✅ Route chargée: ${id} avec ${coordinates.length} coordonnées`);
      } else if (id) {
        console.warn(`  ️ Route ignorée: ${id} (coordinates: ${coordinates?.length || 0})`);
      }
    }

    console.log('🛣️ Total routes chargées:', this.routeCoordinates.size);
    this.intersectionManager = new IntersectionManager([], [], this.routeCoordinates);
  }

  setRoadPath(roadId: string, coordinates: number[][]) {
    console.log(`🛣️ setRoadPath: ${roadId} avec ${coordinates.length} coordonnées`);

    if (coordinates.length < 2) {
      console.error(`❌ setRoadPath: ${roadId} a moins de 2 coordonnées`);
      return false;
    }

    const path: [number, number][] = coordinates.map(([lat, lng]) => [lat, lng] as [number, number]);
    this.routeCoordinates.set(roadId, path);
    this.intersectionManager?.addRouteCoordinates(roadId, path);

    console.log(`  ✅ Chemin défini pour ${roadId}`);
    return true;
  }

  setIntersections(intersections: Intersection[], routeIntersections: RouteIntersection[]) {
    this.intersections = intersections;
    this.intersectionManager = new IntersectionManager(
      intersections,
      routeIntersections,
      this.routeCoordinates
    );
  }

  setOnUpdate(callback: (positions: VehiclePosition[]) => void) {
    this.onUpdate = callback;
  }

  addConfig(config: SimulationConfig) {
    console.log(` addConfig: ${config.roadId} { vehicleCount: ${config.vehicleCount}, speed: ${config.speed} }`);

    const hasPath = this.routeCoordinates.has(config.roadId);
    console.log(`  📍 Chemin disponible: ${hasPath}`);

    if (!hasPath) {
      console.error(`❌ Impossible d'ajouter config pour ${config.roadId}: chemin manquant`);
      return;
    }

    this.configs.set(config.roadId, config);
    this.removeVehiclesForRoad(config.roadId);

    let createdCount = 0;
    for (let i = 0; i < config.vehicleCount; i++) {
      const vehicle = this.createVehicle(config.roadId, i, config.speed);
      this.vehicles.set(vehicle.id, vehicle);
      createdCount++;
    }

    console.log(`  ✅ ${createdCount} véhicules créés pour ${config.roadId}`);
  }

  removeConfig(roadId: string) {
    this.configs.delete(roadId);
    this.removeVehiclesForRoad(roadId);
  }

  setRunning(roadId: string, running: boolean) {
    const config = this.configs.get(roadId);
    if (config) {
      this.configs.set(roadId, { ...config, running });
    }
  }

  updateConfig(roadId: string, partial: Partial<SimulationConfig>) {
    const config = this.configs.get(roadId);
    if (!config) return;
    const updated = { ...config, ...partial };
    this.configs.set(roadId, updated);

    if (partial.vehicleCount !== undefined || partial.speed !== undefined) {
      this.removeVehiclesForRoad(roadId);
      for (let i = 0; i < updated.vehicleCount; i++) {
        const vehicle = this.createVehicle(roadId, i, updated.speed);
        this.vehicles.set(vehicle.id, vehicle);
      }
    }
  }

  addIncident(incident: TrafficIncident) {
    this.incidentManager.addIncident(incident);
  }

  removeIncident(id: string) {
    this.incidentManager.removeIncident(id);
  }

  setIncidents(incidents: TrafficIncident[]) {
    this.incidentManager.setIncidents(incidents);
  }

  start() {
    if (this.animationFrame) return;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  reset() {
    this.stop();
    this.vehicles.clear();
    this.configs.clear();
    this.onUpdate?.([]);
  }

  getState() {
    return {
      configs: Array.from(this.configs.values()),
      vehicles: Array.from(this.vehicles.values()),
    };
  }

  getSuggestions(): Suggestion[] {
    const vehicles = Array.from(this.vehicles.values());
    const bottlenecks = this.congestionDetector.detectBottlenecks(
      vehicles,
      this.intersections
    );
    const intersectionsMap = new Map(this.intersections.map((i) => [i.id, i]));
    return this.suggestionEngine.generateSuggestions(bottlenecks, intersectionsMap);
  }

  getBottlenecks(): Bottleneck[] {
    const vehicles = Array.from(this.vehicles.values());
    return this.congestionDetector.detectBottlenecks(vehicles, this.intersections);
  }

  getRoadCongestion(): { roadId: string; total: number; stopped: number; status: 'fluid' | 'congested' | 'blocked' }[] {
    const byRoad = new Map<string, { total: number; stopped: number }>();
    for (const v of this.vehicles.values()) {
      const entry = byRoad.get(v.roadId) ?? { total: 0, stopped: 0 };
      entry.total++;
      if (v.state === 'stopped' || v.state === 'waiting') entry.stopped++;
      byRoad.set(v.roadId, entry);
    }
    return Array.from(byRoad.entries()).map(([roadId, s]) => ({
      roadId,
      total: s.total,
      stopped: s.stopped,
      status: s.stopped === s.total ? 'blocked' : s.stopped > s.total * 0.3 ? 'congested' : 'fluid',
    }));
  }

  getIntersectionStates() {
    return this.intersectionManager.getIntersectionStates();
  }

  private removeVehiclesForRoad(roadId: string) {
    for (const [id, v] of this.vehicles) {
      if (v.roadId === roadId) this.vehicles.delete(id);
    }
  }

  private loop = () => {
    const now = performance.now();
    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const deltaTime = rawDelta * this.timeScale;

    if (deltaTime > 0 && deltaTime < 2) {
      this.update(deltaTime);
    }

    this.animationFrame = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number) {
    this.simTime += deltaTime;
    this.intersectionManager.setCurrentTime(this.simTime);

    const allVehicles = Array.from(this.vehicles.values());

    for (const vehicle of allVehicles) {
      const config = this.configs.get(vehicle.roadId);
      if (!config?.running) continue;

      const routeCoords = this.routeCoordinates.get(vehicle.roadId);
      if (!routeCoords) continue;

      if (vehicle.progress >= 100) {
        this.vehicles.delete(vehicle.id);
        continue;
      }

      this.intersectionManager.releaseLocks(vehicle);

      const nextIntersection = this.intersectionManager?.findNextIntersection(
        vehicle,
        routeCoords
      );

      let intersectionSpeed: number | null = null;
      let distanceToIntersection: number | null = null;

      if (nextIntersection && nextIntersection.distance < 80) {
        distanceToIntersection = nextIntersection.distance;
        intersectionSpeed = this.intersectionManager?.getIntersectionSpeed(
          vehicle,
          nextIntersection.intersection,
          allVehicles,
          routeCoords
        ) ?? null;
      }

      const vehicleAhead = this.findVehicleAhead(vehicle, allVehicles);

      const incidentFactor = this.incidentManager.getSpeedFactor(vehicle);
      vehicle.maxSpeed = config.speed * incidentFactor;

      if (this.incidentManager.isVehicleBlocked(vehicle)) {
        vehicle.speed = 0;
        vehicle.state = 'stopped';
      } else {
        updateVehicleSpeed(
          vehicle,
          vehicleAhead,
          distanceToIntersection,
          intersectionSpeed,
          deltaTime
        );
      }

      if (vehicle.state === 'stopped' || vehicle.state === 'waiting') {
        this.congestionDetector.recordWaitTime(vehicle.id, deltaTime);
      }

      updateVehiclePosition(vehicle, routeCoords, deltaTime);
    }

    for (const [roadId, config] of this.configs) {
      if (!config.running) continue;
      const count = this.countVehiclesForRoad(roadId);
      if (count >= config.vehicleCount) continue;

      const acc = (this.spawnAccumulator.get(roadId) ?? 0) + deltaTime;
      const interval = 60 / config.speed / 1.5;
      if (acc >= interval) {
        this.spawnAccumulator.set(roadId, 0);
        const v = this.createVehicle(roadId, count, config.speed);
        v.progress = Math.random() * 3;
        this.vehicles.set(v.id, v);
      } else {
        this.spawnAccumulator.set(roadId, acc);
      }
    }

    if (this.onUpdate) {
      const positions: VehiclePosition[] = [];
      for (const v of allVehicles) {
        const coords = this.routeCoordinates.get(v.roadId);
        if (!coords) {
          console.warn(`⚠️ Pas de coordonnées pour ${v.roadId}`);
          continue;
        }
        const pos = getPositionOnRoute(v.progress, coords);

        if (positions.length < 3) {
          console.log(`📍 Position calculée pour ${v.id}:`, {
            progress: v.progress,
            lat: pos.lat,
            lng: pos.lng,
            coordsLength: coords.length,
          });
        }

        positions.push({
          id: v.id,
          roadId: v.roadId,
          lat: pos.lat,
          lng: pos.lng,
          progress: v.progress,
          speed: Math.round(v.speed * 10) / 10,
          targetSpeed: Math.round(v.targetSpeed * 10) / 10,
          type: v.type,
          state: v.state,
          heading: v.heading,
        });
      }

      if (positions.length > 0) {
        console.log(`📤 Envoi de ${positions.length} positions à onUpdate`);
      }

      this.onUpdate(positions);
    }
  }

  private findVehicleAhead(vehicle: Vehicle, allVehicles: Vehicle[]): Vehicle | null {
    let closest: Vehicle | null = null;
    let closestDistance = Infinity;

    for (const other of allVehicles) {
      if (other.id === vehicle.id) continue;
      if (other.roadId !== vehicle.roadId) continue;
      if (other.progress <= vehicle.progress) continue;

      const distance = other.progress - vehicle.progress;
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = other;
      }
    }

    return closest;
  }

  private countVehiclesForRoad(roadId: string): number {
    let n = 0;
    for (const v of this.vehicles.values()) {
      if (v.roadId === roadId) n++;
    }
    return n;
  }

  private createVehicle(roadId: string, index: number, speed: number): Vehicle {
    const routeCoords = this.routeCoordinates.get(roadId);
    const vehicleCount = this.configs.get(roadId)?.vehicleCount ?? 10;
    const spacing = 100 / vehicleCount;
    const progress = Math.min(index * spacing + Math.random() * spacing * 0.3, 99);

    const startPos = routeCoords
      ? getPositionOnRoute(progress, routeCoords)
      : { lat: 0, lng: 0 };

    const type = randomVehicleType();
    const typeSpeedMul = type === 'motorcycle' ? 1.2 : type === 'bike' ? 0.7 : 1;
    const randomVar = 0.85 + Math.random() * 0.3;

    return {
      id: `${roadId}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roadId,
      progress,
      speed: 0,
      targetSpeed: speed * typeSpeedMul * randomVar,
      maxSpeed: speed * typeSpeedMul * randomVar,
      type,
      state: 'moving',
      length: 4,
      lastPosition: startPos,
      trail: [startPos],
      heading: 0,
    };
  }
}