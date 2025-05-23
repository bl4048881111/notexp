import { ref, get, query, orderByChild, limitToLast, startAt, endAt, getDatabase, remove, set } from 'firebase/database';
import { rtdb } from '../firebase';

// Tipo per le modifiche al database come appare in Firebase
interface FirebaseDbChange {
  actionType: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  ipAddress: string;
  platform: string;
  deviceFingerprint: string;
  details: Record<string, any>;
  user: {
    username: string;
    fingerprint: string;
    ip: string;
    platform: string;
    timestamp: string;
  };
}

interface DbChange {
  id: string;
  timestamp: string;
  actionType: 'create' | 'update' | 'delete';
  entityType: 'client' | 'quote' | 'appointment';
  entityId: string;
  details: Record<string, any>;
  user: {
    username: string;
    fingerprint: string;
    ip: string;
    platform: string;
  };
  ipAddress: string;
  deviceFingerprint: string;
  platform: string;
}

class DbService {
  private database = getDatabase();

  /**
   * Recupera le modifiche dal database in modo semplice e diretto
   */
  async getLatestChanges(): Promise<any[]> {
    try {
      console.log('SEMPLICE: Accesso diretto ai dati db_changes...');
      
      // Riferimento diretto al nodo db_changes
      const dbChangesRef = ref(this.database, 'db_changes');
      
      // Ottieni tutti i dati, senza query o filtri
      const snapshot = await get(dbChangesRef);
      
      if (!snapshot.exists()) {
        console.log('SEMPLICE: Nessun dato trovato');
        return [];
      }
      
      // Ottieni i dati grezzi
      const data = snapshot.val();
      console.log('SEMPLICE: Dati ricevuti:', typeof data);
      
      // Visualizza le chiavi
      const keys = Object.keys(data);
      console.log('SEMPLICE: Chiavi trovate:', keys);
      console.log('SEMPLICE: Numero di elementi:', keys.length);
      
      // Trasforma in array nel modo più semplice possibile
      const changesArray = keys.map(key => {
        return {
          id: key,
          ...data[key]
        };
      });
      
      console.log('SEMPLICE: Array creato con', changesArray.length, 'elementi');
      console.log('SEMPLICE: Primo elemento:', changesArray[0] ? JSON.stringify(changesArray[0]).slice(0, 100) : 'nessun elemento');
      
      return changesArray;
    } catch (error) {
      console.error('SEMPLICE: Errore durante il recupero:', error);
      throw error;
    }
  }

  /**
   * Recupera una chiave specifica per debug
   */
  async getChangeByKey(key: string): Promise<any> {
    try {
      console.log(`SEMPLICE: Recupero chiave ${key}`);
      const changeRef = ref(this.database, `db_changes/${key}`);
      const snapshot = await get(changeRef);
      
      if (!snapshot.exists()) {
        console.log(`SEMPLICE: Chiave ${key} non trovata`);
        return null;
      }
      
      return snapshot.val();
    } catch (error) {
      console.error(`SEMPLICE: Errore recupero chiave ${key}:`, error);
      throw error;
    }
  }

  /**
   * Recupera le modifiche filtrate per intervallo di date
   * @param startDate - Data di inizio 
   * @param endDate - Data di fine
   * @returns Promise con l'array di modifiche filtrate
   */
  async getChangesByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      console.log(`Recupero modifiche dal ${startDate.toISOString()} al ${endDate.toISOString()}`);
      const changesRef = ref(this.database, 'db_changes');
      
      // Converti le date in formato ISO string per il filtro
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      const changesQuery = query(
        changesRef,
        orderByChild('timestamp'),
        startAt(startDateStr),
        endAt(endDateStr)
      );
      
      const querySnapshot = await get(changesQuery);
      if (!querySnapshot.exists()) {
        return [];
      }
      
      const changesData = querySnapshot.val();
      
      // Converti in array
      const changesArray = Object.entries(changesData).map(([id, value]) => ({
        id,
        ...(value as FirebaseDbChange)
      }));
      
      // Ordina le modifiche per timestamp (più recenti prima)
      return changesArray.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Errore durante il recupero delle modifiche per intervallo di date:', error);
      throw error;
    }
  }

  /**
   * Recupera le modifiche filtrate per entità
   * @param entityType - Tipo di entità ('client', 'quote', 'appointment')
   * @param entityId - ID dell'entità, opzionale
   * @returns Promise con l'array di modifiche filtrate
   */
  async getChangesByEntity(
    entityType: 'client' | 'quote' | 'appointment',
    entityId?: string
  ): Promise<any[]> {
    try {
      console.log(`Recupero modifiche per entità di tipo ${entityType}${entityId ? ` con ID ${entityId}` : ''}`);
      
      // Prima recupera tutte le modifiche (non c'è un modo diretto per filtrare per entityType)
      const allChanges = await this.getLatestChanges(); // Usa la nuova funzione getLatestChanges
      
      // Filtra lato client
      return allChanges.filter(change => 
        change.entityType === entityType && 
        (entityId ? change.entityId === entityId : true)
      );
    } catch (error) {
      console.error('Errore durante il recupero delle modifiche per entità:', error);
      throw error;
    }
  }
}

export const dbService = new DbService();

// Miglioro il metodo getLatestChanges per gestire formati di dati specifici e mostrare più dettagli
export const getLatestChanges = async (limit = 100): Promise<Record<string, any>[]> => {
  try {
    // Log di debug per tracciare l'esecuzione
    console.log("[DEBUG] Tentativo di recupero modifiche database");
    
    // Utilizzo un riferimento diretto alla collezione db_changes
    const dbChangesRef = ref(rtdb, 'db_changes');
    
    // Modifica: recupero direttamente tutti i dati senza query
    console.log("[DEBUG] Ottengono TUTTI i dati dal nodo db_changes senza filtri");
    const snapshot = await get(dbChangesRef);
    
    if (!snapshot.exists()) {
      console.log("[DEBUG] Nessun dato trovato in db_changes");
      return [];
    }
    
    // Mostra un log dettagliato sui dati recuperati
    console.log("[DEBUG] Dati trovati nel nodo db_changes");
    const rawData = snapshot.val();
    console.log("[DEBUG] Tipo dei dati:", typeof rawData);
    
    const keys = Object.keys(rawData);
    console.log(`[DEBUG] Chiavi trovate (${keys.length}):`, keys);
    
    // Array per i risultati
    const changes: Record<string, any>[] = [];
    
    // Semplice iterazione su tutte le chiavi
    keys.forEach(key => {
      try {
        // Ottieni l'elemento
        const item = rawData[key];
        console.log(`[DEBUG] Esaminando chiave ${key}, tipo:`, typeof item);
        
        if (item && typeof item === 'object') {
          // Log dettagliato sui campi dell'oggetto
          console.log(`[DEBUG] Campi in ${key}:`, Object.keys(item));
          
          // Aggiungi id come proprietà
          item.id = key;
          
          // Assicurati che i dettagli siano presenti e formattati correttamente
          if (!item.details) {
            item.details = {};
          }
          
          // Verifica specificamente i campi richiesti
          if (item.changes && typeof item.changes === 'string') {
            console.log(`[DEBUG] Trovato campo 'changes' in ${key}:`, item.changes);
            if (!item.details) item.details = {};
            item.details.changes = item.changes;
          }
          
          // Gestisci specificamente i campi menzionati dall'utente
          const specificFields = ['name', 'surname', 'phone', 'email', 'plate', 'vin', 'createdAt', 'updatedAt'];
          for (const field of specificFields) {
            if (item[field] !== undefined) {
              console.log(`[DEBUG] Trovato campo '${field}' in ${key}:`, item[field]);
              if (!item.details) item.details = {};
              item.details[field] = item[field];
            }
          }
          
          // Aggiungi il record all'array dei risultati
          changes.push(item);
          console.log(`[DEBUG] Aggiunto elemento con chiave ${key}`);
        } else {
          console.log(`[DEBUG] Elemento con chiave ${key} non è un oggetto valido:`, item);
        }
      } catch (err) {
        console.error(`[ERROR] Errore elaborando la chiave ${key}:`, err);
      }
    });
    
    console.log(`[DEBUG] Trasformati ${changes.length} elementi di ${keys.length} chiavi`);
    
    // Stampa i primi due elementi per debug con dettagli completi
    if (changes.length > 0) {
      console.log("[DEBUG] Campi del primo elemento:", Object.keys(changes[0]));
      console.log("[DEBUG] Details primo elemento:", changes[0].details);
      console.log("[DEBUG] Primo elemento:", JSON.stringify(changes[0]).substring(0, 200));
      if (changes.length > 1) {
        console.log("[DEBUG] Campi del secondo elemento:", Object.keys(changes[1]));
        console.log("[DEBUG] Details secondo elemento:", changes[1].details);
      }
    }
    
    return changes;
  } catch (error) {
    console.error("[ERROR] Errore nel recupero delle modifiche:", error);
    return []; // Ritorna array vuoto per evitare errori a cascata
  }
};

// Funzione per cancellare tutti i log dal database
export const clearAllDatabaseChanges = async (): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  try {
    console.log("[DB-SERVICE] Inizio cancellazione di tutti i log...");
    const database = getDatabase();
    
    // Prima verifico quanti record ci sono
    const dbChangesRef = ref(database, 'db_changes');
    const snapshot = await get(dbChangesRef);
    
    if (!snapshot.exists()) {
      console.log("[DB-SERVICE] Nessun log da cancellare");
      return { success: true, deletedCount: 0 };
    }
    
    // Conto i record
    const data = snapshot.val();
    const recordCount = Object.keys(data).length;
    console.log(`[DB-SERVICE] Trovati ${recordCount} record da cancellare`);
    
    // Preserva il record di inizializzazione del sistema se esiste
    const systemInit = data['system_init'];
    
    // Cancella l'intero nodo
    await remove(dbChangesRef);
    
    // Se c'era un record di inizializzazione, ricrealo
    if (systemInit) {
      const systemInitRef = ref(database, 'db_changes/system_init');
      await set(systemInitRef, {
        ...systemInit,
        details: {
          ...systemInit.details,
          description: 'Nodo db_changes ripristinato dopo cancellazione'
        },
        timestamp: new Date().toISOString()
      });
      console.log("[DB-SERVICE] Record di inizializzazione ricreato");
    }
    
    console.log(`[DB-SERVICE] Cancellazione completata: ${recordCount} record eliminati`);
    return { success: true, deletedCount: recordCount };
  } catch (error) {
    console.error("[DB-SERVICE] Errore durante la cancellazione dei log:", error);
    return { 
      success: false, 
      deletedCount: 0, 
      error: error instanceof Error ? error.message : "Errore sconosciuto" 
    };
  }
};

// Funzione per cancellare i log provenienti da altri PC
export const clearOtherPCChanges = async (): Promise<{ success: boolean; deletedCount: number; keptCount: number; error?: string }> => {
  try {
    console.log("[DB-SERVICE] Inizio filtraggio dei log di altri PC...");
    const database = getDatabase();
    
    // Ottieni l'IP e fingerprint attuali
    const currentIP = localStorage.getItem('current_ip') || window.location.hostname;
    // Se abbiamo memorizzato un user_fingerprint nel localStorage, lo usiamo
    const userFingerprint = localStorage.getItem('user_fingerprint') || navigator.userAgent;
    
    console.log(`[DB-SERVICE] IP corrente: ${currentIP}`);
    
    // Recupera tutti i log
    const dbChangesRef = ref(database, 'db_changes');
    const snapshot = await get(dbChangesRef);
    
    if (!snapshot.exists()) {
      console.log("[DB-SERVICE] Nessun log da filtrare");
      return { success: true, deletedCount: 0, keptCount: 0 };
    }
    
    // Analizza i record
    const data = snapshot.val();
    const allKeys = Object.keys(data);
    
    // Separa i record da mantenere da quelli da eliminare
    const keysToKeep: string[] = [];
    const keysToDelete: string[] = [];
    
    for (const key of allKeys) {
      const record = data[key];
      const recordIP = record.ipAddress || (record.user && record.user.ip) || '';
      const recordFingerprint = record.deviceFingerprint || (record.user && record.user.fingerprint) || '';
      
      // Se l'IP corrisponde o il fingerprint corrisponde, manteniamo il record
      if (recordIP.includes(currentIP) || 
          (userFingerprint && recordFingerprint && recordFingerprint.includes(userFingerprint)) ||
          record.details?.debugCreated) { // Manteniamo anche i record di debug
        keysToKeep.push(key);
      } else {
        keysToDelete.push(key);
      }
    }
    
    console.log(`[DB-SERVICE] Record da mantenere: ${keysToKeep.length}, da eliminare: ${keysToDelete.length}`);
    
    // Se non ci sono record da eliminare, terminiamo
    if (keysToDelete.length === 0) {
      return { success: true, deletedCount: 0, keptCount: keysToKeep.length };
    }
    
    // Manteniamo solo i record che vogliamo conservare
    const recordsToKeep: Record<string, any> = {};
    keysToKeep.forEach(key => {
      recordsToKeep[key] = data[key];
    });
    
    // Salviamo solo i record da mantenere
    await set(dbChangesRef, recordsToKeep);
    
    console.log(`[DB-SERVICE] Filtraggio completato: eliminati ${keysToDelete.length} record, mantenuti ${keysToKeep.length}`);
    
    return { 
      success: true, 
      deletedCount: keysToDelete.length, 
      keptCount: keysToKeep.length 
    };
  } catch (error) {
    console.error("[DB-SERVICE] Errore durante il filtraggio dei log:", error);
    return { 
      success: false, 
      deletedCount: 0, 
      keptCount: 0,
      error: error instanceof Error ? error.message : "Errore sconosciuto" 
    };
  }
};

// Funzione per ripristinare completamente il database con dati di test iniziali
export const resetDatabase = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log("[DB-SERVICE] Inizializzazione completa del database in corso...");
    const database = getDatabase();
    
    // Crea dati di test per clienti
    const clientsData = {
      "client1": {
        id: "client1",
        name: "Mario Rossi",
        surname: "Rossi",
        phone: "+39 123456789",
        email: "mario.rossi@example.com",
        plate: "AB123CD",
        vin: "VINCODE12345",
        createdAt: Date.now() - 30 * 86400000,
        updatedAt: Date.now()
      },
      "client2": {
        id: "client2",
        name: "Sergio",
        surname: "Sportelli",
        phone: "+39 987654321",
        email: "sergio.sportelli@example.com",
        plate: "XY987ZW",
        vin: "SPORTVIN98765",
        createdAt: Date.now() - 15 * 86400000,
        updatedAt: Date.now()
      }
    };
    
    // Crea dati di test per preventivi
    const quotesData = {
      "quote1": {
        id: "quote1",
        clientId: "client1",
        clientName: "Mario Rossi",
        status: "approved",
        items: [
          { description: "Cambio olio", price: 50.00 },
          { description: "Filtro aria", price: 30.00 }
        ],
        totalPrice: 80.00,
        createdAt: Date.now() - 14 * 86400000,
        updatedAt: Date.now() - 12 * 86400000
      },
      "quote2": {
        id: "quote2",
        clientId: "client2",
        clientName: "Sergio Sportelli",
        status: "pending",
        items: [
          { description: "Freni anteriori", price: 120.00 },
          { description: "Manodopera", price: 60.00 }
        ],
        totalPrice: 180.00,
        createdAt: Date.now() - 7 * 86400000,
        updatedAt: Date.now() - 5 * 86400000
      }
    };
    
    // Crea dati di test per appuntamenti
    const appointmentsData = {
      "app1": {
        id: "app1",
        clientId: "client1",
        clientName: "Mario Rossi",
        date: new Date(Date.now() + 2 * 86400000).toISOString(),
        time: "10:00",
        notes: "Cambio olio e revisione",
        status: "confirmed",
        createdAt: Date.now() - 10 * 86400000,
        updatedAt: Date.now() - 8 * 86400000
      },
      "app2": {
        id: "app2",
        clientId: "client2",
        clientName: "Sergio Sportelli",
        date: new Date(Date.now() + 5 * 86400000).toISOString(),
        time: "15:30",
        notes: "Sostituzione freni",
        status: "pending",
        createdAt: Date.now() - 3 * 86400000,
        updatedAt: Date.now() - 1 * 86400000
      }
    };
    
    // Crea dati di test per modifiche al database
    const dbChangesData: Record<string, any> = {};
    
    // Aggiungi diverse modifiche campione
    for (let i = 0; i < 10; i++) {
      const changeId = `test-change-${Date.now()}-${i}`;
      const randomClient = i % 2 === 0 ? clientsData.client1 : clientsData.client2;
      
      dbChangesData[changeId] = {
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        actionType: i % 3 === 0 ? 'create' : (i % 3 === 1 ? 'update' : 'delete'),
        entityType: i % 2 === 0 ? 'client' : (i % 4 === 1 ? 'quote' : 'appointment'),
        entityId: randomClient.id,
        details: {
          clientName: `${randomClient.name} ${randomClient.surname}`,
          changes: 'name, surname, phone, email, plate, vin',
          description: `Modifica di test #${i}`
        },
        user: {
          username: 'admin',
          fingerprint: 'test-init-fingerprint',
          ip: '127.0.0.1',
          platform: 'reset-tool'
        },
        ipAddress: '127.0.0.1',
        deviceFingerprint: 'test-init-fingerprint',
        platform: 'reset-tool'
      };
    }
    
    // Imposta i nodi root del database con i dati di test
    await set(ref(database, 'clients'), clientsData);
    await set(ref(database, 'quotes'), quotesData);
    await set(ref(database, 'appointments'), appointmentsData);
    await set(ref(database, 'db_changes'), dbChangesData);
    
    console.log("[DB-SERVICE] Database inizializzato con successo");
    
    return { 
      success: true, 
      message: `Database inizializzato con ${Object.keys(clientsData).length} clienti, ${Object.keys(quotesData).length} preventivi, ${Object.keys(appointmentsData).length} appuntamenti e ${Object.keys(dbChangesData).length} log`
    };
  } catch (error) {
    console.error("[DB-SERVICE] Errore durante l'inizializzazione del database:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Errore sconosciuto durante l'inizializzazione"
    };
  }
}; 