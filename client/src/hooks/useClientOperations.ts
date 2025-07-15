import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Client, CreateClientInput } from '@shared/types';
import { 
  createClient, 
  updateClient, 
  getClientById, 
  getAllQuotes, 
  updateQuoteClientInfo,
  getQuotesByClientId
} from '@shared/supabase';
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
    console.log('🚀 HOOK: Inizio aggiornamento cliente', { id, data });
    
    try {
      // Prima controlla se il cliente esiste
      const existingClient = await getClientById(id);
      if (!existingClient) {
        console.error('❌ HOOK: Cliente non trovato', id);
        throw new Error(`Cliente con ID ${id} non trovato`);
      }

      console.log('✅ HOOK: Cliente esistente trovato', existingClient);
      
      // Log per debug
      console.log(`🔄 HOOK: Aggiornamento cliente ${id} in corso...`, data);
      
      // Aggiorna il cliente
      console.log('📞 HOOK: Chiamata updateClient...');
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
      
      // 🔧 FIX: Trova SOLO i preventivi associati a QUESTO cliente specifico
      const clientQuotes = await getQuotesByClientId(id); // ← CORRETTO: solo preventivi di questo cliente
      
      // Aggiorna il nome del cliente SOLO nei suoi preventivi
      if (clientQuotes.length > 0 && (data.name || data.surname || data.phone || data.plate)) {
        console.log(`📋 Aggiornamento ${clientQuotes.length} preventivi del cliente ${id}`);
        
        for (const quote of clientQuotes) {
          try {
            await updateQuoteClientInfo(quote.id, {
              clientName: `${updatedClient.name} ${updatedClient.surname}`.trim(),
              phone: updatedClient.phone,
              plate: updatedClient.plate
            });
            console.log(`✅ Preventivo ${quote.id} aggiornato`);
          } catch (error) {
            console.error(`❌ Errore aggiornamento preventivo ${quote.id}:`, error);
          }
        }
      }
      
      // Invalida manualmente la cache di React Query
      await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }); // Aggiunto per aggiornare anche i preventivi
      
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