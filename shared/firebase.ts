import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, push, remove, update, query, orderByChild, limitToLast } from 'firebase/database';
import { Client, Appointment } from './schema';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBpnaDC7D95qeXHp2xh4z-8RRc8Tz4LpFM",
  authDomain: "autoexpress-142e1.firebaseapp.com",
  databaseURL: "https://autoexpress-142e1-default-rtdb.firebaseio.com",
  projectId: "autoexpress-142e1",
  storageBucket: "autoexpress-142e1.appspot.com",
  messagingSenderId: "1086934965058",
  appId: "1:1086934965058:web:3e72fcce8b73ab40ae3c1f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Firebase references
const clientsRef = ref(database, 'clients');
const appointmentsRef = ref(database, 'appointments');
const countersRef = ref(database, 'counters');

// Client functions
export const getAllClients = async (): Promise<Client[]> => {
  const snapshot = await get(clientsRef);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val() as Record<string, Client>);
};

export const getClientById = async (id: string): Promise<Client | null> => {
  const clientRef = ref(database, `clients/${id}`);
  const snapshot = await get(clientRef);
  return snapshot.exists() ? snapshot.val() as Client : null;
};

export const getRecentClients = async (limit: number = 5): Promise<Client[]> => {
  const recentClientsQuery = query(clientsRef, orderByChild('createdAt'), limitToLast(limit));
  const snapshot = await get(recentClientsQuery);
  if (!snapshot.exists()) return [];
  
  const clients = Object.values(snapshot.val() as Record<string, Client>);
  return clients.sort((a, b) => b.createdAt - a.createdAt);
};

export const createClient = async (client: Omit<Client, 'id'>): Promise<Client> => {
  // Get next client ID
  const counterSnapshot = await get(ref(database, 'counters/clientId'));
  const nextId = (counterSnapshot.exists() ? counterSnapshot.val() : 0) + 1;
  
  // Format client ID with leading zeros
  const clientId = `CL${nextId.toString().padStart(3, '0')}`;
  
  const newClient: Client = {
    ...client,
    id: clientId,
  };
  
  // Save client and update counter
  await set(ref(database, `clients/${clientId}`), newClient);
  await set(ref(database, 'counters/clientId'), nextId);
  
  return newClient;
};

export const updateClient = async (id: string, updates: Partial<Client>): Promise<void> => {
  await update(ref(database, `clients/${id}`), updates);
};

export const deleteClient = async (id: string): Promise<void> => {
  await remove(ref(database, `clients/${id}`));
};

// Appointment functions
export const getAllAppointments = async (): Promise<Appointment[]> => {
  const snapshot = await get(appointmentsRef);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val() as Record<string, Appointment>);
};

export const getAppointmentsByDate = async (date: string): Promise<Appointment[]> => {
  const snapshot = await get(appointmentsRef);
  if (!snapshot.exists()) return [];
  
  const appointments = Object.values(snapshot.val() as Record<string, Appointment>);
  return appointments.filter(appointment => appointment.date === date);
};

export const getAppointmentById = async (id: string): Promise<Appointment | null> => {
  const appointmentRef = ref(database, `appointments/${id}`);
  const snapshot = await get(appointmentRef);
  return snapshot.exists() ? snapshot.val() as Appointment : null;
};

export const createAppointment = async (appointment: Omit<Appointment, 'id'>): Promise<Appointment> => {
  // Get next appointment ID
  const counterSnapshot = await get(ref(database, 'counters/appointmentId'));
  const nextId = (counterSnapshot.exists() ? counterSnapshot.val() : 0) + 1;
  
  // Format appointment ID with leading zeros
  const appointmentId = `AP${nextId.toString().padStart(3, '0')}`;
  
  const newAppointment: Appointment = {
    ...appointment,
    id: appointmentId,
  };
  
  // Save appointment and update counter
  await set(ref(database, `appointments/${appointmentId}`), newAppointment);
  await set(ref(database, 'counters/appointmentId'), nextId);
  
  return newAppointment;
};

export const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<void> => {
  await update(ref(database, `appointments/${id}`), updates);
};

export const deleteAppointment = async (id: string): Promise<void> => {
  await remove(ref(database, `appointments/${id}`));
};
