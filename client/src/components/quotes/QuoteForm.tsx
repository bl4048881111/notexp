import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Quote, QuoteItem, Client, createQuoteSchema } from "@shared/schema";
import { getAllClients, getClientById, createQuote, updateQuote } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import ClientForm from "../clients/ClientForm";
import ServiceItemForm from "./ServiceItemForm";
import SparePartForm from "./SparePartForm";

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quote?: Quote | null;
}

export default function QuoteForm({ isOpen, onClose, onSuccess, quote }: QuoteFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [activeTab, setActiveTab] = useState("client");
  
  const { toast } = useToast();
  
  // Setup form with zod validation
  const form = useForm<Quote>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
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
      notes: "",
      status: "bozza",
      validUntil: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      createdAt: Date.now()
    }
  });
  
  // Load clients on component mount
  useEffect(() => {
    const loadClients = async () => {
      const loadedClients = await getAllClients();
      setClients(loadedClients);
    };
    
    loadClients();
  }, []);
  
  // Filter clients based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredClients([]);
      return;
    }
    
    const filtered = clients.filter(client => 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.surname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.plate && client.plate.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    setFilteredClients(filtered);
  }, [searchQuery, clients]);
  
  // Set form values when editing a quote
  useEffect(() => {
    if (quote) {
      const { id, ...quoteData } = quote;
      form.reset(quoteData);
      setQuoteItems(quoteData.items || []);
      
      // Fetch client data for the quote
      getClientById(quoteData.clientId).then(client => {
        if (client) {
          setSelectedClient(client);
        }
      });
    }
  }, [quote, form]);
  
  // Update form values when quote items change
  useEffect(() => {
    // Calculate totals
    const subtotal = quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = form.getValues("taxRate") || 22;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    // Update form
    form.setValue("items", quoteItems);
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
  }, [quoteItems, form]);
  
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    form.setValue("plate", client.plate);
    form.setValue("model", client.model);
    setSearchQuery(`${client.name} ${client.surname}`);
  };
  
  const handleAddNewClient = () => {
    setIsClientFormOpen(true);
  };
  
  const handleClientFormSuccess = () => {
    setIsClientFormOpen(false);
    // Refetch clients
    setTimeout(() => {
      getAllClients().then(updatedClients => {
        setClients(updatedClients);
        const newClient = updatedClients[updatedClients.length - 1];
        if (newClient) {
          handleSelectClient(newClient);
        }
      });
    }, 1000);
  };
  
  const handleTaxRateChange = (value: string) => {
    const taxRate = parseFloat(value);
    form.setValue("taxRate", taxRate);
    
    // Recalculate totals
    const subtotal = form.getValues("subtotal") || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
  };
  
  const handleNextTab = () => {
    if (activeTab === "client") {
      // Validate client info before proceeding
      if (!selectedClient) {
        toast({
          title: "Errore",
          description: "Seleziona un cliente per continuare",
          variant: "destructive",
        });
        return;
      }
      setActiveTab("services");
    } else if (activeTab === "services") {
      setActiveTab("ricambi");
    } else if (activeTab === "ricambi") {
      setActiveTab("summary");
    }
  };
  
  const onSubmit = async (data: Quote) => {
    setIsSubmitting(true);
    
    try {
      if (quote) {
        // Update existing quote
        await updateQuote(quote.id, data);
        toast({
          title: "Preventivo aggiornato",
          description: "Il preventivo è stato aggiornato con successo",
        });
      } else {
        // Create new quote
        await createQuote(data);
        toast({
          title: "Preventivo creato",
          description: "Il nuovo preventivo è stato creato con successo",
        });
      }
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del preventivo",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-background border-primary">
          <DialogHeader className="border-b border-border pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold text-primary">
                {quote ? "Modifica Preventivo" : "Nuovo Preventivo"}
              </DialogTitle>
              <DialogClose className="rounded-full hover:bg-muted p-2">
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid grid-cols-4 bg-muted/20 mb-4">
                  <TabsTrigger value="client" className="text-foreground data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-none">Cliente</TabsTrigger>
                  <TabsTrigger value="services" className="text-foreground data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-none">Servizi</TabsTrigger>
                  <TabsTrigger value="ricambi" className="text-foreground data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-none">Ricambi</TabsTrigger>
                  <TabsTrigger value="summary" className="text-foreground data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-none">Riepilogo</TabsTrigger>
                </TabsList>
                
                <TabsContent value="client" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <div className="relative">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Input 
                              placeholder="Cerca cliente per nome, telefono o targa..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="max-h-60 overflow-y-auto">
                              {filteredClients.length > 0 ? (
                                filteredClients.map((client) => (
                                  <div 
                                    key={client.id}
                                    className="p-2 cursor-pointer hover:bg-accent"
                                    onClick={() => handleSelectClient(client)}
                                  >
                                    <div>{client.name} {client.surname}</div>
                                    <div className="text-xs text-muted-foreground">{client.phone} - {client.plate}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-2 text-muted-foreground">Nessun cliente trovato</div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={handleAddNewClient}
                          title="Aggiungi nuovo cliente"
                        >
                          <span className="material-icons text-primary">person_add</span>
                        </Button>
                      </div>
                    </FormItem>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="plate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Targa</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Targa" 
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
                                placeholder="Modello veicolo" 
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
                            <FormLabel>Data Preventivo</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="validUntil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valido Fino Al</FormLabel>
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
                                      format(new Date(field.value), "dd/MM/yyyy")
                                    ) : (
                                      <span>Seleziona data</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => date ? field.onChange(format(date, "yyyy-MM-dd")) : field.onChange(undefined)}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="flex justify-end pt-4">
                      <Button type="button" onClick={handleNextTab}>
                        Avanti
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="services" className="space-y-4 pt-4">
                  <ServiceItemForm 
                    items={quoteItems}
                    onChange={setQuoteItems}
                  />
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setActiveTab("client")}>
                      Indietro
                    </Button>
                    <Button type="button" onClick={handleNextTab}>
                      Avanti
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="ricambi" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-md p-4">
                      <h3 className="text-lg font-medium text-primary mb-4">Ricambi per Servizi</h3>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {quoteItems.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            Nessun servizio selezionato. Aggiungi servizi nella scheda precedente.
                          </div>
                        ) : (
                          quoteItems.map((item, index) => (
                            <div key={item.id} className="border rounded-md p-4">
                              <h4 className="font-medium mb-2">{index + 1}. {item.serviceType.name}</h4>
                              <SparePartForm
                                parts={item.parts}
                                onChange={(parts) => {
                                  const updatedItems = quoteItems.map(i => {
                                    if (i.id === item.id) {
                                      // Calculate new total price with updated parts
                                      const laborTotal = i.laborPrice * i.laborHours;
                                      const partsTotal = parts.reduce((sum, part) => sum + part.finalPrice, 0);
                                      return {
                                        ...i,
                                        parts,
                                        totalPrice: laborTotal + partsTotal
                                      };
                                    }
                                    return i;
                                  });
                                  setQuoteItems(updatedItems);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setActiveTab("services")}>
                        Indietro
                      </Button>
                      <Button type="button" onClick={handleNextTab}>
                        Avanti
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="summary" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <SelectItem value="bozza">Bozza</SelectItem>
                                <SelectItem value="inviato">Inviato</SelectItem>
                                <SelectItem value="accettato">Accettato</SelectItem>
                                <SelectItem value="rifiutato">Rifiutato</SelectItem>
                                <SelectItem value="scaduto">Scaduto</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="taxRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Aliquota IVA (%)</FormLabel>
                            <Select
                              onValueChange={handleTaxRateChange}
                              defaultValue={field.value.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona aliquota" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="22">22%</SelectItem>
                                <SelectItem value="10">10%</SelectItem>
                                <SelectItem value="4">4%</SelectItem>
                                <SelectItem value="0">0% (Esente IVA)</SelectItem>
                              </SelectContent>
                            </Select>
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
                              placeholder="Note aggiuntive per il preventivo" 
                              {...field} 
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="bg-muted p-4 rounded-md border">
                      <h3 className="font-medium mb-2">Riepilogo Preventivo</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>Cliente:</div>
                        <div className="font-medium">{form.getValues("clientName")}</div>
                        
                        <div>Veicolo:</div>
                        <div className="font-medium">{form.getValues("model")} - {form.getValues("plate")}</div>
                        
                        <div>Data:</div>
                        <div className="font-medium">
                          {format(new Date(form.getValues("date")), "dd/MM/yyyy")}
                        </div>
                        
                        <div>Valido fino a:</div>
                        <div className="font-medium">
                          {form.getValues("validUntil") ? format(new Date(form.getValues("validUntil")), "dd/MM/yyyy") : "N/A"}
                        </div>
                        
                        <div>Stato:</div>
                        <div className="font-medium capitalize">{form.getValues("status")}</div>
                      </div>
                      
                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-medium mb-2">Servizi:</h4>
                        {quoteItems.length === 0 ? (
                          <p className="text-muted-foreground">Nessun servizio aggiunto</p>
                        ) : (
                          <div className="space-y-2">
                            {quoteItems.map((item) => (
                              <div key={item.id} className="flex justify-between">
                                <div>{item.serviceType.name}</div>
                                <div>{formatCurrency(item.totalPrice)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 border-t pt-4">
                        <div className="flex justify-between">
                          <div>Subtotale:</div>
                          <div>{formatCurrency(form.getValues("subtotal"))}</div>
                        </div>
                        <div className="flex justify-between">
                          <div>IVA ({form.getValues("taxRate")}%):</div>
                          <div>{formatCurrency(form.getValues("taxAmount"))}</div>
                        </div>
                        <div className="flex justify-between font-bold text-lg mt-2">
                          <div>Totale:</div>
                          <div>{formatCurrency(form.getValues("total"))}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={() => setActiveTab("services")}>
                        Indietro
                      </Button>
                      <Button type="submit" disabled={isSubmitting || quoteItems.length === 0}>
                        {isSubmitting ? "Salvataggio..." : quote ? "Aggiorna Preventivo" : "Crea Preventivo"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {isClientFormOpen && (
        <ClientForm
          isOpen={isClientFormOpen}
          onClose={() => setIsClientFormOpen(false)}
          onSuccess={handleClientFormSuccess}
          client={null}
        />
      )}
    </>
  );
}