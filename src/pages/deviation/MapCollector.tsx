import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// Types
export interface Point {
  lat: number;
  lng: number;
}

export interface RouteData {
  name: string;
  type: string;
  coordinates: [number, number][]; // [lat, lng]
  distance: number;
  duration: number;
  lanes: number;
  speedLimit: number;
  direction: string;
}

interface GeoJSONFeature {
  type: string;
  features: any[];
}

const MapCollector: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [routeLayer, setRouteLayer] = useState<L.Layer | null>(null);
  const [lastGeoJSON, setLastGeoJSON] = useState<GeoJSONFeature | null>(null);
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const [isExportDisabled, setIsExportDisabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [exportStatus, setExportStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' | '' }>({
    message: '',
    type: ''
  });
  const [routeName, setRouteName] = useState('Route RN1 - Tana vers Itasy');
  const [routeType, setRouteType] = useState('RN 7');

  const API_KEY = '5b3ce3597851110001cf6248f7be3c52a112485db4cb2a9e741b567b';
  const API_URL = 'https://emihack.onrender.com/routes';

  // Initialisation de la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Créer la carte
    const map = L.map(mapContainerRef.current).setView([-21.4546, 47.0875], 14);
    mapRef.current = map;

    // Ajouter le fond de carte
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Gestionnaire de clic
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const newPoint: Point = { lat, lng };
      
      setPoints(prev => [...prev, newPoint]);
      
      // Ajouter un marqueur
      const marker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`Point ${points.length + 1}`);
      
      setMarkers(prev => [...prev, marker]);
    };

    map.on('click', handleMapClick);

    // Nettoyage
    return () => {
      map.off('click', handleMapClick);
      map.remove();
    };
  }, []);

  // Réinitialiser les marqueurs quand le nombre de points change
  useEffect(() => {
    markers.forEach((marker, index) => {
      marker.setPopupContent(`Point ${index + 1}`);
    });
  }, [points.length, markers]);

  // Fonction pour calculer la distance entre deux points (en km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Fonction pour extraire les données de la route
  const extractRouteData = (geoJSON: GeoJSONFeature): RouteData | null => {
    try {
      if (!geoJSON.features || geoJSON.features.length === 0) {
        return null;
      }

      const feature = geoJSON.features[0];
      const coordinates = feature.geometry.coordinates;
      
      // Convertir [lng, lat] -> [lat, lng] pour l'API
      const formattedCoordinates: [number, number][] = coordinates.map((coord: [number, number]) => [
        coord[1], // lat
        coord[0]  // lng
      ]);

      // Calculer la distance totale
      let totalDistance = 0;
      for (let i = 0; i < formattedCoordinates.length - 1; i++) {
        const [lat1, lng1] = formattedCoordinates[i];
        const [lat2, lng2] = formattedCoordinates[i + 1];
        totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
      }

      // Estimer la durée (en minutes) basée sur une vitesse moyenne de 50 km/h
      const averageSpeed = 50; // km/h
      const durationInHours = totalDistance / averageSpeed;
      const durationInMinutes = Math.round(durationInHours * 60);

      return {
        name: routeName,
        type: routeType,
        coordinates: formattedCoordinates,
        distance: Math.round(totalDistance * 10) / 10, // Arrondi à 1 décimale
        duration: durationInMinutes,
  lanes: 2,
  speedLimit: 50,
  direction: "both"
      };
    } catch (error) {
      console.error('Erreur lors de l\'extraction des données:', error);
      return null;
    }
  };

  // Fonction pour calculer la route
  const fetchRoute = async () => {
    if (points.length < 2) {
      setExportStatus({
        message: '⚠️ Ajoutez au moins 2 points pour calculer une route.',
        type: 'error'
      });
      return;
    }

    if (!mapRef.current) return;

    setExportStatus({ message: 'Calcul de la route en cours...', type: 'info' });

    try {
      const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
      const coordinates = points.map(p => [p.lng, p.lat]);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coordinates })
      });

      const data = await response.json();
      setLastGeoJSON(data);

      if (data.features && data.features.length > 0) {
        // Supprimer l'ancien layer de route
        if (routeLayer) {
          mapRef.current.removeLayer(routeLayer);
        }

        // Ajouter le nouveau layer
        const newRouteLayer = L.geoJSON(data, { 
          style: { color: 'red', weight: 5 } 
        }).addTo(mapRef.current);
        
        setRouteLayer(newRouteLayer);
        mapRef.current.fitBounds(newRouteLayer.getBounds());

        // Extraire les données de la route
        const extractedData = extractRouteData(data);
        if (extractedData) {
          setRouteData(extractedData);
          setIsExportDisabled(false);
          setExportStatus({
            message: `✅ Route calculée ! Distance: ${extractedData.distance} km, Durée: ${extractedData.duration} min`,
            type: 'success'
          });
        } else {
          setExportStatus({
            message: '❌ Erreur lors de l\'extraction des données de la route.',
            type: 'error'
          });
        }
      } else {
        setExportStatus({
          message: '❌ Erreur de calcul de la route.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Erreur lors du calcul de la route:', error);
      setExportStatus({
        message: '❌ Une erreur est survenue lors du calcul de la route.',
        type: 'error'
      });
    }
  };

  // Fonction pour exporter vers l'API
  const exportToAPI = async () => {
    if (!routeData) {
      setExportStatus({
        message: '⚠️ Aucune donnée de route à exporter. Calculez d\'abord la route.',
        type: 'error'
      });
      return;
    }

    setIsExporting(true);
    setExportStatus({ message: '📤 Exportation en cours vers l\'API...', type: 'info' });

    try {
      console.log('Données envoyées à l\'API:', routeData);

      const response = await axios.post(API_URL, routeData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 secondes
      });

      console.log('Réponse du serveur:', response.data);

      setExportStatus({
        message: `✅ Exportation réussie vers l'API ! (${new Date().toLocaleTimeString()})`,
        type: 'success'
      });

      // Optionnel : Afficher la réponse du serveur
      if (response.data) {
        console.log('Données reçues du serveur:', response.data);
      }

    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      
      let errorMessage = '❌ Erreur lors de l\'exportation.';
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage += ` Statut: ${error.response.status}`;
          if (error.response.data) {
            errorMessage += ` - ${JSON.stringify(error.response.data)}`;
          }
        } else if (error.request) {
          errorMessage += ' Aucune réponse du serveur. Vérifiez votre connexion.';
        } else {
          errorMessage += ` ${error.message}`;
        }
      } else {
        errorMessage += ` ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
      }

      setExportStatus({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Fonction pour exporter en JSON local (pour déboguer)
  const exportLocalJSON = () => {
    if (!routeData) {
      setExportStatus({
        message: '⚠️ Aucune donnée de route à exporter.',
        type: 'error'
      });
      return;
    }
    
    const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route_${routeName.replace(/\s/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportStatus({
      message: '✅ Export local réussi !',
      type: 'success'
    });
  };

  // Réinitialiser
  const resetMap = () => {
    if (!mapRef.current) return;

    // Supprimer tous les marqueurs
    markers.forEach(marker => {
      mapRef.current!.removeLayer(marker);
    });
    setMarkers([]);

    // Supprimer le layer de route
    if (routeLayer) {
      mapRef.current.removeLayer(routeLayer);
      setRouteLayer(null);
    }

    // Réinitialiser les états
    setPoints([]);
    setLastGeoJSON(null);
    setRouteData(null);
    setIsExportDisabled(true);
    setExportStatus({ message: '', type: '' });

    // Revenir à la vue initiale
    mapRef.current.setView([-21.4546, 47.0875], 14);
  };

  return (
    <div className="font-sans m-5 max-w-6xl mx-auto">
      <div className="bg-gray-100 p-4 rounded-lg mb-4 shadow-md">
        <h2 className="text-xl font-bold mb-3">Routage & Export : Fianarantsoa</h2>
        
        {/* Champs pour les métadonnées de la route */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la route
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Route RN1 - Tana vers Itasy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de route
            </label>
            <input
              type="text"
              value={routeType}
              onChange={(e) => setRouteType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: RN 7"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={fetchRoute}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
          >
            Calculer la Route
          </button>
          
          <button
            onClick={exportToAPI}
            disabled={isExportDisabled || isExporting}
            className={`px-4 py-2 rounded transition-colors ${
              isExportDisabled || isExporting
                ? 'bg-blue-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isExporting ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Exportation...
              </>
            ) : (
              '📤 Exporter vers l\'API'
            )}
          </button>
          
          <button
            onClick={resetMap}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            🔄 Réinitialiser
          </button>

          <button
            onClick={exportLocalJSON}
            disabled={isExportDisabled}
            className={`px-4 py-2 rounded transition-colors ${
              isExportDisabled 
                ? 'bg-yellow-300 text-gray-500 cursor-not-allowed' 
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            💾 Export Local (JSON)
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <p className="text-gray-600">
            📍 Points sélectionnés : <span className="font-bold">{points.length}</span>
          </p>
          {routeData && (
            <>
              <p className="text-gray-600">
                📏 Distance : <span className="font-bold text-green-600">{routeData.distance} km</span>
              </p>
              <p className="text-gray-600">
                ⏱️ Durée estimée : <span className="font-bold text-blue-600">{routeData.duration} min</span>
              </p>
            </>
          )}
        </div>

        {/* Message de statut d'exportation */}
        {exportStatus.message && (
          <div className={`mt-3 p-3 rounded border ${
            exportStatus.type === 'success' 
              ? 'bg-green-100 border-green-400 text-green-700' 
              : exportStatus.type === 'error'
              ? 'bg-red-100 border-red-400 text-red-700'
              : 'bg-blue-100 border-blue-400 text-blue-700'
          }`}>
            <p className="text-sm font-medium">{exportStatus.message}</p>
          </div>
        )}
      </div>

      <div 
        ref={mapContainerRef} 
        className="h-[60vh] w-full border-2 border-gray-300 rounded-lg shadow-md"
      />
    </div>
  );
};

export default MapCollector;