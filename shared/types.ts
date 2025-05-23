export interface ClientStatistics {
  totalClients: number;
  newClientsThisMonth: number;
  totalAppointments: number;
}

// Import from types-helpers to avoid circular reference errors
import type { Client, Appointment } from './types-helpers';

export interface DashboardData {
  todayAppointments: Appointment[];
  recentClients: Client[];
  statistics: ClientStatistics;
}

export interface User {
  username: string;
  password: string;
  clientId?: string;
  email?: string;
  name?: string;
  surname?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export const DEFAULT_CREDENTIALS = {
  username: 'aut@express!',
  password: 's!vol@'
};

// Re-export from schema
export * from './types-export';
