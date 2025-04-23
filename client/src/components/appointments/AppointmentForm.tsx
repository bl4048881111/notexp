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
import { XCircle, FileText, Check, ArrowRight, Plus, Trash2, CalendarIcon, Calendar as CalendarIcon2 } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Calendar } from "@/components/ui/calendar";

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
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      clientId: appointment?.clientId || "",
      quoteId: appointment?.quoteId || "",
      date: appointment?.date || selectedDate || "",
      time: appointment?.time || "09:00",
      notes: appointment?.notes || "",
      status: appointment?.status || "programmato",
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
  
  // Quando viene aperto il form per modificare un appuntamento esistente, carica i dati del cliente
  useEffect(() => {
    const loadClientData = async () => {
      if (appointment?.clientId) {
        try {
          const client = await getClientById(appointment.clientId);
          if (client) {
            setSelectedClient(client);
            
            // Se l'appuntamento ha un preventivo associato, selezionalo
            if (appointment.quoteId) {
              const quotes = await getQuotesByClientId(client.id);
              const quote = quotes.find(q => q.id === appointment.quoteId);
              if (quote) {
                setSelectedQuote(quote);
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
  }, [isOpen, appointment]);
  
  // Reset dello stato quando si chiude il dialog
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedClient(null);
      setSelectedQuote(null);
      setSearchQuery("");
      setIsSearching(false);
      form.reset();
    }
  }, [isOpen, form]);
  
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
  
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    setIsSearching(false);
    setSearchQuery("");
  };
  
  const handleClearSelectedClient = () => {
    setSelectedClient(null);
    setSelectedQuote(null);
    form.setValue("clientId", "");
    form.setValue("quoteId", "");
  };
  
  const handleSelectQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    form.setValue("quoteId", quote.id);
  };
  
  const handleEditQuote = (quote: Quote) => {
    if (onEditQuote) {
      onEditQuote(quote);
      onClose();
    }
  };
  
  const handleCreateNewQuote = () => {
    if (onCreateQuote && selectedClient) {
      onCreateQuote(selectedClient.id);
      onClose();
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
  
  const onSubmit = async (data: CreateAppointmentInput) => {
    console.log("Iniziando salvataggio appuntamento...", data);
    setIsSubmitting(true);
    
    try {
      if (appointment?.id) {
        // Aggiornamento appuntamento esistente
        console.log("Aggiornando appuntamento con ID:", appointment.id);
        await updateAppointment(appointment.id, data);
        toast({
          title: "Appuntamento aggiornato",
          description: "L'appuntamento è stato aggiornato con successo.",
        });
      } else {
        // Creazione nuovo appuntamento
        console.log("Creando nuovo appuntamento con dati:", data);
        await createAppointment(data);
        toast({
          title: "Appuntamento creato",
          description: "L'appuntamento è stato creato con successo.",
        });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Errore nel salvataggio dell'appuntamento:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio dell'appuntamento.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[600px] w-[95%] h-auto max-h-[85vh] md:max-h-[85vh] sm:max-h-[90vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex flex-col items-center">
              <DialogTitle className="text-2xl font-bold mb-1 flex items-center gap-2">
                <CalendarIcon2 className="h-5 w-5 text-primary" />
                {appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {currentStep === 1 ? "Seleziona o cerca un cliente" :
                 currentStep === 2 ? "Associa un preventivo all'appuntamento" :
                 "Specifica data, ora e note"}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="flex justify-center -mt-3 mb-2 z-10 relative">
            <div className="bg-background px-3 py-1 rounded-full border shadow-sm flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${currentStep >= 1 ? "bg-primary" : "bg-gray-300"}`}></div>
              <div className={`w-3 h-3 rounded-full ${currentStep >= 2 ? "bg-primary" : "bg-gray-300"}`}></div>
              <div className={`w-3 h-3 rounded-full ${currentStep >= 3 ? "bg-primary" : "bg-gray-300"}`}></div>
            </div>
          </div>
          
          {/* Form con pulsanti di navigazione separati */}
          <div className="flex flex-col h-full">
            <div className="flex-grow overflow-auto">
              <Form {...form}>
                <form className="space-y-6 px-6 pt-5 pb-20">
                  {/* Step 1: Cliente */}
                  {currentStep === 1 && (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center pt-4">
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
                              <h3 className="font-bold text-base text-foreground">{selectedClient.name} {selectedClient.surname}</h3>
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
                            <Label className="mb-2 block">Cerca cliente</Label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input
                                  placeholder="Cerca per nome, targa o telefono"
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
                                  className="w-full"
                                />
                                
                                {isSearching && (
                                  <div className="absolute top-full mt-1 left-0 right-0 border rounded-md bg-background shadow-md z-10 max-h-52 overflow-y-auto">
                                    {filteredClients.length === 0 ? (
                                      <div className="p-2 text-center text-sm text-muted-foreground">
                                        Nessun cliente trovato
                                      </div>
                                    ) : (
                                      <div>
                                        {filteredClients.map((client, index) => (
                                          <div
                                            key={client.id}
                                            className={`p-2 cursor-pointer flex justify-between items-center ${
                                              selectedIndex === index ? "bg-accent" : "hover:bg-accent/50"
                                            }`}
                                            onClick={() => handleSelectClient(client)}
                                          >
                                            <div>
                                              <div className="font-medium">
                                                {client.name} {client.surname}
                                              </div>
                                              <div className="text-sm text-muted-foreground">
                                                {client.model} ({client.plate})
                                              </div>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {client.phone}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
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
                                    <div className="font-bold text-base">{quote.total.toFixed(2)} €</div>
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
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal border-primary/20 focus-visible:ring-primary/30",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    document.getElementById('date-calendar-popover')?.click();
                                  }}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "dd MMMM yyyy", { locale: it })
                                  ) : (
                                    <span>Seleziona una data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button 
                                      id="date-calendar-popover" 
                                      className="sr-only" 
                                      size="sm" 
                                      variant="ghost"
                                      type="button"
                                    >
                                      Apri calendario
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
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
                                  </PopoverContent>
                                </Popover>
                                <Input 
                                  type="hidden"
                                  {...field}
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
                      type="button"
                      size="sm"
                      onClick={async () => {
                        // Otteniamo direttamente i valori dal form
                        const formData = {
                          clientId: selectedClient?.id || "",
                          clientName: `${selectedClient?.name || ""} ${selectedClient?.surname || ""}`,
                          phone: selectedClient?.phone || "",
                          plate: selectedClient?.plate || "",
                          model: selectedClient?.model || "",
                          quoteId: selectedQuote?.id || "",
                          date: form.getValues("date") || "",
                          time: form.getValues("time") || "09:00",
                          duration: 1,
                          services: [],
                          notes: form.getValues("notes") || "",
                          status: form.getValues("status") || "programmato",
                        };
                        
                        console.log("Dati appuntamento raccolti:", formData);
                        await onSubmit(formData);
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