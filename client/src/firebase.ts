import { initializeApp, getApps, getApp } from 'firebase/app';
// Rimosso import di Firestore non più utilizzato
// import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase, ref, get, onValue, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL // URL per Realtime Database
};

// Inizializza Firebase solo se non è già stato inizializzato
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Non utilizziamo più Firestore
// export const db = initializeFirestore(app, {
//   experimentalForceLongPolling: true,
//   useFetchStreams: false
// });

// Inizializza Realtime Database come alternativa
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

// Funzione di utilità per diagnostica diretta
export const verifyDatabaseNode = async (nodePath: string) => {
  try {
    console.log(`[FIREBASE] Verifica diretta del nodo: ${nodePath}`);
    
    const nodeRef = ref(rtdb, nodePath);
    const snapshot = await get(nodeRef);
    
    if (!snapshot.exists()) {
      console.log(`[FIREBASE] Il nodo ${nodePath} non esiste`);
      return { exists: false, data: null };
    }
    
    const data = snapshot.val();
    console.log(`[FIREBASE] Nodo ${nodePath} esiste con dati:`, 
      typeof data === 'object' ? `Oggetto con ${Object.keys(data).length} chiavi` : typeof data);
    
    return { 
      exists: true, 
      data, 
      keys: typeof data === 'object' ? Object.keys(data) : [],
      count: typeof data === 'object' ? Object.keys(data).length : 0
    };
  } catch (error) {
    console.error(`[FIREBASE] Errore durante la verifica del nodo ${nodePath}:`, error);
    return { exists: false, error: (error as Error).message };
  }
};

// Funzione per osservare cambiamenti in tempo reale (utile per debug)
export const observeDatabase = (nodePath: string, callback: (data: any) => void) => {
  const nodeRef = ref(rtdb, nodePath);
  
  console.log(`[FIREBASE] Inizio osservazione del nodo: ${nodePath}`);
  
  const unsubscribe = onValue(nodeRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log(`[FIREBASE] Aggiornamento ricevuto per ${nodePath}`);
      callback(data);
    } else {
      console.log(`[FIREBASE] Nessun dato presente in ${nodePath}`);
      callback(null);
    }
  }, (error) => {
    console.error(`[FIREBASE] Errore nell'osservazione di ${nodePath}:`, error);
  });
  
  // Restituisce la funzione per annullare l'iscrizione
  return unsubscribe;
};

// Funzione per verificare se un parametro specifico esiste nel database
export const verifyParameterExists = async (paramName: string, section?: string): Promise<{exists: boolean, details?: any, path?: string, error?: string}> => {
  try {
    console.log(`[FIREBASE] Verifica esistenza parametro: ${paramName} ${section ? `nella sezione ${section}` : ''}`);
    
    // Recupera tutti i parametri
    const parametersRef = ref(rtdb, 'parameters');
    const snapshot = await get(parametersRef);
    
    if (!snapshot.exists()) {
      console.log(`[FIREBASE] Nessun parametro trovato nel database`);
      return { exists: false };
    }
    
    const parametersData = snapshot.val();
    
    // Cerca il parametro per nome
    const matchingParameter = Object.entries(parametersData).find(([_, param]: [string, any]) => {
      // Controllo sul nome (case insensitive)
      const nameMatches = param.name && param.name.toLowerCase() === paramName.toLowerCase();
      
      // Se è specificata una sezione, controlla anche quella
      if (section) {
        return nameMatches && param.section === section;
      }
      
      return nameMatches;
    });
    
    if (matchingParameter) {
      const [parameterId, parameterDetails] = matchingParameter;
      console.log(`[FIREBASE] Parametro trovato con ID ${parameterId}:`, parameterDetails);
      return { 
        exists: true, 
        details: parameterDetails,
        path: `parameters/${parameterId}`
      };
    }
    
    console.log(`[FIREBASE] Parametro "${paramName}" non trovato`);
    return { exists: false };
  } catch (error) {
    console.error(`[FIREBASE] Errore durante la verifica del parametro ${paramName}:`, error);
    return { exists: false, error: (error as Error).message };
  }
};

// Funzione per aggiungere un nuovo parametro alla checklist
export const addChecklistParameter = async (
  paramName: string, 
  section: string, 
  defaultState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE' = 'NON CONTROLLATO'
): Promise<{success: boolean, parameterId?: string, error?: string}> => {
  try {
    console.log(`[FIREBASE] Aggiungo nuovo parametro: ${paramName} nella sezione ${section}`);
    
    // Verifica che il parametro non esista già
    const paramCheck = await verifyParameterExists(paramName, section);
    if (paramCheck.exists) {
      console.log(`[FIREBASE] Il parametro "${paramName}" esiste già nella sezione ${section}`);
      return { 
        success: false, 
        parameterId: paramCheck.path?.split('/')[1], 
        error: 'Il parametro esiste già' 
      };
    }
    
    // Crea un ID basato sul nome (pulito per uso come chiave) con timestamp per unicità
    const parameterId = `${paramName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
    
    // Struttura del parametro da salvare
    const paramData = {
      name: paramName,
      section: section,
      defaultState: defaultState
    };
    
    // Riferimento al nuovo parametro
    const paramRef = ref(rtdb, `parameters/${parameterId}`);
    
    // Salva il parametro
    await set(paramRef, paramData);
    
    console.log(`[FIREBASE] Parametro "${paramName}" aggiunto con successo alla sezione ${section} con ID ${parameterId}`);
    
    // Verifica che il parametro sia stato creato correttamente
    const verifyRef = ref(rtdb, `parameters/${parameterId}`);
    const verifySnapshot = await get(verifyRef);
    
    if (verifySnapshot.exists()) {
      return { 
        success: true, 
        parameterId: parameterId 
      };
    } else {
      return { 
        success: false, 
        error: 'Verifica creazione parametro fallita' 
      };
    }
  } catch (error) {
    console.error(`[FIREBASE] Errore durante l'aggiunta del parametro ${paramName}:`, error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
};

// Nuove funzioni di utilità per la gestione dei percorsi nel database

// Funzione per ottenere il percorso standardizzato della fase di lavorazione di un veicolo
export const getLavorazionePath = (vehicleId: string): string => {
  return `vehicles/${vehicleId}/lavorazione`;
};

// Funzione per ottenere il percorso standard dei controlli di un veicolo
export const getVehicleControlsPath = (vehicleId: string): string => {
  return `${getLavorazionePath(vehicleId)}/controls`;
};

// Funzione per ottenere il percorso standard della checklist di un veicolo
export const getVehicleChecklistPath = (vehicleId: string): string => {
  return `${getLavorazionePath(vehicleId)}/checklist`;
};

// Funzione per ottenere il percorso della checklist di un appuntamento
export const getAppointmentChecklistPath = (appointmentId: string): string => {
  return `appointments/${appointmentId}/checklist`;
};

// Funzione per salvare un controllo nel database usando i percorsi standard
export const saveChecklistControl = async (
  vehicleId: string | null, 
  appointmentId: string | null, 
  parameterId: string, 
  control: { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }
): Promise<void> => {
  try {
    if (vehicleId) {
      // Salva nel percorso principale standardizzato
      const controlRef = ref(rtdb, `${getVehicleControlsPath(vehicleId)}/${parameterId}`);
      await set(controlRef, control);
      
      // Salva anche nel percorso checklist per retrocompatibilità
      const checklistRef = ref(rtdb, `${getVehicleChecklistPath(vehicleId)}/${parameterId}`);
      await set(checklistRef, control);
      
      console.log(`Controllo ${parameterId} salvato nei percorsi standard per il veicolo ${vehicleId}`);
    }
    
    if (appointmentId) {
      // Salva nel percorso dell'appuntamento
      const appointmentRef = ref(rtdb, `${getAppointmentChecklistPath(appointmentId)}/${parameterId}`);
      await set(appointmentRef, control);
      console.log(`Controllo ${parameterId} salvato per l'appuntamento ${appointmentId}`);
    }
  } catch (error) {
    console.error("Errore nel salvataggio del controllo:", error);
    throw error;
  }
};

// Funzione per gestire i pezzi di ricambio in modo standard
export const saveVehicleSpareParts = async (
  vehicleId: string,
  sparePartData: {
    photos?: string[],
    notes?: string
  }
): Promise<void> => {
  try {
    // Percorso standardizzato per i pezzi di ricambio
    const sparePartsRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione/spareParts`);
    
    // Salva i dati nel percorso standard
    await set(sparePartsRef, {
      photos: sparePartData.photos || [],
      notes: sparePartData.notes || ''
    });
    
    console.log(`Dati dei pezzi di ricambio salvati correttamente per il veicolo ${vehicleId}`);
  } catch (error) {
    console.error("Errore nel salvataggio dei pezzi di ricambio:", error);
    throw error;
  }
};

// Funzione per recuperare i dati dei pezzi di ricambio in modo unificato
export const getVehicleSpareParts = async (
  vehicleId: string
): Promise<{ photos: string[], notes: string }> => {
  try {
    // Controlla il percorso standardizzato
    const sparePartsRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione/spareParts`);
    const sparePartsSnapshot = await get(sparePartsRef);
    
    // Se troviamo i dati nel percorso standard, li restituiamo
    if (sparePartsSnapshot.exists()) {
      const data = sparePartsSnapshot.val();
      return {
        photos: data.photos || [],
        notes: data.notes || ''
      };
    }
    
    // Altrimenti, cerchiamo in tutti i percorsi possibili
    const paths = [
      `vehicles/${vehicleId}`,
      `vehicles/${vehicleId}/lavorazione`,
      `vehicles/${vehicleId}/workingPhase`,
      `vehicles/${vehicleId}/workSpareparts`,
      `workingPhase/${vehicleId}`,
      `lavorazione/${vehicleId}`
    ];
    
    // Variabili per aggregare i dati
    let photos: string[] = [];
    let notes = '';
    
    // Controlliamo tutti i percorsi per trovare dati pertinenti
    for (const path of paths) {
      const pathRef = ref(rtdb, path);
      const snapshot = await get(pathRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Raccogliamo tutte le foto trovate
        if (data.sparePartPhotos && Array.isArray(data.sparePartPhotos)) {
          photos = [...photos, ...data.sparePartPhotos];
        } else if (data.sparePartPhoto && typeof data.sparePartPhoto === 'string') {
          photos.push(data.sparePartPhoto);
        }
        
        // Troviamo anche le note, se presenti
        if (data.sparePartNotes && !notes) {
          notes = data.sparePartNotes;
        }
      }
    }
    
    // Eliminiamo i duplicati dalle foto
    photos = Array.from(new Set(photos));
    
    // Salviamo i dati aggregati nel percorso standard per future richieste
    if (photos.length > 0 || notes) {
      await saveVehicleSpareParts(vehicleId, { photos, notes });
    }
    
    return { photos, notes };
  } catch (error) {
    console.error("Errore nel recupero dei pezzi di ricambio:", error);
    return { photos: [], notes: '' };
  }
};

// Funzione per gestire il livello carburante in modo standard
export const saveFuelLevel = async (
  vehicleId: string,
  fuelLevel: string
): Promise<void> => {
  try {
    // Percorso standardizzato per il livello carburante
    const fuelLevelRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione/fuelLevel`);
    await set(fuelLevelRef, fuelLevel);
    
    console.log(`Livello carburante salvato correttamente per il veicolo ${vehicleId}`);
  } catch (error) {
    console.error("Errore nel salvataggio del livello carburante:", error);
    throw error;
  }
};