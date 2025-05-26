import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, push, remove, update, query, orderByChild, limitToLast, equalTo } from 'firebase/database';
import { Client, Appointment, Quote, ServiceType, QuoteItem, Request } from './schema';
import { v4 as uuidv4 } from 'uuid';

// Variabile inizializzate solo dopo che Firebase è inizializzato
let database: any;

// Funzione per ottenere l'utente corrente
const getUser = (): { username: string } | null => {
  try {
    const userString = localStorage.getItem('current_user');
    if (userString) {
      return JSON.parse(userString);
    }
    return null;
  } catch (error) {
    console.error('Errore nel recupero utente:', error);
    return null;
  }
};

// Funzione per ottenere l'identità dell'utente corrente
export const getCurrentUserIdentity = async (): Promise<Record<string, any>> => {
  try {
    // Import dinamico per evitare dipendenze circolari
    const authServiceModule = await import('../client/src/services/authService');
    const { authService } = authServiceModule;
    const identityInfo = await authService.getIdentityInfo();
    const user = authService.getCurrentUser();
    
    return {
      username: user?.username || 'sconosciuto',
      fingerprint: identityInfo.fingerprint,
      ip: identityInfo.ip,
      platform: identityInfo.deviceInfo?.platform || 'sconosciuto',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn("Impossibile ottenere l'identità dell'utente:", error);
    return {
      username: 'utente non identificato',
      fingerprint: 'sconosciuto',
      ip: 'sconosciuto', 
      platform: 'sconosciuto',
      timestamp: new Date().toISOString()
    };
  }
};

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
database = getDatabase(app);

// Firebase references
const clientsRef = ref(database, 'clients');
const appointmentsRef = ref(database, 'appointments');
const countersRef = ref(database, 'counters');
const quotesRef = ref(database, 'quotes');
const serviceTypesRef = ref(database, 'serviceTypes');
const dbChangesRef = ref(database, 'db_changes');

// Miglioro la funzione ensureDbChangesNodeExists per essere più robusta e risolvere problemi di inizializzazione
export const ensureDbChangesNodeExists = async (): Promise<boolean> => {
  console.log('Verifica del nodo db_changes...');
  
  try {
    // Verifica che il database sia inizializzato
    if (!database) {
      console.error('ERRORE: Database non inizializzato durante la verifica di db_changes!');
      throw new Error('Database non inizializzato');
    }
    
    // Crea un riferimento al nodo db_changes
    const dbChangesRef = ref(database, 'db_changes');
    
    // Verifica se il nodo esiste
    const snapshot = await get(dbChangesRef);
    
    if (!snapshot.exists()) {
      console.log('Nodo db_changes non esiste, creazione in corso...');
      
      // Crea una modifica di sistema iniziale per garantire che il nodo esista
      const initialChange = {
        timestamp: new Date().toISOString(),
        actionType: 'create',
        entityType: 'system',
        entityId: 'system',
        details: {
          description: 'Caricamento dati iniziale',
          inizializzato: true,
          version: '1.0'
        },
        user: {
          username: 'sistema',
          fingerprint: 'sistema',
          ip: '127.0.0.1',
          platform: 'sistema'
        },
        ipAddress: '127.0.0.1',
        deviceFingerprint: 'sistema',
        platform: 'sistema'
      };
      
      // Usa un ID fisso per la modifica di inizializzazione
      const initialChangeRef = ref(database, 'db_changes/system_init');
      await set(initialChangeRef, initialChange);
      
      // Verifica che l'inizializzazione sia avvenuta correttamente
      const verifySnapshot = await get(dbChangesRef);
      const success = verifySnapshot.exists();
      console.log('Nodo db_changes ' + (success ? 'creato con successo' : 'NON creato!'));
      
      // Se l'inizializzazione è avvenuta, crea altri nodi di test per garantire che il nodo sia utilizzabile
      if (success) {
        try {
          console.log('Creazione di modifiche di test per verificare la funzionalità...');
          const testChangeRef = ref(database, 'db_changes/system_test');
          await set(testChangeRef, {
            ...initialChange,
            timestamp: new Date().toISOString(),
            details: {
              description: 'Test funzionalità nodo db_changes',
              test: true
            }
          });
          console.log('Modifica di test creata con successo');
        } catch (testError) {
          console.error('Errore durante la creazione della modifica di test:', testError);
        }
      }
      
      return success;
    } else {
      console.log('Nodo db_changes esiste già');
      return true;
    }
  } catch (error) {
    console.error('Errore durante la verifica/creazione del nodo db_changes:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
};

// Esegui all'inizializzazione
ensureDbChangesNodeExists().catch(error => {
  console.error('Errore durante l\'inizializzazione del nodo db_changes:', error);
});

// Migliorata per tracciare solo i campi realmente modificati
export const registerDatabaseChange = async (
  actionType: 'create' | 'update' | 'delete', 
  entityType: 'client' | 'quote' | 'appointment', 
  entityId: string, 
  details: Record<string, any>,
  oldValues?: Record<string, any> // Aggiungo il parametro per i valori precedenti
): Promise<boolean> => {
  try {
    // Ottengo informazioni utente e dispositivo
    const { fingerprint, ip, platform } = await getCurrentUserIdentity();
    const user = getUser();
    
    // Preparo i dati per il log
    const timestamp = new Date().toISOString();
    const changeId = `${actionType}-${entityType}-${entityId}-${Date.now()}`;
    
    // Determino quali campi sono stati effettivamente modificati
    let changedFields: string[] = [];
    
    if (actionType === 'update' && oldValues) {
      // Se è un aggiornamento e abbiamo i valori precedenti, confrontiamo
      changedFields = Object.keys(details).filter(key => {
        // Confronta solo se il campo esiste nei valori precedenti
        if (oldValues[key] !== undefined) {
          // Converti tutto in stringhe per un confronto più sicuro
          const oldValue = String(oldValues[key]);
          const newValue = String(details[key]);
          return oldValue !== newValue;
        }
        return true; // Se non c'era prima, è nuovo
      });
    } else if (actionType === 'create') {
      // Per una creazione, consideriamo tutti i campi come "modificati"
      changedFields = Object.keys(details);
    } else if (actionType === 'delete') {
      // Per un'eliminazione, non ci sono campi specifici da tracciare
      changedFields = ['Eliminazione completa'];
    } else {
      // Se non abbiamo informazioni precise, usiamo i campi forniti
      changedFields = Object.keys(details);
    }
    
    // Includi sempre i campi specificati nei dettagli
    if (details.changes) {
      changedFields = details.changes.split(',').map((f: string) => f.trim());
    }
    
    // Prepara i dati da salvare
    const change = {
      timestamp,
      actionType,
      entityType,
      entityId,
      details: {
        ...details,
        changes: changedFields.join(', ')
      },
      user: {
        username: user?.username || 'unknown',
        fingerprint,
        ip,
        platform,
        timestamp
      },
      ipAddress: ip,
      deviceFingerprint: fingerprint,
      platform
    };
    
    // Salva il cambiamento nel database
    const database = getDatabase();
    const changeRef = ref(database, `db_changes/${changeId}`);
    await set(changeRef, change);
    
    console.log(`[DB] Registrato cambiamento ${actionType} per ${entityType} ${entityId}`);
    return true;
  } catch (error) {
    console.error(`[DB] Errore registrazione cambiamento: ${error}`);
    return false;
  }
};

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
  
  // Registra la creazione nel database
  await registerDatabaseChange(
    'create',
    'client',
    clientId,
    {
      clientName: `${newClient.name} ${newClient.surname}`,
      phone: newClient.phone
    }
  );
  
  return newClient;
};

export const updateClient = async (clientId: string, updates: Partial<Client>): Promise<void> => {
  // Ottieni il cliente prima dell'aggiornamento per confronto
  const clientBefore = await getClientById(clientId);
  
  // Aggiorna il cliente
  const clientRef = ref(database, `clients/${clientId}`);
  
  // Verifica esistenza prima di procedere
  const snapshot = await get(clientRef);
  if (!snapshot.exists()) {
    throw new Error(`Cliente con ID ${clientId} non trovato`);
  }
  
  // Aggiorna solo i campi specificati in updates
  await update(clientRef, updates);
  
  // Registra la modifica
  await registerDatabaseChange(
    'update',
    'client',
    clientId,
    {
      clientName: clientBefore?.name ? `${clientBefore.name} ${clientBefore.surname}` : 'sconosciuto',
      changes: Object.keys(updates).join(', ')
    },
    clientBefore ? { ...clientBefore } : {} // Assicuriamo di passare un oggetto anche se clientBefore è null
  );
};

export const deleteClient = async (id: string): Promise<void> => {
  // Ottieni i dati del cliente prima di eliminarlo
  const client = await getClientById(id);
  
  // Elimina il cliente
  await remove(ref(database, `clients/${id}`));
  
  // Registra l'eliminazione nel database
  if (client) {
    await registerDatabaseChange(
      'delete',
      'client',
      id,
      {
        clientName: `${client.name} ${client.surname}`,
        phone: client.phone
      }
    );
  }
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
  
  // Registra la creazione nel database
  await registerDatabaseChange(
    'create',
    'appointment',
    appointmentId,
    {
      clientName: newAppointment.clientName,
      date: newAppointment.date,
      time: newAppointment.time,
      quoteId: newAppointment.quoteId
    }
  );
  
  return newAppointment;
};

export const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<void> => {
  // Log per debug
  console.log(`FIREBASE - Debug updateAppointment ID ${id}:`, {
    durataInviata: updates.duration,
    tipoDurata: typeof updates.duration
  });
  
  // Crea un riferimento esplicito all'appuntamento nel database
  const appointmentRef = ref(database, `appointments/${id}`);
  
  try {
    // Aggiungi informazioni su chi ha modificato l'appuntamento
    const userIdentity = await getCurrentUserIdentity();
    const updatedData = {
      ...updates,
      lastModifiedBy: userIdentity,
      lastModifiedAt: new Date().toISOString()
    };
    
    // APPROCCIO MOLTO DIRETTO: Prima recuperiamo l'intero oggetto, lo modifichiamo e poi lo risalviamo completamente
    const snapshot = await get(appointmentRef);
    if (snapshot.exists()) {
      // Ottieni l'oggetto completo
      const currentAppointment = snapshot.val() as Appointment;
      
      console.log(`FIREBASE - Valori attuali per appuntamento ${id}:`, {
        durata: currentAppointment.duration,
        tipo: typeof currentAppointment.duration,
        qta: currentAppointment.quoteLaborHours
      });
      
      // Se stiamo aggiornando la durata, forziamo la conversione in numero
      if (updates.duration !== undefined) {
        // Converti esplicitamente in numero
        let numericDuration = typeof updates.duration === 'string' 
          ? parseFloat(updates.duration) 
          : Number(updates.duration);
        
        // Assicuriamoci che sia un numero valido
        if (isNaN(numericDuration)) numericDuration = 1;
          
        console.log(`FIREBASE - Impostazione diretta duration = ${numericDuration}`);
        
        // Imposta direttamente la durata
        currentAppointment.duration = numericDuration;
        
        // Sincronizza anche quoteLaborHours
        if (updates.quoteLaborHours !== undefined) {
          let numericLabor = typeof updates.quoteLaborHours === 'string'
            ? parseFloat(updates.quoteLaborHours)
            : Number(updates.quoteLaborHours);
          
          if (isNaN(numericLabor)) numericLabor = numericDuration;
          currentAppointment.quoteLaborHours = numericLabor;
        } else {
          // Se non è specificato, usa lo stesso valore della durata
          currentAppointment.quoteLaborHours = numericDuration;
        }
      }
      
      // Aggiorna tutte le altre proprietà
      Object.keys(updates).forEach(key => {
        if (key !== 'duration' && key !== 'quoteLaborHours' && key in currentAppointment) {
          // Aggiorna solo se la chiave esiste nell'oggetto originale
          // @ts-ignore: chiave dinamica
          currentAppointment[key] = updates[key];
        }
      });
      
      // Salva l'intero oggetto aggiornato
      await set(appointmentRef, currentAppointment);
      
      // Registra la modifica al database
      await registerDatabaseChange(
        'update',
        'appointment',
        id,
        {
          clientName: currentAppointment.clientName,
          changes: Object.keys(updates).join(', ')
        },
        currentAppointment
      );
      
      // Verifica immediata che l'aggiornamento sia avvenuto
      const verifySnapshot = await get(appointmentRef);
      if (verifySnapshot.exists()) {
        const verifiedData = verifySnapshot.val();
        console.log(`FIREBASE - Post-aggiornamento verificato:`, {
          nuovaDurata: verifiedData.duration,
          tipoDurata: typeof verifiedData.duration
        });
      }
    } else {
      console.error(`FIREBASE - Appuntamento ${id} non trovato!`);
      throw new Error(`Appointment with ID ${id} not found`);
    }
  } catch (error) {
    console.error(`FIREBASE - Errore durante l'aggiornamento:`, error);
    throw error;
  }
};

export const deleteAppointment = async (id: string): Promise<void> => {
  // Ottieni i dati dell'appuntamento prima di eliminarlo
  const appointment = await getAppointmentById(id);
  
  // Elimina l'appuntamento
  await remove(ref(database, `appointments/${id}`));
  
  // IMPORTANTE: Se l'appuntamento aveva un preventivo associato, 
  // cambia lo stato del preventivo da "accettato" a "inviato"
  if (appointment && appointment.quoteId) {
    try {
      const quote = await getQuoteById(appointment.quoteId);
      if (quote && quote.status === "accettato") {
        console.log(`Cambiando stato preventivo ${appointment.quoteId} da "accettato" a "inviato" dopo eliminazione appuntamento`);
        await updateQuote(appointment.quoteId, { status: "inviato" });
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento dello stato del preventivo:", error);
    }
  }
  
  // Registra l'eliminazione nel database
  if (appointment) {
    await registerDatabaseChange(
      'delete',
      'appointment',
      id,
      {
        clientName: appointment.clientName,
        date: appointment.date,
        time: appointment.time,
        quoteStatusChanged: appointment.quoteId ? "accettato → inviato" : "nessun preventivo associato"
      }
    );
  }
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
  
  // Registra la creazione nel database
  await registerDatabaseChange(
    'create',
    'quote',
    quoteId,
    {
      clientName: calculatedQuote.clientName,
      clientId: calculatedQuote.clientId,
      totalPrice: calculatedQuote.totalPrice || calculatedQuote.total
    }
  );
  
  return calculatedQuote;
};

export const updateQuote = async (id: string, updates: Partial<Quote>): Promise<Quote> => {
  // Log per debug
  console.log(`FIREBASE - Debug updateQuote ID ${id}:`, {
    aggiornamenti: updates
  });
  
  const quoteRef = ref(database, `quotes/${id}`);
  
  try {
    // Approccio diretto: prima recuperiamo l'intero oggetto, lo modifichiamo e poi lo risalviamo completamente
    const snapshot = await get(quoteRef);
    
    if (!snapshot.exists()) {
      throw new Error(`Preventivo con ID ${id} non trovato`);
    }
    
    // Ottieni l'oggetto completo
    const currentQuote = snapshot.val() as Quote;
    
    console.log(`FIREBASE - Valori attuali per preventivo ${id}:`, {
      clientName: currentQuote.clientName,
      phone: currentQuote.phone
    });
    
    // Aggiorna tutte le proprietà
    Object.keys(updates).forEach(key => {
      if (key in currentQuote) {
        // Aggiorna solo se la chiave esiste nell'oggetto originale
        // @ts-ignore: chiave dinamica
        currentQuote[key] = updates[key];
      }
    });
    
    // Ricalcola i totali
    const calculatedQuote = calculateQuoteTotals(currentQuote);
    
    // Salva l'intero oggetto aggiornato
    await set(quoteRef, calculatedQuote);
    
    // Registra la modifica al database
    await registerDatabaseChange(
      'update',
      'quote',
      id,
      {
        clientName: calculatedQuote.clientName,
        changes: Object.keys(updates).join(', ')
      },
      currentQuote
    );
    
    // Verifica immediata che l'aggiornamento sia avvenuto
    const verifySnapshot = await get(quoteRef);
    if (verifySnapshot.exists()) {
      const verifiedData = verifySnapshot.val();
      console.log(`FIREBASE - Post-aggiornamento preventivo verificato:`, {
        clientName: verifiedData.clientName,
        phone: verifiedData.phone
      });
    }
    
    return calculatedQuote;
  } catch (error) {
    console.error(`FIREBASE - Errore durante l'aggiornamento del preventivo:`, error);
    throw error;
  }
};

export const deleteQuote = async (id: string): Promise<void> => {
  // Ottieni i dati del preventivo prima di eliminarlo
  const quote = await getQuoteById(id);
  
  // Elimina il preventivo
  await remove(ref(database, `quotes/${id}`));
  
  // Registra l'eliminazione nel database
  if (quote) {
    await registerDatabaseChange(
      'delete',
      'quote',
      id,
      {
        clientName: quote.clientName,
        clientId: quote.clientId
      }
    );
  }
};

// Funzione speciale per aggiornare SOLO i dati del cliente nei preventivi
// senza ricalcolare i totali o modificare altri dati
export const updateQuoteClientInfo = async (quoteId: string, clientInfo: { clientName: string; phone: string; plate: string }): Promise<void> => {
  const quoteRef = ref(database, `quotes/${quoteId}`);
  
  try {
    // Recupera il preventivo esistente per verifica
    const snapshot = await get(quoteRef);
    if (!snapshot.exists()) {
      throw new Error(`Preventivo con ID ${quoteId} non trovato`);
    }
    
    const currentQuote = snapshot.val();
    console.log(`FIREBASE - Prima dell'aggiornamento: preventivo ${quoteId}`, {
      clientNameAttuale: currentQuote.clientName,
      clientNameNuovo: clientInfo.clientName,
      phoneAttuale: currentQuote.phone,
      phoneNuovo: clientInfo.phone,
      targaAttuale: currentQuote.plate,
      targaNuova: clientInfo.plate
    });
    
    // Aggiorna direttamente SOLO i campi del cliente
    await update(quoteRef, {
      clientName: clientInfo.clientName,
      phone: clientInfo.phone,
      plate: clientInfo.plate
    });
    
    // Verifica che l'aggiornamento sia avvenuto correttamente
    const verifySnapshot = await get(quoteRef);
    if (verifySnapshot.exists()) {
      const updatedQuote = verifySnapshot.val();
      console.log(`FIREBASE - VERIFICA post-aggiornamento: preventivo ${quoteId}`, {
        clientNameAggiornato: updatedQuote.clientName,
        phoneAggiornato: updatedQuote.phone,
        plateAggiornata: updatedQuote.plate,
        aggiornamentoCorretto: 
          updatedQuote.clientName === clientInfo.clientName && 
          updatedQuote.phone === clientInfo.phone &&
          updatedQuote.plate === clientInfo.plate
      });
      
      if (updatedQuote.clientName !== clientInfo.clientName || 
          updatedQuote.phone !== clientInfo.phone ||
          updatedQuote.plate !== clientInfo.plate) {
        console.error(`ERRORE: L'aggiornamento non è stato applicato correttamente al preventivo ${quoteId}`);
      } else {
        console.log(`SUCCESSO: Dati cliente aggiornati nel preventivo ${quoteId}`);
      }
    }
  } catch (error) {
    console.error(`Errore nell'aggiornamento dei dati cliente nel preventivo ${quoteId}:`, error);
    throw error;
  }
};

// Helper function to calculate item total (servizio)
function calculateItemTotal(item: QuoteItem): number {
  // Per i servizi, il totale è solo il costo dei ricambi
  return item.parts?.reduce((sum, part) => {
    if (!part) return sum;
    // Se finalPrice non è definito, calcolalo
    const partTotal = part.finalPrice ?? (part.unitPrice * part.quantity);
    return sum + partTotal;
  }, 0) ?? 0;
}

// Helper function to calculate quote totals
export const calculateQuoteTotals = (quote: Quote): Quote => {
  console.log("calculateQuoteTotals chiamato per il preventivo", quote.id || "nuovo");
  
  // Assicuriamoci che quotes.items esista
  if (!quote.items || !Array.isArray(quote.items)) {
    console.warn("Il preventivo non ha un array 'items' valido, utilizzerò i dati disponibili");
    quote.items = [];
  }
  
  // Calcola i totali per ogni servizio includendo SOLO i ricambi, NON la manodopera
  const items = quote.items.map(item => {
    // Assicuriamoci che item.parts esista
    if (!item.parts || !Array.isArray(item.parts)) {
      console.warn(`Servizio ${item.serviceType.name} senza parti`);
      item.parts = [];
    }
    
    // Calcola il totale dei ricambi per questo servizio
    const partsTotal = item.parts.reduce((sum, part) => {
      if (!part) return sum;
      // Assicuriamoci che finalPrice sia corretto (prezzo unitario × quantità)
      const unitPrice = part.unitPrice || 0;
      const quantity = part.quantity || 1;
      const partPrice = unitPrice * quantity;
      // Aggiorna finalPrice
      part.finalPrice = partPrice;
      return sum + partPrice;
    }, 0);
    
    // Importante: il totalPrice dell'item è SOLO il costo dei ricambi
    // La manodopera verrà calcolata separatamente e mostrata alla fine
    
    // Log per debug
    console.log(`Servizio: ${item.serviceType.name}`, {
      ricambi: partsTotal.toFixed(2) + '€'
    });
    
    return {
      ...item,
      totalPrice: partsTotal // Solo i ricambi, senza manodopera
    };
  });
  
  // Calcola subtotale dei ricambi (somma di tutti i servizi)
  const partsSubtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  
  // Calcola la manodopera totale per tutti i servizi
  const servicesLabor = items.reduce((sum, item) => {
    const laborPrice = parseFloat(item.laborPrice?.toString() || '0');
    const laborHours = parseFloat(item.laborHours?.toString() || '0');
    const serviceLabor = (laborPrice > 0 && laborHours > 0) 
      ? (laborHours * quote.laborPrice) 
      : 0;
    return sum + serviceLabor;
  }, 0);
  
  // Calcola la manodopera aggiuntiva (a livello preventivo)
  const additionalLabor = quote.laborHours && quote.laborHours > 0 && quote.laborPrice > 0
    ? (quote.laborPrice * quote.laborHours)
    : 0;
    
  // Manodopera totale (servizi + aggiuntiva)
  const totalLabor = servicesLabor + additionalLabor;
  
  // Log per debug
  console.log("Calcolo manodopera:", {
    tariffaOraria: quote.laborPrice + '€/h',
    manodoperaServizi: servicesLabor.toFixed(2) + '€',
    manodoperaAggiuntiva: additionalLabor.toFixed(2) + '€',
    manodoperaTotale: totalLabor.toFixed(2) + '€'
  });
  
  // Calcola il subtotale complessivo (ricambi + manodopera totale)
  const subtotal = partsSubtotal + totalLabor;
  
  // Calcola l'IVA
  const taxRate = quote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  
  // Calcola il totale
  const total = subtotal + taxAmount;
  
  // Log finale dei totali
  console.log("TOTALI FINALI:", {
    subtotaleRicambi: partsSubtotal.toFixed(2) + '€',
    manodoperaTotale: totalLabor.toFixed(2) + '€',
    subtotale: subtotal.toFixed(2) + '€',
    iva: taxAmount.toFixed(2) + '€',
    totale: total.toFixed(2) + '€'
  });
  
  // Utilizziamo un cast per aggirare l'errore del linter poiché i campi custom 
  // partsSubtotal e laborTotal non sono definiti nell'interfaccia Quote standard
  return {
    ...quote,
    items,
    subtotal,
    taxAmount,
    total,
    // Aggiungiamo campi custom per memorizzare i subtotali separati
    partsSubtotal,
    laborTotal: totalLabor
  } as Quote; // Cast esplicito per evitare errori del linter
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

// Funzione di utilità per riparare tutti i preventivi esistenti
export const repairAllQuotesClientNames = async (): Promise<{ fixed: number, total: number }> => {
  console.log("Avvio riparazione preventivi...");
  const snapshot = await get(quotesRef);
  
  if (!snapshot.exists()) {
    console.log("Nessun preventivo trovato.");
    return { fixed: 0, total: 0 };
  }
  
  const quotes = Object.values(snapshot.val() as Record<string, Quote>);
  console.log(`Trovati ${quotes.length} preventivi da controllare.`);
  
  let fixedCount = 0;
  
  // Per ogni preventivo, controlla se il clientId esiste e aggiorna i dati del cliente
  for (const quote of quotes) {
    try {
      // Controlla se esiste un cliente associato
      if (!quote.clientId) {
        console.log(`Preventivo ${quote.id}: Nessun clientId associato.`);
        continue;
      }
      
      // Ottieni i dati del cliente
      const client = await getClientById(quote.clientId);
      
      if (!client) {
        console.log(`Preventivo ${quote.id}: Cliente con ID ${quote.clientId} non trovato.`);
        continue;
      }
      
      // Formatta il nome cliente correttamente
      const formattedClientName = `${client.name} ${client.surname}`.trim();
      
      // Controlla se il nome è diverso
      if (quote.clientName !== formattedClientName || quote.phone !== client.phone) {
        console.log(
          `Preventivo ${quote.id}: Riparazione necessaria.`,
          `Nome attuale: "${quote.clientName}"`,
          `Nome corretto: "${formattedClientName}"`
        );
        
        // Aggiorna il preventivo
        await updateQuoteClientInfo(quote.id, {
          clientName: formattedClientName,
          phone: client.phone,
          plate: client.plate || ""
        });
        
        fixedCount++;
        console.log(`Preventivo ${quote.id}: Riparazione completata.`);
      }
    } catch (error) {
      console.error(`Errore durante la riparazione del preventivo ${quote.id}:`, error);
    }
  }
  
  console.log(`Riparazione completata. ${fixedCount}/${quotes.length} preventivi aggiornati.`);
  return { fixed: fixedCount, total: quotes.length };
};

// Funzione per unire più preventivi in uno nuovo
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
      const quoteRef = ref(database, `quotes/${id}`);
      const snapshot = await get(quoteRef);
      
      if (!snapshot.exists()) {
        console.error(`Preventivo con ID ${id} non trovato`);
        return null;
      }
      
      quotes.push(snapshot.val() as Quote);
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
    // Usando any per evitare gli errori di TypeScript
    const newQuote: any = {
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
      taxRate: quotes[0].taxRate || 22
    };
    
    // Calcolo manuale dei totali:
    
    // 1. Subtotale ricambi
    const partsSubtotal = allItems.reduce((sum, item) => {
      return sum + (Array.isArray(item.parts) 
        ? item.parts.reduce((s: number, part: any) => s + (part.finalPrice || (part.unitPrice * part.quantity) || 0), 0)
        : 0);
    }, 0);
    
    // 2. Totale manodopera (costo orario * ore totali)
    const laborTotal = quotes[0].laborPrice * totalLaborHours;
    
    // 3. Subtotale complessivo (ricambi + manodopera)
    const subtotal = parseFloat(partsSubtotal.toFixed(2)) + parseFloat(laborTotal.toFixed(2));
    
    // 4. Calcolo IVA
    const taxRate = quotes[0].taxRate || 22;
    const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
    
    // 5. Totale finale
    const total = parseFloat((subtotal + taxAmount).toFixed(2));
    
    console.log(`Calcolo totali per il preventivo unificato:`, {
      ricambi: partsSubtotal.toFixed(2) + '€',
      manodopera: laborTotal.toFixed(2) + '€',
      subtotale: subtotal.toFixed(2) + '€',
      iva: taxAmount.toFixed(2) + '€',
      totale: total.toFixed(2) + '€'
    });
    
    // Imposta i totali calcolati nel preventivo
    newQuote.partsSubtotal = parseFloat(partsSubtotal.toFixed(2));
    newQuote.laborTotal = parseFloat(laborTotal.toFixed(2));
    newQuote.subtotal = parseFloat(subtotal.toFixed(2));
    newQuote.taxAmount = parseFloat(taxAmount.toFixed(2));
    newQuote.total = total;
    newQuote.totalPrice = total;
    
    // Forza arrotondamento a due decimali per garantire consistenza
    // e prevenire valori come 356.0099999 che potrebbero essere visualizzati come 356.01
    newQuote.total = parseFloat(newQuote.total.toFixed(2));
    newQuote.totalPrice = parseFloat(newQuote.totalPrice.toFixed(2));
    
    // Stampa finale per conferma
    console.log(`TOTALE FINALE calcolato e pronto per salvataggio: ${newQuote.total}€ (${newQuote.totalPrice}€)`);
    
    // Salva il nuovo preventivo
    const createdQuote = await createQuote(newQuote);
    
    // Stampa di verifica dopo il salvataggio
    console.log(`Preventivo unificato ${createdQuote.id} salvato con successo. TOTALE: ${createdQuote.total}€`);
    
    // Elimina i preventivi originali
    for (const id of quoteIds) {
      try {
        // Per ogni preventivo, troviamo gli appuntamenti collegati e aggiorniamo i riferimenti
        const allAppointments = await getAllAppointments();
        const linkedAppointments = allAppointments.filter(app => app.quoteId === id);
        
        // Aggiorna gli appuntamenti collegati per usare il nuovo preventivo
        for (const app of linkedAppointments) {
          await updateAppointment(app.id, {
            quoteId: createdQuote.id,
            quoteLaborHours: totalLaborHours
          });
          console.log(`Appuntamento ${app.id} aggiornato per usare il nuovo preventivo ${createdQuote.id}`);
        }
        
        // Elimina il preventivo originale
        await deleteQuote(id);
        console.log(`Preventivo originale ${id} eliminato dopo unione`);
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

// Request functions
export const getAllRequests = async (): Promise<Request[]> => {
  const requestsRef = ref(database, 'requests');
  const snapshot = await get(requestsRef);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val() as Record<string, Request>);
};

export const getRequestById = async (id: string): Promise<Request | null> => {
  const requestRef = ref(database, `requests/${id}`);
  const snapshot = await get(requestRef);
  return snapshot.exists() ? snapshot.val() as Request : null;
};

export const createRequest = async (request: Omit<Request, 'id'>): Promise<Request> => {
  // Get next request ID
  const counterSnapshot = await get(ref(database, 'counters/requestId'));
  const nextId = (counterSnapshot.exists() ? counterSnapshot.val() : 0) + 1;
  
  // Format request ID with leading zeros
  const requestId = `RQ${nextId.toString().padStart(3, '0')}`;
  
  const newRequest: Request = {
    ...request,
    id: requestId,
    createdAt: Date.now()
  };
  
  // Save request and update counter
  await set(ref(database, `requests/${requestId}`), newRequest);
  await set(ref(database, 'counters/requestId'), nextId);
  
  // Registra la creazione nel database
  await registerDatabaseChange(
    'create',
    'request' as any,
    requestId,
    {
      clientName: `${newRequest.nome} ${newRequest.cognome}`,
      tipoRichiesta: newRequest.tipoRichiesta,
      email: newRequest.email
    }
  );
  
  return newRequest;
};

export const updateRequest = async (id: string, updates: Partial<Request>): Promise<void> => {
  const requestRef = ref(database, `requests/${id}`);
  await update(requestRef, updates);
  
  // Registra la modifica nel database
  await registerDatabaseChange(
    'update',
    'request' as any,
    id,
    {
      changes: Object.keys(updates).join(', ')
    }
  );
};

export const deleteRequest = async (id: string): Promise<void> => {
  // Ottieni i dati della richiesta prima di eliminarla
  const request = await getRequestById(id);
  
  // Elimina la richiesta
  await remove(ref(database, `requests/${id}`));
  
  // Registra l'eliminazione nel database
  if (request) {
    await registerDatabaseChange(
      'delete',
      'request' as any,
      id,
      {
        clientName: `${request.nome} ${request.cognome}`,
        tipoRichiesta: request.tipoRichiesta
      }
    );
  }
};
