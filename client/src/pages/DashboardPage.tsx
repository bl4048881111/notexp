import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";

import { getAllAppointments, getRecentClients, getAllClients } from "@shared/firebase";
import { Client, Appointment } from "@shared/types";

import StatCard from "../components/dashboard/StatCard";
import AppointmentCard from "../components/dashboard/AppointmentCard";
import QuickActionButton from "../components/dashboard/QuickActionButton";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch today's appointments
  const { 
    data: appointments = [], 
    isLoading: isLoadingAppointments 
  } = useQuery({ 
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const allAppointments = await getAllAppointments();
      return allAppointments.filter(app => app.date === today);
    }
  });

  // Fetch recent clients
  const { 
    data: recentClients = [], 
    isLoading: isLoadingClients 
  } = useQuery({ 
    queryKey: ['/api/clients/recent'],
    queryFn: () => getRecentClients(5)
  });

  // Fetch statistics
  const { 
    data: statistics, 
    isLoading: isLoadingStats 
  } = useQuery({ 
    queryKey: ['/api/statistics'],
    queryFn: async () => {
      const allClients = await getAllClients();
      const allAppointments = await getAllAppointments();
      
      // Calculate new clients this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const newClientsThisMonth = allClients.filter(client => client.createdAt >= startOfMonth).length;
      
      return {
        totalClients: allClients.length,
        totalAppointments: allAppointments.length,
        newClientsThisMonth
      };
    }
  });

  // Quick action handlers
  const handleNewClient = () => setLocation("/clients");
  const handleNewAppointment = () => setLocation("/appointments");
  const handleCalendar = () => setLocation("/appointments");
  const handleSearchClient = () => setLocation("/clients");

  return (
    <div className="space-y-6">
      {/* Quick access buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickActionButton 
          icon="person_add" 
          label="Nuovo Cliente" 
          onClick={handleNewClient} 
        />
        <QuickActionButton 
          icon="event_available" 
          label="Nuovo Appuntamento" 
          onClick={handleNewAppointment} 
        />
        <QuickActionButton 
          icon="calendar_today" 
          label="Calendario" 
          onClick={handleCalendar} 
        />
        <QuickActionButton 
          icon="search" 
          label="Cerca Cliente" 
          onClick={handleSearchClient} 
        />
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Appointments today */}
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-bold text-lg">Appuntamenti Oggi</h3>
            <span className="text-primary font-bold text-xl">
              {isLoadingAppointments ? (
                <Skeleton className="h-8 w-8" />
              ) : (
                appointments.length
              )}
            </span>
          </div>
          <ScrollArea className="p-4 h-80">
            {isLoadingAppointments ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="mb-3">
                  <Skeleton className="h-24 w-full mb-3" />
                </div>
              ))
            ) : appointments.length > 0 ? (
              appointments.map((appointment: Appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))
            ) : (
              <div className="text-center p-4 text-muted-foreground">
                Nessun appuntamento per oggi
              </div>
            )}
          </ScrollArea>
        </div>
        
        {/* New clients */}
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-bold text-lg">Clienti Recenti</h3>
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => setLocation('/clients')}
            >
              Vedi tutti
            </Button>
          </div>
          <ScrollArea className="p-4 h-80">
            {isLoadingClients ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="mb-3">
                  <Skeleton className="h-20 w-full mb-3" />
                </div>
              ))
            ) : recentClients.length > 0 ? (
              recentClients.map((client: Client) => (
                <div key={client.id} className="mb-3 p-3 bg-background rounded-md hover:bg-accent/30 transition-colors duration-200">
                  <h4 className="font-medium">{client.name} {client.surname}</h4>
                  <p className="text-sm text-muted-foreground">{client.model} - {client.plate}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aggiunto: {format(new Date(client.createdAt), 'dd/MM/yyyy')}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center p-4 text-muted-foreground">
                Nessun cliente recente
              </div>
            )}
          </ScrollArea>
        </div>
        
        {/* Total active clients */}
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold text-lg">Statistiche Clienti</h3>
          </div>
          <div className="p-8 flex flex-col items-center justify-center text-center">
            {isLoadingStats ? (
              <>
                <Skeleton className="h-12 w-24 mb-6" />
                <div className="grid grid-cols-2 gap-8 w-full">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-muted-foreground text-sm mb-1">Totale Clienti</p>
                  <div className="text-4xl font-bold text-primary">{statistics?.totalClients || 0}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 w-full">
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Nuovi questo mese</p>
                    <div className="text-2xl font-medium">{statistics?.newClientsThisMonth || 0}</div>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Appuntamenti totali</p>
                    <div className="text-2xl font-medium">{statistics?.totalAppointments || 0}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
