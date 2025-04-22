import { useState, useEffect } from "react";
import { Quote } from "@shared/schema";
import { getAllQuotes, getQuoteById } from "@shared/firebase";
import { FileDown, PlusCircle, Search } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QuoteForm from "../components/quotes/QuoteForm";
import QuoteTable from "../components/quotes/QuoteTable";
import { exportQuotesToExcel, exportQuoteToPDF } from "../services/exportService";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Load all quotes on component mount
  useEffect(() => {
    const loadQuotes = async () => {
      setIsLoading(true);
      try {
        const loadedQuotes = await getAllQuotes();
        setQuotes(loadedQuotes);
        setFilteredQuotes(loadedQuotes);
      } catch (error) {
        console.error("Error loading quotes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadQuotes();
  }, []);
  
  // Filter quotes based on search query
  useEffect(() => {
    const filteredQuotes = quotes.filter((quote: Quote) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        quote.id.toLowerCase().includes(searchLower) ||
        quote.clientName.toLowerCase().includes(searchLower) ||
        quote.phone.toLowerCase().includes(searchLower) ||
        quote.plate.toLowerCase().includes(searchLower) ||
        quote.model.toLowerCase().includes(searchLower) ||
        quote.status.toLowerCase().includes(searchLower)
      );
    });
    
    setFilteredQuotes(filteredQuotes);
  }, [searchQuery, quotes]);
  
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
    setSelectedQuote(null);
  };
  
  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedQuote(null);
    
    // Reload quotes
    getAllQuotes().then(updatedQuotes => {
      setQuotes(updatedQuotes);
      setFilteredQuotes(updatedQuotes);
    });
  };
  
  const handleExportExcel = () => {
    exportQuotesToExcel(filteredQuotes);
  };
  
  const handleExportQuotePDF = async (quoteId: string) => {
    try {
      const quote = await getQuoteById(quoteId);
      if (quote) {
        exportQuoteToPDF(quote);
      }
    } catch (error) {
      console.error("Error exporting quote to PDF:", error);
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Preventivi</h1>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Esporta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportExcel}>
                Esporta Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={handleCreateQuote}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuovo Preventivo
          </Button>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per cliente, targa o stato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <QuoteTable
        quotes={filteredQuotes}
        isLoading={isLoading}
        onEdit={handleEditQuote}
        onExportPDF={handleExportQuotePDF}
        onDeleteSuccess={handleFormSuccess}
      />
      
      {isFormOpen && (
        <QuoteForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          quote={selectedQuote}
        />
      )}
    </div>
  );
}