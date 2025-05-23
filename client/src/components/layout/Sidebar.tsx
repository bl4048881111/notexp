import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, LayoutDashboard, Users, Calendar, FileText, Settings, X, Activity, Wrench, CheckSquare, ClipboardList, ClipboardCheck, Bug, BarChart2, ChevronDown, Package, CalendarClock, CarTaxiFront } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/use-mobile";
import autoExpressLogo from "../../assets/logo.png";  // Updated import path
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  
  const handleLogout = () => {
    logout();
  };
  
  const isActive = (path: string) => location === path;
  
  const isMobile = useIsMobile();
  
  // Se cliente, mostra solo le voci cliente
  if (user?.clientId) {
    return (
      <aside className="w-64 bg-[#111111] border-r border-gray-800 flex flex-col shadow-xl h-full">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center">
              <div className="flex justify-center items-center w-10 h-10">
                <img src={autoExpressLogo} alt="AutoExpress Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="ml-3 text-xl font-bold">
                <span className="text-white">AUTOE</span>
                <span className="text-primary">X</span>
                <span className="text-white">PRESS</span>
              </h1>
            </Link>
            
            {isMobile && onClose && (
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Chiudi menu"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-2 px-3">
            <li>
              <Link href="/dashboard" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${isActive("/dashboard") ? "bg-[#222222] text-white border-l-4 border-primary" : ""}`}>
                <LayoutDashboard className={`mr-3 h-5 w-5 ${isActive("/dashboard") ? "text-primary" : ""}`} />
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/quotes" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${isActive("/quotes") ? "bg-[#222222] text-white border-l-4 border-primary" : ""}`}>
                <FileText className={`mr-3 h-5 w-5 ${isActive("/quotes") ? "text-primary" : ""}`} />
                Preventivi
              </Link>
            </li>
            <li>
              <Link href="/storico-lavori" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${isActive("/storico-lavori") ? "bg-[#222222] text-white border-l-4 border-primary" : ""}`}>
                <CheckSquare className={`mr-3 h-5 w-5 ${isActive("/storico-lavori") ? "text-primary" : ""}`} />
                Storico Lavori
              </Link>
            </li>
            <li>
              <Link href="/parti-sostituite" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${isActive("/parti-sostituite") ? "bg-[#222222] text-white border-l-4 border-primary" : ""}`}>
                <Wrench className={`mr-3 h-5 w-5 ${isActive("/parti-sostituite") ? "text-primary" : ""}`} />
                Parti Sostituite
              </Link>
            </li>
            <li>
              <Link href="/profilo-cliente" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${isActive("/profilo-cliente") ? "bg-[#222222] text-white border-l-4 border-primary" : ""}`}>
                <Settings className={`mr-3 h-5 w-5 ${isActive("/profilo-cliente") ? "text-primary" : ""}`} />
                Profilo
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="p-6 border-t border-gray-800 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    );
  }
  
  return (
    <aside className="w-64 bg-[#111111] border-r border-gray-800 flex flex-col shadow-xl h-full">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            <div className="flex justify-center items-center w-10 h-10">
              <img src={autoExpressLogo} alt="AutoExpress Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="ml-3 text-xl font-bold">
              <span className="text-white">AUTOE</span>
              <span className="text-primary">X</span>
              <span className="text-white">PRESS</span>
            </h1>
          </Link>
          
          {isMobile && onClose && (
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Chiudi menu"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-2 px-3">
          <li>
            <Link 
              href="/clients" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/clients") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <Users className={`mr-3 h-5 w-5 ${isActive("/clients") ? "text-primary" : ""}`} />
              Clienti
            </Link>
          </li>
          <li>
            <Link 
              href="/quotes" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/quotes") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <FileText className={`mr-3 h-5 w-5 ${isActive("/quotes") ? "text-primary" : ""}`} />
              Preventivi
            </Link>
          </li>
          <li>
            <Link 
              href="/appointments" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/appointments") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <Calendar className={`mr-3 h-5 w-5 ${isActive("/appointments") ? "text-primary" : ""}`} />
              Appuntamenti
            </Link>
          </li>
          <li>
            <Link 
              href="/orders" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/orders") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <Activity className={`mr-3 h-5 w-5 ${isActive("/orders") ? "text-primary" : ""}`} />
              Ordini
            </Link>
          </li>
          <li>
            <Link 
              href="/tagliando" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/tagliando") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <CarTaxiFront className={`mr-3 h-5 w-5 ${isActive("/tagliando") ? "text-primary" : ""}`} />
              Lavorazione
            </Link>
          </li>
          <li>
            <Link 
              href="/storico-lavori" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/storico-lavori") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <CheckSquare className={`mr-3 h-5 w-5 ${isActive("/storico-lavori") ? "text-primary" : ""}`} />
              Storico Lavori
            </Link>
          </li>
          <li>
            <Link href="/parti-sostituite" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${isActive("/parti-sostituite") ? "bg-[#222222] text-white border-l-4 border-primary" : ""}`}>
              <Wrench className={`mr-3 h-5 w-5 ${isActive("/parti-sostituite") ? "text-primary" : ""}`} />
              Parti Sostituite
            </Link>
          </li>
          <li>
            <Link 
              href="/checklist-editor" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/checklist-editor") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <ClipboardCheck className={`mr-3 h-5 w-5 ${isActive("/checklist-editor") ? "text-primary" : ""}`} />
              Gestione Checklist
            </Link>
          </li>
          <li>
            <Link 
              href="/services" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/services") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <Settings className={`mr-3 h-5 w-5 ${isActive("/services") ? "text-primary" : ""}`} />
              Gestione Servizi
            </Link>
          </li>
          <li>
            <Link 
              href="/compleanni" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/compleanni") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <Calendar className={`mr-3 h-5 w-5 ${isActive("/compleanni") ? "text-primary" : ""}`} />
              Compleanni
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="p-6 border-t border-gray-800 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </Button>

        <Separator className="my-2" />

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          asChild
        >
          <Link href="/admin-tools">
            <Settings className="mr-2 h-4 w-4" />
            <span>Amministrazione</span>
          </Link>
        </Button>
      </div>
    </aside>
  );
}
