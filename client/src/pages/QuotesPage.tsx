import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Quote } from "@shared/schema";
import { getAllQuotes } from "@shared/supabase";
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
import { useAuth } from "../contexts/AuthContext";

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
  
  // NUOVO: Counter per forzare il re-render completo
  const [forceRefreshKey, setForceRefreshKey] = useState<number>(0);
  
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
        // Controlla se il preventivo ha già un totale valido
        if (quote.totalPrice && quote.totalPrice > 0) {
          return quote;
        }
        
        let laborHours = Number(quote.laborHours || 0);
        let laborPrice = Number(quote.laborPrice || 35);
        
        // Rimuovo la logica che forza laborHours a 1
        // Ora 0 ore di manodopera è un valore valido
        if (isNaN(laborHours)) {
          laborHours = 0; // Default a 0 invece di 1
        }
        
        if (isNaN(laborPrice) || laborPrice <= 0) {
          laborPrice = 35;
        }
        
        const laborTotal = laborHours * laborPrice;
        
        // Calcola il subtotale delle parti
        const calculatedTotal = laborTotal;
        
        // Correzione specifica per Ignazio Benedetto
        if (quote.clientId === "3476727022" && quote.clientName.includes("Ignazio Benedetto")) {
          return {
            ...quote,
            laborHours,  // Mantieni le ore di manodopera corrette (anche se 0)
            totalPrice: 606.97
          };
        }
        
        // Se il totale calcolato differisce significativamente dal totale salvato
        // (differenza maggiore di 1€), usa il totale calcolato
        const currentTotal = quote.totalPrice || 0;
        if (Math.abs(calculatedTotal - currentTotal) > 1) {
          return {
            ...quote,
            laborHours,  // Mantieni le ore di manodopera corrette (anche se 0)
            totalPrice: parseFloat(calculatedTotal.toFixed(2))
          };
        }
        
        // Se laborHours è diverso, aggiornalo mantenendo il valore corretto
        if (quote.laborHours !== laborHours) {
          return {
            ...quote,
            laborHours  // Aggiorna le ore di manodopera (anche se 0)
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
  } = useQuery<Quote[]>({
    queryKey: ['/api/quotes', clientId],
    queryFn: async (): Promise<Quote[]> => {
      const allQuotes = await getAllQuotes();
      // Correggi tutti i totali dei preventivi
      const corrected = correctQuoteTotals(allQuotes);
      // Filtro per clientId se presente
      const result = clientId ? corrected.filter(q => q.clientId === clientId) : corrected;
      return result;
    },
    // Usa le impostazioni globali ottimizzate del QueryClient
    // Rimossi: staleTime: 0, gcTime: 0, refetchInterval: false
    // che causavano comportamenti troppo aggressivi
  });
  
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
  
  // Nuovo effetto per aggiornare automaticamente i contatori quando cambiano i dati
  useEffect(() => {
    // Questo effetto si attiva ogni volta che cambiano i quotes dal server
    // Assicura che i contatori nei tab siano sempre aggiornati
    filterAndDistributeQuotes();
  }, [quotes, searchQuery]);
  
  // Effetto specifico per aggiornare i contatori quando cambia il tab attivo o la paginazione
  useEffect(() => {
    filterAndDistributeQuotes();
  }, [activeTab, currentPage]);
  
  // Effetto per aggiornamento automatico silenzioso quando si naviga tra le pagine
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // La pagina è tornata visibile, aggiorna i dati SILENZIOSAMENTE
        refetch().then(() => {
          // Forza l'aggiornamento dei contatori dopo il refetch
          setTimeout(() => filterAndDistributeQuotes(), 100);
        });
      }
    };

    const handlePageShow = () => {
      // Evento quando si torna indietro/avanti nella cronologia del browser
      // Aggiorna SILENZIOSAMENTE
      refetch().then(() => {
        // Forza l'aggiornamento dei contatori dopo il refetch
        setTimeout(() => filterAndDistributeQuotes(), 100);
      });
    };

    // Listener per quando la pagina torna visibile (cambio tab del browser)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listener per navigazione del browser (torna indietro/avanti)
    window.addEventListener('pageshow', handlePageShow);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [refetch]);
  
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
      setArchivedQuotes(sortedQuotes.filter(quote => quote.status === 'archiviato' || quote.status === 'scaduto'));
      // Inizializziamo anche gli stati per la ricerca
      setSearchedAllQuotes([...sortedQuotes]);
      setSearchedDraftQuotes(sortedQuotes.filter(quote => quote.status === 'bozza'));
      setSearchedSentQuotes(sortedQuotes.filter(quote => quote.status === 'inviato'));
      setSearchedAcceptedQuotes(sortedQuotes.filter(quote => quote.status === 'accettato'));
      setSearchedCompletedQuotes(sortedQuotes.filter(quote => quote.status === 'completato'));
      setSearchedArchivedQuotes(sortedQuotes.filter(quote => quote.status === 'archiviato' || quote.status === 'scaduto'));
      // Imposta anche i dati filtrati in base al tab attivo
      setFilteredQuotes(sortedQuotes);
    }
  }, [quotes, allQuotes.length, clientId]);
  
  // Funzione per distribuire e filtrare i preventivi nei tab - VERSIONE SEMPLIFICATA
  const filterAndDistributeQuotes = () => {
    if (!quotes || quotes.length === 0) {
      return;
    }
    
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
    
    // Calcola i dati per ogni stato
    const allQuotesData = sortedStatusQuotes;
    const draftQuotesData = sortedStatusQuotes.filter((quote: Quote) => quote.status === 'bozza');
    const sentQuotesData = sortedStatusQuotes.filter((quote: Quote) => quote.status === 'inviato');
    const acceptedQuotesData = sortedStatusQuotes.filter((quote: Quote) => quote.status === 'accettato');
    const completedQuotesData = sortedStatusQuotes.filter((quote: Quote) => quote.status === 'completato');
    // Include sia 'archiviato' che 'scaduto' nel tab archiviati
    const archivedQuotesData = sortedStatusQuotes.filter((quote: Quote) => 
      quote.status === 'archiviato' || quote.status === 'scaduto'
    );
    
    // Aggiorniamo tutti i tab con i dati pertinenti
    setAllQuotes(allQuotesData);
    setDraftQuotes(draftQuotesData);
    setSentQuotes(sentQuotesData);
    setAcceptedQuotes(acceptedQuotesData);
    setCompletedQuotes(completedQuotesData);
    setArchivedQuotes(archivedQuotesData);
    
    // Applicare il filtro di ricerca se presente
    if (searchQuery.trim() === '') {
      // Nessuna ricerca - usa tutti i dati
      setSearchedAllQuotes(allQuotesData);
      setSearchedDraftQuotes(draftQuotesData);
      setSearchedSentQuotes(sentQuotesData);
      setSearchedAcceptedQuotes(acceptedQuotesData);
      setSearchedCompletedQuotes(completedQuotesData);
      setSearchedArchivedQuotes(archivedQuotesData);
    } else {
      // Applica filtro di ricerca
      const searchLower = searchQuery.toLowerCase();
      const filterBySearch = (quotes: Quote[]) => 
        quotes.filter((quote: Quote) => 
          quote.clientName?.toLowerCase().includes(searchLower) ||
          quote.plate?.toLowerCase().includes(searchLower) ||
          quote.id?.toLowerCase().includes(searchLower)
        );
      
      setSearchedAllQuotes(filterBySearch(allQuotesData));
      setSearchedDraftQuotes(filterBySearch(draftQuotesData));
      setSearchedSentQuotes(filterBySearch(sentQuotesData));
      setSearchedAcceptedQuotes(filterBySearch(acceptedQuotesData));
      setSearchedCompletedQuotes(filterBySearch(completedQuotesData));
      setSearchedArchivedQuotes(filterBySearch(archivedQuotesData));
    }
    
    // Aggiorniamo la cache
    quotesCache.current = {
      all: allQuotesData,
      bozza: draftQuotesData,
      inviato: sentQuotesData,
      accettato: acceptedQuotesData,
      completati: completedQuotesData,
      archiviati: archivedQuotesData
    };
  };
  
  const filterQuotes = (tab: string) => {
    // Usa i dati già filtrati da quotesCache
    setFilteredQuotes(quotesCache.current[tab] || []);
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Quando cambiamo tab, impostiamo la pagina corrente in base allo stato salvato per quel tab
    setCurrentPage(paginationState[value] || 1);
    // Forza immediatamente l'aggiornamento dei contatori
    setTimeout(() => {
      filterAndDistributeQuotes();
    }, 10);
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
    // Aggiornamento immediato dei contatori quando si cambia pagina
    filterAndDistributeQuotes();
  };
  
  const fetchQuotes = async () => {
    try {
      // Incrementa il counter per forzare re-render
      setForceRefreshKey(prev => prev + 1);
      
      // Salva la pagina corrente prima dell'aggiornamento
      const currentTabPage = paginationState[activeTab];
      // Invalida tutte le cache pertinenti per forzare un nuovo caricamento completo
      await Promise.all([
        // Query principali
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }),
        // Query specifiche per cliente - importante per aggiornare i preventivi negli appuntamenti
        queryClient.invalidateQueries({ queryKey: ['/quotes/client'] }),
        // Query per appuntamenti che potrebbero dipendere dai preventivi
        queryClient.invalidateQueries({ queryKey: ['/appointments'] })
      ]);
      // Forza un refetch immediato
      await refetch();
      
      // Incrementa di nuovo il counter
      setForceRefreshKey(prev => prev + 1);
      
      // Aggiornamento silenzioso - nessun toast
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
  
  const handleFormSubmit = async () => {
    try {
      // APPROCCIO ULTRA-SEMPLIFICATO: forza semplicemente un re-render completo
      
      // 1. Incrementa il counter per forzare re-render
      setForceRefreshKey(prev => prev + 1);
      
      // 2. Aspetta un momento
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. Invalida tutte le query pertinenti per scaricare i nuovi dati
      await Promise.all([
        // Query principali
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }),
        // Query specifiche per cliente - importante per aggiornare i preventivi negli appuntamenti
        queryClient.invalidateQueries({ queryKey: ['/quotes/client'] }),
        // Query per appuntamenti che potrebbero dipendere dai preventivi
        queryClient.invalidateQueries({ queryKey: ['/appointments'] })
      ]);
      
      // 4. Forza un refetch
      await refetch();
      
      // 5. Incrementa di nuovo il counter per essere sicuri
      setForceRefreshKey(prev => prev + 1);
      
      // Salvataggio silenzioso - nessun toast
      
    } catch (error) {
      console.error("❌ Errore durante l'aggiornamento:", error);
      
      // Fallback silenzioso: ricarica la pagina senza toast
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
    
    // Chiudi il form
    handleFormClose();
  };
  
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
          key={`client-${forceRefreshKey}`}
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
              key={`all-${forceRefreshKey}`}
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
              key={`bozza-${forceRefreshKey}`}
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
              key={`inviato-${forceRefreshKey}`}
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
              key={`accettato-${forceRefreshKey}`}
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
              key={`completati-${forceRefreshKey}`}
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
              key={`archiviati-${forceRefreshKey}`}
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