export type VehicleType = 'car' | 'motorcycle' | 'bike';
export type VehicleState = 'moving' | 'slowing' | 'stopped' | 'waiting';

export interface SimulationConfig {
  roadId: string;
  roadName: string;
  vehicleCount: number;
  speed: number;
  running: boolean;
}

export interface Vehicle {
  id: string;
  roadId: string;
  progress: number;
  speed: number;
  targetSpeed: number;
  maxSpeed: number;
  type: VehicleType;
  state: VehicleState;
  waitingFor?: string;
  length: number;
  lastPosition: { lat: number; lng: number };
  trail: { lat: number; lng: number }[];
  heading: number;
}

export interface VehiclePosition {
  id: string;
  roadId: string;
  lat: number;
  lng: number;
  progress: number;
  speed: number;
  targetSpeed: number;
  type: VehicleType;
  state: VehicleState;
  heading: number;
}

export interface Intersection {
  id: string;
  lat: number;
  lon: number;
  type: 'roundabout' | 'stop' | 'priority' | 'uncontrolled';
  connectedRoadIds: string[];
  priorityRoadId?: string;
}

export interface RouteIntersection {
  id: string;
  intersectionId: string;
  routeId1: string;
  routeId2: string;
  priorityRouteId: string;
  positionOnRoute1: number;
  positionOnRoute2: number;
}

export interface TrafficIncident {
  id: string;
  routeId: string;
  type: 'accident' | 'construction' | 'road_work' | 'obstacle';
  severity: 'low' | 'medium' | 'high' | 'critical';
  positionOnRoute: number;
  lanesBlocked: number;
  active: boolean;
}

export interface Bottleneck {
  intersectionId: string;
  severity: number;
  waitingVehicles: number;
  avgWaitTime: number;
  affectedRoutes: string[];
}

export interface Suggestion {
  type: 'add_traffic_light' | 'add_roundabout' | 'add_lane' | 'divert_traffic' | 'add_stop_sign' | 'priority_road';
  targetId: string;
  priority: number;
  estimatedImprovement: string;
  description: string;
  cost: 'low' | 'medium' | 'high';
}
