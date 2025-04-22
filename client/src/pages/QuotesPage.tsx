import { useState, useEffect } from "react";
import { Quote } from "@shared/schema";
import { getAllQuotes } from "@shared/firebase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Heading } from "../components/ui/heading";
import QuoteForm from "../components/quotes/QuoteForm";
import QuoteTable from "../components/quotes/QuoteTable";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Carica i preventivi
  const loadQuotes = async () => {
    setIsLoading(true);
    try {
      const fetchedQuotes = await getAllQuotes();
      setQuotes(fetchedQuotes);
    } catch (error) {
      console.error("Errore durante il caricamento dei preventivi:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Carica i preventivi all'avvio
  useEffect(() => {
    loadQuotes();
  }, []);

  // Gestisci la ricerca
  const filteredQuotes = quotes.filter((quote: Quote) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      quote.clientName.toLowerCase().includes(searchLower) ||
      quote.plate.toLowerCase().includes(searchLower) ||
      quote.model.toLowerCase().includes(searchLower) ||
      quote.phone.toLowerCase().includes(searchLower)
    );
  });
  
  // Apri il form per la modifica di un preventivo
  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsFormOpen(true);
  };
  
  // Chiudi il form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedQuote(null);
  };
  
  // Gestisci il successo del form
  const handleFormSuccess = () => {
    loadQuotes();
    setIsFormOpen(false);
    setSelectedQuote(null);
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <Heading
          title="Preventivi"
          description="Gestisci i preventivi per i clienti"
          icon="file-text"
        />
        
        <Button
          onClick={() => {
            setSelectedQuote(null);
            setIsFormOpen(true);
          }}
          className="gap-1 bg-primary hover:bg-primary/90"
        >
          <Plus size={16} />
          <span>Nuovo Preventivo</span>
        </Button>
      </div>
      
      <QuoteTable
        quotes={filteredQuotes}
        isLoading={isLoading}
        onEdit={handleEditQuote}
        onDeleteSuccess={loadQuotes}
        onStatusChange={loadQuotes}
      />
      
      <QuoteForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSuccess={handleFormSuccess}
        quote={selectedQuote}
      />
    </div>
  );
}