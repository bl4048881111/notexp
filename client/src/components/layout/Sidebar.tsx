import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, LayoutDashboard, Users, Calendar, FileText, Settings, X, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/use-mobile";
import autoExpressLogo from "../../assets/autoexpress-logo.png";

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const handleLogout = () => {
    logout();
  };
  
  const isActive = (path: string) => location === path;
  
  const isMobile = useIsMobile();
  
  return (
    <aside className="w-64 bg-[#111111] border-r border-gray-800 flex flex-col shadow-xl h-full">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex justify-center items-center w-10 h-10 bg-primary rounded-md text-3xl font-bold text-white">X</div>
            <h1 className="ml-3 text-xl font-bold">
              <span className="text-white">AUTO</span>
              <span className="text-primary">X</span>
              <span className="text-white">PRESS</span>
            </h1>
          </div>
          
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
              href="/dashboard" 
              onClick={() => isMobile && onClose && onClose()}
              className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/dashboard") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}
            >
              <LayoutDashboard className={`mr-3 h-5 w-5 ${isActive("/dashboard") ? "text-primary" : ""}`} />
              Dashboard
            </Link>
          </li>
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
        </ul>
      </nav>
      
      <div className="p-6 border-t border-gray-800 space-y-2">
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center justify-between px-4 py-2 text-gray-400 hover:text-white hover:bg-[#222222] w-full rounded-md transition-all duration-200"
          >
            <div className="flex items-center">
              <Settings className="mr-3 h-5 w-5" />
              <span>Profilo</span>
            </div>
            {showProfileMenu ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showProfileMenu && (
            <div className="mt-1 bg-[#1a1a1a] rounded-md overflow-hidden">
              <Link 
                href="/activity-log" 
                onClick={() => {
                  setShowProfileMenu(false);
                  isMobile && onClose && onClose();
                }}
                className={`flex items-center px-4 py-2 text-gray-400 hover:text-white hover:bg-[#222222] w-full transition-all duration-200 ${
                  isActive("/activity-log") ? "bg-[#222222] text-white border-l-2 border-primary" : ""
                }`}
              >
                <Activity className={`ml-3 mr-3 h-4 w-4 ${isActive("/activity-log") ? "text-primary" : ""}`} />
                Log Attività
              </Link>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center px-4 py-2 text-gray-400 hover:text-white hover:bg-red-900/30 w-full rounded-md transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
