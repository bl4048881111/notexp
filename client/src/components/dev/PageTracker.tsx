import { useEffect, useRef } from 'react';
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
  const prevLocationRef = useRef<string | null>(null);

  useEffect(() => {
    // Evita il loop infinito e registra solo quando la location cambia realmente
    if (location === prevLocationRef.current) {
      return;
    }
    
    // Aggiorna la location precedente
    prevLocationRef.current = location;
    
    // Nome della pagina visitata (usa una mappatura se disponibile, altrimenti il percorso)
    const pageName = pageNameMap[location] || location;
    
    // Non registriamo più la navigazione delle pagine
    console.log(`Navigazione a: ${pageName}`, {
      path: location,
      pageName,
      timestamp: new Date()
    });
  }, [location, logActivity]);

  return null; // Componente senza rendering visibile
}