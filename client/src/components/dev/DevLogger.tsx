import { useState, useEffect, useRef } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  component?: string;
  data?: any;
}

// Singleton pattern per il DevLogger
export class DevLoggerService {
  private static instance: DevLoggerService;
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private userIp: string = "sconosciuto";

  private constructor() {
    // Carica i log dal localStorage all'inizializzazione
    try {
      const savedLogs = localStorage.getItem('dev_logger_logs');
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        this.logs = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
      
      // Ottiene l'IP utente al momento dell'inizializzazione
      this.fetchUserIp();
    } catch (error) {
      console.error('Errore nel caricamento dei log salvati:', error);
    }
  }
  
  // Ottiene l'indirizzo IP dell'utente
  private async fetchUserIp(): Promise<void> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      this.userIp = data.ip;
      
      // Registra l'accesso al sito
      this.log(`Accesso al sito da IP: ${this.userIp}`, 'info', 'AccessLog', { ip: this.userIp });
    } catch (error) {
      console.warn("Impossibile ottenere l'indirizzo IP:", error);
      this.userIp = "non disponibile";
    }
  }
  
  // Restituisce l'IP dell'utente corrente
  public getUserIp(): string {
    return this.userIp;
  }

  public static getInstance(): DevLoggerService {
    if (!DevLoggerService.instance) {
      DevLoggerService.instance = new DevLoggerService();
    }
    return DevLoggerService.instance;
  }

  // Aggiunge un nuovo log
  public log(
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info', 
    component?: string,
    data?: any
  ): void {
    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type,
      component,
      data: { ...data, userIp: this.userIp }  // Aggiungi sempre l'IP ai dati
    };
    
    this.logs.unshift(entry); // Aggiungi in cima
    
    // Limita il numero di log a 500 per evitare problemi di memoria
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }
    
    // Salva i log nel localStorage
    try {
      localStorage.setItem('dev_logger_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Errore nel salvataggio dei log:', error);
    }
    
    // Notifica tutti i listener
    this.notifyListeners();
  }

  // Ottiene tutti i log
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Cancella tutti i log
  public clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('dev_logger_logs');
    this.notifyListeners();
  }

  // Esporta i log in formato JSON
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Aggiunge un listener per le modifiche ai log
  public addListener(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notifica tutti i listener dei cambiamenti
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener([...this.logs]);
    }
  }
}

// Istanza singleton del logger
export const devLogger = DevLoggerService.getInstance();

// Componente React per il DevLogger
const DevLogger: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<{
    type: 'all' | 'info' | 'success' | 'warning' | 'error';
    search: string;
  }>({ type: 'all', search: '' });
  
  const keySequence = useRef<string[]>([]);
  const secretCode = ['a', 'l', 'o', 'g']; // "alog" come sequenza

  useEffect(() => {
    // Aggiunge un listener per i tasti premuti
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return; // Ignora se l'utente sta scrivendo in un input
      }
      
      const key = event.key.toLowerCase();
      keySequence.current = [...keySequence.current, key].slice(-secretCode.length);
      
      // Controlla se la sequenza corrisponde
      const isMatch = keySequence.current.join('') === secretCode.join('');
      if (isMatch) {
        setIsVisible(prev => !prev);
        keySequence.current = [];
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Aggiunge un listener per i logs
    const removeListener = devLogger.addListener(updatedLogs => {
      setLogs(updatedLogs);
    });
    
    // Carica i log all'avvio
    setLogs(devLogger.getLogs());
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      removeListener();
    };
  }, []);

  // Filtra i log in base al tipo e alla ricerca
  const filteredLogs = logs.filter(log => {
    // Filtra per tipo
    if (filter.type !== 'all' && log.type !== filter.type) {
      return false;
    }
    
    // Filtra per testo di ricerca
    if (filter.search && !log.message.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // Esporta i log in un file
  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(devLogger.exportLogs());
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `autoexpress-logs-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Reset dei log
  const handleClearLogs = () => {
    if (window.confirm('Sei sicuro di voler cancellare tutti i log?')) {
      devLogger.clearLogs();
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsVisible(false);
        }
      }}
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl border-2 border-primary">
        <div className="flex items-center justify-between p-4 border-b-2 border-border bg-zinc-900 text-white">
          <div className="flex flex-col">
            <div className="text-lg font-bold text-primary">
              Dev Logger
              <span className="ml-2 text-xs text-zinc-400">
                (Premi "a" seguito da "log" per mostrare/nascondere)
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              IP Utente: <span className="text-green-400 font-mono">{devLogger.getUserIp()}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={handleClearLogs} className="border-zinc-700 hover:bg-zinc-800">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportLogs} className="border-zinc-700 hover:bg-zinc-800">
              <Download className="h-4 w-4 mr-2" />
              Esporta
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setIsVisible(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex p-2 border-b-2 border-border bg-zinc-800">
          <input
            type="text"
            placeholder="Cerca nei log..."
            className="flex-1 px-3 py-1 rounded-md border border-zinc-600 bg-zinc-800 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
          />
          <select
            className="ml-2 px-3 py-1 rounded-md border border-zinc-600 bg-zinc-800 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            value={filter.type}
            onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value as any }))}
          >
            <option value="all">Tutti i tipi</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Visualizzazione dati di accesso in evidenza */}
        <div className="p-2 border-b border-zinc-700 bg-zinc-800/50">
          <div className="flex justify-between items-center">
            <div className="text-xs font-medium text-primary">
              Log di accesso
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 text-xs text-zinc-400 hover:text-white"
              onClick={() => {
                // Filtra per visualizzare solo i log di accesso
                setFilter({
                  type: 'info',
                  search: 'Accesso al sito da IP'
                });
              }}
            >
              Mostra tutti gli accessi
            </Button>
          </div>
          
          {logs.filter(log => 
            log.component === 'AccessLog' && 
            log.message.includes('Accesso al sito da IP')
          ).slice(0, 1).map(log => (
            <div 
              key={log.id}
              className="mt-1 p-2 rounded bg-zinc-900 border border-zinc-800 text-xs"
            >
              <div className="flex justify-between">
                <span className="text-green-400">
                  {log.message}
                </span>
                <span className="text-zinc-500">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        <ScrollArea className="max-h-[calc(90vh-170px)] bg-zinc-900">
          <div className="p-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">
                Nessun log trovato
              </div>
            ) : (
              filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`mb-4 p-3 rounded-md border ${
                    log.type === 'error' ? 'bg-red-950/30 border-red-900' :
                    log.type === 'warning' ? 'bg-amber-950/30 border-amber-900' :
                    log.type === 'success' ? 'bg-green-950/30 border-green-900' :
                    'bg-zinc-800/50 border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'warning' ? 'text-amber-400' :
                        log.type === 'success' ? 'text-green-400' :
                        'text-blue-400'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                      {log.component && (
                        <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                          {log.component}
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-white">
                    {log.message}
                  </div>
                  {log.data && (
                    <div className="mt-2 pt-2 border-t border-zinc-700 text-xs text-zinc-300">
                      <div className="font-medium mb-1 text-primary">Dati aggiuntivi:</div>
                      <pre className="overflow-x-auto p-2 rounded bg-black text-xs text-zinc-300 border border-zinc-800">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default DevLogger;