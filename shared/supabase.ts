import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Client, Appointment, Quote, ServiceType, QuoteItem, Request, WorkSession, ChecklistItem, CreateOrderedPartInput } from './schema';
import { v4 as uuidv4 } from 'uuid';

// Configurazione Supabase con fallback per le variabili d'ambiente
const supabaseUrl = typeof process !== 'undefined' 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://szibkvybiuyyyctktvzm.supabase.co'
  : 'https://szibkvybiuyyyctktvzm.supabase.co';

const supabaseAnonKey = typeof process !== 'undefined'
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aWJrdnliaXV5eXljdGt0dnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNjQxNTAsImV4cCI6MjA2Mzk0MDE1MH0.-7j3Dac6ZYkwVzkk4YDjJ-4knPLswe_cmk4pjgAPQHA'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aWJrdnliaXV5eXljdGt0dnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNjQxNTAsImV4cCI6MjA2Mzk0MDE1MH0.-7j3Dac6ZYkwVzkk4YDjJ-4knPLswe_cmk4pjgAPQHA';

// Service Role Key per operazioni admin (sostituisci con la tua chiave service_role)
const supabaseServiceKey = typeof process !== 'undefined'
  ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aWJrdnliaXV5eXljdGt0dnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM2NDE1MCwiZXhwIjoyMDYzOTQwMTUwfQ.Vl_PWlYsFYXIEllIJI49SxxMCyYXQQsmJO2sVCvtZUE'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aWJrdnliaXV5eXljdGt0dnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM2NDE1MCwiZXhwIjoyMDYzOTQwMTUwfQ.Vl_PWlYsFYXIEllIJI49SxxMCyYXQQsmJO2sVCvtZUE';

// Configurazione del client Supabase con impostazioni di sessione
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persiste la sessione nel localStorage
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Rileva automaticamente sessioni scadute
    detectSessionInUrl: true,
    // Abilita auto refresh dei token - SEMPRE ATTIVO
    autoRefreshToken: true,
    // Mantiene la sessione tra le pagine - SEMPRE ATTIVO
    persistSession: true,
    // Storage key univoco per il client normale
    storageKey: 'sb-auth-token',
    // Configurazione per sessioni persistenti
    flowType: 'pkce'
  }
});

// Client separato per operazioni Admin con service_role
export const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    // Non usa storage per evitare conflitti
    storage: undefined,
    // Storage key diverso per il client admin
    storageKey: 'sb-admin-auth-token'
  }
});

// Funzione per ottenere l'utente corrente
const getUser = (): { username: string; email?: string; clientId?: string } | null => {
  try {
    const userString = localStorage.getItem('current_user');
    if (userString) {
      return JSON.parse(userString);
    }
    return null;
  } catch (error) {
    // console.error('Errore nel recupero utente:', error);
    return null;
  }
};

// Helper function to check if current user is admin
async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return false;
    
    // Lista degli email admin riconosciuti
    const adminEmails = [
      'admin@officina.it',
      'autoexpressadservice@gmail.com',
      'admin@autoexpressadservice.it'
    ];
    
    // Check if user is admin based on user_metadata or email
    return user.user_metadata?.user_type === 'admin' || 
           adminEmails.includes(user.email || '');
  } catch {
    return false;
  }
}

// Funzione helper per ottenere il client_id dell'utente corrente
const getCurrentUserClientId = (): string | null => {
  const user = getUser();
  return user?.clientId || null;
};

// Funzione helper per ottenere l'user_uid dell'utente corrente
const getCurrentUserUid = async (): Promise<string | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
};

// Funzione per registrare modifiche al database con dettagli completi
export const registerDatabaseChange = async (
  actionType: string,
  entityType: string,
  entityId: string,
  details: any = {},
  oldData?: any
): Promise<void> => {
  try {
    const user = getUser();
    const timestamp = new Date().toISOString();
    const changeId = `${actionType}_${entityType}_${entityId}_${Date.now()}`;
    
    // Genera descrizione leggibile dell'azione
    const actionDescription = generateActionDescription(actionType, entityType, entityId, details);
    
    // Calcola le modifiche specifiche per aggiornamenti
    let changesSummary = null;
    if (actionType === 'update' && oldData) {
      changesSummary = calculateChanges(oldData, details, entityType);
    }
    
    // Informazioni utente dettagliate
    const userInfo = {
      username: user?.username || 'anonymous',
      email: user?.email || 'unknown',
      user_type: user?.username === 'admin' ? 'ADMIN' : 'USER',
      session_timestamp: timestamp,
      client_id: user?.clientId || null
    };
    
    // Informazioni tecniche dettagliate
    let realIpAddress = '127.0.0.1'; // Default fallback
    
    // Tenta di ottenere l'IP reale
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      realIpAddress = ipData.ip || '127.0.0.1';
    } catch (ipError) {
      console.warn('⚠️ Impossibile ottenere IP reale, uso localhost:', ipError);
    }
    
    const technicalInfo = {
      ip_address: realIpAddress,
      device_fingerprint: `${navigator.userAgent}_${screen.width}x${screen.height}`,
      browser_info: {
        vendor: navigator.vendor || 'Unknown',
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        userAgent: navigator.userAgent
      },
      platform: navigator.platform,
      screen_resolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp_local: new Date().toLocaleString(),
      timestamp_utc: timestamp,
      connection_info: {
        effective_type: (navigator as any).connection?.effectiveType || 'unknown',
        downlink: (navigator as any).connection?.downlink || 'unknown'
      }
    };
    
    // Metadati per ricerche e analisi
    const now = new Date();
    const metadata = {
      day_of_week: now.toLocaleDateString('it-IT', { weekday: 'long' }),
      hour_of_day: now.getHours(),
      is_weekend: now.getDay() === 0 || now.getDay() === 6,
      entity_display_name: getEntityDisplayName(entityType, entityId, details),
      action_severity: getActionSeverity(actionType, entityType),
      tags: generateTags(actionType, entityType, details)
    };
    
    // Record completo da inserire
    const changeRecord = {
      id: changeId,
      timestamp: timestamp,
      action_type: actionType.toUpperCase(),
      entity_type: entityType.toUpperCase(),
      entity_id: entityId,
      action_description: actionDescription,
      details: details,
      changes_summary: changesSummary,
      user_info: userInfo,
      technical_info: technicalInfo,
      metadata: metadata
    };

    const { error } = await supabase
      .from('db_changes')
      .insert([changeRecord]);

    if (error) {
      console.error('❌ Errore nel registrare la modifica:', error);
    } else {
      console.log('✅ Modifica registrata con successo:', changeId);
    }
  } catch (error) {
    console.error('❌ Errore nel sistema di logging:', error);
  }
};

// Funzioni di supporto per il logging dettagliato
function generateActionDescription(actionType: string, entityType: string, entityId: string, details: any): string {
  const entityName = getEntityDisplayName(entityType, entityId, details);
  
  switch (actionType.toLowerCase()) {
    case 'create':
      return `Creato nuovo ${entityType.toLowerCase()}: ${entityName}`;
    case 'update':
      return `Aggiornato ${entityType.toLowerCase()}: ${entityName}`;
    case 'delete':
      return `Eliminato ${entityType.toLowerCase()}: ${entityName}`;
    default:
      return `${actionType} ${entityType} ${entityName}`;
  }
}

function getEntityDisplayName(entityType: string, entityId: string, details: any): string {
  switch (entityType.toLowerCase()) {
    case 'client':
      if (details.name && details.surname) {
        return `${details.name} ${details.surname}`.trim();
      }
      return `Cliente ${entityId}`;
    case 'quote':
      if (details.clientName) {
        return `Preventivo per ${details.clientName}`;
      }
      return `Preventivo ${entityId}`;
    case 'appointment':
      if (details.clientName) {
        return `Appuntamento con ${details.clientName}`;
      }
      return `Appuntamento ${entityId}`;
    default:
      return `${entityType} ${entityId}`;
  }
}

function getActionSeverity(actionType: string, entityType: string): string {
  switch (actionType.toLowerCase()) {
    case 'delete':
      return 'HIGH';
    case 'create':
      return entityType === 'client' ? 'MEDIUM' : 'LOW';
    case 'update':
      return 'INFO';
    default:
      return 'INFO';
  }
}

function generateTags(actionType: string, entityType: string, details: any): string[] {
  const tags = [actionType.toLowerCase(), entityType.toLowerCase()];
  
  if (details.changes) {
    tags.push('field-changes');
  }
  
  if (entityType === 'client' && (details.email || details.phone)) {
    tags.push('contact-info');
  }
  
  if (entityType === 'quote' && details.amount) {
    tags.push('financial');
  }
  
  return tags;
}

function calculateChanges(oldData: any, newData: any, entityType: string): any {
  const changes: any = {
    summary: '',
    field_changes: {}
  };
  
  const changedFields: string[] = [];
  
  // Confronta i campi
  Object.keys(newData).forEach(key => {
    if (key !== 'updated_at' && oldData[key] !== newData[key]) {
      changes.field_changes[key] = {
        old_value: oldData[key],
        new_value: newData[key]
      };
      changedFields.push(key);
    }
  });
  
  // Genera riassunto
  if (changedFields.length > 0) {
    changes.summary = `Modificati ${changedFields.length} campi: ${changedFields.join(', ')}`;
  } else {
    changes.summary = 'Nessuna modifica rilevata';
  }
  
  return changes;
}

// ===== CLIENT FUNCTIONS =====

// Funzione helper per mappare i dati del cliente dal database al formato frontend
const mapClientFromDB = (data: any): Client => {
  // Ricostruisci l'array vehicles dalle colonne multiple del database
  const vehicles = [];
  for (let i = 1; i <= 5; i++) {
    const plateField = `plate${i}`;
    const vinField = `vin${i}`;
    const photosField = `registration_photos${i}`;
    if (data[plateField] || data[vinField]) {
      let registrationPhotos = [];
      try {
        // Tenta di parsificare le foto del libretto dal JSON
        if (data[photosField]) {
          registrationPhotos = JSON.parse(data[photosField]);
        }
      } catch (error) {
        console.warn(`Errore nel parsing delle foto del libretto per il veicolo ${i}:`, error);
        registrationPhotos = [];
      }
      
      vehicles.push({
        id: `V${i}_${data.id}`,
        plate: data[plateField] || '',
        vin: data[vinField] || '',
        registrationPhotos: registrationPhotos
      });
    }
  }
  
  // Mappa i campi del database ai campi del frontend
  return {
    ...data,
    birthDate: data.birth_date, // Mappa birth_date a birthDate per il frontend
    model: data.model, // Campo model già presente
    vehicles: vehicles, // Aggiungi i veicoli dalle colonne multiple
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
  };
};

export const getAllClients = async (): Promise<Client[]> => {
  // 🔒 SICUREZZA: Solo gli admin possono visualizzare tutti i clienti
  if (!isCurrentUserAdmin()) {
    throw new Error('Accesso non autorizzato: solo gli amministratori possono visualizzare tutti i clienti');
  }
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(mapClientFromDB);
};

// Funzione per sincronizzare i dati del cliente con tutti i suoi appuntamenti
const syncClientDataWithAppointments = async (clientId: string, clientData: Partial<Client>): Promise<number> => {
  try {
    console.log('🔄 Sincronizzazione dati cliente con appuntamenti...');
    
    // Ottieni tutti gli appuntamenti del cliente
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, client_name, phone, plate, model')
      .eq('client_id', clientId);
    
    if (error) throw error;
    
    if (!appointments || appointments.length === 0) {
      console.log('ℹ️ Nessun appuntamento trovato per il cliente', clientId);
      return 0;
    }
    
    // Prepara i dati di aggiornamento per gli appuntamenti
    const appointmentUpdates: any = {};
    let hasUpdates = false;
    
    if (clientData.name !== undefined || clientData.surname !== undefined) {
      // Ricostruisci il nome completo se abbiamo nome o cognome
      const fullName = `${clientData.name || ''} ${clientData.surname || ''}`.trim();
      if (fullName) {
        appointmentUpdates.client_name = fullName;
        hasUpdates = true;
      }
    }
    
    if (clientData.phone !== undefined) {
      appointmentUpdates.phone = clientData.phone;
      hasUpdates = true;
    }
    
    // Gestione veicoli per compatibilità
    if (clientData.vehicles && clientData.vehicles.length > 0) {
      const primaryVehicle = clientData.vehicles[0];
      if (primaryVehicle.plate !== undefined) {
        appointmentUpdates.plate = primaryVehicle.plate;
        hasUpdates = true;
      }
      // Note: il model non è più salvato nei veicoli, ma manteniamo il campo per compatibilità
      appointmentUpdates.model = ''; // Svuota il campo legacy
      hasUpdates = true;
    } else if (clientData.plate !== undefined) {
      // Fallback per compatibilità con interfaccia legacy
      appointmentUpdates.plate = clientData.plate;
      hasUpdates = true;
    }
    
    if (clientData.model !== undefined) {
      appointmentUpdates.model = clientData.model;
      hasUpdates = true;
    }
    
    if (!hasUpdates) {
      console.log('ℹ️ Nessun aggiornamento necessario per gli appuntamenti');
      return 0;
    }
    
    // Aggiungi timestamp di aggiornamento
    appointmentUpdates.updated_at = new Date().toISOString();
    
    // Aggiorna tutti gli appuntamenti del cliente in batch
    const { error: updateError } = await supabase
      .from('appointments')
      .update(appointmentUpdates)
      .eq('client_id', clientId);
    
    if (updateError) throw updateError;
    
    console.log(`✅ Sincronizzati ${appointments.length} appuntamenti per il cliente ${clientId}`);
    
    // Registra la sincronizzazione nel log
    await registerDatabaseChange(
      'sync',
      'appointments',
      `client_${clientId}`,
      {
        appointments_updated: appointments.length,
        sync_fields: Object.keys(appointmentUpdates),
        client_data: appointmentUpdates
      }
    );
    
    return appointments.length;
    
  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione appuntamenti:', error);
    throw error;
  }
};

export const getClientById = async (id: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  // 🔒 SICUREZZA: Controlla se l'utente ha accesso a questi dati cliente
  if (!isCurrentUserAdmin()) {
    const clientId = getCurrentUserClientId();
    if (!clientId || id !== clientId) {
      throw new Error('Accesso non autorizzato: non puoi visualizzare dati di altri clienti');
    }
  }

  return mapClientFromDB(data);
};

export const getClientByPhone = async (phone: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', phone)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return mapClientFromDB(data);
};

// Funzione helper per verificare se un utente esiste già in Supabase Auth
const checkIfUserExistsInAuth = async (email: string): Promise<boolean> => {
  try {
    console.log('🔍 Controllo esistenza utente in Auth:', email);
    
    // Metodo semplice: prova a inviare un reset password
    // Se l'utente esiste, non darà errore; se non esiste, darà errore specifico
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://example.com/fake-redirect' // URL fake, non importa
    });
    
    if (!error) {
      console.log('✅ Utente trovato in Auth (reset password riuscito):', email);
      return true;
    }
    
    // Se l'errore è "User not found", allora l'utente non esiste
    if (error.message.includes('User not found') || error.message.includes('not found')) {
      console.log('👤 Utente NON trovato in Auth:', email);
      return false;
    }
    
    // Per altri errori, assumiamo che l'utente non esista
    console.log('⚠️ Errore nel controllo esistenza, assumo utente non esistente:', error.message);
    return false;
    
  } catch (error) {
    console.error('❌ Errore nel controllo esistenza utente:', error);
    // In caso di errore, assumiamo che l'utente non esista per permettere la registrazione
    return false;
  }
};

export const createClient = async (client: Omit<Client, 'id'>): Promise<Client> => {
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'clientId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const clientId = `CL${nextId.toString().padStart(3, '0')}`;
  
  // Prepara i dati del cliente per il database con colonne multiple
  const clientData: any = {
    id: clientId,
    name: client.name,
    surname: client.surname,
    phone: client.phone,
    email: client.email,
    password: client.password,
    model: '', // Campo legacy vuoto per compatibilità
    // Campi fiscali italiani
    tipo_cliente: client.tipo_cliente || 'privato',
    cf: client.cf || null,
    piva: client.piva || null,
    sdi: client.sdi || null,
    pec: client.pec || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Gestione delle colonne multiple per veicoli (plate1-plate5, vin1-vin5)
  if (client.vehicles && client.vehicles.length > 0) {
    // Popola le colonne multiple con i veicoli dal form
    client.vehicles.forEach((vehicle, index) => {
      if (index < 5) { // Massimo 5 veicoli
        const plateCol = `plate${index + 1}`;
        const vinCol = `vin${index + 1}`;
        const photosCol = `registration_photos${index + 1}`;
        clientData[plateCol] = vehicle.plate || '';
        clientData[vinCol] = vehicle.vin || '';
        // Salva le foto del libretto come JSON
        clientData[photosCol] = JSON.stringify(vehicle.registrationPhotos || []);
      }
    });
    
    // Mantieni compatibilità con campi legacy (primo veicolo)
    clientData.plate = client.vehicles[0].plate || '';
    clientData.vin = client.vehicles[0].vin || '';
  } else {
    // Usa i campi legacy se non ci sono veicoli nell'array
    clientData.plate = client.plate || '';
    clientData.vin = client.vin || '';
    // Se c'è un veicolo legacy, mettilo anche in plate1/vin1
    if (client.plate || client.vin) {
      clientData.plate1 = client.plate || '';
      clientData.vin1 = client.vin || '';
      clientData.registration_photos1 = JSON.stringify([]);
    }
  }
  
  // Gestione speciale per birth_date: converte stringhe vuote in null
  if (client.birthDate !== undefined) {
    if (client.birthDate === "" || client.birthDate === null) {
      clientData.birth_date = null;
    } else {
      // Converte la data dal formato del form al formato ISO per PostgreSQL
      const dateValue = client.birthDate;
      
      // Se è già in formato ISO (YYYY-MM-DD), usala così com'è
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        clientData.birth_date = dateValue;
      } 
      // Se è in formato italiano (DD/MM/YYYY), convertila
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        clientData.birth_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      // Altrimenti prova a parsarla come data
      else {
        try {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            clientData.birth_date = parsedDate.toISOString().split('T')[0];
          } else {
            clientData.birth_date = null;
          }
        } catch (error) {
          clientData.birth_date = null;
        }
      }
    }
  }
  
  const { data, error } = await supabase
    .from('clients')
    .insert([clientData])
    .select()
    .single();
  
  if (error) throw error;
  
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'clientId');

  // 🔑 REGISTRA IL CLIENTE ANCHE IN SUPABASE AUTH PER PERMETTERE IL LOGIN
  if (client.email && client.password) {
    try {
      console.log('🔐 Inizio registrazione in Supabase Auth per:', client.email);
      
      // Usa il client admin per registrare l'utente senza richiedere conferma email
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: client.email,
        password: client.password,
        email_confirm: true, // Conferma automaticamente l'email
        user_metadata: {
          client_id: clientId,
          client_name: `${client.name} ${client.surname}`,
          user_type: 'client',
          phone: client.phone,
          plate: clientData.plate
        }
      });
      
      if (authError) {
        // Se l'errore è "User already registered", non è un problema
        if (authError.message.includes('already registered') || 
            authError.message.includes('already exists') ||
            authError.message.includes('already been registered')) {
          console.log('ℹ️ Utente già registrato in Supabase Auth:', client.email);
        } else {
          console.error('❌ Errore nella registrazione auth per il cliente:', {
            email: client.email,
            clientId: clientId,
            error: authError.message,
            code: authError.status
          });
          
          // Log specifico per errori comuni
          if (authError.message.includes('password')) {
            console.log('ℹ️ Problema con la password (troppo debole, etc.)');
          } else if (authError.message.includes('email')) {
            console.log('ℹ️ Problema con l\'email (formato invalido, etc.)');
          }
        }
        
        // Non bloccare la creazione se l'auth fallisce 
        // Il cliente è già stato creato nel database
      } else {
        console.log('✅ Cliente registrato con successo in Supabase Auth:', {
          clientId: clientId,
          email: client.email,
          authUserId: authData?.user?.id,
          confirmed: authData?.user?.email_confirmed_at ? 'SI' : 'NO'
        });
        // Aggiorna il campo user_uid nel record del cliente
        if (authData?.user?.id) {
          await supabase
            .from('clients')
            .update({ user_uid: authData.user.id })
            .eq('id', clientId);
        }
        // Verifica che i metadati siano stati salvati correttamente
        if (authData?.user?.user_metadata) {
          console.log('📋 Metadati utente salvati:', authData.user.user_metadata);
        } else {
          console.warn('⚠️ Metadati utente non trovati dopo la registrazione');
        }
      }
    } catch (authError) {
      console.error('❌ Errore generale nella registrazione auth per il cliente:', {
        email: client.email,
        clientId: clientId,
        error: authError instanceof Error ? authError.message : authError
      });
      // Non bloccare la creazione se l'auth fallisce
    }
  } else {
    console.log('⚠️ Cliente senza email o password - registrazione Auth saltata:', {
      clientId: clientId,
      hasEmail: !!client.email,
      hasPassword: !!client.password
    });
  }
  
  // Registra la creazione (non bloccante)
  try {
    await registerDatabaseChange(
      'create',
      'client',
      clientId,
      {
        name: clientData.name,
        surname: clientData.surname,
        phone: clientData.phone,
        email: clientData.email,
        plate: clientData.plate,
        vin: clientData.vin,
        model: clientData.model,
        vehicleCount: client.vehicles ? client.vehicles.length : (client.plate || client.vin ? 1 : 0),
        birthDate: client.birthDate,
        password_generated: !!clientData.password,
        client_full_name: `${clientData.name} ${clientData.surname}`.trim()
      }
    );
  } catch (loggingError) {
    console.warn('⚠️ Errore nel logging creazione cliente (non bloccante):', loggingError);
  }
  
  // Ricostruisci l'array vehicles dai campi del database per la risposta
  const vehicles = [];
  for (let i = 1; i <= 5; i++) {
    const plateField = `plate${i}`;
    const vinField = `vin${i}`;
    const photosField = `registration_photos${i}`;
    if (data[plateField] || data[vinField]) {
      let registrationPhotos = [];
      try {
        // Tenta di parsificare le foto del libretto dal JSON
        if (data[photosField]) {
          registrationPhotos = JSON.parse(data[photosField]);
        }
      } catch (error) {
        console.warn(`Errore nel parsing delle foto del libretto per il veicolo ${i}:`, error);
        registrationPhotos = [];
      }
      
      vehicles.push({
        id: `V${i}_${clientId}`,
        plate: data[plateField] || '',
        vin: data[vinField] || '',
        registrationPhotos: registrationPhotos
      });
    }
  }
  
  return {
    ...data,
    birthDate: data.birth_date,
    vehicles: vehicles,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
  };
};

export const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
  // Ottieni i dati del cliente prima dell'aggiornamento per il logging dettagliato
  const clientBefore = await getClientById(id);
  
  console.log('🔄 AGGIORNAMENTO CLIENTE:', { id, updates });
  
  // Mappa i campi dal form ai campi del database
  const dbUpdates: any = {};
  
  // Campi che esistono nel database
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.surname !== undefined) dbUpdates.surname = updates.surname;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.password !== undefined) dbUpdates.password = updates.password;
  
  // Campi fiscali italiani
  if (updates.tipo_cliente !== undefined) dbUpdates.tipo_cliente = updates.tipo_cliente || 'privato';
  if (updates.cf !== undefined) dbUpdates.cf = updates.cf || null;
  if (updates.piva !== undefined) dbUpdates.piva = updates.piva || null;
  if (updates.sdi !== undefined) dbUpdates.sdi = updates.sdi || null;
  if (updates.pec !== undefined) dbUpdates.pec = updates.pec || null;
  
  // Gestione delle colonne multiple per veicoli
  if (updates.vehicles !== undefined) {
    // Reset di tutte le colonne veicoli
    for (let i = 1; i <= 5; i++) {
      dbUpdates[`plate${i}`] = null;
      dbUpdates[`vin${i}`] = null;
      dbUpdates[`registration_photos${i}`] = null;
    }
    
    // Popola con i nuovi veicoli
    updates.vehicles.forEach((vehicle, index) => {
      if (index < 5) { // Massimo 5 veicoli
        const plateCol = `plate${index + 1}`;
        const vinCol = `vin${index + 1}`;
        const photosCol = `registration_photos${index + 1}`;
        dbUpdates[plateCol] = vehicle.plate || '';
        dbUpdates[vinCol] = vehicle.vin || '';
        // Salva le foto del libretto come JSON
        dbUpdates[photosCol] = JSON.stringify(vehicle.registrationPhotos || []);
      }
    });
    
    // Mantieni compatibilità con campi legacy (primo veicolo)
    if (updates.vehicles.length > 0) {
      dbUpdates.plate = updates.vehicles[0].plate || '';
      dbUpdates.vin = updates.vehicles[0].vin || '';
    } else {
      dbUpdates.plate = '';
      dbUpdates.vin = '';
    }
    
    dbUpdates.model = ''; // Campo legacy vuoto per compatibilità
  } else {
    // Aggiorna i campi legacy se non ci sono veicoli nell'array
    if (updates.plate !== undefined) {
      dbUpdates.plate = updates.plate;
      dbUpdates.plate1 = updates.plate; // Sincronizza con plate1
    }
    if (updates.vin !== undefined) {
      dbUpdates.vin = updates.vin;
      dbUpdates.vin1 = updates.vin; // Sincronizza con vin1
    }
    if (updates.model !== undefined) dbUpdates.model = updates.model;
  }
  
  // Gestione speciale per birth_date
  if (updates.birthDate !== undefined) {
    if (updates.birthDate === "" || updates.birthDate === null) {
      dbUpdates.birth_date = null;
    } else {
      const dateValue = updates.birthDate;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        dbUpdates.birth_date = dateValue;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        dbUpdates.birth_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        try {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            dbUpdates.birth_date = parsedDate.toISOString().split('T')[0];
          } else {
            dbUpdates.birth_date = null;
          }
        } catch (error) {
          dbUpdates.birth_date = null;
        }
      }
    }
  }
  
  // Sempre impostare updated_at
  dbUpdates.updated_at = new Date().toISOString();
  
  console.log('📝 DB Updates preparati:', dbUpdates);
  
  const { data, error } = await supabase
    .from('clients')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Errore database nell\'aggiornamento cliente:', error);
    throw error;
  }
  
  console.log('✅ Cliente aggiornato con successo:', data);
  
  // Registra l'aggiornamento (non bloccante)
  try {
    // Calcola i cambiamenti specifici
    const changes: any = {};
    
    if (clientBefore) {
      if (updates.name && updates.name !== clientBefore.name) changes.name = { from: clientBefore.name, to: updates.name };
      if (updates.surname && updates.surname !== clientBefore.surname) changes.surname = { from: clientBefore.surname, to: updates.surname };
      if (updates.phone && updates.phone !== clientBefore.phone) changes.phone = { from: clientBefore.phone, to: updates.phone };
      if (updates.email && updates.email !== clientBefore.email) changes.email = { from: clientBefore.email, to: updates.email };
      if (updates.birthDate !== undefined && updates.birthDate !== clientBefore.birthDate) {
        changes.birthDate = { from: clientBefore.birthDate, to: updates.birthDate };
      }
      if (updates.vehicles) {
        changes.vehicleCount = { 
          from: clientBefore.vehicles ? clientBefore.vehicles.length : 0, 
          to: updates.vehicles.length 
        };
      }
    }
    
    await registerDatabaseChange(
      'update',
      'client',
      id,
      {
        changes,
        client_full_name: `${dbUpdates.name || data.name} ${dbUpdates.surname || data.surname}`.trim()
      },
      clientBefore
    );
  } catch (loggingError) {
    console.warn('⚠️ Errore nel logging aggiornamento cliente (non bloccante):', loggingError);
  }
  
  // Ricostruisci l'array vehicles dai campi del database per la risposta
  const vehicles = [];
  for (let i = 1; i <= 5; i++) {
    const plateField = `plate${i}`;
    const vinField = `vin${i}`;
    const photosField = `registration_photos${i}`;
    if (data[plateField] || data[vinField]) {
      let registrationPhotos = [];
      try {
        // Tenta di parsificare le foto del libretto dal JSON
        if (data[photosField]) {
          registrationPhotos = JSON.parse(data[photosField]);
        }
      } catch (error) {
        console.warn(`Errore nel parsing delle foto del libretto per il veicolo ${i}:`, error);
        registrationPhotos = [];
      }
      
      vehicles.push({
        id: `V${i}_${id}`,
        plate: data[plateField] || '',
        vin: data[vinField] || '',
        registrationPhotos: registrationPhotos
      });
    }
  }
  
  // Mappa i campi del database ai campi del frontend prima di restituire
  const clientUpdated = {
    ...data,
    birthDate: data.birth_date,
    vehicles: vehicles,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
  };

  // 🔄 SINCRONIZZAZIONE AUTOMATICA: Aggiorna tutti gli appuntamenti del cliente con i nuovi dati
  try {
    console.log('🔄 Avvio sincronizzazione automatica appuntamenti...');
    const syncedCount = await syncClientDataWithAppointments(id, updates);
    
    if (syncedCount > 0) {
      console.log(`✅ Sincronizzazione completata: ${syncedCount} appuntamenti aggiornati automaticamente`);
    } else {
      console.log('ℹ️ Nessun appuntamento da sincronizzare per questo cliente');
    }
    
  } catch (syncError) {
    console.error('❌ Errore durante la sincronizzazione automatica degli appuntamenti:', syncError);
    // Non blocchiamo l'aggiornamento del cliente se la sincronizzazione fallisce
    // Loggiamo solo l'errore
    try {
      await registerDatabaseChange(
        'error',
        'appointment_sync',
        id,
        {
          error_message: syncError instanceof Error ? syncError.message : 'Errore sconosciuto',
          client_update_successful: true,
          sync_failed: true
        }
      );
    } catch (logError) {
      console.warn('⚠️ Errore anche nel logging dell\'errore di sincronizzazione:', logError);
    }
  }

  return clientUpdated;
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    // 1. Prima ottieni i dati del cliente per il logging
    const client = await getClientById(id);
    
    // 2. Trova tutti i preventivi associati al cliente
    const clientQuotes = await getQuotesByClientId(id);
    // console.log(`Cliente ${id}: trovati ${clientQuotes.length} preventivi da gestire`);
    
    // 3. Trova tutti gli appuntamenti associati al cliente
    const allAppointments = await getAllAppointments();
    const clientAppointments = allAppointments.filter(app => app.clientId === id);
    // console.log(`Cliente ${id}: trovati ${clientAppointments.length} appuntamenti da gestire`);
    
    // 4. Elimina prima tutti gli appuntamenti del cliente
    for (const appointment of clientAppointments) {
      // console.log(`Eliminazione appuntamento ${appointment.id} del cliente ${id}`);
      await deleteAppointment(appointment.id);
    }
    
    // 5. Elimina tutti i preventivi del cliente
    for (const quote of clientQuotes) {
      // console.log(`Eliminazione preventivo ${quote.id} del cliente ${id}`);
      await deleteQuote(quote.id);
    }
    
    // 6. ELIMINA IL CLIENTE ANCHE DA SUPABASE AUTH SE ESISTE
    if (client?.email) {
      try {
        console.log('🗑️ Eliminazione cliente da Supabase Auth:', client.email);
        
        // Cerca l'utente in Auth per email
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!listError && usersData) {
          const authUser = usersData.users.find(user => user.email === client.email);
          
          if (authUser) {
            const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
            
            if (deleteAuthError) {
              console.warn('⚠️ Errore nell\'eliminazione da Supabase Auth:', deleteAuthError.message);
            } else {
              console.log('✅ Cliente eliminato con successo da Supabase Auth:', client.email);
            }
          } else {
            console.log('ℹ️ Cliente non trovato in Supabase Auth (probabilmente mai registrato):', client.email);
          }
        } else {
          console.warn('⚠️ Errore nel recupero utenti Auth per eliminazione:', listError?.message);
        }
      } catch (authError) {
        console.warn('⚠️ Errore durante l\'eliminazione da Supabase Auth:', authError);
        // Non bloccare l'eliminazione se l'auth fallisce
      }
    }
    
    // 7. Elimina il cliente dal database
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // 8. Registra l'eliminazione nel database
    if (client) {
      await registerDatabaseChange(
        'delete',
        'client',
        id,
        {
          client_name: `${client.name} ${client.surname}`,
          phone: client.phone,
          plate: client.plate,
          email: client.email,
          deleted_quotes: clientQuotes.length,
          deleted_appointments: clientAppointments.length,
          deleted_from_auth: !!client.email
        }
      );
    }
    
    console.log(`✅ Cliente ${id} eliminato completamente: ${clientQuotes.length} preventivi, ${clientAppointments.length} appuntamenti, Auth: ${client?.email ? 'SI' : 'NO'}`);
    
  } catch (error) {
    console.error(`❌ Errore nell'eliminazione del cliente ${id}:`, error);
    throw error;
  }
};

// ===== QUOTE FUNCTIONS =====

export const getAllQuotes = async (): Promise<Quote[]> => {
  // 🔒 SICUREZZA: Controlla se l'utente è admin
  if (!isCurrentUserAdmin()) {
    const clientId = getCurrentUserClientId();
    if (clientId) {
      // Se è un cliente, restituisce solo i propri preventivi
      return await getQuotesByClientId(clientId);
    } else {
      // Se non è admin e non ha clientId, blocca l'accesso
      throw new Error('Accesso non autorizzato: solo gli amministratori possono visualizzare tutti i preventivi');
    }
  }
  
  // Se è admin, restituisce tutti i preventivi
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(quote => ({
    id: quote.id,
    clientId: quote.client_id,
    clientName: quote.client_name,
    phone: quote.phone,
    plate: quote.plate,
    kilometrage: quote.kilometrage,
    date: quote.date,
    status: quote.status,
    laborPrice: quote.labor_price,
    laborHours: quote.labor_hours,
    subtotal: quote.subtotal,
    taxAmount: quote.tax_amount,
    taxRate: quote.tax_rate,
    total: quote.total,
    totalPrice: quote.total_price,
    notes: quote.notes,
    partsOrdered: quote.parts_ordered,
    items: typeof quote.items === 'string' ? JSON.parse(quote.items) : quote.items || [],
    parts: typeof quote.parts === 'string' ? JSON.parse(quote.parts) : quote.parts || [],
    createdAt: quote.created_at ? new Date(quote.created_at).getTime() : Date.now(),
    updatedAt: quote.updated_at ? new Date(quote.updated_at).getTime() : undefined, // AGGIUNTO: mapping per updatedAt
    // Aggiungo il mapping per parts_subtotal
    ...(quote.parts_subtotal !== undefined && { parts_subtotal: quote.parts_subtotal })
  } as Quote & { parts_subtotal?: number }));
};

export const getQuoteById = async (id: string): Promise<Quote | null> => {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  // 🔒 SICUREZZA: Controlla se l'utente ha accesso a questo preventivo
  if (!isCurrentUserAdmin()) {
    const clientId = getCurrentUserClientId();
    if (!clientId || data.client_id !== clientId) {
      throw new Error('Accesso non autorizzato: non puoi visualizzare preventivi di altri clienti');
    }
  }
  
  return {
    id: data.id,
    clientId: data.client_id,
    clientName: data.client_name,
    phone: data.phone,
    plate: data.plate,
    kilometrage: data.kilometrage,
    date: data.date,
    status: data.status,
    laborPrice: data.labor_price,
    laborHours: data.labor_hours,
    subtotal: data.subtotal,
    taxAmount: data.tax_amount,
    taxRate: data.tax_rate,
    total: data.total,
    totalPrice: data.total_price,
    notes: data.notes,
    partsOrdered: data.parts_ordered,
    items: typeof data.items === 'string' ? JSON.parse(data.items) : data.items || [],
    parts: typeof data.parts === 'string' ? JSON.parse(data.parts) : data.parts || [],
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined, // AGGIUNTO: mapping per updatedAt
    // Aggiungo il mapping per parts_subtotal
    ...(data.parts_subtotal !== undefined && { parts_subtotal: data.parts_subtotal })
  } as Quote & { parts_subtotal?: number };
};

export const getQuotesByClientId = async (clientId: string): Promise<Quote[]> => {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(quote => ({
    id: quote.id,
    clientId: quote.client_id,
    clientName: quote.client_name,
    phone: quote.phone,
    plate: quote.plate,
    kilometrage: quote.kilometrage,
    date: quote.date,
    status: quote.status,
    laborPrice: quote.labor_price,
    laborHours: quote.labor_hours,
    subtotal: quote.subtotal,
    taxAmount: quote.tax_amount,
    taxRate: quote.tax_rate,
    total: quote.total,
    totalPrice: quote.total_price,
    notes: quote.notes,
    partsOrdered: quote.parts_ordered,
    items: typeof quote.items === 'string' ? JSON.parse(quote.items) : quote.items || [],
    parts: typeof quote.parts === 'string' ? JSON.parse(quote.parts) : quote.parts || [],
    createdAt: quote.created_at ? new Date(quote.created_at).getTime() : Date.now(),
    updatedAt: quote.updated_at ? new Date(quote.updated_at).getTime() : undefined, // AGGIUNTO: mapping per updatedAt
    // Aggiungo il mapping per parts_subtotal
    ...(quote.parts_subtotal !== undefined && { parts_subtotal: quote.parts_subtotal })
  } as Quote & { parts_subtotal?: number }));
};

export const createQuote = async (quote: Omit<Quote, 'id'>): Promise<Quote> => {
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'quoteId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const quoteId = `PR${nextId.toString().padStart(3, '0')}`;
  
  const newQuote: Quote = {
    ...quote,
    id: quoteId,
  };
  
  const calculatedQuote = calculateQuoteTotals(newQuote);
  
  // Mappa i campi camelCase ai campi snake_case del database
  const quoteForDb = {
    id: calculatedQuote.id,
    client_id: calculatedQuote.clientId,
    client_name: calculatedQuote.clientName,
    phone: calculatedQuote.phone,
    plate: calculatedQuote.plate,
    kilometrage: calculatedQuote.kilometrage,
    date: calculatedQuote.date,
    status: calculatedQuote.status,
    labor_price: calculatedQuote.laborPrice,
    labor_hours: calculatedQuote.laborHours,
    items: JSON.stringify(calculatedQuote.items || []),
    parts: JSON.stringify(calculatedQuote.parts || []),
    subtotal: calculatedQuote.subtotal,
    tax_amount: calculatedQuote.taxAmount,
    tax_rate: calculatedQuote.taxRate,
    total: calculatedQuote.total,
    total_price: calculatedQuote.totalPrice,
    parts_subtotal: (calculatedQuote as any).partsSubtotal || 0,
    labor_total: (calculatedQuote as any).laborTotal || 0,
    notes: calculatedQuote.notes,
    parts_ordered: calculatedQuote.partsOrdered || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('quotes')
    .insert([quoteForDb])
    .select()
    .single();
  
  if (error) throw error;
  
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'quoteId');
  
  await registerDatabaseChange(
    'create',
    'quote',
    quoteId,
    {
      client_name: calculatedQuote.clientName,
      client_id: calculatedQuote.clientId,
      total_price: calculatedQuote.totalPrice || calculatedQuote.total,
      status: calculatedQuote.status,
      labor_hours: calculatedQuote.laborHours,
      labor_price: calculatedQuote.laborPrice,
      items_count: (calculatedQuote.items || []).length,
      parts_count: (calculatedQuote.parts || []).length,
      plate: calculatedQuote.plate,
      kilometrage: calculatedQuote.kilometrage
    }
  );
  
  // Ritorna i dati con il mapping corretto per il frontend
  return {
    ...calculatedQuote,
    items: calculatedQuote.items,
    parts: calculatedQuote.parts
  };
};

export const updateQuote = async (id: string, updates: Partial<Quote>): Promise<Quote> => {
  // Prima verifica che il preventivo esista
  console.log(`🔍 Verifica esistenza preventivo ID: ${id}`);
  
  const existingQuote = await getQuoteById(id);
  if (!existingQuote) {
    console.error(`❌ Preventivo con ID ${id} non trovato nel database`);
    throw new Error(`Preventivo con ID ${id} non trovato. Il preventivo potrebbe essere stato eliminato.`);
  }
  
  console.log(`✅ Preventivo ${id} trovato, procedo con l'aggiornamento`);
  console.log(`📊 Dati da aggiornare:`, updates);
  
  // Mappa i campi camelCase ai campi snake_case del database
  const updatesForDb: any = {};
  
  if (updates.clientId !== undefined) updatesForDb.client_id = updates.clientId;
  if (updates.clientName !== undefined) updatesForDb.client_name = updates.clientName;
  if (updates.phone !== undefined) updatesForDb.phone = updates.phone;
  if (updates.plate !== undefined) updatesForDb.plate = updates.plate;
  if (updates.kilometrage !== undefined) updatesForDb.kilometrage = updates.kilometrage;
  if (updates.date !== undefined) updatesForDb.date = updates.date;
  if (updates.status !== undefined) updatesForDb.status = updates.status;
  if (updates.laborPrice !== undefined) updatesForDb.labor_price = updates.laborPrice;
  if (updates.laborHours !== undefined) updatesForDb.labor_hours = updates.laborHours;
  if (updates.subtotal !== undefined) updatesForDb.subtotal = updates.subtotal;
  if (updates.taxAmount !== undefined) updatesForDb.tax_amount = updates.taxAmount;
  if (updates.taxRate !== undefined) updatesForDb.tax_rate = updates.taxRate;
  if (updates.total !== undefined) updatesForDb.total = updates.total;
  if (updates.totalPrice !== undefined) updatesForDb.total_price = updates.totalPrice;
  if (updates.notes !== undefined) updatesForDb.notes = updates.notes;
  if (updates.partsOrdered !== undefined) updatesForDb.parts_ordered = updates.partsOrdered;
  
  // Gestisci campi opzionali
  if ((updates as any).partsSubtotal !== undefined) updatesForDb.parts_subtotal = (updates as any).partsSubtotal;
  if ((updates as any).laborTotal !== undefined) updatesForDb.labor_total = (updates as any).laborTotal;
  
  if (updates.items) {
    updatesForDb.items = JSON.stringify(updates.items);
  }
  if (updates.parts) {
    updatesForDb.parts = JSON.stringify(updates.parts);
  }
  
  console.log(`💾 Dati mappati per il database:`, updatesForDb);
  
  const { data, error } = await supabase
    .from('quotes')
    .update({
      ...updatesForDb,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error(`❌ Errore durante l'aggiornamento del preventivo ${id}:`, error);
    
    if (error.code === 'PGRST116') {
      // Prova una seconda volta a verificare se il record esiste
      const doubleCheck = await getQuoteById(id);
      if (!doubleCheck) {
        throw new Error(`❌ ERRORE: Il preventivo ${id} non esiste più nel database. Potrebbe essere stato eliminato da un altro utente. Ricarica la pagina per aggiornare la lista.`);
      } else {
        throw new Error(`❌ ERRORE: Il preventivo ${id} esiste ma non può essere aggiornato. Verifica i permessi o prova a ricaricare la pagina.`);
      }
    }
    
    throw error;
  }
  
  console.log(`✅ Preventivo ${id} aggiornato con successo`);
  
  await registerDatabaseChange(
    'update',
    'quote',
    id,
    {
      changes: Object.keys(updates).join(', ')
    }
  );
  
  // Mappa i dati di ritorno dal database al formato frontend
  return {
    id: data.id,
    clientId: data.client_id,
    clientName: data.client_name,
    phone: data.phone,
    plate: data.plate,
    kilometrage: data.kilometrage,
    date: data.date,
    status: data.status,
    laborPrice: data.labor_price,
    laborHours: data.labor_hours,
    subtotal: data.subtotal,
    taxAmount: data.tax_amount,
    taxRate: data.tax_rate,
    total: data.total,
    totalPrice: data.total_price,
    notes: data.notes,
    partsOrdered: data.parts_ordered,
    items: typeof data.items === 'string' ? JSON.parse(data.items) : data.items || [],
    parts: typeof data.parts === 'string' ? JSON.parse(data.parts) : data.parts || [],
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined, // AGGIUNTO: mapping per updatedAt
    // Aggiungo il mapping per parts_subtotal
    ...(data.parts_subtotal !== undefined && { parts_subtotal: data.parts_subtotal })
  } as Quote & { parts_subtotal?: number };
};

export const deleteQuote = async (id: string): Promise<void> => {
  try {
    // 1. Prima ottieni i dati del preventivo per il logging
    const quote = await getQuoteById(id);
    
    // 2. Trova tutti gli appuntamenti associati a questo preventivo
    const allAppointments = await getAllAppointments();
    const linkedAppointments = allAppointments.filter(app => app.quoteId === id);
    
    // 3. Aggiorna gli appuntamenti collegati rimuovendo il riferimento al preventivo
    for (const appointment of linkedAppointments) {
      // console.log(`Rimozione riferimento preventivo ${id} dall'appuntamento ${appointment.id}`);
      await updateAppointment(appointment.id, {
        quoteId: "", // Rimuovi il riferimento al preventivo
        partsOrdered: false, // Reset dello stato dei pezzi
      });
    }
    
    // 4. Elimina il preventivo
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // 5. Registra l'eliminazione nel database
    if (quote) {
      await registerDatabaseChange(
        'delete',
        'quote',
        id,
        {
          client_name: quote.clientName,
          client_id: quote.clientId,
          total_price: quote.totalPrice || quote.total || 0,
          updated_appointments: linkedAppointments.length
        }
      );
    }
    
    // console.log(`Preventivo ${id} eliminato con successo, aggiornati ${linkedAppointments.length} appuntamenti collegati`);
    
  } catch (error) {
    // console.error(`Errore nell'eliminazione del preventivo ${id}:`, error);
    throw error;
  }
};

// ===== APPOINTMENT FUNCTIONS =====

export const getAllAppointments = async (): Promise<Appointment[]> => {
  // 🔒 SICUREZZA: Controlla se l'utente è admin
  if (!isCurrentUserAdmin()) {
    const clientId = getCurrentUserClientId();
    if (clientId) {
      // Se è un cliente, restituisce solo i propri appuntamenti
      return await getAppointmentsByClientId(clientId);
    } else {
      // Se non è admin e non ha clientId, blocca l'accesso
      throw new Error('Accesso non autorizzato: solo gli amministratori possono visualizzare tutti gli appuntamenti');
    }
  }
  
  // Se è admin, restituisce tutti gli appuntamenti
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('date', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(appointment => ({
    id: appointment.id,
    clientId: appointment.client_id,
    clientName: appointment.client_name,
    phone: appointment.phone,
    plate: appointment.plate,
    model: appointment.model,
    date: appointment.date,
    time: appointment.time,
    duration: appointment.duration,
    status: appointment.status,
    quoteId: appointment.quote_id,
    quoteLaborHours: appointment.quote_labor_hours,
    notes: appointment.notes,
    partsOrdered: appointment.parts_ordered,
    services: [], // Campo non salvato nel database, array vuoto di default
    spareParts: undefined,
    totalPartsPrice: undefined,
    startHour: undefined,
    startMinute: undefined,
    endHour: undefined,
    endMinute: undefined,
    type: undefined
  }));
};

export const getAppointmentsByDate = async (date: string): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('date', date)
    .order('time', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(appointment => ({
    id: appointment.id,
    clientId: appointment.client_id,
    clientName: appointment.client_name,
    phone: appointment.phone,
    plate: appointment.plate,
    model: appointment.model,
    date: appointment.date,
    time: appointment.time,
    duration: appointment.duration,
    status: appointment.status,
    quoteId: appointment.quote_id,
    quoteLaborHours: appointment.quote_labor_hours,
    notes: appointment.notes,
    partsOrdered: appointment.parts_ordered,
    services: [], // Campo non salvato nel database, array vuoto di default
    spareParts: undefined,
    totalPartsPrice: undefined,
    startHour: undefined,
    startMinute: undefined,
    endHour: undefined,
    endMinute: undefined,
    type: undefined
  }));
};

export const getAppointmentById = async (id: string): Promise<Appointment | null> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  // 🔒 SICUREZZA: Controlla se l'utente ha accesso a questo appuntamento
  if (!isCurrentUserAdmin()) {
    const clientId = getCurrentUserClientId();
    if (!clientId || data.client_id !== clientId) {
      throw new Error('Accesso non autorizzato: non puoi visualizzare appuntamenti di altri clienti');
    }
  }
  
  return {
    id: data.id,
    clientId: data.client_id,
    clientName: data.client_name,
    phone: data.phone,
    plate: data.plate,
    model: data.model,
    date: data.date,
    time: data.time,
    duration: data.duration,
    status: data.status,
    quoteId: data.quote_id,
    quoteLaborHours: data.quote_labor_hours,
    notes: data.notes,
    partsOrdered: data.parts_ordered,
    services: [], // Campo non salvato nel database, array vuoto di default
    spareParts: undefined,
    totalPartsPrice: undefined,
    startHour: undefined,
    startMinute: undefined,
    endHour: undefined,
    endMinute: undefined,
    type: undefined
  };
};

export const createAppointment = async (appointment: Omit<Appointment, 'id'>): Promise<Appointment> => {
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'appointmentId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const appointmentId = `AP${nextId.toString().padStart(3, '0')}`;
  
  // Recupera lo user_uid dal cliente collegato
  let userUid: string | null = null;
  try {
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('user_uid')
      .eq('id', appointment.clientId)
      .single();
    if (!clientError && clientData && clientData.user_uid) {
      userUid = clientData.user_uid;
    }
  } catch {}

  // Mappa i campi camelCase ai campi snake_case del database
  const appointmentForDb = {
    id: appointmentId,
    client_id: appointment.clientId,
    client_name: appointment.clientName,
    phone: appointment.phone,
    plate: appointment.plate,
    model: appointment.model,
    date: appointment.date,
    time: appointment.time,
    duration: appointment.duration,
    status: appointment.status,
    quote_id: appointment.quoteId,
    quote_labor_hours: appointment.quoteLaborHours,
    notes: appointment.notes,
    parts_ordered: appointment.partsOrdered || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_uid: userUid // <-- aggiunto qui
  };
  
  const { data, error } = await supabase
    .from('appointments')
    .insert([appointmentForDb])
    .select()
    .single();
  
  if (error) throw error;
  
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'appointmentId');
  
  await registerDatabaseChange(
    'create',
    'appointment',
    appointmentId,
    {
      client_name: appointment.clientName,
      client_id: appointment.clientId,
      date: appointment.date,
      time: appointment.time,
      duration: appointment.duration,
      status: appointment.status,
      quote_id: appointment.quoteId,
      quote_labor_hours: appointment.quoteLaborHours,
      phone: appointment.phone,
      plate: appointment.plate,
      model: appointment.model,
      parts_ordered: appointment.partsOrdered || false
    }
  );
  
  // Mappa i dati di ritorno dal database al formato frontend
  return {
    id: data.id,
    clientId: data.client_id,
    clientName: data.client_name,
    phone: data.phone,
    plate: data.plate,
    model: data.model,
    date: data.date,
    time: data.time,
    duration: data.duration,
    status: data.status,
    quoteId: data.quote_id,
    quoteLaborHours: data.quote_labor_hours,
    notes: data.notes,
    partsOrdered: data.parts_ordered,
    services: appointment.services || [],
    spareParts: appointment.spareParts,
    totalPartsPrice: appointment.totalPartsPrice,
    startHour: appointment.startHour,
    startMinute: appointment.startMinute,
    endHour: appointment.endHour,
    endMinute: appointment.endMinute,
    type: appointment.type
  };
};

export const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<void> => {
  // Mappa i campi camelCase ai campi snake_case del database
  const updatesForDb: any = {};
  
  if (updates.clientId !== undefined) updatesForDb.client_id = updates.clientId;
  if (updates.clientName !== undefined) updatesForDb.client_name = updates.clientName;
  if (updates.phone !== undefined) updatesForDb.phone = updates.phone;
  if (updates.plate !== undefined) updatesForDb.plate = updates.plate;
  if (updates.model !== undefined) updatesForDb.model = updates.model;
  if (updates.date !== undefined) updatesForDb.date = updates.date;
  if (updates.time !== undefined) updatesForDb.time = updates.time;
  if (updates.duration !== undefined) updatesForDb.duration = updates.duration;
  if (updates.status !== undefined) updatesForDb.status = updates.status;
  if (updates.quoteId !== undefined) updatesForDb.quote_id = updates.quoteId;
  if (updates.quoteLaborHours !== undefined) updatesForDb.quote_labor_hours = updates.quoteLaborHours;
  if (updates.notes !== undefined) updatesForDb.notes = updates.notes;
  if (updates.partsOrdered !== undefined) updatesForDb.parts_ordered = updates.partsOrdered;
  
  const { error } = await supabase
    .from('appointments')
    .update({
      ...updatesForDb,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
  
  // NUOVA LOGICA: Se l'appuntamento viene marcato come completato, aggiorna anche il preventivo associato
  if (updates.status === 'completato') {
    try {
      // Ottieni l'appuntamento aggiornato per recuperare il quoteId
      const appointment = await getAppointmentById(id);
      
      if (appointment?.quoteId) {
        console.log(`🔄 Sincronizzazione: Aggiornamento preventivo ${appointment.quoteId} a "completato" per appuntamento ${id}`);
        
        // Aggiorna il preventivo associato come completato
        await updateQuote(appointment.quoteId, { status: 'completato' });
        
        console.log(`✅ Preventivo ${appointment.quoteId} aggiornato a "completato" con successo`);
        
        await registerDatabaseChange(
          'update',
          'quote',
          appointment.quoteId,
          {
            status_changed: 'completato',
            triggered_by: `appointment_completion_${id}`,
            auto_sync: true
          }
        );
      } else {
        console.log(`ℹ️ Appuntamento ${id} non ha un preventivo associato`);
      }
    } catch (quoteError) {
      console.error(`❌ Errore nell'aggiornamento del preventivo per appuntamento ${id}:`, quoteError);
      // Non blocchiamo l'aggiornamento dell'appuntamento se fallisce l'aggiornamento del preventivo
    }
  }
  
  await registerDatabaseChange(
    'update',
    'appointment',
    id,
    {
      changes: Object.keys(updates).join(', '),
      status_sync: updates.status === 'completato' ? 'preventivo_auto_aggiornato' : undefined
    }
  );
};

export const deleteAppointment = async (id: string): Promise<void> => {
  const appointment = await getAppointmentById(id);
  
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  if (appointment && appointment.quoteId) {
    try {
      const quote = await getQuoteById(appointment.quoteId);
      if (quote && quote.status === "accettato") {
        await updateQuote(appointment.quoteId, { status: "inviato" });
      }
    } catch (error) {
      // console.error("Errore nell'aggiornamento dello stato del preventivo:", error);
    }
  }
  
  if (appointment) {
    await registerDatabaseChange(
      'delete',
      'appointment',
      id,
      {
        client_name: appointment.clientName,
        date: appointment.date,
        time: appointment.time,
        quote_status_changed: appointment.quoteId ? "accettato → inviato" : "nessun preventivo associato"
      }
    );
  }
};

// ===== SERVICE TYPE FUNCTIONS =====

export const getAllServiceTypes = async (): Promise<ServiceType[]> => {
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .order('category', { ascending: true });
  
  if (error) throw error;
  
  // Mappa i campi del database ai campi del frontend
  return (data || []).map(serviceType => ({
    id: serviceType.id,
    name: serviceType.name,
    category: serviceType.category,
    description: serviceType.description,
    laborPrice: 0 // Valore di default dato che il campo è stato rimosso
  }));
};

export const getServiceTypesByCategory = async (category: string): Promise<ServiceType[]> => {
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('category', category)
    .order('name', { ascending: true });
  
  if (error) throw error;
  
  // Mappa i campi del database ai campi del frontend
  return (data || []).map(serviceType => ({
    id: serviceType.id,
    name: serviceType.name,
    category: serviceType.category,
    description: serviceType.description,
    laborPrice: serviceType.labor_price || 0
  }));
};

export const createServiceType = async (serviceType: Omit<ServiceType, 'id'>): Promise<ServiceType> => {
  console.log('🔧 createServiceType - Input:', serviceType);
  
  // Genera un ID unico per il service type
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'serviceTypeId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const serviceTypeId = `ST${nextId.toString().padStart(3, '0')}`;
  
  // Mappa i campi camelCase ai campi snake_case del database (solo i campi che esistono)
  const serviceTypeForDb = {
    id: serviceTypeId,
    name: serviceType.name,
    category: serviceType.category,
    description: serviceType.description || null
  };

  console.log('🔧 createServiceType - Data for DB:', serviceTypeForDb);

  const { data, error } = await supabase
    .from('service_types')
    .insert([serviceTypeForDb])
    .select()
    .single();
  
  if (error) {
    console.error('❌ createServiceType - Database error:', error);
    throw error;
  }
  
  // Aggiorna il contatore
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'serviceTypeId');
  
  console.log('✅ createServiceType - Database response:', data);
  
  await registerDatabaseChange(
    'create',
    'service_type',
    serviceTypeId,
    {
      name: serviceType.name,
      category: serviceType.category,
      description: serviceType.description
    }
  );
  
  // Mappa i campi del database di ritorno al formato frontend
  const result = {
    id: data.id,
    name: data.name,
    category: data.category,
    description: data.description,
    laborPrice: 0 // Valore fisso dato che il campo è stato rimosso
  };
  
  console.log('✅ createServiceType - Final result:', result);
  return result;
};

export const updateServiceType = async (id: string, updates: Partial<ServiceType>): Promise<ServiceType> => {
  // Mappa i campi camelCase ai campi snake_case del database (solo i campi che esistono)
  const updatesForDb: any = {};
  
  if (updates.name !== undefined) updatesForDb.name = updates.name;
  if (updates.category !== undefined) updatesForDb.category = updates.category;
  if (updates.description !== undefined) updatesForDb.description = updates.description;
  // Rimosso: laborPrice non viene più salvato nel database
  // Rimosso: updated_at non esiste nella tabella

  const { data, error } = await supabase
    .from('service_types')
    .update(updatesForDb)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  await registerDatabaseChange(
    'update',
    'service_type',
    id,
    {
      changes: Object.keys(updates).filter(key => key !== 'laborPrice').join(', ')
    }
  );
  
  // Mappa i campi del database di ritorno al formato frontend
  return {
    id: data.id,
    name: data.name,
    category: data.category,
    description: data.description,
    laborPrice: 0 // Valore fisso dato che il campo è stato rimosso
  };
};

export const deleteServiceType = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('service_types')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  await registerDatabaseChange(
    'delete',
    'service_type',
    id,
    {}
  );
};

// ===== REQUEST FUNCTIONS =====

export const getAllRequests = async (): Promise<Request[]> => {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Mappa i campi snake_case ai campi camelCase
  return (data || []).map(request => ({
    id: request.id,
    nome: request.nome,
    cognome: request.cognome,
    email: request.email,
    telefono: request.telefono,
    targa: request.targa,
    dataNascita: request.data_nascita,
    note: request.note,
    tipoRichiesta: request.tipo_richiesta,
    dataAppuntamento: request.data_appuntamento,
    oraAppuntamento: request.ora_appuntamento,
    preferenzaOrario: request.preferenza_orario,
    status: request.status,
    createdAt: new Date(request.created_at).getTime(),
    ipAddress: request.ip_address,
    userAgent: request.user_agent
  }));
};

export const createRequest = async (request: Omit<Request, 'id'>): Promise<Request> => {
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'requestId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const requestId = `RQ${nextId.toString().padStart(3, '0')}`;
  
  // Mappa i campi camelCase ai campi snake_case del database
  const requestForDb = {
    id: requestId,
    nome: request.nome,
    cognome: request.cognome,
    email: request.email,
    telefono: request.telefono,
    targa: request.targa,
    data_nascita: request.dataNascita,
    note: request.note,
    tipo_richiesta: request.tipoRichiesta,
    data_appuntamento: request.dataAppuntamento,
    ora_appuntamento: request.oraAppuntamento,
    preferenza_orario: request.preferenzaOrario,
    status: request.status || 'ricevuta',
    ip_address: request.ipAddress,
    user_agent: request.userAgent
  };
  
  const { data, error } = await supabase
    .from('requests')
    .insert([requestForDb])
    .select()
    .single();
  
  if (error) throw error;
  
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'requestId');
  
  await registerDatabaseChange(
    'create',
    'request',
    requestId,
    {
      clientName: `${request.nome} ${request.cognome}`,
      tipoRichiesta: request.tipoRichiesta,
      email: request.email
    }
  );
  
  // Mappa i dati di ritorno dal database al formato frontend
  return {
    id: data.id,
    nome: data.nome,
    cognome: data.cognome,
    email: data.email,
    telefono: data.telefono,
    targa: data.targa,
    dataNascita: data.data_nascita,
    note: data.note,
    tipoRichiesta: data.tipo_richiesta,
    dataAppuntamento: data.data_appuntamento,
    oraAppuntamento: data.ora_appuntamento,
    preferenzaOrario: data.preferenza_orario,
    status: data.status,
    createdAt: new Date(data.created_at).getTime(),
    ipAddress: data.ip_address,
    userAgent: data.user_agent
  };
};

export const updateRequest = async (id: string, updates: Partial<Request>): Promise<void> => {
  // Mappa i campi camelCase ai campi snake_case del database
  const updatesForDb: any = {};
  
  if (updates.nome !== undefined) updatesForDb.nome = updates.nome;
  if (updates.cognome !== undefined) updatesForDb.cognome = updates.cognome;
  if (updates.email !== undefined) updatesForDb.email = updates.email;
  if (updates.telefono !== undefined) updatesForDb.telefono = updates.telefono;
  if (updates.targa !== undefined) updatesForDb.targa = updates.targa;
  if (updates.dataNascita !== undefined) updatesForDb.data_nascita = updates.dataNascita;
  if (updates.note !== undefined) updatesForDb.note = updates.note;
  if (updates.tipoRichiesta !== undefined) updatesForDb.tipo_richiesta = updates.tipoRichiesta;
  if (updates.dataAppuntamento !== undefined) updatesForDb.data_appuntamento = updates.dataAppuntamento;
  if (updates.oraAppuntamento !== undefined) updatesForDb.ora_appuntamento = updates.oraAppuntamento;
  if (updates.preferenzaOrario !== undefined) updatesForDb.preferenza_orario = updates.preferenzaOrario;
  if (updates.status !== undefined) updatesForDb.status = updates.status;
  if (updates.ipAddress !== undefined) updatesForDb.ip_address = updates.ipAddress;
  if (updates.userAgent !== undefined) updatesForDb.user_agent = updates.userAgent;
  
  const { error } = await supabase
    .from('requests')
    .update(updatesForDb)
    .eq('id', id);
  
  if (error) throw error;
  
  await registerDatabaseChange(
    'update',
    'request',
    id,
    {
      changes: Object.keys(updates).join(', ')
    }
  );
};

export const deleteRequest = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  await registerDatabaseChange(
    'delete',
    'request',
    id,
    {}
  );
};

// ===== UTILITY FUNCTIONS =====

export const calculateQuoteTotals = (quote: Quote): Quote => {
  const items = quote.items || [];
  const parts = quote.parts || [];
  
  const partsSubtotal = parts.reduce((sum, part) => {
    return sum + (part.quantity * part.price);
  }, 0);
  
  const laborTotal = (quote.laborHours || 0) * (quote.laborPrice || 0);
  const subtotal = partsSubtotal + laborTotal;
  const taxRate = quote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  
  return {
    ...quote,
    total: total,
    totalPrice: total
  };
};

// ===== MERGE FUNCTIONS =====

export const mergeQuotes = async (quoteIds: string[]): Promise<Quote | null> => {
  // Dobbiamo avere almeno due preventivi da unire
  if (!quoteIds || quoteIds.length < 2) {
    console.error("È necessario fornire almeno due preventivi da unire");
    return null;
  }
  
  try {
    // Recupera tutti i preventivi
    const quotes: Quote[] = [];
    
    for (const id of quoteIds) {
      const quote = await getQuoteById(id);
      if (!quote) {
        console.error(`Preventivo con ID ${id} non trovato`);
        return null;
      }
      quotes.push(quote);
    }
    
    // Verifica che tutti i preventivi siano dello stesso cliente
    const clientId = quotes[0].clientId;
    const clientName = quotes[0].clientName;
    const plate = quotes[0].plate;
    
    for (let i = 1; i < quotes.length; i++) {
      if (quotes[i].clientId !== clientId) {
        console.error("I preventivi devono appartenere allo stesso cliente");
        return null;
      }
    }
    
    // Inizia a costruire il nuovo preventivo
    let totalLaborHours = 0;
    let allItems: any[] = [];
    
    // Combina tutti gli item e somma le ore di manodopera
    quotes.forEach(quote => {
      // Somma le ore di manodopera
      totalLaborHours += quote.laborHours || 0;
      
      // Aggiungi gli item del preventivo
      if (quote.items && Array.isArray(quote.items)) {
        allItems = [...allItems, ...quote.items];
      }
    });
    
    // Crea il nuovo preventivo con i campi base
    const newQuote: Omit<Quote, 'id'> = {
      clientId,
      clientName,
      phone: quotes[0].phone,
      plate,
      kilometrage: quotes[0].kilometrage,
      date: new Date().toISOString().split('T')[0],
      status: "bozza",
      laborPrice: quotes[0].laborPrice,
      laborHours: totalLaborHours,
      parts: [],
      items: allItems,
      notes: `Preventivo unificato creato dalla fusione di ${quoteIds.length} preventivi: ${quoteIds.join(', ')}`,
      taxRate: quotes[0].taxRate || 22,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      totalPrice: 0,
      partsOrdered: false,
      createdAt: Date.now()
    };
    
    // Calcola i totali usando la funzione di calcolo esistente
    const calculatedQuote = calculateQuoteTotals(newQuote as Quote);
    
    // Salva il nuovo preventivo
    const createdQuote = await createQuote(calculatedQuote);
    
    // Elimina i preventivi originali
    for (const id of quoteIds) {
      try {
        // Elimina il preventivo originale
        await deleteQuote(id);
      } catch (error) {
        console.error(`Errore nell'eliminazione del preventivo originale ${id}:`, error);
      }
    }
    
    return createdQuote;
  } catch (error) {
    console.error("Errore durante l'unione dei preventivi:", error);
    return null;
  }
};

// ===== WORK SESSION FUNCTIONS =====

export const getAllWorkSessions = async (): Promise<WorkSession[]> => {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const getWorkSessionById = async (id: string): Promise<WorkSession | null> => {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
};

export const getWorkSessionByAppointmentId = async (appointmentId: string): Promise<WorkSession | null> => {
  // Recupera l'user_uid dell'utente corrente
  const userUid = await getCurrentUserUid();
  let query = supabase
    .from('work_sessions')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: false });

  // Se l'utente non è admin, filtra anche per user_uid tramite join con appointments
  if (userUid) {
    // Non puoi fare join diretti con Supabase JS, ma la policy RLS farà il filtro
    // Quindi qui lasci solo il filtro per appointment_id
    // Se vuoi essere sicuro, puoi filtrare anche lato client dopo aver ricevuto i dati
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return null;

  // Prima cerca una sessione non completata (in corso)
  const activeSession = data.find(session => !session.completed);
  if (activeSession) {
    return {
      ...activeSession,
      appointmentId: activeSession.appointment_id,
      vehicleId: activeSession.vehicle_id,
      acceptancePhotos: activeSession.acceptance_photos,
      fuelLevel: activeSession.fuel_level,
      sparePartsPhotos: activeSession.spare_parts_photos,
      currentStep: activeSession.current_step,
      completedAt: activeSession.completed_at,
      descpart: activeSession.descpart,
      // Aggiungi le note delle foto
      p1note: activeSession.p1note,
      p2note: activeSession.p2note,
      p3note: activeSession.p3note,
      p4note: activeSession.p4note,
      p5note: activeSession.p5note,
      p6note: activeSession.p6note
    };
  }

  // Se tutte le sessioni sono completate, restituisce la più recente
  const latestSession = data[0];
  return {
    ...latestSession,
    appointmentId: latestSession.appointment_id,
    vehicleId: latestSession.vehicle_id,
    acceptancePhotos: latestSession.acceptance_photos,
    fuelLevel: latestSession.fuel_level,
    sparePartsPhotos: latestSession.spare_parts_photos,
    currentStep: latestSession.current_step,
    completedAt: latestSession.completed_at,
    descpart: latestSession.descpart,
    // Aggiungi le note delle foto
    p1note: latestSession.p1note,
    p2note: latestSession.p2note,
    p3note: latestSession.p3note,
    p4note: latestSession.p4note,
    p5note: latestSession.p5note,
    p6note: latestSession.p6note
  };
};

export const getWorkSessionByVehicleId = async (vehicleId: string): Promise<WorkSession | null> => {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) {
    throw error;
  }
  
  // Restituisce il primo elemento dell'array con mappatura corretta o null se l'array è vuoto
  if (data && data.length > 0) {
    const session = data[0];
    return {
      ...session,
      appointmentId: session.appointment_id,
      vehicleId: session.vehicle_id,
      acceptancePhotos: session.acceptance_photos,
      fuelLevel: session.fuel_level,
      sparePartsPhotos: session.spare_parts_photos,
      currentStep: session.current_step,
      completedAt: session.completed_at,
      descpart: session.descpart,
      // Aggiungi le note delle foto
      p1note: session.p1note,
      p2note: session.p2note,
      p3note: session.p3note,
      p4note: session.p4note,
      p5note: session.p5note,
      p6note: session.p6note
    };
  }
  
  return null;
};

export const createWorkSession = async (workSession: Omit<WorkSession, 'id'>): Promise<WorkSession> => {
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'workSessionId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const workSessionId = `WS${nextId.toString().padStart(3, '0')}`;
  
  const workSessionData = {
    id: workSessionId,
    appointment_id: workSession.appointmentId,
    vehicle_id: workSession.vehicleId,
    acceptance_photos: workSession.acceptancePhotos || [],
    fuel_level: workSession.fuelLevel,
    mileage: workSession.mileage,
    spare_parts_photos: workSession.sparePartsPhotos || [],
    current_step: workSession.currentStep || 1,
    completed: workSession.completed || false,
    completed_at: workSession.completedAt,
    descpart: workSession.descpart,
    // Aggiungi le note delle foto
    p1note: workSession.p1note,
    p2note: workSession.p2note,
    p3note: workSession.p3note,
    p4note: workSession.p4note,
    p5note: workSession.p5note,
    p6note: workSession.p6note,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('work_sessions')
    .insert([workSessionData])
    .select()
    .single();
  
  if (error) throw error;
  
  // Aggiorna il contatore
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'workSessionId');
  
  // Registra la modifica
  await registerDatabaseChange('CREATE', 'work_session', workSessionId, workSessionData);
  
  // Mappa i campi del database ai campi del frontend
  return {
    ...data,
    appointmentId: data.appointment_id,
    vehicleId: data.vehicle_id,
    acceptancePhotos: data.acceptance_photos,
    fuelLevel: data.fuel_level,
    sparePartsPhotos: data.spare_parts_photos,
    currentStep: data.current_step,
    completedAt: data.completed_at,
    descpart: data.descpart,
    // Aggiungi le note delle foto
    p1note: data.p1note,
    p2note: data.p2note,
    p3note: data.p3note,
    p4note: data.p4note,
    p5note: data.p5note,
    p6note: data.p6note
  };
};

export const updateWorkSession = async (id: string, updates: Partial<WorkSession>): Promise<WorkSession> => {
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  // Mappa i campi del frontend ai campi del database
  if (updates.appointmentId !== undefined) updateData.appointment_id = updates.appointmentId;
  if (updates.vehicleId !== undefined) updateData.vehicle_id = updates.vehicleId;
  if (updates.acceptancePhotos !== undefined) updateData.acceptance_photos = updates.acceptancePhotos;
  if (updates.fuelLevel !== undefined) updateData.fuel_level = updates.fuelLevel;
  if (updates.mileage !== undefined) updateData.mileage = updates.mileage;
  if (updates.sparePartsPhotos !== undefined) updateData.spare_parts_photos = updates.sparePartsPhotos;
  if (updates.currentStep !== undefined) updateData.current_step = updates.currentStep;
  if (updates.completed !== undefined) updateData.completed = updates.completed;
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
  if (updates.descpart !== undefined) updateData.descpart = updates.descpart;
  // Aggiungi le note delle foto
  if (updates.p1note !== undefined) updateData.p1note = updates.p1note;
  if (updates.p2note !== undefined) updateData.p2note = updates.p2note;
  if (updates.p3note !== undefined) updateData.p3note = updates.p3note;
  if (updates.p4note !== undefined) updateData.p4note = updates.p4note;
  if (updates.p5note !== undefined) updateData.p5note = updates.p5note;
  if (updates.p6note !== undefined) updateData.p6note = updates.p6note;
  
  const { data, error } = await supabase
    .from('work_sessions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // Registra la modifica (se non già fatto sopra)
  if (updates.completed === undefined) {
    await registerDatabaseChange('UPDATE', 'work_session', id, updates);
  }
  
  // Mappa i campi del database ai campi del frontend
  return {
    ...data,
    appointmentId: data.appointment_id,
    vehicleId: data.vehicle_id,
    acceptancePhotos: data.acceptance_photos,
    fuelLevel: data.fuel_level,
    sparePartsPhotos: data.spare_parts_photos,
    currentStep: data.current_step,
    completedAt: data.completed_at,
    descpart: data.descpart,
    // Aggiungi le note delle foto
    p1note: data.p1note,
    p2note: data.p2note,
    p3note: data.p3note,
    p4note: data.p4note,
    p5note: data.p5note,
    p6note: data.p6note
  };
};

export const deleteWorkSession = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('work_sessions')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // Registra la modifica
  await registerDatabaseChange('DELETE', 'work_session', id);
};

// ===== CHECKLIST ITEM FUNCTIONS =====

export const getAllChecklistItems = async (): Promise<ChecklistItem[]> => {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const getChecklistItemById = async (id: string): Promise<ChecklistItem | null> => {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
};

export const getChecklistItemByAppointmentId = async (appointmentId: string): Promise<ChecklistItem | null> => {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('appointment_id', appointmentId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
};

export const getChecklistItemByVehicleId = async (vehicleId: string): Promise<ChecklistItem | null> => {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) {
    throw error;
  }
  
  // Restituisce il primo elemento dell'array o null se l'array è vuoto
  return data && data.length > 0 ? data[0] : null;
};

export const createChecklistItem = async (checklistItem: Omit<ChecklistItem, 'id'>): Promise<ChecklistItem> => {
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'checklistItemId')
    .single();
  
  if (counterError) throw counterError;
  
  const nextId = (counterData?.value || 0) + 1;
  const checklistItemId = `CI${nextId.toString().padStart(3, '0')}`;
  
  const checklistItemData = {
    id: checklistItemId,
    appointment_id: checklistItem.appointmentId,
    vehicle_id: checklistItem.vehicleId,
    item_name: checklistItem.itemName,
    item_category: checklistItem.itemCategory,
    status: checklistItem.status || 'non_controllato',
    notes: checklistItem.notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('checklist_items')
    .insert([checklistItemData])
    .select()
    .single();
  
  if (error) throw error;
  
  // Aggiorna il contatore
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'checklistItemId');
  
  // Registra la modifica
  await registerDatabaseChange('CREATE', 'checklist_item', checklistItemId, checklistItemData);
  
  // Mappa i campi del database ai campi del frontend
  return {
    ...data,
    appointmentId: data.appointment_id,
    vehicleId: data.vehicle_id,
    itemName: data.item_name,
    itemCategory: data.item_category
  };
};

export const updateChecklistItem = async (id: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem> => {
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  // Mappa i campi del frontend ai campi del database
  if (updates.appointmentId !== undefined) updateData.appointment_id = updates.appointmentId;
  if (updates.vehicleId !== undefined) updateData.vehicle_id = updates.vehicleId;
  if (updates.itemName !== undefined) updateData.item_name = updates.itemName;
  if (updates.itemCategory !== undefined) updateData.item_category = updates.itemCategory;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  
  const { data, error } = await supabase
    .from('checklist_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // Registra la modifica
  await registerDatabaseChange('UPDATE', 'checklist_item', id, updates);
  
  // Mappa i campi del database ai campi del frontend
  return {
    ...data,
    appointmentId: data.appointment_id,
    vehicleId: data.vehicle_id,
    itemName: data.item_name,
    itemCategory: data.item_category,
    status: data.status,
    notes: data.notes
  };
};

export const deleteChecklistItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // Registra la modifica
  await registerDatabaseChange('DELETE', 'checklist_item', id);
};

// ===== CHECKLIST TEMPLATE FUNCTIONS =====

export const getAllChecklistTemplates = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const getChecklistTemplatesByCategory = async (category: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('item_category', category)
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createChecklistTemplate = async (template: {
  itemName: string;
  itemCategory: string;
  description?: string;
}): Promise<any> => {
  // Genera un ID unico
  const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Ottieni il prossimo sort_order
  const { data: maxSortData } = await supabase
    .from('checklist_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  
  const nextSortOrder = (maxSortData?.[0]?.sort_order || 0) + 1;
  
  const templateData = {
    id: templateId,
    item_name: template.itemName,
    item_category: template.itemCategory,
    description: template.description || '',
    sort_order: nextSortOrder,
    created_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('checklist_templates')
    .insert([templateData])
    .select()
    .single();
  
  if (error) throw error;
  
  return data;
};

export const updateChecklistTemplate = async (id: string, updates: {
  itemName?: string;
  itemCategory?: string;
  description?: string;
}): Promise<any> => {
  const updateData: any = {};
  
  if (updates.itemName !== undefined) updateData.item_name = updates.itemName;
  if (updates.itemCategory !== undefined) updateData.item_category = updates.itemCategory;
  if (updates.description !== undefined) updateData.description = updates.description;
  
  const { data, error } = await supabase
    .from('checklist_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  return data;
};

export const deleteChecklistTemplate = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('checklist_templates')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const bulkUpdateChecklistTemplates = async (ids: string[], updates: {
  itemCategory?: string;
}): Promise<void> => {
  const updateData: any = {};
  
  if (updates.itemCategory !== undefined) updateData.item_category = updates.itemCategory;
  
  const { error } = await supabase
    .from('checklist_templates')
    .update(updateData)
    .in('id', ids);
  
  if (error) throw error;
};

export const bulkDeleteChecklistTemplates = async (ids: string[]): Promise<void> => {
  const { error } = await supabase
    .from('checklist_templates')
    .delete()
    .in('id', ids);
  
  if (error) throw error;
};

export const createChecklistItemsFromTemplate = async (appointmentId: string, vehicleId: string, forceNew: boolean = false): Promise<ChecklistItem[]> => {
  // Controlla se esistono già elementi checklist per questo appuntamento
  const existingItems = await getChecklistItemsByAppointmentId(appointmentId);
  if (existingItems.length > 0 && !forceNew) {
    console.log(`📋 Checklist già esistente per appuntamento ${appointmentId} con ${existingItems.length} elementi`);
    
    // Se tutte le checklist esistenti sono completate (hanno status diverso da 'non_controllato'), 
    // crea una nuova checklist
    const activeItems = existingItems.filter(item => item.status === 'non_controllato');
    if (activeItems.length === 0) {
      console.log(`📋 Tutte le checklist esistenti sono completate, creazione nuova checklist per appuntamento ${appointmentId}`);
      // Procedi con la creazione di una nuova checklist
    } else {
      console.log(`📋 Trovate ${activeItems.length} checklist attive, utilizzo checklist esistente`);
      return existingItems;
    }
  }
  
  // Ottieni tutti i template
  let templates = await getAllChecklistTemplates();
  
  // Se non ci sono template o mancano categorie essenziali, crea template di default
  if (templates.length < 100) { // Se abbiamo meno di 100 template, aggiungiamo quelli mancanti
    console.log('📝 Creazione template di default completi...');
    
    // Template di default COMPLETI per tutte le categorie
    const defaultTemplates = [
      // ===== PNEUMATICI =====
      { itemName: 'Controllo pressione pneumatico anteriore destro', itemCategory: 'PNEUMATICI', description: 'Verifica pressione' },
      { itemName: 'Controllo pressione pneumatico anteriore sinistro', itemCategory: 'PNEUMATICI', description: 'Verifica pressione' },
      { itemName: 'Controllo pressione pneumatico posteriore destro', itemCategory: 'PNEUMATICI', description: 'Verifica pressione' },
      { itemName: 'Controllo pressione pneumatico posteriore sinistro', itemCategory: 'PNEUMATICI', description: 'Verifica pressione' },
      { itemName: 'Battistrada anteriore destro', itemCategory: 'PNEUMATICI', description: 'Spessore battistrada' },
      { itemName: 'Battistrada anteriore sinistro', itemCategory: 'PNEUMATICI', description: 'Spessore battistrada' },
      { itemName: 'Battistrada posteriore destro', itemCategory: 'PNEUMATICI', description: 'Spessore battistrada' },
      { itemName: 'Battistrada posteriore sinistro', itemCategory: 'PNEUMATICI', description: 'Spessore battistrada' },
      { itemName: 'Usura irregolare pneumatici', itemCategory: 'PNEUMATICI', description: 'Controllo usura anomala' },
      { itemName: 'Fianco pneumatico anteriore destro', itemCategory: 'PNEUMATICI', description: 'Integrità fianco' },
      { itemName: 'Fianco pneumatico anteriore sinistro', itemCategory: 'PNEUMATICI', description: 'Integrità fianco' },
      { itemName: 'Fianco pneumatico posteriore destro', itemCategory: 'PNEUMATICI', description: 'Integrità fianco' },
      { itemName: 'Fianco pneumatico posteriore sinistro', itemCategory: 'PNEUMATICI', description: 'Integrità fianco' },
      
      // ===== CONTROLLO MOTORE =====
      { itemName: 'Livello olio motore', itemCategory: 'CONTROLLO MOTORE', description: 'Controllo livello e qualità' },
      { itemName: 'Livello refrigerante', itemCategory: 'CONTROLLO MOTORE', description: 'Verifica livello liquido' },
      { itemName: 'Livello refrigerante radiatore', itemCategory: 'CONTROLLO MOTORE', description: 'Controllo radiatore' },
      { itemName: 'Olio motore qualità', itemCategory: 'CONTROLLO MOTORE', description: 'Qualità e viscosità olio' },
      { itemName: 'Filtro olio', itemCategory: 'CONTROLLO MOTORE', description: 'Stato filtro olio' },
      { itemName: 'Filtro aria', itemCategory: 'CONTROLLO MOTORE', description: 'Pulizia filtro aria' },
      { itemName: 'Filtro abitacolo', itemCategory: 'CONTROLLO MOTORE', description: 'Stato filtro aria abitacolo' },
      { itemName: 'Filtro gasolio', itemCategory: 'CONTROLLO MOTORE', description: 'Integrità filtro carburante' },
      { itemName: 'Filtro benzina', itemCategory: 'CONTROLLO MOTORE', description: 'Stato filtro benzina' },
      { itemName: 'Candele', itemCategory: 'CONTROLLO MOTORE', description: 'Stato elettrodi candele' },
      { itemName: 'Cinghia distribuzione', itemCategory: 'CONTROLLO MOTORE', description: 'Tensione e integrità' },
      { itemName: 'Cinghia alternatore', itemCategory: 'CONTROLLO MOTORE', description: 'Stato cinghia servizi' },
      { itemName: 'Cinghie ausiliarie', itemCategory: 'CONTROLLO MOTORE', description: 'Controllo cinghie' },
      { itemName: 'Supporti motore', itemCategory: 'CONTROLLO MOTORE', description: 'Integrità supporti' },
      { itemName: 'Cuffie semiassi', itemCategory: 'CONTROLLO MOTORE', description: 'Stato cuffie CV' },
      { itemName: 'Perdite olio motore', itemCategory: 'CONTROLLO MOTORE', description: 'Controllo perdite' },
      { itemName: 'Batteria', itemCategory: 'CONTROLLO MOTORE', description: 'Stato batteria e morsetti' },
      { itemName: 'Liquido tergicristalli', itemCategory: 'CONTROLLO MOTORE', description: 'Livello liquido' },
      
      // ===== IMPIANTO FRENANTE =====
      { itemName: 'Pastiglie freni anteriori destra', itemCategory: 'IMPIANTO FRENANTE', description: 'Spessore pastiglia' },
      { itemName: 'Pastiglie freni anteriori sinistra', itemCategory: 'IMPIANTO FRENANTE', description: 'Spessore pastiglia' },
      { itemName: 'Pastiglie freni posteriori destra', itemCategory: 'IMPIANTO FRENANTE', description: 'Spessore pastiglia' },
      { itemName: 'Pastiglie freni posteriori sinistra', itemCategory: 'IMPIANTO FRENANTE', description: 'Spessore pastiglia' },
      { itemName: 'Disco freno anteriore destro', itemCategory: 'IMPIANTO FRENANTE', description: 'Stato superficie disco' },
      { itemName: 'Disco freno anteriore sinistro', itemCategory: 'IMPIANTO FRENANTE', description: 'Stato superficie disco' },
      { itemName: 'Disco freno posteriore destro', itemCategory: 'IMPIANTO FRENANTE', description: 'Stato superficie disco' },
      { itemName: 'Disco freno posteriore sinistro', itemCategory: 'IMPIANTO FRENANTE', description: 'Stato superficie disco' },
      { itemName: 'Pinze freni anteriori', itemCategory: 'IMPIANTO FRENANTE', description: 'Funzionalità pinze' },
      { itemName: 'Pinze freni posteriori', itemCategory: 'IMPIANTO FRENANTE', description: 'Funzionalità pinze' },
      { itemName: 'Tubi freno', itemCategory: 'IMPIANTO FRENANTE', description: 'Integrità tubi' },
      { itemName: 'Liquido freni', itemCategory: 'IMPIANTO FRENANTE', description: 'Livello e qualità' },
      { itemName: 'Freno a mano', itemCategory: 'IMPIANTO FRENANTE', description: 'Funzionalità freno' },
      { itemName: 'Pedale freno', itemCategory: 'IMPIANTO FRENANTE', description: 'Corsa pedale' },
      { itemName: 'Servofreno', itemCategory: 'IMPIANTO FRENANTE', description: 'Funzionalità servo' },
      
      // ===== STERZO AUTO =====
      { itemName: 'Volante gioco', itemCategory: 'STERZO AUTO', description: 'Gioco sterzo' },
      { itemName: 'Scatola sterzo', itemCategory: 'STERZO AUTO', description: 'Funzionalità scatola' },
      { itemName: 'Tiranti sterzo', itemCategory: 'STERZO AUTO', description: 'Integrità tiranti' },
      { itemName: 'Testine sterzo', itemCategory: 'STERZO AUTO', description: 'Stato testine' },
      { itemName: 'Cuffie sterzo', itemCategory: 'STERZO AUTO', description: 'Integrità cuffie' },
      { itemName: 'Liquido servosterzo', itemCategory: 'STERZO AUTO', description: 'Livello liquido' },
      { itemName: 'Pompa servosterzo', itemCategory: 'STERZO AUTO', description: 'Funzionalità pompa' },
      { itemName: 'Convergenza ruote', itemCategory: 'STERZO AUTO', description: 'Allineamento ruote' },
      
      // ===== SOSPENSIONE ANTERIORE =====
      { itemName: 'Ammortizzatore anteriore destro', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Funzionalità ammortizzatore' },
      { itemName: 'Ammortizzatore anteriore sinistro', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Funzionalità ammortizzatore' },
      { itemName: 'Molla anteriore destra', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Integrità molla' },
      { itemName: 'Molla anteriore sinistra', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Integrità molla' },
      { itemName: 'Braccio oscillante anteriore destro', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Stato braccio' },
      { itemName: 'Braccio oscillante anteriore sinistro', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Stato braccio' },
      { itemName: 'Barra stabilizzatrice anteriore', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Integrità barra' },
      { itemName: 'Silent block anteriori', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Stato silent block' },
      { itemName: 'Cuscinetto ruota anteriore destra', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Funzionalità cuscinetto' },
      { itemName: 'Cuscinetto ruota anteriore sinistra', itemCategory: 'SOSPENSIONE ANTERIORE', description: 'Funzionalità cuscinetto' },
      
      // ===== SOSPENSIONE POSTERIORE =====
      { itemName: 'Ammortizzatore posteriore destro', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Funzionalità ammortizzatore' },
      { itemName: 'Ammortizzatore posteriore sinistro', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Funzionalità ammortizzatore' },
      { itemName: 'Molla posteriore destra', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Integrità molla' },
      { itemName: 'Molla posteriore sinistra', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Integrità molla' },
      { itemName: 'Braccio oscillante posteriore destro', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Stato braccio' },
      { itemName: 'Braccio oscillante posteriore sinistro', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Stato braccio' },
      { itemName: 'Barra stabilizzatrice posteriore', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Integrità barra' },
      { itemName: 'Silent block posteriori', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Stato silent block' },
      { itemName: 'Cuscinetto ruota posteriore destra', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Funzionalità cuscinetto' },
      { itemName: 'Cuscinetto ruota posteriore sinistra', itemCategory: 'SOSPENSIONE POSTERIORE', description: 'Funzionalità cuscinetto' },
      
      // ===== TRASMISSIONE ANT/POST =====
      { itemName: 'Frizione', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Funzionalità frizione' },
      { itemName: 'Cambio manuale', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Funzionalità cambio' },
      { itemName: 'Cambio automatico', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Funzionalità automatico' },
      { itemName: 'Olio cambio', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Livello olio cambio' },
      { itemName: 'Semiasse destro', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Integrità semiasse' },
      { itemName: 'Semiasse sinistro', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Integrità semiasse' },
      { itemName: 'Giunto omocinetico anteriore destro', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Stato giunto CV' },
      { itemName: 'Giunto omocinetico anteriore sinistro', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Stato giunto CV' },
      { itemName: 'Giunto omocinetico posteriore destro', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Stato giunto CV' },
      { itemName: 'Giunto omocinetico posteriore sinistro', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Stato giunto CV' },
      { itemName: 'Differenziale', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Funzionalità differenziale' },
      { itemName: 'Olio differenziale', itemCategory: 'TRASMISSIONE ANT/POST', description: 'Livello olio differenziale' },
      
      // ===== IMPIANTO DI SCARICO =====
      { itemName: 'Collettore di scarico', itemCategory: 'IMPIANTO DI SCARICO', description: 'Integrità collettore' },
      { itemName: 'Catalizzatore', itemCategory: 'IMPIANTO DI SCARICO', description: 'Funzionalità catalizzatore' },
      { itemName: 'Filtro antiparticolato', itemCategory: 'IMPIANTO DI SCARICO', description: 'Stato DPF' },
      { itemName: 'Silenziatore centrale', itemCategory: 'IMPIANTO DI SCARICO', description: 'Integrità silenziatore' },
      { itemName: 'Silenziatore posteriore', itemCategory: 'IMPIANTO DI SCARICO', description: 'Integrità terminale' },
      { itemName: 'Tubo di scarico', itemCategory: 'IMPIANTO DI SCARICO', description: 'Integrità tubazioni' },
      { itemName: 'Ganci scarico', itemCategory: 'IMPIANTO DI SCARICO', description: 'Stato fissaggi' },
      { itemName: 'Sonda lambda', itemCategory: 'IMPIANTO DI SCARICO', description: 'Funzionalità sonda' },
      { itemName: 'Perdite gas di scarico', itemCategory: 'IMPIANTO DI SCARICO', description: 'Controllo perdite' },
      
      // ===== CONTROLLI AGGIUNTIVI =====
      { itemName: 'Fari anteriori', itemCategory: 'ALTRO', description: 'Funzionalità illuminazione' },
      { itemName: 'Fari posteriori', itemCategory: 'ALTRO', description: 'Funzionalità luci posteriori' },
      { itemName: 'Indicatori di direzione', itemCategory: 'ALTRO', description: 'Frecce funzionanti' },
      { itemName: 'Luci di emergenza', itemCategory: 'ALTRO', description: 'Quattro frecce' },
      { itemName: 'Tergicristalli anteriori', itemCategory: 'ALTRO', description: 'Funzionalità tergicristalli' },
      { itemName: 'Tergicristallo posteriore', itemCategory: 'ALTRO', description: 'Tergi posteriore' },
      { itemName: 'Spazzole tergicristalli', itemCategory: 'ALTRO', description: 'Stato spazzole' },
      { itemName: 'Parabrezza', itemCategory: 'ALTRO', description: 'Integrità vetro' },
      { itemName: 'Vetri laterali', itemCategory: 'ALTRO', description: 'Stato vetri laterali' },
      { itemName: 'Lunotto posteriore', itemCategory: 'ALTRO', description: 'Integrità lunotto' },
      { itemName: 'Specchietti retrovisori', itemCategory: 'ALTRO', description: 'Funzionalità specchietti' },
      { itemName: 'Cinture di sicurezza', itemCategory: 'ALTRO', description: 'Stato cinture' },
      { itemName: 'Airbag', itemCategory: 'ALTRO', description: 'Sistema airbag' },
      { itemName: 'Climatizzatore', itemCategory: 'ALTRO', description: 'Funzionalità A/C' },
      { itemName: 'Riscaldamento', itemCategory: 'ALTRO', description: 'Sistema riscaldamento' },
      { itemName: 'Radio e comandi', itemCategory: 'ALTRO', description: 'Impianto audio' },
      { itemName: 'Clacson', itemCategory: 'ALTRO', description: 'Funzionalità avvisatore' },
      { itemName: 'Chiusura centralizzata', itemCategory: 'ALTRO', description: 'Sistema chiusure' },
      { itemName: 'Alzacristalli elettrici', itemCategory: 'ALTRO', description: 'Funzionalità alzacristalli' },
      { itemName: 'Sedili', itemCategory: 'ALTRO', description: 'Stato e regolazioni sedili' },
      { itemName: 'Poggiatesta', itemCategory: 'ALTRO', description: 'Posizionamento poggiatesta' }
    ];
    
    // Crea solo i template che non esistono già
    let createdCount = 0;
    for (const defaultTemplate of defaultTemplates) {
      const exists = templates.some(t => 
        t.item_name === defaultTemplate.itemName && 
        t.item_category === defaultTemplate.itemCategory
      );
      
      if (!exists) {
        try {
          const newTemplate = await createChecklistTemplate(defaultTemplate);
          templates.push(newTemplate);
          createdCount++;
          console.log(`✅ Creato template ${createdCount}: ${defaultTemplate.itemName} (${defaultTemplate.itemCategory})`);
        } catch (error) {
          console.error(`❌ Errore creazione template ${defaultTemplate.itemName}:`, error);
        }
      }
    }
    
    console.log(`📝 Creati ${createdCount} nuovi template`);
    
    // Ricarica tutti i template dal database
    templates = await getAllChecklistTemplates();
  }
  
  console.log(`📋 Utilizzando ${templates.length} template per creare la checklist`);
  
  // Crea gli elementi della checklist per questo appuntamento
  const checklistItems: ChecklistItem[] = [];
  
  for (const template of templates) {
    try {
      // Genera un ID univoco usando timestamp e random per evitare conflitti
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const checklistItemId = `CI_${appointmentId}_${timestamp}_${random}`;
      
      const checklistItemData = {
        id: checklistItemId,
        appointment_id: appointmentId,
        vehicle_id: vehicleId,
        item_name: template.item_name,
        item_category: template.item_category,
        status: 'non_controllato',
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('checklist_items')
        .insert([checklistItemData])
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Errore creazione elemento checklist ${template.item_name}:`, error);
        continue; // Continua con il prossimo elemento invece di fermarsi
      }
      
      // Mappa i campi del database ai campi del frontend
      checklistItems.push({
        ...data,
        appointmentId: data.appointment_id,
        vehicleId: data.vehicle_id,
        itemName: data.item_name,
        itemCategory: data.item_category
      });
      
    } catch (error) {
      console.error(`❌ Errore generale per template ${template.item_name}:`, error);
      continue; // Continua con il prossimo elemento
    }
  }
  
  console.log(`✅ Creati ${checklistItems.length} elementi checklist per l'appuntamento ${appointmentId}`);
  return checklistItems;
};

export const getChecklistItemsByAppointmentId = async (appointmentId: string): Promise<ChecklistItem[]> => {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(item => ({
    ...item,
    appointmentId: item.appointment_id,
    vehicleId: item.vehicle_id,
    itemName: item.item_name,
    itemCategory: item.item_category
  }));
};

// ===== ACCEPTANCE PHASE COMPATIBILITY FUNCTIONS =====
// Queste funzioni mantengono la compatibilità con i componenti esistenti
// utilizzando il nuovo sistema work_sessions

export const getAcceptancePhaseByVehicleId = async (vehicleId: string): Promise<any | null> => {
  try {
    // Cerca una work_session per questo veicolo
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    if (!data || data.length === 0) return null;
    
    const sessionData = data[0]; // Prendi il primo elemento dall'array
    
    // Mappa i dati al formato AcceptancePhase
    return {
      id: sessionData.id,
      appointmentId: sessionData.appointment_id,
      vehicleId: sessionData.vehicle_id,
      mileage: sessionData.mileage,
      fuelLevel: sessionData.fuel_level,
      photos: sessionData.acceptance_photos || [],
      acceptanceDate: sessionData.created_at,
      acceptanceCompleted: sessionData.current_step > 1 || sessionData.completed,
      notes: ''
    };
  } catch (error) {
    // console.error('Errore nel recupero AcceptancePhase:', error);
    return null;
  }
};

export const createAcceptancePhase = async (acceptanceData: any): Promise<any> => {
  try {
    // Crea o aggiorna una work_session
    const workSessionData = {
      appointmentId: acceptanceData.appointmentId,
      vehicleId: acceptanceData.vehicleId,
      acceptancePhotos: acceptanceData.photos || [],
      sparePartsPhotos: [], // Campo richiesto
      fuelLevel: acceptanceData.fuelLevel,
      mileage: acceptanceData.mileage,
      currentStep: acceptanceData.acceptanceCompleted ? 2 : 1,
      completed: acceptanceData.acceptanceCompleted || false
    };
    
    const newSession = await createWorkSession(workSessionData);
    
    // Mappa la risposta al formato AcceptancePhase
    return {
      id: newSession.id,
      appointmentId: newSession.appointmentId,
      vehicleId: newSession.vehicleId,
      mileage: newSession.mileage,
      fuelLevel: newSession.fuelLevel,
      photos: newSession.acceptancePhotos || [],
      acceptanceDate: newSession.created_at,
      acceptanceCompleted: newSession.currentStep > 1 || newSession.completed,
      notes: ''
    };
  } catch (error) {
    // console.error('Errore nella creazione AcceptancePhase:', error);
    throw error;
  }
};

export const updateAcceptancePhase = async (id: string, updates: any): Promise<any> => {
  try {
    // Aggiorna la work_session
    const updateData: any = {};
    
    if (updates.photos !== undefined) updateData.acceptancePhotos = updates.photos;
    if (updates.fuelLevel !== undefined) updateData.fuelLevel = updates.fuelLevel;
    if (updates.mileage !== undefined) updateData.mileage = updates.mileage;
    if (updates.acceptanceCompleted !== undefined) {
      updateData.currentStep = updates.acceptanceCompleted ? 2 : 1;
      updateData.completed = updates.acceptanceCompleted;
    }
    
    const updatedSession = await updateWorkSession(id, updateData);
    
    // Mappa la risposta al formato AcceptancePhase
    return {
      id: updatedSession.id,
      appointmentId: updatedSession.appointmentId,
      vehicleId: updatedSession.vehicleId,
      mileage: updatedSession.mileage,
      fuelLevel: updatedSession.fuelLevel,
      photos: updatedSession.acceptancePhotos || [],
      acceptanceDate: updatedSession.created_at,
      acceptanceCompleted: updatedSession.currentStep > 1 || updatedSession.completed,
      notes: ''
    };
  } catch (error) {
    // console.error('Errore nell\'aggiornamento AcceptancePhase:', error);
    throw error;
  }
};

// ===== WORK PHASE COMPATIBILITY FUNCTIONS =====
// Queste funzioni mantengono la compatibilità con i componenti esistenti
// utilizzando il nuovo sistema work_sessions

export const getWorkPhaseByAppointmentId = async (appointmentId: string): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    
    // Mappa i dati al formato WorkPhase
    return {
      id: data.id,
      appointmentId: data.appointment_id,
      vehicleId: data.vehicle_id,
      sparePartPhotos: data.spare_parts_photos || [],
      spareParts: [], // Da implementare se necessario
      quoteId: null, // Da implementare se necessario
      workCompleted: data.completed,
      workDate: data.created_at,
      workNotes: data.descpart || '',
      notes: data.descpart || '',
      // 🔧 FIX: Aggiungo i campi delle note delle foto
      p1note: data.p1note || '',
      p2note: data.p2note || '',
      p3note: data.p3note || '',
      p4note: data.p4note || '',
      p5note: data.p5note || '',
      p6note: data.p6note || ''
    };
  } catch (error) {
    // console.error('Errore nel recupero WorkPhase per appointment:', error);
    return null;
  }
};

export const getWorkPhaseByVehicleId = async (vehicleId: string): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    if (!data || data.length === 0) return null;
    
    const sessionData = data[0]; // Prendi il primo elemento dall'array
    
    // Mappa i dati al formato WorkPhase
    return {
      id: sessionData.id,
      appointmentId: sessionData.appointment_id,
      vehicleId: sessionData.vehicle_id,
      sparePartPhotos: sessionData.spare_parts_photos || [],
      spareParts: [], // Da implementare se necessario
      quoteId: null, // Da implementare se necessario
      workCompleted: sessionData.completed,
      workDate: sessionData.created_at,
      workNotes: sessionData.descpart || '',
      notes: sessionData.descpart || '',
      // 🔧 FIX: Aggiungo i campi delle note delle foto
      p1note: sessionData.p1note || '',
      p2note: sessionData.p2note || '',
      p3note: sessionData.p3note || '',
      p4note: sessionData.p4note || '',
      p5note: sessionData.p5note || '',
      p6note: sessionData.p6note || ''
    };
  } catch (error) {
    // console.error('Errore nel recupero WorkPhase per veicolo:', error);
    return null;
  }
};

export const createWorkPhase = async (workPhaseData: any): Promise<any> => {
  try {
    const sessionData = {
      appointmentId: workPhaseData.appointmentId,
      vehicleId: workPhaseData.vehicleId,
      acceptancePhotos: [],
      sparePartsPhotos: workPhaseData.sparePartPhotos || [],
      currentStep: 2,
      completed: workPhaseData.workCompleted || false,
      descpart: workPhaseData.workNotes || workPhaseData.notes || '',
      p1note: workPhaseData.p1note || '',
      p2note: workPhaseData.p2note || '',
      p3note: workPhaseData.p3note || '',
      p4note: workPhaseData.p4note || '',
      p5note: workPhaseData.p5note || '',
      p6note: workPhaseData.p6note || ''
    };
    
    const newSession = await createWorkSession(sessionData);
    
    return {
      id: newSession.id,
      appointmentId: newSession.appointmentId,
      vehicleId: newSession.vehicleId,
      sparePartPhotos: newSession.sparePartsPhotos || [],
      spareParts: workPhaseData.spareParts || [],
      quoteId: workPhaseData.quoteId || null,
      workCompleted: newSession.completed,
      workDate: newSession.created_at,
      workNotes: newSession.descpart || '',
      notes: newSession.descpart || '',
      p1note: newSession.p1note || '',
      p2note: newSession.p2note || '',
      p3note: newSession.p3note || '',
      p4note: newSession.p4note || '',
      p5note: newSession.p5note || '',
      p6note: newSession.p6note || ''
    };
  } catch (error) {
    throw error;
  }
};

export const updateWorkPhase = async (id: string, updates: any): Promise<any> => {
  try {
    // Aggiorna la work_session
    const updateData: any = {};
    
    if (updates.sparePartPhotos !== undefined) updateData.sparePartsPhotos = updates.sparePartPhotos;
    if (updates.workCompleted !== undefined) {
      updateData.completed = updates.workCompleted;
      updateData.currentStep = updates.workCompleted ? 3 : 2;
    }
    if (updates.workNotes !== undefined || updates.notes !== undefined) {
      updateData.descpart = updates.workNotes || updates.notes || '';
    }
    // Aggiungi il supporto per le note delle foto
    if (updates.p1note !== undefined) updateData.p1note = updates.p1note;
    if (updates.p2note !== undefined) updateData.p2note = updates.p2note;
    if (updates.p3note !== undefined) updateData.p3note = updates.p3note;
    if (updates.p4note !== undefined) updateData.p4note = updates.p4note;
    if (updates.p5note !== undefined) updateData.p5note = updates.p5note;
    if (updates.p6note !== undefined) updateData.p6note = updates.p6note;
    
    const updatedSession = await updateWorkSession(id, updateData);
    
    // Mappa la risposta al formato WorkPhase
    return {
      id: updatedSession.id,
      appointmentId: updatedSession.appointmentId,
      vehicleId: updatedSession.vehicleId,
      sparePartPhotos: updatedSession.sparePartsPhotos || [],
      spareParts: updates.spareParts || [],
      quoteId: updates.quoteId || null,
      workCompleted: updatedSession.completed,
      workDate: updatedSession.created_at,
      workNotes: updatedSession.descpart || '',
      notes: updatedSession.descpart || '',
      // Aggiungi le note delle foto nella risposta
      p1note: updatedSession.p1note || '',
      p2note: updatedSession.p2note || '',
      p3note: updatedSession.p3note || '',
      p4note: updatedSession.p4note || '',
      p5note: updatedSession.p5note || '',
      p6note: updatedSession.p6note || ''
    };
  } catch (error) {
    // console.error('Errore nell\'aggiornamento WorkPhase:', error);
    throw error;
  }
};

export const getAppointmentsByClientId = async (clientId: string): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(appointment => ({
    id: appointment.id,
    clientId: appointment.client_id,
    clientName: appointment.client_name,
    phone: appointment.phone,
    plate: appointment.plate,
    model: appointment.model,
    date: appointment.date,
    time: appointment.time,
    duration: appointment.duration,
    status: appointment.status,
    quoteId: appointment.quote_id,
    quoteLaborHours: appointment.quote_labor_hours,
    notes: appointment.notes,
    partsOrdered: appointment.parts_ordered,
    services: [], // Campo non salvato nel database, array vuoto di default
    spareParts: undefined,
    totalPartsPrice: undefined,
    startHour: undefined,
    startMinute: undefined,
    endHour: undefined,
    endMinute: undefined,
    type: undefined
  }));
};

export const getClientByCodeOrEmail = async (identifier: string): Promise<Client | null> => {
  // Prima prova a cercare per ID (codice cliente)
  let { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', identifier)
    .single();
  
  if (!error && data) {
    // Trovato per ID, mappa i campi
    return {
      ...data,
      birthDate: data.birth_date,
      model: data.model,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined
    };
  }
  
  // Se non trovato per ID, prova per email
  ({ data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('email', identifier)
    .single());
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  // Mappa i campi del database ai campi del frontend
  return {
    ...data,
    birthDate: data.birth_date,
    model: data.model,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined
  };
};

// ===== WHATSAPP TEMPLATE FUNCTIONS =====

export const getAllWhatsappTemplates = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('idgil', { ascending: true })
    .order('created_at', { ascending: true }); // Fallback per template senza idgil
  
  if (error) throw error;
  return data || [];
};

export const createWhatsappTemplate = async (template: {
  title: string;
  content: string;
  category: string;
  idgil: number;
}): Promise<any> => {
  const user = getUser();
  
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .insert([{
      title: template.title,
      content: template.content,
      category: template.category,
      idgil: template.idgil,
      created_by: user?.username || 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (error) throw error;
  
  await registerDatabaseChange(
    'create',
    'whatsapp_template',
    data.id,
    {
      title: template.title,
      category: template.category,
      idgil: template.idgil,
      created_by: user?.username || 'unknown'
    }
  );
  
  return data;
};

export const updateWhatsappTemplate = async (id: string, updates: {
  title?: string;
  content?: string;
  category?: string;
  idgil?: number;
}): Promise<any> => {
  // Se stiamo aggiornando idgil, controlla se esiste già
  if (updates.idgil !== undefined) {
    // Trova il template con questo idgil
    const { data: existingTemplates, error: findError } = await supabase
      .from('whatsapp_templates')
      .select('id, idgil')
      .eq('idgil', updates.idgil)
      .neq('id', id); // Escludi il template che stiamo aggiornando
    
    if (findError) throw findError;
    
    if (existingTemplates && existingTemplates.length > 0) {
      const conflictTemplate = existingTemplates[0];
      
      // Ottieni l'idgil attuale del template che stiamo modificando
      const { data: currentTemplate, error: currentError } = await supabase
        .from('whatsapp_templates')
        .select('idgil')
        .eq('id', id)
        .single();
      
      if (currentError) throw currentError;
      
      const currentIdgil = currentTemplate.idgil;
      
      // SCAMBIO AUTOMATICO
      // Step 1: Imposta temporaneamente un ID molto alto per evitare conflitti
      const tempId = 9999;
      await supabase
        .from('whatsapp_templates')
        .update({ 
          idgil: tempId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conflictTemplate.id);
      
      // Step 2: Aggiorna il template principale con il nuovo ID
      await supabase
        .from('whatsapp_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      // Step 3: Assegna l'ID precedente al template in conflitto
      if (currentIdgil !== null && currentIdgil !== undefined) {
        await supabase
          .from('whatsapp_templates')
          .update({ 
            idgil: currentIdgil,
            updated_at: new Date().toISOString()
          })
          .eq('id', conflictTemplate.id);
      } else {
        // Se il template attuale non aveva un ID, trova il prossimo disponibile
        const { data: allTemplates } = await supabase
          .from('whatsapp_templates')
          .select('idgil')
          .not('idgil', 'is', null);
        
        const usedIds = (allTemplates || []).map(t => t.idgil);
        let nextId = 1;
        while (usedIds.includes(nextId)) {
          nextId++;
        }
        
        await supabase
          .from('whatsapp_templates')
          .update({ 
            idgil: nextId,
            updated_at: new Date().toISOString()
          })
          .eq('id', conflictTemplate.id);
      }
      
      console.log('✅ Scambio completato con successo!');
      
      // Registra il cambio
      await registerDatabaseChange(
        'update',
        'whatsapp_template',
        id,
        {
          action: 'id_swap',
          new_idgil: updates.idgil,
          swapped_with: conflictTemplate.id,
          previous_idgil: currentIdgil
        }
      );
      
    } else {
      console.log(`✅ ID ${updates.idgil} disponibile, aggiornamento normale`);
      
      // Aggiornamento normale senza conflitti
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      await registerDatabaseChange(
        'update',
        'whatsapp_template',
        id,
        {
          changes: Object.keys(updates).join(', ')
        }
      );
      
      return data;
    }
  } else {
    console.log('📝 Aggiornamento normale (non idgil)');
    
    // Aggiornamento normale senza idgil
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    await registerDatabaseChange(
      'update',
      'whatsapp_template',
      id,
      {
        changes: Object.keys(updates).join(', ')
      }
    );
    
    return data;
  }
  
  // Ritorna il template aggiornato
  const { data: finalData, error: finalError } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('id', id)
    .single();
  
  if (finalError) throw finalError;
  return finalData;
};

export const deleteWhatsappTemplate = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('whatsapp_templates')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  await registerDatabaseChange(
    'delete',
    'whatsapp_template',
    id,
    {}
  );
};

// Funzione per assegnare ID di ordinamento ai template esistenti
export const assignOrderIdsToExistingTemplates = async () => {
  try {
    // Ottieni tutti i template ordinati per data di creazione
    const { data: templates, error: fetchError } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (fetchError) throw fetchError;
    
    if (!templates || templates.length === 0) {
      return {
        success: true,
        updated: 0,
        message: 'Nessun template trovato nel database'
      };
    }
    
    let updatedCount = 0;
    
    // Assegna ID progressivi a tutti i template
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const orderId = i + 1;
      
      // Aggiorna solo se idgil è NULL o non esiste
      if (template.idgil === null || template.idgil === undefined) {
        // Aggiornamento diretto per evitare il sistema di scambio
        const { error: updateError } = await supabase
          .from('whatsapp_templates')
          .update({ 
            idgil: orderId,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id);
        
        if (!updateError) {
          updatedCount++;
        }
      }
    }
    
    return {
      success: true,
      updated: updatedCount,
      message: `Aggiornati ${updatedCount} template con ID di ordinamento`
    };
    
  } catch (error: any) {
    return {
      success: false,
      updated: 0,
      message: `Errore: ${error.message}`
    };
  }
};

// ===== WORK SESSION FUNCTIONS =====

// Funzioni di autenticazione per compatibilità
export const signInWithEmailAndPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const onAuthStateChanged = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
};

// Funzione di riparazione per compatibilità
export const repairAllQuotesClientNames = async () => {
  try {
    const quotes = await getAllQuotes();
    let repairedCount = 0;
    
    for (const quote of quotes) {
      if (quote.clientId && !quote.clientName) {
        const client = await getClientById(quote.clientId);
        if (client) {
          await updateQuote(quote.id, {
            clientName: `${client.name} ${client.surname}`.trim()
          });
          repairedCount++;
        }
      }
    }
    
    return {
      success: true,
      repairedCount,
      message: `Riparati ${repairedCount} preventivi`
    };
  } catch (error: any) {
    return {
      success: false,
      repairedCount: 0,
      message: `Errore durante la riparazione: ${error.message}`
    };
  }
};

// Funzione per aggiornare le informazioni cliente nei preventivi
export const updateQuoteClientInfo = async (quoteId: string, clientInfo: { clientName: string, phone: string, plate?: string }) => {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        client_name: clientInfo.clientName,
        phone: clientInfo.phone,
        plate: clientInfo.plate,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId);
    
    if (error) throw error;
    
    await registerDatabaseChange(
      'update',
      'quote',
      quoteId,
      {
        action: 'update_client_info',
        client_name: clientInfo.clientName,
        phone: clientInfo.phone
      }
    );
    
    return { success: true };
  } catch (error: any) {
    // console.error('Errore aggiornamento info cliente preventivo:', error);
    return { success: false, error: error.message };
  }
};

// Funzioni aggiuntive per compatibilità
export const getRecentClients = async (limit: number = 5): Promise<Client[]> => {
  const clients = await getAllClients();
  return clients.slice(0, limit);
};

// ===== SENT MESSAGES FUNCTIONS =====

/**
 * Recupera tutti i messaggi inviati
 */
export const getAllSentMessages = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('sent_messages')
    .select('message_id')
    .order('sent_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(item => item.message_id);
};

/**
 * Recupera tutti i messaggi inviati con dettagli completi
 */
export const getAllSentMessagesWithDetails = async (): Promise<Array<{message_id: string, sent_at: string}>> => {
  const { data, error } = await supabase
    .from('sent_messages')
    .select('message_id, sent_at')
    .order('sent_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

/**
 * Verifica se un messaggio è già stato inviato
 */
export const isMessageSent = async (messageId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('sent_messages')
    .select('id')
    .eq('message_id', messageId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw error;
  }
  
  return !!data;
};

/**
 * Segna un messaggio come inviato
 */
export const markMessageAsSent = async (messageId: string): Promise<void> => {
  const { error } = await supabase
    .from('sent_messages')
    .insert([{
      message_id: messageId,
      sent_at: new Date().toISOString()
    }]);
  
  if (error) {
    // Se il messaggio è già stato segnato come inviato, ignora l'errore
    if (error.code === '23505') { // unique_violation
      console.log(`⚠️ Messaggio ${messageId} già segnato come inviato`);
      return;
    }
    throw error;
  }
  
  console.log(`✅ Messaggio ${messageId} segnato come inviato`);
};

/**
 * Rimuove un messaggio dalla lista degli inviati (per annullare invio)
 */
export const unmarkMessageAsSent = async (messageId: string): Promise<void> => {
  const { error } = await supabase
    .from('sent_messages')
    .delete()
    .eq('message_id', messageId);
  
  if (error) throw error;
  
  console.log(`🔄 Messaggio ${messageId} rimosso dalla lista degli inviati`);
};

/**
 * Ottiene la data di invio di un messaggio
 */
export const getMessageSentDate = async (messageId: string): Promise<Date | null> => {
  const { data, error } = await supabase
    .from('sent_messages')
    .select('sent_at')
    .eq('message_id', messageId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data ? new Date(data.sent_at) : null;
};

/**
 * Pulisce i messaggi inviati più vecchi di X giorni
 */
export const cleanOldSentMessages = async (daysOld: number = 30): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const { data, error } = await supabase
    .from('sent_messages')
    .delete()
    .lt('sent_at', cutoffDate.toISOString())
    .select('id');
  
  if (error) throw error;
  
  const deletedCount = data?.length || 0;
  console.log(`🧹 Rimossi ${deletedCount} messaggi inviati più vecchi di ${daysOld} giorni`);
  
  return deletedCount;
};

// Funzione helper per registrare un cliente esistente in Supabase Auth
export const registerExistingClientInAuth = async (clientId: string): Promise<{ success: boolean, message: string }> => {
  try {
    // Ottieni i dati del cliente dal database
    const client = await getClientById(clientId);
    
    if (!client) {
      return { success: false, message: 'Cliente non trovato' };
    }
    
    if (!client.email || !client.password) {
      return { success: false, message: 'Cliente senza email o password - impossibile registrare in auth' };
    }
    
    // Registra il cliente in Supabase Auth direttamente
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: client.email,
      password: client.password,
      options: {
        data: {
          client_id: clientId,
          client_name: `${client.name} ${client.surname}`,
          user_type: 'client',
          phone: client.phone,
          plate: client.plate
        }
      }
    });
    
    if (authError) {
      // Se l'errore è "User already registered", non è un problema
      if (authError.message.includes('already registered') || 
          authError.message.includes('already exists') ||
          authError.message.includes('already been registered')) {
        return { success: true, message: 'Cliente già registrato in Supabase Auth' };
      }
      return { success: false, message: `Errore nella registrazione: ${authError.message}` };
    }
    
    return { success: true, message: 'Cliente registrato con successo in Supabase Auth' };
    
  } catch (error) {
    return { success: false, message: `Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` };
  }
};

// Funzione helper per registrare tutti i clienti esistenti che non sono ancora in auth
export const registerAllExistingClientsInAuth = async (): Promise<{ registered: number, errors: string[] }> => {
  const results = { registered: 0, errors: [] as string[] };
  
  try {
    const clients = await getAllClients();
    
    for (const client of clients) {
      if (client.email) {
        try {
          const result = await registerExistingClientInAuth(client.id);
          if (result.success) {
            results.registered++;
      } else {
            results.errors.push(`${client.name} ${client.surname}: ${result.message}`);
          }
          
          // Piccolo delay per evitare rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          results.errors.push(`${client.name} ${client.surname}: ${error.message}`);
        }
    } else {
        results.errors.push(`${client.name} ${client.surname}: nessuna email`);
      }
    }
    
    console.log(`Registrazione massiva completata: ${results.registered} clienti registrati, ${results.errors.length} errori`);
    return results;
  } catch (error: any) {
    console.error('Errore nella registrazione massiva dei clienti:', error);
    throw error;
  }
};

// Funzione per sincronizzare tutti gli appuntamenti completati con i loro preventivi
export const syncCompletedAppointmentsWithQuotes = async (): Promise<{ 
  updated: number, 
  skipped: number, 
  errors: string[] 
}> => {
  const results = { updated: 0, skipped: 0, errors: [] as string[] };
  
  try {
    console.log('🔄 Inizio sincronizzazione appuntamenti completati con preventivi...');
    
    // Ottieni tutti gli appuntamenti completati
    const allAppointments = await getAllAppointments();
    const completedAppointments = allAppointments.filter(app => app.status === 'completato');
    
    console.log(`📋 Trovati ${completedAppointments.length} appuntamenti completati`);
    
    for (const appointment of completedAppointments) {
      if (!appointment.quoteId) {
        results.skipped++;
        continue;
      }
      
      try {
        // Verifica lo stato del preventivo associato
        const quote = await getQuoteById(appointment.quoteId);
        
        if (!quote) {
          results.errors.push(`Preventivo ${appointment.quoteId} non trovato per appuntamento ${appointment.id}`);
          continue;
        }
        
        if (quote.status === 'completato') {
          results.skipped++;
          continue; // Già sincronizzato
        }
        
        // Aggiorna il preventivo come completato
        await updateQuote(appointment.quoteId, { status: 'completato' });
        
        console.log(`✅ Sincronizzato: Appuntamento ${appointment.id} → Preventivo ${appointment.quoteId}`);
        results.updated++;
      
      await registerDatabaseChange(
        'update',
          'quote',
          appointment.quoteId,
          {
            status_changed: 'completato',
            triggered_by: `bulk_sync_appointment_${appointment.id}`,
            auto_sync: true,
            sync_type: 'retroactive'
          }
        );
        
        // Piccolo delay per non sovraccaricare il database
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error: any) {
        const errorMsg = `Errore sincronizzazione appuntamento ${appointment.id}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    console.log(`🎉 Sincronizzazione completata: ${results.updated} aggiornati, ${results.skipped} saltati, ${results.errors.length} errori`);
    return results;
    
  } catch (error: any) {
    console.error('❌ Errore nella sincronizzazione massiva:', error);
    throw error;
  }
};

// Funzione per rimuovere duplicati nella checklist
export const removeDuplicateChecklistItems = async (appointmentId: string): Promise<void> => {
  try {
    console.log(`🧹 Iniziando rimozione duplicati per appuntamento ${appointmentId}...`);
    
    // Ottieni tutti gli elementi della checklist per questo appuntamento
    const { data: items, error } = await supabase
      .from('checklist_items')
    .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });
  
  if (error) throw error;
    if (!items || items.length === 0) {
      console.log('📋 Nessun elemento checklist trovato');
      return;
    }
    
    console.log(`📋 Trovati ${items.length} elementi checklist totali`);
    
    // Raggruppa per combinazione univoca di itemName + itemCategory
    const groupedItems = new Map<string, any[]>();
    
    for (const item of items) {
      const key = `${item.item_name}|${item.item_category}`;
      if (!groupedItems.has(key)) {
        groupedItems.set(key, []);
      }
      groupedItems.get(key)!.push(item);
    }
    
    // Identifica e rimuovi duplicati
    const itemsToDelete: string[] = [];
    let duplicatesFound = 0;
    
    groupedItems.forEach((group, key) => {
      if (group.length > 1) {
        console.log(`🔍 Trovati ${group.length} duplicati per "${key}"`);
        duplicatesFound += group.length - 1;
        
        // Mantieni il primo elemento (più vecchio) e segna gli altri per l'eliminazione
        const [keepItem, ...duplicateItems] = group;
        console.log(`✅ Mantengo: ${keepItem.id} (${keepItem.created_at})`);
        
        for (const duplicateItem of duplicateItems) {
          console.log(`❌ Elimino: ${duplicateItem.id} (${duplicateItem.created_at})`);
          itemsToDelete.push(duplicateItem.id);
        }
      }
    });
    
    if (itemsToDelete.length === 0) {
      console.log('✅ Nessun duplicato trovato');
      return;
    }
    
    // Elimina i duplicati dal database
    console.log(`🗑️ Eliminazione di ${itemsToDelete.length} duplicati...`);
    
    const { error: deleteError } = await supabase
      .from('checklist_items')
    .delete()
      .in('id', itemsToDelete);
    
    if (deleteError) throw deleteError;
    
    console.log(`✅ Rimossi ${duplicatesFound} duplicati dalla checklist dell'appuntamento ${appointmentId}`);
    console.log(`📊 Elementi rimanenti: ${items.length - itemsToDelete.length}`);
    
  } catch (error) {
    console.error('❌ Errore nella rimozione duplicati:', error);
    throw error;
  }
};

// Funzione per ottenere i log delle modifiche al database
export const getDbChanges = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('db_changes')
    .select('*')
    .order('timestamp', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

// Funzioni per gestire i prodotti ordinati
export const getOrderedParts = async () => {
  const { data, error } = await supabase
    .from('ordered_parts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Mappa i dati dal database (snake_case) al formato frontend (camelCase)
  return (data || []).map(item => ({
    id: item.id,
    quoteId: item.quote_id,
    appointmentId: item.appointment_id,
    code: item.code,
    description: item.description,
    unitPrice: item.unit_price,
    quantity: item.quantity,
    received: item.received,
    receivedAt: item.received_at,
    notes: item.notes,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
};

export const updateOrderedPartStatus = async (id: string, received: boolean) => {
  const { data, error } = await supabase
    .from('ordered_parts')
    .update({ 
      received,
      received_at: received ? new Date().toISOString() : null
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // Mappa i dati dal database (snake_case) al formato frontend (camelCase)
  return {
    id: data.id,
    quoteId: data.quote_id,
    appointmentId: data.appointment_id,
    code: data.code,
    description: data.description,
    unitPrice: data.unit_price,
    quantity: data.quantity,
    received: data.received,
    receivedAt: data.received_at,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

export const createOrderedPart = async (part: CreateOrderedPartInput) => {
  // Mappa i campi camelCase ai campi snake_case del database
  const partForDb = {
    id: uuidv4(),
    quote_id: part.quoteId,
    appointment_id: part.appointmentId,
    code: part.code,
    description: part.description,
    unit_price: part.unitPrice,
    quantity: part.quantity,
    received: part.received || false,
    received_at: part.receivedAt,
    notes: part.notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('ordered_parts')
    .insert([partForDb])
    .select()
    .single();
  
  if (error) throw error;
  
  // Mappa i dati dal database (snake_case) al formato frontend (camelCase)
  return {
    id: data.id,
    quoteId: data.quote_id,
    appointmentId: data.appointment_id,
    code: data.code,
    description: data.description,
    unitPrice: data.unit_price,
    quantity: data.quantity,
    received: data.received,
    receivedAt: data.received_at,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

// Funzione per creare prodotti ordinati da un preventivo
export const createOrderedPartsFromQuote = async (quoteId: string, appointmentId?: string) => {
  // Ottieni il preventivo con i suoi prodotti
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error('Preventivo non trovato');

  const orderedParts: CreateOrderedPartInput[] = [];

  // Aggiungi parti dal campo parts (retrocompatibilità)
  if (quote.parts && quote.parts.length > 0) {
    quote.parts.forEach(part => {
      orderedParts.push({
        quoteId: quoteId,
        appointmentId: appointmentId,
        code: part.code,
        description: part.description,
        unitPrice: part.price,
        quantity: part.quantity,
        received: false,
        receivedAt: null
      });
    });
  }

  // Aggiungi parti dal campo items (nuova struttura)
  if (quote.items && quote.items.length > 0) {
    quote.items.forEach(item => {
      if (item.parts && item.parts.length > 0) {
        item.parts.forEach(part => {
          orderedParts.push({
            quoteId: quoteId,
            appointmentId: appointmentId,
            code: part.code,
            description: part.name,
            unitPrice: part.unitPrice,
            quantity: part.quantity,
            received: false,
            receivedAt: null
          });
        });
      }
    });
  }

  // Inserisci tutti i prodotti ordinati
  if (orderedParts.length > 0) {
    // Mappa ogni prodotto ai campi snake_case del database
    const partsForDb = orderedParts.map(part => ({
      id: uuidv4(),
      quote_id: part.quoteId,
      appointment_id: part.appointmentId,
      code: part.code,
      description: part.description,
      unit_price: part.unitPrice,
      quantity: part.quantity,
      received: part.received || false,
      received_at: part.receivedAt,
      notes: part.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('ordered_parts')
      .insert(partsForDb)
      .select();
    
    if (error) throw error;
    
    // Mappa i dati dal database (snake_case) al formato frontend (camelCase)
    return (data || []).map(item => ({
      id: item.id,
      quoteId: item.quote_id,
      appointmentId: item.appointment_id,
      code: item.code,
      description: item.description,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      received: item.received,
      receivedAt: item.received_at,
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
  }

  return [];
};

// Funzione per sincronizzare manualmente tutti i clienti con i loro appuntamenti
export const syncAllClientsWithAppointments = async (): Promise<{
  totalClients: number;
  totalAppointmentsUpdated: number;
  clientsProcessed: number;
  errors: string[];
}> => {
  const result = {
    totalClients: 0,
    totalAppointmentsUpdated: 0,
    clientsProcessed: 0,
    errors: [] as string[]
  };

  try {
    console.log('🔄 Inizio sincronizzazione massiva clienti-appuntamenti...');
    
    // Ottieni tutti i clienti
    const allClients = await getAllClients();
    result.totalClients = allClients.length;
    
    console.log(`📋 Trovati ${allClients.length} clienti da processare`);
    
    for (const client of allClients) {
      try {
        // Per ogni cliente, sincronizza con i suoi appuntamenti
        const syncedCount = await syncClientDataWithAppointments(client.id, {
          name: client.name,
          surname: client.surname,
          phone: client.phone,
          plate: client.plate,
          model: client.model,
          vehicles: client.vehicles
        });
        
        result.totalAppointmentsUpdated += syncedCount;
        result.clientsProcessed++;
        
        if (syncedCount > 0) {
          console.log(`✅ Cliente ${client.name} ${client.surname}: ${syncedCount} appuntamenti sincronizzati`);
        }
        
        // Piccolo delay per non sovraccaricare il database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        const errorMsg = `Errore sincronizzazione cliente ${client.id} (${client.name} ${client.surname}): ${error.message}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    console.log(`🎉 Sincronizzazione massiva completata:`);
    console.log(`   • ${result.clientsProcessed}/${result.totalClients} clienti processati`);
    console.log(`   • ${result.totalAppointmentsUpdated} appuntamenti totali aggiornati`);
    console.log(`   • ${result.errors.length} errori`);
    
    // Registra il risultato della sincronizzazione massiva
    await registerDatabaseChange(
      'sync_bulk',
      'clients_appointments',
      'all',
      {
        total_clients: result.totalClients,
        clients_processed: result.clientsProcessed,
        appointments_updated: result.totalAppointmentsUpdated,
        errors_count: result.errors.length,
        success_rate: `${((result.clientsProcessed / result.totalClients) * 100).toFixed(1)}%`
      }
    );
    
    return result;
    
  } catch (error: any) {
    console.error('❌ Errore nella sincronizzazione massiva:', error);
    result.errors.push(`Errore generale: ${error.message}`);
    return result;
  }
};