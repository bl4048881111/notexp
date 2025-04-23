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
import { CalendarIcon, Users, Clock, ClipboardList, ArrowRight, Car, Activity } from "lucide-react";
import { RecentActivityList } from "../components/dev/ActivityLogger";
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
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">Clienti</p>
                {isLoadingStats ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{statistics?.totalClients || 0}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border">
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">Nuovi mese</p>
                {isLoadingStats ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{statistics?.newClientsThisMonth || 0}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Car className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border">
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">Appuntamenti</p>
                {isLoadingStats ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{statistics?.totalAppointments || 0}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <ClipboardList className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border">
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">Oggi</p>
                {isLoadingAppointments ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{appointments.length}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
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
      
      {/* Layout a due colonne per desktop */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-8">
        {/* Appuntamenti oggi (5 colonne su desktop) */}
        <Card className="border border-border md:col-span-4">
          <CardHeader className="pb-2 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <CardTitle className="text-lg md:text-xl">Appuntamenti Oggi</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCalendar} className="w-full sm:w-auto">
                <CalendarIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Visualizza Calendario</span>
                <span className="sm:hidden">Calendario</span>
              </Button>
            </div>
            <CardDescription>
              {format(new Date(), 'd MMMM yyyy', { locale: it })}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
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
                    className="flex p-2 md:p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors"
                  >
                    <div className="mr-2 md:mr-3 flex flex-col items-center justify-center bg-primary/10 h-14 w-14 md:h-16 md:w-16 rounded-md shrink-0">
                      <span className="text-xs text-muted-foreground">Ore</span>
                      <span className="text-lg md:text-xl font-bold text-primary">
                        {appointment.time ? appointment.time.split(':')[0] : '--'}:{appointment.time ? appointment.time.split(':')[1] : '--'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{appointment.clientName}</h4>
                      <p className="text-sm text-muted-foreground truncate">{appointment.services && appointment.services.length > 0 ? appointment.services.join(', ') : 'Nessun servizio'}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{appointment.plate} - {appointment.model}</p>
                    </div>
                    <div className="flex items-center ml-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 shrink-0"
                        onClick={() => setLocation(`/appointments`)}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 text-muted-foreground">
                <Clock className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 opacity-20" />
                <p className="text-sm md:text-base">Nessun appuntamento programmato per oggi</p>
                <Button 
                  variant="link" 
                  className="mt-1 md:mt-2 text-sm md:text-base" 
                  onClick={handleNewAppointment}
                >
                  Crea nuovo appuntamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Attività recenti (3 colonne su desktop) */}
        <Card className="border border-border md:col-span-3">
          <CardHeader className="pb-2 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <CardTitle className="text-lg md:text-xl">Attività Recenti</CardTitle>
            </div>
            <CardDescription>
              Log delle azioni dell'utente
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="h-[302px]">
              <ScrollArea className="h-full pr-4">
                <RecentActivityList limit={8} showTitle={false} />
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
