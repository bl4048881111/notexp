import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Client, CreateClientInput } from '@shared/types';
import { 
  createClient, 
  updateClient, 
  getClientById, 
  getAllQuotes, 
  updateQuoteClientInfo 
} from '@shared/firebase';
import { useToast } from './use-toast';
import { useActivityLogger, ActivityType } from '@/components/dev/ActivityLogger';

/**
 * Hook personalizzato per gestire le operazioni sui clienti in modo più affidabile
 */
export function useClientOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  /**
   * Crea un nuovo cliente e aggiorna la cache
   */
  const create = async (data: CreateClientInput): Promise<Client | null> => {
    setIsLoading(true);
    try {
      // Crea il cliente
      const newClient = await createClient(data);
      
      // Aggiorna la cache
      await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      
      // Registra l'attività
      logActivity(
        'create_client', 
        `Cliente creato: ${data.name} ${data.surname}`,
        { clientId: newClient.id, plate: data.plate }
      );
      
      toast({
        description: "Cliente creato con successo!",
      });
      
      return newClient;
    } catch (error) {
      console.error("Errore durante la creazione del cliente:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione del cliente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Aggiorna un cliente esistente e forza l'aggiornamento della cache,
   * aggiornando anche tutti i preventivi collegati a questo cliente
   */
  const update = async (id: string, data: Partial<Client>): Promise<Client | null> => {
    setIsLoading(true);
    try {
      // Prima controlla se il cliente esiste
      const existingClient = await getClientById(id);
      if (!existingClient) {
        throw new Error(`Cliente con ID ${id} non trovato`);
      }

      // Log per debug
      console.log(`Aggiornamento cliente ${id} in corso...`, data);
      
      // Aggiorna il cliente
      await updateClient(id, data);
      
      // Attende un momento per garantire che l'aggiornamento sia completato
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Rilegge il cliente per verificare l'aggiornamento
      const updatedClient = await getClientById(id);
      
      if (!updatedClient) {
        throw new Error(`Impossibile verificare l'aggiornamento del cliente ${id}`);
      }
      
      // Log per debug
      console.log('Cliente aggiornato:', updatedClient);
      
      // Registra l'attività di aggiornamento
      logActivity(
        'update_client',
        `Cliente aggiornato: ${updatedClient.name} ${updatedClient.surname}`,
        { 
          clientId: id, 
          plate: updatedClient.plate,
          changes: Object.keys(data).join(', ')
        }
      );
      
      // Aggiorna tutti i preventivi associati a questo cliente
      try {
        // Ottiene tutti i preventivi
        const allQuotes = await getAllQuotes();
        
        // Filtra i preventivi di questo cliente
        const clientQuotes = allQuotes.filter(quote => quote.clientId === id);
        
        if (clientQuotes.length > 0) {
          console.log(`Trovati ${clientQuotes.length} preventivi da aggiornare per il cliente ${id}`);
          
          // Formatta il nome completo correttamente
          const clientFullName = `${updatedClient.name} ${updatedClient.surname}`.trim();
          console.log(`Nome completo cliente formattato: "${clientFullName}"`);
          
          // Preparazione dati da aggiornare
          const clientInfo = {
            clientName: clientFullName,
            phone: updatedClient.phone,
            plate: updatedClient.plate
          };
          
          // Aggiorna tutti i preventivi in parallelo usando la nuova funzione che aggiorna solo i dati cliente
          const updatePromises = clientQuotes.map(quote => {
            console.log(`Aggiornamento preventivo ${quote.id}, vecchio nome: "${quote.clientName}", vecchia targa: "${quote.plate}", nuovo nome: "${clientFullName}", nuova targa: "${updatedClient.plate}"`);
            return updateQuoteClientInfo(quote.id, clientInfo);
          });
          
          // Attendi il completamento di tutti gli aggiornamenti
          await Promise.all(updatePromises);
          console.log('Aggiornati tutti i preventivi associati al cliente');
          
          // Registra l'aggiornamento dei preventivi associati
          if (clientQuotes.length > 0) {
            logActivity(
              'update_quote',
              `Aggiornati ${clientQuotes.length} preventivi associati al cliente ${updatedClient.name} ${updatedClient.surname}`,
              { clientId: id, quoteIds: clientQuotes.map(q => q.id) }
            );
          }
          
          // Invalida la cache dei preventivi e forza un refetch
          await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
          await queryClient.refetchQueries({ queryKey: ['/api/quotes'] });
        }
      } catch (quoteError) {
        console.error('Errore durante l\'aggiornamento dei preventivi:', quoteError);
        // Non blocchiamo l'aggiornamento del cliente se fallisce l'aggiornamento dei preventivi
      }
      
      // Invalida manualmente la cache di React Query
      await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      
      // Per forzare un aggiornamento più affidabile, aggiorna manualmente anche la cache
      queryClient.setQueryData(['/api/clients'], (oldData: Client[] | undefined) => {
        if (!oldData) return [updatedClient];
        
        // Sostituisci il vecchio cliente con quello aggiornato
        return oldData.map(client => client.id === id ? updatedClient : client);
      });
      
      toast({
        description: "Cliente aggiornato con successo!",
      });
      
      return updatedClient;
    } catch (error) {
      console.error("Errore durante l'aggiornamento del cliente:", error);
      
      // Registra l'errore
      logActivity(
        'error',
        `Errore durante l'aggiornamento del cliente ${id}`,
        { error: (error as Error).message }
      );
      
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del cliente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    create,
    update,
    isLoading
  };
} 