import { User } from "@shared/types";
import { supabase } from '../../../shared/supabase';

const USER_KEY = 'current_user';

class AuthService {
  async login(email: string, password: string): Promise<boolean> {
    try {
      // TUTTI gli utenti (admin e clienti) usano Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) {
        return false;
      }
      
      if (!data.user) {
        return false;
      }
      
      // Estrai informazioni dai metadati utente
      const userMetadata = data.user.user_metadata || {};
      const clientId = userMetadata.client_id;
      const userType = userMetadata.user_type;
      const isAdmin = email === 'autoexpressadservice@gmail.com' || userType === 'admin';
      
      // Crea l'oggetto utente per localStorage (compatibilità)
      const user: User = {
        username: isAdmin ? 'admin' : (userMetadata.client_name || 'cliente'),
        password: '', // Campo richiesto dall'interfaccia User
        email: data.user.email || email,
        clientId: clientId || undefined
      };
      
      // Salva in localStorage per compatibilità con il resto dell'app
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🚪 Avvio logout completo...');
      
      // 1. Logout da Supabase Auth con scope globale per pulire completamente
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.warn('⚠️ Errore durante logout Supabase:', error.message);
      } else {
        console.log('✅ Logout Supabase completato');
      }
      
      // 2. Rimuovi da localStorage
      localStorage.removeItem(USER_KEY);
      
      // 3. Pulisci altri dati correlati che potrebbero essere salvati
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-szibkvybiuyyyctktvzm-auth-token');
      
      // 4. Pulisci la sessionStorage se presente
      sessionStorage.clear();
      
      console.log('🧹 Cache e storage locale puliti');
      
      // 5. Reindirizza alla pagina di login 
      window.location.href = '/LandingPage';
      
    } catch (error) {
      console.error('❌ Errore durante logout:', error);
      // Forza la pulizia anche in caso di errore
      localStorage.clear();
      sessionStorage.clear();
      // Reindirizza comunque alla pagina di login
      window.location.href = '/LandingPage';
    }
  }

  getCurrentUser(): User | null {
    try {
      const userString = localStorage.getItem(USER_KEY);
      if (userString) {
        return JSON.parse(userString);
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Errore nel recupero utente da localStorage:', error);
      // Rimuovi dati corrotti dal localStorage
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }

  // Metodo robusto che verifica la sessione prima di restituire l'utente
  async getCurrentUserWithSessionCheck(): Promise<User | null> {
    try {
      // 1. Verifica se la sessione Supabase è valida
      const isValid = await this.isSessionValid();
      
      if (!isValid) {
        console.log('🚪 Sessione non valida - rimozione utente da localStorage');
        localStorage.removeItem(USER_KEY);
        return null;
      }
      
      // 2. Se la sessione è valida, ottieni l'utente dal localStorage
      const localUser = this.getCurrentUser();
      
      if (!localUser) {
        // 3. Se non c'è utente nel localStorage ma la sessione è valida, sincronizza
        console.log('🔄 Sincronizzazione utente da sessione valida...');
        await this.syncAuthState();
        return this.getCurrentUser();
      }
      
      // 4. Verifica che l'email dell'utente locale corrisponda alla sessione
      const { isAuthenticated, user: supabaseUser } = await this.checkSupabaseAuth();
      
      if (isAuthenticated && supabaseUser && localUser.email === supabaseUser.email) {
        return localUser;
      } else {
        console.warn('⚠️ Disallineamento tra utente locale e sessione Supabase');
        localStorage.removeItem(USER_KEY);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Errore nella verifica utente con sessione:', error);
      // In caso di errore, rimuovi i dati dal localStorage per sicurezza
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }

  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return user !== null;
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.email === 'autoexpressadservice@gmail.com' || user?.username === 'admin';
  }

  // Metodo helper per verificare lo stato dell'autenticazione Supabase
  async checkSupabaseAuth(): Promise<{ isAuthenticated: boolean, user: any }> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        return { isAuthenticated: false, user: null };
      }
      
      return { 
        isAuthenticated: !!user, 
        user: user 
      };
    } catch (error) {
      return { isAuthenticated: false, user: null };
    }
  }

  // Metodo per sincronizzare lo stato tra Supabase e localStorage
  async syncAuthState(): Promise<void> {
    try {
      const { isAuthenticated, user } = await this.checkSupabaseAuth();
      
      if (!isAuthenticated) {
        // Se non autenticato in Supabase, rimuovi da localStorage
        localStorage.removeItem(USER_KEY);
        return;
      }
      
      if (!user) return;
      
      // Se autenticato in Supabase ma non in localStorage, sincronizza
      const localUser = this.getCurrentUser();
      if (!localUser) {
        const userMetadata = user.user_metadata || {};
        const clientId = userMetadata.client_id;
        const userType = userMetadata.user_type;
        const isAdmin = user.email === 'autoexpressadservice@gmail.com' || userType === 'admin';
        
        const syncedUser: User = {
          username: isAdmin ? 'admin' : (userMetadata.client_name || 'cliente'),
          password: '', // Campo richiesto dall'interfaccia User
          email: user.email,
          clientId: clientId || undefined
        };
        
        localStorage.setItem(USER_KEY, JSON.stringify(syncedUser));
      }
    } catch (error) {
      // Silent error - non loggare per UX pulita
    }
  }

  // Metodo per compatibilità con AuthContext - ottiene la sessione Supabase
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        return null;
      }
      return session;
    } catch (error) {
      return null;
    }
  }

  // Metodo per compatibilità con AuthContext - ascolta cambiamenti auth
  onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Utente ha fatto login
        const userMetadata = session.user.user_metadata || {};
        const clientId = userMetadata.client_id;
        const userType = userMetadata.user_type;
        const isAdmin = session.user.email === 'autoexpressadservice@gmail.com' || userType === 'admin';
        
        const user: User = {
          username: isAdmin ? 'admin' : (userMetadata.client_name || 'cliente'),
          password: '', // Campo richiesto dall'interfaccia User
          email: session.user.email || '',
          clientId: clientId || undefined
        };
        
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        callback(user);
        
      } else if (event === 'SIGNED_OUT') {
        // Utente ha fatto logout
        localStorage.removeItem(USER_KEY);
        callback(null);
        
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token rinnovato - sincronizza i dati
        await this.syncAuthState();
        const currentUser = this.getCurrentUser();
        callback(currentUser);
      }
    });
  }

  // Metodo per verificare se la sessione è ancora valida
  async isSessionValid(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('⚠️ Errore nel controllo sessione:', error.message);
        return false;
      }
      
      if (!session || !session.user) {
        console.log('🚪 Nessuna sessione attiva');
        return false;
      }
      
      // Verifica la scadenza del token
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      
      if (expiresAt && now >= expiresAt) {
        console.log('⏰ Token scaduto');
        return false;
      }
      
      // Se il token scade entro i prossimi 5 minuti, prova a rinnovarlo
      const REFRESH_THRESHOLD = 5 * 60; // 5 minuti
      if (expiresAt && (expiresAt - now) <= REFRESH_THRESHOLD) {
        console.log('🔄 Token in scadenza, tentativo di rinnovo...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ Impossibile rinnovare il token:', refreshError.message);
          return false;
        }
        
        if (refreshData.session) {
          console.log('✅ Token rinnovato con successo');
          localStorage.setItem('last_session_refresh', now.toString());
          return true;
        }
      }
      
      // Refresh preventivo ogni 30 minuti se non fatto di recente
      const lastRefresh = localStorage.getItem('last_session_refresh');
      const lastRefreshTime = lastRefresh ? parseInt(lastRefresh) : 0;
      
      if (now - lastRefreshTime > 1800) { // 30 minuti
        console.log('🔄 Refresh periodico della sessione...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && refreshData.session) {
          localStorage.setItem('last_session_refresh', now.toString());
          console.log('✅ Sessione rinnovata periodicamente');
        }
      }
      
      console.log('✅ Sessione valida');
      return true;
    } catch (error) {
      console.error('❌ Errore nella verifica sessione:', error);
      return false;
    }
  }
}

export const authService = new AuthService();
