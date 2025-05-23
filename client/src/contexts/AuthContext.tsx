import { createContext, useState, useEffect, ReactNode } from "react";
import { authService } from "../services/authService";
import { User } from "@shared/types";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [location, setLocation] = useLocation();
  
  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = authService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        const currentUser = authService.getCurrentUser();
        // Mantieni tutti i campi dell'utente
        setUser(currentUser ? { ...currentUser, password: '' } : null);
      } else {
        setUser(null);
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);
  
  // Aggiungi un controllo periodico della validità della sessione
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Verifica la validità della sessione ogni minuto
    const sessionChecker = setInterval(() => {
      const expiryTimeString = localStorage.getItem('session_expiry');
      
      if (expiryTimeString) {
        const expiryTime = parseInt(expiryTimeString, 10);
        const now = Date.now();
        
        // Se il tempo corrente ha superato il tempo di scadenza, la sessione è scaduta
        if (now > expiryTime) {
          authService.logout();
          setIsAuthenticated(false);
          setUser(null);
          setLocation('/');
        }
      }
    }, 60000); // Verifica ogni minuto
    
    return () => {
      clearInterval(sessionChecker);
    };
  }, [isAuthenticated, setLocation]);
  
  // Sincronizza lo stato utente con localStorage se necessario
  useEffect(() => {
    if (!user) {
      const userStr = localStorage.getItem('current_user');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          if (parsed && parsed.clientId) {
            setUser({ ...parsed, password: '' });
            setIsAuthenticated(true);
          }
        } catch {}
      }
    }
  }, [user]);
  
  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    const success = await authService.login(username, password);
    
    if (success) {
      setIsAuthenticated(true);
      // Recupera tutti i dati utente da localStorage
      const userStr = localStorage.getItem('current_user');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          setUser({ ...parsed, password: '' });
        } catch {
          setUser({ username, password: '' });
        }
      } else {
        setUser({ username, password: '' });
      }
      
      // Registra l'attività di login
      try {
        // Ottieni informazioni dettagliate dal dispositivo
        const identityInfo = await authService.getIdentityInfo();
        
        // Importa dinamicamente per evitare dipendenze circolari
        const activityModule = await import('../components/dev/ActivityLogger');
        const { useActivityLogger } = activityModule;
        const { logActivity } = useActivityLogger();
        
        logActivity(
          'login',
          `Login effettuato come: ${username}`,
          {
            username,
            ipAddress: identityInfo.ip,
            fingerprint: identityInfo.fingerprint,
            deviceInfo: identityInfo.deviceInfo,
            timestamp: new Date()
          },
          true // Attività locale
        );
      } catch (error) {
        console.warn("Impossibile registrare l'attività di login:", error);
      }
    }
    
    return success;
  };
  
  // Logout function
  const logout = async () => {
    // Registra l'attività di logout
    try {
      // Ottieni il nome utente attuale (se disponibile)
      const currentUser = authService.getCurrentUser();
      const username = currentUser?.username || 'utente sconosciuto';
      
      // Ottieni informazioni dettagliate sul dispositivo
      const identityInfo = await authService.getIdentityInfo();
      
      // Importa dinamicamente per evitare dipendenze circolari
      const activityModule = await import('../components/dev/ActivityLogger');
      const { useActivityLogger } = activityModule;
      const { logActivity } = useActivityLogger();
      
      logActivity(
        'logout',
        `Logout effettuato da: ${username}`,
        {
          username,
          ipAddress: identityInfo.ip,
          fingerprint: identityInfo.fingerprint,
          deviceInfo: identityInfo.deviceInfo,
          timestamp: new Date()
        },
        true // Attività locale
      );
    } catch (error) {
      console.warn("Impossibile registrare l'attività di logout:", error);
    }
    
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setLocation('/'); // Redirect alla landing page
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
