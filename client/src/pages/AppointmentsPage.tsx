import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Calendar, List, RefreshCw, CalendarPlus, FileDown, Search, CalendarIcon } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { getAllAppointments, getQuoteById } from "@shared/supabase";
import { Appointment, Quote } from "@shared/schema";

import AppointmentForm from "@/components/appointments/AppointmentForm";
import CalendarView from "@/components/appointments/CalendarView";
import TableView from "@/components/appointments/TableView";
import QuoteForm from "@/components/quotes/QuoteForm";
import { exportAppointmentsToExcel, exportAppointmentsToPDF } from "@/services/exportService";
import { appointmentService } from "@/services/appointmentService";
import { useAuth } from "../contexts/AuthContext";

export default function AppointmentsPage() {
  const [view, setView] = useState<"calendar" | "table">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuoteFormOpen, setIsQuoteFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [clientIdForQuote, setClientIdForQuote] = useState<string>("");
  const [selectedClientForAppointment, setSelectedClientForAppointment] = useState<string | null>(null);
  const [initialViewDay, setInitialViewDay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showCompletedAppointments, setShowCompletedAppointments] = useState(false);
  const [isFormOpening, setIsFormOpening] = useState(false); // Protezione contro aperture multiple
  
  const { toast } = useToast();
  const { user } = useAuth();
  const isClient = !!user?.clientId;
  const queryClient = useQueryClient();
  
  // Fetch appointments
  const { 
    data: fetchedAppointments = [], 
    isLoading: queryLoading,
    refetch,
    isRefetching,
    status 
  } = useQuery({ 
    queryKey: ['/appointments', user?.clientId],
    queryFn: async () => {
      let appointments: Appointment[] = [];
      
      if (user?.clientId) {
        // Se è un cliente, carica solo i suoi appuntamenti
        appointments = await appointmentService.getByClientId(user.clientId);
      } else {
        // Se è admin, carica tutti gli appuntamenti
        appointments = await appointmentService.getAll();
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
    // Rimossi: refetchOnWindowFocus: false, refetchOnMount: false
    // che impedivano il ricaricamento quando si riapre l'app
  });
  
  // Log di debug per monitorare lo stato della query
  useEffect(() => {
    // console.log("Stato della query degli appuntamenti:", {
    //   status,
    //   queryLoading,
    //   isRefetching,
    //   numeroAppuntamenti: fetchedAppointments?.length || 0
    // });
  }, [status, queryLoading, isRefetching, fetchedAppointments]);
  
  // Filter appointments
  const filteredAppointments = fetchedAppointments.filter((appointment: Appointment) => {
    const matchesSearch = 
      appointment.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      appointment.plate.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (appointment.services && appointment.services.some(service => 
        service.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    const matchesDate = !dateFilter || appointment.date === dateFilter;
    
    // Filtra gli appuntamenti completati in base all'opzione selezionata
    const completedStatus = appointment.status === "completato";
    const showBasedOnCompletedFilter = showCompletedAppointments || !completedStatus;
    
    return matchesSearch && matchesStatus && matchesDate && showBasedOnCompletedFilter;
  });
  
  const handleExportAppointments = async () => {
    try {
      await exportAppointmentsToExcel(filteredAppointments);
      toast({
        title: "Esportazione completata",
        description: "Gli appuntamenti sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    }
  };
  
  const handleEditAppointment = (appointment: Appointment) => {
    // I clienti non possono modificare gli appuntamenti
    if (isClient) {
      toast({
        title: "Operazione non consentita",
        description: "Solo gli amministratori possono modificare gli appuntamenti",
        variant: "destructive",
      });
      return;
    }
    
    // Protezione contro aperture multiple
    if (isFormOpening || isFormOpen) {
      // console.log("Form già in apertura o aperto, ignoro richiesta");
      return;
    }
    
    // console.log("Apertura dettagli appuntamento:", appointment.id, "- SENZA refresh automatico");
    setIsFormOpening(true);
    setEditingAppointment(appointment);
    setIsFormOpen(true);
    
    // Reset della protezione dopo un breve delay
    setTimeout(() => {
      setIsFormOpening(false);
    }, 1000);
    
    // NON chiamiamo refetch() qui - il refresh avverrà solo se si salva effettivamente
  };
  
  const handleAddAppointment = (date?: string | Date) => {
    // I clienti non possono creare appuntamenti
    if (isClient) {
      toast({
        title: "Operazione non consentita",
        description: "Solo gli amministratori possono creare nuovi appuntamenti",
        variant: "destructive",
      });
      return;
    }
    
    // Se è una data, convertila in stringa
    if (date instanceof Date) {
      setSelectedDate(format(date, 'yyyy-MM-dd'));
    } else if (date) {
      // Se è già una stringa, usala direttamente
      setSelectedDate(date);
    } else {
      // Se non è specificata, usa oggi
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    }
    setEditingAppointment(null);
    setIsFormOpen(true);
  };
  
  const handleFormClose = () => {
    // console.log("Chiusura form appuntamento SENZA salvataggio - nessun refresh");
    setIsFormOpen(false);
    setEditingAppointment(null);
    setSelectedDate(null);
    setSelectedClientForAppointment(null);
    setIsFormOpening(false); // Reset protezione
    // NON chiamiamo refetch() qui - nessun refresh se si chiude senza salvare
  };
  
  const handleFormSubmit = async () => {
    // console.log("Form salvato con successo, aggiornamento dati in corso...");
    try {
      // Aggiorniamo immediatamente i dati degli appuntamenti SOLO dopo un salvataggio
      // console.log("Ricaricamento appuntamenti dopo salvataggio...");
      const refreshed = await refetch();
      // console.log("Ricaricamento completato:", refreshed.isSuccess ? "Successo" : "Fallito");
  
      // Chiudi i form e resetta gli stati solo dopo aver completato l'aggiornamento
      setIsFormOpen(false);
      setEditingAppointment(null);
      setSelectedDate(null);
      setIsFormOpening(false); // Reset protezione
    } catch (error) {
      // console.error("Errore durante il ricaricamento dei dati:", error);
      // Chiudi comunque i form in caso di errore
      setIsFormOpen(false);
      setEditingAppointment(null);
      setSelectedDate(null);
      setIsFormOpening(false); // Reset protezione anche in caso di errore
    }
  };

  const handleEditQuote = (quote: Quote) => {
    // console.log("handleEditQuote chiamata con:", {
    //   quoteId: quote.id,
    //   isClient: isClient,
    //   userClientId: user?.clientId,
    //   user: user
    // });
    
    if (isClient) {
      toast({
        title: "Operazione non consentita",
        description: "Solo gli amministratori possono modificare i preventivi",
        variant: "destructive",
      });
      return;
    }
    
    // console.log("Aprendo form di modifica preventivo per:", quote.id);
    setEditingQuote(quote);
    setIsQuoteFormOpen(true);
  };

  const handleCreateNewQuote = (clientId: string) => {
    // I clienti non possono creare preventivi
    if (isClient) {
      toast({
        title: "Operazione non consentita",
        description: "Solo gli amministratori possono creare nuovi preventivi",
        variant: "destructive",
      });
      return;
    }
    
    // console.log("handleCreateNewQuote chiamato con clientId:", clientId);
    
    // Salva l'ID del cliente per poterlo ripristinare quando si riapre il form appuntamento
    setSelectedClientForAppointment(clientId);
    setClientIdForQuote(clientId);
    setEditingQuote(null);
    setIsQuoteFormOpen(true);
  };

  const handleQuoteFormClose = () => {
    // console.log("handleQuoteFormClose chiamata");
    setIsQuoteFormOpen(false);
    setEditingQuote(null);
    setClientIdForQuote("");
    setSelectedClientForAppointment(null);
  };

  const handleQuoteFormSubmit = async () => {
    // console.log("handleQuoteFormSubmit chiamata");
    setIsQuoteFormOpen(false);
    setEditingQuote(null);
    setClientIdForQuote("");
    
    // Aggiornamento immediato e aggressivo dei dati
    try {
      // console.log("Aggiornamento immediato dati dopo modifica preventivo...");
      
      // 1. Invalida immediatamente tutte le query correlate
      await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      await queryClient.invalidateQueries({ queryKey: ['/quotes/client'] });
      await queryClient.invalidateQueries({ queryKey: ['/appointments'] });
      
      // 2. Forza un refetch immediato degli appuntamenti
      const result = await refetch();
      
      if (result.isSuccess) {
        // console.log("Dati aggiornati con successo in tempo reale");
        toast({
          title: "Preventivo aggiornato",
          description: "Il preventivo è stato aggiornato con successo",
        });
      } else {
        throw new Error("Refetch fallito");
      }
    } catch (error) {
      // console.error("Errore nell'aggiornamento immediato:", error);
      
      // Fallback: prova un aggiornamento ritardato
      setTimeout(async () => {
        try {
          await refetch();
          toast({
            title: "Preventivo aggiornato",
            description: "Il preventivo è stato aggiornato con successo",
          });
        } catch (retryError) {
          // console.error("Errore anche nel retry:", retryError);
          toast({
            title: "Attenzione",
            description: "Preventivo aggiornato, ma potrebbero essere necessari alcuni secondi per vedere le modifiche",
            variant: "default",
          });
        }
      }, 1000);
    }
    
    // Riapriamo il form appuntamento dopo aver creato/modificato il preventivo
    setIsFormOpen(true);
  };

  // Funzione per aggiornare un appuntamento
  const handleUpdateAppointment = async (updatedAppointment: Appointment) => {
    try {
      // console.log("Aggiornamento appuntamento:", updatedAppointment.id);
      // console.log("Dati aggiornamento:", updatedAppointment);
      
      // Verifica che l'ID sia valido
      if (!updatedAppointment.id) {
        // console.error("ID appuntamento mancante durante l'aggiornamento");
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dell'appuntamento",
          variant: "destructive",
        });
        return;
      }
      
      // Assicurati che lo stato partsOrdered sia gestito correttamente
      if (updatedAppointment.partsOrdered === undefined) {
        // console.log("Stato parti non definito, impostando su false");
        updatedAppointment.partsOrdered = false;
      } else {
        // console.log(`Stato parti ricevuto: ${updatedAppointment.partsOrdered}`);
      }
      
      // Assicurati che la durata venga aggiornata correttamente
      if (updatedAppointment.quoteId && 
          updatedAppointment.quoteLaborHours !== undefined && 
          updatedAppointment.quoteLaborHours > 0) {
        // console.log(`Impostiamo la durata dall'appuntamento aggiornato: ${updatedAppointment.quoteLaborHours}h`);
        updatedAppointment.duration = updatedAppointment.quoteLaborHours;
      } else if (updatedAppointment.duration === undefined) {
        // console.log("Durata non definita, impostando a 1h");
        updatedAppointment.duration = 1;
      }
      
      // Effettua l'aggiornamento
      await appointmentService.update(updatedAppointment.id, updatedAppointment);
      
      // Aggiorna lo stato locale IMMEDIATAMENTE per evitare di dover ricaricare tutta la pagina
      setAppointments(prevAppointments => {
        const updatedAppointments = prevAppointments.map(app => 
          app.id === updatedAppointment.id ? { ...app, ...updatedAppointment } : app
        );
        return updatedAppointments;
      });
      
      // Mostra un messaggio di successo senza ricaricare
      toast({
        title: "Successo",
        description: "Appuntamento aggiornato con successo",
      });
      
      // Forza l'aggiornamento della vista calendario se esiste la funzione
      if (window && (window as any).forceCalendarRefresh) {
        setTimeout(() => {
          (window as any).forceCalendarRefresh();
        }, 100);
      }
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'appuntamento:", error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dell'appuntamento",
        variant: "destructive",
      });
    }
  };

  // Funzione wrapper per gestire correttamente sia Date che stringhe
  const handleCalendarSelectDate = (date: string | Date) => {
    // Se è una Date, la convertiamo in stringa
    if (date instanceof Date) {
      handleAddAppointment(date);
    } else {
      // Se è già una stringa, la passiamo direttamente
      handleAddAppointment(date);
    }
  };

  // Effetto per caricare gli appointments all'inizio e sincronizzare lo stato con i dati dalla query
  useEffect(() => {
    if (fetchedAppointments && fetchedAppointments.length > 0) {
      // console.log("DEBUG - AppointmentsPage: ricevuti nuovi dati dalla query, aggiorno lo stato locale");
      setAppointments(fetchedAppointments);
    }
    
    if (queryLoading) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [fetchedAppointments, queryLoading]);

  // Sistema di aggiornamento automatico in tempo reale - VERSIONE MENO AGGRESSIVA
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let lastUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 3000; // Minimo 3 secondi tra aggiornamenti
    
    // Listener per i cambiamenti nelle query dei preventivi
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Se viene aggiornata una query dei preventivi
      if (event.type === 'observerResultsUpdated') {
        const queryKey = event.query.queryKey;
        
        // Controlla se è una query relativa ai preventivi
        if (Array.isArray(queryKey) && 
            (queryKey.includes('/api/quotes') || queryKey.includes('/quotes/client'))) {
          
          const now = Date.now();
          
          // Evita aggiornamenti troppo frequenti
          if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
            // console.log("Aggiornamento preventivi ignorato (troppo frequente)");
            return;
          }
          
          // console.log("Rilevato aggiornamento preventivi, aggiorno appuntamenti automaticamente");
          lastUpdateTime = now;
          
          // Debounce: cancella il timeout precedente e ne crea uno nuovo
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          // Aggiorna gli appuntamenti dopo un delay più lungo per evitare loop
          timeoutId = setTimeout(() => {
            refetch();
          }, 2000); // Aumentato a 2 secondi
        }
      }
    });

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [queryClient, refetch]);

  // Esponi la funzione di ricarica a livello globale
  useEffect(() => {
    (window as any).reloadAppointments = async () => {
      // console.log("DEBUG - Ricarico gli appuntamenti da AppointmentsPage");
      try {
        // Prima facciamo il refetch per aggiornare i dati da Firebase
        const result = await refetch();
        // console.log("DEBUG - Refetch completato, risultato:", result.isSuccess ? "successo" : "fallito");
        
        // Aggiorniamo lo stato locale con i dati aggiornati
        if (result.isSuccess && result.data) {
          setAppointments(result.data);
          // console.log("DEBUG - Appuntamenti ricaricati con successo:", result.data.length);
          return true;
        } else {
          // Se il refetch non ha funzionato, prova a caricare con un metodo alternativo
          // console.log("DEBUG - Refetch non ha avuto successo, provo a caricare direttamente");
          const data = await appointmentService.getAll();
          setAppointments(data);
          // console.log("DEBUG - Appuntamenti caricati direttamente:", data.length);
          return true;
        }
      } catch (error) {
        console.error("Errore nella ricarica degli appuntamenti:", error);
        return false;
      }
    };
    
    // Cleanup per rimuovere la funzione globale
    return () => {
      delete (window as any).reloadAppointments;
    };
  }, [refetch]);

  // Funzione per confermare eliminazione appuntamento
  const handleConfirmDeleteAppointment = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo appuntamento?")) {
      try {
        await appointmentService.delete(id);
        await refetch();
        toast({
          title: "Appuntamento eliminato",
          description: "L'appuntamento è stato eliminato con successo"
        });
      } catch (error) {
        console.error("Errore durante l'eliminazione:", error);
        toast({
          title: "Errore",
          description: "Impossibile eliminare l'appuntamento",
          variant: "destructive"
        });
      }
    }
  };

  // Funzione per gestire il cambio di stato degli appuntamenti (con la firma corretta)
  const handleQuickUpdateAppointment = async (appointmentId: string, data: Partial<Appointment>) => {
    try {
      await appointmentService.update(appointmentId, data);
      refetch();
      toast({
        title: "Appuntamento aggiornato",
        description: "Lo stato dell'appuntamento è stato aggiornato con successo"
      });
    } catch (error) {
      console.error("Errore durante l'aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato dell'appuntamento",
        variant: "destructive"
      });
    }
  };

  // Funzione per forzare il refresh dei dati
  const handleForceRefresh = async () => {
    try {
      await refetch();
      // Refresh silenzioso - nessun toast
    } catch (error) {
      console.error("Errore durante l'aggiornamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare i dati",
        variant: "destructive"
      });
    }
  };

  // Funzione per esportare gli appuntamenti in PDF
  const handleExportAppointmentsPDF = () => {
    try {
      exportAppointmentsToPDF(filteredAppointments);
      toast({
        title: "Esportazione completata",
        description: "Gli appuntamenti sono stati esportati in PDF con successo",
      });
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione in PDF",
        variant: "destructive",
      });
    }
  };

  // Gestione dello stato dell'appuntamento cambiato
  const handleAppointmentStatusChange = () => {
    // Ricarica i dati dopo il cambio di stato
    refetch();
  };

  return (
    <div className="container py-4 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-6 gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <h1 className="text-2xl font-bold">
            {isClient ? "I Tuoi Appuntamenti" : "Gestione Appuntamenti"}
          </h1>
          
          <Tabs 
            value={view} 
            onValueChange={(value) => setView(value as "calendar" | "table")}
            className="w-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger value="table" className="px-3">
                <List className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Tabella</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="px-3">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center space-x-2 justify-end">
          {!isClient && (
            <>
              <Button onClick={() => handleAddAppointment()} className="gap-1 sm:gap-2 px-2 sm:px-3 h-9">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuovo Appuntamento</span>
                <span className="sm:hidden">Nuovo</span>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 px-2 sm:px-3">
                    <FileDown className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Esporta</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportAppointments}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Esporta in Excel</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportAppointmentsPDF}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Esporta in PDF</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleForceRefresh}
            className="h-9 w-9"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={`flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-6 ${view === "calendar" ? "hidden" : ""}`}>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per cliente, targa o servizio"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex flex-row space-x-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 md:w-[180px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="programmato">Programmato</SelectItem>
              <SelectItem value="in_lavorazione">In lavorazione</SelectItem>
              <SelectItem value="completato">Completato</SelectItem>
              <SelectItem value="annullato">Annullato</SelectItem>
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-32 md:w-[180px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="hidden md:inline">
                  {dateFilter ? format(parseISO(dateFilter), 'MMM d, yyyy') : 'Seleziona data'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={dateFilter ? parseISO(dateFilter) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setDateFilter(format(date, 'yyyy-MM-dd'));
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className={`flex items-center space-x-2 mb-4 ${view === "calendar" ? "hidden" : ""}`}>
        <Checkbox 
          id="showCompleted" 
          checked={showCompletedAppointments} 
          onCheckedChange={(checked) => {
            setShowCompletedAppointments(checked as boolean);
            handleAppointmentStatusChange();
          }}
        />
        <Label htmlFor="showCompleted">Mostra appuntamenti completati</Label>
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as "calendar" | "table")}>
        <TabsContent value="table">
          <TableView
            appointments={filteredAppointments}
            isLoading={queryLoading || isRefetching}
            onEdit={handleEditAppointment}
            onDeleteSuccess={() => refetch()}
            onStatusChange={handleQuickUpdateAppointment}
            onEditQuote={handleEditQuote}
            showCompletedAppointments={showCompletedAppointments}
            isClient={isClient}
          />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView
            appointments={filteredAppointments}
            isLoading={queryLoading || isRefetching}
            onSelectDate={handleCalendarSelectDate}
            onSelectAppointment={handleEditAppointment}
            initialView={initialViewDay ? "day" : "month"}
            showCompletedAppointments={showCompletedAppointments}
            isClient={isClient}
          />
        </TabsContent>
      </Tabs>

      {/* Modal per il form degli appuntamenti */}
      {isFormOpen && (
        <AppointmentForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
          appointment={editingAppointment}
          selectedDate={selectedDate}
          onEditQuote={handleEditQuote}
          onCreateQuote={handleCreateNewQuote}
          defaultClientId={selectedClientForAppointment || undefined}
        />
      )}
      
      {isQuoteFormOpen && (
        <QuoteForm 
          isOpen={isQuoteFormOpen}
          onClose={handleQuoteFormClose}
          onSuccess={handleQuoteFormSubmit}
          quote={editingQuote}
          defaultClientId={clientIdForQuote}
        />
      )}
    </div>
  );
}
