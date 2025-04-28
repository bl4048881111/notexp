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
import { CalendarIcon, XCircle, Pencil, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { SimplePopover } from "@/components/ui/CustomUIComponents";
import { cn } from "@/lib/utils";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ComboboxDemo } from "@/components/ui/ComboboxDemoFixed";
import ServiceSelectionForm from "./ServiceSelectionForm";
// Utilizziamo la versione completamente statica
import StaticSparePartsForm from "./StaticSparePartsForm";
import { appointmentService } from "@/services/appointmentService";
import { Appointment } from "@shared/types";

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
      vin: quote?.vin || "",
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
  
  // Wrapper per assicurarsi che l'aggiornamento degli items avvenga correttamente
  const updateItems = (newItems: QuoteItem[]) => {
    // Forza un nuovo array per assicurarsi che React rilevi la modifica
    setItems([...newItems]);
    // Ricalcola i totali
    calculateTotals([...newItems]);
  };
  
  // Gestisce l'aggiornamento degli elementi del preventivo
  const handleItemsChange = useCallback((newItems: QuoteItem[]) => {
    // Calcola i totali corretti per ogni item usando la funzione helper
    const itemsWithCorrectTotals = newItems.map(item => ({
      ...item,
      totalPrice: calculateItemTotal(item)
    }));
    
    // Aggiorna lo stato con i calcoli corretti
    updateItems(itemsWithCorrectTotals);
    
    // Ricalcola i totali per il preventivo
    const { subtotal, taxAmount, total } = calculateTotals(itemsWithCorrectTotals);
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
    
    console.log("Items aggiornati con totali corretti:", { subtotal, taxAmount, total });
  }, [form, updateItems]);
  
  // Versione migliorata che include manodopera nei totali
  function calculateTotals(quoteItems: QuoteItem[]) {
    // Importiamo il devLogger
    try {
      const { devLogger } = require('./../../components/dev/DevLogger');
      devLogger.log(`Calcolando totali per ${quoteItems.length} servizi`, 'info', 'QuoteForm');
    } catch (error) {
      // Se il devLogger non è disponibile, usiamo console.log
      console.log("Calcolando totali per items:", quoteItems);
    }
    
    // Utilizziamo la funzione helper per calcolare i totali dei singoli item
    let subtotal = 0;
    
    if (quoteItems && quoteItems.length > 0) {
      for (const item of quoteItems) {
        // Calcola il totale dei ricambi per questo item
        const partsTotal = item.parts && Array.isArray(item.parts) 
          ? item.parts.reduce((sum, part) => {
              const partPrice = part.finalPrice || 0;
              
              try {
                const { devLogger } = require('./../../components/dev/DevLogger');
                devLogger.log(`Ricambio: ${part.code} - ${part.name} = ${partPrice}€`, 'info', 'QuoteForm');
              } catch (error) {
                console.log(`Ricambio: ${part.code} - ${part.name} = ${partPrice}€`);
              }
              
              return sum + partPrice;
            }, 0) 
          : 0;
          
        try {
          const { devLogger } = require('./../../components/dev/DevLogger');
          devLogger.log(`Totale ricambi per ${item.serviceType.name}: ${partsTotal}€`, 'success', 'QuoteForm');
        } catch (error) {
          console.log(`Totale ricambi per ${item.serviceType.name}: ${partsTotal}€`);
        }
        
        // Aggiorniamo il totalPrice dell'item (utile per la visualizzazione)
        item.totalPrice = partsTotal;
        
        // Aggiorniamo il subtotale
        subtotal += partsTotal;
      }
    } else {
      try {
        const { devLogger } = require('./../../components/dev/DevLogger');
        devLogger.log("Nessun item trovato nel preventivo", 'warning', 'QuoteForm');
      } catch (error) {
        console.warn("Nessun item trovato nel preventivo");
      }
    }
    
    // Aggiungi la manodopera extra
    const laborPrice = form.getValues('laborPrice') || 0;
    const laborHours = form.getValues('laborHours') || 0;
    const laborTotal = laborPrice * laborHours;
    
    try {
      const { devLogger } = require('./../../components/dev/DevLogger');
      devLogger.log(`Manodopera: ${laborPrice}€/ora × ${laborHours} ore = ${laborTotal}€`, 'info', 'QuoteForm');
    } catch (error) {
      console.log(`Manodopera: ${laborPrice}€/ora × ${laborHours} ore = ${laborTotal}€`);
    }
    
    subtotal += laborTotal;
    
    // Calcoli dell'IVA
    const taxRate = 22; // Valore fisso per evitare form.getValues()
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    try {
      const { devLogger } = require('./../../components/dev/DevLogger');
      devLogger.log(`TOTALI FINALI: Subtotale ${subtotal}€, IVA ${taxAmount}€, Totale ${total}€`, 'success', 'QuoteForm', {
        subtotal, taxRate, taxAmount, total, laborPrice, laborHours, laborTotal
      });
    } catch (error) {
      console.log(`TOTALI FINALI: Subtotale ${subtotal}€, IVA ${taxAmount}€, Totale ${total}€`);
    }
    
    // Aggiorniamo i valori del form direttamente
    form.setValue("subtotal", subtotal);
    form.setValue("taxAmount", taxAmount);
    form.setValue("total", total);
    
    return { subtotal, taxAmount, total };
  }
  
  // Gestisce il submit del form
  const onSubmit = async (data: any) => {
    setIsLoading(true);
    console.log("Avvio salvataggio preventivo!");
    
    try {
      // Accedi ai valori del form direttamente tramite la proprietà interna per evitare problemi di tipo
      const rawFormData = (form as any)._formValues;
      
      // Ottieni tutti i valori dal form necessari per il preventivo
      const laborPrice = parseFloat(String(form.getValues("laborPrice") || "0"));
      const laborHours = parseFloat(String(form.getValues("laborHours") || "0"));
      
      console.log("Salvataggio preventivo - items:", items);
      
      // Assicuriamoci che tutti gli item.parts siano array validi (non undefined o null)
      const cleanedItems = items.map(item => ({
        ...item,
        parts: Array.isArray(item.parts) ? item.parts : [] // Se parts è undefined o null, impostiamo un array vuoto
      }));
      
      // Calcola totali in tempo reale
      let itemsSubtotal = 0;
      
      // Calcola il totale dei ricambi
      cleanedItems.forEach(item => {
        if (item.parts && Array.isArray(item.parts)) {
          item.parts.forEach(part => {
            itemsSubtotal += parseFloat(part.finalPrice?.toString() || "0");
          });
        }
      });
      
      // Aggiungi manodopera extra
      const laborTotal = laborPrice * laborHours;
      
      // Calcola subtotale
      const subtotal = itemsSubtotal + laborTotal;
      
      // Calcola IVA
      const taxRate = parseFloat(String(form.getValues('taxRate') || "22"));
      const taxAmount = (subtotal * taxRate) / 100;
      
      // Calcola totale finale
      const total = subtotal + taxAmount;
      
      console.log("Valori per il preventivo:", {
        laborPrice, laborHours, itemsSubtotal, laborTotal, subtotal, taxRate, taxAmount, total
      });
      
      const clientId = form.getValues("clientId") || "";
      const clientName = form.getValues("clientName") || "";
      
      // Prepara i dati del preventivo
      const quoteData = {
        ...data,
        clientId,
        clientName,
        items: cleanedItems,
        laborPrice,
        laborHours,
        subtotal,
        taxRate,
        taxAmount,
        total
      };
      
      // Se stiamo modificando un preventivo esistente
      if (quote) {
        try {
          await updateQuote(quote.id, quoteData);
          
          // Notifica il calendario che ci sono stati cambiamenti
          try {
            const event = new Event('calendar:update');
            window.dispatchEvent(event);
            console.log("DEBUG - Inviato evento di aggiornamento calendario dopo modifica preventivo");
          } catch (eventError) {
            console.error("Errore nell'invio dell'evento di aggiornamento:", eventError);
          }
          
          toast({
            title: "Preventivo aggiornato",
            description: "Il preventivo è stato aggiornato con successo"
          });
          
          // Chiamiamo onSuccess e onClose dopo l'aggiornamento
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        } catch (error) {
          console.error("Errore nell'aggiornamento del preventivo:", error);
          toast({
            title: "Errore",
            description: "Si è verificato un errore durante il salvataggio del preventivo.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Creazione nuovo preventivo
        await createQuote(quoteData);
        
        // Notifica il calendario che ci sono stati cambiamenti
        try {
          const event = new Event('calendar:update');
          window.dispatchEvent(event);
          console.log("DEBUG - Inviato evento di aggiornamento calendario dopo creazione preventivo");
        } catch (eventError) {
          console.error("Errore nell'invio dell'evento di aggiornamento:", eventError);
        }
        
        toast({
          title: "Preventivo creato",
          description: "Il preventivo è stato creato con successo"
        });
        
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }
    } catch (error) {
      console.error("Errore durante il salvataggio del preventivo:", error);
      
      let errorMessage = "Si è verificato un errore durante il salvataggio del preventivo.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Errore",
        description: errorMessage,
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
    const { clientName, phone, plate } = form.getValues();
    return !!clientName && !!phone && !!plate;
  };
  
  // Controlla se il passaggio 2 è valido (servizi)
  const isStep2Valid = () => {
    return items.length > 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto scrollbar-hide">
        <DialogHeader className="pb-2 sticky top-0 bg-background z-10">
          <DialogTitle>{quote ? "Modifica Preventivo" : "Nuovo Preventivo"}</DialogTitle>
          <DialogDescription>
            {quote ? "Aggiorna i dettagli del preventivo" : "Crea un nuovo preventivo per un cliente"}
          </DialogDescription>
        </DialogHeader>
        
        {/* Indicatore Passaggi con pallini */}
        <div className="flex justify-between items-center mb-4 sticky top-14 bg-background z-10 pb-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((step) => (
              <div 
                key={step} 
                className={`rounded-full w-2 h-2 transition-colors ${
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <p>Veicolo: {selectedClient.plate}</p>
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
                                          {client.plate}
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VIN (Numero di telaio)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Numero di telaio del veicolo" />
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
                        <FormControl>
                          <SimplePopover
                            trigger={
                              <Button
                                variant={"outline"}
                                type="button"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "dd MMMM yyyy", {
                                    locale: it,
                                  })
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
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                
                <StaticSparePartsForm
                  items={items}
                  onUpdateItems={updateItems}
                  onAddPart={(serviceId, partData, index = -1) => {
                    // Crea un nuovo array di servizi con il nuovo ricambio
                    const newItems = items.map(item => {
                      if (item.id === serviceId) {
                        // Crea un nuovo ricambio completo
                        const newPart: SparePart = {
                          ...partData,
                          id: uuidv4()
                        };
                        
                        // Ottieni l'array delle parti esistenti
                        let parts = Array.isArray(item.parts) ? [...item.parts] : [];
                        
                        // Determina se dobbiamo inserire in una posizione specifica o aggiungere in coda
                        // Nota: index può essere 0 (inizio array)
                        if (index >= 0 && index <= parts.length) {
                          console.log(`Inserimento ricambio in posizione ${index}`, newPart);
                          parts.splice(index, 0, newPart);
                        } else {
                          console.log(`Aggiunta ricambio in coda`, newPart);
                          parts.push(newPart);
                        }
                        
                        // Calcola il nuovo prezzo totale
                        const totalPrice = parts.reduce((sum, part) => sum + part.finalPrice, 0);
                        
                        // Nota: restituiamo un oggetto completamente nuovo per forzare il re-render
                        return {
                          ...item,
                          parts: [...parts],
                          totalPrice
                        };
                      }
                      return item;
                    });
                    
                    // Aggiorna lo stato con il nuovo array
                    console.log("Aggiornamento items in onAddPart", newItems);
                    updateItems(newItems);
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
                    updateItems(newItems);
                  }}
                />
              </div>
            )}
            
            {/* STEP 4: Riepilogo e Conferma */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-xl font-bold text-primary">Riepilogo e Conferma</h2>
                  <div className="text-sm bg-muted/30 px-3 py-1 rounded">Passo 4 di 4</div>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto scrollbar-hide border rounded-lg">
                  <div className="sticky top-0 z-10 border-b px-4 py-3 flex justify-between items-center bg-muted/30">
                    <h3 className="text-base font-medium">Servizi Selezionati ({items.length})</h3>
                  </div>
                  <div className="w-full">
                    {/* Versione desktop della tabella (nascondi su mobile) */}
                    <div className="w-full hidden md:block">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-muted/50 sticky top-[48px] z-10">
                          <tr>
                            <th className="text-left p-3 font-medium">Servizio</th>
                            <th className="text-left p-3 font-medium">Categoria</th>
                            <th className="text-right p-3 font-medium">Prezzo</th>
                            <th className="text-right p-3 font-medium">Ricambi</th>
                            <th className="text-right p-3 font-medium">Totale</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={index} className={`border-t ${index % 2 === 0 ? '' : 'bg-muted/10'} hover:bg-muted/20`}>
                              <td className="p-3 font-medium text-primary">{item.serviceType.name}</td>
                              <td className="p-3">{item.serviceType.category}</td>
                              <td className="p-3 text-right">{formatCurrency(item.serviceType.laborPrice || 0)}</td>
                              <td className="p-3 text-right">
                                {Array.isArray(item.parts) && item.parts.length > 0 ? (
                                  <div>
                                    {formatCurrency(item.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                                    <div className="text-xs text-muted-foreground mt-1">
                                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                      {item.parts.length} ricambi
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                              <td className="p-3 text-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-primary"
                                  onClick={() => {
                                    setCurrentStep(3);
                                    setActiveTab(item.id);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t bg-muted/50 sticky bottom-0 z-10">
                            <td colSpan={3} className="p-3"></td>
                            <td className="p-3 text-right font-medium">Totale:</td>
                            <td className="p-3 text-right font-bold">
                              {formatCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Versione mobile (card) - visibile solo su mobile */}
                    <div className="p-4 space-y-3 md:hidden">
                      {items.map((item, index) => (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <div className="flex justify-between items-center bg-muted/20 px-3 py-2 border-b">
                            <div className="font-medium text-primary">{item.serviceType.name}</div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7 text-primary"
                              onClick={() => {
                                setCurrentStep(3);
                                setActiveTab(item.id);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="p-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-muted-foreground">Categoria:</div>
                              <div className="font-medium">{item.serviceType.category}</div>
                              
                              <div className="text-muted-foreground">Manodopera:</div>
                              <div className="font-medium text-right">{formatCurrency(item.serviceType.laborPrice || 0)}</div>
                            
                            <div className="text-muted-foreground">Ricambi:</div>
                              <div className="font-medium text-right">
                              {Array.isArray(item.parts) && item.parts.length > 0 ? (
                                  <div>
                                  {formatCurrency(item.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                                    <div className="text-xs mt-1">
                                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                    {item.parts.length} ricambi
                                      </span>
                                  </div>
                                  </div>
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>
                            <div className="flex justify-between font-medium border-t mt-2 pt-2">
                            <div>Totale:</div>
                              <div className="font-bold">{formatCurrency(item.totalPrice)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="bg-muted/20 p-3 rounded-lg flex justify-between font-bold border sticky bottom-0">
                        <div>Totale Servizi:</div>
                        <div>{formatCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-primary/10 px-4 py-3 border-b">
                      <h3 className="font-medium text-primary">Manodopera</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="laborPrice"
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-base">Tariffa oraria</FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    min={0} 
                                    className="h-10 text-base"
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value);
                                      field.onChange(value);
                                    }}
                                  />
                                  <span className="text-base">€/ora</span>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="laborHours"
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-base">Ore aggiuntive</FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    min={0} 
                                    step={0.5} 
                                    className="h-10 text-base"
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value);
                                      field.onChange(value);
                                    }}
                                  />
                                  <span className="text-base">ore</span>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t text-sm">
                        <div className="text-muted-foreground">Ore totali:</div>
                        <div className="font-medium">
                          {form.getValues().laborHours || 0} ore
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-1 text-sm">
                        <div className="text-muted-foreground">Costo manodopera:</div>
                        <div className="font-medium">
                          {formatCurrency(
                            (form.getValues().laborHours || 0) * (form.getValues().laborPrice || 0)
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-primary/10 px-4 py-3 border-b">
                      <h3 className="font-medium text-primary">Totali</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                      <FormField
                        control={form.control}
                          name="taxRate"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                              <FormLabel className="text-base">Aliquota IVA (%)</FormLabel>
                            <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input 
                                {...field} 
                                    type="number" 
                                    min={0}
                                    max={100}
                                    className="h-10 text-base"
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value);
                                      field.onChange(value);
                                    }}
                                  />
                                  <span className="text-base">%</span>
                                </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </div>
                      
                      <div className="space-y-3 pt-3 mt-2 border-t">
                        <div className="flex justify-between items-center py-1 text-base">
                          <div className="text-muted-foreground">Subtotale (servizi):</div>
                          <div className="font-medium">
                            {formatCurrency(
                              items.reduce((sum, item) => sum + item.totalPrice, 0)
                            )}
                    </div>
                  </div>
                  
                        <div className="flex justify-between items-center py-1 text-base">
                          <div className="text-muted-foreground">Manodopera (extra):</div>
                          <div className="font-medium">
                            {formatCurrency(
                              (form.getValues().laborHours || 0) * (form.getValues().laborPrice || 0)
                            )}
                    </div>
                            </div>
                            
                        <div className="flex justify-between items-center border-t pt-2 py-1 text-base">
                          <div className="text-muted-foreground">Subtotale:</div>
                          <div className="font-medium">
                            {formatCurrency(
                              items.reduce((sum, item) => sum + item.totalPrice, 0) + 
                              (form.getValues().laborHours || 0) * (form.getValues().laborPrice || 0)
                            )}
                              </div>
                            </div>
                            
                        <div className="flex justify-between items-center pt-1 py-1 text-base">
                          <div className="text-muted-foreground">IVA ({form.getValues().taxRate || 0}%):</div>
                          <div className="font-medium">
                            {formatCurrency(
                              (items.reduce((sum, item) => sum + item.totalPrice, 0) + 
                              (form.getValues().laborHours || 0) * (form.getValues().laborPrice || 0)) * 
                              (form.getValues().taxRate || 0) / 100
                            )}
                            </div>
                            </div>
                            
                        <div className="flex justify-between items-center bg-primary/10 p-3 rounded-md mt-3">
                          <div className="font-bold text-lg">TOTALE:</div>
                          <div className="font-bold text-xl">
                            {formatCurrency(
                              (items.reduce((sum, item) => sum + item.totalPrice, 0) + 
                              (form.getValues().laborHours || 0) * (form.getValues().laborPrice || 0)) * 
                              (1 + (form.getValues().taxRate || 0) / 100)
                            )}
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Note</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Inserisci eventuali note o commenti..."
                          className="min-h-[120px] text-base" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <DialogFooter className="pt-4 border-t space-y-2 sm:space-y-0">
              {currentStep > 1 && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={goToPreviousStep}
                  className="w-full sm:w-auto text-base py-6 sm:py-2"
                    >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                      Indietro
                    </Button>
              )}
                    
              {currentStep < totalSteps ? (
                      <Button 
                        type="button" 
                  onClick={goToNextStep}
                  disabled={
                    (currentStep === 1 && !isStep1Valid()) ||
                    (currentStep === 2 && !isStep2Valid())
                  }
                  className="w-full sm:w-auto text-base py-6 sm:py-2"
                >
                  Avanti
                  <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full sm:w-auto text-base py-6 sm:py-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : quote ? "Aggiorna Preventivo" : "Crea Preventivo"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}