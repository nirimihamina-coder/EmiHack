import type { Vehicle, Intersection, Bottleneck } from './types';

const CONGESTION_THRESHOLD = 60;
const SEVERE_THRESHOLD = 120;

export class CongestionDetector {
  private waitTimes: Map<string, number[]> = new Map();

  recordWaitTime(vehicleId: string, waitTime: number) {
    if (!this.waitTimes.has(vehicleId)) {
      this.waitTimes.set(vehicleId, []);
    }
    const times = this.waitTimes.get(vehicleId)!;
    times.push(waitTime);
    if (times.length > 10) times.shift();
  }

  detectBottlenecks(
    vehicles: Vehicle[],
    intersections: Intersection[]
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    for (const intersection of intersections) {
      const waitingVehicles = vehicles.filter(
        (v) => v.state === 'stopped' || v.state === 'waiting'
      );

      if (waitingVehicles.length < 3) continue;

      const avgWaitTime = waitingVehicles.reduce((sum, v) => {
        const times = this.waitTimes.get(v.id) || [];
        return sum + (times[times.length - 1] || 0);
      }, 0) / waitingVehicles.length;

      if (avgWaitTime > CONGESTION_THRESHOLD) {
        const severity = Math.min(1, avgWaitTime / SEVERE_THRESHOLD);
        const affectedRoutes = Array.from(
          new Set(waitingVehicles.map((v) => v.roadId))
        );

        bottlenecks.push({
          intersectionId: intersection.id,
          severity,
          waitingVehicles: waitingVehicles.length,
          avgWaitTime,
          affectedRoutes,
        });
      }
    }

    return bottlenecks.sort((a, b) => b.severity - a.severity);
  }
}
