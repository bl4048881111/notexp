// Sistema di autenticazione ibrido con logout automatico per inattività
// console.log('🔐 Sistema di autenticazione: IBRIDO - LOGOUT AUTOMATICO PER INATTIVITÀ');
// console.log('🔒 Admin: Supabase Auth (logout dopo 30min di inattività)');
// console.log('🔓 Clienti: Sistema semplificato (logout dopo 30min di inattività)');

export const config = {
  // Configurazione Supabase (per admin)
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  
  // Configurazione app
  app: {
    name: 'AutoExpress',
    version: '1.0.0',
    environment: import.meta.env.MODE || 'development',
  },
  
  // Configurazione autenticazione
  auth: {
    // Timeout di inattività in millisecondi (default: 30 minuti)
    inactivityTimeout: 30 * 60 * 1000,
    // Intervallo di refresh sessione in millisecondi (default: 15 minuti)
    sessionRefreshInterval: 15 * 60 * 1000,
  },
  
  // Validazione configurazione
  isSupabaseConfigured: () => {
    const hasUrl = !!config.supabase.url;
    const hasKey = !!config.supabase.anonKey;
    
    if (hasUrl && hasKey) {
      // console.log('✅ Configurazione Supabase valida (per admin)');
      return true;
    } else {
      // console.warn('⚠️ Configurazione Supabase mancante - Admin login non disponibile');
      return false;
    }
  }
}; 