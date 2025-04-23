import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useActivityLogger } from './ActivityLogger';

const pageNameMap: Record<string, string> = {
  '/': 'Home',
  '/login': 'Login',
  '/dashboard': 'Dashboard',
  '/clients': 'Clienti',
  '/appointments': 'Appuntamenti',
  '/quotes': 'Preventivi',
  '/service-management': 'Gestione Servizi'
};

export default function PageTracker() {
  const [location] = useLocation();
  const { logActivity } = useActivityLogger();

  useEffect(() => {
    // Nome della pagina visitata (usa una mappatura se disponibile, altrimenti il percorso)
    const pageName = pageNameMap[location] || location;
    
    // Registra l'accesso alla pagina
    logActivity(
      'page_view',
      `Accesso a: ${pageName}`,
      {
        path: location,
        pageName,
        timestamp: new Date()
      }
    );
  }, [location, logActivity]);

  return null; // Componente senza rendering visibile
}