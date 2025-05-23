import { RepairTool } from "@/components/admin/RepairTool";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ActivityType, useActivityLogger } from "../components/dev/ActivityLogger";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, UserIcon, InfoIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import DbChangesPage from "./DbChangesPage";

export default function AdminTools() {
  const { logs } = useActivityLogger();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [accessSearchQuery, setAccessSearchQuery] = useState("");
  const [localLogs, setLocalLogs] = useState<Activity[]>([]);
  
  // Carica i log iniziali
  useEffect(() => {
    loadLogsFromStorage();
    // Imposta un timer che ricarica i log ogni 30 secondi
    const interval = setInterval(loadLogsFromStorage, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Carica i log dal localStorage
  const loadLogsFromStorage = () => {
    try {
      const storedLogs = localStorage.getItem('activity_logs');
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        
        // Assicurati che i timestamp siano oggetti Date
        const parsedWithDates = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
        
        setLocalLogs(parsedWithDates);
        console.log(`Caricati ${parsedWithDates.length} log da localStorage`);
      }
    } catch (e) {
      console.error("Errore durante il caricamento dei log:", e);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il caricamento dei log",
        variant: "destructive"
      });
    }
  };
  
  // Funzione per aggiornare manualmente i log
  const refreshLogs = () => {
    loadLogsFromStorage();
    toast({
      title: "Log aggiornati",
      description: "I log sono stati aggiornati con successo"
    });
  };
  
  // Funzione per pulire i log duplicati nel localStorage
  const cleanupLogs = () => {
    try {
      const storedLogs = localStorage.getItem('activity_logs');
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        
        // Rimuovi i duplicati in base all'ID
        const uniqueLogs = parsedLogs.filter((log: any, index: number, self: any[]) =>
          index === self.findIndex((t) => t.id === log.id)
        );
        
        // Ordina per timestamp (più recenti prima)
        uniqueLogs.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Salva nel localStorage
        localStorage.setItem('activity_logs', JSON.stringify(uniqueLogs));
        
        // Aggiorna lo stato
        setLocalLogs(uniqueLogs);
        
        toast({
          title: "Pulizia completata",
          description: `Eliminati ${parsedLogs.length - uniqueLogs.length} log duplicati`
        });
      }
    } catch (e) {
      console.error("Errore durante la pulizia dei log:", e);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la pulizia dei log",
        variant: "destructive"
      });
    }
  };
  
  // Lista delle attività che modificano il database
  const dbActivityTypes: ActivityType[] = [
    'create_client',
    'update_client',
    'delete_client',
    'create_quote',
    'update_quote',
    'delete_quote',
    'change_quote_status',
    'create_appointment',
    'update_appointment',
    'delete_appointment'
  ];

  // Lista delle attività di accesso
  const accessActivityTypes: ActivityType[] = [
    'login',
    'logout',
    'login_failed'
  ];

  // Usa sia i log dal contesto che quelli caricati dal localStorage
  const allLogs = useMemo(() => {
    // Combina i log dal contesto e quelli caricati dal localStorage
    const combinedLogs = [...logs, ...localLogs];
    
    // Rimuovi i duplicati in base all'ID
    const uniqueLogs = combinedLogs.filter((log, index, self) =>
      index === self.findIndex((t) => t.id === log.id)
    );
    
    // Ordina per timestamp (più recenti prima)
    return uniqueLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [logs, localLogs]);

  // Filtra i log per attività nel database
  const dbLogs = useMemo(() => 
    allLogs.filter(log => 
      dbActivityTypes.includes(log.type) &&
      (searchQuery === "" || 
       log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
       log.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (log.ipAddress && log.ipAddress.includes(searchQuery)))
    ),
    [allLogs, searchQuery, dbActivityTypes]
  );

  // Filtra i log per attività di accesso
  const accessLogs = useMemo(() => 
    allLogs.filter(log => 
      accessActivityTypes.includes(log.type) &&
      (accessSearchQuery === "" || 
       log.description.toLowerCase().includes(accessSearchQuery.toLowerCase()) ||
       log.type.toLowerCase().includes(accessSearchQuery.toLowerCase()) ||
       (log.ipAddress && log.ipAddress.includes(accessSearchQuery)))
    ),
    [allLogs, accessSearchQuery, accessActivityTypes]
  );

  // Formatta il timestamp
  const formatDateTime = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy HH:mm:ss', { locale: it });
  };

  // Ottieni un'icona per il tipo di attività
  const getActivityIcon = (type: string) => {
    if (type.includes('create')) return '✨';
    if (type.includes('update')) return '✏️';
    if (type.includes('delete')) return '🗑️';
    if (type === 'login') return '🔑';
    if (type === 'login_failed') return '🚫';
    if (type === 'logout') return '🚪';
    if (type.includes('status')) return '🔄';
    return '📌';
  };

  // Ottieni una descrizione del tipo di attività
  const getActivityTypeDescription = (type: ActivityType) => {
    const descriptions: Record<ActivityType, string> = {
      'create_client': 'Creazione Cliente',
      'update_client': 'Modifica Cliente',
      'delete_client': 'Eliminazione Cliente',
      'create_quote': 'Creazione Preventivo',
      'update_quote': 'Modifica Preventivo',
      'delete_quote': 'Eliminazione Preventivo',
      'change_quote_status': 'Cambio Stato Preventivo',
      'create_appointment': 'Creazione Appuntamento',
      'update_appointment': 'Modifica Appuntamento', 
      'delete_appointment': 'Eliminazione Appuntamento',
      'login': 'Accesso',
      'logout': 'Disconnessione',
      'login_failed': 'Tentativo Fallito',
      'print_quote': 'Stampa Preventivo',
      'export_data': 'Esportazione Dati',
      'error': 'Errore'
    };
    
    return descriptions[type] || type;
  };

  // Ottieni un colore per il badge del tipo di attività
  const getActivityBadgeVariant = (type: ActivityType) => {
    if (type.includes('create')) return "default";
    if (type.includes('update')) return "secondary";
    if (type.includes('delete')) return "destructive";
    if (type === 'login') return "default";
    if (type === 'login_failed') return "destructive";
    if (type === 'logout') return "outline";
    return "default";
  };

  // Esporta logs in JSON
  const exportLogs = (logsToExport: Activity[], type: string) => {
    try {
      const dataStr = JSON.stringify(logsToExport, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `log_${type}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast({
        title: "Esportazione completata",
        description: `I log ${type === 'database' ? 'del database' : 'di accesso'} sono stati esportati correttamente`
      });
    } catch (err) {
      toast({
        title: "Errore durante l'esportazione",
        description: "Si è verificato un errore durante l'esportazione dei log",
        variant: "destructive"
      });
    }
  };

  // Crea una stringa JSON leggibile per i dettagli dell'attività
  const formatDetails = (details: Record<string, any> | undefined) => {
    if (!details) return "Nessun dettaglio";
    
    try {
      // Formatta solo le proprietà più importanti
      const formattedDetails: Record<string, any> = {};
      
      // Mostra solo alcune proprietà chiave, in base al tipo di operazione
      if (details.clientId) formattedDetails.clientId = details.clientId;
      if (details.clientName) formattedDetails.clientName = details.clientName;
      if (details.quoteId) formattedDetails.quoteId = details.quoteId;
      if (details.appointmentId) formattedDetails.appointmentId = details.appointmentId;
      if (details.timestamp) formattedDetails.timestamp = formatDateTime(new Date(details.timestamp));
      
      // Se non ci sono dettagli formattati, restituisci l'oggetto originale
      return Object.keys(formattedDetails).length > 0 
        ? JSON.stringify(formattedDetails, null, 2)
        : JSON.stringify(details, null, 2);
    } catch (e) {
      return "Errore nella formattazione dei dettagli";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Strumenti Amministrazione</h1>
      <p className="text-muted-foreground">Strumenti avanzati per la manutenzione del sistema</p>
      
      <Tabs defaultValue="repairs" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="repairs">Riparazioni</TabsTrigger>
          <TabsTrigger value="accessi">Accessi</TabsTrigger>
          <TabsTrigger value="modifiche">Modifiche al Database</TabsTrigger>
        </TabsList>
        
        <TabsContent value="repairs">
          <RepairTool />
        </TabsContent>
        
        <TabsContent value="accessi">
          <Card>
            <CardHeader>
              <CardTitle>Log di Accesso</CardTitle>
              <CardDescription>
                Registro degli accessi al sistema con identificazione IP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="relative w-full max-w-md">
                  <Input
                    placeholder="Cerca negli accessi o per IP..."
                    value={accessSearchQuery}
                    onChange={(e) => setAccessSearchQuery(e.target.value)}
                    className="pl-4"
                  />
                </div>
                <div className="flex ml-4 gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={refreshLogs}
                    title="Aggiorna log"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={cleanupLogs}
                    title="Rimuovi duplicati"
                  >
                    <RefreshCw className="h-4 w-4 rotate-90" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => exportLogs(accessLogs, 'accessi')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Esporta Log
                  </Button>
                </div>
              </div>
              
              {accessLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessun log di accesso trovato
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead className="w-[200px]">Data e Ora</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="w-[180px]">Indirizzo IP</TableHead>
                        <TableHead className="w-[80px]">Dettagli</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant={getActivityBadgeVariant(log.type)}>
                              {getActivityIcon(log.type)} {getActivityTypeDescription(log.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(new Date(log.timestamp))}</TableCell>
                          <TableCell>{log.description}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <UserIcon className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {log.ipAddress || 'N/D'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.details && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <InfoIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <pre className="text-xs max-w-xs whitespace-pre-wrap">
                                      {formatDetails(log.details)}
                                    </pre>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="modifiche">
          <DbChangesPage isEmbedded={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 