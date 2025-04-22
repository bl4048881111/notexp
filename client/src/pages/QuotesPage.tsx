import { useState, useEffect } from "react";
import { Quote } from "@shared/schema";
import { getAllQuotes } from "@shared/firebase";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePlus, FileDown } from "lucide-react";
import QuoteForm from "@/components/quotes/QuoteForm";
import QuoteTable from "@/components/quotes/QuoteTable";
import { exportQuotesToExcel } from "@/services/exportService";
import { useToast } from "@/hooks/use-toast";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const { toast } = useToast();
  
  useEffect(() => {
    fetchQuotes();
  }, []);
  
  useEffect(() => {
    if (quotes.length > 0) {
      filterQuotes(activeTab);
    }
  }, [quotes, activeTab]);
  
  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const data = await getAllQuotes();
      setQuotes(data);
      setFilteredQuotes(data);
    } catch (error) {
      console.error("Errore nel caricamento dei preventivi:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il caricamento dei preventivi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const filterQuotes = (status: string) => {
    if (status === "all") {
      setFilteredQuotes(quotes);
    } else {
      setFilteredQuotes(quotes.filter(quote => quote.status === status));
    }
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  const handleCreateQuote = () => {
    setSelectedQuote(null);
    setIsFormOpen(true);
  };
  
  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsFormOpen(true);
  };
  
  const handleFormClose = () => {
    setIsFormOpen(false);
  };
  
  const handleExportToExcel = async () => {
    try {
      await exportQuotesToExcel(filteredQuotes);
      toast({
        title: "Excel generato",
        description: "I preventivi sono stati esportati in Excel con successo.",
      });
    } catch (error) {
      console.error("Errore durante l'esportazione in Excel:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'esportazione in Excel.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Heading
          title="Preventivi"
          description="Gestisci i preventivi per i clienti"
          icon="quotes"
        />
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportToExcel} variant="outline" className="gap-1">
            <FileDown className="h-4 w-4" />
            <span>Esporta Excel</span>
          </Button>
          
          <Button onClick={handleCreateQuote} className="gap-1">
            <FilePlus className="h-4 w-4" />
            <span>Nuovo Preventivo</span>
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="all" onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Tutti</TabsTrigger>
          <TabsTrigger value="bozza">Bozze</TabsTrigger>
          <TabsTrigger value="inviato">Inviati</TabsTrigger>
          <TabsTrigger value="accettato">Accettati</TabsTrigger>
          <TabsTrigger value="rifiutato">Rifiutati</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <QuoteTable 
            quotes={filteredQuotes}
            isLoading={isLoading}
            onEdit={handleEditQuote}
            onDeleteSuccess={fetchQuotes}
            onStatusChange={fetchQuotes}
          />
        </TabsContent>
        
        <TabsContent value="bozza" className="space-y-4">
          <QuoteTable 
            quotes={filteredQuotes}
            isLoading={isLoading}
            onEdit={handleEditQuote}
            onDeleteSuccess={fetchQuotes}
            onStatusChange={fetchQuotes}
          />
        </TabsContent>
        
        <TabsContent value="inviato" className="space-y-4">
          <QuoteTable 
            quotes={filteredQuotes}
            isLoading={isLoading}
            onEdit={handleEditQuote}
            onDeleteSuccess={fetchQuotes}
            onStatusChange={fetchQuotes}
          />
        </TabsContent>
        
        <TabsContent value="accettato" className="space-y-4">
          <QuoteTable 
            quotes={filteredQuotes}
            isLoading={isLoading}
            onEdit={handleEditQuote}
            onDeleteSuccess={fetchQuotes}
            onStatusChange={fetchQuotes}
          />
        </TabsContent>
        
        <TabsContent value="rifiutato" className="space-y-4">
          <QuoteTable 
            quotes={filteredQuotes}
            isLoading={isLoading}
            onEdit={handleEditQuote}
            onDeleteSuccess={fetchQuotes}
            onStatusChange={fetchQuotes}
          />
        </TabsContent>
      </Tabs>
      
      {isFormOpen && (
        <QuoteForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={fetchQuotes}
          quote={selectedQuote}
        />
      )}
      

    </div>
  );
}