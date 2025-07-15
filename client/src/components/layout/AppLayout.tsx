import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { LogOut, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "./Sidebar";
import { useIsMobile } from "../../hooks/use-mobile";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion } from 'framer-motion';
import { supabase } from "../../../../shared/supabase";
import { authService } from "../../services/authService";
import { refreshAllQueriesAfterSessionRestore } from "../../lib/queryClient";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [pageTitle, setPageTitle] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, logout, user } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [showChat, setShowChat] = useState(false);
  
  useEffect(() => {
    // Format current date and time
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(format(now, "d MMMM yyyy", { locale: it }));
      setCurrentTime(format(now, "HH:mm", { locale: it }));
    };
    
    // Aggiorna subito
    updateDateTime();
    
    // Aggiorna ogni minuto
    const timer = setInterval(updateDateTime, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Sistema di controllo periodico sessione (SENZA timeout inattività)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let sessionRefreshInterval: NodeJS.Timeout;
    let sessionCheckInterval: NodeJS.Timeout;
    
    // Refresh periodico della sessione ogni 15 minuti (se attivo)
    const startSessionRefresh = () => {
      const SESSION_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minuti
      sessionRefreshInterval = setInterval(async () => {
        try {
          // console.log('🔄 Refresh periodico sessione...');
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.auth.refreshSession();
            // console.log('✅ Sessione rinnovata periodicamente');
          }
        } catch (error) {
          console.error('Errore nel refresh sessione:', error);
        }
      }, SESSION_REFRESH_INTERVAL);
    };
    
    // Controllo periodico validità sessione ogni 5 minuti
    const startSessionValidation = () => {
      const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minuti
      sessionCheckInterval = setInterval(async () => {
        try {
          // console.log('🔍 Controllo periodico validità sessione...');
          const validUser = await authService.getCurrentUserWithSessionCheck();
          
          if (!validUser) {
            // console.log('🚪 Sessione non valida rilevata - logout automatico');
            clearInterval(sessionCheckInterval);
            await logout();
          } else {
            // console.log('✅ Sessione ancora valida');
            
            // Se la sessione è valida ma le query potrebbero essere stale,
            // aggiorna i dati per assicurarsi che siano freschi
            const lastQueryRefresh = localStorage.getItem('last_query_refresh');
            const now = Date.now();
            const lastRefreshTime = lastQueryRefresh ? parseInt(lastQueryRefresh) : 0;
            
            // Aggiorna le query ogni 10 minuti se l'utente è attivo
            if (now - lastRefreshTime > 10 * 60 * 1000) { // 10 minuti
              // console.log('🔄 Aggiornamento periodico delle query...');
              await refreshAllQueriesAfterSessionRestore();
              localStorage.setItem('last_query_refresh', now.toString());
            }
          }
        } catch (error) {
          console.error('❌ Errore nel controllo periodico sessione:', error);
        }
      }, SESSION_CHECK_INTERVAL);
    };
    
    // Inizializza i timer (SENZA timer di inattività)
    startSessionRefresh();
    startSessionValidation();
    
    // Cleanup
    return () => {
      if (sessionRefreshInterval) {
        clearInterval(sessionRefreshInterval);
      }
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
    
  }, [isAuthenticated, logout]);
  
  useEffect(() => {
    // Set page title based on current route
    switch (location) {
      case "/dashboard":
        if (user?.clientId) {
          // Se è un cliente, mostra "Benvenuto" con il cognome
          setPageTitle(`Benvenuto ${user.name}`);
        } else {
          // Se è admin, lascia il titolo predefinito "Dashboard Amministratore"
          setPageTitle("Dashboard Amministratore");
        }
        break;
      case "/clients":
        setPageTitle("Gestione Clienti");
        break;
      case "/appointments":
        setPageTitle("Gestione Appuntamenti");
        break;
      case "/quotes":
        setPageTitle("Gestione Preventivi");
        break;
      case "/services":
        setPageTitle("Gestione Servizi");
        break;
      case "/tagliando":
        setPageTitle("Lavorazione");
        break;
      case "/storico-lavori":
        setPageTitle("Storico Lavori Completati");
        break;
      case "/report-lavori":
        setPageTitle("Report Lavori Completati");
        break;
      case "/orders":
        setPageTitle("Gestione Ordini");
        break;
      case "/checklist-editor":
        setPageTitle("Gestione Parametri Checklist");
        break;
      case "/whatsapp-templates":
        setPageTitle("Gestione Risposte WhatsApp");
        break;
      default:
        if (location.startsWith("/tagliando/")) {
          setPageTitle("Lavorazione");
        } else {
          setPageTitle("Dashboard");
        }
    }
    
    // Close sidebar when route changes
    if (isMobile) {
      setSidebarOpen(false);
    }
    
  }, [location, isMobile, user, isAuthenticated]);
  
  // Initialize sidebar based on screen size
  useEffect(() => {
    setSidebarOpen(!isMobile);
    // Reset collapse state on mobile
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile]);
  
  // Funzione per gestire la chiusura della sidebar (solo su mobile)
  const handleSidebarClose = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };
  
  // Funzione per gestire il collasso della sidebar (solo su desktop)
  const handleSidebarToggle = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };
  
  if (!isAuthenticated) {
    return <>{children}</>;
  }
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar for desktop and mobile */}
      <div 
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${isMobile ? 'fixed z-30 h-full' : 'relative'}
          ${sidebarCollapsed && !isMobile ? 'w-16' : ''}
          transition-all duration-300 ease-in-out
          flex-shrink-0
        `}
      >
        <Sidebar 
          onClose={handleSidebarClose} 
          collapsed={sidebarCollapsed && !isMobile}
          onToggleCollapse={() => !isMobile && setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      
      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#1a1a1a]">
        {/* Top bar */}
        <header className="bg-[#111111] px-4 md:px-6 py-4 flex items-center justify-between shadow-lg border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center min-w-0">
            {isMobile && (
              <button 
                onClick={handleSidebarToggle}
                className="mr-3 text-white hover:text-primary transition-colors flex-shrink-0"
              >
                <Menu size={24} />
              </button>
            )}
            {/* Pulsante per desktop quando la sidebar è chiusa (fallback) */}
            {!isMobile && !sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="mr-3 text-white hover:text-primary transition-colors flex-shrink-0"
              >
                <Menu size={24} />
              </button>
            )}
            <h2 className="text-lg md:text-xl font-bold text-white truncate">
              {location === "/dashboard" && user?.clientId ? (
                <>
                  Benvenuto <span className="text-orange-500">{user.name}</span>
                </>
              ) : (
                pageTitle
              )}
            </h2>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6 flex-shrink-0">
            <div className="text-gray-400 font-medium hidden lg:block">
              <span>{currentDate}</span>
              <span className="ml-2 text-primary">{currentTime}</span>
            </div>
            <div className="relative group">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/90 hover:bg-primary transition-colors duration-200 flex items-center justify-center text-white font-medium cursor-pointer shadow-md">
                {user?.surname ? user.surname[0].toUpperCase() : 'A'}
              </div>
              <div className="absolute right-0 mt-2 w-48 p-2 bg-[#222222] rounded-md shadow-lg border border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                {isMobile && (
                  <div className="px-3 py-1 text-sm font-medium text-gray-400 border-b border-gray-700 mb-1">
                    {currentDate} <span className="text-primary">{currentTime}</span>
                  </div>
                )}
                
                <button 
                  onClick={logout}
                  className="flex w-full items-center px-3 py-2 text-sm text-gray-300 hover:bg-[#333333] hover:text-white rounded-md transition-colors duration-200"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 min-h-0">
          <div className="min-w-0 w-full">
            {children}
          </div>
        </div>
      </main>

      {/* WhatsApp Widget per cliente, visibile su tutte le pagine */}
      {user?.clientId && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {showChat && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-2 bg-white text-black rounded-2xl shadow-xl p-4 w-[calc(100vw-48px)] max-w-[320px] border border-green-500 relative"
            >
              <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white rotate-45" />
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3 border-2 border-white shadow">
                  <FontAwesomeIcon icon={faWhatsapp} className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-green-600">Assistenza WhatsApp</div>
                  <div className="text-xs text-gray-500">Rispondiamo subito!</div>
                </div>
              </div>
              <p className="text-sm mb-4">Ciao! 👋 Come possiamo aiutarti oggi?</p>
              <a href="https://api.whatsapp.com/send/?phone=%2B393293888702&text=Salve!%20Ho%20bisogno%20di%20informazioni." target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg w-full block text-center transition">
                Inizia a chattare
              </a>
            </motion.div>
          )}
          <button
            onClick={() => setShowChat((v) => !v)}
            className="bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg p-4 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
            title="Chatta con noi su WhatsApp"
            aria-label="Chat WhatsApp"
          >
            <FontAwesomeIcon icon={faWhatsapp} className="w-7 h-7" />
          </button>
        </div>
      )}
      {/* Fine WhatsApp Widget */}
    </div>
  );
}
