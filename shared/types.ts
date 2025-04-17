export interface ClientStatistics {
  totalClients: number;
  newClientsThisMonth: number;
  totalAppointments: number;
}

export interface DashboardData {
  todayAppointments: Appointment[];
  recentClients: Client[];
  statistics: ClientStatistics;
}

export interface User {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export const DEFAULT_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// Re-export from schema
import { Client, Appointment, CreateClientInput, CreateAppointmentInput } from './schema';
export type { Client, Appointment, CreateClientInput, CreateAppointmentInput };
