import { useState } from "react";
import { format } from "date-fns";
import { Edit, Trash, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Client } from "@shared/types";
import { deleteClient } from "@shared/firebase";
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
import { Skeleton } from "@/components/ui/skeleton";

interface ClientTableProps {
  clients: Client[];
  isLoading: boolean;
  onEdit: (client: Client) => void;
  onDeleteSuccess: () => void;
}

export default function ClientTable({ clients, isLoading, onEdit, onDeleteSuccess }: ClientTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 6;
  
  // Calcola il numero totale di pagine
  const totalPages = Math.ceil(clients.length / clientsPerPage);
  
  // Ottieni i clienti per la pagina corrente
  const indexOfLastClient = currentPage * clientsPerPage;
  const indexOfFirstClient = indexOfLastClient - clientsPerPage;
  const currentClients = clients.slice(indexOfFirstClient, indexOfLastClient);
  
  // Gestione cambio pagina
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteClient(clientToDelete.id);
      
      // Registra l'attività di eliminazione cliente
      try {
        const activityModule = await import('../dev/ActivityLogger');
        const { useActivityLogger } = activityModule;
        const { logActivity } = useActivityLogger();
        
        logActivity(
          'delete_client',
          `Cliente eliminato: ${clientToDelete.name} ${clientToDelete.surname}`,
          {
            clientId: clientToDelete.id,
            name: clientToDelete.name,
            surname: clientToDelete.surname,
            plate: clientToDelete.plate,
            timestamp: new Date()
          }
        );
      } catch (error) {
        console.warn("Impossibile registrare l'attività:", error);
      }
      
      toast({
        title: "Cliente eliminato",
        description: "Il cliente è stato eliminato con successo",
      });
      onDeleteSuccess();
      
      // Aggiorna la pagina corrente se necessario
      if (currentClients.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error) {
      toast({
        title: "Errore di eliminazione",
        description: "Si è verificato un errore durante l'eliminazione del cliente",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };
  
  const handleCreateAppointment = (client: Client) => {
    // Navigate to appointments page with client data
    setLocation(`/appointments?clientId=${client.id}`);
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
              <TableHead className="hidden md:table-cell">Codice</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Contatti</TableHead>
              <TableHead className="hidden sm:table-cell">Credenziali</TableHead>
              <TableHead className="hidden sm:table-cell">Veicolo</TableHead>
              <TableHead className="hidden lg:table-cell">Data</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center p-4 text-muted-foreground">
                  Nessun cliente trovato
                </TableCell>
              </TableRow>
            ) : (
              currentClients.map((client) => (
                <TableRow 
                  key={client.id} 
                  className="hover:bg-accent/50 cursor-pointer"
                  onClick={() => onEdit(client)}
                >
                  <TableCell className="hidden md:table-cell font-medium text-primary">
                    {client.id}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{client.name} {client.surname}</div>
                    <div className="sm:hidden text-xs text-muted-foreground">
                      <div>{client.model} - {client.plate}</div>
                      <div>{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div>{client.phone}</div>
                    <div className="text-xs text-muted-foreground">{client.email}</div>
                    {client.birthDate && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Nato il: {client.birthDate.split('-').reverse().join('/')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div>{client.email}</div>
                    {client.password && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Password: {client.password}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div>{client.model}</div>
                    <div className="text-xs text-muted-foreground">{client.plate}</div>
                    {client.vin && (
                      <div className="text-xs text-muted-foreground mt-1">VIN: {client.vin}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {format(new Date(client.createdAt), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1 md:space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(client);
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
                          handleDeleteClick(client);
                        }}
                        title="Elimina"
                      >
                        <Trash className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAppointment(client);
                        }}
                        title="Crea appuntamento"
                      >
                        <Calendar className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="p-3 md:px-6 md:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border gap-2">
        <div className="text-xs sm:text-sm text-muted-foreground">
          Mostrando <span className="font-medium">{indexOfFirstClient + 1}-{Math.min(indexOfLastClient, clients.length)}</span> di <span className="font-medium">{clients.length}</span> clienti
        </div>
        
        {/* Paginazione */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-sm font-medium">
              Pagina {currentPage} di {totalPages}
            </span>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Verranno eliminati tutti i dati del cliente.
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
