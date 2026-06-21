import type { Vehicle, Intersection, RouteIntersection } from './types';
import { haversineDistance, getPositionOnRoute } from './vehiclePhysics';

const ZONE_DISTANCE = 15;
const RELEASE_MARGIN = 3;
const DEADLOCK_TIMEOUT_SIM = 60;

export interface IntersectionState {
  intersectionId: string;
  lat: number;
  lon: number;
  lockStatus: 'free' | 'locked' | 'waiting';
  lockedByRoad?: string;
  waitingCount: number;
}

export class IntersectionManager {
  private intersections: Map<string, Intersection> = new Map();
  private routeIntersections: RouteIntersection[] = [];
  private roundaboutVehicles: Map<string, Set<string>> = new Map();
  private roundaboutEntryProgress: Map<string, Map<string, number>> = new Map();
  private routeCoords: Map<string, [number, number][]> = new Map();

  private locks: Map<string, { vehicleId: string; roadId: string }> = new Map();
  private waitingTimers: Map<string, Map<string, number>> = new Map();
  private simTime = 0;

  constructor(
    intersections: Intersection[],
    routeIntersections: RouteIntersection[],
    routeCoords?: Map<string, [number, number][]>
  ) {
    intersections.forEach((i) => this.intersections.set(i.id, i));
    this.routeIntersections = routeIntersections;
    if (routeCoords) this.routeCoords = routeCoords;
  }

  setCurrentTime(t: number) { this.simTime = t; }

  setRouteCoordinates(routeCoords: Map<string, [number, number][]>) {
    this.routeCoords = routeCoords;
  }

  addRouteCoordinates(roadId: string, coords: [number, number][]) {
    this.routeCoords.set(roadId, coords);
  }

  /** Expose lock state per intersection for map overlay */
  getIntersectionStates(): IntersectionState[] {
    const states: IntersectionState[] = [];
    for (const [id, ix] of this.intersections) {
      const lock = this.locks.get(id);
      const waiting = this.waitingTimers.get(id);
      let lockStatus: 'free' | 'locked' | 'waiting' = 'free';
      let lockedByRoad: string | undefined;
      let waitingCount = 0;
      if (lock) {
        lockStatus = 'locked';
        lockedByRoad = lock.roadId;
      } else if (waiting && waiting.size > 0) {
        lockStatus = 'waiting';
        waitingCount = waiting.size;
      }
      states.push({
        intersectionId: id, lat: Number(ix.lat), lon: Number(ix.lon),
        lockStatus, lockedByRoad, waitingCount,
      });
    }
    return states;
  }

  /** Release locks for vehicles that have passed their intersection */
  releaseLocks(vehicle: Vehicle) {
    for (const [ixId, lock] of this.locks) {
      if (lock.vehicleId !== vehicle.id) continue;
      const ri = this.routeIntersections.find(
        (r) => r.intersectionId === ixId &&
          (r.routeId1 === vehicle.roadId || r.routeId2 === vehicle.roadId)
      );
      if (!ri) { this.locks.delete(ixId); continue; }
      const pos = ri.routeId1 === vehicle.roadId ? ri.positionOnRoute1 : ri.positionOnRoute2;
      if (vehicle.progress > pos + RELEASE_MARGIN) {
        this.locks.delete(ixId);
      }
    }
  }

  /** Check if a lock is stale (vehicle disappeared or is stopped/waiting too long) */
  private isLockStale(lock: { vehicleId: string; roadId: string }, allVehicles: Vehicle[]): boolean {
    const v = allVehicles.find((x) => x.id === lock.vehicleId);
    if (!v) return true;
    if (v.state === 'stopped' || v.state === 'waiting') return true;
    return false;
  }

  findNextIntersection(
    vehicle: Vehicle,
    routeCoordinates: [number, number][]
  ): { intersection: Intersection; distance: number; positionOnRoute: number } | null {
    const relevant = this.routeIntersections.filter(
      (ri) => ri.routeId1 === vehicle.roadId || ri.routeId2 === vehicle.roadId
    );

    let closest: { intersection: Intersection; distance: number; positionOnRoute: number } | null = null;

    for (const ri of relevant) {
      const positionOnRoute = ri.routeId1 === vehicle.roadId ? ri.positionOnRoute1 : ri.positionOnRoute2;

      if (positionOnRoute <= vehicle.progress) continue;

      const intersection = this.intersections.get(ri.intersectionId);
      if (!intersection) continue;

      const intersectionPos = getPositionOnRoute(positionOnRoute, routeCoordinates);
      const vehiclePos = getPositionOnRoute(vehicle.progress, routeCoordinates);
      const distance = haversineDistance(
        [vehiclePos.lat, vehiclePos.lng],
        [intersectionPos.lat, intersectionPos.lng]
      );

      if (!closest || distance < closest.distance) {
        closest = { intersection, distance, positionOnRoute };
      }
    }

    return closest;
  }

  getIntersectionSpeed(
    vehicle: Vehicle,
    intersection: Intersection,
    allVehicles: Vehicle[],
    routeCoordinates: [number, number][]
  ): number {
    switch (intersection.type) {
      case 'roundabout':
        return this.handleRoundabout(vehicle, intersection, allVehicles);
      default:
        return this.handleLocked(vehicle, intersection, allVehicles, routeCoordinates);
    }
  }

  /**
   * Unified lock-based handler for stop / priority / uncontrolled.
   * - Priority road → passes through (speed 30)
   * - Non-priority approaches → checks lock:
   *     free → acquire lock, slow to 15 km/h
   *     locked by self → continue at 15 km/h
   *     locked by another → stop (0)
   * - Deadlock prevention: if vehicle waits > 60 sim-seconds, force-acquire
   */
  private handleLocked(
    vehicle: Vehicle,
    intersection: Intersection,
    allVehicles: Vehicle[],
    routeCoordinates: [number, number][]
  ): number {
    const ri = this.routeIntersections.find(
      (r) => r.intersectionId === intersection.id &&
        (r.routeId1 === vehicle.roadId || r.routeId2 === vehicle.roadId)
    );
    if (!ri) return 20;
    const positionOnRoute = ri.routeId1 === vehicle.roadId ? ri.positionOnRoute1 : ri.positionOnRoute2;
    const intersectionPos = getPositionOnRoute(positionOnRoute, routeCoordinates);
    const vehiclePos = getPositionOnRoute(vehicle.progress, routeCoordinates);
    const distance = haversineDistance([vehiclePos.lat, vehiclePos.lng], [intersectionPos.lat, intersectionPos.lng]);

    if (distance > ZONE_DISTANCE) return 20;

    // Priority route → pass through
    if (intersection.type === 'priority' && ri.priorityRouteId === vehicle.roadId) {
      return 30;
    }

    const lock = this.locks.get(intersection.id);

    // Stale lock cleanup
    if (lock && this.isLockStale(lock, allVehicles)) {
      this.locks.delete(intersection.id);
      this.waitingTimers.delete(intersection.id);
    }

    // Free → acquire
    if (!lock) {
      this.locks.set(intersection.id, { vehicleId: vehicle.id, roadId: vehicle.roadId });
      return 15;
    }

    // Already own the lock
    if (lock.vehicleId === vehicle.id) {
      return 15;
    }

    // Locked by someone else → track wait, stop
    let wm = this.waitingTimers.get(intersection.id);
    if (!wm) {
      wm = new Map();
      this.waitingTimers.set(intersection.id, wm);
    }
    if (!wm.has(vehicle.id)) {
      wm.set(vehicle.id, this.simTime);
    }

    // Deadlock timeout: force-acquire
    if (this.simTime - wm.get(vehicle.id)! > DEADLOCK_TIMEOUT_SIM) {
      this.locks.set(intersection.id, { vehicleId: vehicle.id, roadId: vehicle.roadId });
      wm.delete(vehicle.id);
      return 15;
    }

    return 0;
  }

  private handleRoundabout(
    vehicle: Vehicle,
    intersection: Intersection,
    allVehicles: Vehicle[]
  ): number {
    let set = this.roundaboutVehicles.get(intersection.id);
    if (!set) {
      set = new Set();
      this.roundaboutVehicles.set(intersection.id, set);
    }

    const entries = this.roundaboutEntryProgress.get(intersection.id) || new Map();
    this.roundaboutEntryProgress.set(intersection.id, entries);

    const ri = this.routeIntersections.find(
      (r) => r.intersectionId === intersection.id &&
        (r.routeId1 === vehicle.roadId || r.routeId2 === vehicle.roadId)
    );
    const positionOnRoute = ri
      ? (ri.routeId1 === vehicle.roadId ? ri.positionOnRoute1 : ri.positionOnRoute2)
      : 50;

    const activeIds = new Set(allVehicles.map((v) => v.id));
    for (const vid of set) {
      if (!activeIds.has(vid)) { set.delete(vid); entries.delete(vid); continue; }
      const enteredAt = entries.get(vid) ?? 0;
      const v = allVehicles.find((x) => x.id === vid);
      if (v && v.progress > positionOnRoute + 5 && v.progress - enteredAt > 5) {
        set.delete(vid);
        entries.delete(vid);
      }
    }

    const hasVehicleInside = allVehicles.some(
      (v) => set.has(v.id) && v.id !== vehicle.id && v.state === 'moving'
    );

    if (hasVehicleInside) {
      return 0;
    }

    if (!set.has(vehicle.id)) {
      set.add(vehicle.id);
      entries.set(vehicle.id, vehicle.progress);
    }
    return 6;
  }
}
