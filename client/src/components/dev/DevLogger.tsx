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
    } catch (error) {
      console.error('Errore nel caricamento dei log salvati:', error);
    }
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
      data
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
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsVisible(false);
        }
      }}
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="text-lg font-bold">
            Dev Logger
            <span className="ml-2 text-xs text-muted-foreground">
              (Premi "a" seguito da "log" per mostrare/nascondere)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={handleClearLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Esporta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsVisible(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex p-2 border-b border-border bg-card">
          <input
            type="text"
            placeholder="Cerca nei log..."
            className="flex-1 px-3 py-1 rounded-md border border-input text-sm"
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
          />
          <select
            className="ml-2 px-3 py-1 rounded-md border border-input text-sm"
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
        
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-4 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground p-6">
                Nessun log da visualizzare
              </div>
            ) : (
              filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`p-3 rounded-md border ${
                    log.type === 'error' ? 'bg-destructive/10 border-destructive/30' :
                    log.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    log.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                    'bg-card border-border'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium">
                      {log.component && (
                        <span className="bg-primary/10 text-primary py-0.5 px-1.5 rounded-md text-xs mr-2">
                          {log.component}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-md text-xs ${
                        log.type === 'error' ? 'bg-destructive/20 text-destructive' :
                        log.type === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                        log.type === 'success' ? 'bg-green-500/20 text-green-500' :
                        'bg-primary/20 text-primary'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {log.message}
                  </div>
                  {log.data && (
                    <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Dati aggiuntivi:</div>
                      <pre className="overflow-x-auto p-2 rounded bg-muted text-xs">
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