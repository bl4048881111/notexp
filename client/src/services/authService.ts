import { DEFAULT_CREDENTIALS } from "@shared/types";

// Simple authentication service
export const authService = {
  // Login with username and password
  login: async (username: string, password: string): Promise<boolean> => {
    // For this MVP, we're using hardcoded credentials
    if (username === DEFAULT_CREDENTIALS.username && password === DEFAULT_CREDENTIALS.password) {
      // Ottieni l'indirizzo IP (utilizzo di un servizio esterno)
      let ipAddress = "sconosciuto";
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        ipAddress = data.ip;
      } catch (error) {
        console.warn("Impossibile ottenere l'indirizzo IP:", error);
      }

      // Carica gli accessi precedenti se esistono
      let previousLogins = [];
      const storedLogins = localStorage.getItem('auth_login_history');
      if (storedLogins) {
        try {
          previousLogins = JSON.parse(storedLogins);
        } catch (e) {
          console.warn("Errore nel parsing della cronologia di accesso:", e);
        }
      }

      // Aggiungi il nuovo accesso
      const newLogin = {
        timestamp: Date.now(),
        ipAddress
      };

      // Limita la cronologia a 10 accessi
      previousLogins = [newLogin, ...previousLogins].slice(0, 10);
      
      // Salva la cronologia aggiornata
      localStorage.setItem('auth_login_history', JSON.stringify(previousLogins));

      // Store authentication state in localStorage
      localStorage.setItem('auth', JSON.stringify({ 
        username, 
        isAuthenticated: true,
        timestamp: Date.now(),
        lastLogin: newLogin,
        ipAddress
      }));
      return true;
    }
    return false;
  },
  
  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const auth = localStorage.getItem('auth');
    if (!auth) return false;
    
    try {
      const authData = JSON.parse(auth);
      // Optional: check token expiration
      const isExpired = Date.now() - authData.timestamp > 24 * 60 * 60 * 1000; // 24 hours
      return authData.isAuthenticated && !isExpired;
    } catch (error) {
      return false;
    }
  },
  
  // Logout
  logout: (): void => {
    localStorage.removeItem('auth');
  },
  
  // Get current user
  getCurrentUser: () => {
    const auth = localStorage.getItem('auth');
    if (!auth) return null;
    
    try {
      const authData = JSON.parse(auth);
      return { 
        username: authData.username,
        lastLogin: authData.lastLogin,
        ipAddress: authData.ipAddress 
      };
    } catch (error) {
      return null;
    }
  },

  // Get login history
  getLoginHistory: () => {
    const storedLogins = localStorage.getItem('auth_login_history');
    if (!storedLogins) return [];
    
    try {
      return JSON.parse(storedLogins);
    } catch (error) {
      console.error("Errore nel recupero della cronologia degli accessi:", error);
      return [];
    }
  }
};
