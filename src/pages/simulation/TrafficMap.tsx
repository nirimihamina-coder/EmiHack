import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { io } from 'socket.io-client';

// ⚠️ TRÈS IMPORTANT : N'oubliez pas le CSS de Leaflet, sinon la carte sera cassée !
import 'leaflet/dist/leaflet.css';

const socket = io('http://localhost:3000'); // URL de votre API NestJS

interface Vehicle {
  id: string;
  routeId: string;
  lat: number;
  lon: number;
  isStuck: boolean;
}

export default function TrafficMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // 🌟 L'ASTUCE HACKATHON : On stocke les marqueurs dans un Map pour les mettre à jour sans les recréer
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // 1. Initialisation de la carte (une seule fois au montage)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Création de la carte Leaflet
    const map = L.map(mapContainerRef.current).setView([48.8566, 2.3522], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;

    // Nettoyage au démontage du composant
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Gestion du Temps Réel (WebSocket)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    socket.on('vehiclePositions', (data: Vehicle[]) => {
      const currentVehicleIds = new Set(data.map(v => v.id));

      // --- ÉTAPE A : Mettre à jour ou Créer les marqueurs ---
      data.forEach(vehicle => {
        const existingMarker = markersRef.current.get(vehicle.id);
        
        if (existingMarker) {
          // 🚀 Le marqueur existe déjà : on le déplace (animation fluide)
          existingMarker.setLatLng([vehicle.lat, vehicle.lon]);
          // On met à jour la couleur si l'état (bouchon ou pas) a changé
          existingMarker.setStyle({
            color: vehicle.isStuck ? 'red' : 'green',
            fillColor: vehicle.isStuck ? 'red' : 'green'
          });
        } else {
          // 🆕 Nouveau véhicule : on crée le marqueur
          const marker = L.circleMarker([vehicle.lat, vehicle.lon], {
            radius: 6,
            color: vehicle.isStuck ? 'red' : 'green',
            fillColor: vehicle.isStuck ? 'red' : 'green',
            fillOpacity: 0.8,
            weight: 2
          }).bindPopup(`Ligne ${vehicle.routeId} - ${vehicle.isStuck ? '🚨 Bouchon' : '✅ OK'}`);
          
          marker.addTo(map);
          markersRef.current.set(vehicle.id, marker);
        }
      });

      // --- ÉTAPE B : Supprimer les véhicules qui ne sont plus dans le flux ---
      markersRef.current.forEach((marker, id) => {
        if (!currentVehicleIds.has(id)) {
          marker.remove(); // Supprime de la carte
          markersRef.current.delete(id); // Supprime de notre mémoire
        }
      });
    });

    return () => {
      socket.off('vehiclePositions');
    };
  }, []);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height: '100vh', width: '100%' }} 
    />
  );
}