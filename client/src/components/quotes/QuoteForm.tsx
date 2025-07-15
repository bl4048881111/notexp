import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import * as z from "zod";
import { Client, Quote, createQuoteSchema, QuoteItem, SparePart } from "@shared/schema";
import { getAllClients, getClientById, createQuote, updateQuote, getAllQuotes, getAllAppointments, updateClient } from "@shared/supabase";
import { calculateItemTotal } from "./QuoteCalculator";
import { forceUpdateInputValues } from "./FocusableNumberInput";
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
import { CalendarIcon, XCircle, Pencil, Loader2, ChevronLeft, ChevronRight, X, Trash2, MessageSquare, UserPlus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { SimplePopover } from "@/components/ui/CustomUIComponents";
import { cn } from "@/lib/utils";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ComboboxDemo } from "@/components/ui/ComboboxDemoFixed";
// Utilizziamo la versione completamente statica
import StaticSparePartsForm from "./StaticSparePartsForm";
import { appointmentService } from "@/services/appointmentService";
import { Appointment } from "@shared/types";
import { calculateTotals } from "./utils/totals";
import ServiceItemForm from "./ServiceItemForm";
import { LaborCalculator } from "./LaborCalculator";
import { useQueryClient } from "@tanstack/react-query";
import SummaryStepForm from "./SummaryStepForm";
import ClientForm from "@/components/clients/ClientForm";

interface QuoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  quote?: Quote | null;
  defaultClientId?: string | null;
  readOnly?: boolean;
}

// Interfaccia per i dati aggiuntivi non presenti nello schema Quotes
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
export default function QuoteForm({ isOpen, onClose, onSuccess, quote, defaultClientId, readOnly = false }: QuoteFormProps) {
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
  
  // Stato per il ClientForm
  const [isClientFormOpen, setIsClientFormOpen] = useState<boolean>(false);
  
  // Aggiungiamo un flag per prevenire la chiusura accidentale del form
  const [preventAutoClose, setPreventAutoClose] = useState<boolean>(false);
  const [preventCloseUntilSave, setPreventCloseUntilSave] = useState<boolean>(false);
  
  // Stato per controllare se il preventivo è in modalità sola lettura per la regola
  const [isReadOnlyByRule, setIsReadOnlyByRule] = useState<boolean>(false);
  
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
      laborPrice: quote?.laborPrice !== undefined ? quote.laborPrice : 35,
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
      
      if (quoteExtra?.vin) {
        setVin(quoteExtra.vin);
        // console.log("✅ VIN caricato dal preventivo:", quoteExtra.vin);
      } else {
        setVin(""); // Reset se non presente nel preventivo
        // console.log("❌ Nessun VIN nel preventivo, cercando nel cliente...");
        
        // Se il preventivo ha un clientId, prova a caricare SOLO il VIN dal cliente
        if (quote.clientId) {
          // console.log("🔍 Caricamento VIN dal cliente:", quote.clientId);
          fetchClientVinOnly(quote.clientId);
        }
      }
      
      // console.log("📄 Debug preventivo:", {
      //   id: quote.id,
      //   clientId: quote.clientId,
      //   vinFromQuote: quoteExtra?.vin,
      //   currentVin: vin
      // });
    }
  }, [quote?.id]); // Dipende solo dall'ID del preventivo per evitare loop

  // Carica i clienti all'inizio - wrappato in useCallback
  const loadClients = useCallback(async () => {
    // Evita chiamate multiple se già caricati
    if (clients.length > 0) return;
    
    setIsLoading(true);
    try {
      const data = await getAllClients();
      setClients(data);
      
      // console.log("Clienti caricati:", data.length);
    } catch (error) {
      console.error("Errore nel caricamento dei clienti:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effetto per caricare i clienti al montaggio
  useEffect(() => {
    if (clients.length === 0) {
      loadClients();
    }
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
        if (client.plate) {
          form.setValue("plate", client.plate);
        }
        
        // Imposta il VIN dal cliente solo se non è già presente dal preventivo
        if (client.vin && !vin) {
          setVin(client.vin);
          // console.log("VIN caricato dal cliente:", client.vin);
        }
        
        // console.log("Cliente caricato:", {
        //   name: `${client.name} ${client.surname}`,
        //   vin: client.vin,
        //   currentVin: vin
        // });
      }
    } catch (error) {
      console.error("Errore nel caricamento del cliente:", error);
    }
  };
  
  // Funzione per recuperare SOLO il VIN dal cliente (senza sovrascrivere altri campi)
  const fetchClientVinOnly = async (id: string) => {
    try {
      const client = await getClientById(id);
      if (client && client.vin && !vin) {
        setVin(client.vin);
        setSelectedClient(client); // Imposta il cliente selezionato per la UI
        // console.log("VIN caricato dal cliente (solo VIN):", client.vin);
      }
    } catch (error) {
      console.error("Errore nel caricamento del VIN del cliente:", error);
    }
  };
  
  // Effetto per caricare il cliente dal preventivo esistente
  useEffect(() => {
    if (quote?.clientId && !selectedClient) {
      fetchClientById(quote.clientId);
    }
  }, [quote?.clientId]); // Solo quando cambia l'ID del cliente del preventivo
  
  // REGOLA: Controllo se il preventivo può essere modificato
  useEffect(() => {
    const checkQuoteEditability = async () => {
      if (quote && quote.status === "accettato") {
        try {
          const appointments = await getAllAppointments();
          const associatedAppointment = appointments.find(app => app.quoteId === quote.id);
          
          if (associatedAppointment && associatedAppointment.status === "in_lavorazione") {
            // Non chiudiamo più il form, ma impostiamo solo la modalità sola lettura
            setIsReadOnlyByRule(true);
            toast({
              title: "Preventivo in sola lettura",
              description: "Il preventivo è visualizzabile ma non modificabile perché l'appuntamento è in lavorazione.",
              variant: "default",
            });
          } else {
            setIsReadOnlyByRule(false);
          }
        } catch (error) {
          console.error("Errore nel controllo dell'editabilità del preventivo:", error);
        }
      } else {
        setIsReadOnlyByRule(false);
      }
    };

    if (isOpen && quote) {
      checkQuoteEditability();
    }
  }, [isOpen, quote?.id, quote?.status]);
  
  // Gestisce la selezione di un cliente
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    
    // Non impostiamo più automaticamente la targa
    // Lasciamo che l'utente scelga dal menu a tendina
    
    // Imposta il VIN dal cliente SOLO se non è già presente
    if (client.vin && !vin) {
      setVin(client.vin);
    }
    
    setIsSearching(false);
  };
  
  // Gestisce la rimozione del cliente selezionato
  const handleClearSelectedClient = () => {
    setSelectedClient(null);
    // NON svuotare i campi, lasciarli come sono per permettere la modifica
    // form.setValue("clientId", "");
    // form.setValue("clientName", "");
    // form.setValue("phone", "");
  };
  
  // Gestisce il successo del ClientForm
  const handleClientFormSuccess = () => {
    // Ricarica la lista dei clienti
    loadClients();
    toast({
      title: "Cliente creato",
      description: "Il nuovo cliente è stato creato con successo."
    });
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
  
  // Funzione per aggiornare gli items - SEMPLIFICATA
  const updateItems = useCallback((newItems: QuoteItem[]) => {
    try {
      // Aggiorna direttamente lo stato
      setItems([...newItems]);
      
      // console.log("Items aggiornati tramite updateItems:", newItems);
    } catch (error) {
      console.error("Errore durante l'aggiornamento degli items:", error);
    }
  }, []); // NESSUNA DIPENDENZA per evitare ricreazioni continue
  
  // Effetto per ricalcolare i totali ogni volta che cambiano items, laborHours o taxRate
  useEffect(() => {
    try {
      // Calcola immediatamente i totali per aggiornare il riepilogo
      const partsTotal = items.reduce((sum, item) => {
        return sum + (Array.isArray(item.parts) 
          ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
          : 0);
      }, 0);
      
      // Calcola manodopera extra - usa valori correnti
      const currentLaborPrice = form.getValues().laborPrice || 35;
      const extraLabor = currentLaborPrice * laborHours;
      
      // Subtotale
      const subtotal = partsTotal + extraLabor;
      
      // IVA
      const taxAmount = (subtotal * taxRate) / 100;
      
      // Totale finale
      const total = subtotal + taxAmount;
      
      // Aggiorna i totali immediatamente
      setSubTotals({
        subtotal,
        taxAmount,
        total,
        partsSubtotal: partsTotal,
        laborTotal: extraLabor
      });
      
      // console.log("Totali ricalcolati automaticamente:", {
      //   partsTotal,
      //   extraLabor,
      //   subtotal,
      //   taxAmount,
      //   total
      // });
    } catch (error) {
      console.error("Errore durante il ricalcolo dei totali:", error);
    }
  }, [items, laborHours, taxRate, form]); // Dipende da items, laborHours, taxRate e form
  
  // Funzione ottimizzata per l'aggiunta di parti
  const onAddPart = useCallback((serviceId: string, part: Omit<SparePart, "id">, index = -1) => {
    // Impedisci doppi click
    if (isProcessingAddPart) return;
    setIsProcessingAddPart(true);
    
    try {
      // Crea il nuovo ricambio con un ID unico
      const newPart: SparePart = {
        id: uuidv4(),
        category: part.category || "altro",
        code: part.code,
        description: part.description,
        name: part.name || part.description || part.code,
        brand: part.brand,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        finalPrice: part.finalPrice || part.unitPrice * part.quantity
      };
      
      // Aggiorna direttamente gli items esistenti
      setItems(currentItems => {
        const updatedItems = currentItems.map(item => {
          if (item.id === serviceId) {
            // Inizializza l'array delle parti se non esiste
            const parts = Array.isArray(item.parts) ? [...item.parts] : [];
            
            // Aggiungi il nuovo ricambio all'array delle parti
            if (index === -1) {
              parts.push(newPart);
            } else {
              parts.splice(index, 0, newPart);
            }
            
            // Ricalcola il totale del servizio - Solo ricambi, senza manodopera
            const partsTotal = parts.reduce(
              (sum: number, p: SparePart) => sum + (p.finalPrice || 0),
              0
            );
            
            // Il totalPrice dell'item è solo il costo dei ricambi
            return {
              ...item,
              parts,
              totalPrice: partsTotal
            };
          }
          return item;
        });
        
        // console.log("Items aggiornati con nuovo ricambio:", updatedItems);
        return updatedItems;
      });
    } catch (error) {
      console.error("Errore durante l'aggiunta del ricambio:", error);
    } finally {
      setIsProcessingAddPart(false);
    }
  }, [isProcessingAddPart]);
  
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
        // Aggiungiamo i subtotali separati
        partsSubtotal: partsSubtotal,
        laborTotal: laborTotal
      };
      
      // console.log("Inizio salvataggio preventivo...");
      
      // Salvataggio preventivo
      let savedQuote: Quote | null = null;
      if (quote?.id) {
        // Aggiornamento preventivo esistente
        try {
          savedQuote = await updateQuote(quote.id, quoteToSave);
          toast({
            title: "Preventivo aggiornato",
            description: "Il preventivo è stato aggiornato con successo."
          });
          
          // FIX FOCUS: Forza l'aggiornamento dei valori nei campi input dopo il salvataggio
          if (savedQuote) {
            setTimeout(() => {
              forceUpdateInputValues({
                'extraLaborHours': savedQuote!.laborHours || 0,
                'extraLaborRate': savedQuote!.laborPrice || 35,
                'taxRate': (savedQuote as any)?.taxRate || 22
              });
              console.log("✅ Valori dei campi input aggiornati forzatamente dopo il salvataggio");
            }, 100);
          }
          
        } catch (error: any) {
          console.error("Errore durante l'aggiornamento:", error);
          
          // Gestione specifica per errore PGRST116
          if (error.message && error.message.includes("non esiste più nel database")) {
            toast({
              variant: "destructive",
              title: "Preventivo non trovato",
              description: "Il preventivo non esiste più nel database. Potrebbe essere stato eliminato. La pagina verrà ricaricata.",
              duration: 5000,
            });
            // Ricarica la pagina dopo 2 secondi
            setTimeout(() => {
              window.location.reload();
            }, 2000);
            return;
          } else if (error.message && error.message.includes("non può essere aggiornato")) {
            toast({
              variant: "destructive",
              title: "Errore di aggiornamento",
              description: "Il preventivo non può essere aggiornato. Prova a ricaricare la pagina.",
              duration: 5000,
            });
            return;
          }
          
          // Altri tipi di errore
          toast({
            variant: "destructive",
            title: "Errore durante il salvataggio",
            description: error.message || "Si è verificato un errore imprevisto. Riprova.",
            duration: 5000,
          });
          return;
        }
      } else {
        // Creazione nuovo preventivo
        try {
          savedQuote = await createQuote(quoteToSave);
          toast({
            title: "Preventivo creato",
            description: "Il preventivo è stato creato con successo."
          });
          
          // FIX FOCUS: Forza l'aggiornamento dei valori nei campi input dopo il salvataggio
          if (savedQuote) {
            setTimeout(() => {
              forceUpdateInputValues({
                'extraLaborHours': savedQuote!.laborHours || 0,
                'extraLaborRate': savedQuote!.laborPrice || 35,
                'taxRate': (savedQuote as any)?.taxRate || 22
              });
              console.log("✅ Valori dei campi input aggiornati forzatamente dopo la creazione");
            }, 100);
          }
        } catch (error: any) {
          console.error("Errore durante la creazione:", error);
          toast({
            variant: "destructive",
            title: "Errore durante la creazione",
            description: error.message || "Si è verificato un errore durante la creazione del preventivo. Riprova.",
            duration: 5000,
          });
          return;
        }
      }
      
      // console.log("Preventivo salvato, aggiornamento cache...");
      
      // Aggiornamento cache completo - invalida tutte le query pertinenti
      try {
        await Promise.all([
          // Query principali
          queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/statistics'] }),
          // Query specifiche per cliente - importante per aggiornare i preventivi negli appuntamenti
          queryClient.invalidateQueries({ queryKey: ['/quotes/client'] }),
          // Query per appuntamenti che potrebbero dipendere dai preventivi
          queryClient.invalidateQueries({ queryKey: ['/appointments'] })
        ]);
        // console.log("Cache aggiornata con successo (tutte le query)");
      } catch (cacheError) {
        // console.warn("Errore nell'aggiornamento cache:", cacheError);
      }
      
      // Successo - chiama callback e chiudi modale
      if (onSuccess) {
        // console.log("Chiamando onSuccess...");
        try {
          // Aspetta il completamento dell'aggiornamento dell'UI
          await onSuccess();
          // console.log("onSuccess completato con successo");
        } catch (successError) {
          console.error("Errore nel callback onSuccess:", successError);
          // Continua comunque con la chiusura
        }
      }
      onClose();
      
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del preventivo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtra i clienti in base alla query di ricerca
  const filteredClients = clients.filter((client) => {
    const fullName = `${client.name} ${client.surname}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return (
      fullName.includes(query) || 
      (client.phone && client.phone.includes(query)) || 
      (client.plate && client.plate.toLowerCase().includes(query))
    );
  });
  
  // Stato per il passaggio corrente - se è una modifica, andiamo direttamente allo step 3 (riepilogo)
  const initialStep: number = quote ? 3 : 1;
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const totalSteps = 3;
  
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
  
  // Miglioro lo scroll nella pagina di riepilogo (Passo 3)
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

  // Calcola se il form è in modalità sola lettura (combinando prop e regola)
  const isFormReadOnly = readOnly || isReadOnlyByRule;

  return (
    <Dialog 
      open={isOpen && !isClientFormOpen} 
      onOpenChange={(open) => {
        // Se il flag preventCloseUntilSave è attivo, impedisci completamente la chiusura
        if (!open && preventCloseUntilSave) {
          // console.log("Tentativo di chiusura bloccato - operazione di modifica in corso");
          return;
        }
        
        // Controlliamo se dobbiamo prevenire la chiusura a causa del click sulla matita
        if (!open && preventAutoClose) {
          // Resettiamo il flag ma non chiudiamo il form
          setPreventAutoClose(false);
          return;
        }
        
        // Se stiamo modificando un preventivo nel passaggio 3 (inserimento ricambi) e NON siamo in sola lettura, 
        // conferma prima di chiudere
        if (!open && currentStep === 3 && !isFormReadOnly) {
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
        className="max-w-4xl max-h-[95vh] overflow-visible p-0 bg-gray-900 text-white border border-gray-700 scrollbar-hide z-[1100]"
        aria-describedby="quote-form-description"
        onClick={(e) => {
          // Ferma la propagazione dell'evento per evitare chiusure accidentali
          e.stopPropagation();
        }}
      >
        <DialogHeader className="px-4 py-3 sticky top-0 bg-gray-900 z-30 border-b border-gray-700">
          <DialogTitle className="text-orange-500">
            {isFormReadOnly 
              ? `Visualizza Preventivo ${isReadOnlyByRule ? '(Solo Lettura)' : ''}` 
              : quote ? "Modifica Preventivo" : "Nuovo Preventivo"
            }
          </DialogTitle>
          <DialogDescription id="quote-form-description" className="text-xs text-gray-400">
            {isFormReadOnly 
              ? "Preventivo visualizzabile ma non modificabile" 
              : quote ? "Aggiorna i dettagli del preventivo" : "Crea un nuovo preventivo per un cliente"
            }
          </DialogDescription>
          <button 
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-gray-400 hover:text-orange-400" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Chiudi</span>
          </button>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[calc(95vh-110px)] overflow-auto px-4 py-2 bg-gray-900 scrollbar-hide">
            {/* STEP 1: Dati Cliente */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Header compatto */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Dati Cliente e Veicolo</h2>
                  <div className="text-xs text-orange-400 bg-orange-500/20 px-2 py-1 rounded-full border border-orange-500/30">
                    Passo 1 di 3
                  </div>
                </div>
                
                {/* Contenuto del passo */}
                <div className="space-y-3">
                  {selectedClient ? (
                    /* Cliente Selezionato - Layout Compatto */
                    <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                            <h3 className="text-base font-medium text-orange-400">Cliente Selezionato</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-300">
                              <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
                              <span className="text-white font-medium">{selectedClient.name} {selectedClient.surname}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-300">
                              <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
                              <span className="text-gray-200">{selectedClient.phone}</span>
                            </div>
                          </div>
                          
                          {/* Selezione Veicolo - Compatta */}
                          <div className="mt-3 pt-3 border-t border-blue-500/30">
                            <label className="block text-xs font-medium text-orange-400 mb-2">
                              Seleziona Veicolo
                            </label>
                            <select 
                              value={form.watch("plate") || ""} 
                              onChange={(e) => {
                                const value = e.target.value;
                                form.setValue("plate", value);
                                
                                // Trova il veicolo selezionato
                                const selectedVehicle = selectedClient.vehicles?.find(v => v.plate === value);
                                
                                if (selectedVehicle) {
                                  // Se il veicolo è nell'array vehicles, usa i suoi dati
                                  if (selectedVehicle.vin) {
                                    setVin(selectedVehicle.vin);
                                  }
                                  // Aggiorna anche il campo legacy plate del cliente
                                  if (selectedClient.plate !== value) {
                                    // Aggiorna il cliente nel database
                                    updateClient(selectedClient.id, {
                                      plate: value,
                                      vin: selectedVehicle.vin || ""
                                    }).catch((error: Error) => {
                                      console.error("Errore nell'aggiornamento della targa legacy:", error);
                                    });
                                  }
                                } else if (selectedClient.plate === value && selectedClient.vin) {
                                  // Fallback al campo legacy se necessario
                                  setVin(selectedClient.vin);
                                }
                              }}
                              className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 hover:border-orange-400 transition-colors"
                            >
                              <option value="" disabled className="text-gray-400 bg-gray-800">Seleziona una targa...</option>
                              {/* Veicoli dall'array vehicles (priorità) */}
                              {selectedClient.vehicles && selectedClient.vehicles.length > 0 ? (
                                selectedClient.vehicles.map((vehicle, index) => (
                                  <option 
                                    key={`vehicle-${index}`} 
                                    value={vehicle.plate}
                                    className="bg-gray-800 text-white"
                                  >
                                    {vehicle.plate} {vehicle.vin ? `(VIN: ${vehicle.vin.substring(0, 8)}...)` : ''}
                                  </option>
                                ))
                              ) : (
                                /* Fallback al campo legacy se non ci sono veicoli nell'array */
                                selectedClient.plate && (
                                  <option 
                                    key="legacy-plate" 
                                    value={selectedClient.plate}
                                    className="bg-gray-800 text-white"
                                  >
                                    {selectedClient.plate} {selectedClient.vin ? `(VIN: ${selectedClient.vin.substring(0, 8)}...)` : ''}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                        
                        <Button 
                          type="button" 
                          variant="outline"
                          size="sm"
                          onClick={handleClearSelectedClient}
                          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 text-xs px-3 py-1"
                        >
                          Cambia
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Selezione Cliente - Layout Migliorato */
                    <div className="space-y-3">
                      {/* Cerca Cliente Esistente */}
                      <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                          <h3 className="text-sm font-medium text-orange-400">Cerca Cliente Esistente</h3>
                        </div>
                        
                        <div className="relative">
                          <Input
                            placeholder="Cerca per nome, targa o telefono..."
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setIsSearching(e.target.value.length > 0);
                              setSelectedIndex(-1);
                            }}
                            onKeyDown={(e) => {
                              if (isSearching && filteredClients.length > 0) {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setSelectedIndex(prev => 
                                    prev < filteredClients.length - 1 ? prev + 1 : prev
                                  );
                                }
                                else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
                                }
                                else if (e.key === 'Enter' && selectedIndex >= 0) {
                                  e.preventDefault();
                                  handleSelectClient(filteredClients[selectedIndex]);
                                }
                                else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setIsSearching(false);
                                }
                              }
                            }}
                            className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-400 text-sm py-2 focus:border-orange-400 focus:ring-orange-400/30 transition-colors"
                          />
                          {isSearching && (
                            <div className="absolute top-full mt-1 left-0 right-0 border border-gray-600 rounded-md bg-gray-800 shadow-lg z-10 max-h-40 overflow-y-auto">
                              {filteredClients.length === 0 ? (
                                <div className="p-2 text-center text-xs text-gray-400">
                                  Nessun cliente trovato
                                </div>
                              ) : (
                                <div>
                                  {filteredClients.map((client, index) => (
                                    <div
                                      key={client.id}
                                      className={`p-2 cursor-pointer flex justify-between items-center text-xs transition-colors ${
                                        selectedIndex === index ? "bg-orange-500/15 border-orange-400/50" : "hover:bg-gray-700/60"
                                      }`}
                                      onClick={() => handleSelectClient(client)}
                                    >
                                      <div>
                                        <div className="font-medium text-white">
                                          {client.name} {client.surname}
                                        </div>
                                        <div className="text-gray-300">
                                          {client.plate}
                                        </div>
                                      </div>
                                      <div className="text-gray-300">
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
                      
                      {/* Separatore */}
                      <div className="flex items-center justify-center my-3">
                        <div className="border-t border-gray-600 flex-1"></div>
                        <span className="px-3 text-orange-400 text-xs font-medium">OPPURE</span>
                        <div className="border-t border-gray-600 flex-1"></div>
                      </div>
                      
                      {/* Nuovo Cliente */}
                      <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                          <h3 className="text-sm font-medium text-orange-400">Crea Nuovo Cliente</h3>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-gray-300 text-xs mb-3">
                            Non hai trovato il cliente che stai cercando?
                          </p>
                          <Button
                            type="button"
                            onClick={() => setIsClientFormOpen(true)}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-xs flex items-center gap-2 mx-auto transition-colors border border-orange-500"
                          >
                            <UserPlus className="h-3 w-3" />
                            Crea Nuovo Cliente
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Bottoni di navigazione */}
                <div className="flex justify-end pt-4 border-t border-gray-700">
                  <Button 
                    type="button" 
                    onClick={goToNextStep}
                    disabled={!isStep1Valid()}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-sm"
                  >
                    Avanti
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* STEP 2: Ricambi e Servizi - FORM UNIFICATO */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Header uniforme per tutti i passi */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white">Ricambi e Servizi</h2>
                  <div className="text-sm text-orange-400 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30">
                    Passo 2 di 3
                  </div>
                </div>
                
                {/* Contenuto del passo */}
                <div className="space-y-4">
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
                
                {/* Bottoni di navigazione uniforme */}
                <div className="flex justify-between items-center pt-6 border-t border-gray-700">
                  <Button 
                    type="button" 
                    onClick={goToPreviousStep}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Indietro
                  </Button>
                  <Button 
                    type="button" 
                    onClick={goToNextStep}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700"
                  >
                    Avanti
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* STEP 3: Riepilogo e Conferma */}
            {currentStep === 3 && (
              <div className="space-y-4">
                {/* Contenuto del passo */}
                <div>
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
                </div>
                
                {/* Bottoni di navigazione uniforme */}
                <div className="flex justify-between items-center gap-4 border-t border-gray-700 mt-4 pt-2">
                  <Button 
                    type="button" 
                    onClick={goToPreviousStep}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Indietro
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || isFormReadOnly}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvataggio...
                      </>
                    ) : isFormReadOnly ? "Solo Lettura" : quote ? "Aggiorna Preventivo" : "Crea Preventivo"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
      
      {/* ClientForm Dialog */}
      <ClientForm
        isOpen={isClientFormOpen}
        onClose={() => setIsClientFormOpen(false)}
        onSuccess={() => {
          handleClientFormSuccess();
          setIsClientFormOpen(false);
        }}
      />
    </Dialog>
  );
}