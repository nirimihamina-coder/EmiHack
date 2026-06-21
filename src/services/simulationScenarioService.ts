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
  try {
    const res = await axiosInstance.get('/simulation-scenarios');
    return res.data;
  } catch (err) {
    console.error('❌ [GET] /simulation-scenarios - Erreur:', err);
    throw err;
  }
}

export async function createScenario(scenario: Omit<SimulationScenario, 'id' | 'createdAt'>): Promise<SimulationScenario> {
  console.log('📡 [POST] /simulation-scenarios - Création du scénario:', scenario.name);
  console.log('📦 Payload:', scenario);
  try {
    const res = await axiosInstance.post('/simulation-scenarios', scenario);
    console.log('✅ [POST] /simulation-scenarios - Succès:', res.data);
    return res.data;
  } catch (err) {
    console.error('❌ [POST] /simulation-scenarios - Erreur:', err);
    throw err;
  }
}

export async function updateScenario(id: string, scenario: Partial<SimulationScenario>): Promise<SimulationScenario> {
  console.log(`📡 [PUT] /simulation-scenarios/${id} - Mise à jour du scénario`);
  console.log('📦 Payload:', scenario);
  try {
    const res = await axiosInstance.put(`/simulation-scenarios/${id}`, scenario);
    console.log('✅ [PUT] /simulation-scenarios - Succès:', res.data);
    return res.data;
  } catch (err) {
    console.error(`❌ [PUT] /simulation-scenarios/${id} - Erreur:`, err);
    throw err;
  }
}

export async function deleteScenario(id: string): Promise<void> {
  console.log(`📡 [DELETE] /simulation-scenarios/${id} - Suppression du scénario`);
  try {
    await axiosInstance.delete(`/simulation-scenarios/${id}`);
    console.log(`✅ [DELETE] /simulation-scenarios/${id} - Succès`);
  } catch (err) {
    console.error(`❌ [DELETE] /simulation-scenarios/${id} - Erreur:`, err);
    throw err;
  }
}

export async function runScenario(id: string): Promise<{ simulationId: string }> {
  console.log(`📡 [POST] /simulation-scenarios/${id}/run - Lancement du scénario`);
  try {
    const res = await axiosInstance.post(`/simulation-scenarios/${id}/run`);
    console.log('✅ [POST] /simulation-scenarios - Succès:', res.data);
    return res.data;
  } catch (err) {
    console.error(`❌ [POST] /simulation-scenarios/${id}/run - Erreur:`, err);
    throw err;
  }
}