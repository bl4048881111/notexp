import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { Client, Quote, createQuoteSchema, QuoteItem, SparePart } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, XCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ComboboxDemo } from "@/components/ui/ComboboxDemo";
import ServiceItemForm from "./ServiceItemForm";
import SparePartForm from "./SparePartForm";
import { createQuote, updateQuote, calculateQuoteTotals } from "@shared/firebase";

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quote?: Quote | null;
}

export default function QuoteForm({ isOpen, onClose, onSuccess, quote }: QuoteFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [items, setItems] = useState<QuoteItem[]>(quote?.items || []);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();
  
  // Configurazione del form con validazione
  const form = useForm({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      id: quote?.id || uuidv4(),
      clientId: quote?.clientId || "",
      clientName: quote?.clientName || "",
      phone: quote?.phone || "",
      plate: quote?.plate || "",
      model: quote?.model || "",
      kilometrage: quote?.kilometrage || 0,
      date: quote?.date || format(new Date(), "yyyy-MM-dd"),
      status: quote?.status || "bozza",
      items: quote?.items || [],
      subtotal: quote?.subtotal || 0,
      taxRate: quote?.taxRate || 22,
      taxAmount: quote?.taxAmount || 0,
      total: quote?.total || 0,
      notes: quote?.notes || "",
      laborPrice: quote?.laborPrice || 45,
      laborHours: quote?.laborHours || 0
    }
  });
  
  // Effetto per caricare i clienti dalla API
  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(true);
      try {
        // Simulated data loading
        const response = await fetch("/api/clients");
        if (response.ok) {
          const data: Client[] = await response.json();
          setClients(data);
        }
      } catch (error) {
        console.error("Errore nel caricamento dei clienti:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Check URL for auto-populate
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    if (clientId) {
      fetchClientById(clientId);
    }
    
    fetchClients();
  }, []);
  
  // Effetto per impostare gli elementi del preventivo
  useEffect(() => {
    if (quote) {
      setItems(quote.items);
      if (quote.clientId) {
        fetchClientById(quote.clientId);
      }
    }
  }, [quote]);
  
  // Funzione per recuperare un client specifico
  const fetchClientById = async (id: string) => {
    try {
      const response = await fetch(`/api/clients/${id}`);
      if (response.ok) {
        const client: Client = await response.json();
        setSelectedClient(client);
        
        form.setValue("clientId", client.id);
        form.setValue("clientName", `${client.name} ${client.surname}`);
        form.setValue("phone", client.phone);
        form.setValue("plate", client.plate);
        form.setValue("model", client.model);
      }
    } catch (error) {
      console.error("Errore nel caricamento del cliente:", error);
    }
  };
  
  // Gestisce la selezione di un cliente
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    form.setValue("plate", client.plate);
    form.setValue("model", client.model);
    setIsSearching(false);
  };
  
  // Gestisce la rimozione del cliente selezionato
  const handleClearSelectedClient = () => {
    setSelectedClient(null);
    form.setValue("clientId", "");
    form.setValue("clientName", "");
    form.setValue("phone", "");
  };
  
  // Formatta il prezzo
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  // Gestisce l'aggiornamento degli elementi del preventivo
  const handleItemsChange = (newItems: QuoteItem[]) => {
    setItems(newItems);
    form.setValue("items", newItems);
    calculateTotals(newItems);
  };
  
  // Calcola i totali del preventivo
  const calculateTotals = (quoteItems: QuoteItem[]) => {
    const subtotal = quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = form.getValues("taxRate") || 22;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
  };
  
  // Gestisce il submit del form
  const onSubmit = async (data: any) => {
    setIsLoading(true);
    
    try {
      const laborPrice = form.getValues("laborPrice");
      const laborHours = form.getValues("laborHours");
      
      // Aggiorna i dati del form con gli items aggiornati
      const quoteData = {
        ...data,
        items,
        laborPrice,
        laborHours
      };
      
      // Calcola i totali finali
      const finalQuote = calculateQuoteTotals(quoteData as Quote);
      
      // Salva il preventivo
      if (quote) {
        await updateQuote(quote.id, finalQuote);
        toast({
          title: "Preventivo aggiornato",
          description: "Il preventivo è stato aggiornato con successo.",
        });
      } else {
        await createQuote(finalQuote);
        toast({
          title: "Preventivo creato",
          description: "Il preventivo è stato creato con successo.",
        });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Errore durante il salvataggio del preventivo:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del preventivo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtra i clienti in base alla ricerca
  const filteredClients = clients.filter(client => {
    if (!searchQuery) return false;
    
    const fullName = `${client.name} ${client.surname}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return (
      fullName.includes(query) || 
      client.phone.includes(query) || 
      client.plate.toLowerCase().includes(query)
    );
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Modifica Preventivo" : "Nuovo Preventivo"}</DialogTitle>
          <DialogDescription>
            {quote ? "Aggiorna i dettagli del preventivo" : "Crea un nuovo preventivo per un cliente"}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Sezione Info Cliente */}
            <div className="space-y-4">
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
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Cerca per nome, targa o telefono"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearching(e.target.value.length > 0);
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
                                {filteredClients.map((client) => (
                                  <div
                                    key={client.id}
                                    className="p-2 cursor-pointer hover:bg-accent flex justify-between items-center"
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
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Cliente</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome completo" />
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
                            <Input {...field} placeholder="Numero di telefono" type="tel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="plate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Targa</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Targa del veicolo" />
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
                          <FormLabel>Modello</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Modello del veicolo" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="kilometrage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chilometraggio</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Chilometraggio attuale" type="number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP", {
                                  locale: it,
                                })
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
                            selected={new Date(field.value)}
                            onSelect={(date) => {
                              if (date) {
                                field.onChange(format(date, "yyyy-MM-dd"));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Separator />
            
            {/* Sezione Servizi */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Aggiungi Servizi</h2>
              <ServiceItemForm
                items={items}
                onChange={handleItemsChange}
              />
            </div>
            
            <Separator />
            
            {/* Sezione Riepilogo */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Riepilogo</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Manodopera</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="laborPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tariffa oraria</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min={0} 
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    field.onChange(value);
                                    // Ricalcola i totali quando cambia la tariffa
                                    const hours = form.getValues("laborHours") || 0;
                                    const laborTotal = value * hours;
                                    const newTotal = form.getValues("subtotal") + laborTotal;
                                    form.setValue("total", newTotal);
                                  }}
                                />
                                <span>€/ora</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="laborHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ore totali</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min={0} 
                                  step={0.5} 
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    field.onChange(value);
                                    // Ricalcola i totali quando cambiano le ore
                                    const price = form.getValues("laborPrice") || 0;
                                    const laborTotal = price * value;
                                    const newTotal = form.getValues("subtotal") + laborTotal;
                                    form.setValue("total", newTotal);
                                  }}
                                />
                                <span>ore</span>
                              </div>
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
                          <FormLabel>Note</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Note aggiuntive per il preventivo"
                              className="h-24"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Totale Preventivo</CardTitle>
                      <CardDescription>Riepilogo dei costi</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span>Subtotale Servizi:</span>
                        <span>{formatCurrency(form.getValues("subtotal") || 0)}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Manodopera extra:</span>
                        <span>
                          {formatCurrency((form.getValues("laborPrice") || 0) * (form.getValues("laborHours") || 0))}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>IVA ({form.getValues("taxRate")}%):</span>
                        <span>{formatCurrency(form.getValues("taxAmount") || 0)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between font-bold text-lg">
                        <span>TOTALE:</span>
                        <span>
                          {formatCurrency(
                            (form.getValues("total") || 0) + 
                            (form.getValues("laborPrice") || 0) * (form.getValues("laborHours") || 0)
                          )}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <div className="flex items-center space-x-4">
                              <FormLabel className="w-24">Stato:</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona uno stato" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="bozza">Bozza</SelectItem>
                                  <SelectItem value="inviato">Inviato</SelectItem>
                                  <SelectItem value="accettato">Accettato</SelectItem>
                                  <SelectItem value="rifiutato">Rifiutato</SelectItem>
                                  <SelectItem value="scaduto">Scaduto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {quote ? "Aggiorna" : "Salva"} Preventivo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}