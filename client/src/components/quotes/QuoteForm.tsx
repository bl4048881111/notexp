import { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Quote, CreateQuoteInput, createQuoteSchema, Client, QuoteItem } from "@shared/schema";
import { getAllClients } from "@shared/firebase";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

import ServiceItemForm from "./ServiceItemForm";
import SparePartForm from "./SparePartForm";
import { useIsMobile } from "../../hooks/use-mobile";
import { CalendarIcon, Car, FileEdit, Settings, Wrench, User } from "lucide-react";
import { ComboboxDemo } from "../ui/ComboboxDemo";

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quote?: Quote | null;
}

export default function QuoteForm({ isOpen, onClose, onSuccess, quote }: QuoteFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const defaultValues: Partial<CreateQuoteInput> = {
    clientId: "",
    clientName: "",
    phone: "",
    plate: "",
    model: "",
    date: format(new Date(), "yyyy-MM-dd"),
    items: [],
    subtotal: 0,
    taxRate: 22,
    taxAmount: 0,
    total: 0,
    status: "bozza",
    notes: "",
    createdAt: Date.now()
  };
  
  const form = useForm<CreateQuoteInput>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: quote ? {
      ...quote,
      date: quote.date || format(new Date(), "yyyy-MM-dd"),
    } : defaultValues
  });

  // Carica i clienti all'apertura del form
  useEffect(() => {
    const loadClients = async () => {
      const fetchedClients = await getAllClients();
      setClients(fetchedClients);
    };
    
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);
  
  // Se il preventivo è stato passato per la modifica, carica i dati
  useEffect(() => {
    if (quote) {
      form.reset({
        ...quote,
        date: quote.date || format(new Date(), "yyyy-MM-dd"),
      });
      
      setItems(quote.items || []);
      
      const client = clients.find(c => c.id === quote.clientId);
      if (client) {
        setSelectedClient(client);
      }
    } else {
      form.reset(defaultValues);
      setItems([]);
      setSelectedClient(null);
    }
  }, [quote, clients, form]);
  
  // Aggiorna i calcoli quando cambiano gli elementi o il tasso IVA
  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = form.getValues("taxRate") || 22;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    form.setValue("items", items);
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
  }, [items, form]);
  
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    
    // Se il cliente ha un veicolo, imposta i dati del veicolo
    if (client.vehicles && client.vehicles.length > 0) {
      const primaryVehicle = client.vehicles[0];
      form.setValue("plate", primaryVehicle.plate);
      form.setValue("model", primaryVehicle.model);
    }
  };
  
  const onSubmit = async (data: Quote) => {
    try {
      // Assicurati che il preventivo abbia tutti i dati calcolati
      const finalData = {
        ...data,
        items,
        subtotal: items.reduce((sum, item) => sum + item.totalPrice, 0),
        taxAmount: (data.subtotal * data.taxRate) / 100,
        total: data.subtotal + data.taxAmount,
        createdAt: data.createdAt || Date.now()
      };
      
      if (quote) {
        // Aggiorna il preventivo esistente
        await onSuccess();
        toast({
          title: "Preventivo aggiornato",
          description: "Il preventivo è stato aggiornato con successo.",
        });
      } else {
        // Crea un nuovo preventivo
        await onSuccess();
        toast({
          title: "Preventivo creato",
          description: "Il preventivo è stato creato con successo.",
        });
      }
      
      onClose();
    } catch (error) {
      console.error("Errore durante il salvataggio del preventivo:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del preventivo.",
        variant: "destructive",
      });
    }
  };
  
  const formatDate = (date: string) => {
    if (!date) return "";
    try {
      const parsedDate = parse(date, "yyyy-MM-dd", new Date());
      return format(parsedDate, "d MMMM yyyy", { locale: it });
    } catch (e) {
      return date;
    }
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {quote ? "Modifica Preventivo" : "Nuovo Preventivo"}
          </DialogTitle>
          <DialogDescription>
            {quote ? "Modifica i dettagli del preventivo" : "Inserisci i dettagli per creare un nuovo preventivo"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs 
              defaultValue="general" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <FileEdit size={16} />
                  <span>Generale</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="flex items-center gap-2">
                  <Wrench size={16} />
                  <span>Servizi</span>
                </TabsTrigger>
                <TabsTrigger value="parts" className="flex items-center gap-2">
                  <Settings size={16} />
                  <span>Ricambi</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="general">
                <div className="space-y-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="text-primary" />
                        <h3 className="text-lg font-medium">Cliente</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="col-span-1 md:col-span-2">
                          <FormLabel>Seleziona cliente</FormLabel>
                          {clients.length > 0 ? (
                            <ComboboxDemo
                              items={clients.map(client => ({
                                value: client.id,
                                label: `${client.name} ${client.surname} - ${client.phone}`
                              }))}
                              value={selectedClient ? selectedClient.id : ""}
                              onChange={(value: string) => {
                                const client = clients.find(c => c.id === value);
                                if (client) handleSelectClient(client);
                              }}
                              placeholder="Cerca cliente..."
                            />
                          ) : (
                            <div className="text-muted-foreground">Caricamento clienti...</div>
                          )}
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="clientName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome cliente</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Nome e cognome" />
                              </FormControl>
                              <FormMessage />
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
                                <Input {...field} placeholder="Numero di telefono" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <Car className="text-primary" />
                        <h3 className="text-lg font-medium">Veicolo</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <FormField
                          control={form.control}
                          name="plate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Targa</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Targa veicolo" />
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
                              <FormLabel>Veicolo</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Marca e modello" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <CalendarIcon className="text-primary" />
                        <h3 className="text-lg font-medium">Data</h3>
                      </div>
                      
                      <div className="mb-2">
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Data preventivo</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={`w-full pl-3 text-left font-normal ${
                                        !field.value ? "text-muted-foreground" : ""
                                      }`}
                                    >
                                      {field.value ? (
                                        formatDate(field.value)
                                      ) : (
                                        <span>Seleziona una data</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value ? new Date(field.value) : undefined}
                                    onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                    disabled={(date) => date < new Date("1900-01-01")}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                              <FormLabel>Note</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Note aggiuntive (opzionale)"
                                  className="min-h-[100px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="services">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Wrench className="text-primary" />
                      <h3 className="text-lg font-medium">Servizi</h3>
                    </div>
                    
                    <ServiceItemForm
                      items={items}
                      onChange={setItems}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="parts">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="text-primary" />
                      <h3 className="text-lg font-medium">Riepilogo Ricambi</h3>
                    </div>
                    
                    {items.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Settings className="mx-auto h-12 w-12 opacity-20 mb-2" />
                        <p>Nessun servizio selezionato con ricambi</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={() => setActiveTab("services")}
                        >
                          Vai a Servizi
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {items.map((item, index) => (
                          <div key={item.id} className="border rounded-md p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium text-primary">{index + 1}. {item.serviceType.name}</h4>
                              <span className="text-sm bg-muted px-2 py-0.5 rounded">{item.serviceType.category}</span>
                            </div>
                            
                            <SparePartForm
                              parts={item.parts}
                              onChange={(parts) => {
                                const updatedItems = [...items];
                                updatedItems[index] = {
                                  ...item,
                                  parts,
                                  totalPrice: 
                                    (item.laborPrice * item.laborHours) + 
                                    parts.reduce((sum, part) => sum + part.finalPrice, 0)
                                };
                                setItems(updatedItems);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            <div className="bg-muted/20 border rounded-md p-4 mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Subtotale:</span>
                <span>{formatCurrency(form.getValues("subtotal"))}</span>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span>IVA:</span>
                  <FormField
                    control={form.control}
                    name="taxRate"
                    render={({ field }) => (
                      <FormItem className="mb-0">
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="w-16 h-8 text-right"
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              field.onChange(value || 0);
                              
                              // Ricalcola l'importo dell'IVA e il totale
                              const subtotal = form.getValues("subtotal");
                              const taxAmount = (subtotal * (value || 0)) / 100;
                              form.setValue("taxAmount", taxAmount);
                              form.setValue("total", subtotal + taxAmount);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span>%</span>
                </div>
                <span>{formatCurrency(form.getValues("taxAmount"))}</span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Totale:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(form.getValues("total"))}
                </span>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/90"
              >
                {quote ? "Aggiorna Preventivo" : "Crea Preventivo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}