import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Filter, 
  Calendar,
  User,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import { getDbChanges } from '@shared/supabase';
import { formatDateSafe } from '@shared/utils';
import '@/styles/db-changes.css';

interface DetailedDbChange {
  id: string;
  timestamp: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  action_description: string;
  details: any;
  changes_summary?: any;
  user_info: {
    username: string;
    email: string;
    user_type: string;
    session_timestamp: string;
    client_id?: string;
  };
  technical_info: {
    ip_address: string;
    device_fingerprint: string;
    browser_info: any;
    platform: string;
    screen_resolution: string;
    timezone: string;
    timestamp_local: string;
    timestamp_utc: string;
  };
  metadata: {
    day_of_week: string;
    hour_of_day: number;
    is_weekend: boolean;
    entity_display_name: string;
    action_severity: string;
    tags: string[];
  };
}

export default function DbChangesPage({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [changes, setChanges] = useState<DetailedDbChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadChanges();
  }, []);

  const loadChanges = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDbChanges();
      setChanges(data || []);
    } catch (err) {
      setError('Errore nel caricamento delle modifiche al database');
      console.error('Errore caricamento db_changes:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case 'create': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'update': return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'delete': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Database className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      'INFO': 'bg-blue-100 text-blue-800',
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[severity] || 'bg-gray-100 text-gray-800'}>
        {severity}
      </Badge>
    );
  };

  const filteredChanges = changes.filter(change => {
    const matchesSearch = !searchTerm || 
      change.action_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      change.entity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      change.metadata?.entity_display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || change.entity_type?.toLowerCase() === filterType.toLowerCase();
    const matchesAction = filterAction === 'all' || change.action_type?.toLowerCase() === filterAction.toLowerCase();
    
    return matchesSearch && matchesType && matchesAction;
  });

  const renderChangeDetails = (change: DetailedDbChange) => {
    return (
      <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg border border-border">
        {/* Informazioni Utente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2">👤 Informazioni Utente</h4>
            <div className="space-y-1 text-sm text-foreground">
              <div><span className="font-medium text-primary">Username:</span> {change.user_info?.username}</div>
              <div><span className="font-medium text-primary">Email:</span> {change.user_info?.email}</div>
              <div><span className="font-medium text-primary">Tipo:</span> 
                <Badge className={change.user_info?.user_type === 'ADMIN' ? 'bg-purple-500 text-white ml-2' : 'bg-blue-500 text-white ml-2'}>
                  {change.user_info?.user_type}
                </Badge>
              </div>
              {change.user_info?.client_id && (
                <div><span className="font-medium text-primary">ID Cliente:</span> {change.user_info.client_id}</div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2">🖥️ Informazioni Tecniche</h4>
            <div className="space-y-1 text-sm text-foreground">
              <div><span className="font-medium text-primary">IP Address:</span> {change.technical_info?.ip_address || 'Non disponibile'}</div>
              <div><span className="font-medium text-primary">Piattaforma:</span> {change.technical_info?.platform}</div>
              <div><span className="font-medium text-primary">Browser:</span> {change.technical_info?.browser_info?.vendor || 'Sconosciuto'}</div>
              <div><span className="font-medium text-primary">Risoluzione:</span> {change.technical_info?.screen_resolution}</div>
              <div><span className="font-medium text-primary">Timezone:</span> {change.technical_info?.timezone}</div>
              <div><span className="font-medium text-primary">Ora locale:</span> {change.technical_info?.timestamp_local}</div>
            </div>
          </div>
        </div>

        {/* Dettagli Specifici */}
        {change.details && (
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2">📋 Dettagli Operazione</h4>
            <div className="bg-background p-3 rounded border border-border">
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-foreground">
                {JSON.stringify(change.details, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Riassunto Modifiche (per aggiornamenti) */}
        {change.changes_summary && (
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2">🔄 Modifiche Specifiche</h4>
            <div className="bg-background p-3 rounded border border-border">
              <div className="text-sm mb-2 text-foreground">
                <span className="font-medium text-primary">Riassunto:</span> {change.changes_summary.summary}
              </div>
              {change.changes_summary.field_changes && Object.keys(change.changes_summary.field_changes).length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-sm text-foreground">Campi modificati:</div>
                  {Object.entries(change.changes_summary.field_changes).map(([field, fieldChange]: [string, any]) => (
                    <div key={field} className="text-xs bg-muted/30 p-2 rounded border border-border">
                      <div className="font-medium text-foreground">{field}:</div>
                      <div className="text-red-400">- {String(fieldChange.old_value)}</div>
                      <div className="text-green-400">+ {String(fieldChange.new_value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadati */}
        <div>
          <h4 className="font-semibold text-sm text-foreground mb-2">🏷️ Metadati</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-foreground border-border">{change.metadata?.day_of_week}</Badge>
            <Badge variant="outline" className="text-foreground border-border">Ora: {change.metadata?.hour_of_day}:00</Badge>
            {change.metadata?.is_weekend && <Badge variant="outline" className="text-foreground border-border">Weekend</Badge>}
            {change.metadata?.tags?.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-foreground bg-muted">{tag}</Badge>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Caricamento modifiche...
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Sistema di logging avanzato - Traccia tutte le modifiche al database con dettagli completi
          </AlertDescription>
        </Alert>

        {/* Filtri e Ricerca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri e Ricerca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca nelle modifiche..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo entità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le entità</SelectItem>
                  <SelectItem value="client">Clienti</SelectItem>
                  <SelectItem value="quote">Preventivi</SelectItem>
                  <SelectItem value="appointment">Appuntamenti</SelectItem>
                  <SelectItem value="request">Richieste</SelectItem>
                  <SelectItem value="work_session">Sessioni Lavoro</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo azione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le azioni</SelectItem>
                  <SelectItem value="create">Creazione</SelectItem>
                  <SelectItem value="update">Aggiornamento</SelectItem>
                  <SelectItem value="delete">Eliminazione</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={loadChanges} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista Modifiche */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Modifiche al Database ({filteredChanges.length})
            </CardTitle>
            <CardDescription>
              Log dettagliato di tutte le operazioni sul database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredChanges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna modifica trovata con i filtri attuali</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredChanges.map((change) => (
                  <Collapsible key={change.id}>
                    <Card className="border-l-4 border-l-primary">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getActionIcon(change.action_type)}
                              <div>
                                <CardTitle className="text-base">
                                  {change.action_description || `${change.action_type} ${change.entity_type} ${change.entity_id}`}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateSafe(change.timestamp, 'dd/MM/yyyy HH:mm:ss')}
                                  <User className="h-3 w-3 ml-2" />
                                  {change.user_info?.username}
                                  {getSeverityBadge(change.metadata?.action_severity)}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{change.entity_type}</Badge>
                              <Badge variant="outline">{change.action_type}</Badge>
                              {expandedItems.has(change.id) ? 
                                <ChevronUp className="h-4 w-4" /> : 
                                <ChevronDown className="h-4 w-4" />
                              }
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {renderChangeDetails(change)}
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isEmbedded) {
    return <div className="db-changes-page">{renderContent()}</div>;
  }

  return (
    <div className="container mx-auto p-6 db-changes-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Modifiche Database</h1>
        <p className="text-muted-foreground">Sistema di logging avanzato per il monitoraggio delle operazioni</p>
      </div>
      {renderContent()}
    </div>
  );
}