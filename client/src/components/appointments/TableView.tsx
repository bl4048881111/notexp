import { useState } from "react";
import { format } from "date-fns";
import { Edit, Trash, CheckCircle } from "lucide-react";
import { Appointment } from "@shared/schema";
import { deleteAppointment, updateAppointment } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TableViewProps {
  appointments: Appointment[];
  isLoading: boolean;
  onEdit: (appointment: Appointment) => void;
  onDeleteSuccess: () => void;
  onStatusChange: () => void;
}

export default function TableView({ 
  appointments, 
  isLoading, 
  onEdit, 
  onDeleteSuccess,
  onStatusChange
}: TableViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
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
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "programmato":
        return <Badge variant="outline" className="bg-blue-950/50 text-blue-200 border-blue-700">Programmato</Badge>;
      case "completato":
        return <Badge variant="outline" className="bg-green-950/50 text-green-200 border-green-700">Completato</Badge>;
      case "annullato":
        return <Badge variant="outline" className="bg-red-950/50 text-red-200 border-red-700">Annullato</Badge>;
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
                <TableRow key={appointment.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium text-primary">{appointment.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {format(new Date(appointment.date), 'dd/MM/yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {appointment.time} ({appointment.duration} min)
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{appointment.clientName}</div>
                    <div className="text-xs text-muted-foreground">{appointment.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div>{appointment.model}</div>
                    <div className="text-xs text-muted-foreground">{appointment.plate}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {appointment.services && appointment.services.map((service, index) => (
                        <Badge key={index} variant="outline" className="bg-accent/50 text-foreground text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(appointment.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(appointment)}
                        title="Modifica"
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteClick(appointment)}
                        title="Elimina"
                      >
                        <Trash className="h-4 w-4 text-primary" />
                      </Button>
                      {appointment.status !== "completato" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleCompleteAppointment(appointment)}
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
