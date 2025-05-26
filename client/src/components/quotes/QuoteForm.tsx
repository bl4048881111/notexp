import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import * as z from "zod";
import { Client, Quote, createQuoteSchema, QuoteItem, SparePart } from "@shared/schema";
import { getAllClients, getClientById, createQuote, updateQuote, getAllQuotes } from "@shared/firebase";
import { calculateItemTotal } from "./QuoteCalculator";
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
import { CalendarIcon, XCircle, Pencil, Loader2, ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
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
import { calculateTotals } from "./utils/totals";
import ServiceItemForm from "./ServiceItemForm";
import { LaborCalculator } from "./LaborCalculator";
import { useQueryClient } from "@tanstack/react-query";
import SummaryStepForm from "./SummaryStepForm";

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quote?: Quote | null;
  defaultClientId?: string | null;
}

// Interfaccia per i dati aggiuntivi non presenti nello schema Quote
interface QuoteExtraData {
  laborHours?: number;
  model?: string;
  vin?: string;
  items?: QuoteItem[];
  partsSubtotal?: number;
  laborTotal?: number;
}

// Tipo esteso per il quote con campi aggiuntivi
type QuoteWithExtra = Quote & QuoteExtraData;

/**
 * Componente QuoteForm - Form per la creazione e modifica di preventivi
 * 
 * Note sulla gestione della manodopera:
 * - Ogni servizio può avere la propria manodopera specifica calcolata in base alle ore di lavoro
 * - Esiste anche una manodopera extra a livello di preventivo per ore aggiuntive
 * - Il componente LaborCalculator gestisce in modo centralizzato i calcoli della manodopera
 * - Il calcolo dei totali viene fatto automaticamente in base alla tariffa oraria e ore di lavoro
 */
export default function QuoteForm({ isOpen, onClose, onSuccess, quote, defaultClientId }: QuoteFormProps) {
  // Versione totalmente ridotta - eliminiamo gli effetti collaterali e i cicli infiniti
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Assicuriamoci che i ricambi siano inizializzati come array
  const initialItems = (quote as QuoteWithExtra)?.items?.map(item => ({
    ...item,
    parts: Array.isArray(item.parts) ? item.parts : [] 
  })) || [];
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Aggiungiamo un flag per prevenire la chiusura accidentale del form
  const [preventAutoClose, setPreventAutoClose] = useState<boolean>(false);
  const [preventCloseUntilSave, setPreventCloseUntilSave] = useState<boolean>(false);
  
  const allowedStatus = ["bozza", "inviato", "accettato", "scaduto", "completato", "archiviato"];
  const normalizeStatus = (status: any) =>
    typeof status === "string" && allowedStatus.includes(status)
      ? status as "bozza" | "inviato" | "accettato" | "scaduto" | "completato" | "archiviato"
      : "bozza";

  // Stato locale per i campi extra (non presenti nello schema Quote)
  const [laborHours, setLaborHours] = useState<number>(quote ? (quote as QuoteWithExtra)?.laborHours || 0 : 0);
  const [taxRate, setTaxRate] = useState<number>(quote ? (quote as QuoteWithExtra)?.taxRate || 22 : 22);
  const [model, setModel] = useState<string>("");
  const [vin, setVin] = useState<string>("");
  const [subTotals, setSubTotals] = useState({
    subtotal: quote ? (quote as QuoteWithExtra)?.subtotal || 0 : 0,
    taxAmount: quote ? (quote as QuoteWithExtra)?.taxAmount || 0 : 0,
    total: quote ? (quote as QuoteWithExtra)?.total || 0 : 0,
    partsSubtotal: quote ? (quote as QuoteWithExtra)?.partsSubtotal || 0 : 0,
    laborTotal: quote ? (quote as QuoteWithExtra)?.laborTotal || 0 : 0
  });

  // Configurazione del form con validazione - spostiamo la dichiarazione qui PRIMA degli useEffect che la usano
  const form = useForm({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      id: quote?.id || uuidv4(),
      clientId: quote?.clientId || defaultClientId || "",
      clientName: quote?.clientName || "",
      phone: quote?.phone || "",
      plate: quote?.plate || "",
      date: quote?.date || format(new Date(), "yyyy-MM-dd"),
      status: normalizeStatus(quote?.status),
      laborPrice: quote?.laborPrice !== undefined ? quote.laborPrice : 45,
      notes: quote?.notes || "",
      kilometrage: quote?.kilometrage || 0,
      totalPrice: quote?.totalPrice || 0,
      parts: quote?.parts || []
    }
  });

  // Effetto per inizializzare i campi extra dal preventivo esistente (se presente)
  useEffect(() => {
    if (quote) {
      // Inizializza i campi extra con valori dal preventivo se disponibili
      // Usiamo il casting a QuoteWithExtra per accedere ai campi non standard
      const quoteExtra = quote as QuoteWithExtra;
      setLaborHours(quoteExtra?.laborHours || 0);
      setModel(quoteExtra?.model || "");
      setVin(quoteExtra?.vin || "");
    }
  }, [quote]);

  // Aggiorna i totali quando laborHours o taxRate cambiano
  useEffect(() => {
    // Calcola manualmente i totali
    const partsTotal = items.reduce((sum, item) => {
      // Calcola il totale delle parti per questo item (SOLO ricambi)
      return sum + (Array.isArray(item.parts) 
        ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
        : 0);
    }, 0);
    
    // Calcola SOLO costo manodopera extra (NO manodopera servizi)
    const extraLabor = (form.getValues().laborPrice || 0) * laborHours;
    
    // Subtotale (ricambi + SOLO manodopera extra)
    const subtotal = partsTotal + extraLabor;
    
    // IVA
    const taxAmount = (subtotal * taxRate) / 100;
    
    // Totale finale
    const total = subtotal + taxAmount;
    
    // Aggiorna lo stato dei totali
    setSubTotals({
      subtotal,
      taxAmount,
      total,
      partsSubtotal: partsTotal,
      laborTotal: extraLabor
    });
  }, [items, laborHours, taxRate, form]);
  
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
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace('€', '€ ');
  };
  
  // Aggiunto flag per gestire lo stato durante l'aggiunta di parti
  const [isProcessingAddPart, setIsProcessingAddPart] = useState(false);
  
  // Funzione migliorata per aggiornare gli items
  const updateItems = useCallback((newItems: QuoteItem[]) => {
    try {
      // Crea una copia profonda per evitare problemi di riferimento
      const clonedItems = JSON.parse(JSON.stringify(newItems));
      
      // Aggiorna gli stati
      setItems(clonedItems);
      
      // Calcola SOLO i totali dei ricambi, SENZA manodopera servizi
      const partsTotal = clonedItems.reduce((sum: number, item: QuoteItem) => {
        return sum + (Array.isArray(item.parts) 
          ? item.parts.reduce((sum: number, part: SparePart) => sum + (part.finalPrice || 0), 0)
          : 0);
      }, 0);
      
      // Calcola SOLO costo manodopera extra
      const extraLabor = (form.getValues().laborPrice || 0) * laborHours;
      
      // Subtotale (ricambi + SOLO manodopera extra, NO manodopera servizi)
      const subtotal = partsTotal + extraLabor;
      
      // IVA
      const taxAmount = (subtotal * taxRate) / 100;
      
      // Totale finale
      const total = subtotal + taxAmount;
      
      // Aggiorna lo stato dei totali
      setSubTotals({
        subtotal,
        taxAmount,
        total,
        partsSubtotal: partsTotal,
        laborTotal: extraLabor
      });
      
      // Forza un re-render dopo un breve timeout
      setTimeout(() => {
        setItems([...clonedItems]);
      }, 50);
      
      console.log("Items aggiornati:", clonedItems);
              } catch (error) {
      console.error("Errore durante l'aggiornamento degli items:", error);
    }
  }, [form, laborHours, taxRate]);
  
  // Funzione ottimizzata per l'aggiunta di parti
  const onAddPart = useCallback((serviceId: string, part: Omit<SparePart, "id">, index = -1) => {
    // Impedisci doppi click
    if (isProcessingAddPart) return;
    setIsProcessingAddPart(true);
    
    try {
      // Crea il nuovo ricambio con un ID unico
      const newPart: SparePart = {
        id: uuidv4(),
        category: part.category || "",
        code: part.code,
        description: part.description,
        name: part.name || part.description || part.code,
        brand: part.brand,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        finalPrice: part.finalPrice || part.unitPrice * part.quantity
      };
      
      // Usa una copia profonda degli items per evitare problemi di riferimento
      const updatedItems = JSON.parse(JSON.stringify(items));
      
      // Trova il servizio a cui aggiungere il ricambio
      const serviceIndex = updatedItems.findIndex((item: QuoteItem) => item.id === serviceId);
      
      if (serviceIndex !== -1) {
        // Inizializza l'array delle parti se non esiste
        if (!updatedItems[serviceIndex].parts) {
          updatedItems[serviceIndex].parts = [];
        }
        
        // Aggiungi il nuovo ricambio all'array delle parti
        if (index === -1) {
          updatedItems[serviceIndex].parts.push(newPart);
    } else {
          updatedItems[serviceIndex].parts.splice(index, 0, newPart);
        }
        
        // Ricalcola il totale del servizio - Solo ricambi, senza manodopera
        const partsTotal = updatedItems[serviceIndex].parts.reduce(
          (sum: number, p: SparePart) => sum + (p.finalPrice || 0),
          0
        );
        
        // Il totalPrice dell'item è solo il costo dei ricambi
        updatedItems[serviceIndex].totalPrice = partsTotal;
        
        // Aggiorna lo stato
        updateItems(updatedItems);
      }
    } catch (error) {
      console.error("Errore durante l'aggiunta del ricambio:", error);
    } finally {
      setIsProcessingAddPart(false);
    }
  }, [items, isProcessingAddPart, updateItems]);
  
  // Gestisce l'aggiornamento degli elementi del preventivo
  const handleItemsChange = useCallback((newItems: QuoteItem[]) => {
    // Calcola i totali corretti per ogni item usando la funzione helper
    const itemsWithCorrectTotals = newItems.map((item: QuoteItem) => ({
      ...item,
      totalPrice: calculateItemTotal(item)
    }));
    
    // Aggiorna lo stato con i calcoli corretti
    setItems([...itemsWithCorrectTotals]);
    
    // I totali verranno calcolati nell'useEffect
  }, []);
  
  // Gestisce il submit del form
  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      // Prepara l'array di parti (ricambi) nel formato corretto richiesto dallo schema
      const parts = items.flatMap(item => 
        (Array.isArray(item.parts) ? item.parts : []).map(part => ({
          code: part.code || "",
          description: part.description || "",
          quantity: Number(part.quantity) || 1,
          price: Number(part.unitPrice) || 0
        }))
      );
      
      // Calcola i totali corretti
      // 1. Subtotale ricambi
      const partsSubtotal = items.reduce((sum, item) => {
        return sum + (Array.isArray(item.parts) 
          ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
          : 0);
      }, 0);
      
      // 2. Manodopera SOLO extra (NO manodopera servizi)
      const laborTotal = Number(data.laborPrice) * Number(laborHours);
      
      // 3. Subtotale (ricambi + SOLO manodopera extra)
      const subtotal = partsSubtotal + laborTotal;
      
      // 4. IVA sul subtotale
      const taxAmount = (subtotal * Number(taxRate)) / 100;
      
      // 5. Totale finale
      const totalPrice = subtotal + taxAmount;
      
      // Include campi extra come laborHours, taxRate, model, vin e items
      const quoteToSave = {
        id: data.id,
        clientId: data.clientId || defaultClientId || "",
        clientName: data.clientName,
        phone: data.phone,
        plate: data.plate,
        kilometrage: data.kilometrage || 0,
        date: data.date,
        status: normalizeStatus(data.status),
        laborPrice: Number(data.laborPrice) || 0,
        parts: parts,
        totalPrice: totalPrice,
        notes: data.notes || "",
        // Campi extra (non standard)
        laborHours: Number(laborHours) || 0,
        taxRate: Number(taxRate) || 22,
        model: model || "",
        vin: vin || "",
        items: items,
        // Valori calcolati per il subtotale e l'IVA
        subtotal: subtotal,
        taxAmount: taxAmount,
        // Non assegniamo più totalPrice a total, in modo che venga utilizzato correttamente totalPrice
        // total: totalPrice,
        // Aggiungiamo i subtotali separati
        partsSubtotal: partsSubtotal,
        laborTotal: laborTotal
      };
      
      console.log("Salvataggio preventivo con campi extra:", quoteToSave);
      
      try {
        let savedQuote;
        if (quote?.id) {
          // Aggiornamento preventivo esistente
          savedQuote = await updateQuote(quote.id, quoteToSave);
          toast({
            title: "Preventivo aggiornato",
            description: "Il preventivo è stato aggiornato con successo."
          });
        } else {
          // Creazione nuovo preventivo
          savedQuote = await createQuote(quoteToSave);
          toast({
            title: "Preventivo creato",
            description: "Il preventivo è stato creato con successo."
          });
        }
        
        // Forza aggiornamento della cache React Query utilizzando il queryClient già importato
        console.log("Forzo aggiornamento cache React Query");
        
        // Invalida le query per forzare un refetch
        await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        await queryClient.invalidateQueries({ queryKey: ['/quotes/client'] });
        // Invalida anche le query degli appuntamenti per aggiornare i dati del preventivo associato
        await queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
        
        // Emetti un evento personalizzato per notificare l'aggiornamento
        window.dispatchEvent(new CustomEvent('quoteUpdated', { 
          detail: { quoteId: quote?.id || savedQuote?.id, action: quote?.id ? 'updated' : 'created' }
        }));
        
        // Attendi un momento per assicurarsi che i dati siano persistiti
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Forza refetch dei dati
        const freshQuotes = await getAllQuotes();
        queryClient.setQueryData(['/api/quotes'], freshQuotes);
        
        // Chiama la funzione di onSuccess e chiude la modale
        if (onSuccess) onSuccess();
        onClose();
      } catch (error) {
        console.error("Errore nel salvataggio del preventivo:", error);
        toast({
          title: "Errore",
          description: "Si è verificato un errore durante il salvataggio del preventivo.",
          variant: "destructive"
        });
        // Chiudiamo comunque la modale
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Errore nella preparazione dei dati:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la preparazione dei dati.",
        variant: "destructive"
      });
      // Chiudiamo comunque la modale
      if (onSuccess) onSuccess();
      onClose();
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
    // Se siamo al passaggio 4, andiamo direttamente al passaggio 3 (ricambi)
    if (currentStep === 4) {
      setCurrentStep(3);
    } else {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    }
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

  // Miglioro lo scroll nella pagina di riepilogo (Passo 4)
  function SummaryStep() {
  return (
      <SummaryStepForm
        items={items}
        laborHours={laborHours}
        setLaborHours={setLaborHours}
        taxRate={taxRate}
        setTaxRate={setTaxRate}
        form={form}
        goToPreviousStep={goToPreviousStep}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Se il flag preventCloseUntilSave è attivo, impedisci completamente la chiusura
        if (!open && preventCloseUntilSave) {
          console.log("Tentativo di chiusura bloccato - operazione di modifica in corso");
          return;
        }
        
        // Controlliamo se dobbiamo prevenire la chiusura a causa del click sulla matita
        if (!open && preventAutoClose) {
          // Resettiamo il flag ma non chiudiamo il form
          setPreventAutoClose(false);
          return;
        }
        
        // Se stiamo modificando un preventivo nel passaggio 3 (inserimento ricambi), 
        // conferma prima di chiudere
        if (!open && currentStep === 3) {
          const confirmed = window.confirm("Sei sicuro di voler chiudere? Le modifiche non salvate andranno perse.");
          if (!confirmed) {
            // L'utente ha annullato, impediamo la chiusura
            return;
          }
        }
        
        // Altrimenti procediamo con la chiusura normale
        onClose();
      }}
    >
      <DialogContent 
        className="max-w-4xl max-h-[95vh] overflow-visible p-0 bg-black text-white border border-gray-800 scrollbar-hide"
        aria-describedby="quote-form-description"
        onClick={(e) => {
          // Ferma la propagazione dell'evento per evitare chiusure accidentali
          e.stopPropagation();
        }}
      >
        <DialogHeader className="px-4 py-3 sticky top-0 bg-black z-30 border-b border-gray-800">
          <DialogTitle className="text-orange-500">{quote ? "Modifica Preventivo" : "Nuovo Preventivo"}</DialogTitle>
          <DialogDescription id="quote-form-description" className="text-xs text-gray-400">
            {quote ? "Aggiorna i dettagli del preventivo" : "Crea un nuovo preventivo per un cliente"}
          </DialogDescription>
          <button 
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-gray-400 hover:text-orange-400" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Chiudi</span>
          </button>
        </DialogHeader>
        
        {/* Indicatore Passaggi con pallini */}
        <div className="flex justify-between items-center px-4 py-2 bg-black z-20 border-b border-gray-800">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((step) => (
              <div 
                key={step} 
                className={`rounded-full w-2 h-2 transition-colors ${
                  currentStep === step 
                    ? "bg-orange-500" 
                    : currentStep > step
                    ? "bg-orange-700"
                    : "bg-gray-800"
                }`}
              />
            ))}
          </div>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[calc(95vh-110px)] overflow-auto px-4 py-2 bg-black scrollbar-hide">
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
                      
                      <div>
                        <FormLabel>Modello</FormLabel>
                        <Input 
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="Modello del veicolo"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <FormLabel>VIN (Numero di telaio)</FormLabel>
                        <Input 
                          value={vin}
                          onChange={(e) => setVin(e.target.value)}
                          placeholder="Numero di telaio del veicolo"
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stato Preventivo</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona stato" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bozza">Bozza</SelectItem>
                                  <SelectItem value="inviato">Inviato</SelectItem>
                                  <SelectItem value="accettato">Accettato</SelectItem>
                                  <SelectItem value="completato">Completato</SelectItem>
                                  <SelectItem value="scaduto">Scaduto</SelectItem>
                                  <SelectItem value="archiviato">Archiviato</SelectItem>
                                </SelectContent>
                              </Select>
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
              <div className="flex flex-col flex-1 w-full">
                <div className="py-4 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Inserimento Ricambi</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Gestisci i ricambi per i servizi selezionati
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 p-6 overflow-auto">
                  <div className="grid grid-cols-1 gap-4">
                {/* Componente per la gestione dei ricambi */}
                <StaticSparePartsForm
                  items={items}
                  onAddPart={onAddPart}
                  onRemovePart={(serviceId, partId) => {
                    // Crea un nuovo array di servizi senza il ricambio rimosso
                    const newItems = items.map(item => {
                      if (item.id === serviceId) {
                        // Rimuovi il ricambio
                        const parts = Array.isArray(item.parts) 
                          ? item.parts.filter(part => part.id !== partId)
                          : [];
                        
                        // Calcola il nuovo prezzo totale
                            const totalPrice = parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0);
                        
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
                  onUpdateItems={updateItems}
                  onPrevStep={() => {
                    // Previeni la chiusura accidentale durante il cambio di passo
                    setPreventAutoClose(true);
                    setPreventCloseUntilSave(true);
                    
                    // Cambia passo
                    goToPreviousStep();
                    
                    // Dopo un breve periodo, riattiva la possibilità di chiudere
                    setTimeout(() => {
                      setPreventCloseUntilSave(false);
                    }, 500);
                  }}
                  onNextStep={() => {
                    // Previeni la chiusura accidentale durante il cambio di passo
                    setPreventAutoClose(true);
                    setPreventCloseUntilSave(true);
                    
                    // Cambia passo
                    goToNextStep();
                    
                    // Dopo un breve periodo, riattiva la possibilità di chiudere
                    setTimeout(() => {
                      setPreventCloseUntilSave(false);
                    }, 500);
                  }}
                  isNewQuote={!quote}
                />
                          </div>
                        </div>
                          </div>
            )}
            
            {/* STEP 4: Riepilogo e Conferma */}
            {currentStep === 4 && (
              <SummaryStep />
            )}
            
            <DialogFooter className="pt-4 border-t border-gray-800 space-y-2 sm:space-y-0 bg-black">
              {currentStep > 1 && currentStep !== 3 && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={goToPreviousStep}
                  className="w-full sm:w-auto text-base py-6 sm:py-2 bg-transparent border-orange-500 text-orange-500 hover:bg-orange-950/30"
                    >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                      Indietro
                    </Button>
              )}
                    
              {currentStep < 4 && currentStep !== 3 ? (
                      <Button 
                        type="button" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Preveniamo la chiusura accidentale
                    if (currentStep === 3) {
                      setPreventAutoClose(true);
                      // Blocchiamo brevemente la chiusura durante il cambio di step
                      setPreventCloseUntilSave(true);
                      setTimeout(() => {
                        setPreventCloseUntilSave(false);
                      }, 300);
                    }
                    
                    // Procediamo al prossimo step
                    goToNextStep();
                  }}
                  disabled={
                    (currentStep === 1 && !isStep1Valid()) ||
                    (currentStep === 2 && !isStep2Valid())
                  }
                  className="w-full sm:w-auto text-base py-6 sm:py-2 bg-orange-600 hover:bg-orange-700"
                >
                  Avanti
                  <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
              ) : currentStep === 4 ? (
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full sm:w-auto text-base py-6 sm:py-2 bg-orange-600 hover:bg-orange-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : quote ? "Aggiorna Preventivo" : "Crea Preventivo"}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}