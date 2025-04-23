import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

import { getAllAppointments, getRecentClients, getAllClients } from "@shared/firebase";
import { Client, Appointment } from "@shared/types";

import QuickActionButton from "../components/dashboard/QuickActionButton";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Users, Clock, ClipboardList, ArrowRight, Car } from "lucide-react";
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
    queryFn: () => getRecentClients(5),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false
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
    <div className="space-y-8">
      {/* Contatori statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardContent className="pt-6 pb-2 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Clienti</p>
                <p className="text-3xl font-bold">
                  {isLoadingStats ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    statistics?.totalClients || 0
                  )}
                </p>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border">
          <CardContent className="pt-6 pb-2 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Nuovi questo mese</p>
                {isLoadingStats ? (
                  <div className="text-3xl font-bold"><Skeleton className="h-9 w-12" /></div>
                ) : (
                  <p className="text-3xl font-bold">{statistics?.newClientsThisMonth || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Car className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border">
          <CardContent className="pt-6 pb-2 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Appuntamenti</p>
                {isLoadingStats ? (
                  <div className="text-3xl font-bold"><Skeleton className="h-9 w-12" /></div>
                ) : (
                  <p className="text-3xl font-bold">{statistics?.totalAppointments || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border">
          <CardContent className="pt-6 pb-2 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Oggi</p>
                {isLoadingAppointments ? (
                  <div className="text-3xl font-bold"><Skeleton className="h-9 w-12" /></div>
                ) : (
                  <p className="text-3xl font-bold">{appointments.length}</p>
                )}
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick action buttons */}
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
      
      {/* Calendar-style today's appointments */}
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Appuntamenti Oggi</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCalendar}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              Visualizza Calendario
            </Button>
          </div>
          <CardDescription>
            {format(new Date(), 'd MMMM yyyy', { locale: it })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAppointments ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appointment: Appointment) => (
                <div 
                  key={appointment.id} 
                  className="flex p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors"
                >
                  <div className="mr-3 flex flex-col items-center justify-center bg-primary/10 h-16 w-16 rounded-md">
                    <span className="text-xs text-muted-foreground">Ore</span>
                    <span className="text-xl font-bold text-primary">
                      {appointment.time ? appointment.time.split(':')[0] : '--'}:{appointment.time ? appointment.time.split(':')[1] : '--'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{appointment.clientName}</h4>
                    <p className="text-sm text-muted-foreground">{appointment.services && appointment.services.length > 0 ? appointment.services.join(', ') : 'Nessun servizio'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{appointment.plate} - {appointment.model}</p>
                  </div>
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setLocation(`/appointments`)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nessun appuntamento programmato per oggi</p>
              <Button 
                variant="link" 
                className="mt-2" 
                onClick={handleNewAppointment}
              >
                Crea nuovo appuntamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
