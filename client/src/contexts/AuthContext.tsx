import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { User } from "@shared/types";
import { authService } from "../services/authService";
import { supabase } from "../../../shared/supabase";
import { refreshAllQueriesAfterSessionRestore } from "../lib/queryClient";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [location, setLocation] = useLocation();
  
  // Controlla lo stato di autenticazione all'avvio - UNICO useEffect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // 1. PRIMA: Verifica la sessione Supabase 
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('⚠️ Errore nella verifica sessione Supabase:', sessionError.message);
          // Se c'è un errore nella sessione, pulisci localStorage e disconnetti
          localStorage.removeItem('current_user');
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        
        // 2. SECONDA: Se non c'è sessione Supabase valida
        if (!session || !session.user) {
          // console.log('🚪 Sessione Supabase non valida o scaduta');
          
          // Controlla se c'è un utente nel localStorage (potrebbe essere scaduto)
          const localUser = authService.getCurrentUser();
          if (localUser) {
            // C'è un utente nel localStorage ma non sessione Supabase = sessione scaduta
            localStorage.removeItem('current_user');
          }
          
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        
        // console.log('✅ Sessione Supabase valida per:', session.user.email);
        
        // 3. TERZA: Verifica la sincronizzazione tra localStorage e sessione Supabase
        const localUser = authService.getCurrentUser();
        if (localUser && localUser.email === session.user.email) {
          // console.log('✅ Sincronizzazione localStorage-Supabase OK');
          setUser(localUser);
          setIsAuthenticated(true);
          
          // Aggiorna tutte le query dopo la verifica di sessione valida
          // console.log('🔄 Aggiornamento di tutte le query dopo verifica sessione...');
          try {
            await refreshAllQueriesAfterSessionRestore();
          } catch (error) {
            console.error('❌ Errore nell\'aggiornamento query dopo verifica sessione:', error);
          }
          return;
        }
        
        // 4. QUARTA: Se la sessione Supabase è valida ma il localStorage non è sincronizzato
        // console.log('🔄 Sincronizzazione utente da sessione Supabase...');
        
        // Prova a sincronizzare lo stato dell'autenticazione
        try {
          await authService.syncAuthState();
          const userFromSync = authService.getCurrentUser();
          if (userFromSync) {
            // console.log('✅ Utente sincronizzato da sessione Supabase');
            setUser(userFromSync);
            setIsAuthenticated(true);
            
            // console.log('🔄 Aggiornamento di tutte le query dopo sincronizzazione utente...');
            try {
              await refreshAllQueriesAfterSessionRestore();
            } catch (error) {
              console.error('❌ Errore nell\'aggiornamento query dopo sincronizzazione:', error);
            }
          } else {
            // Se non riesce a trovare l'utente nel database, disconnetti
            console.warn('⚠️ Utente non trovato nel database nonostante sessione Supabase valida');
            await logout();
          }
        } catch (error) {
          console.error('❌ Errore nella sincronizzazione utente da sessione:', error);
          await logout();
        }
      } catch (error) {
        console.error('❌ Errore durante la verifica dell\'autenticazione:', error);
        // In caso di errore generico, per sicurezza disconnetti
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const success = await authService.login(email, password);
      if (success) {
        const user = authService.getCurrentUser();
        setUser(user);
        setIsAuthenticated(true);
        // console.log('✅ Login riuscito');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Errore durante il login:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // console.log('🚪 Logout iniziato...');
      
      // Prima di tutto, disconnetti da Supabase Auth
      await authService.logout();
      
      // Poi resetta lo stato dell'applicazione
      setUser(null);
      setIsAuthenticated(false);
      
      // Reindirizza alla pagina di login
      setLocation('/login');
    } catch (error) {
      console.error('❌ Errore durante il logout:', error);
      // Anche in caso di errore, resetta lo stato
      setUser(null);
      setIsAuthenticated(false);
      setLocation('/login');
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
};
