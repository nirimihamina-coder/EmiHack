export type SpeedMode = 'slow' | 'normal' | 'fast';

export interface SimulationConfig {
  roadId: string;
  roadName: string;
  vehicleCount: number;
  speed: SpeedMode;
  running: boolean;
}

export interface Vehicle {
  id: string;
  configId: string;
  roadId: string;
  progress: number;
  speed: number;
}

export interface VehiclePosition {
  id: string;
  lat: number;
  lng: number;
  roadId: string;
  type: 'car' | 'bus' | 'truck' | 'bike' | 'motorcycle';
}
