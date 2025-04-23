import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { XCircle, FileText, Check, ArrowRight, Plus, Trash2, CalendarIcon, Calendar as CalendarIcon2, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { SimplePopover } from "@/components/ui/CustomUIComponents";
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
import { useToast } from "@/hooks/use-toast";

import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAllClients,
  getClientById,
  getQuotesByClientId
} from "@shared/firebase";
import { 
  Appointment, 
  Client, 
  Quote, 
  CreateAppointmentInput, 
  createAppointmentSchema
} from "@shared/schema";
import { lookupVehicleByPlate, formatVehicleDetails } from "@/services/vehicleLookupService";

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
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState("");
  
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
  
  const handleLookupVehicle = async (plate: string) => {
    if (!plate || plate.length < 3) {
      toast({
        title: "Targa non valida",
        description: "Inserisci una targa valida per cercare le informazioni sul veicolo.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoadingVehicle(true);
    
    try {
      const vehicleDetails = await lookupVehicleByPlate(plate);
      
      if (!vehicleDetails) {
        toast({
          title: "Veicolo non trovato",
          description: "Non è stato possibile trovare informazioni per questa targa.",
          variant: "destructive",
        });
        return;
      }
      
      const formattedDetails = formatVehicleDetails(vehicleDetails);
      
      // Aggiorna i campi del form con i dettagli del veicolo
      const model = `${formattedDetails.make} ${formattedDetails.model} ${formattedDetails.year}`;
      form.setValue("model", model);
      
      toast({
        title: "Veicolo trovato",
        description: `${formattedDetails.make} ${formattedDetails.fullModel} ${formattedDetails.power ? `(${formattedDetails.power})` : ''}`,
      });
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
                                        onClick={() => handleSelectClient(client)}
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
                                              
                                              {client.model}
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
                    </div>
                  )}
                  
                  {/* Step 2: Preventivo */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center pt-4">
                        <h2 className="text-lg font-semibold flex items-center">
                          <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm font-bold">2</div>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Preventivo
                        </h2>
                      </div>
                      
                      <div className="space-y-4">
                        {selectedClient && (
                          <div className="flex flex-col gap-2">
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
                                        <div className="font-medium">{quote.plate} - {quote.model}</div>
                                        <Badge variant="outline" className="ml-2 px-1 py-0 text-xs">
                                          {quote.status === "bozza" ? "Bozza" : 
                                            quote.status === "inviato" ? "Inviato" : 
                                            quote.status === "approvato" ? "Approvato" : 
                                            quote.status === "rifiutato" ? "Rifiutato" : "Completato"}
                                        </Badge>
                                      </div>
                                      
                                      <div className="flex items-center mt-1.5 text-sm text-muted-foreground gap-3">
                                        <span>
                                          {format(new Date(quote.date), "dd/MM/yyyy")}
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {(quote.total || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                      </div>
                                      
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {quote.items?.length} servizi, {quote.items?.reduce((acc, item) => acc + (item.parts?.length || 0), 0)} ricambi
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
                                      
                                      {selectedQuote?.id === quote.id && (
                                        <Check className="h-5 w-5 text-primary" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 border rounded-lg border-dashed bg-muted/10">
                                <p className="text-muted-foreground mb-3">Nessun preventivo disponibile per questo cliente</p>
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
                            )}
                          </div>
                        )}
                        
                        <Input type="hidden" {...form.register("quoteId")} />
                      </div>
                    </div>
                  )}
                  
                  {/* Step 3: Dettagli appuntamento */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center pt-4">
                        <h2 className="text-lg font-semibold flex items-center">
                          <div className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-sm font-bold">3</div>
                          <CalendarIcon className="h-5 w-5 mr-1.5 text-primary" />
                          Dettagli
                        </h2>
                      </div>
                      
                      {/* Dati del veicolo */}
                      <div className="border rounded-lg p-4 bg-muted/5 mb-4">
                        <h3 className="text-base font-medium flex items-center mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Dati veicolo
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="plate-search" className="mb-2 flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              Targa
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="plate-search"
                                value={vehiclePlate}
                                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                                placeholder="Inserisci la targa..."
                                className="uppercase border-primary/20 focus-visible:ring-primary/30"
                              />
                              <Button 
                                type="button" 
                                onClick={() => handleLookupVehicle(vehiclePlate)}
                                disabled={isLoadingVehicle || !vehiclePlate}
                                className="min-w-[44px] bg-primary hover:bg-primary/90"
                              >
                                {isLoadingVehicle ? (
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <SearchIcon className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="vehicle-model" className="mb-2 flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                              </svg>
                              Modello
                            </Label>
                            <Input
                              id="vehicle-model"
                              {...form.register("model")}
                              placeholder="Modello veicolo"
                              className="border-primary/20 focus-visible:ring-primary/30"
                            />
                          </div>
                        </div>
                      </div>
                    
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Stato
                              </FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="border-primary/20 focus-visible:ring-primary/30">
                                    <SelectValue placeholder="Seleziona uno stato" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="programmato">Programmato</SelectItem>
                                    <SelectItem value="confermato">Confermato</SelectItem>
                                    <SelectItem value="in-corso">In corso</SelectItem>
                                    <SelectItem value="completato">Completato</SelectItem>
                                    <SelectItem value="annullato">Annullato</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="space-y-6">
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
                                  <SimplePopover
                                    trigger={
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full pl-3 text-left font-normal border-primary/20 focus-visible:ring-primary/30",
                                          !field.value && "text-muted-foreground"
                                        )}
                                        type="button"
                                      >
                                        {field.value ? (
                                          format(new Date(field.value), "dd MMMM yyyy", { locale: it })
                                        ) : (
                                          <span>Seleziona una data</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
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