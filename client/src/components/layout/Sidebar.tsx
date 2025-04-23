import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, LayoutDashboard, Users, Calendar, FileText, Settings } from "lucide-react";
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
    <aside className="w-64 bg-[#111111] border-r border-gray-800 flex flex-col shadow-xl">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center">
          <div className="flex justify-center items-center w-10 h-10 bg-primary rounded-md text-3xl font-bold text-white">X</div>
          <h1 className="ml-3 text-xl font-bold">
            <span className="text-white">AUTO</span>
            <span className="text-primary">X</span>
            <span className="text-white">PRESS</span>
          </h1>
        </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-2 px-3">
          <li>
            <Link href="/dashboard" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/dashboard") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}>
                <LayoutDashboard className={`mr-3 h-5 w-5 ${isActive("/dashboard") ? "text-primary" : ""}`} />
                Dashboard
            </Link>
          </li>
          <li>
            <Link href="/clients" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/clients") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}>
                <Users className={`mr-3 h-5 w-5 ${isActive("/clients") ? "text-primary" : ""}`} />
                Clienti
            </Link>
          </li>
          <li>
            <Link href="/appointments" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/appointments") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}>
                <Calendar className={`mr-3 h-5 w-5 ${isActive("/appointments") ? "text-primary" : ""}`} />
                Appuntamenti
            </Link>
          </li>
          <li>
            <Link href="/quotes" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/quotes") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}>
                <FileText className={`mr-3 h-5 w-5 ${isActive("/quotes") ? "text-primary" : ""}`} />
                Preventivi
            </Link>
          </li>
          <li>
            <Link href="/services" className={`flex items-center px-4 py-3 text-gray-300 hover:bg-[#222222] hover:text-white rounded-md transition-all duration-200 ${
                isActive("/services") ? "bg-[#222222] text-white border-l-4 border-primary" : ""
              }`}>
                <Settings className={`mr-3 h-5 w-5 ${isActive("/services") ? "text-primary" : ""}`} />
                Gestione Servizi
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="p-6 border-t border-gray-800">
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
