import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isBefore, isToday, isAfter, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { useState, useEffect } from "react";

import { getAllAppointments, getAllClients, getAllQuotes, getQuoteById, getAllRequests } from "@shared/firebase";
import { Appointment } from "@shared/types";
import { useAuth } from "../hooks/useAuth";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Users, ClipboardList, ArrowRight, Car, Wrench, UserPlus, CheckCircleIcon, ArrowUpRight, ArrowRightToLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TodayBirthdaysWidget from "../components/dashboard/TodayBirthdaysWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ref, get } from "firebase/database";
import { rtdb } from "@/firebase";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const clientId = user?.clientId;
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch all appointments for the client
  const { 
    data: allClientAppointments = [], 
    isLoading: isLoadingAppointments 
  } = useQuery({ 
    queryKey: ['/api/appointments', clientId],
    queryFn: async () => {
      const allAppointments = await getAllAppointments();
      // Filtro per clientId se presente
      const filtered = clientId
        ? allAppointments.filter(app => app.clientId === clientId)
        : allAppointments;
      
      // IMPORTANTE: Normalizziamo i valori di duration e quoteLaborHours
      // per evitare incongruenze quando si passa dalla dashboard ai preventivi
      return filtered.map(app => {
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
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Fetch all quotes for real-time updates
  const { 
    data: allQuotes = [], 
    isLoading: isLoadingQuotes 
  } = useQuery({ 
    queryKey: ['/api/quotes', clientId],
    queryFn: async () => {
      const quotes = await getAllQuotes();
      // Filtro per clientId se presente
      return clientId
        ? quotes.filter(quote => quote.clientId === clientId)
        : quotes;
    },
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Fetch all clients for admin dashboard
  const { 
    data: allClients = [], 
    isLoading: isLoadingClients 
  } = useQuery({ 
    queryKey: ['/api/clients'],
    queryFn: getAllClients,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !clientId // Solo per admin
  });

  // Fetch all requests for admin dashboard
  const { 
    data: allRequests = [], 
    isLoading: isLoadingRequests 
  } = useQuery({ 
    queryKey: ['/api/requests'],
    queryFn: getAllRequests,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !clientId // Solo per admin
  });

  // Dividiamo gli appuntamenti in "oggi" e "futuri"
  const todayAppointments = allClientAppointments.filter(app => {
    // Convertiamo la data in oggetto Date
    const appDate = typeof app.date === 'string' 
      ? app.date.split('T')[0] 
      : format(new Date(app.date), 'yyyy-MM-dd');
    
    // Escludiamo gli appuntamenti completati e manteniamo solo quelli di oggi
    return appDate === today && app.status !== 'completato';
  });
  
  const futureAppointments = allClientAppointments.filter(app => {
    // Convertiamo la data in oggetto Date
    const appDateStr = typeof app.date === 'string' 
      ? app.date.split('T')[0] 
      : format(new Date(app.date), 'yyyy-MM-dd');
    
    const appDate = new Date(appDateStr);
    const todayDate = new Date(today);
    
    // Escludiamo gli appuntamenti completati e manteniamo solo quelli futuri
    return isAfter(appDate, todayDate) && app.status !== 'completato';
  });

  // Fetch statistics (solo se il cliente ha bisogno di vederle)
  const { 
    data: statistics, 
    isLoading: isLoadingStats 
  } = useQuery({ 
    queryKey: ['/api/statistics', clientId, allClientAppointments.length, allQuotes.length],
    queryFn: async () => {
      if (!clientId) return null;
      
      // Usa i dati già caricati per le statistiche base
      const filteredAppointments = allClientAppointments;
      const filteredQuotes = allQuotes;
      
      const sentQuotes = filteredQuotes.filter(quote => quote.status === 'inviato').length;
      const totalQuotes = filteredQuotes.length;
      
      // Calcola il numero di parti sostituite
      let partiSostituite = 0;
      const completedAppointments = filteredAppointments.filter(app => app.status === 'completato');
      
      for (const app of completedAppointments) {
        // Parti dalla delivery phase
        try {
          const deliveryRef = ref(rtdb, `/deliveryPhases/${app.id}`);
          const snap = await get(deliveryRef);
          if (snap.exists()) {
            const deliveryData = snap.val();
            const items = deliveryData.items || [];
            if (Array.isArray(items)) {
              items.forEach((item: any) => {
                if (Array.isArray(item.parts)) {
                  partiSostituite += item.parts.length;
                }
              });
            }
          }
        } catch (e) { /* ignora errori singoli */ }
        
        // Parti dai preventivi associati
        if (app.quoteId) {
          try {
            const quote = await getQuoteById(app.quoteId);
            if (quote) {
              const items = quote.items || [];
              if (Array.isArray(items)) {
                items.forEach((item: any) => {
                  if (Array.isArray(item.parts)) {
                    partiSostituite += item.parts.length;
                  }
                });
              }
            }
          } catch (e) { /* ignora errori singoli */ }
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
    refetchOnWindowFocus: true,
    staleTime: 30000 // Cache per 30 secondi per le parti sostituite
  });

  // Quick action handlers
  const handleCalendar = () => setLocation("/appointments");

  // Se non è un cliente, mostra la dashboard dell'amministratore
  if (!clientId) {
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
          
          {/* Appuntamenti creati */}
          <Card 
            className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
            onClick={() => setLocation('/appointments')}
          >
            <CardContent className="pt-4 pb-2 px-3 md:pt-6 md:px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm mb-1">Appuntamenti Creati</p>
                  <div className="text-2xl md:text-3xl font-bold">
                    {isLoadingAppointments ? (
                      <Skeleton className="h-7 md:h-9 w-10 md:w-12" />
                    ) : (
                      allClientAppointments.length
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
                      allRequests.filter(request => request.tipoRichiesta === 'checkup').length
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
                      allRequests.filter(request => request.tipoRichiesta === 'preventivo').length
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
        
        {/* Layout a due colonne per Appuntamenti e Compleanni */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Appuntamenti oggi */}
          <div className="md:col-span-2">
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
                    {todayAppointments.map(app => (
                      <div 
                        key={app.id} 
                        className="flex p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/appointments`)}
                      >
                        <div className="mr-3 flex flex-col items-center justify-center bg-primary/10 h-16 w-16 rounded-md shrink-0">
                          <span className="text-xs text-muted-foreground">Ore</span>
                          <span className="text-xl font-bold text-primary">
                            {app.time ? app.time.split(':')[0] : '--'}:{app.time ? app.time.split(':')[1] : '--'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="font-medium truncate">{app.clientName}</h4>
                          {app.plate && app.model && (
                            <div className="flex items-center mt-1">
                              <Car className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                              <p className="text-xs text-muted-foreground truncate">{app.plate} {app.model}</p>
                            </div>
                          )}
                          {app.services && app.services.length > 0 && (
                            <div className="flex items-center mt-1">
                              <Wrench className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                              <p className="text-xs text-muted-foreground truncate">{app.services[0]}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center ml-1">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      </div>
                    ))}
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

  return (
    <div className="space-y-8">
      {/* Contatori statistiche del cliente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
          onClick={() => setLocation('/appointments')}
        >
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
        
        <Card 
          className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
          onClick={() => setLocation('/quotes')}
        >
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
        
        <Card 
          className="border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary"
          onClick={() => setLocation('/parti-sostituite')}
        >
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
      
      {/* Tabs per appuntamenti oggi e futuri */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="today">Appuntamenti Oggi</TabsTrigger>
          <TabsTrigger value="future">Appuntamenti Futuri</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today">
          <Card className="border border-border">
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
              ) : todayAppointments.length > 0 ? (
                <div className="space-y-3">
                  {todayAppointments.map((appointment: Appointment) => (
                    <div 
                      key={appointment.id} 
                      className="flex p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/appointments`)}
                    >
                      <div className="mr-3 flex flex-col items-center justify-center bg-primary/10 h-16 w-16 rounded-md shrink-0">
                        <span className="text-xs text-muted-foreground">Ore</span>
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
                      <div className="flex items-center ml-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <ArrowRight className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] py-8">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-center">Nessun appuntamento programmato per oggi</p>
                  <Button variant="outline" size="sm" onClick={handleCalendar} className="mt-4">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Pianifica appuntamento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="future">
          <Card className="border border-border">
            <CardHeader className="pb-2 px-4 md:px-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <CardTitle className="text-lg md:text-xl">Appuntamenti Futuri</CardTitle>
                <Button variant="outline" size="sm" onClick={handleCalendar} className="w-full sm:w-auto">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Visualizza Calendario</span>
                  <span className="sm:hidden">Calendario</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              {isLoadingAppointments ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : futureAppointments.length > 0 ? (
                <div className="space-y-3">
                  {futureAppointments.slice(0, 5).map((appointment: Appointment) => {
                    // Converti la data in oggetto Date
                    const appointmentDate = typeof appointment.date === 'string' 
                      ? new Date(appointment.date.split('T')[0]) 
                      : new Date(appointment.date);
                    
                    // Formatta la data in italiano
                    const formattedDate = format(appointmentDate, 'd MMM', { locale: it });
                    
                    return (
                      <div 
                        key={appointment.id} 
                        className="flex p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/appointments`)}
                      >
                        <div className="mr-3 flex flex-col items-center justify-center bg-primary/10 h-16 w-16 rounded-md shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {format(appointmentDate, 'EEE', { locale: it })}
                          </span>
                          <span className="text-xl font-bold text-primary">
                            {formattedDate}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center">
                            <span className="bg-primary/10 px-2 py-0.5 text-xs rounded text-primary mr-2">
                              {appointment.time || 'N/D'}
                            </span>
                            <h4 className="font-medium truncate">{appointment.clientName}</h4>
                          </div>
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
                        <div className="flex items-center ml-1">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {futureAppointments.length > 5 && (
                    <Button variant="outline" className="w-full mt-2" onClick={handleCalendar}>
                      Vedi tutti gli appuntamenti ({futureAppointments.length})
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] py-8">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-center">Non hai appuntamenti futuri programmati</p>
                  <Button variant="outline" size="sm" onClick={handleCalendar} className="mt-4">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Pianifica appuntamento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
