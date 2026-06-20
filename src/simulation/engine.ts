import type { Vehicle, VehiclePosition, SimulationConfig, SpeedMode } from './types';
import type { GeoJSONFeature } from '../interface/Map';

const SPEED_MAP: Record<SpeedMode, number> = {
  slow: 0.0008,
  normal: 0.002,
  fast: 0.005,
};

function generateId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCoordsFromFeature(feature: GeoJSONFeature): [number, number][] {
  const geom = feature.geometry;
  if (geom.type === 'LineString') {
    return (geom.coordinates as number[][]).map(([lng, lat]) => [lat, lng] as [number, number]);
  }
  return [];
}

function interpolatePath(path: [number, number][], progress: number): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];

  const totalSegments = path.length - 1;
  const rawIndex = progress * totalSegments;
  const segIndex = Math.min(Math.floor(rawIndex), totalSegments - 1);
  const t = rawIndex - segIndex;

  const a = path[segIndex];
  const b = path[segIndex + 1];
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
}

export interface EngineState {
  vehicles: Vehicle[];
  configs: SimulationConfig[];
}

export class SimulationEngine {
  private vehicles: Map<string, Vehicle> = new Map();
  private configs: Map<string, SimulationConfig> = new Map();
  private roadPaths: Map<string, [number, number][]> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onUpdate: ((positions: VehiclePosition[]) => void) | null = null;

  constructor(roadsGeoJSON: GeoJSONFeature[]) {
    for (const feat of roadsGeoJSON) {
      const props = feat.properties as Record<string, unknown> | undefined;
      const id = props?.id as string;
      if (id) {
        this.roadPaths.set(id, getCoordsFromFeature(feat));
      }
    }
  }

  setOnUpdate(cb: (positions: VehiclePosition[]) => void) {
    this.onUpdate = cb;
  }

  addConfig(config: SimulationConfig) {
    this.configs.set(config.roadId, config);
    this.spawnVehicles(config);
    this.emitPositions();
  }

  removeConfig(roadId: string) {
    this.configs.delete(roadId);
    for (const [id, v] of this.vehicles) {
      if (v.roadId === roadId) this.vehicles.delete(id);
    }
    this.emitPositions();
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
      this.spawnVehicles(updated);
    }
    this.emitPositions();
  }

  private spawnVehicles(config: SimulationConfig) {
    for (const [id, v] of this.vehicles) {
      if (v.roadId === config.roadId) this.vehicles.delete(id);
    }

    const path = this.roadPaths.get(config.roadId);
    if (!path || path.length < 2) return;

    const spacing = 1 / config.vehicleCount;
    for (let i = 0; i < config.vehicleCount; i++) {
      const vehicle: Vehicle = {
        id: generateId(),
        configId: config.roadId,
        roadId: config.roadId,
        progress: Math.min(i * spacing + Math.random() * spacing * 0.5, 0.99),
        speed: SPEED_MAP[config.speed],
      };
      this.vehicles.set(vehicle.id, vehicle);
    }
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), 33);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset() {
    this.stop();
    this.vehicles.clear();
    this.configs.clear();
    this.emitPositions();
  }

  getState(): EngineState {
    return {
      vehicles: Array.from(this.vehicles.values()),
      configs: Array.from(this.configs.values()),
    };
  }

  private tick() {
    const pathCache = new Map<string, [number, number][]>();

    for (const [id, vehicle] of this.vehicles) {
      const config = this.configs.get(vehicle.roadId);
      if (!config || !config.running) continue;

      let path = pathCache.get(vehicle.roadId);
      if (!path) {
        path = this.roadPaths.get(vehicle.roadId) ?? [];
        pathCache.set(vehicle.roadId, path);
      }
      if (path.length < 2) continue;

      let newProgress = vehicle.progress + vehicle.speed;
      if (newProgress >= 1) newProgress -= 1;

      this.vehicles.set(id, { ...vehicle, progress: newProgress });
    }

    this.applyCollisionAvoidance();
    this.emitPositions();
  }

  private applyCollisionAvoidance() {
    const roadGroups = new Map<string, { id: string; progress: number }[]>();
    for (const [id, v] of this.vehicles) {
      const group = roadGroups.get(v.roadId) ?? [];
      group.push({ id, progress: v.progress });
      roadGroups.set(v.roadId, group);
    }

    for (const [, group] of roadGroups) {
      if (group.length < 2) continue;
      group.sort((a, b) => b.progress - a.progress);

      for (let i = 1; i < group.length; i++) {
        const ahead = group[i - 1];
        const behind = group[i];
        const dist = ahead.progress - behind.progress;

        if (dist < 0.02) {
          const behindV = this.vehicles.get(behind.id);
          if (behindV) {
            const pullBack = 0.02 - dist + 0.005;
            this.vehicles.set(behind.id, {
              ...behindV,
              progress: Math.max(0, behindV.progress - pullBack),
            });
          }
        }
      }
    }
  }

  private emitPositions() {
    if (!this.onUpdate) return;

    const positions: VehiclePosition[] = [];
    for (const vehicle of this.vehicles.values()) {
      const path = this.roadPaths.get(vehicle.roadId);
      if (!path) continue;
      const [lat, lng] = interpolatePath(path, vehicle.progress);
      positions.push({ id: vehicle.id, lat, lng, roadId: vehicle.roadId });
    }
    this.onUpdate(positions);
  }
}
