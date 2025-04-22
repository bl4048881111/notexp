import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { Client, Quote, createQuoteSchema, QuoteItem, SparePart } from "@shared/schema";
import { getAllClients, getClientById, createQuote, updateQuote } from "@shared/firebase";
import { calculateQuoteTotals, calculateItemTotal } from "./QuoteCalculator";
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
import ServiceSelectionForm from "./ServiceSelectionForm";
// Utilizziamo la versione completamente statica
import StaticSparePartsForm from "./StaticSparePartsForm";

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quote?: Quote | null;
  defaultClientId?: string | null;
}

export default function QuoteForm({ isOpen, onClose, onSuccess, quote, defaultClientId }: QuoteFormProps) {
  // Versione totalmente ridotta - eliminiamo gli effetti collaterali e i cicli infiniti
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Assicuriamoci che i ricambi siano inizializzati come array
  const initialItems = quote?.items?.map(item => ({
    ...item,
    parts: Array.isArray(item.parts) ? item.parts : [] 
  })) || [];
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
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

      date: quote?.date || format(new Date(), "yyyy-MM-dd"),
      status: quote?.status || "bozza",
      items: initialItems, // Usa gli item già processati
      subtotal: quote?.subtotal || 0,
      taxRate: quote?.taxRate || 22,
      taxAmount: quote?.taxAmount || 0,
      total: quote?.total || 0,
      notes: quote?.notes || "",
      laborPrice: quote?.laborPrice || 45,
      laborHours: quote?.laborHours || 0
    }
  });
  
  // Carica i clienti all'inizio - wrappato in useCallback
  const loadClients = useCallback(async () => {
    if (clients.length === 0) {
      setIsLoading(true);
      try {
        const data = await getAllClients();
        setClients(data);
        
        // Se c'è un defaultClientId, carica i dati del cliente
        if (defaultClientId) {
          fetchClientById(defaultClientId);
        }
        
        // Controlla anche l'URL per clientId
        const urlParams = new URLSearchParams(window.location.search);
        const clientIdFromUrl = urlParams.get('clientId');
        if (clientIdFromUrl) {
          fetchClientById(clientIdFromUrl);
        }
      } catch (error) {
        console.error("Errore nel caricamento dei clienti:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [clients.length, defaultClientId]);
  
  // Carica i clienti al montaggio del componente (solo una volta)
  useEffect(() => {
    loadClients();
  }, [loadClients]);
  
  // Funzione per recuperare un client specifico
  const fetchClientById = async (id: string) => {
    try {
      const client = await getClientById(id);
      if (client) {
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
  const handleItemsChange = useCallback((newItems: QuoteItem[]) => {
    // Calcola i totali corretti per ogni item usando la funzione helper
    const itemsWithCorrectTotals = newItems.map(item => ({
      ...item,
      totalPrice: calculateItemTotal(item)
    }));
    
    // Aggiorna lo stato con i calcoli corretti
    setItems(itemsWithCorrectTotals);
    
    // Ricalcola i totali per il preventivo
    const { subtotal, taxAmount, total } = calculateTotals(itemsWithCorrectTotals);
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
    
    console.log("Items aggiornati con totali corretti:", { subtotal, taxAmount, total });
  }, [form]);
  
  // Versione migliorata che include manodopera nei totali
  function calculateTotals(quoteItems: QuoteItem[]) {
    // Utilizziamo la funzione helper per calcolare i totali dei singoli item
    let subtotal = 0;
    
    // Log items per debug
    console.log("Calcolando totali per items:", quoteItems);
    
    if (quoteItems && quoteItems.length > 0) {
      for (const item of quoteItems) {
        // Calcola il totale dei ricambi per questo item
        const partsTotal = item.parts && Array.isArray(item.parts) 
          ? item.parts.reduce((sum, part) => {
              const partPrice = part.finalPrice || 0;
              console.log(`Ricambio: ${part.code} - ${part.name} = ${partPrice}€`);
              return sum + partPrice;
            }, 0) 
          : 0;
          
        console.log(`Totale ricambi per ${item.serviceType.name}: ${partsTotal}€`);
        
        // Aggiorniamo il totalPrice dell'item (utile per la visualizzazione)
        item.totalPrice = partsTotal;
        
        // Aggiorniamo il subtotale
        subtotal += partsTotal;
      }
    } else {
      console.warn("Nessun item trovato nel preventivo");
    }
    
    // Aggiungi la manodopera extra
    const laborPrice = form.getValues('laborPrice') || 0;
    const laborHours = form.getValues('laborHours') || 0;
    const laborTotal = laborPrice * laborHours;
    
    console.log(`Manodopera: ${laborPrice}€/ora × ${laborHours} ore = ${laborTotal}€`);
    subtotal += laborTotal;
    
    // Calcoli dell'IVA
    const taxRate = 22; // Valore fisso per evitare form.getValues()
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    console.log(`TOTALI FINALI: Subtotale ${subtotal}€, IVA ${taxAmount}€, Totale ${total}€`);
    
    // Aggiorniamo i valori del form direttamente
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
    
    return { subtotal, taxAmount, total };
  }
  
  // Gestisce il submit del form
  const onSubmit = async (data: any) => {
    setIsLoading(true);
    
    try {
      const laborPrice = form.getValues("laborPrice");
      const laborHours = form.getValues("laborHours");
      
      console.log("Salvataggio preventivo - items:", items);
      items.forEach(item => {
        console.log(`Servizio ${item.serviceType.name} ha ${item.parts?.length || 0} ricambi:`, item.parts);
      });
      
      // Assicuriamoci che tutti gli item.parts siano array validi (non undefined o null)
      const cleanedItems = items.map(item => ({
        ...item,
        parts: Array.isArray(item.parts) ? item.parts : [] // Se parts è undefined o null, impostiamo un array vuoto
      }));
      
      // Log dettagliato prima del salvataggio
      console.log("Items prima del salvataggio:");
      cleanedItems.forEach(item => {
        console.log(`- Servizio ${item.serviceType.name} ha ${item.parts.length} ricambi`);
        item.parts.forEach((part, idx) => {
          console.log(`  ${idx+1}. ${part.code} - ${part.name}, ${part.quantity} × ${part.unitPrice}€ = ${part.finalPrice}€`);
        });
      });
      
      // Aggiorna i dati del form con gli items aggiornati
      const quoteData = {
        ...data,
        items: cleanedItems,
        laborPrice,
        laborHours
      };
      
      // Calcola i totali finali manualmente
      console.log("QuoteData prima di salvare:", quoteData);
      
      // Calcoliamo manualmente i totali per assicurarci che siano corretti
      const calcTotals = calculateTotals(cleanedItems);
      
      // Aggiorniamo i totali nel quoteData
      quoteData.subtotal = calcTotals.subtotal;
      quoteData.taxAmount = calcTotals.taxAmount;
      quoteData.total = calcTotals.total;
      
      console.log("Totali calcolati manualmente:", calcTotals);
      
      const finalQuote = quoteData as Quote;
      
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
  
  // Stato per il passaggio corrente - se è una modifica, andiamo direttamente allo step 4 (ricambi)
  const [currentStep, setCurrentStep] = useState<number>(quote ? 4 : 1);
  const totalSteps = 4;
  
  // Stato per tenere traccia del tab attivo nella sezione ricambi
  const [activeTab, setActiveTab] = useState<string>(items.length > 0 ? items[0].id : "");
  
  // Rimosso effetto di debug per i ricambi
  
  // Rimosso effetto per aggiornare totali - i totali vengono aggiornati solo durante il salvataggio
  
  // Funzione per andare al passaggio successivo
  const goToNextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };
  
  // Funzione per andare al passaggio precedente
  const goToPreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  // Controlla se il passaggio 1 è valido (dati cliente e veicolo)
  const isStep1Valid = () => {
    const { clientName, phone, plate, model } = form.getValues();
    return !!clientName && !!phone && !!plate && !!model;
  };
  
  // Controlla se il passaggio 2 è valido (servizi)
  const isStep2Valid = () => {
    return items.length > 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Modifica Preventivo" : "Nuovo Preventivo"}</DialogTitle>
          <DialogDescription>
            {quote ? "Aggiorna i dettagli del preventivo" : "Crea un nuovo preventivo per un cliente"}
          </DialogDescription>
        </DialogHeader>
        
        {/* Indicatore Passaggi con pallini */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-muted-foreground">
            {currentStep === 1 && "Dati Cliente"}
            {currentStep === 2 && "Selezione Servizi"}
            {currentStep === 3 && "Gestione Ricambi"}
            {currentStep === 4 && "Riepilogo"}
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div 
                key={step} 
                className={`rounded-full w-3 h-3 transition-colors ${
                  currentStep === step 
                    ? "bg-primary" 
                    : currentStep > step
                    ? "bg-primary/40"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* STEP 1: Dati Cliente */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Dati Cliente e Veicolo</h2>
                  <div className="text-sm text-muted-foreground">Passo 1 di 4</div>
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
                
                <div className="grid grid-cols-1 gap-4">
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
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    onClick={goToNextStep} 
                    disabled={!isStep1Valid()}
                  >
                    Avanti
                  </Button>
                </div>
              </div>
            )}
            
            {/* STEP 2: Selezione Servizi */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Selezione Servizi</h2>
                  <div className="text-sm text-muted-foreground">Passo 2 di 4</div>
                </div>
                
                <ServiceSelectionForm
                  items={items}
                  onChange={handleItemsChange}
                />
                
                <div className="flex justify-between space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={goToPreviousStep}
                  >
                    Indietro
                  </Button>
                  <Button 
                    type="button" 
                    onClick={goToNextStep} 
                    disabled={!isStep2Valid()}
                  >
                    Avanti
                  </Button>
                </div>
              </div>
            )}
            
            {/* STEP 3: Ricambi */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Inserimento Ricambi</h2>
                  <div className="text-sm text-muted-foreground">Passo 3 di 4</div>
                </div>
                
                {/* Componente per la gestione dei ricambi */}
                <div className="mb-4">
                  <FormField
                    control={form.control}
                    name="laborPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo orario manodopera (€)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(isNaN(value) ? 0 : value);
                              
                              // Aggiorna tutti gli item con il nuovo costo orario
                              const newItems = items.map(item => ({
                                ...item,
                                laborPrice: isNaN(value) ? 0 : value
                              }));
                              setItems(newItems);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <StaticSparePartsForm
                  items={items}

                  onAddPart={(serviceId, partData) => {
                    // Crea un nuovo array di servizi con il nuovo ricambio
                    const newItems = items.map(item => {
                      if (item.id === serviceId) {
                        // Crea un nuovo ricambio completo
                        const newPart: SparePart = {
                          ...partData,
                          id: uuidv4()
                        };
                        
                        // Assicurati che parts sia un array
                        const parts = Array.isArray(item.parts) ? [...item.parts, newPart] : [newPart];
                        
                        // Calcola il nuovo prezzo totale
                        const totalPrice = parts.reduce((sum, part) => sum + part.finalPrice, 0);
                        
                        return {
                          ...item,
                          parts,
                          totalPrice
                        };
                      }
                      return item;
                    });
                    
                    // Aggiorna lo stato
                    setItems(newItems);
                  }}
                  onRemovePart={(serviceId, partId) => {
                    // Crea un nuovo array di servizi senza il ricambio rimosso
                    const newItems = items.map(item => {
                      if (item.id === serviceId) {
                        // Rimuovi il ricambio
                        const parts = Array.isArray(item.parts) 
                          ? item.parts.filter(part => part.id !== partId)
                          : [];
                        
                        // Calcola il nuovo prezzo totale
                        const totalPrice = parts.reduce((sum, part) => sum + part.finalPrice, 0);
                        
                        return {
                          ...item,
                          parts,
                          totalPrice
                        };
                      }
                      return item;
                    });
                    
                    // Aggiorna lo stato
                    setItems(newItems);
                  }}
                />
                
                <div className="flex justify-between space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={goToPreviousStep}
                  >
                    Indietro
                  </Button>
                  
                  <Button type="button" onClick={goToNextStep}>
                    Avanti
                  </Button>
                </div>
              </div>
            )}
            
            {/* STEP 4: Riepilogo e Conferma */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Riepilogo e Conferma</h2>
                  <div className="text-sm text-muted-foreground">Passo 4 di 4</div>
                </div>
                
                <div className="border p-4 rounded-md bg-muted/20 mb-4">
                  <h3 className="font-medium mb-2">Dati Cliente e Veicolo</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><span className="font-medium">Cliente:</span> {form.getValues("clientName")}</p>
                      <p><span className="font-medium">Telefono:</span> {form.getValues("phone")}</p>
                    </div>
                    <div>
                      <p><span className="font-medium">Veicolo:</span> {form.getValues("model")}</p>
                      <p><span className="font-medium">Targa:</span> {form.getValues("plate")}</p>
                    </div>
                  </div>
                </div>
                
                <div className="border p-4 rounded-md bg-muted/20 mb-4">
                  <h3 className="font-medium mb-2">Servizi Selezionati</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Servizio</th>
                          <th className="text-left p-2">Categoria</th>
                          <th className="text-right p-2">Prezzo Base</th>
                          <th className="text-right p-2">Ricambi</th>
                          <th className="text-right p-2">Totale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">{item.serviceType.name}</td>
                            <td className="p-2">{item.serviceType.category}</td>
                            <td className="p-2 text-right">{formatCurrency(item.serviceType.laborPrice || 0)}</td>
                            <td className="p-2 text-right">
                              <div className="flex flex-col items-end">
                                {/* Mostra la lista dei ricambi se presenti */}
                                {item.parts && item.parts.length > 0 ? (
                                  <div className="mb-1 text-sm text-left">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                          <th className="px-1 py-0.5 text-left">Codice</th>
                                          <th className="px-1 py-0.5 text-center">Qtà</th>
                                          <th className="px-1 py-0.5 text-right">Prezzo</th>
                                          <th className="px-1 py-0.5 text-right">Totale</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {item.parts.map((part, idx) => (
                                          <tr key={idx} className={idx % 2 === 0 ? 'bg-primary/5' : ''}>
                                            <td className="px-1 py-0.5 text-left font-medium">{part.code}</td>
                                            <td className="px-1 py-0.5 text-center">{part.quantity}</td>
                                            <td className="px-1 py-0.5 text-right">{formatCurrency(part.unitPrice)}</td>
                                            <td className="px-1 py-0.5 text-right font-medium">{formatCurrency(part.finalPrice)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground mb-1">Nessun ricambio</div>
                                )}
                                
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="p-0 h-auto font-normal underline-offset-4 text-primary"
                                  onClick={() => {
                                    // Imposta lo step 3 (ricambi) e seleziona questo servizio
                                    setCurrentStep(3);
                                    setActiveTab(item.id);
                                    console.log("Modifica ricambi per", item.serviceType.name);
                                  }}
                                >
                                  {Array.isArray(item.parts) && item.parts.length > 0 ? 
                                    `Modifica ricambi (${item.parts.length})` : 
                                    'Aggiungi ricambi'
                                }
                                </Button>
                              </div>
                            </td>
                            <td className="p-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Manodopera Extra e Note</h3>
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
                                      // Non utilizziamo più l'aggiornamento diretto qui
                                      // perché potrebbe causare loop di aggiornamento infiniti
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
                                      // Non utilizziamo più l'aggiornamento diretto qui
                                      // perché potrebbe causare loop di aggiornamento infiniti
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
                      
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stato Preventivo</FormLabel>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="border rounded-md overflow-hidden bg-primary/5">
                      <div className="bg-black text-white p-3">
                        <h3 className="font-semibold text-base">Totale Preventivo</h3>
                      </div>
                      <div className="p-3 space-y-2 text-sm">
                        {/* Ricalcola i totali in tempo reale anziché usare i valori memorizzati */}
                        {(() => {
                          // Calcolare tutti i totali direttamente qui
                          let itemsSubtotal = 0;
                          
                          // Calcola il totale dei ricambi
                          items.forEach(item => {
                            if (item.parts && Array.isArray(item.parts)) {
                              item.parts.forEach(part => {
                                itemsSubtotal += part.finalPrice || 0;
                              });
                            }
                          });
                          
                          // Aggiungi manodopera
                          const laborPrice = form.getValues('laborPrice') || 0;
                          const laborHours = form.getValues('laborHours') || 0;
                          const laborTotal = laborPrice * laborHours;
                          
                          // Calcola subtotale
                          const subtotal = itemsSubtotal + laborTotal;
                          
                          // Imposta i valori per il salvataggio
                          form.setValue("subtotal", subtotal);
                          
                          // Calcola IVA
                          const taxRate = form.getValues('taxRate') || 22;
                          const taxAmount = (subtotal * taxRate) / 100;
                          form.setValue("taxAmount", taxAmount);
                          
                          // Calcola totale finale
                          const total = subtotal + taxAmount;
                          form.setValue("total", total);
                          
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <span>Subtotale Servizi:</span>
                                <span className="font-medium">{formatCurrency(subtotal)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span>Manodopera extra:</span>
                                <span className="font-medium">
                                  {formatCurrency(laborTotal)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span>IVA ({taxRate}%):</span>
                                <span className="font-medium">{formatCurrency(taxAmount)}</span>
                              </div>
                              
                              <div className="h-px w-full bg-border my-2"></div>
                              
                              <div className="flex justify-between items-center bg-primary/10 p-2 rounded-sm">
                                <span className="font-bold">TOTALE:</span>
                                <span className="font-bold text-primary">
                                  {formatCurrency(total)}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                        
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={goToPreviousStep}
                  >
                    Indietro
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Annulla
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {quote ? "Aggiorna" : "Salva"} Preventivo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}