import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Appointment, CreateAppointmentInput, Client, Quote } from "@shared/schema";
import { createAppointmentSchema } from "@shared/schema";
import { createAppointment, updateAppointment, getAllClients, getClientById, getQuotesByClientId } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { XCircle, FileText, Calendar, Check, ArrowRight, Plus } from "lucide-react";

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
    
    return clients.filter(client => {
      const fullName = `${client.name} ${client.surname}`;
      // Case sensitive search
      return fullName.includes(searchQuery) || 
        client.phone.includes(searchQuery) || 
        client.plate.includes(searchQuery) ||
        client.model.includes(searchQuery);
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
      date: selectedDate || format(new Date(), 'yyyy-MM-dd'),
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
      form.reset(appointmentData);
      
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
        form.setValue("date", date);
        form.setValue("time", time);
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}</DialogTitle>
            <DialogDescription>
              {appointment 
                ? "Modifica i dettagli dell'appuntamento"
                : "Seleziona cliente, preventivo e data dell'appuntamento"
              }
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Sezione Cliente */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Cliente</h2>
                </div>
                
                {selectedClient ? (
                  <div className="flex justify-between items-center border p-4 rounded-md bg-muted/40">
                    <div>
                      <h3 className="font-medium">{selectedClient.name} {selectedClient.surname}</h3>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <p>Tel: {selectedClient.phone}</p>
                        <p>Veicolo: {selectedClient.model} ({selectedClient.plate})</p>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={handleClearSelectedClient}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      <span>Cambia</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Cerca cliente</Label>
                      <div className="relative">
                        <Input
                          placeholder="Cerca per nome, targa o telefono (ricerca case-sensitive)"
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
                                    className={`p-2 cursor-pointer hover:bg-accent ${
                                      index === selectedIndex ? "bg-accent" : ""
                                    } ${index !== filteredClients.length - 1 ? "border-b" : ""}`}
                                    onClick={() => handleSelectClient(client)}
                                  >
                                    <div className="font-medium">{client.name} {client.surname}</div>
                                    <div className="text-xs text-muted-foreground flex justify-between">
                                      <span>{client.phone}</span>
                                      <span>{client.plate} - {client.model}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Sezione Preventivo (solo se un cliente è selezionato) */}
              {selectedClient && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Preventivo</h2>
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
              
              {/* Sezione Data/Ora e Note */}
              {selectedClient && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Data e Note</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
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
                          <FormLabel>Ora</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
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
                        <FormLabel>Note (opzionale)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Note aggiuntive..." 
                            className="resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button type="submit" disabled={isSubmitting || !selectedClient}>
                  {isSubmitting 
                    ? "Salvataggio in corso..." 
                    : appointment ? "Aggiorna Appuntamento" : "Salva Appuntamento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}