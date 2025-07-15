import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isBefore, isToday, isAfter, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion } from 'framer-motion';

import { getAllAppointments, getAllClients, getAllQuotes, getQuoteById, getAllRequests } from "@shared/supabase";
import { Appointment } from "@shared/types";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/authService";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Users, ClipboardList, ArrowRight, Car, Wrench, UserPlus, CheckCircleIcon, ArrowUpRight, ArrowRightToLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TodayBirthdaysWidget from "../components/dashboard/TodayBirthdaysWidget";
import RemindersWidget from "../components/dashboard/RemindersWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function DashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const clientId = user?.clientId;
  const today = format(new Date(), 'yyyy-MM-dd');
  const queryClient = useQueryClient();
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Fetch all appointments for the client
  const { 
    data: allClientAppointments = [], 
    isLoading: isLoadingAppointments,
    refetch: refetchAppointments 
  } = useQuery({ 
    queryKey: ['/api/appointments', clientId],
    queryFn: async () => {
      let appointments: Appointment[] = [];
      
      if (user?.clientId) {
        // Se è un cliente, carica solo i suoi appuntamenti
        const { getAppointmentsByClientId } = await import("@shared/supabase");
        appointments = await getAppointmentsByClientId(user.clientId);
      } else {
        // Se è admin, carica tutti gli appuntamenti
        appointments = await getAllAppointments();
      }
      
      // IMPORTANTE: Normalizziamo i valori di duration e quoteLaborHours
      // per evitare incongruenze quando si passa dalla dashboard ai preventivi
      return appointments.map(app => {
        // Assicuriamoci che entrambi i valori siano numeri
        let duration = typeof app.duration === 'number' ? app.duration : 
                      typeof app.duration === 'string' ? parseFloat(app.duration) : 1;
        
        let quoteLaborHours = typeof app.quoteLaborHours === 'number' ? app.quoteLaborHours : 
                            typeof app.quoteLaborHours === 'string' ? parseFloat(app.quoteLaborHours) : 0;
        
        // Se duration non è valido, impostiamo a 1
        if (isNaN(duration) || duration <= 0) duration = 1;
        
        // Se quoteLaborHours non è valido, impostiamo uguale a duration
        if (isNaN(quoteLaborHours) || quoteLaborHours <= 0) quoteLaborHours = duration;
        
        // Sincronizziamo sempre i due valori, utilizza il valore maggiore tra i due
        // per garantire coerenza in tutte le viste
        const finalValue = Math.max(duration, quoteLaborHours);
        
        return {
          ...app,
          duration: finalValue,
          quoteLaborHours: finalValue
        };
      });
    },
    // Usa le impostazioni globali ottimizzate del QueryClient
  });

  // Fetch all quotes for real-time updates
  const { 
    data: allQuotes = [], 
    isLoading: isLoadingQuotes,
    refetch: refetchQuotes 
  } = useQuery({ 
    queryKey: ['/api/quotes', clientId],
    queryFn: async () => {
      let quotes = [];
      
      if (user?.clientId) {
        // Se è un cliente, carica solo i suoi preventivi
        const { getQuotesByClientId } = await import("@shared/supabase");
        quotes = await getQuotesByClientId(user.clientId);
      } else {
        // Se è admin, carica tutti i preventivi
        quotes = await getAllQuotes();
      }
      
      return quotes;
    },
    // Usa le impostazioni globali ottimizzate del QueryClient
  });

  // Fetch all clients for admin dashboard
  const { 
    data: allClients = [], 
    isLoading: isLoadingClients,
    refetch: refetchClients 
  } = useQuery({ 
    queryKey: ['/api/clients'],
    queryFn: getAllClients,
    enabled: !clientId // Solo per admin
    // Usa le impostazioni globali ottimizzate del QueryClient
  });

  // Fetch all requests for admin dashboard
  const { 
    data: allRequests = [], 
    isLoading: isLoadingRequests,
    refetch: refetchRequests 
  } = useQuery({ 
    queryKey: ['/api/requests'],
    queryFn: getAllRequests,
    enabled: !clientId // Solo per admin
    // Usa le impostazioni globali ottimizzate del QueryClient
  });

  // Fetch statistics (solo se il cliente ha bisogno di vederle)
  const { 
    data: statistics, 
    isLoading: isLoadingStats,
    refetch: refetchStats 
  } = useQuery({ 
    queryKey: ['/api/statistics', clientId, allClientAppointments.length, allQuotes.length],
    queryFn: async () => {
      if (!clientId) return null;
      
      // Usa i dati già caricati per le statistiche base
      const filteredAppointments = allClientAppointments;
      const filteredQuotes = allQuotes;
      
      const sentQuotes = filteredQuotes.filter(quote => quote.status === 'inviato').length;
      const totalQuotes = filteredQuotes.length;
      
      // Calcola il numero di parti sostituite dai preventivi associati agli appuntamenti completati
      let partiSostituite = 0;
      const completedAppointments = filteredAppointments.filter(app => app.status === 'completato');
      
      for (const app of completedAppointments) {
        // Parti dai preventivi associati
        if (app.quoteId) {
          try {
            const quote = await getQuoteById(app.quoteId);
            if (quote && quote.items) {
              quote.items.forEach((item: any) => {
                if (Array.isArray(item.parts)) {
                  partiSostituite += item.parts.length;
                }
              });
            }
          } catch (e) { 
            // console.log("Errore nel caricamento preventivo:", e);
          }
        }
      }
      
      return {
        totalAppointments: filteredAppointments.length,
        sentQuotes,
        totalQuotes,
        partiSostituite
      };
    },
    enabled: !!clientId && allClientAppointments.length >= 0 && allQuotes.length >= 0, // Esegui solo se clientId esiste e i dati sono caricati
    // Usa le impostazioni globali ottimizzate del QueryClient
  });

  // Quick action handlers
  const handleCalendar = () => setLocation("/appointments");

  // Funzione per iniziare la lavorazione di un appuntamento
  const handleStartWork = async (appointment: Appointment) => {
    try {
      const { updateAppointment } = await import("@shared/supabase");
      await updateAppointment(appointment.id, { 
        status: 'in_lavorazione' 
      });
      
      // Invalida le query per ricaricare i dati
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      refetchAppointments();
      
      toast({
        title: "Lavorazione iniziata",
        description: `Appuntamento di ${appointment.clientName} in lavorazione`,
      });
    } catch (error) {
      console.error('Errore durante l\'avvio della lavorazione:', error);
      toast({
        title: "Errore",
        description: "Impossibile iniziare la lavorazione",
        variant: "destructive",
      });
    }
  };

  // Se non è un cliente, mostra la dashboard dell'amministratore
  if (!clientId) {
    // Calcolo la data di oggi in formato yyyy-MM-dd
    const today = format(new Date(), 'yyyy-MM-dd');
    // Filtro solo gli appuntamenti di oggi e non completati
    const todayAppointments = allClientAppointments.filter(app => {
      const appDate = typeof app.date === 'string'
        ? app.date.split('T')[0]
        : format(new Date(app.date), 'yyyy-MM-dd');
      return appDate === today && app.status !== 'completato';
    });
    return (
      <div className="space-y-8">
        {/* Contatori statistiche dell'amministratore */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Clienti totali */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/clients')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Clienti</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingClients ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allClients.length
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Appuntamenti schedulati */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/appointments')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Appuntamenti Schedulati</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingAppointments ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allQuotes.filter(quote => quote.status === 'accettato').length
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Preventivi inviati */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/quotes')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Preventivi Inviati</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingQuotes ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allQuotes.filter(quote => quote.status === 'inviato').length
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Car className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Preventivi in bozza */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/quotes')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Preventivi in bozza</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingQuotes ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allQuotes.filter(quote => quote.status === 'bozza').length
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Checkup Ricevuti (Richieste Checkup) */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/requests')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Richieste Checkup</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingRequests ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allRequests.filter(request => request.status === 'ricevuta' || request.status === 'in_lavorazione').length
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Invitati (Richieste Preventivo) */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/requests')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Richieste Preventivo</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingRequests ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allRequests.filter(request => request.tipoRichiesta === 'preventivo' && request.status === 'in_lavorazione').length
                    )}
                  </div>
                </div>
                <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Layout a tre colonne per Appuntamenti, Reminder e Compleanni */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Appuntamenti oggi */}
          <div className="md:col-span-1">
            <Card className="border border-border">
              <CardHeader className="pb-2 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <CardTitle className="text-lg md:text-xl">Appuntamenti Oggi</CardTitle>
                  {format(new Date(), 'd MMMM yyyy', { locale: it })}
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                {isLoadingAppointments ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : todayAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {todayAppointments.map((appointment: Appointment) => {
                      // Converti la data in oggetto Date
                      const appointmentDate = typeof appointment.date === 'string' 
                        ? new Date(appointment.date.split('T')[0]) 
                        : new Date(appointment.date);
                      // Formatta la data in italiano
                      const formattedDate = format(appointmentDate, 'd MMM', { locale: it });
                      return (
                        <div 
                          key={appointment.id} 
                          className="flex p-3 border rounded-md bg-card transition-colors"
                        >
                          <div className="mr-3 flex flex-col items-center justify-center bg-primary/10 h-16 w-16 rounded-md shrink-0">
                            <span className="text-xs text-muted-foreground">{formattedDate}</span>
                            <span className="text-xl font-bold text-primary">
                              {appointment.time ? appointment.time.split(':')[0] : '--'}:{appointment.time ? appointment.time.split(':')[1] : '--'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="font-medium truncate">{appointment.clientName}</h4>
                            <div className="flex items-center mt-1">
                              <Car className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                              <p className="text-xs text-muted-foreground truncate">{appointment.plate} {appointment.model}</p>
                            </div>
                            {appointment.services && appointment.services.length > 0 && (
                              <div className="flex items-center mt-1">
                                <Wrench className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                                <p className="text-xs text-muted-foreground truncate">{appointment.services[0]}</p>
                              </div>
                            )}
                          </div>
                          {appointment.status !== 'in_lavorazione' && appointment.status !== 'completato' && (
                            <div className="flex items-center justify-center ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartWork(appointment);
                                }}
                                title="Inizia lavorazione"
                              >
                                <Wrench className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] py-8">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-center">Nessun appuntamento programmato per oggi</p>
                    <Button variant="outline" size="sm" onClick={() => setLocation('/appointments')} className="mt-4">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Pianifica appuntamento
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Reminder da inviare */}
          <div className="md:col-span-1">
            <RemindersWidget key="admin-reminders" />
          </div>
          
          {/* Compleanni */}
          <div className="md:col-span-1">
            <Card className="border border-border h-full">
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <h3 className="text-lg font-semibold">Compleanno</h3>
                  <div className="ml-auto flex-shrink-0">
                    <span className="text-orange-500 font-medium">{format(new Date(), 'd MMMM yyyy', { locale: it })}</span>
                  </div>
                </div>
                
                <div className="text-center py-20">
                  <p className="text-muted-foreground">Nessun compleanno oggi</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Lista unica di tutti gli appuntamenti del cliente, ordinati: prima non completati, poi completati
  const allAppointments = [
    ...allClientAppointments.filter(a => a.status !== 'completato'),
    ...allClientAppointments.filter(a => a.status === 'completato')
  ];

  return (
    <div className="space-y-8">
      {/* Contatori statistiche del cliente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">I Tuoi Appuntamenti</p>
                {isLoadingStats ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{statistics?.totalAppointments || 0}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary" onClick={() => setLocation('/quotes')}>
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">Preventivi Totali</p>
                {isLoadingStats ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{statistics?.totalQuotes || 0}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Car className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary" onClick={() => setLocation('/parti-sostituite')}>
          <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">Parti Sostituite</p>
                {isLoadingStats ? (
                  <div className="text-2xl md:text-3xl font-bold"><Skeleton className="h-7 md:h-9 w-10 md:w-12" /></div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold">{statistics?.partiSostituite || 0}</div>
                )}
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Wrench className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista di tutti gli appuntamenti del cliente */}
      <Card className="border border-border mt-6">
        <CardHeader className="pb-2 px-4 md:px-6">
          <CardTitle className="text-lg md:text-xl">Tutti i tuoi appuntamenti</CardTitle>
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
          ) : allAppointments.length > 0 ? (
            <div className="space-y-3">
              {allAppointments.map((appointment: Appointment) => {
                // Converti la data in oggetto Date
                const appointmentDate = typeof appointment.date === 'string' 
                  ? new Date(appointment.date.split('T')[0]) 
                  : new Date(appointment.date);
                // Formatta la data in italiano
                const formattedDate = format(appointmentDate, 'd MMM', { locale: it });
                // Colore in base allo status
                let statusColor = 'text-gray-400';
                if (appointment.status === 'programmato') statusColor = 'text-orange-500';
                else if (appointment.status === 'completato') statusColor = 'text-green-600';
                else if (appointment.status === 'in_lavorazione') statusColor = 'text-blue-500';
                return (
                  <div 
                    key={appointment.id} 
                    className="flex p-3 border rounded-md bg-card transition-colors"
                  >
                    <div className="mr-3 flex flex-col items-center justify-center bg-primary/10 h-16 w-16 rounded-md shrink-0">
                      <span className="text-xs text-muted-foreground">{formattedDate}</span>
                      <span className="text-xl font-bold text-primary">
                        {appointment.time ? appointment.time.split(':')[0] : '--'}:{appointment.time ? appointment.time.split(':')[1] : '--'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="font-medium truncate">
                        {appointment.clientName} <span className={`${statusColor} text-xs`}>
                          ({appointment.status})
                        </span>
                      </h4>
                      <div className="flex items-center mt-1">
                        <Car className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                        <p className="text-xs text-muted-foreground truncate">{appointment.plate}</p>
                      </div>
                      {appointment.services && appointment.services.length > 0 && (
                        <div className="flex items-center mt-1">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                          <p className="text-xs text-muted-foreground truncate">{appointment.services[0]}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] py-8">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-center">Non hai appuntamenti programmati</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Widget stile landing page */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-2 bg-white text-black rounded-2xl shadow-xl p-4 w-[calc(100vw-48px)] max-w-[320px] border border-green-500 relative"
          >
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white rotate-45" />
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3 border-2 border-white shadow">
                <FontAwesomeIcon icon={faWhatsapp} className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-green-600">Assistenza WhatsApp</div>
                <div className="text-xs text-gray-500">Rispondiamo subito!</div>
              </div>
            </div>
            <p className="text-sm mb-4">Ciao! 👋 Come possiamo aiutarti oggi?</p>
            <a href="https://api.whatsapp.com/send/?phone=%2B393293888702&text=Salve!%20Ho%20bisogno%20di%20informazioni." target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg w-full block text-center transition">
              Inizia a chattare
            </a>
          </motion.div>
        )}
        <button
          onClick={() => setShowChat((v) => !v)}
          className="bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg p-4 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
          title="Chatta con noi su WhatsApp"
          aria-label="Chat WhatsApp"
        >
          <FontAwesomeIcon icon={faWhatsapp} className="w-7 h-7" />
        </button>
      </div>
      {/* Fine WhatsApp Widget */}
    </div>
  );
}

export default DashboardPage;
