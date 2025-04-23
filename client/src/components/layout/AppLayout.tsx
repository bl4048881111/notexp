import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../hooks/useAuth";
import Sidebar from "./Sidebar";
import { useIsMobile } from "../../hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [currentDate, setCurrentDate] = useState("");
  const [pageTitle, setPageTitle] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    // Format current date
    setCurrentDate(format(new Date(), "d MMMM yyyy", { locale: it }));
    
    // Set page title based on current route
    switch (location) {
      case "/dashboard":
        setPageTitle("Dashboard");
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
      default:
        setPageTitle("La Mia Officina");
    }
    
    // Close sidebar when route changes
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location, isMobile]);
  
  // Initialize sidebar based on screen size
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);
  
  if (!isAuthenticated) {
    return <>{children}</>;
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop and mobile */}
      <div 
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${isMobile ? 'fixed z-30 h-full' : 'relative'} 
          transition-transform duration-300 ease-in-out
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      
      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#1a1a1a]">
        {/* Top bar */}
        <header className="bg-[#111111] px-4 md:px-6 py-4 flex items-center justify-between shadow-lg border-b border-gray-800">
          <div className="flex items-center">
            {isMobile && (
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-3 text-white hover:text-primary transition-colors"
              >
                <Menu size={24} />
              </button>
            )}
            <h2 className="text-lg md:text-xl font-bold text-white">{pageTitle}</h2>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6">
            <div className="text-gray-400 font-medium hidden md:block">
              <span>{currentDate}</span>
            </div>
            <div className="relative group">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/90 hover:bg-primary transition-colors duration-200 flex items-center justify-center text-white font-medium cursor-pointer shadow-md">
                A
              </div>
              <div className="absolute right-0 mt-2 w-48 p-2 bg-[#222222] rounded-md shadow-lg border border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                {isMobile && (
                  <div className="px-3 py-1 text-sm font-medium text-gray-400 border-b border-gray-700 mb-1">
                    {currentDate}
                  </div>
                )}
                <a 
                  href="/activity-log"
                  className="flex w-full items-center px-3 py-2 text-sm text-gray-300 hover:bg-[#333333] hover:text-white rounded-md transition-colors duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                    <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                  Log Attività
                </a>
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
