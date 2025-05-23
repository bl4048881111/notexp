import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Edit, Trash, CheckCircle, Wrench, FileText, Package, XCircle, Calendar, Info, User } from "lucide-react";
import { Appointment, Quote, Client } from "@shared/schema";
import { deleteAppointment, updateAppointment, getQuotesByClientId, getClientById } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface TableViewProps {
  appointments: Appointment[];
  isLoading: boolean;
  onEdit: (appointment: Appointment) => void;
  onDeleteSuccess: () => void;
  onStatusChange: (id: string, data: Partial<Appointment>) => void;
  onEditQuote?: (quote: Quote) => void;
  showCompletedAppointments?: boolean;
  isClient?: boolean;
}

export default function TableView({ 
  appointments, 
  isLoading, 
  onEdit, 
  onDeleteSuccess,
  onStatusChange,
  onEditQuote,
  showCompletedAppointments = false,
  isClient = false
}: TableViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [clientDetails, setClientDetails] = useState<Client | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const { toast } = useToast();
  
  // Query per ottenere preventivi del cliente
  const { data: clientQuotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['/api/quotes', viewAppointment?.clientId],
    queryFn: () => viewAppointment ? getQuotesByClientId(viewAppointment.clientId) : Promise.resolve([]),
    enabled: !!viewAppointment,
  });
  
  // Filtro degli appuntamenti in base allo stato di completamento e altre condizioni
  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => 
      showCompletedAppointments || appointment.status !== "completato"
    );
  }, [appointments, showCompletedAppointments]);
  
  // Ordina gli appointments per data e ora in modo sicuro
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      // Gestione sicura delle date e degli orari
      const dateA = a.date || ""; 
      const dateB = b.date || "";
      
      // Prima confronta le date
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      
      // Se le date sono uguali, confronta gli orari
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [filteredAppointments]);
  
  const handleDeleteClick = (appointment: Appointment) => {
    if (isClient) return;
    
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!appointmentToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteAppointment(appointmentToDelete.id);
      toast({
        title: "Appuntamento eliminato",
        description: "L'appuntamento è stato eliminato con successo",
      });
      onDeleteSuccess();
    } catch (error) {
      toast({
        title: "Errore di eliminazione",
        description: "Si è verificato un errore durante l'eliminazione dell'appuntamento",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
    }
  };
  
  const handleCompleteAppointment = async (appointment: Appointment) => {
    if (isClient) return;
    
    try {
      await updateAppointment(appointment.id, { status: "completato" });
      toast({
        title: "Appuntamento completato",
        description: "Lo stato dell'appuntamento è stato aggiornato",
      });
      onStatusChange(appointment.id, { status: "completato" });
    } catch (error) {
      toast({
        title: "Errore di aggiornamento",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };
  
  const handleStartWork = async (appointment: Appointment) => {
    if (isClient) return;
    
    try {
      await updateAppointment(appointment.id, { status: "in_lavorazione" });
      toast({
        title: "Appuntamento in lavorazione",
        description: "Lo stato dell'appuntamento è stato aggiornato",
      });
      onStatusChange(appointment.id, { status: "in_lavorazione" });
    } catch (error) {
      toast({
        title: "Errore di aggiornamento",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };
  
  const handleViewAppointment = async (appointment: Appointment) => {
    setViewAppointment(appointment);
    setViewDialogOpen(true);
    
    // Carica i dati completi del cliente se esiste un clientId
    if (appointment.clientId) {
      setIsLoadingClient(true);
      try {
        const client = await getClientById(appointment.clientId);
        if (client) {
          setClientDetails(client);
        }
      } catch (error) {
        console.error("Errore nel caricamento dati cliente:", error);
      } finally {
        setIsLoadingClient(false);
      }
    }
  };
  
  const handleEditQuote = (quote: Quote) => {
    setViewDialogOpen(false);
    if (onEditQuote) {
      onEditQuote(quote);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "programmato":
        return <Badge variant="outline" className="bg-gray-900 text-orange-400 border-orange-500 font-medium">Programmato</Badge>;
      case "completato":
        return <Badge variant="outline" className="bg-gray-900 text-green-400 border-green-500 font-medium">Completato</Badge>;
      case "annullato":
        return <Badge variant="outline" className="bg-gray-900 text-gray-500 border-gray-800 font-medium">Annullato</Badge>;
      case "in_lavorazione":
        return <Badge variant="outline" className="bg-gray-900 text-yellow-400 border-yellow-500 font-medium">In Lavorazione</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
      </div>
    );
  }
  
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Data e Ora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veicolo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Ricambi</TableHead>
              {!isClient && <TableHead>Azioni</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isClient ? 6 : 7}>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedAppointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isClient ? 6 : 7} className="text-center py-8">
                  Nessun appuntamento trovato
                </TableCell>
              </TableRow>
            ) : (
              sortedAppointments.map((appointment) => (
                <TableRow key={appointment.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell className="font-medium text-primary" onClick={() => handleViewAppointment(appointment)}>
                    {appointment.id.substring(0, 8)}
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div className="font-medium">
                      {format(new Date(appointment.date), 'EEEE d MMMM yyyy', { locale: it })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {appointment.time} ({appointment.duration} ora{appointment.duration !== 1 ? 'e' : ''})
                    </div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div>{appointment.clientName}</div>
                    <div className="text-xs text-muted-foreground">{appointment.phone}</div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div>{appointment.plate}</div>
                    <div className="text-xs text-muted-foreground">{appointment.model}</div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    {getStatusBadge(appointment.status)}
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    {appointment.partsOrdered ? (
                      <Badge variant="outline" className="bg-gray-900 text-green-400 border-green-500">Ordinati</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-900 text-gray-400 border-gray-700">Non ordinati</Badge>
                    )}
                  </TableCell>
                  {!isClient && (
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(appointment);
                          }}
                          title="Modifica"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(appointment);
                          }}
                          title="Elimina"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                        {appointment.status === "programmato" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartWork(appointment);
                            }}
                            title="Inizia lavorazione"
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                        )}
                        {appointment.status === "in_lavorazione" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompleteAppointment(appointment);
                            }}
                            title="Segna come completato"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="px-6 py-3 flex items-center justify-between border-t border-border">
        <div className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium">1-{Math.min(sortedAppointments.length, 10)}</span> di <span className="font-medium">{sortedAppointments.length}</span> appuntamenti
        </div>
        
        {/* Pagination would go here */}
      </div>
      
      {/* Dialog di visualizzazione appuntamento */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl bg-background/95 backdrop-blur-sm border-orange-500/50">
          <DialogHeader>
            <DialogTitle className="text-xl text-orange-500 font-bold flex items-center">
              <Calendar className="mr-2 h-5 w-5" /> Dettaglio Appuntamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informazioni complete dell'appuntamento
            </DialogDescription>
          </DialogHeader>
          
          {viewAppointment && (
            <div className="space-y-5 my-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card className="bg-gray-950/50 border-gray-800 shadow-md overflow-hidden">
                  <CardHeader className="pb-2 bg-gray-900">
                    <CardTitle className="text-sm font-medium text-orange-400 flex items-center">
                      <Info className="mr-2 h-4 w-4" />
                      Informazioni Generali
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Codice:</span>
                      <span className="text-sm font-medium text-white">{viewAppointment.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Data:</span>
                      <span className="text-sm font-medium text-white">{format(new Date(viewAppointment.date), 'dd/MM/yyyy', { locale: it })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Orario:</span>
                      <span className="text-sm font-medium text-white">{viewAppointment.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Durata:</span>
                      <span className="text-sm font-medium text-white">{viewAppointment.duration} ore</span>
                    </div>
                    <Separator className="my-1 bg-gray-800" />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Stato:</span>
                      <span>{getStatusBadge(viewAppointment.status)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ricambi:</span>
                      <div className="flex items-center gap-2">
                        {viewAppointment.partsOrdered ? (
                          <Badge variant="outline" className="bg-gray-900 text-green-400 border-green-500">Ordinati</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-900 text-gray-400 border-gray-700">Non ordinati</Badge>
                        )}
                        {!isClient && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7"
                            onClick={async () => {
                              try {
                                const newStatus = !viewAppointment.partsOrdered;
                                await updateAppointment(viewAppointment.id, { 
                                  partsOrdered: newStatus 
                                });
                                setViewAppointment({
                                  ...viewAppointment,
                                  partsOrdered: newStatus
                                });
                                toast({
                                  title: `Ricambi ${newStatus ? "ordinati" : "non ordinati"}`,
                                  description: `Lo stato dei ricambi è stato aggiornato`,
                                });
                                onStatusChange(viewAppointment.id, { partsOrdered: newStatus });
                              } catch (error) {
                                toast({
                                  title: "Errore di aggiornamento",
                                  description: "Si è verificato un errore durante l'aggiornamento dello stato dei ricambi",
                                  variant: "destructive",
                                });
                              }
                            }}
                            title={viewAppointment.partsOrdered ? "Segna come non ordinati" : "Segna come ordinati"}
                          >
                            {viewAppointment.partsOrdered ? <XCircle className="h-4 w-4 text-gray-400" /> : <Package className="h-4 w-4 text-green-400" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-950/50 border-gray-800 shadow-md overflow-hidden">
                  <CardHeader className="pb-2 bg-gray-900">
                    <CardTitle className="text-sm font-medium text-orange-400 flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Informazioni Cliente
                      {isLoadingClient && <span className="ml-2 inline-block w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Cliente:</span>
                      <span className="text-sm font-medium text-white">{viewAppointment.clientName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Targa:</span>
                      <span className="text-sm font-medium text-white">{viewAppointment.plate || "-"}</span>
                    </div>
                    {viewAppointment.clientId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Codice Cliente:</span>
                        <span className="text-sm font-medium text-white">{viewAppointment.clientId}</span>
                      </div>
                    )}
                    {clientDetails?.email && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Email:</span>
                        <span className="text-sm font-medium text-white">{clientDetails.email}</span>
                      </div>
                    )}
                    {clientDetails?.vin && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">VIN:</span>
                        <span className="text-sm font-medium text-white">{clientDetails.vin}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {viewAppointment.quoteId && (
                <Card className="bg-gray-950/50 border-gray-800 shadow-md overflow-hidden">
                  <CardHeader className="pb-2 bg-gray-900">
                    <CardTitle className="text-sm font-medium text-orange-400 flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      Preventivo collegato
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div className="bg-gray-900 px-3 py-1.5 rounded border border-gray-800">
                        <p className="text-sm"><span className="text-muted-foreground mr-1">Codice:</span><span className="font-medium text-orange-400">{viewAppointment.quoteId}</span></p>
                      </div>
                      
                      {!isClient && typeof onEditQuote === 'function' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-orange-500 hover:bg-orange-500/10"
                          onClick={() => {
                            if (isLoadingQuotes) return;
                            const quote = clientQuotes.find(q => q.id === viewAppointment?.quoteId);
                            if (quote) {
                              handleEditQuote(quote);
                            }
                          }}
                          disabled={isLoadingQuotes}
                        >
                          {isLoadingQuotes ? (
                            <span className="flex items-center">
                              <span className="inline-block w-4 h-4 mr-2 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                              Caricamento...
                            </span>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2 text-orange-500" />
                              <span className="font-medium">Visualizza preventivo</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Separator className="my-2 bg-gray-800" />
              
              <DialogFooter>
                {!isClient ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="border-gray-700 hover:bg-gray-800"
                      onClick={() => {
                        setViewDialogOpen(false);
                        onEdit(viewAppointment);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Modifica
                    </Button>
                    
                    {viewAppointment.status === "programmato" && (
                      <Button 
                        variant="default"
                        className="bg-orange-600 hover:bg-orange-700"
                        onClick={() => {
                          setViewDialogOpen(false);
                          handleStartWork(viewAppointment);
                        }}
                      >
                        <Wrench className="h-4 w-4 mr-2" />
                        Inizia lavorazione
                      </Button>
                    )}
                    
                    {viewAppointment.status === "in_lavorazione" && (
                      <Button 
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setViewDialogOpen(false);
                          handleCompleteAppointment(viewAppointment);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Completa
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="border-gray-700 hover:bg-gray-800"
                    onClick={() => setViewDialogOpen(false)}
                  >
                    Chiudi
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog di conferma eliminazione */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo appuntamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
