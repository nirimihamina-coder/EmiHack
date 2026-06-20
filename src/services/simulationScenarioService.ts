import axiosInstance from "../api/axios";

export interface ScenarioRouteConfig {
  routeId: string;
  vehicleCount: number;
  avgSpeed: number;
}

export interface ScenarioIncident {
  routeId: string;
  type: 'accident' | 'construction' | 'road_work' | 'obstacle';
  severity: 'low' | 'medium' | 'high' | 'critical';
  positionOnRoute: number;
  description?: string;
}

export interface SimulationScenario {
  id?: string;
  name: string;
  description?: string;
  vehicleDensity: 'low' | 'medium' | 'high';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  routeConfigs: ScenarioRouteConfig[];
  incidents: ScenarioIncident[];
  createdAt?: string;
}

export async function fetchScenarios(): Promise<SimulationScenario[]> {
  console.log('📡 [GET] /api/simulation-scenarios - Récupération des scénarios...');
  try {
    const res = await axiosInstance.get('/api/simulation-scenarios');
    console.log('✅ [GET] /api/simulation-scenarios - Succès:', res.data.length, 'scénarios');
    return res.data;
  } catch (err) {
    console.error('❌ [GET] /api/simulation-scenarios - Erreur:', err);
    throw err;
  }
}

export async function createScenario(scenario: Omit<SimulationScenario, 'id' | 'createdAt'>): Promise<SimulationScenario> {
  console.log('📡 [POST] /api/simulation-scenarios - Création du scénario:', scenario.name);
  console.log('📦 Payload:', scenario);
  try {
    const res = await axiosInstance.post('/api/simulation-scenarios', scenario);
    console.log('✅ [POST] /api/simulation-scenarios - Succès:', res.data);
    return res.data;
  } catch (err) {
    console.error('❌ [POST] /api/simulation-scenarios - Erreur:', err);
    throw err;
  }
}

export async function updateScenario(id: string, scenario: Partial<SimulationScenario>): Promise<SimulationScenario> {
  console.log(`📡 [PUT] /api/simulation-scenarios/${id} - Mise à jour du scénario`);
  console.log('📦 Payload:', scenario);
  try {
    const res = await axiosInstance.put(`/api/simulation-scenarios/${id}`, scenario);
    console.log('✅ [PUT] /api/simulation-scenarios - Succès:', res.data);
    return res.data;
  } catch (err) {
    console.error(`❌ [PUT] /api/simulation-scenarios/${id} - Erreur:`, err);
    throw err;
  }
}

export async function deleteScenario(id: string): Promise<void> {
  console.log(`📡 [DELETE] /api/simulation-scenarios/${id} - Suppression du scénario`);
  try {
    await axiosInstance.delete(`/api/simulation-scenarios/${id}`);
    console.log(`✅ [DELETE] /api/simulation-scenarios/${id} - Succès`);
  } catch (err) {
    console.error(`❌ [DELETE] /api/simulation-scenarios/${id} - Erreur:`, err);
    throw err;
  }
}

export async function runScenario(id: string): Promise<{ simulationId: string }> {
  console.log(`📡 [POST] /api/simulation-scenarios/${id}/run - Lancement du scénario`);
  try {
    const res = await axiosInstance.post(`/api/simulation-scenarios/${id}/run`);
    console.log('✅ [POST] /api/simulation-scenarios - Succès:', res.data);
    return res.data;
  } catch (err) {
    console.error(`❌ [POST] /api/simulation-scenarios/${id}/run - Erreur:`, err);
    throw err;
  }
}