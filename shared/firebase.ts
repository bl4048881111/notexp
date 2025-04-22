import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, push, remove, update, query, orderByChild, limitToLast } from 'firebase/database';
import { Client, Appointment, Quote, ServiceType, QuoteItem } from './schema';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBpnaDC7D95qeXHp2xh4z-8RRc8Tz4LpFM",
  authDomain: "autoexpress-142e1.firebaseapp.com",
  databaseURL: "https://autoexpress-142e1-default-rtdb.europe-west1.firebasedatabase.app",
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
const quotesRef = ref(database, 'quotes');
const serviceTypesRef = ref(database, 'serviceTypes');

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

// Service Type functions
export const getAllServiceTypes = async (): Promise<ServiceType[]> => {
  const snapshot = await get(serviceTypesRef);
  if (!snapshot.exists()) {
    await initDefaultServiceTypes(); // Initialize default service types if none exist
    const newSnapshot = await get(serviceTypesRef);
    if (!newSnapshot.exists()) return [];
    return Object.values(newSnapshot.val() as Record<string, ServiceType>);
  }
  return Object.values(snapshot.val() as Record<string, ServiceType>);
};

export const getServiceTypeById = async (id: string): Promise<ServiceType | null> => {
  const serviceTypeRef = ref(database, `serviceTypes/${id}`);
  const snapshot = await get(serviceTypeRef);
  return snapshot.exists() ? snapshot.val() as ServiceType : null;
};

export const getServiceTypesByCategory = async (category: string): Promise<ServiceType[]> => {
  const snapshot = await get(serviceTypesRef);
  if (!snapshot.exists()) return [];
  
  const serviceTypes = Object.values(snapshot.val() as Record<string, ServiceType>);
  return serviceTypes.filter(serviceType => serviceType.category === category);
};

export const createServiceType = async (serviceType: Omit<ServiceType, 'id'>): Promise<ServiceType> => {
  // Get next service type ID
  const counterSnapshot = await get(ref(database, 'counters/serviceTypeId'));
  const nextId = (counterSnapshot.exists() ? counterSnapshot.val() : 0) + 1;
  
  // Format service type ID with leading zeros
  const serviceTypeId = `ST${nextId.toString().padStart(3, '0')}`;
  
  const newServiceType: ServiceType = {
    ...serviceType,
    id: serviceTypeId,
  };
  
  // Save service type and update counter
  await set(ref(database, `serviceTypes/${serviceTypeId}`), newServiceType);
  await set(ref(database, 'counters/serviceTypeId'), nextId);
  
  return newServiceType;
};

export const updateServiceType = async (id: string, updates: Partial<ServiceType>): Promise<void> => {
  await update(ref(database, `serviceTypes/${id}`), updates);
};

export const deleteServiceType = async (id: string): Promise<void> => {
  await remove(ref(database, `serviceTypes/${id}`));
};

// Quote functions
export const getAllQuotes = async (): Promise<Quote[]> => {
  const snapshot = await get(quotesRef);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val() as Record<string, Quote>);
};

export const getQuoteById = async (id: string): Promise<Quote | null> => {
  const quoteRef = ref(database, `quotes/${id}`);
  const snapshot = await get(quoteRef);
  return snapshot.exists() ? snapshot.val() as Quote : null;
};

export const getQuotesByClientId = async (clientId: string): Promise<Quote[]> => {
  const snapshot = await get(quotesRef);
  if (!snapshot.exists()) return [];
  
  const quotes = Object.values(snapshot.val() as Record<string, Quote>);
  return quotes.filter(quote => quote.clientId === clientId);
};

export const createQuote = async (quote: Omit<Quote, 'id'>): Promise<Quote> => {
  // Get next quote ID
  const counterSnapshot = await get(ref(database, 'counters/quoteId'));
  const nextId = (counterSnapshot.exists() ? counterSnapshot.val() : 0) + 1;
  
  // Format quote ID with leading zeros
  const quoteId = `PR${nextId.toString().padStart(3, '0')}`;
  
  const newQuote: Quote = {
    ...quote,
    id: quoteId,
    createdAt: Date.now()
  };
  
  // Calculate totals
  const calculatedQuote = calculateQuoteTotals(newQuote);
  
  // Save quote and update counter
  await set(ref(database, `quotes/${quoteId}`), calculatedQuote);
  await set(ref(database, 'counters/quoteId'), nextId);
  
  return calculatedQuote;
};

export const updateQuote = async (id: string, updates: Partial<Quote>): Promise<Quote> => {
  const quoteRef = ref(database, `quotes/${id}`);
  const snapshot = await get(quoteRef);
  
  if (!snapshot.exists()) {
    throw new Error(`Quote with ID ${id} not found`);
  }
  
  const currentQuote = snapshot.val() as Quote;
  const updatedQuote = { ...currentQuote, ...updates };
  
  // Recalculate totals
  const calculatedQuote = calculateQuoteTotals(updatedQuote);
  
  // Update quote
  await update(quoteRef, calculatedQuote);
  
  return calculatedQuote;
};

export const deleteQuote = async (id: string): Promise<void> => {
  await remove(ref(database, `quotes/${id}`));
};

// Helper function to calculate quote totals
export const calculateQuoteTotals = (quote: Quote): Quote => {
  // Calculate total for each item
  const items = quote.items.map(item => {
    // Sum up parts prices
    const partsTotal = item.parts.reduce((sum, part) => sum + part.finalPrice, 0);
    // Calculate labor cost: price per hour * hours
    const laborTotal = item.laborPrice * item.laborHours;
    // Total price for this item
    const itemTotal = partsTotal + laborTotal;
    
    return {
      ...item,
      totalPrice: itemTotal
    };
  });
  
  // Calculate quote subtotal from service items
  const itemsSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Calculate extra labor cost
  const extraLaborCost = (quote.laborPrice || 0) * (quote.laborHours || 0);
  
  // Calculate total subtotal (items + extra labor)
  const subtotal = itemsSubtotal + extraLaborCost;
  
  // Calculate tax amount
  const taxAmount = (subtotal * quote.taxRate) / 100;
  
  // Calculate total
  const total = subtotal + taxAmount;
  
  return {
    ...quote,
    items,
    subtotal,
    taxAmount,
    total
  };
};

// Initialize default service types
const initDefaultServiceTypes = async (): Promise<void> => {
  // Check if service types already exist
  const snapshot = await get(serviceTypesRef);
  if (snapshot.exists() && Object.keys(snapshot.val()).length > 0) {
    return; // Already initialized
  }
  
  // Default service types grouped by category
  const defaultServiceTypes = [
    // Tagliando
    { name: "Filtro Aria", category: "Tagliando" as const, description: "Sostituzione filtro aria", laborPrice: 15 },
    { name: "Filtro Olio", category: "Tagliando" as const, description: "Sostituzione filtro olio", laborPrice: 15 },
    { name: "Filtro Carburante", category: "Tagliando" as const, description: "Sostituzione filtro carburante", laborPrice: 20 },
    { name: "Filtro Abitacolo", category: "Tagliando" as const, description: "Sostituzione filtro abitacolo", laborPrice: 20 },
    { name: "Olio", category: "Tagliando" as const, description: "Cambio olio motore", laborPrice: 25 },
    { name: "Tagliando Completo", category: "Tagliando" as const, description: "Tagliando completo", laborPrice: 50 },
    
    // Frenante
    { name: "Pattini Anteriori", category: "Frenante" as const, description: "Sostituzione pattini freni anteriori", laborPrice: 40 },
    { name: "Pattini Posteriori", category: "Frenante" as const, description: "Sostituzione pattini freni posteriori", laborPrice: 40 },
    { name: "Dischi Anteriori", category: "Frenante" as const, description: "Sostituzione dischi freni anteriori", laborPrice: 40 },
    { name: "Dischi/Ganasce Posteriori", category: "Frenante" as const, description: "Sostituzione dischi o ganasce posteriori", laborPrice: 50 },
    { name: "Sistema Frenante Completo", category: "Frenante" as const, description: "Revisione completa sistema frenante", laborPrice: 120 },
    
    // Sospensioni
    { name: "Ammortizzatori Anteriori", category: "Sospensioni" as const, description: "Sostituzione ammortizzatori anteriori", laborPrice: 60 },
    { name: "Ammortizzatori Posteriori", category: "Sospensioni" as const, description: "Sostituzione ammortizzatori posteriori", laborPrice: 60 },
    { name: "Braccetti", category: "Sospensioni" as const, description: "Sostituzione braccetti sospensioni", laborPrice: 50 },
    { name: "Sospensioni Complete", category: "Sospensioni" as const, description: "Revisione completa sospensioni", laborPrice: 150 },
    
    // Accessori
    { name: "Spazzole", category: "Accessori" as const, description: "Sostituzione spazzole tergicristalli", laborPrice: 10 },
    { name: "Batteria", category: "Accessori" as const, description: "Sostituzione batteria", laborPrice: 15 },
    { name: "Additivi", category: "Accessori" as const, description: "Aggiunta additivi", laborPrice: 5 },
    { name: "Altro", category: "Accessori" as const, description: "Altri accessori", laborPrice: 15 }
  ];
  
  // Create each service type
  for (const serviceType of defaultServiceTypes) {
    await createServiceType(serviceType);
  }
};
