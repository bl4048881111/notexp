import { v4 as uuidv4 } from 'uuid';
import React, { createContext, useContext, useState } from 'react';

// Hook personalizzato per localStorage
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State per contenere il valore
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Ottieni dal localStorage in base alla chiave
      const item = window.localStorage.getItem(key);
      // Ritorna il valore se esiste, altrimenti l'initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  // Funzione di aggiornamento del valore e del localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Consenti di usare una funzione o un valore diretto
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Aggiorna lo state
      setStoredValue(valueToStore);
      // Aggiorna il localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}

// Tipi di attività che vogliamo tracciare
export type ActivityType = 
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'create_client'
  | 'update_client'
  | 'delete_client'
  | 'create_quote'
  | 'update_quote'
  | 'delete_quote'
  | 'change_quote_status'
  | 'create_appointment'
  | 'update_appointment'
  | 'delete_appointment'
  | 'print_quote'
  | 'export_data'
  | 'error';

// Interfaccia per un'attività registrata
export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  ipAddress?: string;
  details?: Record<string, any>;
  timestamp: Date;
  isLocalActivity: boolean; // Flag per distinguere attività locali da quelle web
  deviceFingerprint?: string; // Identificatore unico del dispositivo
  deviceInfo?: Record<string, string>; // Informazioni sul dispositivo
}

interface ActivityLoggerContextType {
  logs: Activity[];
  logActivity: (type: ActivityType, description: string, details?: Record<string, any>, isLocalActivity?: boolean) => void;
  clearLogs: () => void;
  getLocalActivities: () => Activity[];
}

// Creazione del contesto per il logger di attività
const ActivityLoggerContext = createContext<ActivityLoggerContextType | null>(null);

// Hook personalizzato per utilizzare il logger di attività
export const useActivityLogger = () => {
  const context = useContext(ActivityLoggerContext);
  if (!context) {
    throw new Error('useActivityLogger deve essere utilizzato all\'interno di un ActivityLoggerProvider');
  }
  return context;
};

// Provider per il logger di attività
export const ActivityLoggerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useLocalStorage<Activity[]>('activity_logs', []);

  // Funzione per ottenere l'indirizzo IP dell'utente
  const getUserIP = async (): Promise<string> => {
    try {
      // Prima controlla se l'IP è già disponibile nel DevLogger
      try {
        const { devLogger } = require('./DevLogger');
        const ip = devLogger.getUserIp();
        
        // Se l'IP è disponibile e non è il valore predefinito, lo utilizziamo
        if (ip && ip !== "sconosciuto" && ip !== "non disponibile") {
          return ip;
        }
      } catch (error) {
        console.warn("DevLogger non disponibile:", error);
      }
      
      // Fallback: utilizziamo un servizio esterno per ottenere l'IP
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn("Impossibile ottenere l'indirizzo IP:", error);
      return "unknown";
    }
  };

  // Funzione per registrare una nuova attività
  const logActivity = async (
    type: ActivityType, 
    description: string, 
    details?: Record<string, any>,
    isLocalActivity: boolean = false // Di default, le attività non sono locali
  ) => {
    // Ottieni indirizzo IP per tutti i tipi di attività
    let ipAddress = undefined;
    let deviceFingerprint = undefined;
    let deviceInfo = undefined;
    
    // Ottieni informazioni sull'identità dall'authService
    try {
      const { authService } = await import('../../services/authService');
      const identityInfo = await authService.getIdentityInfo();
      ipAddress = identityInfo.ip;
      deviceFingerprint = identityInfo.fingerprint;
      deviceInfo = identityInfo.deviceInfo;
    } catch (error) {
      console.warn("Impossibile ottenere le informazioni di identità:", error);
      
      // Se i dettagli includono già un indirizzo IP, usalo come fallback
      if (details && details.ipAddress) {
        ipAddress = details.ipAddress;
        // Rimuovi l'IP dai dettagli per evitare duplicazioni
        const { ipAddress: _, ...restDetails } = details;
        details = restDetails;
      } 
      // Altrimenti ottieni l'IP per qualsiasi tipo di attività come ultimo fallback
      else {
        try {
          ipAddress = await getUserIP();
        } catch (error) {
          console.warn("Impossibile ottenere l'IP:", error);
          ipAddress = "unknown";
        }
      }
    }
    
    const newActivity: Activity = {
      id: uuidv4(),
      type,
      description,
      ipAddress,
      details,
      timestamp: new Date(),
      isLocalActivity,
      deviceFingerprint,
      deviceInfo
    };

    // Aggiungi al logger di sviluppo se disponibile
    try {
      const { devLogger } = require('./DevLogger');
      devLogger.log(
        `${description}`, 
        type.includes('create') ? 'success' : 
        type.includes('update') ? 'info' : 
        type.includes('delete') ? 'warning' : 'info', 
        'ActivityLog',
        details ? { ...details, ipAddress } : { ipAddress }
      );
    } catch (error) {
      // Se il logger di sviluppo non è disponibile, fallback su console
      console.log(`[Attività] ${description}`, details || {}, `IP: ${ipAddress}`);
    }

    // Recupera i log attuali e aggiungi il nuovo - Questo garantisce che tutti i log vengano salvati
    let currentLogs: Activity[] = [];
    try {
      const storedLogs = localStorage.getItem('activity_logs');
      if (storedLogs) {
        currentLogs = JSON.parse(storedLogs);
      }
    } catch (e) {
      console.error("Errore durante il recupero dei log:", e);
    }

    // Aggiungi il nuovo log all'inizio dell'array
    const updatedLogs = [newActivity, ...currentLogs].slice(0, 500);

    // Salva direttamente nel localStorage
    try {
      localStorage.setItem('activity_logs', JSON.stringify(updatedLogs));
    } catch (e) {
      console.error("Errore durante il salvataggio dei log:", e);
    }

    // Aggiorna lo stato
    setLogs(updatedLogs);
  };

  // Funzione per ottenere solo le attività locali
  const getLocalActivities = () => {
    return logs.filter(log => log.isLocalActivity);
  };

  // Funzione per cancellare tutti i log
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <ActivityLoggerContext.Provider value={{ logs, logActivity, clearLogs, getLocalActivities }}>
      {children}
    </ActivityLoggerContext.Provider>
  );
};

// Componente per visualizzare i log delle attività recenti
export const RecentActivityList: React.FC<{ 
  limit?: number; 
  showTitle?: boolean;
  filtered?: ActivityType[];
  localOnly?: boolean; // Nuovo parametro per filtrare solo attività locali
}> = ({ limit = 5, showTitle = true, filtered, localOnly = false }) => {
  const { logs, getLocalActivities } = useActivityLogger();
  
  // Ottieni i log appropriati
  const sourceLogs = localOnly ? getLocalActivities() : logs;
  
  // Filtra i log in base al tipo se necessario
  const filteredLogs = filtered 
    ? sourceLogs.filter(log => filtered.includes(log.type))
    : sourceLogs;
  
  // Prendi solo i log più recenti fino al limite
  const recentLogs = filteredLogs.slice(0, limit);

  // Formatta il timestamp in formato locale leggibile
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Se non ci sono log, mostra un messaggio
  if (recentLogs.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Nessuna attività registrata
      </div>
    );
  }

  // Icona per ogni tipo di attività
  const getActivityIcon = (type: ActivityType) => {
    if (type.includes('create')) return '✨';
    if (type.includes('update')) return '✏️';
    if (type.includes('delete')) return '🗑️';
    if (type.includes('login')) return '🔑';
    if (type.includes('logout')) return '🚪';
    if (type.includes('print')) return '🖨️';
    if (type.includes('export')) return '📤';
    if (type.includes('status')) return '🔄';
    if (type.includes('error')) return '⚠️';
    return '📌';
  };

  return (
    <div className="space-y-2">
      {showTitle && <h3 className="text-lg font-medium mb-3">Attività Recenti</h3>}
      
      <div className="space-y-1">
        {recentLogs.map(log => (
          <div key={log.id} className="flex items-start py-1.5 border-b border-border last:border-0">
            <div className="w-6 flex-shrink-0 text-center">
              {getActivityIcon(log.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{log.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(new Date(log.timestamp))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default useActivityLogger;