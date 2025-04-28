import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, Calendar, List, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleDropdown, DropdownMenuItem } from "@/components/ui/CustomUIComponents";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { getAllAppointments, getQuoteById } from "@shared/firebase";
import { Appointment, Quote } from "@shared/schema";

import AppointmentForm from "@/components/appointments/AppointmentForm";
import CalendarView from "@/components/appointments/CalendarView";
import TableView from "@/components/appointments/TableView";
import QuoteForm from "@/components/quotes/QuoteForm";
import { exportAppointmentsToExcel, exportAppointmentsToPDF } from "@/services/exportService";
import { appointmentService } from "@/services/appointmentService";

export default function AppointmentsPage() {
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuoteFormOpen, setIsQuoteFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'));
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [clientIdForQuote, setClientIdForQuote] = useState<string | null>(null);
  const [initialViewDay, setInitialViewDay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  const { toast } = useToast();
  
  // Fetch appointments
  const { 
    data: fetchedAppointments = [], 
    isLoading: queryLoading,
    refetch,
    isRefetching,
    status 
  } = useQuery({ 
    queryKey: ['/api/appointments'],
    queryFn: getAllAppointments,
    refetchOnWindowFocus: false, // Disattiva il refetch automatico
    staleTime: 0, // Considera sempre i dati obsoleti
    gcTime: 0, // Non memorizzare i dati nella cache (sostituisce cacheTime)
  });
  
  // Log di debug per monitorare lo stato della query
  useEffect(() => {
    console.log("Stato della query degli appuntamenti:", {
      status,
      queryLoading,
      isRefetching,
      numeroAppuntamenti: fetchedAppointments?.length || 0
    });
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
    
    return matchesSearch && matchesStatus && matchesDate;
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
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };
  
  const handleAddAppointment = (date?: string | Date) => {
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
    setIsFormOpen(false);
    setEditingAppointment(null);
    setSelectedDate(null);
  };
  
  const handleFormSubmit = async () => {
    console.log("Form inviato, aggiornamento dati in corso...");
    try {
      // Attendiamo un breve periodo prima di ricaricare i dati,
      // per assicurarci che il database abbia completato l'aggiornamento
      setTimeout(async () => {
        // Aggiorniamo esplicitamente i dati degli appuntamenti
        console.log("Ricaricamento appuntamenti...");
        const refreshed = await refetch();
        console.log("Ricaricamento completato:", refreshed.isSuccess ? "Successo" : "Fallito");
    
        // Chiudi i form e resetta gli stati
        setIsFormOpen(false);
        setEditingAppointment(null);
        setSelectedDate(null);
      }, 1000); // Attendi 1 secondo
    } catch (error) {
      console.error("Errore durante il ricaricamento dei dati:", error);
      // Chiudi comunque i form in caso di errore
      setIsFormOpen(false);
      setEditingAppointment(null);
      setSelectedDate(null);
    }
  };

  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setIsQuoteFormOpen(true);
  };

  const handleCreateNewQuote = (clientId: string) => {
    setClientIdForQuote(clientId);
    setEditingQuote(null);
    setIsQuoteFormOpen(true);
  };

  const handleQuoteFormClose = () => {
    setIsQuoteFormOpen(false);
    setEditingQuote(null);
    setClientIdForQuote(null);
  };

  const handleQuoteFormSubmit = async () => {
    setIsQuoteFormOpen(false);
    setEditingQuote(null);
    setClientIdForQuote(null);
    // Riapriamo il form appuntamento dopo aver creato il preventivo
    setIsFormOpen(true);
  };

  const handleSyncAppointments = async () => {
    toast({
      title: "Sincronizzazione avviata",
      description: "Sincronizzazione degli appuntamenti con i preventivi in corso...",
    });
    
    try {
      // Ottieni tutti gli appuntamenti
      const allAppointments = await appointmentService.getAll();
      
      // Filtra solo quelli con un preventivo collegato
      const appointmentsWithQuotes = allAppointments.filter(app => app.quoteId && app.quoteId.trim() !== "");
      
      console.log(`Trovati ${appointmentsWithQuotes.length} appuntamenti con preventivi collegati`);
      
      let syncCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      // Per ogni appuntamento con preventivo
      for (const app of appointmentsWithQuotes) {
        try {
          // Ottieni il preventivo collegato
          const quote = await getQuoteById(app.quoteId as string);
          
          if (quote) {
            // Leggi le ore di manodopera dal preventivo
            const laborHours = quote.laborHours || 0;
            
            // MODIFICATO: Aggiorna SEMPRE le ore di manodopera e durata,
            // mantenendo lo stato attuale di partsOrdered invariato
            console.log(`IMPORTANTE: Sincronizzazione appuntamento ${app.id} - Cliente ${app.clientName}`);
            console.log(`DETTAGLI: Durata attuale = ${app.duration}h, quoteLaborHours attuale = ${app.quoteLaborHours || 'non impostato'}`);
            console.log(`DETTAGLI: Ore manodopera preventivo = ${laborHours}h (ID preventivo: ${app.quoteId})`);
            
            // Aggiornamento dei campi per le ore di manodopera
            const updateData = {
              duration: laborHours,                // Manteniamo la sincronizzazione del campo duration
              quoteLaborHours: laborHours,         // Aggiornamento del campo specifico per le ore MdO del preventivo
              // Mantieni lo stato attuale dei ricambi ordinati (non lo modifichiamo)
              partsOrdered: app.partsOrdered
            };
            
            // Effettua l'aggiornamento
            await appointmentService.update(app.id, updateData);
            
            console.log(`SUCCESSO: Appuntamento ${app.id} (${app.clientName}) sincronizzato con laborHours=${laborHours}`);
            console.log(`DETTAGLI AGGIORNAMENTO:`, updateData);
            syncCount++;
          } else {
            console.warn(`ERRORE: Preventivo ${app.quoteId} non trovato per l'appuntamento ${app.id} (${app.clientName})`);
            skipCount++;
          }
        } catch (error) {
          console.error(`ERRORE: Sincronizzazione dell'appuntamento ${app.id} fallita:`, error);
          errorCount++;
        }
      }
      
      // Ricarica i dati
      await refetch();
      
      toast({
        title: "Sincronizzazione completata",
        description: `${syncCount} appuntamenti sincronizzati, ${skipCount} invariati, ${errorCount} errori.`,
      });
    } catch (error) {
      console.error("Errore nella sincronizzazione degli appuntamenti:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la sincronizzazione.",
        variant: "destructive",
      });
    }
  };

  // Funzione per aggiornare un appuntamento
  const handleUpdateAppointment = async (updatedAppointment: Appointment) => {
    try {
      console.log("Aggiornamento appuntamento:", updatedAppointment.id);
      console.log("Dati aggiornamento:", updatedAppointment);
      
      // Verifica che l'ID sia valido
      if (!updatedAppointment.id) {
        console.error("ID appuntamento mancante durante l'aggiornamento");
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dell'appuntamento",
          variant: "destructive",
        });
        return;
      }
      
      // Assicurati che lo stato partsOrdered sia gestito correttamente
      if (updatedAppointment.partsOrdered === undefined) {
        console.log("Stato parti non definito, impostando su false");
        updatedAppointment.partsOrdered = false;
      } else {
        console.log(`Stato parti ricevuto: ${updatedAppointment.partsOrdered}`);
      }
      
      // Assicurati che la durata venga aggiornata correttamente
      if (updatedAppointment.quoteId && 
          updatedAppointment.quoteLaborHours !== undefined && 
          updatedAppointment.quoteLaborHours > 0) {
        console.log(`Impostiamo la durata dall'appuntamento aggiornato: ${updatedAppointment.quoteLaborHours}h`);
        updatedAppointment.duration = updatedAppointment.quoteLaborHours;
      } else if (updatedAppointment.duration === undefined) {
        console.log("Durata non definita, impostando a 1h");
        updatedAppointment.duration = 1;
      }
      
      // Effettua l'aggiornamento
      await appointmentService.update(updatedAppointment.id, updatedAppointment);
      
      // Ricarica gli appuntamenti e mostra un messaggio di successo
      await refetch();
      toast({
        title: "Successo",
        description: "Appuntamento aggiornato con successo",
      });
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
      console.log("DEBUG - AppointmentsPage: ricevuti nuovi dati dalla query, aggiorno lo stato locale");
      setAppointments(fetchedAppointments);
    }
    
    if (queryLoading) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [fetchedAppointments, queryLoading]);

  // Esponi la funzione di ricarica a livello globale
  useEffect(() => {
    (window as any).reloadAppointments = async () => {
      console.log("DEBUG - Ricarico gli appuntamenti da AppointmentsPage");
      try {
        // Prima facciamo il refetch per aggiornare i dati da Firebase
        const result = await refetch();
        console.log("DEBUG - Refetch completato, risultato:", result.isSuccess ? "successo" : "fallito");
        
        // Aggiorniamo lo stato locale con i dati aggiornati
        if (result.isSuccess && result.data) {
          setAppointments(result.data);
          console.log("DEBUG - Appuntamenti ricaricati con successo:", result.data.length);
          return true;
        } else {
          // Se il refetch non ha funzionato, prova a caricare con un metodo alternativo
          console.log("DEBUG - Refetch non ha avuto successo, provo a caricare direttamente");
          const data = await appointmentService.getAll();
          setAppointments(data);
          console.log("DEBUG - Appuntamenti caricati direttamente:", data.length);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-bold">Appuntamenti</h2>
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2 sm:space-x-3">
          <Button className="w-full sm:w-auto" onClick={() => handleAddAppointment()}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="sm:inline">Nuovo Appuntamento</span>
            <span className="inline sm:hidden">Nuovo</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={handleSyncAppointments}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Sincronizza Preventivi</span>
          </Button>
          
          <div className="flex w-full sm:w-auto border border-border rounded-md overflow-hidden">
            <Button 
              variant={view === "calendar" ? "default" : "ghost"}
              onClick={() => setView("calendar")}
              className="rounded-none flex-1"
            >
              <Calendar className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
              <span className="inline sm:hidden">Cal</span>
            </Button>
            
            <Button 
              variant={view === "table" ? "default" : "ghost"}
              onClick={() => setView("table")}
              className="rounded-none flex-1"
            >
              <List className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
              <span className="inline sm:hidden">Tab</span>
            </Button>
          </div>
          
          <div className="relative w-full sm:w-auto">
            <SimpleDropdown
              trigger={
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Esporta
                </Button>
              }
              content={
                <div>
                  <DropdownMenuItem onClick={handleExportAppointments}>
                    Esporta in Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
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
                  }}>
                    Esporta in PDF
                  </DropdownMenuItem>
                </div>
              }
            />
          </div>
        </div>
      </div>
      
      {view === "table" && (
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Cerca appuntamento per cliente, targa o servizio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="flex space-x-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stato appuntamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="programmato">Confermato</SelectItem>
                  <SelectItem value="completato">Completato</SelectItem>
                  <SelectItem value="annullato">Annullato</SelectItem>
                </SelectContent>
              </Select>
              
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[180px]"
              />
            </div>
          </div>
          
          <TableView 
            appointments={filteredAppointments} 
            isLoading={isLoading} 
            onEdit={handleEditAppointment}
            onDeleteSuccess={refetch}
            onStatusChange={refetch}
            onEditQuote={handleEditQuote}
          />
        </div>
      )}
      
      {view === "calendar" && (
        <div className="space-y-4">
          <div className="max-w-full overflow-hidden">
            <CalendarView
              appointments={appointments} // Usa gli appuntamenti dallo stato locale
              isLoading={isLoading || queryLoading || isRefetching}
              onSelectDate={handleCalendarSelectDate}
              onSelectAppointment={handleEditAppointment}
              initialView={initialViewDay ? "day" : "week"}
            />
          </div>
        </div>
      )}
      
      {isFormOpen && (
        <AppointmentForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
          appointment={editingAppointment}
          selectedDate={selectedDate}
          onEditQuote={handleEditQuote}
          onCreateQuote={handleCreateNewQuote}
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
