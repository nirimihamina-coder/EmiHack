import type { Vehicle, TrafficIncident } from './types';

export class IncidentManager {
  private incidents: Map<string, TrafficIncident> = new Map();

  private readonly severityFactors: Record<string, number> = {
    low: 0.7,
    medium: 0.4,
    high: 0.2,
    critical: 0,
  };

  addIncident(incident: TrafficIncident) {
    this.incidents.set(incident.id, incident);
  }

  removeIncident(id: string) {
    this.incidents.delete(id);
  }

  setIncidents(incidents: TrafficIncident[]) {
    this.incidents.clear();
    for (const inc of incidents) {
      this.incidents.set(inc.id, inc);
    }
  }

  getActiveIncidentsOnRoute(routeId: string): TrafficIncident[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.routeId === routeId && i.active
    );
  }

  getSpeedFactor(vehicle: Vehicle): number {
    const incidents = this.getActiveIncidentsOnRoute(vehicle.roadId);
    if (incidents.length === 0) return 1;

    let minFactor = 1;
    for (const incident of incidents) {
      if (vehicle.progress > incident.positionOnRoute) continue;

      const distance = incident.positionOnRoute - vehicle.progress;

      if (distance > 20) continue;

      const proximityFactor = 1 - (distance / 20);
      const severityFactor = this.severityFactors[incident.severity];
      const factor = 1 - (proximityFactor * (1 - severityFactor));

      minFactor = Math.min(minFactor, factor);
    }

    return minFactor;
  }

  isVehicleBlocked(vehicle: Vehicle): boolean {
    const incidents = this.getActiveIncidentsOnRoute(vehicle.roadId);
    for (const incident of incidents) {
      if (vehicle.progress > incident.positionOnRoute) continue;
      const distance = incident.positionOnRoute - vehicle.progress;
      const blockDist = incident.severity === 'critical' ? 10
        : incident.severity === 'high' ? 6
        : incident.severity === 'medium' ? 3
        : 0;
      if (distance < blockDist) return true;
    }
    return false;
  }
}
