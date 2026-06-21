import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { useRoadsStore } from '../stores/roads';

export interface DashboardRoute {
  id: string;
  name: string;
  type: string;
  status: 'fluide' | 'dense' | 'saturée';
  speed: number;
  vehicles: number;
  charge: number;
}

export interface VehicleBreakdownItem {
  label: string;
  value: number;
  pct: number;
  color: string;
  bg: string;
  text: string;
  icon: string;
}

export interface DashboardData {
  totalVehicles: number;
  activeRoutes: number;
  totalRoutes: number;
  averageSpeed: number;
  mostCongested: { name: string; speed: number; congestion: number } | null;
  vehicleBreakdown: VehicleBreakdownItem[];
  routesData: DashboardRoute[];
  trafficEvolution: { hour: string; value: number }[];
  operational: boolean;
  lastUpdate: Date;
  loading: boolean;
}

const HOURS = ['06h', '07h', '08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h'];

type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStatus(
  vehicleCount: number,
  speed: number,
  hasCriticalIncident: boolean,
  hasHighIncident: boolean
): 'fluide' | 'dense' | 'saturée' {
  if (hasCriticalIncident || speed <= 25 || vehicleCount >= 75) return 'saturée';
  if (hasHighIncident || speed <= 45 || vehicleCount >= 45) return 'dense';
  return 'fluide';
}

function severityWeight(severity?: string): number {
  if (severity === 'critical') return 3;
  if (severity === 'high') return 2;
  if (severity === 'medium') return 1;
  return 0;
}

function computeCharge(
  vehicleCount: number,
  speed: number,
  speedLimit: number,
  severity?: string
): number {
  const normalizedSpeed = speedLimit > 0 ? clamp((speed / speedLimit) * 100, 0, 100) : 50;
  const vehiclePressure = clamp((vehicleCount / 50) * 100, 0, 100);
  const incidentPenalty = severityWeight(severity) * 15;
  const charge = Math.round((vehiclePressure * 0.6) + ((100 - normalizedSpeed) * 0.25) + incidentPenalty);
  return clamp(charge, 0, 100);
}

function generateTrafficEvolution(baseValue: number, routeCharges: number[]) {
  return HOURS.map((hour, index) => {
    const routeOffset = routeCharges[index % Math.max(routeCharges.length, 1)] || 0;
    const wave = Math.round(Math.sin(index / 1.8) * 8 + Math.cos(index / 3.4) * 6);
    const value = clamp(Math.round(baseValue * 0.7 + routeOffset * 0.3 + wave), 0, 100);
    return { hour, value };
  });
}

function buildVehicleBreakdown(totalVehicles: number): VehicleBreakdownItem[] {
  const values = [
    { label: 'Voitures', ratio: 0.68 },
    { label: 'Motos', ratio: 0.18 },
    { label: 'Vélos', ratio: 0.09 },
    { label: 'Bus', ratio: 0.05 },
  ];

  let remaining = totalVehicles;
  const breakdown = values.map((item, index) => {
    const value = Math.max(0, Math.round(totalVehicles * item.ratio));
    remaining -= value;
    return {
      label: item.label,
      value,
      pct: totalVehicles > 0 ? Math.round((value / totalVehicles) * 100) : 0,
      color: ['from-blue-400 to-blue-500', 'from-amber-400 to-orange-400', 'from-emerald-400 to-teal-400', 'from-violet-400 to-purple-400'][index],
      bg: ['bg-blue-50', 'bg-amber-50', 'bg-emerald-50', 'bg-violet-50'][index],
      text: ['text-blue-600', 'text-amber-600', 'text-emerald-600', 'text-violet-600'][index],
      icon: ['🚗', '🏍️', '🚲', '🚌'][index],
    };
  });

  if (remaining > 0) {
    breakdown[0].value += remaining;
    breakdown[0].pct = totalVehicles > 0 ? Math.round((breakdown[0].value / totalVehicles) * 100) : 0;
  }

  return breakdown;
}

export function useDashboardData(pollInterval = 5000): DashboardData {
  const [data, setData] = useState<DashboardData>({
    totalVehicles: 0,
    activeRoutes: 0,
    totalRoutes: 0,
    averageSpeed: 0,
    mostCongested: null,
    vehicleBreakdown: [],
    routesData: [],
    trafficEvolution: [],
    operational: false,
    lastUpdate: new Date(),
    loading: true,
  });

  const roadsLoaded = useRoadsStore((s) => s.loaded);
  const loadRoads = useRoadsStore((s) => s.load);

  useEffect(() => {
    if (!roadsLoaded) {
      loadRoads().catch(() => {});
    }
  }, [roadsLoaded, loadRoads]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const store = useRoadsStore.getState();
        const [configsRes, reportsRes, resultsRes, scenariosRes, apiRoutes] = await Promise.all([
          axiosInstance.get('/simulation-route-configs').catch(() => ({ data: [] })),
          axiosInstance.get('/reports/all').catch(() => ({ data: [] })),
          axiosInstance.get('/simulation-results').catch(() => ({ data: [] })),
          axiosInstance.get('/simulation-scenarios').catch(() => ({ data: [] })),
          store.apiRoutes.length > 0
            ? Promise.resolve(store.apiRoutes)
            : axiosInstance.get('/routes/all').then((r) => r.data),
        ]);

        const configs: any[] = Array.isArray(configsRes.data) ? configsRes.data : [];
        const reports: any[] = Array.isArray(reportsRes.data) ? reportsRes.data : [];
        const results: any[] = Array.isArray(resultsRes.data) ? resultsRes.data : [];
        const scenarios: any[] = Array.isArray(scenariosRes.data) ? scenariosRes.data : [];
        const apiRoutesArr = Array.isArray(apiRoutes) ? apiRoutes : [];

        const latestResult = results.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0];

        const activeIncidents = reports.filter((r: any) => r.status === 'active');
        const routeIncidentMap = new Map<string, IncidentSeverity>();
        for (const incident of activeIncidents) {
          const rid = incident.routeId ?? incident.route?.id;
          if (!rid) continue;
          const current = routeIncidentMap.get(rid);
          const severity = incident.severity;
          if (!current || severity === 'critical' || (severity === 'high' && current !== 'critical')) {
            routeIncidentMap.set(rid, severity);
          }
        }

        const configByRoute = new Map<string, any>();
        let totalVehicles = 0;
        let speedSum = 0;
        let speedCount = 0;

        for (const cfg of configs) {
          const rid = cfg.routeId ?? cfg.route?.id;
          if (!rid) continue;
          configByRoute.set(rid, cfg);
          totalVehicles += Number(cfg.vehicleCount || 0);
          if (cfg.avgSpeed) {
            speedSum += Number(cfg.avgSpeed);
            speedCount += 1;
          }
        }

        const activeRouteCount = configByRoute.size;
        const avgSpeed = speedCount > 0 ? Math.round(speedSum / speedCount) : 0;

        let mostCongested: { name: string; speed: number; congestion: number } | null = null;
        let worstCharge = 0;

        const routesData: DashboardRoute[] = apiRoutesArr.map((route: any) => {
          const rid = route.id;
          const cfg = configByRoute.get(rid);
          const vehicleCount = Number(cfg?.vehicleCount || 0);
          const speedLimit = Number(route.speedLimit || 50);
          const speed = Number(cfg?.avgSpeed || speedLimit || 50);
          const incidentSeverity = routeIncidentMap.get(rid);
          const status = getStatus(
            vehicleCount,
            speed,
            incidentSeverity === 'critical',
            incidentSeverity === 'high'
          );
          const charge = computeCharge(
            vehicleCount,
            speed,
            speedLimit,
            incidentSeverity
          );

          if (charge > worstCharge) {
            worstCharge = charge;
            mostCongested = {
              name: route.name ?? `Route ${rid.slice(0, 8)}`,
              speed,
              congestion: charge,
            };
          }

          return {
            id: rid,
            name: route.name ?? `Route ${rid.slice(0, 8)}`,
            type: route.type ?? 'unknown',
            status,
            speed,
            vehicles: vehicleCount,
            charge,
          };
        });

        const latestResultVehicles = Number(latestResult?.totalVehicles || 0);
        const totalSimVehicles = latestResultVehicles > 0 ? latestResultVehicles : totalVehicles;
        const baseCongestion = latestResult?.maxCongestionLevel != null
          ? Number(latestResult.maxCongestionLevel)
          : (routesData.length > 0
              ? routesData.reduce((sum, route) => sum + (route.charge / 100), 0) / routesData.length
              : 0) * 100;

        const trafficEvolution = generateTrafficEvolution(
          clamp(baseCongestion, 0, 100),
          routesData.map((route) => route.charge)
        );

        const vehicleBreakdown = buildVehicleBreakdown(totalSimVehicles);

        setData({
          totalVehicles: totalSimVehicles,
          activeRoutes: activeRouteCount,
          totalRoutes: apiRoutesArr.length,
          averageSpeed: avgSpeed || Math.round((routesData.reduce((sum, route) => sum + route.speed, 0) / Math.max(routesData.length, 1)) || 0),
          mostCongested,
          vehicleBreakdown,
          routesData,
          trafficEvolution,
          operational: activeRouteCount > 0 || scenarios.length > 0 || Boolean(latestResult),
          lastUpdate: new Date(),
          loading: false,
        });
      } catch {
        setData((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchData();
    const id = setInterval(fetchData, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]);

  return data;
}
