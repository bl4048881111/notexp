import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Edit, Trash, CheckCircle, Eye, FileText } from "lucide-react";
import { Appointment, Quote } from "@shared/schema";
import { deleteAppointment, updateAppointment, getQuotesByClientId } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

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

interface TableViewProps {
  appointments: Appointment[];
  isLoading: boolean;
  onEdit: (appointment: Appointment) => void;
  onDeleteSuccess: () => void;
  onStatusChange: () => void;
  onEditQuote?: (quote: Quote) => void;
}

export default function TableView({ 
  appointments, 
  isLoading, 
  onEdit, 
  onDeleteSuccess,
  onStatusChange,
  onEditQuote
}: TableViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Query per ottenere preventivi del cliente
  const { data: clientQuotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['/api/quotes', viewAppointment?.clientId],
    queryFn: () => viewAppointment ? getQuotesByClientId(viewAppointment.clientId) : Promise.resolve([]),
    enabled: !!viewAppointment,
  });
  
  const handleDeleteClick = (appointment: Appointment) => {
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
    try {
      await updateAppointment(appointment.id, { status: "completato" });
      toast({
        title: "Appuntamento completato",
        description: "Lo stato dell'appuntamento è stato aggiornato",
      });
      onStatusChange();
    } catch (error) {
      toast({
        title: "Errore di aggiornamento",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };
  
  const handleViewAppointment = (appointment: Appointment) => {
    setViewAppointment(appointment);
    setViewDialogOpen(true);
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
        return <Badge variant="outline" className="bg-gray-900 text-orange-400 border-orange-500">Programmato</Badge>;
      case "completato":
        return <Badge variant="outline" className="bg-gray-900 text-gray-300 border-gray-700">Completato</Badge>;
      case "annullato":
        return <Badge variant="outline" className="bg-gray-900 text-gray-500 border-gray-800">Annullato</Badge>;
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
              <TableHead>Servizi</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center p-4 text-muted-foreground">
                  Nessun appuntamento trovato
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appointment) => (
                <TableRow key={appointment.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell className="font-medium text-primary" onClick={() => handleViewAppointment(appointment)}>
                    {appointment.id.substring(0, 8)}
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div className="font-medium">
                      {format(new Date(appointment.date), 'EEEE d MMMM yyyy', { locale: it })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {appointment.time} ({appointment.duration} min)
                    </div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div>{appointment.clientName}</div>
                    <div className="text-xs text-muted-foreground">{appointment.phone}</div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div>{appointment.model}</div>
                    <div className="text-xs text-muted-foreground">{appointment.plate}</div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    <div className="flex flex-wrap gap-1">
                      {appointment.services && appointment.services.map((service, index) => (
                        <Badge key={index} variant="outline" className="bg-gray-900 border-orange-500 text-orange-400 text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => handleViewAppointment(appointment)}>
                    {getStatusBadge(appointment.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAppointment(appointment);
                        }}
                        title="Visualizza"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(appointment);
                        }}
                        title="Modifica"
                      >
                        <Edit className="h-4 w-4 text-primary" />
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
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                      {appointment.status !== "completato" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteAppointment(appointment);
                          }}
                          title="Completa"
                        >
                          <CheckCircle className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="px-6 py-3 flex items-center justify-between border-t border-border">
        <div className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium">1-{Math.min(appointments.length, 10)}</span> di <span className="font-medium">{appointments.length}</span> appuntamenti
        </div>
        
        {/* Pagination would go here */}
      </div>
      
      {/* Dialog di visualizzazione appuntamento */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Dettagli Appuntamento</DialogTitle>
            <DialogDescription>
              {viewAppointment && format(new Date(viewAppointment.date), 'EEEE d MMMM yyyy', { locale: it })}
            </DialogDescription>
          </DialogHeader>
          
          {viewAppointment && (
            <div className="space-y-4">
              {/* Dati cliente e veicolo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Dati Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">{viewAppointment.clientName}</div>
                    <div className="text-sm text-muted-foreground">{viewAppointment.phone}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Veicolo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">{viewAppointment.model}</div>
                    <div className="text-sm text-muted-foreground">Targa: {viewAppointment.plate}</div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Data, ora e stato */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Data e Ora</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Data</div>
                    <div className="font-medium">{format(new Date(viewAppointment.date), 'dd/MM/yyyy')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Ora</div>
                    <div className="font-medium">{viewAppointment.time}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Stato</div>
                    <div className="font-medium">{getStatusBadge(viewAppointment.status)}</div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Servizi */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Servizi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {viewAppointment.services && viewAppointment.services.length > 0 ? (
                      viewAppointment.services.map((service, index) => (
                        <Badge key={index} variant="outline" className="bg-gray-900 border-orange-500 text-orange-400">
                          {service}
                        </Badge>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Nessun servizio specificato</div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Note */}
              {viewAppointment.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Note</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{viewAppointment.notes}</p>
                  </CardContent>
                </Card>
              )}
              
              {/* Preventivi associati */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Preventivi Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingQuotes ? (
                    <Skeleton className="h-20 w-full" />
                  ) : clientQuotes.length > 0 ? (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {clientQuotes.map(quote => (
                          <div key={quote.id} className="flex items-center justify-between p-2 border rounded-md">
                            <div>
                              <div className="font-medium">Preventivo {quote.id.substring(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(quote.createdAt), 'dd/MM/yyyy')} - 
                                {quote.status === "bozza" ? " Bozza" : 
                                  quote.status === "inviato" ? " Inviato" : 
                                  quote.status === "accettato" ? " Accettato" : 
                                  quote.status === "rifiutato" ? " Rifiutato" : 
                                  quote.status === "scaduto" ? " Scaduto" : " Sconosciuto"}
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditQuote(quote)}
                              className="flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Modifica</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Nessun preventivo associato al cliente
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Chiudi
            </Button>
            <Button onClick={() => viewAppointment && onEdit(viewAppointment)}>
              Modifica Appuntamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog di conferma eliminazione */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo appuntamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Eliminazione in corso..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
