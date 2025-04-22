import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Appointment, CreateAppointmentInput, Client, SparePart, Quote } from "@shared/schema";
import { createAppointmentSchema } from "@shared/schema";
import { createAppointment, updateAppointment, getAllClients, getClientById, getQuotesByClientId } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";
import { X, User, Calendar, FileText, Search, Plus, Car, Check } from "lucide-react";
import SparePartForm from "./SparePartForm";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import ClientForm from "../clients/ClientForm";

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: Appointment | null;
  selectedDate?: string | null;
  onEditQuote?: (quote: Quote) => void;
}

export default function AppointmentForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment, 
  selectedDate,
  onEditQuote 
}: AppointmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newService, setNewService] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("cliente");
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
      return fullName.includes(searchQuery) || client.phone.includes(searchQuery);
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
      setServices(appointmentData.services || []);
      setSpareParts(appointmentData.spareParts || []);
      setSearchQuery(appointmentData.clientName || "");
      
      // Fetch client data for the appointment
      getClientById(appointmentData.clientId).then(client => {
        if (client) {
          setSelectedClient(client);
          // Update form with client data to ensure it's complete
          form.setValue("clientId", client.id);
          form.setValue("clientName", `${client.name} ${client.surname}`);
          form.setValue("phone", client.phone);
          form.setValue("plate", client.plate);
          form.setValue("model", client.model);
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
  
  // Update services field when services array changes
  useEffect(() => {
    form.setValue("services", services);
  }, [services, form]);
  
  // Update spareParts field when spareParts array changes
  useEffect(() => {
    form.setValue("spareParts", spareParts);
    // Calculate and set the total price
    const totalPrice = spareParts.reduce((sum, part) => sum + part.finalPrice, 0);
    form.setValue("totalPartsPrice", totalPrice);
  }, [spareParts, form]);
  
  // Quando viene selezionato un preventivo, aggiorniamo i servizi
  useEffect(() => {
    if (selectedQuote) {
      // Estraiamo i servizi dal preventivo
      const quoteServices = selectedQuote.items.map(item => item.serviceType.name);
      // Utilizziamo un array con valori unici
      const uniqueServices = Array.from(new Set([...services, ...quoteServices]));
      setServices(uniqueServices);
    }
  }, [selectedQuote]);
  
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    form.setValue("plate", client.plate);
    form.setValue("model", client.model);
    setSearchQuery(`${client.name} ${client.surname}`);
    
    // Passiamo automaticamente al passo successivo
    setActiveTab("preventivo");
  };
  
  const handleSelectQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    // Aggiungiamo i servizi del preventivo
    const quoteServices = quote.items.map(item => item.serviceType.name);
    // Utilizziamo un array con valori unici
    const uniqueServices = Array.from(new Set([...services, ...quoteServices]));
    setServices(uniqueServices);
    
    // Passiamo al passo successivo
    setActiveTab("appuntamento");
  };
  
  const handleEditQuote = (quote: Quote) => {
    if (onEditQuote) {
      onEditQuote(quote);
      onClose();
    }
  };
  
  const handleAddService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()]);
      setNewService("");
    }
  };
  
  const handleRemoveService = (serviceToRemove: string) => {
    setServices(services.filter(service => service !== serviceToRemove));
  };
  
  const handleAddNewClient = () => {
    setIsClientFormOpen(true);
  };
  
  const handleClientFormSuccess = () => {
    setIsClientFormOpen(false);
    // Refetch clients
    setTimeout(() => {
      getAllClients().then(updatedClients => {
        const newClient = updatedClients[updatedClients.length - 1];
        if (newClient) {
          handleSelectClient(newClient);
        }
      });
    }, 1000);
  };
  
  const onSubmit = async (data: CreateAppointmentInput) => {
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
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}</DialogTitle>
            {!appointment && (
              <DialogDescription>
                Compila i dati per creare un nuovo appuntamento
              </DialogDescription>
            )}
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {appointment ? (
                // Versione semplificata per modifica appuntamento
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefono</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="plate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Targa</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly={!!selectedClient}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modello Veicolo</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly={!!selectedClient}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
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
                    
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Durata (minuti)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="15" 
                              step="15" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stato</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona stato" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="programmato">Programmato</SelectItem>
                              <SelectItem value="completato">Completato</SelectItem>
                              <SelectItem value="annullato">Annullato</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormItem>
                    <FormLabel>Servizi</FormLabel>
                    <div className="flex flex-wrap p-2 bg-background border border-border rounded-md min-h-[80px]">
                      {services.map((service, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="group m-1 py-1 px-3 rounded-full bg-primary/15 border-primary"
                        >
                          <span className="mr-1">{service}</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => handleRemoveService(service)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                      <div className="flex">
                        <Input
                          type="text"
                          placeholder="Aggiungi servizio..."
                          className="border-0 bg-transparent p-1 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                          value={newService}
                          onChange={(e) => setNewService(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddService();
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-auto"
                          onClick={handleAddService}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </FormItem>
                  
                  {/* Spare Parts Form */}
                  <div className="mt-4">
                    <SparePartForm 
                      parts={spareParts} 
                      onChange={setSpareParts} 
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note</FormLabel>
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
                </>
              ) : (
                // Wizard per creazione nuovo appuntamento
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-3 mb-6">
                    <TabsTrigger value="cliente" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Cliente</span>
                    </TabsTrigger>
                    <TabsTrigger value="preventivo" className="flex items-center gap-2" disabled={!selectedClient}>
                      <FileText className="h-4 w-4" />
                      <span>Preventivo</span>
                    </TabsTrigger>
                    <TabsTrigger value="appuntamento" className="flex items-center gap-2" disabled={!selectedClient}>
                      <Calendar className="h-4 w-4" />
                      <span>Appuntamento</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Tab Cliente */}
                  <TabsContent value="cliente" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Seleziona un cliente</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="relative">
                          <div className="flex items-center border rounded-md pl-3">
                            <Search className="h-4 w-4 text-muted-foreground mr-2" />
                            <Input 
                              placeholder="Cerca cliente per nome o telefono... (case sensitive)" 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                          
                          {filteredClients.length > 0 && (
                            <Card className="absolute w-full z-10 mt-1 overflow-hidden p-0">
                              <ScrollArea className="max-h-60">
                                {filteredClients.map((client) => (
                                  <div 
                                    key={client.id}
                                    className="p-3 cursor-pointer hover:bg-accent border-b last:border-0"
                                    onClick={() => handleSelectClient(client)}
                                  >
                                    <div className="font-medium">{client.name} {client.surname}</div>
                                    <div className="text-xs text-muted-foreground flex justify-between">
                                      <span>{client.phone}</span>
                                      <span>{client.plate} - {client.model}</span>
                                    </div>
                                  </div>
                                ))}
                              </ScrollArea>
                            </Card>
                          )}
                        </div>
                        
                        <div className="flex justify-between">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddNewClient}
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Nuovo Cliente</span>
                          </Button>
                          
                          {selectedClient && (
                            <Button
                              type="button"
                              onClick={() => setActiveTab("preventivo")}
                              className="flex items-center gap-2"
                            >
                              <span>Continua</span>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {selectedClient && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Cliente selezionato</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium">Dati Cliente</h4>
                              <p className="text-lg font-semibold">{selectedClient.name} {selectedClient.surname}</p>
                              <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
                              {selectedClient.email && (
                                <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-medium">Veicolo</h4>
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-muted-foreground" />
                                <p className="text-lg font-semibold">{selectedClient.model}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">Targa: {selectedClient.plate}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                  
                  {/* Tab Preventivo */}
                  <TabsContent value="preventivo" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Preventivi del cliente</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {isLoadingQuotes ? (
                          <div className="space-y-2">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                          </div>
                        ) : clientQuotes.length > 0 ? (
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-2">
                              {clientQuotes.map(quote => (
                                <div 
                                  key={quote.id} 
                                  className={`p-4 border rounded-md cursor-pointer transition-colors ${
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
                                      <div className="mt-1">
                                        {quote.items.map((item, idx) => (
                                          <Badge 
                                            key={idx} 
                                            variant="outline" 
                                            className="mr-1 mb-1 bg-primary/5 text-xs"
                                          >
                                            {item.serviceType.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold">{quote.total.toFixed(2)} €</div>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="text-xs"
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
                          </ScrollArea>
                        ) : (
                          <div className="text-center p-6 text-muted-foreground">
                            <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p>Nessun preventivo trovato per questo cliente</p>
                            <Button 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => setActiveTab("appuntamento")}
                            >
                              Continua senza preventivo
                            </Button>
                          </div>
                        )}
                        
                        <div className="flex justify-between pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActiveTab("cliente")}
                          >
                            Indietro
                          </Button>
                          
                          <Button
                            type="button"
                            onClick={() => setActiveTab("appuntamento")}
                          >
                            {selectedQuote ? 'Continua con preventivo selezionato' : 'Continua senza preventivo'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  {/* Tab Appuntamento */}
                  <TabsContent value="appuntamento" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Dettagli appuntamento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
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
                          
                          <FormField
                            control={form.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Durata (minuti)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="15" 
                                    step="15" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stato</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona stato" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="programmato">Programmato</SelectItem>
                                    <SelectItem value="completato">Completato</SelectItem>
                                    <SelectItem value="annullato">Annullato</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormItem>
                          <FormLabel>Servizi</FormLabel>
                          <div className="flex flex-wrap p-2 bg-background border border-border rounded-md min-h-[80px]">
                            {services.map((service, index) => (
                              <Badge 
                                key={index} 
                                variant="outline" 
                                className="group m-1 py-1 px-3 rounded-full bg-primary/15 border-primary"
                              >
                                <span className="mr-1">{service}</span>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-4 w-4 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => handleRemoveService(service)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                            <div className="flex">
                              <Input
                                type="text"
                                placeholder="Aggiungi servizio..."
                                className="border-0 bg-transparent p-1 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                                value={newService}
                                onChange={(e) => setNewService(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddService();
                                  }
                                }}
                              />
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto"
                                onClick={handleAddService}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </FormItem>
                        
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Note</FormLabel>
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
                        
                        <div className="flex justify-between pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActiveTab("preventivo")}
                          >
                            Indietro
                          </Button>
                          
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Salvataggio in corso..." : "Salva Appuntamento"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
              
              {appointment && (
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Annulla
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !selectedClient}>
                    {isSubmitting 
                      ? "Salvataggio in corso..." 
                      : "Aggiorna Appuntamento"}
                  </Button>
                </DialogFooter>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {isClientFormOpen && (
        <ClientForm
          isOpen={isClientFormOpen}
          onClose={() => setIsClientFormOpen(false)}
          onSuccess={handleClientFormSuccess}
        />
      )}
    </>
  );
}
