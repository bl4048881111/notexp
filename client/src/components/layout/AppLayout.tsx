import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../hooks/useAuth";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [currentDate, setCurrentDate] = useState("");
  const [pageTitle, setPageTitle] = useState("Dashboard");
  const { isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  
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
  }, [location]);
  
  if (!isAuthenticated) {
    return <>{children}</>;
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card px-6 py-3 flex items-center justify-between shadow-md border-b border-border">
          <h2 className="text-xl font-bold">{pageTitle}</h2>
          
          <div className="flex items-center space-x-4">
            <div className="text-muted-foreground">
              <span>{currentDate}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
              A
            </div>
          </div>
        </header>
        
        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
