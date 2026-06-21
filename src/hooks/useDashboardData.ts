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

function getStatus(
  vehicleCount: number,
  speed: number,
  hasCriticalIncident: boolean,
  hasHighIncident: boolean
): 'fluide' | 'dense' | 'saturée' {
  if (hasCriticalIncident || (speed > 0 && speed < 25)) return 'saturée';
  if (hasHighIncident || (speed > 0 && speed < 55) || (vehicleCount > 50)) return 'dense';
  return 'fluide';
}

function computeCharge(status: 'fluide' | 'dense' | 'saturée'): number {
  if (status === 'saturée') return 85 + Math.round(Math.random() * 12);
  if (status === 'dense') return 50 + Math.round(Math.random() * 20);
  return 15 + Math.round(Math.random() * 20);
}

function generateTrafficEvolution(
  baseCongestion: number
): { hour: string; value: number }[] {
  const hours = ['06h','07h','08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h'];
  const morningPeak = [22, 45, 78, 92, 68, 55];
  const middayDip = [72, 80, 65, 70];
  const eveningPeak = [88, 95, 82, 58, 35];
  const pattern = [...morningPeak, ...middayDip, ...eveningPeak];

  return pattern.map((v, i) => {
    const noise = Math.sin(Date.now() / 10000 + i) * 5;
    const congFactor = 1 + (baseCongestion - 0.3) * 0.5;
    return { hour: hours[i], value: Math.round(Math.min(100, v * congFactor + noise)) };
  });
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
        const [configsRes, reportsRes, apiRoutes] = await Promise.all([
          axiosInstance.get('/simulation-route-configs').catch(() => ({ data: [] })),
          axiosInstance.get('/reports/all').catch(() => ({ data: [] })),
          useRoadsStore.getState().apiRoutes.length > 0
            ? useRoadsStore.getState().apiRoutes
            : axiosInstance.get('/routes/all').then((r) => r.data),
        ]);

        const configs: any[] = Array.isArray(configsRes.data) ? configsRes.data : [];
        const reports: any[] = Array.isArray(reportsRes.data) ? reportsRes.data : [];

        const activeIncidents = reports.filter(
          (r: any) => r.status === 'active'
        );

        const routeIncidentMap = new Map<string, 'critical' | 'high' | 'medium' | 'low'>();
        for (const inc of activeIncidents) {
          const rid = inc.routeId ?? inc.route?.id;
          if (!rid) continue;
          const cur = routeIncidentMap.get(rid);
          const sev = inc.severity;
          if (!cur || sev === 'critical' || (sev === 'high' && cur !== 'critical')) {
            routeIncidentMap.set(rid, sev);
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
          totalVehicles += cfg.vehicleCount ?? 0;
          if (cfg.avgSpeed) {
            speedSum += cfg.avgSpeed;
            speedCount++;
          }
        }

        const activeRouteCount = configByRoute.size;
        const avgSpeed = speedCount > 0 ? Math.round(speedSum / speedCount) : 0;

        const apiRoutesArr = Array.isArray(apiRoutes) ? apiRoutes : [];

        let mostCongested: { name: string; speed: number; congestion: number } | null = null;
        let worstCharge = 0;

        const routesData: DashboardRoute[] = apiRoutesArr.map((r: any) => {
          const rid = r.id;
          const cfg = configByRoute.get(rid);
          const vCount = cfg?.vehicleCount ?? 0;
          const speed = cfg?.avgSpeed ?? r.speedLimit ?? 50;
          const incidentSev = routeIncidentMap.get(rid);
          const hasCritical = incidentSev === 'critical';
          const hasHigh = incidentSev === 'high';
          const status = getStatus(vCount, speed, hasCritical, hasHigh);
          const charge = computeCharge(status);

          if (charge > worstCharge) {
            worstCharge = charge;
            mostCongested = { name: r.name ?? rid.slice(0, 8), speed, congestion: charge };
          }

          return {
            id: rid,
            name: r.name ?? `Route ${rid.slice(0, 8)}`,
            type: r.type ?? 'unknown',
            status,
            speed,
            vehicles: vCount,
            charge,
          };
        });

        const totalSimVehicles = totalVehicles || Math.max(1, activeRouteCount * 50);
        const breakdownTotal = totalSimVehicles;

        const vehicleBreakdown: VehicleBreakdownItem[] = [
          { label: 'Voitures', value: Math.round(breakdownTotal * 0.7), pct: 70, color: 'from-blue-400 to-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', icon: '🚗' },
          { label: 'Motos', value: Math.round(breakdownTotal * 0.2), pct: 20, color: 'from-amber-400 to-orange-400', bg: 'bg-amber-50', text: 'text-amber-600', icon: '🏍️' },
          { label: 'Vélos', value: Math.round(breakdownTotal * 0.1), pct: 10, color: 'from-emerald-400 to-teal-400', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: '🚲' },
          { label: 'Bus', value: Math.round(breakdownTotal * 0.0), pct: 0, color: 'from-violet-400 to-purple-400', bg: 'bg-violet-50', text: 'text-violet-600', icon: '🚌' },
        ];

        const baseCongestion = activeRouteCount > 0
          ? routesData.filter((r) => r.status !== 'fluide').length / activeRouteCount
          : 0;

        setData({
          totalVehicles: totalSimVehicles,
          activeRoutes: activeRouteCount,
          totalRoutes: apiRoutesArr.length,
          averageSpeed: avgSpeed,
          mostCongested,
          vehicleBreakdown,
          routesData,
          trafficEvolution: generateTrafficEvolution(baseCongestion),
          operational: activeRouteCount > 0,
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
