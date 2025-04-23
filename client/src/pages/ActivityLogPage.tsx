import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, useActivityLogger } from "../components/dev/ActivityLogger";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label"; 
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ActivityLogPage() {
  const { logs, clearLogs } = useActivityLogger();
  const { toast } = useToast();
  
  // Stato per filtro attività
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({
    login: true,
    logout: true,
    page_view: true,
    create_client: true,
    update_client: true,
    delete_client: true,
    create_quote: true,
    update_quote: true,
    delete_quote: true,
    change_quote_status: true,
    create_appointment: true,
    update_appointment: true,
    delete_appointment: true,
    print_quote: true,
    export_data: true
  });

  // Raggruppa logs per data
  const logsByDate = logs.reduce((acc: Record<string, Activity[]>, log) => {
    const date = format(new Date(log.timestamp), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {});

  // Filtra logs in base ai tipi selezionati
  const getFilteredLogs = () => {
    return logs.filter(log => 
      selectedTypes[log.type] === true
    );
  };

  const filteredLogs = getFilteredLogs();

  // Formatta il timestamp in formato leggibile
  const formatTime = (date: Date) => {
    return format(new Date(date), 'HH:mm:ss');
  };

  // Ottieni un'icona per il tipo di attività
  const getActivityIcon = (type: string) => {
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

  // Funzione per esportare i log in formato JSON
  const exportLogs = () => {
    try {
      const dataStr = JSON.stringify(logs, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `attivita_log_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast({
        title: "Esportazione completata",
        description: "I log sono stati esportati correttamente"
      });
    } catch (err) {
      toast({
        title: "Errore durante l'esportazione",
        description: "Si è verificato un errore durante l'esportazione dei log",
        variant: "destructive"
      });
    }
  };

  // Funzione per cancellare tutti i log
  const handleClearLogs = () => {
    if (window.confirm("Sei sicuro di voler cancellare tutti i log? Questa azione non può essere annullata.")) {
      clearLogs();
      toast({
        title: "Log cancellati",
        description: "Tutti i log sono stati cancellati"
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Log di Attività</h1>
          <p className="text-muted-foreground">
            Visualizza e analizza tutte le attività registrate nel sistema
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={exportLogs}>
            <Download className="h-4 w-4" />
            Esporta Log
          </Button>
          <Button variant="destructive" className="flex items-center gap-2" onClick={handleClearLogs}>
            <Trash2 className="h-4 w-4" />
            Cancella Log
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">Tutti i Log</TabsTrigger>
          <TabsTrigger value="filter">Filtra</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Log di Attività</CardTitle>
              <CardDescription>
                Totale log: {logs.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna attività registrata
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {Object.keys(logsByDate)
                      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                      .map(date => (
                        <div key={date} className="space-y-2">
                          <h3 className="text-sm font-medium sticky top-0 bg-background py-1">
                            {format(new Date(date), 'EEEE d MMMM yyyy', { locale: it })}
                          </h3>
                          <div className="space-y-1 pl-2">
                            {logsByDate[date]
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map(log => (
                                <div key={log.id} className="flex items-start py-1.5 border-b border-border last:border-0">
                                  <div className="w-6 flex-shrink-0 text-center">
                                    {getActivityIcon(log.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm">{log.description}</p>
                                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">
                                          {formatTime(new Date(log.timestamp))}
                                        </p>
                                        {log.ipAddress && (
                                          <p className="text-xs bg-background/30 px-1.5 py-0.5 rounded text-muted-foreground">
                                            IP: {log.ipAddress}
                                          </p>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {log.type}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="filter" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Filtri</CardTitle>
              <CardDescription>
                Seleziona i tipi di attività da visualizzare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-login" 
                    checked={selectedTypes.login}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, login: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-login">Login</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-logout" 
                    checked={selectedTypes.logout}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, logout: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-logout">Logout</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-page_view" 
                    checked={selectedTypes.page_view}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, page_view: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-page_view">Visite Pagine</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-create_client" 
                    checked={selectedTypes.create_client}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, create_client: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-create_client">Creazione Clienti</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-update_client" 
                    checked={selectedTypes.update_client}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, update_client: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-update_client">Modifica Clienti</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-delete_client" 
                    checked={selectedTypes.delete_client}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, delete_client: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-delete_client">Eliminazione Clienti</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-create_quote" 
                    checked={selectedTypes.create_quote}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, create_quote: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-create_quote">Creazione Preventivi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-update_quote" 
                    checked={selectedTypes.update_quote}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, update_quote: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-update_quote">Modifica Preventivi</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="filter-delete_quote" 
                    checked={selectedTypes.delete_quote}
                    onCheckedChange={(checked) => 
                      setSelectedTypes(prev => ({ ...prev, delete_quote: !!checked }))
                    }
                  />
                  <Label htmlFor="filter-delete_quote">Eliminazione Preventivi</Label>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Log Filtrati</CardTitle>
              <CardDescription>
                Risultati: {filteredLogs.length} log 
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessun risultato per il filtro selezionato
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-1">
                    {filteredLogs
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map(log => (
                        <div key={log.id} className="flex items-start py-1.5 border-b border-border last:border-0">
                          <div className="w-6 flex-shrink-0 text-center">
                            {getActivityIcon(log.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{log.description}</p>
                            <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between">
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                                </p>
                                {log.ipAddress && (
                                  <p className="text-xs bg-background/30 px-1.5 py-0.5 rounded text-muted-foreground">
                                    IP: {log.ipAddress}
                                  </p>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {log.type}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}