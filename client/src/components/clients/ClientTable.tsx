import { useState } from "react";
import { format } from "date-fns";
import { Edit, Trash, Calendar, ChevronLeft, ChevronRight, FileText, Car } from "lucide-react";
import { useLocation } from "wouter";
import { Client } from "@shared/types";
import { deleteClient } from "@shared/supabase";
import { useToast } from "@/hooks/use-toast";
import { formatDateSafe } from "@shared/utils";

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
  
  const handleCreateQuote = (client: Client) => {
    // Navigate to appointments page with client data
    setLocation(`/quotes?clientId=${client.id}`);
  };
  
  // Funzione per ottenere tutti i veicoli del cliente
  const getClientVehicles = (client: Client) => {
    // Se il cliente ha l'array vehicles (nuovo sistema), usalo
    if (client.vehicles && client.vehicles.length > 0) {
      return client.vehicles;
    }
    // Altrimenti usa i campi legacy se presenti
    if (client.plate) {
      return [{
        id: 'legacy',
        plate: client.plate,
        vin: client.vin || '',
        model: client.model || ''
      }];
    }
    return [];
  };

  // Funzione per renderizzare i veicoli in modo minimale ed elegante
  const renderVehicles = (client: Client) => {
    const vehicles = getClientVehicles(client);
    
    if (vehicles.length === 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
          <Car className="h-3 w-3" />
          <span>0</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Car className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium text-foreground">
          {vehicles.length}
        </span>
      </div>
    );
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
                      <div>
                        {getClientVehicles(client).length > 0 
                          ? `${client.model || 'Veicolo'} - ${getClientVehicles(client)[0].plate}`
                          : 'Nessun veicolo'
                        }
                        {getClientVehicles(client).length > 1 && (
                          <span className="text-blue-600 ml-1">
                            (+{getClientVehicles(client).length - 1})
                          </span>
                        )}
                      </div>
                      <div>{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div>{client.phone}</div>
                    <div className="text-xs text-muted-foreground">{client.email}</div>
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
                    {renderVehicles(client)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDateSafe(client.createdAt)}
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
                          handleCreateQuote(client);
                        }}
                        title="Crea Preventivo"
                      >
                        <FileText className="h-4 w-4 text-primary" />
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
