import React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, isBefore, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { XCircle, FileText, Check, ArrowRight, Plus, Trash2, CalendarIcon, Calendar as CalendarIcon2, SearchIcon, Clock, Edit, ChevronLeft, ChevronRight } from "lucide-react";
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
  updateQuote,
  updateClient
} from "@shared/supabase";
import { 
  Appointment, 
  Client, 
  Quote, 
  CreateAppointmentInput, 
  createAppointmentSchema,
  SparePart
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
  defaultClientId?: string;
}

// Tipo personalizzato per il form che risolve il conflitto di tipizzazione
type AppointmentFormData = Omit<CreateAppointmentInput, 'spareParts'> & {
  spareParts?: Array<Omit<SparePart, 'category'> & { category: string }>;
};

// Funzione per aggiungere ore a un orario
const addHoursToTime = (time: string, hours: number): string => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m);
  date.setHours(date.getHours() + hours);
  return format(date, 'HH:mm');
};

export default function AppointmentForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment,
  selectedDate,
  onEditQuote,
  onCreateQuote,
  defaultQuote,
  defaultClientId
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
  // console.log("DEBUG STATUS:", appointment?.status, "->", statusValue, "form.watch:", appointment?.status);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(createAppointmentSchema) as any,
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
      model: appointment?.model || "",
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
      // Gestione per appuntamento esistente
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
      // Gestione per defaultQuote (nuovo appuntamento con cliente preselezionato)
      else if (defaultQuote?.clientId && !selectedClient) {
        try {
          const client = await getClientById(defaultQuote.clientId);
          if (client) {
            setSelectedClient(client);
            form.setValue("clientId", client.id);
            form.setValue("clientName", `${client.name} ${client.surname}`);
            form.setValue("phone", client.phone || "");
            form.setValue("plate", client.plate || "");
            
            // Imposta la targa del veicolo
            if (client.plate) {
              setVehiclePlate(client.plate);
            }
            
            // Se c'è un modello associato, impostalo nel form
            if (client.model) {
              form.setValue("model", client.model);
            }
            
            // Passa automaticamente allo step 2 (preventivi) se il cliente è preselezionato
            setCurrentStep(2);
          }
        } catch (error) {
          console.error("Errore nel caricamento del cliente dal defaultQuote:", error);
        }
      }
      // Gestione per defaultClientId (cliente preselezionato dopo creazione preventivo)
      else if (defaultClientId && !selectedClient) {
        try {
          const client = await getClientById(defaultClientId);
          if (client) {
            setSelectedClient(client);
            form.setValue("clientId", client.id);
            form.setValue("clientName", `${client.name} ${client.surname}`);
            form.setValue("phone", client.phone || "");
            form.setValue("plate", client.plate || "");
            
            // Imposta la targa del veicolo
            if (client.plate) {
              setVehiclePlate(client.plate);
            }
            
            // Se c'è un modello associato, impostalo nel form
            if (client.model) {
              form.setValue("model", client.model);
            }
            
            // Passa automaticamente allo step 2 (preventivi) se il cliente è preselezionato
            setCurrentStep(2);
          }
        } catch (error) {
          console.error("Errore nel caricamento del cliente dal defaultClientId:", error);
        }
      }
    };
    
    if (isOpen) {
      loadClientData();
    }
  }, [isOpen, appointment, defaultQuote, form, selectedClient, defaultClientId]);
  
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
      (client.name || "").toLowerCase().includes(query) || 
      (client.surname || "").toLowerCase().includes(query) || 
      (client.phone || "").toLowerCase().includes(query) || 
      (client.plate || "").toLowerCase().includes(query)
    );
  }, [searchQuery, clients]);
  
  const handleSelectClient = (client: Client, goToNextStep = false) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    
    // Non impostiamo più automaticamente la targa
    // Lasciamo che l'utente scelga dal menu a tendina
    
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
    // Se il preventivo ha il totale a 0 ma ha subtotali validi, ricalcola il totale
    if ((!quote.totalPrice || quote.totalPrice === 0) && (!quote.total || quote.total === 0) && 
        (((quote as any).laborTotal > 0 || (quote as any).partsSubtotal > 0))) {
      
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
    }
    
    setSelectedQuote(quote);
    form.setValue("quoteId", quote.id);
    
    // Se il preventivo ha ore di manodopera, imposta la durata dell'appuntamento
    if (quote.laborHours && quote.laborHours > 0) {
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
    if (!onEditQuote) {
      console.error("onEditQuote non è definita!");
      toast({
        title: "Errore",
        description: "Funzione di modifica preventivo non disponibile",
        variant: "destructive",
      });
      return;
    }
    
    // REGOLA: Se il preventivo è accettato e l'appuntamento è in lavorazione, non permettere la modifica
    if (quote.status === "accettato" && appointment?.status === "in_lavorazione") {
      toast({
        title: "Modifica non consentita",
        description: "Non è possibile modificare un preventivo quando l'appuntamento è in lavorazione.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Chiudi il modal dell'appuntamento per evitare conflitti di z-index
      onClose();
      
      // Apri il form di modifica preventivo dopo un breve delay
      setTimeout(() => {
        onEditQuote(quote);
      }, 200);
      
    } catch (error) {
      console.error("Errore nella modifica del preventivo:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'apertura del form di modifica",
        variant: "destructive",
      });
    }
  };
  
  const handleCreateNewQuote = () => {
    if (onCreateQuote && selectedClient) {
      // Chiudi temporaneamente il modal dell'appuntamento per evitare conflitti di z-index
      onClose();
      
      // Apri il form del preventivo dopo un breve delay
      setTimeout(() => {
        onCreateQuote(selectedClient.id);
      }, 200);
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
  const onSubmit = async (data: AppointmentFormData) => {
    setIsSubmitting(true);
    
    try {
      // Verifica che ci sia un preventivo selezionato
      if (!selectedQuote) {
        toast({
          title: "Preventivo richiesto",
          description: "È necessario selezionare un preventivo per creare l'appuntamento",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Imposta lo stato del preventivo a "accettato" quando si salva l'appuntamento
      if (selectedQuote.status !== "accettato") {
        try {
          // FIX FIREFOX: Gestione specifica per Firefox con retry
          if (navigator.userAgent.includes('Firefox')) {
            // Primo tentativo
            let updateSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!updateSuccess && retryCount < maxRetries) {
              try {
                await updateQuote(selectedQuote.id, { status: "accettato" });
                
                // Aspetta un momento e verifica che l'aggiornamento sia andato a buon fine
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Verifica lo stato del preventivo
                const updatedQuote = await getQuoteById(selectedQuote.id);
                if (updatedQuote && updatedQuote.status === "accettato") {
                  updateSuccess = true;
                } else {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              } catch (retryError) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
            
            if (!updateSuccess) {
              throw new Error("Fallito aggiornamento preventivo dopo " + maxRetries + " tentativi");
            }
            
          } else {
            // Per tutti gli altri browser, comportamento normale
            await updateQuote(selectedQuote.id, { status: "accettato" });
          }
          
          toast({
            title: "Preventivo accettato",
            description: "Lo stato del preventivo è stato aggiornato in 'Accettato'.",
          });
        } catch (error) {
          console.error("❌ Errore nell'aggiornamento dello stato del preventivo:", error);
          
          // FIX FIREFOX: Messaggio di errore più specifico
          if (navigator.userAgent.includes('Firefox')) {
            toast({
              title: "Errore Firefox",
              description: "Problema nell'aggiornamento del preventivo. L'appuntamento sarà creato ma controlla manualmente lo stato del preventivo.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Errore",
              description: "Non è stato possibile aggiornare lo stato del preventivo.",
              variant: "destructive",
            });
          }
          
          // Non bloccare la creazione dell'appuntamento, ma segnala il problema
          console.warn("⚠️ Continuando con la creazione dell'appuntamento nonostante l'errore del preventivo");
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
      // dato che ora abbiamo sempre un preventivo associato
      const quoteLaborHoursValue = durationValue;
      
      // Rimappa i dati per adattarli al formato dell'appuntamento
      const appointmentData: Partial<Appointment> = {
        clientId: selectedClient?.id || data.clientId,
        clientName: selectedClient ? `${selectedClient.name} ${selectedClient.surname}` : data.clientName,
        phone: selectedClient?.phone || data.phone || "",
        plate: selectedClient?.plate || data.plate || "",
        model: selectedClient?.model || data.model || "",
        date: formatAppointmentDate(data.date),
        time: formatAppointmentTime(data.time),
        duration: durationValue,
        quoteId: selectedQuote.id, // Ora sempre presente
        quoteLaborHours: quoteLaborHoursValue, // Sempre sincronizzato con duration
        partsOrdered: data.partsOrdered === null ? undefined : data.partsOrdered,
        services: data.services || [],
        notes: data.notes || "",
        status: data.status || "programmato",
      };
      
      let savedId;
      
      // Aggiorna o crea un nuovo appuntamento
      if (appointment?.id) {
        // Salvataggio sincronizzato e completo per assicurarsi che i dati siano persistiti
        await updateAppointment(appointment.id, appointmentData);
        savedId = appointment.id;
        
        toast({
          title: "Appuntamento aggiornato",
          description: "L'appuntamento è stato aggiornato con successo.",
        });
        
        // Chiama onSuccess per gestire l'aggiornamento della lista
        if (onSuccess) onSuccess();
      } else {
        // Creazione nuovo appuntamento
        const newAppointment = await createAppointment(appointmentData as Appointment);
        savedId = newAppointment.id;
        
        toast({
          title: "Appuntamento creato",
          description: "L'appuntamento è stato creato con successo.",
        });
        
        // Chiama onSuccess per gestire l'aggiornamento della lista
        if (onSuccess) onSuccess();
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
        model: appointment?.model || "",
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
        <DialogContent className="w-full max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden border border-gray-700 bg-gray-900 text-white">
          <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex flex-col items-center text-center">
              <DialogTitle className="text-lg md:text-xl font-bold mb-2 flex items-center gap-2 text-orange-500">
                <CalendarIcon2 className="h-5 w-5 md:h-6 md:w-6" />
                {appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base text-gray-400">
                {currentStep === 1 ? "Inserisci i dati del cliente" :
                 currentStep === 2 ? "Seleziona un preventivo" :
                 "Dettagli dell'appuntamento"}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          {/* Form con pulsanti di navigazione separati */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 md:py-6">
              <Form {...form}>
                <form 
                  className="space-y-4 md:space-y-6" 
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
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-sm md:text-base font-semibold flex items-center text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          Cliente
                        </h2>
                      </div>
                      
                      {selectedClient ? (
                        <div className="flex items-center justify-between p-4 md:p-5 rounded-lg bg-gradient-to-r from-orange-500/10 to-orange-600/5 border-2 border-orange-400/30 shadow-lg backdrop-blur-sm">
                          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                            <div className="bg-orange-500/20 rounded-full p-3 text-orange-400 border border-orange-500/30 flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-base md:text-lg text-white mb-2 truncate">{selectedClient.name} {selectedClient.surname}</h3>
                              <div className="flex flex-col gap-2">
                                <span className="text-sm flex items-center text-gray-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span className="truncate">{selectedClient.phone}</span>
                                </span>
                                <span className="text-sm flex items-center text-gray-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  <span className="font-semibold bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full border border-orange-500/30 text-sm">
                                    {selectedClient.plate}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-full flex-shrink-0 ml-2"
                            onClick={handleClearSelectedClient}
                          >
                            <XCircle className="h-5 w-5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3 flex-1">
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
                              className="w-full border-orange-400/30 focus-visible:ring-orange-400/50 h-11 text-base px-4 bg-gray-900/50 text-white placeholder-gray-400"
                              autoComplete="off"
                            />
                            
                            {isSearching && filteredClients.length > 0 && (
                              <div className="absolute z-10 w-full mt-2 bg-gray-900/95 shadow-2xl rounded-lg border border-orange-500/30 overflow-hidden backdrop-blur-sm">
                                <div 
                                  className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-600"
                                >
                                  <div className="p-2">
                                    {filteredClients.map((client, index) => (
                                      <div
                                        key={client.id}
                                        className={cn(
                                          "relative p-4 rounded-lg cursor-pointer mb-2 transition-colors duration-150 border",
                                          selectedIndex === index 
                                            ? "bg-orange-500/15 border-orange-400/50 shadow-md" 
                                            : "bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/60 hover:border-orange-500/30"
                                        )}
                                        onClick={() => handleSelectClient(client, true)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                      >
                                        {/* Header con nome e badge stato */}
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-black font-bold text-base">
                                              {(client.name || "").charAt(0)}{(client.surname || "").charAt(0)}
                                            </div>
                                            <div>
                                              <h3 className="font-bold text-base text-white leading-tight">
                                                {client.name || ""} {client.surname || ""}
                                              </h3>
                                              <div className="text-sm text-gray-400">Cliente</div>
                                            </div>
                                          </div>
                                          
                                          {selectedIndex === index && (
                                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Info grid */}
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                          <div className="flex items-center gap-2 bg-gray-800/70 rounded-lg px-2 py-1.5">
                                            <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <span className="text-xs text-orange-300 font-medium truncate">{client.phone}</span>
                                          </div>
                                          
                                          {client.plate && (
                                            <div className="flex items-center gap-2 bg-gray-800/70 rounded-lg px-2 py-1.5">
                                              <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                              </svg>
                                              <span className="text-xs text-orange-300 font-bold">{client.plate}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {isSearching && searchQuery && filteredClients.length === 0 && (
                              <div className="absolute z-10 w-full mt-2 bg-gray-900/95 shadow-2xl rounded-lg border border-orange-500/30 p-6 text-center backdrop-blur-sm">
                                <p className="text-gray-300 text-base mb-2">Nessun cliente trovato</p>
                                <p className="text-gray-500 text-sm">Prova con un termine di ricerca diverso</p>
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
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-sm md:text-base font-semibold flex items-center text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Preventivo
                        </h2>
                      </div>
                      
                      <div className="space-y-3 md:space-y-4 flex-1">
                        {/* Preventivi disponibili */}
                        {selectedClient && (
                          <div className="space-y-2 md:space-y-3">
                            <div className="text-xs md:text-sm font-medium text-gray-300">
                              Preventivi disponibili per <span className="text-orange-400 font-bold">{selectedClient.name} {selectedClient.surname}</span>:
                            </div>
                            
                            {isLoadingQuotes ? (
                              <div className="space-y-2">
                                <Skeleton className="h-16 md:h-20 w-full bg-gray-800/50" />
                                <Skeleton className="h-16 md:h-20 w-full bg-gray-800/50" />
                              </div>
                            ) : clientQuotes.length > 0 ? (
                              <div className="space-y-2 md:space-y-3">
                                {clientQuotes.map((quote) => (
                                  <div 
                                    key={quote.id}
                                    className={cn(
                                      "flex items-center justify-between p-3 md:p-4 rounded-lg border cursor-pointer transition-colors duration-150",
                                      selectedQuote?.id === quote.id 
                                        ? "bg-orange-500/15 border-orange-400/50 shadow-md" 
                                        : "bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/60 hover:border-orange-500/30"
                                    )}
                                    onClick={() => handleSelectQuote(quote)}
                                  >
                                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                      {/* Avatar con ID */}
                                      <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-full flex items-center justify-center text-black font-bold text-xs md:text-sm">
                                        {quote.id.slice(-2)}
                                      </div>
                                      
                                      {/* Info principali */}
                                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                        <div className="font-bold text-xs md:text-sm text-white">
                                          ID: {quote.id}
                                        </div>
                                        
                                        <Badge 
                                          variant={
                                            quote.status === "accettato" ? "default" :
                                            quote.status === "inviato" ? "secondary" :
                                            quote.status === "bozza" ? "outline" :
                                            "destructive"
                                          }
                                          className="text-xs px-2 py-0.5 flex-shrink-0"
                                        >
                                          {quote.status}
                                        </Badge>
                                        
                                        <span className="text-xs text-orange-300 font-medium flex-shrink-0">
                                          {quote.date}
                                        </span>
                                        
                                        <span className="text-green-400 font-bold text-sm md:text-base flex-shrink-0">
                                          €{quote.totalPrice || quote.total || 0}
                                        </span>
                                        
                                        {quote.laborHours && quote.laborHours > 0 && (
                                          <span className="text-orange-300 font-medium text-xs flex-shrink-0">
                                            {quote.laborHours}h
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Azioni */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 md:h-8 md:w-8 p-0 rounded-full text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                        title="Modifica preventivo"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditQuote(quote);
                                        }}
                                      >
                                        <Edit className="h-3 w-3 md:h-4 md:w-4" />
                                      </Button>
                                      
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 md:h-8 md:w-8 p-0 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        title="Elimina preventivo"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm("Sei sicuro di voler eliminare questo preventivo?")) {
                                            if (onEditQuote) {
                                              onClose();
                                              setTimeout(() => {
                                                const quoteToDelete = {...quote, _delete: true};
                                                onEditQuote(quoteToDelete);
                                              }, 200);
                                            }
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                                      </Button>
                                      
                                      {selectedQuote?.id === quote.id && (
                                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                          <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                
                                <div className="mt-3 md:mt-4 flex justify-center">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 px-3 md:px-4 py-2 text-xs md:text-sm"
                                    onClick={handleCreateNewQuote}
                                  >
                                    <Plus className="h-3 w-3 md:h-4 md:w-4" />
                                    Crea nuovo preventivo
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="border border-gray-700/50 rounded-lg md:rounded-xl bg-gray-900/30 p-4 md:p-6 text-center text-gray-300 backdrop-blur-sm">
                                <p className="mb-3 text-sm md:text-base">Nessun preventivo disponibile per questo cliente.</p>
                                {onCreateQuote && (
                                  <Button 
                                    variant="default" 
                                    className="gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 md:px-4 py-2 text-xs md:text-sm"
                                    onClick={handleCreateNewQuote}
                                  >
                                    <Plus className="h-3 w-3 md:h-4 md:w-4" />
                                    Crea il primo preventivo
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
                            render={({ field }) => {
                              const [calendarDate, setCalendarDate] = useState(field.value ? new Date(field.value) : new Date());
                              const [showCalendar, setShowCalendar] = useState(false);
                              const calendarRef = useRef<HTMLDivElement>(null);
                              
                              const monthStart = startOfMonth(calendarDate);
                              const monthEnd = endOfMonth(calendarDate);
                              const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                              
                              const today = startOfDay(new Date());
                              
                              // Chiudi calendario quando si clicca fuori
                              useEffect(() => {
                                const handleClickOutside = (event: MouseEvent) => {
                                  if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                                    setShowCalendar(false);
                                  }
                                };
                                
                                if (showCalendar) {
                                  document.addEventListener('mousedown', handleClickOutside);
                                  return () => document.removeEventListener('mousedown', handleClickOutside);
                                }
                              }, [showCalendar]);
                              
                              return (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">
                                    Data
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative" ref={calendarRef}>
                                      <Input
                                        type="text"
                                        readOnly
                                        className="border-orange-300 focus-visible:ring-orange-400 focus-visible:border-orange-500 h-9 text-sm font-medium cursor-pointer hover:border-orange-400 transition-colors duration-200"
                                        value={field.value ? format(new Date(field.value), "dd/MM/yyyy", { locale: it }) : ""}
                                        placeholder="Seleziona una data"
                                        onClick={() => setShowCalendar(!showCalendar)}
                                      />
                                      <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-orange-600 pointer-events-none" />
                                      
                                      {showCalendar && (
                                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 z-50 min-w-[280px]">
                                          {/* Header calendario */}
                                          <div className="flex items-center justify-between mb-4 bg-gray-900 rounded-md py-2 px-3">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                                              className="h-8 w-8 p-0 text-orange-500 hover:text-orange-400 hover:bg-gray-800"
                                            >
                                              <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            
                                            <h3 className="text-sm font-bold text-orange-500">
                                              {format(calendarDate, "MMMM yyyy", { locale: it })}
                                            </h3>
                                            
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                                              className="h-8 w-8 p-0 text-orange-500 hover:text-orange-400 hover:bg-gray-800"
                                            >
                                              <ChevronRight className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          
                                          {/* Giorni della settimana */}
                                          <div className="grid grid-cols-7 gap-1 mb-2">
                                            {['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'].map((day) => (
                                              <div key={day} className="text-center text-xs font-bold text-orange-400 p-2">
                                                {day}
                                              </div>
                                            ))}
                                          </div>
                                          
                                          {/* Griglia giorni */}
                                          <div className="grid grid-cols-7 gap-1">
                                            {/* Placeholder per i giorni vuoti prima del primo giorno del mese */}
                                            {Array.from({ length: (monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1) }).map((_, i) => (
                                              <div key={`empty-${i}`} />
                                            ))}
                                            {daysInMonth.map((day) => {
                                              const isSelected = field.value && isSameDay(day, new Date(field.value));
                                              const isTodayDate = isToday(day);
                                              const isPast = isBefore(day, today);
                                              
                                              return (
                                                <Button
                                                  key={day.toISOString()}
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  disabled={isPast}
                                                  onClick={() => {
                                                    if (!isPast) {
                                                      field.onChange(format(day, "yyyy-MM-dd"));
                                                      setShowCalendar(false);
                                                    }
                                                  }}
                                                  className={cn(
                                                    "h-8 w-8 p-0 text-sm font-medium transition-all duration-200",
                                                    isSelected && "bg-orange-500 text-black hover:bg-orange-600 border-2 border-orange-600 font-bold",
                                                    isTodayDate && !isSelected && "bg-orange-200 text-black border border-orange-400 font-bold",
                                                    isPast && "text-gray-600 cursor-not-allowed hover:bg-transparent",
                                                    !isSelected && !isTodayDate && !isPast && "text-orange-300 hover:bg-gray-800 hover:text-orange-400",
                                                    !isSameMonth(day, calendarDate) && "text-gray-700"
                                                  )}
                                                >
                                                  {format(day, "d")}
                                                </Button>
                                              );
                                            })}
                                          </div>
                                          
                                          {/* Footer con pulsanti */}
                                          <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-700">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                field.onChange("");
                                                setShowCalendar(false);
                                              }}
                                              className="text-xs text-orange-300 hover:bg-gray-800 hover:text-orange-400 font-medium px-3"
                                            >
                                              Cancella
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                field.onChange(format(new Date(), "yyyy-MM-dd"));
                                                setShowCalendar(false);
                                              }}
                                              className="text-xs text-orange-500 hover:bg-gray-800 hover:text-orange-400 font-bold px-3"
                                            >
                                              Oggi
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
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
                                  <Input
                                    type="time"
                                    className="border-primary/20 focus-visible:ring-primary/30 h-9 text-sm font-medium"
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      field.onChange(e.target.value);
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
                          
                          name="Appuntamenti Occupati"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Appuntamenti Occupati
                              </FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  {allAppointments
                                    .filter(app => 
                                      app.date === form.watch('date') && 
                                      app.id !== appointment?.id
                                    )
                                    .map(app => (
                                      <div 
                                        key={app.id}
                                        className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="bg-primary/10 p-1.5 rounded-full">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                          </div>
                                          <div>
                                            <div className="font-medium text-sm">{app.clientName}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {app.time} - {addHoursToTime(app.time, app.duration)} • {app.duration}h 
                                            </div>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className={cn(
                                          "text-xs",
                                          app.status === "programmato" && "bg-blue-100 text-blue-800 border-blue-300",
                                          app.status === "in_lavorazione" && "bg-yellow-100 text-yellow-800 border-yellow-300",
                                          app.status === "completato" && "bg-green-100 text-green-800 border-green-300",
                                          app.status === "annullato" && "bg-red-100 text-red-800 border-red-300"
                                        )}>
                                          {app.status === "programmato" && "Confermato"}
                                          {app.status === "in_lavorazione" && "In Lavorazione"}
                                          {app.status === "completato" && "Completato"}
                                          {app.status === "annullato" && "Annullato"}
                                        </Badge>
                                      </div>
                                    ))}
                                  {allAppointments.filter(app => 
                                    app.date === form.watch('date') && 
                                    app.id !== appointment?.id
                                  ).length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-2">
                                      Nessun appuntamento programmato per questa data
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
            <DialogFooter className="px-4 md:px-6 py-4 md:py-5 border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm sticky bottom-0 z-10">
              <div className="flex w-full justify-between items-center gap-3">
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    size="sm"
                    className="gap-2 text-sm px-4 py-2 h-9 border-gray-600 hover:bg-gray-800"
                  >
                    <XCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Annulla</span>
                    <span className="sm:hidden">✕</span>
                  </Button>
                  
                  {/* Pulsante Elimina (visibile solo quando si modifica un appuntamento esistente) */}
                  {appointment && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAppointment}
                      className="gap-2 text-sm px-4 py-2 h-9"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Elimina</span>
                      <span className="sm:hidden">🗑</span>
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
                      className="gap-2 border-primary/20 text-primary hover:bg-primary/5 text-sm px-4 py-2 h-9"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span className="hidden sm:inline">Indietro</span>
                      <span className="sm:hidden">←</span>
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
                        if (currentStep === 2 && !selectedQuote) {
                          toast({
                            title: "Selezione preventivo richiesta",
                            description: "Seleziona un preventivo esistente o crea un nuovo preventivo",
                            variant: "destructive",
                          });
                          return;
                        }
                        setCurrentStep(prev => prev + 1);
                      }}
                      className="gap-2 bg-primary hover:bg-primary/90 text-sm px-4 py-2 h-9"
                    >
                      <span className="hidden sm:inline">
                        {currentStep === 1 ? "Avanti" : 
                         currentStep === 2 ? "Aggiungi dettagli" : "Avanti"}
                      </span>
                      <span className="sm:hidden">
                        {currentStep === 1 ? "→" : 
                         currentStep === 2 ? "📝" : "→"}
                      </span>
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
                          // Usa la durata dal preventivo se è disponibile
                          finalDuration = quoteLaborHours;
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
                        
                        await onSubmit(formData);
                      }}
                      disabled={isSubmitting || !selectedClient}
                      className="gap-2 bg-primary hover:bg-primary/90 text-sm px-4 py-2 h-9"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="hidden sm:inline">Salvataggio...</span>
                          <span className="sm:hidden">💾</span>
                        </>
                      ) : (
                        <>
                          <CalendarIcon2 className="h-4 w-4" />
                          <span className="hidden sm:inline">{appointment ? "Aggiorna" : "Fine"}</span>
                          <span className="sm:hidden">{appointment ? "✓" : "📅"}</span>
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