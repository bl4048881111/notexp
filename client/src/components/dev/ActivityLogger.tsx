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
}

interface ActivityLoggerContextType {
  logs: Activity[];
  logActivity: (type: ActivityType, description: string, details?: Record<string, any>) => void;
  clearLogs: () => void;
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
      // Utilizziamo un servizio esterno per ottenere l'IP
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn("Impossibile ottenere l'indirizzo IP:", error);
      return "unknown";
    }
  };

  // Funzione per registrare una nuova attività
  const logActivity = async (type: ActivityType, description: string, details?: Record<string, any>) => {
    // Ottieni indirizzo IP solo per log di operazioni su database o errori
    let ipAddress = undefined;
    if (type !== 'login' && type !== 'logout' && type !== 'page_view') {
      ipAddress = await getUserIP();
    }
    
    const newActivity: Activity = {
      id: uuidv4(),
      type,
      description,
      ipAddress,
      details,
      timestamp: new Date()
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
        details || {}
      );
    } catch (error) {
      // Se il logger di sviluppo non è disponibile, fallback su console
      console.log(`[Attività] ${description}`, details || {});
    }

    setLogs(prev => {
      // Limita il numero di log salvati
      const newLogs = [newActivity, ...prev];
      return newLogs.slice(0, 100); // Mantiene solo gli ultimi 100 log
    });
  };

  // Funzione per cancellare tutti i log
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <ActivityLoggerContext.Provider value={{ logs, logActivity, clearLogs }}>
      {children}
    </ActivityLoggerContext.Provider>
  );
};

// Componente per visualizzare i log delle attività recenti
export const RecentActivityList: React.FC<{ 
  limit?: number; 
  showTitle?: boolean;
  filtered?: ActivityType[];
}> = ({ limit = 5, showTitle = true, filtered }) => {
  const { logs } = useActivityLogger();
  
  // Filtra i log in base al tipo se necessario
  const filteredLogs = filtered 
    ? logs.filter(log => filtered.includes(log.type))
    : logs;
  
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
    if (type.includes('page_view')) return '👁️';
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