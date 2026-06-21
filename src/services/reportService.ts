import axiosInstance from '../api/axios';

export interface Reporter {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

export interface Report {
  id: string;
  type: string;
  severity: string;
  lat: number;
  lon: number;
  fokontanyName: string;
  positionOnRoute: number;
  description: string;
  lanesBlocked: number;
  reporter: Reporter;
  startTime: string;
  endTime: string | null;
  status: string;
  createdAt: string;
}

export async function fetchReports(): Promise<Report[]> {
  const res = await axiosInstance.get('/reports/all');
  const data = res.data;
  return Array.isArray(data) ? data : (data.data || data.results || []);
}
