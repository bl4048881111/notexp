import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Appointment, CreateAppointmentInput, Client, Quote } from "@shared/schema";
import { createAppointmentSchema } from "@shared/schema";
import { createAppointment, updateAppointment, deleteAppointment, getAllClients, getClientById, getQuotesByClientId } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { XCircle, FileText, Calendar, Check, ArrowRight, Plus, Trash2 } from "lucide-react";

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

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: Appointment | null;
  selectedDate?: string | null;
  onEditQuote?: (quote: Quote) => void;
  onCreateQuote?: (clientId: string) => void;
}

export default function AppointmentForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment, 
  selectedDate,
  onEditQuote,
  onCreateQuote
}: AppointmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [currentStep, setCurrentStep] = useState(1); // Step 1: Cliente, Step 2: Preventivo, Step 3: Data e Note
  const { toast } = useToast();
  
  // Fetch clients for autocomplete
  const { data: clients = [] } = useQuery({ 
    queryKey: ['/api/clients'],
    queryFn: getAllClients,
  });
  
  // Fetch quotes for selected client
  const { data: clientQuotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['/api/quotes', selectedClient?.id],
    queryFn: () => selectedClient ? getQuotesByClientId(selectedClient.id) : Promise.resolve([]),
    enabled: !!selectedClient,
  });
  
  // Filter clients based on search query - CASE SENSITIVE
  const filteredClients = useMemo(() => {
    if (!searchQuery) return [];
    
    const query = searchQuery.toLowerCase();
    return clients.filter(client => {
      const fullName = `${client.name} ${client.surname}`.toLowerCase();
      const plate = client.plate.toLowerCase();
      const model = client.model.toLowerCase();
      // Case insensitive search
      return fullName.includes(query) || 
        client.phone.includes(query) || 
        plate.includes(query) ||
        model.includes(query);
    }).slice(0, 5); // Limitiamo i risultati a 5 per una migliore usabilità
  }, [clients, searchQuery]);
  
  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      clientId: "",
      clientName: "",
      phone: "",
      plate: "",
      model: "",
      date: selectedDate || format(new Date(), 'dd/MM/yyyy'),
      time: "09:00",
      duration: 60,
      services: [],
      notes: "",
      status: "programmato",
    }
  });
  
  // Set form values when editing an appointment
  useEffect(() => {
    if (appointment) {
      const { id, ...appointmentData } = appointment;
      
      // Se la data è nel formato yyyy-MM-dd, la convertiamo in dd/MM/yyyy per la visualizzazione
      if (appointmentData.date && appointmentData.date.includes('-')) {
        const [year, month, day] = appointmentData.date.split('-');
        appointmentData.date = `${day}/${month}/${year}`;
      }
      
      form.reset(appointmentData);
      
      // Quando si modifica un appuntamento, andiamo direttamente allo step 3 (data e note)
      setCurrentStep(3);
      
      // Fetch client data for the appointment
      getClientById(appointmentData.clientId).then(client => {
        if (client) {
          setSelectedClient(client);
        }
      });
    } else if (selectedDate) {
      // Se è presente una data selezionata dal calendario, la settiamo nel form
      // Controlliamo se è nel formato yyyy-MM-ddTHH:mm (con l'ora)
      if (selectedDate.includes('T')) {
        const [date, time] = selectedDate.split('T');
        
        // Convertiamo la data dal formato ISO al formato italiano
        if (date.includes('-')) {
          const [year, month, day] = date.split('-');
          form.setValue("date", `${day}/${month}/${year}`);
        } else {
          form.setValue("date", date);
        }
        
        form.setValue("time", time);
      } else if (selectedDate.includes('-')) {
        // Convertiamo la data dal formato ISO al formato italiano
        const [year, month, day] = selectedDate.split('-');
        form.setValue("date", `${day}/${month}/${year}`);
      } else {
        form.setValue("date", selectedDate);
      }
    }
  }, [appointment, form, selectedDate]);
  
  // Quando viene selezionato un preventivo, prendiamo i servizi
  useEffect(() => {
    if (selectedQuote) {
      // Estraiamo i servizi dal preventivo
      const quoteServices = selectedQuote.items.map(item => item.serviceType.name);
      form.setValue("services", quoteServices);
    } else {
      form.setValue("services", []);
    }
  }, [selectedQuote, form]);
  
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    form.setValue("plate", client.plate);
    form.setValue("model", client.model);
    setSearchQuery(`${client.name} ${client.surname}`);
    setIsSearching(false);
  };
  
  const handleClearSelectedClient = () => {
    setSelectedClient(null);
    setSelectedQuote(null);
    form.setValue("clientId", "");
    form.setValue("clientName", "");
    form.setValue("phone", "");
    form.setValue("plate", "");
    form.setValue("model", "");
    form.setValue("services", []);
    setSearchQuery("");
  };
  
  const handleSelectQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    // Dopo aver selezionato il preventivo, avanziamo automaticamente allo step successivo
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, 100);
  };
  
  const handleCreateNewQuote = () => {
    if (selectedClient && onCreateQuote) {
      onCreateQuote(selectedClient.id);
      onClose();
    }
  };
  
  const handleEditQuote = (quote: Quote) => {
    if (onEditQuote) {
      onEditQuote(quote);
      onClose();
    }
  };
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const handleDeleteAppointment = async () => {
    if (!appointment) return;
    
    // Mostro il dialog personalizzato invece del confirm() predefinito
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = async () => {
    if (!appointment) return;
    
    setIsSubmitting(true);
    setShowDeleteConfirm(false);
    
    try {
      await deleteAppointment(appointment.id);
      toast({
        title: "Appuntamento eliminato",
        description: "L'appuntamento è stato eliminato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'appuntamento:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione dell'appuntamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const onSubmit = async (data: CreateAppointmentInput) => {
    if (!selectedClient) {
      toast({
        title: "Errore",
        description: "Seleziona un cliente per continuare",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Convertiamo la data dal formato italiano (dd/MM/yyyy) al formato ISO (yyyy-MM-dd)
      if (data.date && data.date.includes('/')) {
        const [day, month, year] = data.date.split('/');
        data.date = `${year}-${month}-${day}`;
      }
      
      if (appointment) {
        // Update existing appointment
        await updateAppointment(appointment.id, data);
        toast({
          title: "Appuntamento aggiornato",
          description: "L'appuntamento è stato aggiornato con successo",
        });
      } else {
        // Create new appointment
        await createAppointment(data);
        toast({
          title: "Appuntamento aggiunto",
          description: "Il nuovo appuntamento è stato aggiunto con successo",
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error("Errore durante il salvataggio dell'appuntamento:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio dell'appuntamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Dialog per conferma eliminazione */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Conferma eliminazione
            </DialogTitle>
            <DialogDescription className="text-base">
              Sei sicuro di voler eliminare questo appuntamento? Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Eliminazione in corso...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Dialog principale dell'appuntamento */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
            </DialogTitle>
            <DialogDescription>
              {appointment 
                ? "Modifica i dettagli dell'appuntamento"
                : "Seleziona cliente, preventivo e data dell'appuntamento"
              }
            </DialogDescription>
            
            {/* Indicatore di step */}
            <div className="flex items-center justify-between mt-4 pt-2">
              <div className="flex items-center w-full">
                <div 
                  className={`flex flex-col items-center flex-1 ${currentStep === 1 ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1
                    ${currentStep === 1 
                      ? "bg-primary text-primary-foreground" 
                      : currentStep > 1 
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    1
                  </div>
                  <span className="text-xs">Cliente</span>
                </div>
                
                <div className="flex-1 h-0.5 bg-muted relative">
                  <div 
                    className="absolute top-0 left-0 h-full bg-primary transition-all"
                    style={{ width: currentStep > 1 ? "100%" : "0%" }}
                  />
                </div>
                
                <div 
                  className={`flex flex-col items-center flex-1 ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1
                    ${currentStep === 2 
                      ? "bg-primary text-primary-foreground" 
                      : currentStep > 2 
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    2
                  </div>
                  <span className="text-xs">Preventivo</span>
                </div>
                
                <div className="flex-1 h-0.5 bg-muted relative">
                  <div 
                    className="absolute top-0 left-0 h-full bg-primary transition-all"
                    style={{ width: currentStep > 2 ? "100%" : "0%" }}
                  />
                </div>
                
                <div 
                  className={`flex flex-col items-center flex-1 ${currentStep === 3 ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1
                    ${currentStep === 3 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                    }`}
                  >
                    3
                  </div>
                  <span className="text-xs">Data e Note</span>
                </div>
              </div>
            </div>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Cliente */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center">
                      <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm font-bold">1</div>
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
                          <h3 className="font-bold text-lg text-foreground">{selectedClient.name} {selectedClient.surname}</h3>
                          <div className="flex items-center gap-4 mt-1.5">
                            <span className="text-sm flex items-center text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-primary/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {selectedClient.phone}
                            </span>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-sm font-medium rounded-md">
                              <span className="font-bold">{selectedClient.plate}</span>
                              <span className="text-xs mx-1">|</span>
                              <span>{selectedClient.model}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleClearSelectedClient}
                        className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        <span>Cambia</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="relative">
                          <div className="relative rounded-lg shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <Input
                              placeholder="Cerca cliente per nome, targa o telefono..."
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsSearching(e.target.value.length > 0);
                                setSelectedIndex(-1); // Reset selected index when typing
                              }}
                              onKeyDown={(e) => {
                                if (isSearching && filteredClients.length > 0) {
                                  // Freccia giù
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSelectedIndex(prev => 
                                      prev < filteredClients.length - 1 ? prev + 1 : prev
                                    );
                                  }
                                  // Freccia su
                                  else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
                                  }
                                  // Invio per selezionare
                                  else if (e.key === 'Enter' && selectedIndex >= 0) {
                                    e.preventDefault();
                                    handleSelectClient(filteredClients[selectedIndex]);
                                  }
                                  // Esc per chiudere
                                  else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setIsSearching(false);
                                  }
                                }
                              }}
                              className="pl-11 py-6 text-lg border-2 border-primary/40 focus-visible:ring-primary/60 bg-primary/5 text-foreground font-medium rounded-lg"
                            />
                          </div>
                          
                          {isSearching && (
                            <div className="absolute top-full mt-2 left-0 right-0 border-2 border-primary/60 rounded-lg bg-background shadow-xl z-10 max-h-[450px] overflow-auto scrollbar-hide">
                              {filteredClients.length === 0 ? (
                                <div className="p-4 text-center text-sm text-foreground">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 13h.01M12 18a6 6 0 100-12 6 6 0 000 12z" />
                                  </svg>
                                  Nessun cliente trovato
                                </div>
                              ) : (
                                <div className="p-3">
                                  {filteredClients.map((client, index) => (
                                    <>
                                      <div
                                        key={client.id}
                                        className={`p-4 cursor-pointer transition-colors ${
                                          index === selectedIndex ? "bg-primary/20 border-2 border-primary" : "hover:bg-primary/5 border border-primary/20"
                                        } rounded-lg mb-2 shadow-sm`}
                                        onClick={() => handleSelectClient(client)}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                            </div>
                                            <div>
                                              <div className="font-bold text-lg text-foreground">{client.name} {client.surname}</div>
                                              <div className="text-sm text-muted-foreground flex items-center mt-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-primary/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                {client.phone}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex flex-col items-end">
                                            <div className="inline-flex items-center bg-primary/15 border border-primary/30 rounded-md px-3 py-1.5 text-primary font-bold">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                              {client.plate}
                                            </div>
                                            <div className="mt-1.5 text-sm font-medium text-foreground">{client.model}</div>
                                          </div>
                                        </div>
                                      </div>
                                      {index < filteredClients.length - 1 && (
                                        <div className="border-t border-primary/10 my-2"></div>
                                      )}
                                    </>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Puoi cercare per nome cliente, numero di telefono o targa
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Step 2: Preventivo */}
              {currentStep === 2 && selectedClient && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center">
                      <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm font-bold">2</div>
                      <FileText className="h-5 w-5 mr-1.5 text-primary" />
                      Preventivo
                    </h2>
                  </div>
                  
                  {isLoadingQuotes ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : clientQuotes.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid gap-2">
                        {clientQuotes.map(quote => (
                          <div 
                            key={quote.id} 
                            className={`p-3 border rounded-md cursor-pointer transition-colors ${
                              selectedQuote?.id === quote.id 
                                ? 'bg-primary/10 border-primary' 
                                : 'hover:bg-accent'
                            }`}
                            onClick={() => handleSelectQuote(quote)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  Preventivo {quote.id}
                                  {selectedQuote?.id === quote.id && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(quote.createdAt), 'dd/MM/yyyy')} - 
                                  {quote.status === "bozza" ? " Bozza" : 
                                    quote.status === "inviato" ? " Inviato" : 
                                    quote.status === "accettato" ? " Accettato" : 
                                    quote.status === "rifiutato" ? " Rifiutato" : 
                                    quote.status === "scaduto" ? " Scaduto" : " Sconosciuto"}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {quote.items.slice(0, 3).map((item, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="outline" 
                                      className="bg-primary/5 text-xs"
                                    >
                                      {item.serviceType.name}
                                    </Badge>
                                  ))}
                                  {quote.items.length > 3 && (
                                    <Badge variant="outline" className="bg-muted text-xs">
                                      +{quote.items.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-lg">{quote.total.toFixed(2)} €</div>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-xs mt-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditQuote(quote);
                                  }}
                                >
                                  Modifica
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full"
                        onClick={handleCreateNewQuote}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crea nuovo preventivo
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-6 border rounded-md">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-muted-foreground">Nessun preventivo trovato per questo cliente</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={handleCreateNewQuote}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crea nuovo preventivo
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Step 3: Data e Note */}
              {currentStep === 3 && selectedClient && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center">
                      <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm font-bold">3</div>
                      <Calendar className="h-5 w-5 mr-1.5 text-primary" />
                      Data e Note
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Data
                          </FormLabel>
                          <FormControl>
                            {/* Il tipo date utilizza il formato ISO (yyyy-MM-dd) internamente */}
                            <Input 
                              type="date" 
                              {...field} 
                              className="border-primary/20 focus-visible:ring-primary/30" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Ora
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              {...field} 
                              className="border-primary/20 focus-visible:ring-primary/30" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Note (opzionale)
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Aggiungi informazioni importanti riguardo l'appuntamento..." 
                            className="resize-none border-primary/20 focus-visible:ring-primary/30 min-h-[80px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              {/* Pulsanti di navigazione */}
              <DialogFooter className="pt-4 border-t mt-6">
                <div className="flex w-full justify-between">
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={onClose}
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
                        onClick={() => {
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
                        Avanti
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      /* Pulsante Fine (visibile solo nell'ultimo step) */
                      <Button 
                        type="submit" 
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
                            <Calendar className="h-4 w-4" />
                            {appointment ? "Aggiorna" : "Fine"}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}