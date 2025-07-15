import { QueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";

type QueryFunction = (...args: any[]) => Promise<any>;

function getQueryFn({ on401 }: { on401: "throw" | "redirect" }): any {
  return async (context: any) => {
    // Verifica sempre la validità della sessione prima di eseguire qualsiasi query
    const isValidSession = await authService.isSessionValid();
    
    if (!isValidSession) {
      console.log('🚪 Sessione non valida rilevata durante la query - blocco esecuzione');
      
      // Se la sessione non è valida, non eseguire la query
      if (on401 === "throw") {
        throw new Error("Sessione scaduta");
      } else {
        // Reindirizza al login
        window.location.href = '/login';
        throw new Error("Sessione scaduta - reindirizzamento al login");
      }
    }
    
    // Se la sessione è valida, la query può procedere normalmente
    // Il queryFn verrà definito dalla singola query
    throw new Error("queryFn deve essere definito per ogni query");
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configurazione ottimizzata per il problema della sessione
      refetchInterval: false,
      refetchOnWindowFocus: true, // SEMPRE attivo - ricarica quando riapri l'app
      staleTime: 0, // Considera sempre i dati stale per forzare controlli sessione
      gcTime: 1000 * 60 * 5, // Cache per 5 minuti
      retry: (failureCount, error: any) => {
        // Non riprovare se è un errore di sessione
        if (error?.message?.includes('Sessione scaduta')) {
          return false;
        }
        // Altrimenti riprova max 1 volta
        return failureCount < 1;
      },
      refetchOnMount: true, // SEMPRE ricarica al mount
      refetchOnReconnect: true, // Ricarica quando si riconnette
      networkMode: 'online',
      // Query function personalizzata che verifica la sessione
      queryFn: undefined, // Deve essere definita da ogni query
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Non riprovare se è un errore di sessione
        if (error?.message?.includes('Sessione scaduta')) {
          return false;
        }
        return failureCount < 1;
      },
      networkMode: 'online',
    },
  },
});

// Funzione helper per invalidare tutte le query quando la sessione viene ripristinata
export const refreshAllQueriesAfterSessionRestore = async () => {
  //console.log('🔄 Invalidazione di tutte le query dopo ripristino sessione');
  
  // Invalida tutte le query esistenti
  await queryClient.invalidateQueries();
  
  // Forza il refetch di tutte le query attive
  await queryClient.refetchQueries({
    type: 'active',
    stale: true,
  });
  
  //console.log('✅ Tutte le query sono state aggiornate');
};
