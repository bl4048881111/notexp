import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, LayoutDashboard, Users, Calendar, FileText, Settings, X, Activity, Wrench, CheckSquare, ClipboardList, ClipboardCheck, Bug, BarChart2, ChevronDown, Package, CalendarClock, CarTaxiFront, MessageSquare, Tablet, FileBarChart, Bell, MessageCircle, ChevronRight, ChevronLeft, ListChecks } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/use-mobile";
import autoExpressLogo from "../../assets/logo.png";  // Updated import path
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
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
      <aside 
        className={`${collapsed && !isMobile ? 'w-20' : 'w-64'} bg-[#111111] border-r border-gray-800 flex flex-col shadow-xl h-full transition-all duration-300`}
      >
        <div className={`${collapsed && !isMobile ? 'p-3' : 'p-6'} border-b border-gray-800`}>
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center">
              <div className={`flex justify-center items-center ${collapsed && !isMobile ? 'w-10 h-10' : 'w-10 h-10'}`}>
                <img src={autoExpressLogo} alt="AutoExpress Logo" className="w-full h-full object-contain" />
              </div>
              {(!collapsed || isMobile) && (
                <h1 className="ml-3 text-xl font-bold">
                  <span className="text-white">AUTOE</span>
                  <span className="text-primary">X</span>
                  <span className="text-white">PRESS</span>
                </h1>
              )}
            </Link>
            
            {/* Toggle button per desktop */}
            {!isMobile && onToggleCollapse && (
              <button 
                onClick={onToggleCollapse}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800 flex items-center justify-center"
                aria-label="Collassa menu"
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}
            
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
        
        <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
          <ul className={`space-y-3 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`}>
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/dashboard" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/dashboard") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <LayoutDashboard className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/dashboard") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Dashboard</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Dashboard</TooltipContent>}
              </Tooltip>
            </li>
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/quotes" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/quotes") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <FileText className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/quotes") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Preventivi</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Preventivi</TooltipContent>}
              </Tooltip>
            </li>
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/storico-lavori" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/storico-lavori") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <CheckSquare className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/storico-lavori") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Storico Lavori</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Storico Lavori</TooltipContent>}
              </Tooltip>
            </li>
            {/*<li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/report-lavori" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/report-lavori") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <FileBarChart className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/report-lavori") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Report Lavori</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Report Lavori</TooltipContent>}
              </Tooltip>
            </li>*/}
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/parti-sostituite" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/parti-sostituite") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <Wrench className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/parti-sostituite") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Parti Sostituite</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Parti Sostituite</TooltipContent>}
              </Tooltip>
            </li>
            
            {/* Separatore visivo 
            {(!collapsed || isMobile) && <li><div className="border-t border-gray-700 my-3"></div></li>}
            {collapsed && !isMobile && <li><div className="border-t border-gray-700/50 my-4 mx-3"></div></li>}
            
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/appointments" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/appointments") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <Calendar className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/appointments") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Appuntamenti</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Appuntamenti</TooltipContent>}
              </Tooltip>
            </li>*/}
            <li>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/profilo-cliente" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/profilo-cliente") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                    <Users className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/profilo-cliente") ? "text-primary" : ""}`} />
                    {(!collapsed || isMobile) && <span className="font-medium">Il mio Profilo</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Il mio Profilo</TooltipContent>}
              </Tooltip>
            </li>
          </ul>
        </nav>
        
        <div className={`${collapsed && !isMobile ? 'p-3' : 'p-4'} border-t border-gray-800`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleLogout}
                className={`flex w-full items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200`}
              >
                <LogOut className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'}`} />
                {(!collapsed || isMobile) && <span className="font-medium">Logout</span>}
              </button>
            </TooltipTrigger>
            {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Logout</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    );
  }
  
  return (
    <aside 
      className={`${collapsed && !isMobile ? 'w-20' : 'w-64'} bg-[#111111] border-r border-gray-800 flex flex-col shadow-xl h-full transition-all duration-300`}
    >
      <div className={`${collapsed && !isMobile ? 'p-3' : 'p-6'} border-b border-gray-800`}>
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            <div className={`flex justify-center items-center ${collapsed && !isMobile ? 'w-10 h-10' : 'w-10 h-10'}`}>
              <img src={autoExpressLogo} alt="AutoExpress Logo" className="w-full h-full object-contain" />
            </div>
            {(!collapsed || isMobile) && (
              <h1 className="ml-3 text-xl font-bold">
                <span className="text-white">AUTOE</span>
                <span className="text-primary">X</span>
                <span className="text-white">PRESS</span>
              </h1>
            )}
          </Link>
          
          {/* Toggle button per desktop */}
          {!isMobile && onToggleCollapse && (
            <button 
              onClick={onToggleCollapse}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800 flex items-center justify-center"
              aria-label="Collassa menu"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
          
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
      
      <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
        <ul className={`space-y-3 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`}>
          {/* Sezione Gestione */}
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/clients" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/clients") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Users className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/clients") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Clienti</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Clienti</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/quotes" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/quotes") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <FileText className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/quotes") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Preventivi</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Preventivi</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/appointments" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/appointments") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Calendar className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/appointments") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Appuntamenti</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Appuntamenti</TooltipContent>}
            </Tooltip>
          </li>
          
          {/* Separatore visivo */}
          {(!collapsed || isMobile) && <li><div className="border-t border-gray-700 my-3"></div></li>}
          {collapsed && !isMobile && <li><div className="border-t border-gray-700/50 my-4 mx-3"></div></li>}
          
          {/* Sezione Operazioni */}
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/orders" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/orders") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Activity className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/orders") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Ordini</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Ordini</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/accettazione-merce" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/accettazione-merce") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Package className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/accettazione-merce") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Accettazione Merce</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Accettazione Merce</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/tagliando" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/tagliando") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <CarTaxiFront className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/tagliando") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Lavorazione</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Lavorazione</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/storico-lavori" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/storico-lavori") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <CheckSquare className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/storico-lavori") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Storico Lavori</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Storico Lavori</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/report-lavori" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/report-lavori") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                  <FileBarChart className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/report-lavori") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Report Lavori</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Report Lavori</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/parti-sostituite" className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${isActive("/parti-sostituite") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""}`}>
                  <Wrench className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/parti-sostituite") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Parti Sostituite</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Parti Sostituite</TooltipContent>}
            </Tooltip>
          </li>
          
          {/* Separatore visivo */}
          {(!collapsed || isMobile) && <li><div className="border-t border-gray-700 my-3"></div></li>}
          {collapsed && !isMobile && <li><div className="border-t border-gray-700/50 my-4 mx-3"></div></li>}
          
          {/* Sezione Configurazione */}
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/checklist-editor" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/checklist-editor") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <ClipboardCheck className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/checklist-editor") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Checklist</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Gestione Checklist</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/services" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/services") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Settings className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/services") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Servizi</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Gestione Servizi</TooltipContent>}
            </Tooltip>
          </li>
          
          {/* Separatore visivo */}
          {(!collapsed || isMobile) && <li><div className="border-t border-gray-700 my-3"></div></li>}
          {collapsed && !isMobile && <li><div className="border-t border-gray-700/50 my-4 mx-3"></div></li>}
          
          {/* Sezione Comunicazioni 
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/compleanni" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/compleanni") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Calendar className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/compleanni") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Compleanni</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Compleanni</TooltipContent>}
            </Tooltip>
          </li>
          */}
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/requests" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/requests") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <MessageSquare className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/requests") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Richieste</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Richieste</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/whatsapp-templates" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/whatsapp-templates") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <MessageCircle className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/whatsapp-templates") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Risposte</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Template WhatsApp</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/smart-reminders" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/smart-reminders") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <Bell className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/smart-reminders") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Promemoria</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Smart Reminders</TooltipContent>}
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="/istruzioni" 
                  onClick={() => isMobile && onClose && onClose()}
                  className={`flex items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200 ${
                    isActive("/istruzioni") ? "bg-primary/20 text-primary border-l-4 border-primary" : ""
                  }`}
                >
                  <ListChecks className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'} ${isActive("/istruzioni") ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="font-medium">Istruzioni</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Istruzioni</TooltipContent>}
            </Tooltip>
          </li>
        </ul>
      </nav>
      
      <div className={`${collapsed && !isMobile ? 'p-3 space-y-3' : 'p-4 space-y-2'} border-t border-gray-800`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className={`flex w-full items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200`}
            >
              <LogOut className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'}`} />
              {(!collapsed || isMobile) && <span className="font-medium">Logout</span>}
            </button>
          </TooltipTrigger>
          {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Logout</TooltipContent>}
        </Tooltip>

        {(!collapsed || isMobile) && <div className="border-t border-gray-700"></div>}

        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              href="/admin-tools"
              className={`flex w-full items-center ${collapsed && !isMobile ? 'justify-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800' : 'px-4 py-3 rounded-lg hover:bg-[#222222]'} text-gray-300 hover:text-white transition-all duration-200`}
            >
              <Settings className={`${collapsed && !isMobile ? 'w-4 h-4' : 'mr-3 h-4 w-4'}`} />
              {(!collapsed || isMobile) && <span className="font-medium">Admin</span>}
            </Link>
          </TooltipTrigger>
          {collapsed && !isMobile && <TooltipContent side="right" className="font-medium">Amministrazione</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
}
