import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  Mail, 
  Car, 
  FileText, 
  CheckCircle, 
  Clock, 
  X, 
  Eye,
  UserCheck,
  AlertCircle,
  Trash2,
  MoreHorizontal,
  Edit,
  RefreshCw,
  UserPlus
} from "lucide-react";

import { getAllRequests, updateRequest, deleteRequest, createRequest, createClient } from "@shared/supabase";
import { Request, CreateRequestInput, CreateClientInput } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const statusColors = {
  ricevuta: "bg-gray-900 text-orange-400 border-orange-500 font-medium",
  in_lavorazione: "bg-gray-900 text-yellow-400 border-yellow-500 font-medium",
  completata: "bg-gray-900 text-green-400 border-green-500 font-medium",
  annullata: "bg-gray-900 text-gray-500 border-gray-800 font-medium"
};

const statusLabels = {
  ricevuta: "Ricevuta",
  in_lavorazione: "In Lavorazione",
  completata: "Completata",
  annullata: "Annullata"
};

const statusIcons = {
  ricevuta: Clock,
  in_lavorazione: AlertCircle,
  completata: CheckCircle,
  annullata: X
};

// Funzione per parsare date in formato italiano (dd/MM/yyyy)
const parseItalianDate = (dateString: string): Date | null => {
  if (!dateString || dateString === "Non specificata") return null;
  
  // Se è già un timestamp, convertilo
  if (!isNaN(Number(dateString))) {
    return new Date(Number(dateString));
  }
  
  // Se è in formato dd/MM/yyyy
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // I mesi in JavaScript sono 0-based
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  
  // Prova il parsing standard
  const standardDate = new Date(dateString);
  return !isNaN(standardDate.getTime()) ? standardDate : null;
};

// Funzione per formattare date in modo sicuro
const formatSafeDate = (dateValue: any, formatString: string): string => {
  if (!dateValue) return "Data non disponibile";
  
  let date: Date | null = null;
  
  if (typeof dateValue === 'string') {
    date = parseItalianDate(dateValue);
  } else if (typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else if (dateValue instanceof Date) {
    date = dateValue;
  }
  
  if (!date || isNaN(date.getTime())) {
    return "Data non valida";
  }
  
  try {
    return format(date, formatString, { locale: it });
  } catch (error) {
    return "Errore formato data";
  }
};

export default function RequestsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [couponFilter, setCouponFilter] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<Request | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all requests
  const { 
    data: requests = [], 
    isLoading,
    refetch
  } = useQuery({ 
    queryKey: ['/api/requests'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/get-requests');
      if (!response.ok) {
        throw new Error('Errore nel recupero delle richieste');
      }
      const data = await response.json();
      return data;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Sempre considera i dati stale per aggiornamenti immediati
    gcTime: 1000 * 60 * 5, // Cache per 5 minuti
    refetchInterval: 30000 // Aggiorna automaticamente ogni 30 secondi
  });

  // Update request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<any> }) => {
      const response = await fetch(`/.netlify/functions/update-request?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'aggiornamento della richiesta');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Richiesta aggiornata",
        description: "Lo stato della richiesta è stato aggiornato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
      setIsDetailModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/.netlify/functions/delete-request?id=${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'eliminazione della richiesta');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Richiesta eliminata",
        description: "La richiesta è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
      setIsDeleteModalOpen(false);
      setRequestToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      return await createClient(clientData);
    },
    onSuccess: (newClient) => {
      toast({
        title: "Cliente creato",
        description: `Il cliente ${newClient.name} ${newClient.surname} è stato creato con successo`,
      });
      // Invalida le query per aggiornare la lista clienti se esiste
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione del cliente",
        variant: "destructive",
      });
    },
  });

  // Filter and search requests
  const filteredRequests = useMemo(() => {
    return (requests as any[]).filter((request: any) => {
      const matchesSearch = searchQuery === "" || 
        request.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.cognome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.telefono.includes(searchQuery) ||
        request.targa.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesType = typeFilter === "all" || request.tipoRichiesta === typeFilter;
      const matchesCoupon = couponFilter === "" || (request.coupon && request.coupon.toLowerCase().includes(couponFilter.toLowerCase()));
      
      return matchesSearch && matchesStatus && matchesType && matchesCoupon;
    }).sort((a: any, b: any) => b.createdAt - a.createdAt);
  }, [requests, searchQuery, statusFilter, typeFilter, couponFilter]);

  // Group requests by type
  const checkupRequests = filteredRequests.filter((r: any) => r.tipoRichiesta === "checkup");
  const preventiveRequests = filteredRequests.filter((r: any) => r.tipoRichiesta === "preventivo");

  const handleStatusChange = (requestId: string, newStatus: Request['status']) => {
    updateRequestMutation.mutate({ 
      id: requestId, 
      updates: { status: newStatus } 
    });
  };

  const handleViewDetails = (request: Request) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleDeleteRequest = (request: Request) => {
    setRequestToDelete(request);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (requestToDelete) {
      deleteRequestMutation.mutate(requestToDelete.id);
    }
  };

  const handleCreateClient = (request: any) => {
    // Genera una password temporanea
    const tempPassword = Math.random().toString(36).slice(-8);
    
    // Mappa i dati della richiesta ai dati del cliente
    const clientData = {
      name: request.nome || "Nome",
      surname: request.cognome || "Cognome", 
      phone: request.telefono || "",
      email: request.email || `${request.nome?.toLowerCase() || 'cliente'}@temporaneo.com`,
      password: tempPassword,
      birthDate: request.dataNascita || "",
      plate: request.targa || "",
      vin: "",
      // Se abbiamo una targa, creiamo un veicolo
      vehicles: request.targa ? [{
        plate: request.targa,
        vin: "",
        registrationPhotos: []
      }] : []
    };

    createClientMutation.mutate(clientData);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Richieste</h1>
          <p className="text-muted-foreground">
            Gestisci tutte le richieste di checkup e preventivi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {filteredRequests.length} richieste
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, telefono o targa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          placeholder="Filtra per coupon..."
          value={couponFilter}
          onChange={e => setCouponFilter(e.target.value)}
          className="md:w-48"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="ricevuta">Ricevuta</SelectItem>
            <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
            <SelectItem value="completata">Completata</SelectItem>
            <SelectItem value="annullata">Annullata</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filtra per tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="checkup">Checkup</SelectItem>
            <SelectItem value="preventivo">Preventivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            Tutte ({filteredRequests.length})
          </TabsTrigger>
          <TabsTrigger value="checkup">
            Checkup ({checkupRequests.length})
          </TabsTrigger>
          <TabsTrigger value="preventivo">
            Preventivi ({preventiveRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna richiesta trovata</h3>
                <p className="text-muted-foreground text-center">
                  Non ci sono richieste che corrispondono ai filtri selezionati.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contatti</TableHead>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Cambia Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request: any) => {
                    const StatusIcon = statusIcons[request.status as keyof typeof statusIcons];
                    return (
                      <TableRow 
                        key={request.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleViewDetails(request)}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {(request.nome && request.cognome) 
                              ? `${request.nome} ${request.cognome}` 
                              : request.nome || request.cognome || "Nome non disponibile"
                            }
                          </div>
                          {request.dataNascita && (
                            <div className="text-sm text-muted-foreground">
                              Nato il {request.dataNascita}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            {request.tipoRichiesta === "checkup" ? (
                              <>
                                <Car className="h-3 w-3" />
                                Checkup
                              </>
                            ) : (
                              <>
                                <FileText className="h-3 w-3" />
                                Preventivo
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {request.email || "N/A"}
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {request.telefono || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {request.targa || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-orange-500">
                            {request.coupon ? request.coupon : <span className="text-muted-foreground">-</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatSafeDate(request.createdAt, "dd/MM/yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatSafeDate(request.createdAt, "HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {request.ipAddress || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[request.status as keyof typeof statusColors]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusLabels[request.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              key={`${request.id}-ricevuta`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'ricevuta')}
                              title="Ricevuta"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-in_lavorazione`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'in_lavorazione')}
                              title="In Lavorazione"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-completata`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'completata')}
                              title="Completata"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-annullata`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'annullata')}
                              title="Annullata"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              key={`${request.id}-view`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewDetails(request)}
                              title="Visualizza dettagli"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-delete`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDeleteRequest(request)}
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleCreateClient(request)}
                              title="Crea cliente"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checkup" className="space-y-4">
          {checkupRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Car className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna richiesta di checkup</h3>
                <p className="text-muted-foreground text-center">
                  Non ci sono richieste di checkup che corrispondono ai filtri selezionati.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contatti</TableHead>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Appuntamento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Cambia Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkupRequests.map((request: any) => {
                    const StatusIcon = statusIcons[request.status as keyof typeof statusIcons];
                    return (
                      <TableRow 
                        key={request.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleViewDetails(request)}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {(request.nome && request.cognome) 
                              ? `${request.nome} ${request.cognome}` 
                              : request.nome || request.cognome || "Nome non disponibile"
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {request.email || "N/A"}
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {request.telefono || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {request.targa || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-orange-500">
                            {request.coupon ? request.coupon : <span className="text-muted-foreground">-</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          {request.dataAppuntamento && request.dataAppuntamento !== "Non specificata" ? (
                            <div className="text-sm">
                              <div>
                                {formatSafeDate(request.dataAppuntamento, "dd/MM/yyyy")}
                              </div>
                              {request.oraAppuntamento && request.oraAppuntamento !== "Non specificata" && (
                                <div className="text-xs text-muted-foreground">
                                  {request.oraAppuntamento}
                                </div>
                              )}
                              {request.preferenzaOrario && !request.preferenzaOrario.includes("Non specificata") && (
                                <div className="text-xs text-muted-foreground">
                                  Preferenza: {request.preferenzaOrario}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Da definire</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatSafeDate(request.createdAt, "dd/MM/yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatSafeDate(request.createdAt, "HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {request.ipAddress || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[request.status as keyof typeof statusColors]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusLabels[request.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              key={`${request.id}-ricevuta`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'ricevuta')}
                              title="Ricevuta"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-in_lavorazione`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'in_lavorazione')}
                              title="In Lavorazione"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-completata`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'completata')}
                              title="Completata"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-annullata`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'annullata')}
                              title="Annullata"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              key={`${request.id}-view`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewDetails(request)}
                              title="Visualizza dettagli"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-delete`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDeleteRequest(request)}
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleCreateClient(request)}
                              title="Crea cliente"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preventivo" className="space-y-4">
          {preventiveRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna richiesta di preventivo</h3>
                <p className="text-muted-foreground text-center">
                  Non ci sono richieste di preventivo che corrispondono ai filtri selezionati.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contatti</TableHead>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Cambia Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preventiveRequests.map((request: any) => {
                    const StatusIcon = statusIcons[request.status as keyof typeof statusIcons];
                    return (
                      <TableRow 
                        key={request.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleViewDetails(request)}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {(request.nome && request.cognome) 
                              ? `${request.nome} ${request.cognome}` 
                              : request.nome || request.cognome || "Nome non disponibile"
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {request.email || "N/A"}
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {request.telefono || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {request.targa || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-orange-500">
                            {request.coupon ? request.coupon : <span className="text-muted-foreground">-</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate">
                            {request.note || "Nessuna nota"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatSafeDate(request.createdAt, "dd/MM/yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatSafeDate(request.createdAt, "HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {request.ipAddress || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[request.status as keyof typeof statusColors]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusLabels[request.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              key={`${request.id}-ricevuta`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'ricevuta')}
                              title="Ricevuta"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-in_lavorazione`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'in_lavorazione')}
                              title="In Lavorazione"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-completata`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'completata')}
                              title="Completata"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-annullata`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleStatusChange(request.id, 'annullata')}
                              title="Annullata"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              key={`${request.id}-view`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewDetails(request)}
                              title="Visualizza dettagli"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              key={`${request.id}-delete`}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDeleteRequest(request)}
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleCreateClient(request)}
                              title="Crea cliente"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Richiesta</DialogTitle>
            <DialogDescription>
              Visualizza i dettagli completi della richiesta
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Nome</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.nome || "Non disponibile"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Cognome</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.cognome || "Non disponibile"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.email || "Non disponibile"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Telefono</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.telefono || "Non disponibile"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Targa</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.targa || "Non disponibile"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tipo Richiesta</Label>
                  <p className="text-sm text-muted-foreground capitalize">{selectedRequest.tipoRichiesta}</p>
                </div>
                {selectedRequest.dataNascita && (
                  <div>
                    <Label className="text-sm font-medium">Data di Nascita</Label>
                    <p className="text-sm text-muted-foreground">{selectedRequest.dataNascita}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Data Richiesta</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatSafeDate(selectedRequest.createdAt, "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Coupon</Label>
                  <p className="text-sm text-orange-500">{selectedRequest.coupon ? selectedRequest.coupon : <span className="text-muted-foreground">-</span>}</p>
                </div>
              </div>
              
              {selectedRequest.tipoRichiesta === "checkup" && selectedRequest.dataAppuntamento && selectedRequest.dataAppuntamento !== "Non specificata" && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <Label className="text-sm font-medium">Dettagli Appuntamento</Label>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Data: {formatSafeDate(selectedRequest.dataAppuntamento, "dd/MM/yyyy")}
                    </p>
                    {selectedRequest.oraAppuntamento && selectedRequest.oraAppuntamento !== "Non specificata" && (
                      <p className="text-sm text-muted-foreground">
                        Ora: {selectedRequest.oraAppuntamento}
                      </p>
                    )}
                    {selectedRequest.preferenzaOrario && !selectedRequest.preferenzaOrario.includes("Non specificata") && (
                      <p className="text-sm text-muted-foreground">
                        Preferenza: {selectedRequest.preferenzaOrario}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {selectedRequest.note && (
                <div>
                  <Label className="text-sm font-medium">Note</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedRequest.note}</p>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium">Stato</Label>
                <Select
                  value={selectedRequest.status}
                  onValueChange={(value: Request['status']) => 
                    handleStatusChange(selectedRequest.id, value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ricevuta">Ricevuta</SelectItem>
                    <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                    <SelectItem value="completata">Completata</SelectItem>
                    <SelectItem value="annullata">Annullata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questa richiesta? Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          
          {requestToDelete && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium">
                {requestToDelete.nome} {requestToDelete.cognome}
              </p>
              <p className="text-sm text-muted-foreground">
                {requestToDelete.tipoRichiesta} - {requestToDelete.email}
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteRequestMutation.isPending}
            >
              {deleteRequestMutation.isPending ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}