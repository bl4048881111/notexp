import { useState, useMemo } from 'react';
import { Activity, useActivityLogger } from '@/components/dev/ActivityLogger';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Trash, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ActivityLogPage() {
  const { logs, clearLogs, getLocalActivities } = useActivityLogger();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [showLocalOnly, setShowLocalOnly] = useState(true); // Mostra solo attività locali di default

  // Ottieni tutti i possibili tipi di attività dai log
  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    const logsToAnalyze = showLocalOnly ? getLocalActivities() : logs;
    logsToAnalyze.forEach(log => types.add(log.type));
    return Array.from(types).sort();
  }, [logs, getLocalActivities, showLocalOnly]);

  // Filtra i log in base alla ricerca e ai filtri
  const filteredLogs = useMemo(() => {
    const sourceLogs = showLocalOnly ? getLocalActivities() : logs;
    
    return sourceLogs.filter(log => {
      // Filtro per tipo di attività
      if (typeFilter.length > 0 && !typeFilter.includes(log.type)) {
        return false;
      }
      
      // Filtro per ricerca testuale
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const descriptionMatch = log.description.toLowerCase().includes(searchLower);
        const typeMatch = log.type.toLowerCase().includes(searchLower);
        const ipMatch = log.ipAddress ? log.ipAddress.includes(searchLower) : false;
        
        return descriptionMatch || typeMatch || ipMatch;
      }
      
      return true;
    });
  }, [logs, getLocalActivities, searchQuery, typeFilter, showLocalOnly]);

  // Funzione per esportare i log come JSON
  const handleExportLogs = () => {
    const logsToExport = showLocalOnly ? getLocalActivities() : logs;
    const dataStr = JSON.stringify(logsToExport, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportName = `activity_logs_${showLocalOnly ? 'local' : 'all'}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `${exportName}.json`);
    linkElement.click();
  };

  // Ottieni una descrizione dello stato attuale del filtro
  const filterDescription = useMemo(() => {
    const count = filteredLogs.length;
    const total = showLocalOnly ? getLocalActivities().length : logs.length;
    const source = showLocalOnly ? 'attività locali' : 'tutte le attività';
    
    if (count === total) {
      return `Visualizzazione di ${count} ${source}`;
    }
    
    return `Visualizzazione di ${count} su ${total} ${source}`;
  }, [filteredLogs, logs, getLocalActivities, showLocalOnly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pb-2">
        <Heading title="Registro Attività" description="Visualizza e gestisci le attività del sistema" />
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2 sm:space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowLocalOnly(!showLocalOnly)}
            className={showLocalOnly ? "bg-primary/20" : ""}
          >
            {showLocalOnly ? "Attività Locali" : "Tutte le Attività"}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtri
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {activityTypes.map(type => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={typeFilter.includes(type)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setTypeFilter(prev => [...prev, type]);
                    } else {
                      setTypeFilter(prev => prev.filter(t => t !== type));
                    }
                  }}
                >
                  {type.replace(/_/g, ' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportLogs}
          >
            <Download className="mr-2 h-4 w-4" />
            Esporta
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm('Sei sicuro di voler cancellare tutti i log? Questa azione non può essere annullata.')) {
                clearLogs();
              }
            }}
          >
            <Trash className="mr-2 h-4 w-4" />
            Cancella
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Registro delle Attività</CardTitle>
          <CardDescription>
            {filterDescription}
          </CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Cerca nelle attività..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nessun log di attività trovato.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Origine</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.timestamp), 'dd/MM/yy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {log.description}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.deviceFingerprint ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-muted-foreground" title={log.deviceFingerprint}>
                              {log.deviceFingerprint.substring(0, 8)}...
                            </span>
                            {log.deviceInfo && (
                              <span className="text-xs text-muted-foreground" title={log.deviceInfo.userAgent}>
                                {log.deviceInfo.platform || "-"}
                              </span>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{log.ipAddress || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={log.isLocalActivity ? "default" : "secondary"}>
                          {log.isLocalActivity ? "Locale" : "Web"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}