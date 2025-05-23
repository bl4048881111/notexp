import React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { XCircle, FileText, Check, ArrowRight, Plus, Trash2, CalendarIcon, Calendar as CalendarIcon2, SearchIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { SimplePopover } from "@/components/ui/CustomUIComponents";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";

import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAllClients,
  getClientById,
  getQuotesByClientId,
  getQuoteById,
  getAllAppointments,
  updateQuote
} from "@shared/firebase";
import { 
  Appointment, 
  Client, 
  Quote, 
  CreateAppointmentInput, 
  createAppointmentSchema
} from "@shared/schema";
import { lookupVehicleByPlate, formatVehicleDetails } from "@/services/vehicleLookupService";
import { extractVehicleBrand } from '@/utils/vehicleUtils';

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: Appointment | null;
  selectedDate?: string | null;
  onEditQuote?: (quote: Quote) => void;
  onCreateQuote?: (clientId: string) => void;
  defaultQuote?: Quote;
}

export default function AppointmentForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment,
  selectedDate,
  onEditQuote,
  onCreateQuote,
  defaultQuote
}: AppointmentFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  
  const allowedStatus = ["programmato", "in_lavorazione", "completato", "annullato"];
  const normalizeStatus = (status: any) =>
    typeof status === "string" && allowedStatus.includes(status)
      ? status
      : "programmato";

  const statusValue = normalizeStatus(appointment?.status);
  console.log("DEBUG STATUS:", appointment?.status, "->", statusValue, "form.watch:", appointment?.status);

  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      clientId: appointment?.clientId || defaultQuote?.clientId || "",
      quoteId: appointment?.quoteId || defaultQuote?.id || "",
      date: appointment?.date || selectedDate || defaultQuote?.date || "",
      time: appointment?.time || "09:00",
      duration: appointment?.duration || (defaultQuote as any)?.laborHours || 1,
      notes: appointment?.notes || defaultQuote?.notes || "",
      status: normalizeStatus(appointment?.status) as "programmato" | "in_lavorazione" | "completato" | "annullato",
      partsOrdered: !!(appointment?.partsOrdered ?? false),
      services: appointment?.services || [],
      clientName: appointment?.clientName || "",
      phone: appointment?.phone || "",
      plate: appointment?.plate || "",
    },
  });
  
  // Query per ottenere tutti i clienti
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['/clients'],
    queryFn: async () => {
      const allClients = await getAllClients();
      return allClients;
    },
  });
  
  // Query per ottenere i preventivi del cliente selezionato
  const { data: clientQuotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['/quotes/client', selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient?.id) return [];
      return await getQuotesByClientId(selectedClient.id);
    },
    enabled: !!selectedClient?.id,
  });
  
  // Query per ottenere tutti gli appuntamenti attuali
  const { data: allAppointments = [] } = useQuery({
    queryKey: ['/appointments'],
    queryFn: async () => {
      try {
        return await getAllAppointments();
      } catch (error) {
        console.error('Errore nel caricamento degli appuntamenti:', error);
        return [];
      }
    },
  });
  
  // Verifica se esiste già un appuntamento per il cliente con lo stesso preventivo
  const checkForExistingAppointment = (clientId: string, quoteId: string) => {
    if (!clientId || !quoteId) return null;
    
    const existingAppointment = allAppointments.find((app: Appointment) => 
      app.clientId === clientId && 
      app.quoteId === quoteId && 
      (!appointment || app.id !== appointment.id) // Escludi l'appuntamento corrente se in modifica
    );
    
    return existingAppointment;
  };
  
  // Quando viene aperto il form per modificare un appuntamento esistente, carica i dati del cliente
  useEffect(() => {
    const loadClientData = async () => {
      if (appointment?.clientId) {
        try {
          const client = await getClientById(appointment.clientId);
          if (client) {
            setSelectedClient(client);
            
            // Imposta la targa del veicolo se disponibile nell'appuntamento o nel cliente
            if (appointment.plate) {
              setVehiclePlate(appointment.plate);
            } else if (client.plate) {
              setVehiclePlate(client.plate);
            }
            
            // Se l'appuntamento ha un preventivo associato, selezionalo
            if (appointment.quoteId) {
              const quotes = await getQuotesByClientId(client.id);
              const quote = quotes.find(q => q.id === appointment.quoteId);
              if (quote) {
                setSelectedQuote(quote);
                
                // MODIFICATO: Aggiorna SEMPRE la durata dal preventivo
                const laborHours = (quote as any).laborHours || 0;
                if (laborHours > 0) {
                  console.log(`IMPORTANTE: Impostando durata a ${laborHours} ore dal preventivo (durata precedente: ${appointment.duration})`);
                  form.setValue("duration", laborHours);
                } else {
                  console.log(`Preventivo senza ore di manodopera (${laborHours}h), mantengo durata attuale: ${appointment.duration}h`);
                }
              }
            }
          }
        } catch (error) {
          console.error("Errore nel caricamento del cliente:", error);
        }
      }
    };
    
    if (isOpen && appointment) {
      loadClientData();
    }
  }, [isOpen, appointment, form]);
  
  // Reset dello stato quando si chiude il dialog
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedClient(null);
      setSelectedQuote(null);
      setSearchQuery("");
      setIsSearching(false);
      setVehiclePlate("");
      setIsLoadingVehicle(false);
      setVehicleBrand("");
      form.reset();
    }
  }, [isOpen, form]);
  
  // Gestisce la pressione del tasto invio a livello globale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && isOpen) {
        e.preventDefault();
        
        // Se siamo allo step 1 e un cliente è selezionato, passa allo step successivo
        if (currentStep === 1 && selectedClient) {
          setCurrentStep(prev => prev + 1);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStep, selectedClient, isOpen]);
  
  // Gestione della ricerca clienti
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return clients.filter(client => 
      client.name.toLowerCase().includes(query) || 
      client.surname.toLowerCase().includes(query) || 
      client.phone.toLowerCase().includes(query) || 
      client.plate.toLowerCase().includes(query)
    );
  }, [searchQuery, clients]);
  
  const handleSelectClient = (client: Client, goToNextStep = false) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    
    // Imposta la targa del cliente se disponibile
    if (client.plate) {
      setVehiclePlate(client.plate);
    }
    
    // Se c'è un modello associato, impostalo nel form
    if (client.model) {
      form.setValue("model", client.model);
    }
    
    setIsSearching(false);
    setSearchQuery("");
    
    // Passa automaticamente allo step successivo se richiesto
    if (goToNextStep) {
      // Passa sempre allo step 2 (preventivi) indipendentemente da tutto
      setCurrentStep(2);
    }
  };
  
  const handleClearSelectedClient = () => {
    setSelectedClient(null);
    setSelectedQuote(null);
    setVehiclePlate("");
    setVehicleBrand("");
    form.setValue("clientId", "");
    form.setValue("quoteId", "");
    form.setValue("model", "");
  };
  
  const handleSelectQuote = async (quote: Quote) => {
    // Verifichiamo che il preventivo abbia un totale corretto
    // Aggiungiamo debug per verificare lo stato del preventivo
    console.log(`Preventivo selezionato ${quote.id}:`, {
      totalPrice: quote.totalPrice,
      total: quote.total,
      laborTotal: (quote as any).laborTotal,
      partsSubtotal: (quote as any).partsSubtotal,
      taxAmount: (quote as any).taxAmount
    });
    
    // Se il preventivo ha il totale a 0 ma ha subtotali validi, ricalcola il totale
    if ((!quote.totalPrice || quote.totalPrice === 0) && (!quote.total || quote.total === 0) && 
        (((quote as any).laborTotal > 0 || (quote as any).partsSubtotal > 0))) {
      console.log(`Preventivo ${quote.id} ha totale a 0, ricalcolando...`);
      
      // Ricalcola il totale dai subtotali
      const recalculatedTotal = ((quote as any).laborTotal || 0) + ((quote as any).partsSubtotal || 0);
      const taxAmount = (quote as any).taxAmount || 0;
      const finalTotal = recalculatedTotal + taxAmount;
      
      // Crea una copia del preventivo con il totale corretto
      quote = {
        ...quote,
        totalPrice: finalTotal,
        total: finalTotal
      };
      
      console.log(`Preventivo ${quote.id} recalcolato con totale: ${finalTotal}€`);
    }
    
    setSelectedQuote(quote);
    form.setValue("quoteId", quote.id);
    
    // Se il preventivo ha ore di manodopera, imposta la durata dell'appuntamento
    if (quote.laborHours && quote.laborHours > 0) {
      console.log(`Impostando durata appuntamento a ${quote.laborHours} ore dal preventivo`);
      form.setValue("duration", quote.laborHours);
    }
    
    // Verifica se esiste già un appuntamento per questo preventivo
    const existingAppointment = checkForExistingAppointment(selectedClient?.id || '', quote.id);
    if (existingAppointment) {
      toast({
        title: "Attenzione: Appuntamento esistente",
        description: `Esiste già un appuntamento per questo preventivo programmato per il ${existingAppointment.date} alle ${existingAppointment.time}.`,
        variant: "destructive",
      });
    }
  };
  
  const handleEditQuote = (quote: Quote) => {
    if (onEditQuote) {
      // Verifica se ci sono modifiche effettive prima di chiamare onEditQuote
      const currentQuote = selectedQuote;
      if (currentQuote && JSON.stringify(currentQuote) === JSON.stringify(quote)) {
        // Non ci sono modifiche, non fare nulla
        return;
      }
      
      // Chiudi il form di appuntamento prima di aprire il form di modifica preventivo
      // per evitare sovrapposizioni e conflitti tra i form
      console.log("Chiusura form appuntamento prima di modificare il preventivo");
      onClose();
      
      // Dopo una breve pausa per garantire la chiusura, apri il form di modifica preventivo
      setTimeout(() => {
        onEditQuote(quote);
      }, 200);
    }
  };
  
  const handleCreateNewQuote = () => {
    if (onCreateQuote && selectedClient) {
      onCreateQuote(selectedClient.id);
    }
  };
  
  const handleLookupVehicle = async () => {
    if (!vehiclePlate) {
      toast({
        title: "Targa non valida",
        description: "Inserisci una targa valida per cercare le informazioni sul veicolo.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingVehicle(true);
    try {
      // Prima otteniamo i dettagli grezzi del veicolo
      const rawVehicleDetails = await lookupVehicleByPlate(vehiclePlate);
      
      if (rawVehicleDetails) {
        // Utilizziamo la funzione di formattazione per ottenere dati strutturati
        const formattedDetails = formatVehicleDetails(rawVehicleDetails);
        
        // Estrai la marca usando la funzione utility
        const brand = extractVehicleBrand(formattedDetails.make + ' ' + formattedDetails.model);
        setVehicleBrand(brand);
        
        // Crea una stringa di modello ben formattata
        const modelString = `${formattedDetails.make} ${formattedDetails.model} ${formattedDetails.year}`.trim();
        form.setValue("model", modelString);
        
        toast({
          title: "Veicolo trovato",
          description: `${formattedDetails.make} ${formattedDetails.fullModel} ${formattedDetails.power ? `(${formattedDetails.power})` : ''}`,
        });
      } else {
        toast({
          title: "Veicolo non trovato",
          description: "Non è stato possibile trovare informazioni per questa targa.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Errore durante la ricerca del veicolo:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la ricerca del veicolo.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointment?.id) return;
    
    if (confirm("Sei sicuro di voler eliminare questo appuntamento?")) {
      try {
        await deleteAppointment(appointment.id);
        toast({
          title: "Appuntamento eliminato",
          description: "L'appuntamento è stato eliminato con successo.",
        });
        onSuccess();
        onClose();
      } catch (error) {
        console.error("Errore nell'eliminazione dell'appuntamento:", error);
        toast({
          title: "Errore",
          description: "Si è verificato un errore durante l'eliminazione dell'appuntamento.",
          variant: "destructive",
        });
      }
    }
  };
  
  // Dopo il salvataggio dell'appuntamento, esegui un'operazione molto importante
  // che ricarica forzatamente i dati e aggiorna tutte le viste
  const forceRefreshAfterSave = async () => {
    console.log(`DEBUG - Forzo aggiornamento dopo salvataggio di appuntamento`);
    
    try {
      // 1. Invia evento di aggiornamento calendario
      const event = new Event('calendar:update');
      window.dispatchEvent(event);
      
      // 2. Ricarica forzata della pagina
      if (window && window.parent && (window.parent as any).reloadAppointments) {
        console.log("DEBUG - Richiamo reloadAppointments");
        await (window.parent as any).reloadAppointments();
      }
      
      // 3. Forza aggiornamento della vista calendario
      if (window && (window as any).forceCalendarRefresh) {
        console.log("DEBUG - Forzo refresh vista calendario");
        (window as any).forceCalendarRefresh();
      }
      
      console.log("DEBUG - Aggiornamento forzato completato");
    } catch (error) {
      console.error("Errore nell'aggiornamento forzato:", error);
    }
  };
  
  // Funzioni helper per formattare data e ora
  const formatAppointmentDate = (dateStr: string): string => {
    return dateStr || format(new Date(), "yyyy-MM-dd");
  };
  
  const formatAppointmentTime = (timeStr: string): string => {
    // Assicurati che l'ora sia nel formato corretto (24 ore)
    const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timePattern.test(timeStr)) {
      // Se il formato non è valido, usa un orario predefinito
      return "09:00";
    }
    return timeStr;
  };
  
  // Gestisce l'evento di submit del form
  const onSubmit = async (data: CreateAppointmentInput) => {
    setIsSubmitting(true);
    
    try {
      // Imposta lo stato del preventivo a "accettato" quando si salva l'appuntamento
      if (selectedQuote && selectedQuote.status !== "accettato") {
        try {
          await updateQuote(selectedQuote.id, { status: "accettato" });
          toast({
            title: "Preventivo accettato",
            description: "Lo stato del preventivo è stato aggiornato in 'Accettato'.",
          });
        } catch (error) {
          console.error("Errore nell'aggiornamento dello stato del preventivo:", error);
          toast({
            title: "Errore",
            description: "Non è stato possibile aggiornare lo stato del preventivo.",
            variant: "destructive",
          });
        }
      }
      
      // Assicurati che la durata sia un valore numerico
      let durationValue: number = 1;
      
      try {
        // Tenta di convertire la durata in numero
        durationValue = typeof data.duration === 'string' 
          ? parseFloat(data.duration) 
          : typeof data.duration === 'number'
            ? data.duration
            : 1;
            
        // Validazione per essere sicuri che sia un numero valido
        if (isNaN(durationValue) || durationValue <= 0) {
          durationValue = 1;
        }
      } catch (e) {
        console.error("Errore nel parsing della durata:", e);
        durationValue = 1;
      }
      
      // IMPORTANTE: Imposta sempre quoteLaborHours uguale a duration
      // Questo risolve il problema della visualizzazione nel calendario
      // e della sincronizzazione tra preventivi e appuntamenti
      const quoteLaborHoursValue = durationValue;
      
      console.log("DEBUG FORM - Valori sincronizzati prima dell'invio:", {
        durata: durationValue,
        tipoDurata: typeof durationValue,
        quoteLaborHours: quoteLaborHoursValue,
        tipoQuoteLaborHours: typeof quoteLaborHoursValue,
        nota: "quoteLaborHours impostato uguale a duration per garantire coerenza"
      });
      
      // Rimappa i dati per adattarli al formato dell'appuntamento
      const appointmentData: Partial<Appointment> = {
        clientId: data.clientId,
        clientName: data.clientName,
        plate: data.plate,
        date: formatAppointmentDate(data.date),
        time: formatAppointmentTime(data.time),
        duration: durationValue,
        quoteId: data.quoteId || undefined,
        quoteLaborHours: quoteLaborHoursValue, // Sempre sincronizzato con duration
        partsOrdered: data.partsOrdered === null ? undefined : data.partsOrdered,
        services: data.services || [],
        notes: data.notes || "",
        status: data.status || "programmato",
      };
      
      console.log("DEBUG AppointmentForm - Sto salvando l'appuntamento con durata:", appointmentData.duration, "e quoteLaborHours:", appointmentData.quoteLaborHours);
      
      let savedId;
      
      // Aggiorna o crea un nuovo appuntamento
      if (appointment?.id) {
        // Salvataggio sincronizzato e completo per assicurarsi che i dati siano persistiti
        await updateAppointment(appointment.id, appointmentData);
        savedId = appointment.id;
        
        // Log diagnostico
        console.log(`DEBUG - Appuntamento aggiornato, ID: ${savedId}, durata: ${appointmentData.duration}h`);
        
        // Notifica il calendario che ci sono stati cambiamenti
        try {
          const event = new Event('calendar:update');
          window.dispatchEvent(event);
          
          // Aggiunta chiamata alla funzione di refresh forzato
          await forceRefreshAfterSave();
          
          // Tenta anche di richiamare la funzione globale direttamente se esiste
          if (window && (window as any).forceCalendarRefresh) {
            console.log("DEBUG - Forzo il refresh del calendario tramite forceCalendarRefresh");
            (window as any).forceCalendarRefresh();
          } else if (window && window.parent && (window.parent as any).reloadAppointments) {
            console.log("DEBUG - Forzo la ricarica degli appuntamenti tramite reloadAppointments");
            (window.parent as any).reloadAppointments();
          }
          
          console.log("DEBUG - Inviato evento di aggiornamento calendario dopo modifica appuntamento");
        } catch (eventError) {
          console.error("Errore nell'invio dell'evento di aggiornamento:", eventError);
        }
        toast({
          title: "Appuntamento aggiornato",
          description: "L'appuntamento è stato aggiornato con successo.",
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        // Creazione nuovo appuntamento
        const newAppointment = await createAppointment(appointmentData as Appointment);
        savedId = newAppointment.id;
        
        // Notifica il calendario che ci sono stati cambiamenti
        try {
          const event = new Event('calendar:update');
          window.dispatchEvent(event);
          
          // Aggiunta chiamata alla funzione di refresh forzato
          await forceRefreshAfterSave();
          
          // Tenta anche di richiamare la funzione globale direttamente se esiste
          if (window && (window as any).forceCalendarRefresh) {
            console.log("DEBUG - Forzo il refresh del calendario tramite forceCalendarRefresh");
            (window as any).forceCalendarRefresh();
          } else if (window && window.parent && (window.parent as any).reloadAppointments) {
            console.log("DEBUG - Forzo la ricarica degli appuntamenti tramite reloadAppointments");
            (window.parent as any).reloadAppointments();
          }
          
          console.log("DEBUG - Inviato evento di aggiornamento calendario dopo salvataggio appuntamento");
        } catch (eventError) {
          console.error("Errore nell'invio dell'evento di aggiornamento:", eventError);
        }
        toast({
          title: "Appuntamento creato",
          description: "L'appuntamento è stato creato con successo.",
        });
      }
    } catch (error) {
      console.error("Errore nel salvataggio dell'appuntamento:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio dell'appuntamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Funzione per chiamare manualmente l'evento Enter quando il cliente è selezionato
  const triggerEnterKeyPress = () => {
    if (selectedClient && currentStep === 1) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  // Effetto per aggiornare la lista dei preventivi quando viene creato un nuovo preventivo
  useEffect(() => {
    // Se siamo nello step 2 (preventivi) e ci sono dati caricati
    if (currentStep === 2 && selectedClient) {
      // Aggiorniamo la lista dei preventivi
      const fetchData = async () => {
        try {
          const clientQuotes = await getQuotesByClientId(selectedClient.id);
          // Utilizziamo queryClient per invalidare e aggiornare la query 
          queryClient.setQueryData(['/quotes/client', selectedClient.id], clientQuotes);
        } catch (error) {
          console.error("Errore nel caricamento dei preventivi aggiornati:", error);
        }
      };
      
      fetchData();
    }
  }, [currentStep, isOpen, selectedClient, queryClient]);
  
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "completato":
        return <Badge variant="outline" className="bg-green-200 text-green-800 border-green-500 font-medium">Completato</Badge>;
      case "annullato":
        return <Badge variant="outline" className="bg-red-200 text-red-800 border-red-500 font-medium">Annullato</Badge>;
      case "programmato":
        return <Badge variant="outline" className="bg-blue-200 text-blue-800 border-blue-500 font-medium">Confermato</Badge>;
      case "in_lavorazione":
        return <Badge variant="outline" className="bg-yellow-200 text-yellow-800 border-yellow-500 font-medium">In Lavorazione</Badge>;
      default:
        return <Badge variant="outline" className="bg-blue-200 text-blue-800 border-blue-500 font-medium">Confermato</Badge>;
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        clientId: appointment?.clientId || defaultQuote?.clientId || "",
        quoteId: appointment?.quoteId || defaultQuote?.id || "",
        date: appointment?.date || selectedDate || defaultQuote?.date || "",
        time: appointment?.time || "09:00",
        duration: appointment?.duration || (defaultQuote as any)?.laborHours || 1,
        notes: appointment?.notes || defaultQuote?.notes || "",
        status: normalizeStatus(appointment?.status) as "programmato" | "in_lavorazione" | "completato" | "annullato",
        partsOrdered: !!(appointment?.partsOrdered ?? false),
        services: appointment?.services || [],
        clientName: appointment?.clientName || "",
        phone: appointment?.phone || "",
        plate: appointment?.plate || "",
      });
    }
  }, [isOpen, appointment, defaultQuote, selectedDate, form]);
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        // Se stiamo chiudendo il dialog e non stiamo modificando un preventivo o aggiungendo un ricambio
        if (!open && !isSubmitting) {
          onClose();
        }
      }}>
        <DialogContent className="max-w-[600px] w-[95%] h-auto max-h-[85vh] md:max-h-[85vh] sm:max-h-[90vh] overflow-hidden p-0 flex flex-col z-[1050]">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex flex-col items-center">
              <DialogTitle className="text-2xl font-bold mb-1 flex items-center gap-2">
                <CalendarIcon2 className="h-5 w-5 text-primary" />
                {appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {currentStep === 1 ? "Inserisci i dati del cliente" :
                 currentStep === 2 ? "Seleziona un preventivo" :
                 "Dettagli dell'appuntamento"}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          {/* Form con pulsanti di navigazione separati */}
          <div className="flex flex-col h-full">
            <div className="flex-grow overflow-auto">
              <Form {...form}>
                <form 
                  className="space-y-6 px-6 pt-5 pb-20" 
                  onSubmit={(e) => {
                    // Evita il refresh della pagina su submit del form
                    e.preventDefault();
                    form.handleSubmit(onSubmit as any)(e);
                  }}
                  onKeyDown={(e) => {
                    // Impedisce che il tasto ENTER faccia avanzare il form
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // Non fa nulla, impedisce semplicemente l'azione predefinita
                    }
                  }}
                >
                  {/* Step 1: Cliente */}
                  {currentStep === 1 && (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center pt-4">
                        <h2 className="text-lg font-semibold flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          Cliente
                        </h2>
                      </div>
                      
                      {selectedClient ? (
                        <div className="flex justify-between items-center p-4 rounded-lg bg-primary/5 border-2 border-primary/30 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/15 rounded-full p-2.5 text-primary">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-bold text-base text-foreground">{selectedClient.name} {selectedClient.surname}</h3>
                              <div className="flex items-center gap-4 mt-1.5">
                                <span className="text-sm flex items-center text-muted-foreground">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-primary/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  {selectedClient.phone}
                                </span>
                                <span className="text-sm flex items-center text-muted-foreground">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-primary/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  {selectedClient.plate}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={handleClearSelectedClient}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <Input
                              placeholder="Cerca cliente per nome, telefono o targa..."
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsSearching(true);
                                setSelectedIndex(-1);
                              }}
                              onKeyDown={(e) => {
                                // Previene il comportamento predefinito per i tasti freccia
                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  
                                  if (filteredClients.length > 0) {
                                    const newIndex = e.key === 'ArrowDown'
                                      ? (selectedIndex + 1) % filteredClients.length
                                      : selectedIndex <= 0
                                        ? filteredClients.length - 1
                                        : selectedIndex - 1;
                                    
                                    setSelectedIndex(newIndex);
                                  }
                                } else if (e.key === 'Enter' && selectedIndex >= 0 && filteredClients[selectedIndex]) {
                                  e.preventDefault();
                                  handleSelectClient(filteredClients[selectedIndex], true); // Con true passa automaticamente allo step successivo
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setIsSearching(false);
                                }
                              }}
                              className="w-full border-primary/20 focus-visible:ring-primary/30"
                              autoComplete="off"
                            />
                            
                            {isSearching && filteredClients.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-popover shadow-lg rounded-md border overflow-hidden">
                                <ScrollArea className="max-h-[300px]">
                                  <div className="p-1">
                                    {filteredClients.map((client, index) => (
                                      <div
                                        key={client.id}
                                        className={cn(
                                          "flex items-center p-2 rounded-md cursor-pointer",
                                          selectedIndex === index ? "bg-primary/10" : "hover:bg-primary/5"
                                        )}
                                        onClick={() => handleSelectClient(client, true)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <div className="font-medium truncate">
                                              {client.name} {client.surname}
                                            </div>
                                            <div className="text-xs text-muted-foreground ml-2">
                                              {client.phone}
                                            </div>
                                          </div>
                                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                                            <span className="truncate">
                                              {client.plate && (
                                                <span className="inline-flex items-center mr-2">
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-primary/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                  </svg>
                                                  {client.plate}
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                            
                            {isSearching && searchQuery && filteredClients.length === 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-popover shadow-lg rounded-md border p-4 text-center">
                                <p className="text-muted-foreground mb-2">Nessun cliente trovato</p>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    // Funzionalità per creare un nuovo cliente (da implementare)
                                    setIsSearching(false);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Crea nuovo cliente
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <Input type="hidden" {...form.register("clientId")} />
                      
                      {/* Pulsante per passare allo step successivo con il tasto Invio */}
                      <div className="sr-only">
                        <Button
                          ref={nextButtonRef}
                          type="button"
                          onClick={() => {
                            if (currentStep === 1 && selectedClient) {
                              setCurrentStep(prev => prev + 1);
                            }
                          }}
                        >
                          Avanti
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Step 2: Preventivo */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center pt-4">
                        <h2 className="text-lg font-semibold flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Preventivo
                        </h2>
                      </div>
                      
                      <div className="space-y-4">
                        {selectedClient && (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-1.5">
                                <div className="bg-primary/15 rounded-full p-1.5 text-primary">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <span className="font-medium">{selectedClient.name} {selectedClient.surname}</span>
                              </div>
                              <Button 
                                type="button" 
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentStep(1)}
                                className="border-primary/30 text-primary hover:bg-primary/5 gap-1 text-xs"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Cambia cliente</span>
                              </Button>
                            </div>
                            <Label className="text-sm font-medium">Preventivi disponibili</Label>
                            
                            {isLoadingQuotes ? (
                              <div className="space-y-2">
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-20 w-full" />
                              </div>
                            ) : clientQuotes.length > 0 ? (
                              <div className="space-y-3">
                                {clientQuotes.map((quote) => (
                                  <div 
                                    key={quote.id}
                                    className={cn(
                                      "flex items-start justify-between p-3 rounded-lg border-2 cursor-pointer",
                                      selectedQuote?.id === quote.id 
                                        ? "bg-primary/5 border-primary/30" 
                                        : "bg-background border-border hover:bg-muted/5"
                                    )}
                                    onClick={() => handleSelectQuote(quote)}
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <div className="font-medium">{quote.plate} - {(quote as any).model}</div>
                                        <Badge variant={quote.status === "accettato" ? "secondary" : "outline"} className={`ml-2 px-1 py-0 text-xs ${
                                          quote.status === "accettato" 
                                            ? "bg-green-100 text-green-800 border-green-300" 
                                            : quote.status === "bozza" 
                                              ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                              : quote.status === "completato"
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-blue-100 text-blue-800 border-blue-300"
                                        }`}>
                                          {quote.status === "accettato" 
                                            ? "Accettato" 
                                            : quote.status === "bozza" 
                                              ? "Bozza" 
                                              : quote.status === "completato"
                                                ? "Completato"
                                                : "Inviato"}
                                        </Badge>
                                      </div>
                                      
                                      <div className="flex items-center mt-1.5 text-sm text-muted-foreground gap-3">
                                        <span>
                                          {format(new Date(quote.date), "dd/MM/yyyy", { locale: it })}
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {((quote.totalPrice || quote.total || 0) > 0 
                                            ? (quote.totalPrice || quote.total) 
                                            : (((quote as any).laborTotal || 0) + ((quote as any).partsSubtotal || 0))).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                      </div>
                                      
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {(quote as any).items?.length || 0} servizi, {(quote as any).items?.reduce((acc: number, item: any) => acc + (item.parts?.length || 0), 0) || 0} ricambi
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-full"
                                        title="Modifica preventivo"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditQuote(quote);
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </Button>
                                      
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50"
                                        title="Elimina preventivo"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm("Sei sicuro di voler eliminare questo preventivo?")) {
                                            // Implementa l'eliminazione del preventivo
                                            if (onEditQuote) {
                                              // Chiudi il form di appuntamento prima di aprire il form di modifica preventivo
                                              onClose();
                                              
                                              // Passiamo al form di modifica con un flag per indicare l'eliminazione
                                              setTimeout(() => {
                                                const quoteToDelete = {...quote, _delete: true};
                                                onEditQuote(quoteToDelete);
                                              }, 200);
                                            }
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                      
                                      {selectedQuote?.id === quote.id && (
                                        <Check className="h-5 w-5 text-primary" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                                
                                <div className="mt-4 flex justify-between items-center">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-1"
                                    onClick={handleCreateNewQuote}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Crea nuovo preventivo
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="border border-border rounded-lg bg-background p-4 text-center text-muted-foreground">
                                <p>Nessun preventivo disponibile per questo cliente.</p>
                                {onCreateQuote && (
                                  <Button 
                                    variant="link" 
                                    className="mt-2 text-primary font-medium" 
                                    onClick={handleCreateNewQuote}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Crea un nuovo preventivo
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <Input type="hidden" {...form.register("quoteId")} />
                      </div>
                    </div>
                  )}
                  
                  {/* Step 3: Dettagli appuntamento */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-base font-semibold flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1.5 text-primary" />
                          Dettagli Appuntamento
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control as any}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Stato
                              </FormLabel>
                              <FormControl>
                                <Select
                                  value={normalizeStatus(form.watch('status'))}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="border-primary/20 h-9 focus-visible:ring-primary/30 z-[1200]">
                                    <SelectValue placeholder="Seleziona uno stato" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[1200]">
                                    <SelectItem value="programmato" className="text-blue-600 font-medium">Confermato</SelectItem>
                                    <SelectItem value="in_lavorazione" className="text-yellow-600 font-medium">In Lavorazione</SelectItem>
                                    <SelectItem value="completato" className="text-green-600 font-medium">Completato</SelectItem>
                                    <SelectItem value="annullato" className="text-red-600 font-medium">Annullato</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control as any}
                            name="date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">
                                  Data
                                </FormLabel>
                                <FormControl>
                                  <SimplePopover
                                    trigger={
                                      <div className="flex items-center w-full border border-primary/20 rounded-md h-9 px-3 focus-within:ring-1 focus-within:ring-primary/30 hover:bg-accent">
                                        <Button
                                          variant={"ghost"}
                                          type="button"
                                          className={cn(
                                            "w-full h-full p-0 text-left text-sm font-normal flex justify-between items-center",
                                            !field.value && "text-muted-foreground"
                                          )}
                                        >
                                          {field.value ? (
                                            <span>
                                              {format(new Date(field.value), "d MMMM yyyy", { locale: it })}
                                            </span>
                                          ) : (
                                            <span>Seleziona una data</span>
                                          )}
                                          <CalendarIcon className="h-4 w-4 opacity-50" />
                                        </Button>
                                      </div>
                                    }
                                    align="start"
                                    className="p-0"
                                  >
                                    <Calendar
                                      mode="single"
                                      selected={field.value ? new Date(field.value) : undefined}
                                      onSelect={(date: Date | undefined) => {
                                        if (date) {
                                          field.onChange(format(date, "yyyy-MM-dd"));
                                        }
                                      }}
                                      locale={it}
                                      initialFocus
                                    />
                                  </SimplePopover>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control as any}
                            name="time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">
                                  Ora
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      type="text" 
                                      className="border-primary/20 focus-visible:ring-primary/30 h-9 text-sm text-center font-medium tracking-widest" 
                                      value={field.value || ""}
                                      onChange={(e) => {
                                        // Ottieni solo numeri dall'input
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        
                                        // Formatta automaticamente con i due punti dopo le prime due cifre
                                        let formattedVal = val;
                                        if (val.length > 2) {
                                          // Inserisci i due punti dopo le prime due cifre
                                          formattedVal = val.substring(0, 2) + ':' + val.substring(2);
                                        }
                                        
                                        // Limita a 5 caratteri (formato HH:MM)
                                        if (formattedVal.length <= 5) {
                                          field.onChange(formattedVal);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        // Quando si esce dal campo, formatta correttamente l'ora
                                        let val = e.target.value;
                                        
                                        // Se c'è un valore, assicurati che sia nel formato HH:MM
                                        if (val) {
                                          const parts = val.split(':');
                                          let hours = parts[0] ? parseInt(parts[0], 10) : 0;
                                          let minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
                                          
                                          // Validazione ore (0-23)
                                          hours = Math.max(0, Math.min(23, hours));
                                          
                                          // Validazione minuti (0-59)
                                          minutes = Math.max(0, Math.min(59, minutes));
                                          
                                          // Formatta come HH:MM
                                          const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                          field.onChange(formattedTime);
                                        }
                                      }}
                                      placeholder=""
                                      maxLength={5}
                                      name={field.name}
                                      ref={field.ref}
                                    />
                                    
                                    {!field.value && (
                                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm">
                                        HH:MM
                                      </span>
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Sezione ore manodopera e stato ricambi */}
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control as any}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-primary" />
                                  Ore manodopera
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    className="border-primary/20 focus-visible:ring-primary/30 h-9 text-sm text-center font-medium"
                                    min="0.5"
                                    max="24"
                                    step="0.5"
                                    value={field.value?.toString() || "1"}
                                    onChange={(e) => {
                                      // Converti in numero e limita a numeri positivi
                                      const value = Math.max(0.5, Math.min(24, parseFloat(e.target.value || "1")));
                                      field.onChange(value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control as any}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Informazioni aggiuntive
                              </FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Descrivi brevemente le tue necessità" 
                                  className="resize-none border-primary/20 focus-visible:ring-primary/30 min-h-[70px] text-sm" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </form>
              </Form>
            </div>
            
            {/* Pulsanti di navigazione fissi - spostati fuori dal form */}
            <DialogFooter className="py-4 border-t mt-6 sticky bottom-0 bg-background z-10 px-6">
              <div className="flex w-full justify-between">
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    size="sm"
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    Annulla
                  </Button>
                  
                  {/* Pulsante Elimina (visibile solo quando si modifica un appuntamento esistente) */}
                  {appointment && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAppointment}
                      className="gap-1"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Elimina
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {/* Pulsante Indietro (visibile solo negli step successivi al primo) */}
                  {currentStep > 1 && (
                    <Button 
                      type="button" 
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="gap-1 border-primary/20 text-primary hover:bg-primary/5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Indietro
                    </Button>
                  )}
                  
                  {/* Pulsante Avanti (visibile solo nei primi due step) */}
                  {currentStep < 3 ? (
                    <Button 
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault(); // Previene il refresh della pagina
                        if (currentStep === 1 && !selectedClient) {
                          toast({
                            title: "Selezione cliente richiesta",
                            description: "Seleziona un cliente prima di procedere",
                            variant: "destructive",
                          });
                          return;
                        }
                        setCurrentStep(prev => prev + 1);
                      }}
                      className="gap-2 bg-primary"
                    >
                      {currentStep === 1 ? "Avanti" : "Aggiungi dettagli"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    /* Pulsante Fine (visibile solo nell'ultimo step) */
                    <Button 
                      type="button"
                      size="sm"
                      onClick={async (e) => {
                        e.preventDefault(); // Previene il refresh della pagina
                        
                        // Validazione aggiuntiva dei dati del form
                        const timeValue = form.getValues("time") || "";
                        const dateValue = form.getValues("date") || "";
                        const durationValue = form.getValues("duration") || 1;
                        const quoteLaborHours = (selectedQuote as any)?.laborHours;
                        const partsOrderedValue = form.getValues("partsOrdered");
                        
                        console.log(`DEBUG - Valore partsOrdered al momento del submit: ${partsOrderedValue === true ? 'true' : 'false'} (${typeof partsOrderedValue})`);
                        
                        // Controlla che l'ora sia nel formato corretto (24 ore)
                        let timeToSave = timeValue;
                        const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
                        
                        if (!timePattern.test(timeToSave)) {
                          // Formatta o usa un valore predefinito
                          if (timeToSave.includes(':')) {
                            const parts = timeToSave.split(':');
                            const hours = Math.min(23, Math.max(0, parseInt(parts[0] || '0', 10)));
                            const minutes = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10)));
                            timeToSave = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                          } else {
                            timeToSave = "09:00"; // Orario predefinito se non valido
                          }
                        }
                        
                        // Prepara le note con informazioni aggiuntive sulla marca
                        let notesWithBrand = form.getValues("notes") || "";
                        if (vehicleBrand) {
                          notesWithBrand = `[BRAND:${vehicleBrand}] ${notesWithBrand}`;
                        }
                        
                        // Usa la durata dal form sempre, ma se c'è un preventivo e la durata è diversa da quella del preventivo,
                        // stampa un avviso nella console
                        let finalDuration = Number(durationValue);
                        if (quoteLaborHours && quoteLaborHours > 0 && quoteLaborHours !== finalDuration) {
                          console.log(`ATTENZIONE: La durata dal form (${finalDuration}h) è diversa da quella del preventivo (${quoteLaborHours}h)`);
                          
                          // Usa la durata dal preventivo se è disponibile
                          finalDuration = quoteLaborHours;
                          console.log(`Usando la durata dal preventivo: ${finalDuration}h`);
                        }
                        
                        // Ottieni i dati completi
                        const formData = {
                          clientId: selectedClient?.id || "",
                          clientName: `${selectedClient?.name || ""} ${selectedClient?.surname || ""}`,
                          phone: selectedClient?.phone || "",
                          plate: vehiclePlate || selectedClient?.plate || "",
                          model: vehicleBrand || form.getValues("model") || selectedClient?.model || "",
                          quoteId: form.getValues("quoteId") || "",
                          date: dateValue || format(new Date(), "yyyy-MM-dd"),
                          time: timeToSave,
                          duration: finalDuration,
                          quoteLaborHours: finalDuration, // Mantieni sempre sincronizzato con duration
                          services: appointment?.services || [],
                          notes: notesWithBrand,
                          status: form.getValues("status") || "programmato",
                          // Usiamo direttamente il valore, senza condizionali che potrebbero convertirlo in false
                          partsOrdered: partsOrderedValue
                        };
                        
                        // AGGIUNTO: Controllo esplicito per il valore di partsOrdered nei dati che saranno inviati
                        const formDataPartsOrdered = formData.partsOrdered;
                        console.log(`CONTROLLO FINALE - partsOrdered nei dati da inviare:`, {
                          valore: formDataPartsOrdered,
                          tipo: typeof formDataPartsOrdered,
                          booleano: formDataPartsOrdered === true ? 'true' : 'false'
                        });
                        
                        // Stampa di debug per verificare il valore della durata e di parts ordered
                        console.log("DEBUG - Dati finali da inviare:", {
                          quoteHours: quoteLaborHours,
                          formDuration: durationValue,
                          finalDuration: formData.duration,
                          partsOrdered: formData.partsOrdered
                        });
                        
                        console.log("Dati appuntamento completi:", formData);
                        
                        if (appointment?.id) {
                          // Aggiornamento di un appuntamento esistente
                          console.log(`Aggiornamento dell'appuntamento ${appointment.id} in corso...`);
                        }
                        
                        await onSubmit(formData);
                        
                        // Aggiungo un controllo esplicito per forzare la chiusura della maschera
                        try {
                          console.log("DEBUG - Forzo la chiusura del dialog dopo submit");
                          setTimeout(() => {
                            if (onSuccess) onSuccess();
                            onClose();
                          }, 300);
                        } catch (error) {
                          console.error("Errore nella chiusura forzata del dialog:", error);
                        }
                      }}
                      disabled={isSubmitting || !selectedClient}
                      className="gap-2 bg-primary"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Salvataggio in corso...
                        </>
                      ) : (
                        <>
                          <CalendarIcon2 className="h-4 w-4" />
                          {appointment ? "Aggiorna" : "Fine"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}