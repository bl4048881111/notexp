import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { FileDown, RefreshCw, Info, Plus, Bug } from 'lucide-react';
import { dbService } from '@/services/db-service';
import { ensureDbChangesNodeExists, registerDatabaseChange } from '@shared/firebase';
import { debugService } from '@/services/authService';
import { useLocation } from 'wouter';
import { getLatestChanges } from '@/services/db-service';
import { verifyDatabaseNode } from '@/firebase';
import { clearAllDatabaseChanges, clearOtherPCChanges, resetDatabase } from '@/services/db-service';

// Interfaccia per le modifiche al database aggiornata per riflettere la struttura reale
interface DbChange {
  id: string;
  timestamp: string;
  actionType: 'create' | 'update' | 'delete';
  entityType: 'client' | 'quote' | 'appointment' | 'system';
  entityId: string;
  details: {
    changes?: string;
    clientName?: string;
    description?: string;
    deviceFingerprint?: string;
    [key: string]: any;
  };
  user: {
    username: string;
    fingerprint: string;
    ip: string;
    platform: string;
    timestamp?: string;
  };
  ipAddress?: string;
  deviceFingerprint?: string;
  platform?: string;
}

// Componente per visualizzare i dati grezzi
function RawDbData({ data }: { data: any[] | null }) {
  if (!data) return <div>Nessun dato disponibile</div>;
  
  return (
    <div className="mt-4 p-4 bg-gray-100 rounded">
      <h3 className="text-lg font-semibold mb-2">Dati Grezzi dal Database</h3>
      <pre className="whitespace-pre-wrap overflow-auto max-h-96 bg-white p-2 text-xs border">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function DbChangesPage({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [changes, setChanges] = useState<DbChange[]>([]);
  const [filteredChanges, setFilteredChanges] = useState<DbChange[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [limit, setLimit] = useState<number>(100);
  const [detailsVisible, setDetailsVisible] = useState<Record<string, boolean>>({});
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isDbNodeInitialized, setIsDbNodeInitialized] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugAttempts, setDebugAttempts] = useState<number>(0);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isFilteringOtherPC, setIsFilteringOtherPC] = useState<boolean>(false);

  // Utilizzo corretto di useLocation da wouter
  const [location] = useLocation();
  const isDirectDatabasePage = location === '/database';

  // Funzione di logging
  const addDebugLog = useCallback((message: string) => {
    console.log("[DEBUG]", message);
    setDebugLogs(prev => [...prev, `${new Date().toISOString()} - ${message}`]);
  }, []);

  // Funzione per ricaricare i dati
  const reloadData = () => {
    addDebugLog("Ricaricamento dati manuale richiesto");
    loadDbChanges();
  };

  // Carica le modifiche dal database
  useEffect(() => {
    loadDbChanges();
  }, [limit]);

  // Miglioro ulteriormente la funzione transformDbData per gestire formati specifici di dati
  const transformDbData = (data: Record<string, any>[]): DbChange[] => {
    try {
      // Log per debug
      addDebugLog(`Trasformazione dati: ricevuti ${data.length} elementi`);
      
      // Trasforma l'array ricevuto con controlli specifici per i campi richiesti
      const result = data.map((item, index) => {
        if (!item || typeof item !== 'object') {
          addDebugLog(`Valore non valido in trasformazione all'indice ${index}: ${JSON.stringify(item)}`);
          return null;
        }
        
        try {
          // Estrai i campi specifici dall'item o dai suoi campi interni
          const extractField = (fieldName: string): any => {
            // Cerca prima nell'oggetto principale
            if (item[fieldName] !== undefined) return item[fieldName];
            // Poi nei details
            if (item.details && item.details[fieldName] !== undefined) return item.details[fieldName];
            // Poi nell'oggetto user
            if (item.user && item.user[fieldName] !== undefined) return item.user[fieldName];
            // Prova a usare campi diversi ma correlati
            const alternativeFields: Record<string, string[]> = {
              'username': ['user', 'name', 'username'],
              'clientName': ['clientName', 'client_name', 'name', 'cliente']
            };
            
            if (alternativeFields[fieldName]) {
              for (const altField of alternativeFields[fieldName]) {
                if (item[altField] !== undefined) return item[altField];
                if (item.details && item.details[altField] !== undefined) return item.details[altField];
              }
            }
            
            return undefined;
          };
          
          // Estrai o componi un testo per i campi modificati
          let changes = '';
          if (item.details && item.details.changes) {
            changes = item.details.changes;
          } else if (item.changes) {
            changes = item.changes;
          } else {
            // Prova a costruire l'elenco di campi modificati dai campi specifici
            const specificFields = ['name', 'surname', 'phone', 'email', 'plate', 'vin', 'createdAt', 'updatedAt'];
            const foundFields = specificFields.filter(field => 
              item[field] !== undefined || 
              (item.details && item.details[field] !== undefined)
            );
            
            if (foundFields.length > 0) {
              changes = foundFields.join(', ');
            }
          }
          
          // Costruisci un oggetto details più completo
          const details = {
            ...(item.details || {}),
            clientName: extractField('clientName') || 
                       (extractField('name') && extractField('surname') ? 
                        `${extractField('name')} ${extractField('surname')}` : undefined),
            changes: changes
          };
          
          // Gestione più flessibile dei campi mancanti
          const transformedItem: DbChange = {
            // Campi obbligatori con fallback
            id: item.id || `unknown-${index}`,
            timestamp: item.timestamp || new Date().toISOString(),
            actionType: (item.actionType as any) || 'update',
            entityType: (item.entityType as any) || 'system',
            entityId: item.entityId || '',
            
            // Usa il details arricchito
            details: details,
            
            // Gestione diversa della struttura user
            user: {
              username: extractField('username') || 'unknown',
              fingerprint: item.user?.fingerprint || item.deviceFingerprint || '',
              ip: item.user?.ip || item.ipAddress || '',
              platform: item.user?.platform || item.platform || ''
            },
            
            // Altri campi opzionali
            ipAddress: item.ipAddress || item.user?.ip || '',
            deviceFingerprint: item.deviceFingerprint || item.user?.fingerprint || '',
            platform: item.platform || item.user?.platform || ''
          };
          
          // Log per debug
          if (index < 2) {
            addDebugLog(`Trasformazione elemento ${index} riuscita: ${transformedItem.id}, action=${transformedItem.actionType}, entity=${transformedItem.entityType}`);
            if (transformedItem.details.clientName) {
              addDebugLog(`Cliente: ${transformedItem.details.clientName}`);
            }
            if (changes) {
              addDebugLog(`Campi modificati: ${changes}`);
            }
          }
          
          return transformedItem;
        } catch (err) {
          addDebugLog(`Errore durante la trasformazione dell'elemento ${index}: ${err}`);
          
          // Tenta di creare un oggetto minimo funzionante
          try {
            return {
              id: item.id || `error-${index}`,
              timestamp: new Date().toISOString(),
              actionType: 'update' as any,
              entityType: 'system' as any,
              entityId: 'error',
              details: { 
                error: String(err), 
                originalData: JSON.stringify(item).substring(0, 100),
                clientName: 'Errore di conversione',
                changes: 'errore'
              },
              user: { username: 'error', fingerprint: '', ip: '', platform: '' },
              ipAddress: '',
              deviceFingerprint: '',
              platform: ''
            };
          } catch {
            return null;
          }
        }
      }).filter(Boolean) as DbChange[];
      
      // Ordina per timestamp, più recenti per primi
      result.sort((a, b) => {
        try {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateB - dateA;
        } catch {
          return 0;
        }
      });
      
      // Log per debug
      addDebugLog(`Trasformazione completata: generati ${result.length} elementi validi`);
      
      return result;
    } catch (err) {
      addDebugLog(`Errore generale in transformDbData: ${err}`);
      return [];
    }
  };

  // Funzione per caricare le modifiche
  const loadDbChanges = async () => {
    try {
      setLoading(true);
      setError('');
      addDebugLog("Inizio caricamento modifiche al database");
      
      // Verifica diretta del nodo db_changes prima di procedere
      try {
        const nodeCheck = await verifyDatabaseNode('db_changes');
        if (nodeCheck.exists) {
          addDebugLog(`Nodo db_changes verificato: contiene ${nodeCheck.count} record`);
          if (nodeCheck.keys && nodeCheck.keys.length > 0) {
            const sampleKeys = nodeCheck.keys.slice(0, 3);
            addDebugLog(`Esempi di chiavi: ${sampleKeys.join(', ')}`);
          }
        } else {
          addDebugLog("ERRORE: Il nodo db_changes non esiste!");
          // Tenta di creare il nodo
          await handleForceDbInit();
        }
      } catch (checkErr) {
        addDebugLog(`Errore durante la verifica del nodo: ${checkErr}`);
      }
      
      // Utilizzo direttamente getLatestChanges dalla nostra libreria di servizi
      const changesData = await getLatestChanges(100);
      
      if (!changesData || changesData.length === 0) {
        addDebugLog("Nessuna modifica trovata nel database");
        setChanges([]);
        setFilteredChanges([]);
        return;
      }
      
      // Log dettagliato
      addDebugLog(`Dati recuperati: ${changesData.length} elementi`);
      if (changesData.length > 0) {
        try {
          const sampleItem = changesData[0];
          addDebugLog(`Primo elemento: id=${sampleItem.id}, type=${sampleItem.entityType || 'N/D'}, action=${sampleItem.actionType || 'N/D'}`);
          // Visualizziamo i primi due elementi in JSON per debug
          addDebugLog(`Primi due elementi: ${JSON.stringify(changesData.slice(0, 2)).substring(0, 300)}...`);
          
          // Salva un esempio completo nel debug info
          setDebugInfo(JSON.stringify({
            totalItems: changesData.length,
            firstItem: changesData[0],
            secondItem: changesData.length > 1 ? changesData[1] : null,
            itemKeys: changesData.map(item => item.id).slice(0, 5)
          }, null, 2));
        } catch (logErr) {
          addDebugLog(`Errore durante il log dei dati: ${logErr}`);
        }
      }
      
      // Trasformo i dati nel formato DbChange con controlli più sicuri
      try {
        const formattedChanges = transformDbData(changesData);
        
        if (formattedChanges.length === 0) {
          addDebugLog("ATTENZIONE: Nessun elemento dopo la trasformazione!");
          addDebugLog(`Confronto: ${changesData.length} elementi prima, 0 dopo`);
          
          // Prova a mostrare direttamente i dati raw in caso di errore di trasformazione
          setChanges(changesData as any[]);
          setFilteredChanges(changesData as any[]);
        } else {
          addDebugLog(`Dopo trasformazione: ${formattedChanges.length} elementi validi`);
          
          // Aggiorniamo esplicitamente anche filteredChanges
          setChanges(formattedChanges);
          setFilteredChanges(formattedChanges);
        }
      } catch (transformErr) {
        addDebugLog(`ERRORE durante la trasformazione: ${transformErr}`);
        // Fallback: usa i dati raw
        setChanges(changesData as any[]);
        setFilteredChanges(changesData as any[]);
      }
      
      // Log finale
      setDebugAttempts(prev => prev + 1);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Errore nel caricamento: ${errorMessage}`);
      setError(`Si è verificato un errore: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtra le modifiche in base alla ricerca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredChanges(changes);
      return;
    }
    
    const query = searchTerm.toLowerCase();
    const filtered = changes.filter(change => {
      // Gestione sicura per i campi che potrebbero essere undefined
      const entityId = change.entityId?.toLowerCase() || '';
      const clientName = change.details?.clientName?.toLowerCase() || '';
      const ipAddress = change.ipAddress?.toLowerCase() || '';
      const username = change.user?.username?.toLowerCase() || '';
      const entityType = change.entityType?.toLowerCase() || '';
      const actionType = change.actionType?.toLowerCase() || '';
      
      return entityId.includes(query) ||
        clientName.includes(query) ||
        ipAddress.includes(query) ||
        username.includes(query) ||
        entityType.includes(query) ||
        actionType.includes(query);
    });
    
    setFilteredChanges(filtered);
  }, [searchTerm, changes]);
  
  // Formatta il tipo di entità in italiano
  const formatEntityType = (type: string): string => {
    const types: Record<string, string> = {
      'client': 'Cliente',
      'quote': 'Preventivo',
      'appointment': 'Appuntamento',
      'system': 'Sistema'
    };
    
    return types[type] || type;
  };
  
  // Formatta il tipo di azione in italiano
  const formatActionType = (type: string): string => {
    const types: Record<string, string> = {
      'create': 'Creazione',
      'update': 'Modifica',
      'delete': 'Eliminazione'
    };
    
    return types[type] || type;
  };
  
  // Ottiene il colore del badge in base al tipo di azione
  const getActionBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'create': 'default',
      'update': 'secondary',
      'delete': 'destructive'
    };
    
    return variants[type] || 'outline';
  };
  
  // Mostra o nasconde i dettagli di una modifica
  const toggleDetails = (id: string) => {
    setDetailsVisible((prev: Record<string, boolean>) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Esporta le modifiche in formato JSON
  const handleExport = () => {
    const data = JSON.stringify(filteredChanges, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `db_changes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  // Crea una modifica di test
  const createTestChange = async () => {
    try {
      setLoading(true);
      
      await registerDatabaseChange(
        'create',
        'client',
        'TEST_CLIENT_001',
        {
          clientName: 'Cliente di Test',
          phone: '+39 123456789',
          description: 'Modifica di test creata manualmente'
        }
      );
      
      // Attendiamo un po' per assicurarci che la modifica sia stata registrata
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Ricarichiamo le modifiche
      await loadDbChanges();
      
    } catch (error) {
      console.error('Errore durante la creazione della modifica di test:', error);
      setError(`Errore durante la creazione della modifica di test: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi funzione per la reinizializzazione completa
  const handleForceDbInit = async () => {
    try {
      setLoading(true);
      addDebugLog("Inizializzazione forzata del database...");
      
      await debugService.forceInitDbChanges();
      addDebugLog("Inizializzazione forzata completata");
      
      // Ricarica i dati
      await loadDbChanges();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Errore durante l'inizializzazione forzata: ${errorMessage}`);
      setError(`Errore durante l'inizializzazione forzata: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Aggiungo nuova funzione per verifica diretta
  const handleVerifyDbNode = async () => {
    addDebugLog("Verifica diretta del nodo db_changes...");
    try {
      const result = await verifyDatabaseNode('db_changes');
      if (result.exists) {
        addDebugLog(`Nodo db_changes verificato: contiene ${result.count} record`);
        if (result.keys && result.keys.length > 0) {
          const sampleKeys = result.keys.slice(0, 3);
          addDebugLog(`Esempi di chiavi: ${sampleKeys.join(', ')}`);
          
          // Popola il debugInfo con i dati
          setDebugInfo(JSON.stringify({
            nodeExists: true,
            recordCount: result.count,
            sampleKeys,
            firstRecord: result.data[result.keys[0]]
          }, null, 2));
          
          // Riprova il caricamento con i nuovi dati
          await loadDbChanges();
        }
      } else {
        addDebugLog("Il nodo db_changes NON esiste o è vuoto!");
        setDebugInfo(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      addDebugLog(`Errore durante la verifica diretta: ${err}`);
    }
  };

  // Funzione per cancellare i log dal database
  const handleClearLogs = async () => {
    try {
      if (window.confirm('Sei sicuro di voler cancellare tutti i log dal database? Questa operazione non può essere annullata.')) {
        setIsClearing(true);
        addDebugLog("Pulizia dei log nel database in corso...");
        
        const result = await clearAllDatabaseChanges();
        
        if (result.success) {
          addDebugLog(`Cancellazione completata: ${result.deletedCount} record eliminati`);
          setChanges([]);
          setFilteredChanges([]);
        } else {
          addDebugLog(`Errore durante la cancellazione: ${result.error}`);
          setError(`Errore: ${result.error}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Errore durante la cancellazione: ${errorMessage}`);
      setError(`Si è verificato un errore durante la cancellazione: ${errorMessage}`);
    } finally {
      setIsClearing(false);
    }
  };

  // Funzione per cancellare i log di altri PC
  const handleClearOtherPCLogs = async () => {
    try {
      if (window.confirm('Sei sicuro di voler cancellare i log provenienti da altri PC? I tuoi log verranno conservati.')) {
        setIsFilteringOtherPC(true);
        addDebugLog("Eliminazione log di altri PC in corso...");
        
        const result = await clearOtherPCChanges();
        
        if (result.success) {
          addDebugLog(`Eliminazione completata: rimossi ${result.deletedCount} log di altri PC, conservati ${result.keptCount} log locali`);
          // Ricarica i dati
          await loadDbChanges();
        } else {
          addDebugLog(`Errore durante l'eliminazione: ${result.error}`);
          setError(`Errore: ${result.error}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Errore durante l'eliminazione dei log di altri PC: ${errorMessage}`);
      setError(`Si è verificato un errore: ${errorMessage}`);
    } finally {
      setIsFilteringOtherPC(false);
    }
  };

  // Funzione per renderizzare il contenuto principale
  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Caricamento modifiche in corso...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-destructive">{error}</p>
          <p className="text-muted-foreground mt-2">
            Prova a verificare che le modifiche siano state registrate correttamente nel database.
          </p>
          <div className="flex justify-center mt-4">
            <Button 
              onClick={createTestChange}
              className="mx-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crea modifica di test
            </Button>
          </div>
          {debugInfo && (
            <div className="mt-4 text-left p-3 border rounded bg-muted text-xs font-mono overflow-auto max-h-48">
              <p>Informazioni di debug:</p>
              <pre>{debugInfo}</pre>
            </div>
          )}
        </div>
      );
    }
    
    if (filteredChanges.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-amber-600 font-medium mb-2">Nessuna modifica al database trovata.</p>
          <p className="text-muted-foreground mb-4">
            Il sistema non è riuscito a trovare modifiche nel nodo 'db_changes' del database.
            <br />
            Per risolvere il problema, puoi:
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <Button 
              onClick={reloadData}
              variant="outline"
              className="mx-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Riprova caricamento
            </Button>
            
            <Button 
              onClick={handleVerifyDbNode}
              variant="outline"
              className="mx-2"
            >
              <Info className="mr-2 h-4 w-4" />
              Verifica diretta nodo
            </Button>
            
            <Button 
              onClick={createTestChange}
              variant="outline"
              className="mx-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crea modifica di test
            </Button>
            
            <Button 
              variant="destructive"
              size="sm" 
              onClick={handleForceDbInit}
              disabled={loading}
            >
              <Bug className="mr-2 h-4 w-4" />
              Forza Inizializzazione DB
            </Button>
            
            <Button 
              variant="destructive"
              size="sm" 
              onClick={handleClearLogs}
              disabled={loading || isClearing}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
                {isClearing ? 'Cancellazione...' : 'Cancella Log DB'}
              </div>
            </Button>
          </div>
          
          <div className="mt-6 p-4 border border-amber-300 rounded bg-amber-50 text-amber-800">
            <p className="font-medium mb-2">Informazioni diagnostiche:</p>
            <ul className="list-disc list-inside text-sm">
              <li>Tentativo #{debugAttempts} di caricamento dati</li>
              <li>Logs di debug attivi: {debugLogs.length}</li>
              {debugLogs.length > 0 && (
                <li>Ultimo log: {debugLogs[debugLogs.length - 1].split(' - ')[1]}</li>
              )}
            </ul>
            
            {debugInfo && (
              <div className="mt-4 text-left p-3 border rounded bg-muted text-xs font-mono overflow-auto max-h-48">
                <p>Dati disponibili (se presenti):</p>
                <pre>{debugInfo}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Data e Ora</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Indirizzo IP</TableHead>
              <TableHead>Dettagli</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChanges.map((change) => (
              <TableRow key={change.id}>
                <TableCell>
                  <Badge 
                    variant={getActionBadgeVariant(change.actionType)}
                    className="whitespace-nowrap"
                  >
                    {formatActionType(change.actionType)}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatEntityType(change.entityType)}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {change.timestamp ? (
                    <div>
                      {(() => {
                        try {
                          return format(new Date(change.timestamp), 'dd/MM/yyyy HH:mm:ss');
                        } catch (e) {
                          return change.timestamp;
                        }
                      })()}
                    </div>
                  ) : (
                    'Data non disponibile'
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    {change.details?.clientName ? (
                      <span className="font-medium">{change.details.clientName}</span>
                    ) : (
                      <span className="font-medium">{change.entityId}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      ID: {change.entityId}
                    </div>
                  </div>
                  {change.details?.changes && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <strong>Campi modificati:</strong> {change.details.changes.includes(',') ? 
                        change.details.changes.split(',').map(c => c.trim()).filter(Boolean).join(', ') : 
                        change.details.changes}
                    </div>
                  )}
                  {change.details?.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {change.details.description}
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="font-mono text-xs">
                    {change.ipAddress || change.user?.ip || 'N/D'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {change.platform || change.user?.platform || 'Sconosciuto'}
                  </div>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleDetails(change.id)}
                    title="Mostra/nascondi dettagli"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                  
                  {detailsVisible[change.id] && (
                    <div className="mt-2 text-xs p-2 border rounded bg-muted/20">
                      <div className="grid grid-cols-2 gap-1">
                        <div><strong>ID Modifica:</strong> {change.id}</div>
                        <div><strong>Timestamp:</strong> {change.timestamp}</div>
                        <div><strong>Tipo:</strong> {formatActionType(change.actionType)}</div>
                        <div><strong>Entità:</strong> {formatEntityType(change.entityType)} ({change.entityId})</div>
                      </div>
                      
                      {change.user && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="font-medium mb-1">Utente:</div>
                          <div className="grid grid-cols-2 gap-1 pl-2">
                            <div><strong>Nome:</strong> {change.user.username || 'N/D'}</div>
                            <div><strong>IP:</strong> {change.user.ip || change.ipAddress || 'N/D'}</div>
                            <div><strong>Platform:</strong> {change.user.platform || change.platform || 'N/D'}</div>
                            <div><strong>Device ID:</strong> {(change.user.fingerprint || change.deviceFingerprint || '').substring(0, 8)}...</div>
                          </div>
                        </div>
                      )}
                      
                      {change.details && Object.keys(change.details).length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="font-medium mb-1">Dettagli:</div>
                          <div className="pl-2">
                            {Object.entries(change.details).map(([key, value]) => (
                              <div key={key} className="mb-1">
                                <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Modifico la struttura di ritorno per gestire l'embedding
  return (
    <div className="space-y-6">
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pb-2">
          <Heading 
            title={isDirectDatabasePage ? "Modifiche al Database" : "Registro Modifiche Database"} 
            description="Cronologia delle operazioni di modifica del database con identificazione IP" 
          />
          
          <div className="flex flex-wrap w-full sm:w-auto gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={reloadData}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Caricamento...' : 'Ricarica'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              disabled={filteredChanges.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Esporta Log
            </Button>
            
            <Button 
              variant="default"
              size="sm" 
              onClick={handleClearOtherPCLogs}
              disabled={loading || isFilteringOtherPC}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"></path>
                  <line x1="18" y1="9" x2="12" y2="15"></line>
                  <line x1="12" y1="9" x2="18" y2="15"></line>
                </svg>
                {isFilteringOtherPC ? 'Elaborazione...' : 'Elimina Altri PC'}
              </div>
            </Button>
            
            <Button 
              variant="destructive"
              size="sm" 
              onClick={handleForceDbInit}
              disabled={loading}
            >
              <Bug className="mr-2 h-4 w-4" />
              Forza Inizializzazione DB
            </Button>
            
            <Button 
              variant="destructive"
              size="sm" 
              onClick={handleClearLogs}
              disabled={loading || isClearing}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
                {isClearing ? 'Cancellazione...' : 'Cancella Log DB'}
              </div>
            </Button>
          </div>
        </div>
      )}
      
      {!isEmbedded ? (
        <Card>
          <CardHeader>
            <CardTitle>{isDirectDatabasePage ? "Registro Modifiche" : "Modifiche Recenti"}</CardTitle>
            <CardDescription>
              Visualizzazione di {filteredChanges.length} modifiche 
              {searchTerm ? ` per ricerca "${searchTerm}"` : ''}
            </CardDescription>
            <div className="mt-4">
              <Input
                placeholder="Cerca nelle modifiche per cliente, ID o IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">Modifiche al Database</h3>
              <p className="text-sm text-muted-foreground">
                Visualizzazione di {filteredChanges.length} modifiche 
                {searchTerm ? ` per ricerca "${searchTerm}"` : ''}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={reloadData}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '...' : 'Ricarica'}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleVerifyDbNode}
              >
                <Info className="mr-2 h-4 w-4" />
                Verifica
              </Button>
              
              <Button 
                variant="default"
                size="sm" 
                onClick={handleClearOtherPCLogs}
                disabled={isFilteringOtherPC}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"></path>
                    <line x1="18" y1="9" x2="12" y2="15"></line>
                    <line x1="12" y1="9" x2="18" y2="15"></line>
                  </svg>
                  {isFilteringOtherPC ? '...' : 'Solo Miei'}
                </div>
              </Button>
              
              <Button 
                variant="destructive"
                size="sm" 
                onClick={handleClearLogs}
                disabled={isClearing}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                  </svg>
                  {isClearing ? '...' : 'Cancella'}
                </div>
              </Button>
            </div>
          </div>
          
          <div className="mb-4">
            <Input
              placeholder="Cerca nelle modifiche per cliente, ID o IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {renderContent()}
        </div>
      )}
      
      {/* Logs di debug sempre visibili, ma solo se ci sono e non in embedded mode */}
      {!isEmbedded && debugLogs.length > 0 && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="text-lg font-semibold mb-2">Log di Debug</h3>
          <div className="bg-black text-green-400 p-2 font-mono text-xs overflow-auto max-h-60">
            {debugLogs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
          <button 
            className="mt-2 bg-gray-500 text-white py-1 px-3 rounded text-sm"
            onClick={() => setDebugLogs([])}
          >
            Cancella Log
          </button>
        </div>
      )}
      
      {!isEmbedded && <RawDbData data={changes} />}
    </div>
  );
}