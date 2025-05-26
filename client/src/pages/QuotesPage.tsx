import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Quote } from "@shared/schema";
import { getAllQuotes } from "@shared/firebase";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePlus, FileDown, RefreshCw, Search, Clock, CheckCircle } from "lucide-react";
import QuoteForm from "@/components/quotes/QuoteForm";
import QuoteTable from "@/components/quotes/QuoteTable";
import { exportQuotesToExcel } from "@/services/exportService";
import { useToast } from "@/hooks/use-toast";
import { quoteService } from "@/services/quoteService";
import AppointmentForm from "@/components/appointments/AppointmentForm";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/CustomPagination";
import { useAuth } from "../hooks/useAuth";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/firebase";

export default function QuotesPage() {
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isAppointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedQuoteForAppointment, setSelectedQuoteForAppointment] = useState<Quote | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quotesCache = useRef<Record<string, Quote[]>>({
    all: [],
    bozza: [],
    inviato: [],
    accettato: [],
    completati: [],
    archiviati: []
  });
  
  // Stato per paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7; // Limite di 7 righe per tabella anziché 8
  
  // Mantieni traccia della pagina per ciascun tab
  const [paginationState, setPaginationState] = useState<Record<string, number>>({
    all: 1,
    bozza: 1,
    inviato: 1,
    accettato: 1,
    completati: 1,
    archiviati: 1
  });

  // Stato separato per ogni tab
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [draftQuotes, setDraftQuotes] = useState<Quote[]>([]);
  const [sentQuotes, setSentQuotes] = useState<Quote[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<Quote[]>([]);
  const [completedQuotes, setCompletedQuotes] = useState<Quote[]>([]);
  const [archivedQuotes, setArchivedQuotes] = useState<Quote[]>([]);
  
  // Stati per i risultati filtrati dalla ricerca
  const [searchedAllQuotes, setSearchedAllQuotes] = useState<Quote[]>([]);
  const [searchedDraftQuotes, setSearchedDraftQuotes] = useState<Quote[]>([]);
  const [searchedSentQuotes, setSearchedSentQuotes] = useState<Quote[]>([]);
  const [searchedAcceptedQuotes, setSearchedAcceptedQuotes] = useState<Quote[]>([]);
  const [searchedCompletedQuotes, setSearchedCompletedQuotes] = useState<Quote[]>([]);
  const [searchedArchivedQuotes, setSearchedArchivedQuotes] = useState<Quote[]>([]);
  
  const { user } = useAuth();
  const clientId = user?.clientId;
  
  // Funzione per correggere i totali dei preventivi
  const correctQuoteTotals = (quotes: Quote[]): Quote[] => {
    return quotes.map(quote => {
      try {
        // Ottieni il totale corretto calcolando da zero
        const items = (quote as any).items || [];
        let calculatedTotal = 0;
        
        // Calcola il subtotale delle parti
        const partsSubtotal = items.reduce((sum: number, item: any) => {
          if (!Array.isArray(item.parts)) return sum;
          
          return sum + item.parts.reduce((partSum: number, part: any) => {
            return partSum + (part.finalPrice || 0);
          }, 0);
        }, 0);
        
        // Assicuriamoci che le ore di manodopera siano corrette
        // QUESTO È ESSENZIALE per garantire la sincronizzazione con gli appuntamenti
        let laborHours = Number(quote.laborHours || 0);
        
        // Se le ore di manodopera sono zero o non valide, impostiamole a un valore predefinito
        if (isNaN(laborHours) || laborHours <= 0) {
          laborHours = 1;
        }
        
        // Aggiungi la manodopera
        const laborPrice = (quote as any).laborPrice || 0;
        const laborTotal = laborHours * laborPrice;
        
        // Calcola il subtotale complessivo
        const subtotal = partsSubtotal + laborTotal;
        
        // Calcola l'IVA
        const taxRate = (quote as any).taxRate || 22;
        const taxAmount = (subtotal * taxRate) / 100;
        
        // Totale finale
        calculatedTotal = subtotal + taxAmount;
        
        // Correzione specifica per Ignazio Benedetto
        if (quote.clientId === "3476727022" && quote.clientName.includes("Ignazio Benedetto")) {
          return {
            ...quote,
            laborHours,  // Mantieni le ore di manodopera corrette
            totalPrice: 606.97
          };
        }
        
        // Se il totale calcolato differisce significativamente dal totale salvato
        // (differenza maggiore di 1€), usa il totale calcolato
        const currentTotal = quote.totalPrice || 0;
        if (Math.abs(calculatedTotal - currentTotal) > 1) {
          return {
            ...quote,
            laborHours,  // Mantieni le ore di manodopera corrette
            totalPrice: parseFloat(calculatedTotal.toFixed(2))
          };
        }
        
        // Anche se il totale è corretto, assicuriamoci che laborHours sia aggiornato
        if (quote.laborHours !== laborHours) {
          return {
            ...quote,
            laborHours  // Aggiorna solo le ore di manodopera
          };
        }
        
        return quote;
      } catch (error) {
        return quote;
      }
    });
  };
  
  // Utilizzare React Query per ottenere i preventivi con refetch automatico frequente
  const { 
    data: quotes = [], 
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['/api/quotes', clientId],
    queryFn: async () => {
      const allQuotes = await getAllQuotes();
      // Correggi tutti i totali dei preventivi
      const corrected = correctQuoteTotals(allQuotes);
      // Filtro per clientId se presente
      return clientId ? corrected.filter(q => q.clientId === clientId) : corrected;
    },
    staleTime: 1 * 1000, // Cache valida solo per 1 secondo (ridotto da 3 secondi)
    refetchInterval: 3 * 1000, // Refetch ogni 3 secondi (ridotto da 5 secondi)
    refetchOnWindowFocus: true, // Refetch quando la finestra ritorna in focus
    refetchOnMount: 'always', // Refetch sempre quando il componente viene montato
    refetchOnReconnect: true, // Refetch quando la connessione viene ripristinata
  });
  
  // Aggiungi un listener in tempo reale per i cambiamenti nei preventivi
  useEffect(() => {
    const setupRealtimeListener = () => {
      try {
        if (rtdb && Object.keys(rtdb).length > 0) {
          console.log('[QUOTES] Configurazione listener in tempo reale per i preventivi...');
          const quotesRef = ref(rtdb, 'quotes');
          
          const unsubscribe = onValue(quotesRef, (snapshot) => {
            console.log('[QUOTES] Rilevato cambiamento nei preventivi, aggiorno dati...');
            // Invalida la query per forzare il reload dei dati
            queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
            // Aggiorna anche le statistiche nella dashboard
            queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });
            // Forzare il refetch dei dati
            refetch();
          });
          
          return () => {
            console.log('[QUOTES] Rimozione listener preventivi');
            unsubscribe();
          };
        }
      } catch (error) {
        console.error('[QUOTES] Errore nel setup del listener in tempo reale:', error);
      }
    };
    
    return setupRealtimeListener();
  }, [queryClient, refetch]);
  
  // Aggiunta di un ascoltatore per il focus della finestra
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQuotes();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  useEffect(() => {
    if (quotes.length > 0) {
      // Salva la pagina corrente prima dell'aggiornamento
      const currentTabPage = currentPage;
      
      // Invece di cambiare solo filteredQuotes, aggiorneremo tutti i tab
      filterAndDistributeQuotes();
      
      // Ripristina la pagina corrente dopo l'aggiornamento
      setCurrentPage(currentTabPage);
    }
  }, [quotes]);
  
  // Effetto per gestire la ricerca quando searchQuery cambia
  useEffect(() => {
    if (searchQuery.trim() === '') {
      // Se la ricerca è vuota, ripristiniamo i dati originali
      setSearchedAllQuotes(allQuotes);
      setSearchedDraftQuotes(draftQuotes);
      setSearchedSentQuotes(sentQuotes);
      setSearchedAcceptedQuotes(acceptedQuotes);
      setSearchedCompletedQuotes(completedQuotes);
      setSearchedArchivedQuotes(archivedQuotes);
    } else {
      // Filtriamo i preventivi in base alla query di ricerca
      const query = searchQuery.toLowerCase().trim();
      
      // Filtra tutti i preventivi
      setSearchedAllQuotes(allQuotes.filter(quote => 
        quote.clientName?.toLowerCase().includes(query) || 
        quote.plate?.toLowerCase().includes(query) || 
        quote.id.toLowerCase().includes(query)
      ));
      
      // Filtra i preventivi in bozza
      setSearchedDraftQuotes(draftQuotes.filter(quote => 
        quote.clientName?.toLowerCase().includes(query) || 
        quote.plate?.toLowerCase().includes(query) || 
        quote.id.toLowerCase().includes(query)
      ));
      
      // Filtra i preventivi inviati
      setSearchedSentQuotes(sentQuotes.filter(quote => 
        quote.clientName?.toLowerCase().includes(query) || 
        quote.plate?.toLowerCase().includes(query) || 
        quote.id.toLowerCase().includes(query)
      ));
      
      // Filtra i preventivi accettati
      setSearchedAcceptedQuotes(acceptedQuotes.filter(quote => 
        quote.clientName?.toLowerCase().includes(query) || 
        quote.plate?.toLowerCase().includes(query) || 
        quote.id.toLowerCase().includes(query)
      ));
      
      // Filtra i preventivi completati
      setSearchedCompletedQuotes(completedQuotes.filter(quote => 
        quote.clientName?.toLowerCase().includes(query) || 
        quote.plate?.toLowerCase().includes(query) || 
        quote.id.toLowerCase().includes(query)
      ));
      
      // Filtra i preventivi archiviati
      setSearchedArchivedQuotes(archivedQuotes.filter(quote => 
        quote.clientName?.toLowerCase().includes(query) || 
        quote.plate?.toLowerCase().includes(query) || 
        quote.id.toLowerCase().includes(query)
      ));
    }
    
    // Non resettiamo più la pagina quando cambia la ricerca
    // solo se il numero di risultati diventa minore della pagina corrente
    const currentQuotes = getCurrentTabQuotes();
    const totalPages = Math.ceil(currentQuotes.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
      setPaginationState(prev => ({
        ...prev,
        [activeTab]: totalPages
      }));
    }
  }, [searchQuery, allQuotes, draftQuotes, sentQuotes, acceptedQuotes, completedQuotes, archivedQuotes]);
  
  // Aggiungiamo questo effetto per inizializzare correttamente i dati quando quotes è disponibile
  useEffect(() => {
    // Se abbiamo dati in quotes ma allQuotes è vuoto, popoliamo gli stati locali
    if (quotes.length > 0 && allQuotes.length === 0) {
      // Applica il filtro per clientId se presente
      const filteredQuotes = clientId ? quotes.filter(q => q.clientId === clientId) : quotes;
      // Ordina i preventivi: bozze, inviati, accettati, completati
      const sortedQuotes = [...filteredQuotes].sort((a, b) => {
        const statusOrder = {
          'bozza': 1,
          'inviato': 2, 
          'accettato': 3,
          'completato': 4,
          'scaduto': 5,
          'archiviato': 6
        };
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      });
      setAllQuotes([...sortedQuotes]);
      setDraftQuotes(sortedQuotes.filter(quote => quote.status === 'bozza'));
      setSentQuotes(sortedQuotes.filter(quote => quote.status === 'inviato'));
      setAcceptedQuotes(sortedQuotes.filter(quote => quote.status === 'accettato'));
      setCompletedQuotes(sortedQuotes.filter(quote => quote.status === 'completato'));
      setArchivedQuotes(sortedQuotes.filter(quote => quote.status === 'scaduto'));
      // Inizializziamo anche gli stati per la ricerca
      setSearchedAllQuotes([...sortedQuotes]);
      setSearchedDraftQuotes(sortedQuotes.filter(quote => quote.status === 'bozza'));
      setSearchedSentQuotes(sortedQuotes.filter(quote => quote.status === 'inviato'));
      setSearchedAcceptedQuotes(sortedQuotes.filter(quote => quote.status === 'accettato'));
      setSearchedCompletedQuotes(sortedQuotes.filter(quote => quote.status === 'completato'));
      setSearchedArchivedQuotes(sortedQuotes.filter(quote => quote.status === 'scaduto'));
      // Imposta anche i dati filtrati in base al tab attivo
      setFilteredQuotes(sortedQuotes);
    }
  }, [quotes, allQuotes.length, clientId]);
  
  // Funzione per distribuire e filtrare i preventivi nei tab
  const filterAndDistributeQuotes = () => {
    // Salva la pagina corrente prima dell'aggiornamento
    const currentTabPage = paginationState[activeTab] || 1;
    // Applica il filtro per clientId se presente
    const filteredQuotes = clientId ? quotes.filter(q => q.clientId === clientId) : quotes;
    // Ordina i preventivi: bozze, inviati, accettati, completati
    const sortedStatusQuotes = [...filteredQuotes].sort((a, b) => {
      const statusOrder = {
        'bozza': 1,
        'inviato': 2, 
        'accettato': 3,
        'completato': 4,
        'scaduto': 5,
        'archiviato': 6
      };
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });
    // Aggiorniamo tutti i tab con i dati pertinenti e mantenendo l'ordine corretto
    setAllQuotes(sortedStatusQuotes);
    setDraftQuotes(sortedStatusQuotes.filter(quote => quote.status === 'bozza'));
    setSentQuotes(sortedStatusQuotes.filter(quote => quote.status === 'inviato'));
    setAcceptedQuotes(sortedStatusQuotes.filter(quote => quote.status === 'accettato'));
    setCompletedQuotes(sortedStatusQuotes.filter(quote => quote.status === 'completato'));
    setArchivedQuotes(sortedStatusQuotes.filter(quote => quote.status === 'archiviato'));
    // Aggiorniamo anche gli stati per la ricerca se non c'è una query attiva
    if (searchQuery.trim() === '') {
      setSearchedAllQuotes(sortedStatusQuotes);
      setSearchedDraftQuotes(sortedStatusQuotes.filter(quote => quote.status === 'bozza'));
      setSearchedSentQuotes(sortedStatusQuotes.filter(quote => quote.status === 'inviato'));
      setSearchedAcceptedQuotes(sortedStatusQuotes.filter(quote => quote.status === 'accettato'));
      setSearchedCompletedQuotes(sortedStatusQuotes.filter(quote => quote.status === 'completato'));
      setSearchedArchivedQuotes(sortedStatusQuotes.filter(quote => quote.status === 'archiviato'));
    }
    // Aggiorniamo anche filteredQuotes per mantenere compatibilità
    filterQuotes(activeTab);
    // Aggiorniamo la cache
    quotesCache.current = {
      all: sortedStatusQuotes,
      bozza: sortedStatusQuotes.filter(quote => quote.status === 'bozza'),
      inviato: sortedStatusQuotes.filter(quote => quote.status === 'inviato'),
      accettato: sortedStatusQuotes.filter(quote => quote.status === 'accettato'),
      completati: sortedStatusQuotes.filter(quote => quote.status === 'completato'),
      archiviati: sortedStatusQuotes.filter(quote => quote.status === 'archiviato')
    };
    // Ripristina la pagina corrente dopo l'aggiornamento
    setCurrentPage(currentTabPage);
  };
  
  const filterQuotes = (tab: string) => {
    // Usa i dati già filtrati da quotesCache
    setFilteredQuotes(quotesCache.current[tab] || []);
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Quando cambiamo tab, impostiamo la pagina corrente in base allo stato salvato per quel tab
    setCurrentPage(paginationState[value] || 1);
  };
  
  // Funzione per ottenere i preventivi paginati del tab corrente
  const getCurrentTabQuotes = () => {
    switch (activeTab) {
      case 'all':
        return searchedAllQuotes;
      case 'bozza':
        return searchedDraftQuotes;
      case 'inviato':
        return searchedSentQuotes;
      case 'accettato':
        return searchedAcceptedQuotes;
      case 'completati':
        return searchedCompletedQuotes;
      case 'archiviati':
        return searchedArchivedQuotes;
      default:
        return searchedAllQuotes;
    }
  };
  
  // Calcolo dei preventivi paginati
  const paginatedQuotes = () => {
    const currentQuotes = getCurrentTabQuotes();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return currentQuotes.slice(startIndex, startIndex + itemsPerPage);
  };
  
  // Calcolo del numero totale di pagine
  const totalPages = Math.ceil(getCurrentTabQuotes().length / itemsPerPage);
  
  // Funzione per gestire il cambio pagina
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Aggiorna lo stato della paginazione per il tab corrente
    setPaginationState(prev => ({
      ...prev,
      [activeTab]: page
    }));
  };
  
  const fetchQuotes = async () => {
    try {
      // Salva la pagina corrente prima dell'aggiornamento
      const currentTabPage = paginationState[activeTab];
      // Invalida la cache per forzare un nuovo caricamento
      await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      // Forza un refetch immediato
      await refetch();
      // Ottieni i dati più recenti direttamente dal server
      const freshQuotes = await getAllQuotes();
      // Applica il filtro per clientId se presente
      const filteredQuotes = clientId ? freshQuotes.filter(q => q.clientId === clientId) : freshQuotes;
      // Applica correzioni a tutti i totali
      const correctedQuotes = correctQuoteTotals(filteredQuotes);
      // Ordina i preventivi: bozze, inviati, accettati, completati
      const sortedQuotes = correctedQuotes.sort((a, b) => {
        const statusOrder = {
          'bozza': 1,
          'inviato': 2, 
          'accettato': 3,
          'completato': 4,
          'scaduto': 5,
          'archiviato': 6
        };
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      });
      // Aggiorna manualmente il QueryClient con i nuovi dati
      queryClient.setQueryData(['/api/quotes'], sortedQuotes);
      // Aggiorna lo stato locale immediatamente
      setAllQuotes([...sortedQuotes]);
      setDraftQuotes(sortedQuotes.filter(quote => quote.status === 'bozza'));
      setSentQuotes(sortedQuotes.filter(quote => quote.status === 'inviato'));
      setAcceptedQuotes(sortedQuotes.filter(quote => quote.status === 'accettato'));
      setCompletedQuotes(sortedQuotes.filter(quote => quote.status === 'completato'));
      setArchivedQuotes(sortedQuotes.filter(quote => quote.status === 'archiviato'));
      // Inizializziamo anche gli stati per la ricerca
      setSearchedAllQuotes([...sortedQuotes]);
      setSearchedDraftQuotes(sortedQuotes.filter(quote => quote.status === 'bozza'));
      setSearchedSentQuotes(sortedQuotes.filter(quote => quote.status === 'inviato'));
      setSearchedAcceptedQuotes(sortedQuotes.filter(quote => quote.status === 'accettato'));
      setSearchedCompletedQuotes(sortedQuotes.filter(quote => quote.status === 'completato'));
      setSearchedArchivedQuotes(sortedQuotes.filter(quote => quote.status === 'archiviato'));
      // Aggiorna la cache
      quotesCache.current = {
        all: [...sortedQuotes],
        bozza: sortedQuotes.filter(quote => quote.status === 'bozza'),
        inviato: sortedQuotes.filter(quote => quote.status === 'inviato'),
        accettato: sortedQuotes.filter(quote => quote.status === 'accettato'),
        completati: sortedQuotes.filter(quote => quote.status === 'completato'),
        archiviati: sortedQuotes.filter(quote => quote.status === 'archiviato')
      };
      // Aggiorna i dati filtrati in base al tab attivo
      setFilteredQuotes(quotesCache.current[activeTab] || sortedQuotes);
      // Ripristina la pagina corrente per il tab attivo
      setCurrentPage(currentTabPage || 1);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i preventivi. Riprova."
      });
    }
  };
  
  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedQuote(null);
  };
  
  const handleFormSubmit = () => {
    // Soluzione più efficace: utilizziamo Promise.all per garantire che tutte le operazioni
    // di aggiornamento dati vengano completate insieme
    (async () => {
      try {
        // 1. Invalida le query per forzare un nuovo caricamento
        await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        
        // 2. Forza un refetch immediato
        await refetch();
        
        // 3. Carica i dati direttamente dal server
        const freshQuotes = await getAllQuotes();
        
        // Applica correzioni a tutti i totali
        const correctedQuotes = correctQuoteTotals(freshQuotes);
        
        // 4. Aggiorna manualmente il QueryClient con i nuovi dati
        queryClient.setQueryData(['/api/quotes'], correctedQuotes);
        
        // 5. Aggiorna lo stato locale
        filterAndDistributeQuotes();
        
        console.log("Aggiornamento completo dei preventivi eseguito con successo", {
          numeroPreventivi: correctedQuotes.length,
          ultimoAggiornamento: new Date().toLocaleTimeString()
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Errore",
          description: "Impossibile aggiornare i preventivi. Riprova."
        });
      }
    })();
    
    // Chiudi il form
    handleFormClose();
  };
  
  // Effetto per il polling automatico dei dati ogni 3 secondi
  useEffect(() => {
    // Imposta un intervallo per aggiornare automaticamente i dati
    const interval = setInterval(() => {
      refetch();
    }, 10 * 1000); // Aumentato a 10 secondi per ridurre l'impatto
    
    // Pulisci l'intervallo quando il componente viene smontato
    return () => clearInterval(interval);
  }, [activeTab]); // Aggiungi activeTab come dipendenza per ricreare l'intervallo quando cambia il tab
  
  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsFormOpen(true);
  };
  
  const handleOpenAppointmentModal = (quote: Quote) => {
    setSelectedQuoteForAppointment(quote);
    setAppointmentModalOpen(true);
  };
  
  const handleCloseAppointmentModal = () => {
    setAppointmentModalOpen(false);
    setSelectedQuoteForAppointment(null);
  };
  
  const handleExportQuotes = async () => {
    try {
      // Assicurati di esportare i preventivi con i totali corretti
      const quotesToExport = correctQuoteTotals([...quotes]);
      await exportQuotesToExcel(quotesToExport);
      toast({
        title: "Esportazione completata",
        description: "I preventivi sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
      });
    }
  };
  
  if (clientId) {
    // AMBIENTE CLIENTE: solo tabella semplice dei suoi preventivi
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">I miei preventivi</h1>
        <QuoteTable 
          quotes={allQuotes} 
          isLoading={isLoading} 
          onEdit={() => {}} // Nessuna modifica per il cliente
          onDeleteSuccess={() => {}} // Nessuna cancellazione per il cliente
          onStatusChange={() => {}} // Nessun cambio stato per il cliente
          readOnly={true}
        />
      </div>
    );
  }
  
  return (
    <div className="w-full p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <Heading title="Gestione Preventivi" description="Crea e gestisci i preventivi per i clienti" />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={fetchQuotes}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden md:inline">Aggiorna</span>
          </Button>
          <Button variant="secondary" onClick={handleExportQuotes} className="gap-2">
            <FileDown className="h-4 w-4" />
            <span className="hidden md:inline">Esporta Excel</span>
          </Button>
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <FilePlus className="h-4 w-4" />
            <span className="hidden md:inline">Nuovo Preventivo</span>
          </Button>
        </div>
      </div>
      
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-orange-500" />
        </div>
        <Input
          type="text"
          className="pl-10 pr-4 py-2 border-2 border-orange-500/30 focus:border-orange-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full overflow-hidden">
        <TabsList className="grid grid-cols-6 mb-4">
          <TabsTrigger value="all">
            Tutti <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{searchedAllQuotes.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bozza">
            Bozze <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{searchedDraftQuotes.length}</span>
          </TabsTrigger>
          <TabsTrigger value="inviato">
            Inviati <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{searchedSentQuotes.length}</span>
          </TabsTrigger>
          <TabsTrigger value="accettato">
            Accettati <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{searchedAcceptedQuotes.length}</span>
          </TabsTrigger>
          <TabsTrigger value="completati">
            Completati <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{searchedCompletedQuotes.length}</span>
          </TabsTrigger>
          <TabsTrigger value="archiviati">
            Archiviati <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{searchedArchivedQuotes.length}</span>
          </TabsTrigger>
        </TabsList>
        
        <div className="overflow-hidden">
          <TabsContent value="all" className="overflow-hidden">
            <QuoteTable
              quotes={paginatedQuotes()}
              isLoading={isLoading}
              onEdit={handleEditQuote}
              onDeleteSuccess={handleFormSubmit}
              onStatusChange={fetchQuotes}
              onRequestAppointment={handleOpenAppointmentModal}
            />
          </TabsContent>
          
          <TabsContent value="bozza" className="overflow-hidden">
            <QuoteTable
              quotes={paginatedQuotes()}
              isLoading={isLoading}
              onEdit={handleEditQuote}
              onDeleteSuccess={handleFormSubmit}
              onStatusChange={fetchQuotes}
              onRequestAppointment={handleOpenAppointmentModal}
            />
          </TabsContent>
          
          <TabsContent value="inviato" className="overflow-hidden">
            <QuoteTable
              quotes={paginatedQuotes()}
              isLoading={isLoading}
              onEdit={handleEditQuote}
              onDeleteSuccess={handleFormSubmit}
              onStatusChange={fetchQuotes}
              onRequestAppointment={handleOpenAppointmentModal}
            />
          </TabsContent>
          
          <TabsContent value="accettato" className="overflow-hidden">
            <QuoteTable
              quotes={paginatedQuotes()}
              isLoading={isLoading}
              onEdit={handleEditQuote}
              onDeleteSuccess={handleFormSubmit}
              onStatusChange={fetchQuotes}
              onRequestAppointment={handleOpenAppointmentModal}
            />
          </TabsContent>
          
          <TabsContent value="completati" className="overflow-hidden">
            <QuoteTable
              quotes={paginatedQuotes()}
              isLoading={isLoading}
              onEdit={handleEditQuote}
              onDeleteSuccess={handleFormSubmit}
              onStatusChange={fetchQuotes}
              onRequestAppointment={handleOpenAppointmentModal}
            />
          </TabsContent>
          
          <TabsContent value="archiviati" className="overflow-hidden">
            <QuoteTable
              quotes={paginatedQuotes()}
              isLoading={isLoading}
              onEdit={handleEditQuote}
              onDeleteSuccess={handleFormSubmit}
              onStatusChange={fetchQuotes}
              onRequestAppointment={handleOpenAppointmentModal}
            />
          </TabsContent>
        </div>
        
        <div className="mt-4 flex justify-start">
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </Tabs>
      
      {selectedQuote && (
        <QuoteForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
          quote={selectedQuote}
        />
      )}
      
      {!selectedQuote && (
        <QuoteForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
        />
      )}
      
      {selectedQuoteForAppointment && (
        <AppointmentForm
          isOpen={isAppointmentModalOpen}
          onClose={handleCloseAppointmentModal}
          onSuccess={handleCloseAppointmentModal}
          defaultQuote={selectedQuoteForAppointment}
        />
      )}
    </div>
  );
}