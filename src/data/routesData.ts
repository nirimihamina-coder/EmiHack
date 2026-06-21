export interface RoutePoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  cumulativeDistance?: number;
}

export interface Route {
  id: number;
  name: string;
  type: 'main' | 'alternative';
  color: string;
  distance: number;
  duration: number;
  polyline: [number, number][];
  steps: RouteStep[];
  blocked?: boolean;
  recommended?: boolean;
  fastest?: boolean;
  shortest?: boolean;
  transport?: string;
}

export interface RoutesData {
  points: {
    A: RoutePoint;
    B: RoutePoint;
  };
  routes: Route[];
  landmarks: { name: string; lat: number; lng: number }[];
}

export const fianarantsoaRoutes: RoutesData = {
  points: {
    A: { name: 'Centre-ville', lat: -21.45249, lng: 47.085447 },
    B: { name: 'Aéroport', lat: -21.44138, lng: 47.11174 }
  },
  routes: [
    {
      id: 1,
      name: 'Itinéraire principal (bloqué)',
      type: 'main',
      color: '#2c3e50',
      distance: 8.5,
      duration: 18,
      polyline: [
        [-21.45249, 47.085447],
        [-21.4485, 47.089],
        [-21.445, 47.093],
        [-21.442, 47.098],
        [-21.4405, 47.103],
        [-21.44138, 47.11174]
      ],
      steps: [
        { instruction: 'Démarrer sur l\'avenue de l\'Indépendance', distance: 0 },
        { instruction: 'Continuer tout droit sur 1.2 km', distance: 1.2 },
        { instruction: 'Passer devant la gare routière', distance: 2.5 },
        { instruction: 'Tourner à droite au carrefour principal', distance: 3.8 },
        { instruction: 'Suivre la route nationale sur 3 km', distance: 6.8 },
        { instruction: 'Arrivée à l\'aéroport de Fianarantsoa', distance: 8.5 }
      ],
      blocked: true,
      transport: 'Voiture'
    },
    {
      id: 2,
      name: 'Déviation via RN7',
      type: 'alternative',
      color: '#e67e22',
      distance: 12.4,
      duration: 25,
      polyline: [
        [-21.45249, 47.085447],
        [-21.456, 47.082],
        [-21.46, 47.078],
        [-21.458, 47.085],
        [-21.455, 47.095],
        [-21.45, 47.1],
        [-21.444, 47.108],
        [-21.44138, 47.11174]
      ],
      steps: [
        { instruction: 'Démarrer sur l\'avenue de l\'Indépendance', distance: 0 },
        { instruction: 'Prendre la direction sud par la RN7', distance: 0.8 },
        { instruction: 'Continuer sur 3 km jusqu\'au pont', distance: 3.8 },
        { instruction: 'Traverser le pont et tourner à gauche', distance: 5.2 },
        { instruction: 'Suivre la piste aménagée sur 4 km', distance: 9.2 },
        { instruction: 'Rejoindre la route de l\'aéroport', distance: 11.0 },
        { instruction: 'Arrivée à l\'aéroport de Fianarantsoa', distance: 12.4 }
      ],
      recommended: true,
      transport: 'Voiture'
    },
    {
      id: 3,
      name: 'Déviation par les routes secondaires',
      type: 'alternative',
      color: '#8e44ad',
      distance: 10.2,
      duration: 30,
      polyline: [
        [-21.45249, 47.085447],
        [-21.449, 47.088],
        [-21.446, 47.092],
        [-21.443, 47.096],
        [-21.44, 47.1],
        [-21.438, 47.105],
        [-21.44, 47.11],
        [-21.44138, 47.11174]
      ],
      steps: [
        { instruction: 'Démarrer de l\'avenue centrale', distance: 0 },
        { instruction: 'Tourner dans la rue du Marché', distance: 0.5 },
        { instruction: 'Passer devant le marché municipal', distance: 1.2 },
        { instruction: 'Prendre la rue des Artisans à droite', distance: 2.0 },
        { instruction: 'Continuer dans les quartiers résidentiels', distance: 4.5 },
        { instruction: 'Rejoindre la route de ceinture', distance: 7.0 },
        { instruction: 'Suivre la direction nord-est', distance: 9.0 },
        { instruction: 'Arrivée à l\'aéroport de Fianarantsoa', distance: 10.2 }
      ],
      shortest: true,
      transport: 'Moto'
    },
    {
      id: 4,
      name: 'Déviation par le centre-ville',
      type: 'alternative',
      color: '#27ae60',
      distance: 14.8,
      duration: 35,
      polyline: [
        [-21.45249, 47.085447],
        [-21.455, 47.087],
        [-21.458, 47.09],
        [-21.456, 47.095],
        [-21.452, 47.1],
        [-21.448, 47.105],
        [-21.445, 47.11],
        [-21.44138, 47.11174]
      ],
      steps: [
        { instruction: 'Démarrer depuis le centre-ville', distance: 0 },
        { instruction: 'Emprunter le boulevard circulaire', distance: 1.0 },
        { instruction: 'Passer devant la cathédrale', distance: 2.5 },
        { instruction: 'Tourner à gauche à la station-service', distance: 4.0 },
        { instruction: 'Suivre la route panoramique sur 5 km', distance: 9.0 },
        { instruction: 'Descendre vers la vallée', distance: 12.0 },
        { instruction: 'Rejoindre l\'entrée de l\'aéroport', distance: 14.0 },
        { instruction: 'Arrivée à l\'aéroport de Fianarantsoa', distance: 14.8 }
      ],
      fastest: true,
      transport: 'Voiture'
    }
  ],
  landmarks: [
    { name: 'Gare routière', lat: -21.449, lng: 47.088 },
    { name: 'Marché municipal', lat: -21.447, lng: 47.09 },
    { name: 'Cathédrale', lat: -21.453, lng: 47.087 },
    { name: 'Pont de la RN7', lat: -21.458, lng: 47.085 },
    { name: 'Station-service total', lat: -21.455, lng: 47.092 }
  ]
};

export const transportModes = [
  { id: 'voiture', label: 'Voiture', icon: '🚗' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
  { id: 'moto', label: 'Moto', icon: '🏍️' },
  { id: 'velo', label: 'Vélo', icon: '🚲' }
] as const;
