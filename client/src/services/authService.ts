import { User, DEFAULT_CREDENTIALS } from "@shared/types";
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { ref, get, set, getDatabase } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { clientService } from "./clientService";

const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'current_user';
const FINGERPRINT_KEY = 'device_fingerprint';
const IP_KEY = 'current_ip';
const SESSION_EXPIRY_KEY = 'session_expiry';
const AUTH_TIMESTAMP_KEY = 'auth_timestamp';
const LAST_ACTIVITY_KEY = 'last_activity';

// Durata della sessione in millisecondi (1 ora)
const SESSION_DURATION = 60 * 60 * 1000;

// Genera un fingerprint del browser/dispositivo
const generateFingerprint = async (): Promise<string> => {
  try {
    // Inizializza l'agente FingerprintJS
    const fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    
    // Usa il visitorId come fingerprint
    return result.visitorId;
  } catch (error) {
    console.warn("Impossibile generare il fingerprint:", error);
    // Fallback con un ID casuale
    return Math.random().toString(36).substring(2, 15);
  }
};

// Ottieni l'indirizzo IP corrente
const getCurrentIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn("Impossibile ottenere l'indirizzo IP:", error);
    return "unknown";
  }
};

// Ottiene informazioni sul dispositivo
const getDeviceInfo = (): Record<string, string> => {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    screenWidth: window.screen.width.toString(),
    screenHeight: window.screen.height.toString(),
    colorDepth: window.screen.colorDepth.toString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateTime: new Date().toISOString()
  };
};

class AuthService {
  async login(username: string, password: string): Promise<boolean> {
    // Prima: login amministratore classico
    if (username === DEFAULT_CREDENTIALS.username && 
        password === DEFAULT_CREDENTIALS.password) {
      // Assicuriamoci di cancellare ogni traccia della sessione precedente
      this.logout();
      
      const user: User = { username, password };
      
      // Genera un token più complesso con timestamp
      const timestamp = Date.now();
      const token = `${btoa(username)}.${timestamp}.${this.generateRandomString(16)}`;
      
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_TIMESTAMP_KEY, timestamp.toString());
      
      // Salva il fingerprint e l'IP
      const fingerprint = await generateFingerprint();
      localStorage.setItem(FINGERPRINT_KEY, fingerprint);
      
      const ip = await getCurrentIP();
      localStorage.setItem(IP_KEY, ip);
      
      // Imposta la scadenza della sessione a 1 ora da ora
      const expiryTime = timestamp + SESSION_DURATION;
      localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
      
      // Salva l'ultimo timestamp di attività
      localStorage.setItem(LAST_ACTIVITY_KEY, timestamp.toString());
      
      // Registra il login nel sessionStorage per evitare riautenticazioni multiple
      sessionStorage.setItem('authenticated', 'true');
      
      return true;
    }
    // Login cliente tramite codice cliente (id) o email
    const client = await clientService.findByCodeOrEmail(username);
    if (client && client.password === password) {
      // Assicuriamoci di cancellare ogni traccia della sessione precedente
      this.logout();
      
      // Salva i dati del cliente come utente autenticato
      const user: User = {
        username: client.email || client.id,
        password: '', // Non salviamo la password
        clientId: client.id,
        email: client.email,
        name: client.name,
        surname: client.surname
      };
      const timestamp = Date.now();
      const token = `${btoa(user.username)}.${timestamp}.${this.generateRandomString(16)}`;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_TIMESTAMP_KEY, timestamp.toString());
      const fingerprint = await generateFingerprint();
      localStorage.setItem(FINGERPRINT_KEY, fingerprint);
      const ip = await getCurrentIP();
      localStorage.setItem(IP_KEY, ip);
      const expiryTime = timestamp + SESSION_DURATION;
      localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
      localStorage.setItem(LAST_ACTIVITY_KEY, timestamp.toString());
      sessionStorage.setItem('authenticated', 'true');
      return true;
    }
    return false;
  }
  
  // Genera una stringa casuale per migliorare il token
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem(AUTH_TIMESTAMP_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('authenticated');
  }
  
  // Registra l'attività utente e rinnova la sessione
  updateActivity(): void {
    // Non chiamiamo isAuthenticated() per evitare cicli infiniti
    // Invece controlliamo direttamente se il token esiste
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      const now = Date.now();
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      
      // NON rinnoviamo la scadenza della sessione, manteniamo la durata originale di 1 ora
      // Commentiamo la seguente riga per evitare il rinnovo continuo:
      // const newExpiryTime = now + SESSION_DURATION;
      // localStorage.setItem(SESSION_EXPIRY_KEY, newExpiryTime.toString());
    }
  }
  
  isAuthenticated(): boolean {
    // Verifica immediatamente la scadenza
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const expiryTimeString = localStorage.getItem(SESSION_EXPIRY_KEY);
    
    // Se non ci sono i dati necessari, l'utente non è autenticato
    if (!token || !expiryTimeString) {
      return false;
    }
    
    // Verifica se la sessione è scaduta
    const expiryTime = parseInt(expiryTimeString, 10);
    const now = Date.now();
    
    // Se il tempo corrente ha superato il tempo di scadenza, la sessione è scaduta
    if (now > expiryTime) {
      this.logout();
      return false;
    }
    
    // Se la sessione è ancora valida, aggiorna lo stato in sessionStorage
    sessionStorage.setItem('authenticated', 'true');
    return true;
  }
  
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }
  
  async getIdentityInfo(): Promise<{ 
    fingerprint: string; 
    ip: string; 
    deviceInfo: Record<string, string> 
  }> {
    let fingerprint = localStorage.getItem(FINGERPRINT_KEY);
    if (!fingerprint) {
      fingerprint = await generateFingerprint();
      localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    }
    
    let ip = localStorage.getItem(IP_KEY);
    if (!ip) {
      ip = await getCurrentIP();
      localStorage.setItem(IP_KEY, ip);
    }
    
    const deviceInfo = getDeviceInfo();
    
    return { fingerprint, ip, deviceInfo };
  }
  
  // Verifica la validità della sessione attiva
  validateSession(): boolean {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const timestampStr = localStorage.getItem(AUTH_TIMESTAMP_KEY);
    const expiryTimeString = localStorage.getItem(SESSION_EXPIRY_KEY);
    
    if (!token || !timestampStr || !expiryTimeString) {
      return false;
    }
    
    const timestamp = parseInt(timestampStr, 10);
    const expiryTime = parseInt(expiryTimeString, 10);
    const now = Date.now();
    
    // Controlla se la sessione è scaduta (dopo 1 ora dal login)
    if (now > expiryTime) {
      this.logout();
      return false;
    }
    
    return true;
  }
}

export const authService = new AuthService();

class DebugService {
  // Funzione per creare una modifica di test nel database
  async createTestChange(type = 'client'): Promise<boolean> {
    try {
      console.log("[DEBUG SERVICE] Creazione modifica di test");
      
      // Usa l'accesso diretto al database anziché registerDatabaseChange
      const database = getDatabase();
      
      // Genera un ID univoco per la modifica
      const changeId = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const changeRef = ref(database, `db_changes/${changeId}`);
      
      // Crea i dati della modifica
      const change = {
        timestamp: new Date().toISOString(),
        actionType: 'create',
        entityType: type,
        entityId: `TEST-${Date.now().toString().slice(-6)}`,
        details: {
          clientName: 'Cliente di Test',
          description: 'Modifica di test creata manualmente',
          debugCreated: true,
          timestamp: Date.now()
        },
        user: {
          username: 'debug-service',
          fingerprint: 'test-fingerprint',
          ip: '127.0.0.1',
          platform: 'debug-tool'
        },
        ipAddress: '127.0.0.1',
        deviceFingerprint: 'test-fingerprint',
        platform: 'debug-tool'
      };
      
      // Salva la modifica nel database
      await set(changeRef, change);
      
      // Verifica che la modifica sia stata salvata
      const snapshot = await get(changeRef);
      const success = snapshot.exists();
      
      console.log(`[DEBUG SERVICE] Modifica test ${changeId} creata: ${success}`);
      return success;
    } catch (error) {
      console.error("[DEBUG SERVICE] Errore durante la creazione della modifica di test:", error);
      return false;
    }
  }
  
  // Miglioro il metodo forceInitDbChanges per creare dati di test più realistici con campi specifici
  async forceInitDbChanges(): Promise<boolean> {
    try {
      console.log("[DEBUG SERVICE] Inizializzazione forzata del nodo db_changes");
      
      // Ottieni una reference al database
      const database = getDatabase();
      
      // Crea un riferimento al nodo db_changes
      const dbChangesRef = ref(database, 'db_changes');
      
      // Crea gli oggetti per le voci di test
      const testChanges: Record<string, any> = {};
      
      // Aggiungi alcune voci di test con tipi diversi
      const types = ['client', 'quote', 'appointment'];
      const actions = ['create', 'update', 'delete'];
      const campiModificati = ['name', 'surname', 'phone', 'email', 'plate', 'vin', 'createdAt', 'updatedAt'];
      
      const clienti = [
        { nome: 'Mario Rossi', phone: '+39 123456789', plate: 'AB123CD', vin: 'VINCODE12345' },
        { nome: 'Sergio Sportelli', phone: '+39 987654321', plate: 'XY987ZW', vin: 'SPORTVIN98765' },
        { nome: 'Luigi Verdi', phone: '+39 456789123', plate: 'CD456EF', vin: 'VERDVIN45678' },
        { nome: 'Anna Bianchi', phone: '+39 789123456', plate: 'GH789IJ', vin: 'BIANVIN78912' },
        { nome: 'Giuseppe Neri', phone: '+39 321654987', plate: 'KL321MN', vin: 'NERIVIN32165' }
      ];
      
      for (let i = 0; i < 5; i++) {
        const type = types[i % types.length];
        const action = actions[i % actions.length];
        const cliente = clienti[i % clienti.length];
        const [name, surname] = cliente.nome.split(' ');
        
        // Seleziona casualmente alcuni campi da modificare
        const campiUsati = campiModificati.slice(0, Math.floor(Math.random() * campiModificati.length) + 1);
        
        // Genera un ID unico
        const changeId = `test-${Date.now()}-${i}`;
        
        // Crea data di creazione e aggiornamento separate
        const createdAt = new Date(Date.now() - (i * 86400000 * 7)).toISOString(); // Ogni 7 giorni indietro
        const updatedAt = new Date(Date.now() - (i * 86400000)).toISOString(); // Ogni giorno indietro
        
        // Crea l'oggetto record
        testChanges[changeId] = {
          timestamp: updatedAt,
          actionType: action,
          entityType: type,
          entityId: `TEST-${i.toString().padStart(3, '0')}`,
          details: {
            clientName: cliente.nome,
            phone: cliente.phone,
            plate: cliente.plate,
            vin: cliente.vin,
            changes: campiUsati.join(', '),
            description: `Modifica di test ${i} (${action} ${type}): ${campiUsati.join(', ')}`,
            debugCreated: true
          },
          user: {
            username: 'admin',
            fingerprint: 'test-fingerprint',
            ip: '192.168.1.' + (10 + i),
            platform: 'debug-tool'
          },
          ipAddress: '192.168.1.' + (10 + i),
          deviceFingerprint: 'test-fingerprint',
          platform: 'debug-tool',
          
          // Aggiungi anche i campi specifici menzionati dall'utente
          name,
          surname,
          phone: cliente.phone,
          email: `${name.toLowerCase()}.${surname.toLowerCase()}@example.com`,
          plate: cliente.plate,
          vin: cliente.vin,
          createdAt: createdAt,
          updatedAt: updatedAt
        };
      }
      
      // Salva tutte le modifiche di test nel database
      await set(dbChangesRef, testChanges);
      
      // Verifica che il nodo sia stato creato
      const snapshot = await get(dbChangesRef);
      const success = snapshot.exists();
      
      console.log(`[DEBUG SERVICE] Nodo db_changes inizializzato con ${Object.keys(testChanges).length} voci di test: ${success}`);
      return success;
    } catch (error) {
      console.error("[DEBUG SERVICE] Errore durante l'inizializzazione forzata:", error);
      return false;
    }
  }
  
  // Funzione per verificare l'accesso diretto ai dati db_changes
  async checkDbChanges(): Promise<{success: boolean, data: any}> {
    try {
      console.log('DEBUG SERVICE: Verifica accesso diretto a db_changes');
      
      const database = getDatabase();
      const dbChangesRef = ref(database, 'db_changes');
      
      const snapshot = await get(dbChangesRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('DEBUG SERVICE: Accesso riuscito, dati trovati');
        console.log('DEBUG SERVICE: Chiavi trovate:', Object.keys(data));
        
        return { success: true, data };
      } else {
        console.log('DEBUG SERVICE: Accesso riuscito, ma nessun dato trovato');
        return { success: true, data: null };
      }
    } catch (error) {
      console.error('DEBUG SERVICE: Errore durante la verifica:', error);
      return { success: false, data: null };
    }
  }
}

export const debugService = new DebugService();
