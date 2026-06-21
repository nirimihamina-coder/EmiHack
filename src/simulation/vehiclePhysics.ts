import type { Vehicle } from './types';

const MIN_SAFE_DISTANCE = 4;
const VEHICLE_LENGTH = 2;
const MAX_ACCELERATION = 3;
const MAX_DECELERATION = 6;
const COMFORT_DECEL = 2;
const REACTION_TIME = 0.3;

export function getSafeDistance(speed: number): number {
  const speedMs = speed / 3.6;
  return speedMs * REACTION_TIME + VEHICLE_LENGTH + MIN_SAFE_DISTANCE;
}

export function updateVehicleSpeed(
  vehicle: Vehicle,
  vehicleAhead: Vehicle | null,
  distanceToIntersection: number | null,
  intersectionSpeed: number | null,
  deltaTime: number
): void {
  let targetSpeed = vehicle.maxSpeed;

  if (vehicleAhead) {
    const distanceToAhead = getDistanceBetweenVehicles(vehicle, vehicleAhead);
    const safeDistance = getSafeDistance(vehicle.speed);

    if (distanceToAhead < VEHICLE_LENGTH + 2) {
      targetSpeed = 0;
      vehicle.state = 'stopped';
    } else if (distanceToAhead < safeDistance) {
      targetSpeed = vehicleAhead.speed * 0.9;
      vehicle.state = 'slowing';
    } else {
      vehicle.state = 'moving';
    }
  }

  if (distanceToIntersection !== null && intersectionSpeed !== null) {
    if (distanceToIntersection < 50) {
      const decelRatio = distanceToIntersection / 50;
      targetSpeed = Math.min(targetSpeed, intersectionSpeed * decelRatio + 5);
    }
    if (distanceToIntersection < 3 && intersectionSpeed === 0) {
      targetSpeed = 0;
      vehicle.state = 'stopped';
    }
  }

  const speedDiff = targetSpeed - vehicle.speed;
  const speedDiffMs = speedDiff / 3.6;

  if (speedDiffMs > 0) {
    vehicle.speed += Math.min(speedDiffMs, MAX_ACCELERATION * deltaTime) * 3.6;
  } else {
    const decel = Math.abs(speedDiffMs) > 5 ? MAX_DECELERATION : COMFORT_DECEL;
    vehicle.speed += Math.max(speedDiffMs, -decel * deltaTime) * 3.6;
  }

  vehicle.speed = Math.max(0, Math.min(vehicle.speed, vehicle.maxSpeed));
  vehicle.targetSpeed = targetSpeed;
}

export function updateVehiclePosition(
  vehicle: Vehicle,
  routeCoordinates: [number, number][],
  deltaTime: number
): void {
  if (vehicle.speed === 0) return;

  const distanceMeters = (vehicle.speed / 3.6) * deltaTime;
  const routeLength = calculateRouteLength(routeCoordinates);
  const progressIncrement = (distanceMeters / routeLength) * 100;
  vehicle.progress += progressIncrement;

  if (vehicle.progress >= 100) {
    vehicle.progress = 100;
    return;
  }

  const currentPosition = getPositionOnRoute(vehicle.progress, routeCoordinates);

  vehicle.lastPosition = { lat: currentPosition.lat, lng: currentPosition.lng };

  vehicle.trail.push(currentPosition);
  if (vehicle.trail.length > 5) vehicle.trail.shift();

  if (vehicle.trail.length >= 2) {
    const prev = vehicle.trail[vehicle.trail.length - 2];
    const curr = vehicle.trail[vehicle.trail.length - 1];
    vehicle.heading = calculateBearing(prev, curr);
  }
}

function getDistanceBetweenVehicles(
  vehicle: Vehicle,
  vehicleAhead: Vehicle,
  routeLength?: number
): number {
  const progressDiff = vehicleAhead.progress - vehicle.progress;
  if (progressDiff < 0) return Infinity;
  return (progressDiff / 100) * (routeLength || 1000);
}

export function calculateRouteLength(coordinates: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineDistance(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

export function haversineDistance(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number]
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getPositionOnRoute(
  progress: number,
  coordinates: [number, number][]
): { lat: number; lng: number } {
  const totalLength = calculateRouteLength(coordinates);
  const targetDistance = (progress / 100) * totalLength;

  let accumulated = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const segmentLength = haversineDistance(coordinates[i - 1], coordinates[i]);
    if (accumulated + segmentLength >= targetDistance) {
      const ratio = (targetDistance - accumulated) / segmentLength;
      return {
        lat: coordinates[i - 1][0] + (coordinates[i][0] - coordinates[i - 1][0]) * ratio,
        lng: coordinates[i - 1][1] + (coordinates[i][1] - coordinates[i - 1][1]) * ratio,
      };
    }
    accumulated += segmentLength;
  }

  const last = coordinates[coordinates.length - 1];
  return { lat: last[0], lng: last[1] };
}

export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLon = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(to.lat * Math.PI / 180);
  const x =
    Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) -
    Math.sin(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
