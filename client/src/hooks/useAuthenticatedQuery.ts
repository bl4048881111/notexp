import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { authService } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

/**
 * Hook personalizzato che wrappa useQuery con controlli automatici della sessione
 * Garantisce che le query vengano eseguite solo con sessioni valide
 */
export function useAuthenticatedQuery<TData = unknown, TError = Error>(
  options: Omit<UseQueryOptions<TData, TError>, 'queryFn'> & {
    queryFn: () => Promise<TData>;
  }
): UseQueryResult<TData, TError> {
  
  const { isAuthenticated } = useAuth();
  
  return useQuery<TData, TError>({
    ...options,
    queryFn: async () => {
      // Verifica la sessione prima di eseguire qualsiasi query
      const isValidSession = await authService.isSessionValid();
      
      if (!isValidSession) {
        console.log('🚪 Sessione non valida rilevata - query bloccata');
        throw new Error("Sessione scaduta");
      }
      
      // Se la sessione è valida, esegui la query originale
      return options.queryFn();
    },
    enabled: isAuthenticated && (options.enabled !== false), // Esegui solo se autenticato e se enabled non è esplicitamente false
    // Configurazione ottimizzata per il nostro sistema
    refetchOnWindowFocus: true, // Sempre ricarica quando si torna sull'app
    refetchOnMount: true, // Sempre ricarica al mount
    staleTime: 0, // Considera sempre i dati stale per controlli di sessione
    gcTime: 1000 * 60 * 5, // Cache per 5 minuti
    retry: (failureCount, error: any) => {
      // Non riprovare se è un errore di sessione
      if (error?.message?.includes('Sessione scaduta')) {
        return false;
      }
      // Altrimenti riprova max 1 volta
      return failureCount < 1;
    },
  });
}

/**
 * Hook semplificato per query che non richiedono configurazioni speciali
 */
export function useSimpleAuthenticatedQuery<TData = unknown>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  enabled: boolean = true
) {
  return useAuthenticatedQuery({
    queryKey,
    queryFn,
    enabled,
  });
} 