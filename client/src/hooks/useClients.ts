import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Client, CreateClientInput } from "@shared/types";
import { clientService } from "../services/clientService";
import { useToast } from "@/hooks/use-toast";

export const useClients = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get all clients
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: clientService.getAll,
  });
  
  // Get recent clients
  const { data: recentClients = [], isLoading: isLoadingRecentClients } = useQuery({
    queryKey: ['/api/clients/recent'],
    queryFn: () => clientService.getRecent(5),
  });
  
  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: (client: CreateClientInput) => clientService.create(client),
    onSuccess: () => {
      toast({
        title: "Cliente aggiunto",
        description: "Il cliente è stato aggiunto con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients/recent'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del cliente",
        variant: "destructive",
      });
    },
  });
  
  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Client> }) => 
      clientService.update(id, data),
    onSuccess: () => {
      toast({
        title: "Cliente aggiornato",
        description: "Il cliente è stato aggiornato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del cliente",
        variant: "destructive",
      });
    },
  });
  
  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: (id: string) => clientService.delete(id),
    onSuccess: () => {
      toast({
        title: "Cliente eliminato",
        description: "Il cliente è stato eliminato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients/recent'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del cliente",
        variant: "destructive",
      });
    },
  });
  
  return {
    clients,
    recentClients,
    isLoadingClients,
    isLoadingRecentClients,
    createClient: createClientMutation.mutate,
    updateClient: updateClientMutation.mutate,
    deleteClient: deleteClientMutation.mutate,
    isCreatingClient: createClientMutation.isPending,
    isUpdatingClient: updateClientMutation.isPending,
    isDeletingClient: deleteClientMutation.isPending,
  };
};
