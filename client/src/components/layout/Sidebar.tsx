import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, LayoutDashboard, Users, Calendar } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import autoExpressLogo from "../../assets/autoexpress-logo.png";

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
  };
  
  const isActive = (path: string) => location === path;
  
  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center">
          <div className="flex justify-center items-center w-12 h-12 text-4xl font-bold text-primary">X</div>
          <h1 className="ml-2 text-xl font-bold">
            <span className="text-[#666666]">AUTO</span>
            <span className="text-primary">X</span>
            <span className="text-[#666666]">PRESS</span>
          </h1>
        </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul>
          <li>
            <Link href="/dashboard" className={`flex items-center px-4 py-3 text-foreground hover:bg-accent/50 ${
                isActive("/dashboard") ? "border-l-2 border-primary bg-accent/50" : ""
              }`}>
                <LayoutDashboard className="mr-3 h-5 w-5" />
                Dashboard
            </Link>
          </li>
          <li>
            <Link href="/clients" className={`flex items-center px-4 py-3 text-foreground hover:bg-accent/50 ${
                isActive("/clients") ? "border-l-2 border-primary bg-accent/50" : ""
              }`}>
                <Users className="mr-3 h-5 w-5" />
                Clienti
            </Link>
          </li>
          <li>
            <Link href="/appointments" className={`flex items-center px-4 py-3 text-foreground hover:bg-accent/50 ${
                isActive("/appointments") ? "border-l-2 border-primary bg-accent/50" : ""
              }`}>
                <Calendar className="mr-3 h-5 w-5" />
                Appuntamenti
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border">
        <button 
          onClick={handleLogout}
          className="flex items-center text-muted-foreground hover:text-primary transition-colors duration-200"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
