import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

import { getAllQuotes } from "@shared/firebase";
import { Quote } from "@shared/schema";

import QuoteForm from "../components/quotes/QuoteForm";
import QuoteTable from "../components/quotes/QuoteTable";
import { exportQuotesToExcel, exportQuoteToPDF } from "../services/exportService";

export default function QuotesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  
  const { toast } = useToast();
  
  // Fetch quotes
  const { 
    data: quotes = [], 
    isLoading,
    refetch
  } = useQuery({ 
    queryKey: ['/api/quotes'],
    queryFn: getAllQuotes,
  });
  
  // Filter quotes
  const filteredQuotes = quotes.filter((quote: Quote) => {
    const matchesSearch = 
      quote.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      quote.plate.toLowerCase().includes(searchQuery.toLowerCase()) || 
      quote.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const handleExportToExcel = async () => {
    try {
      await exportQuotesToExcel(filteredQuotes);
      toast({
        title: "Esportazione completata",
        description: "I preventivi sono stati esportati con successo in Excel",
      });
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    }
  };
  
  const handleExportToPDF = async (quoteId: string) => {
    try {
      const quoteToExport = quotes.find(q => q.id === quoteId);
      if (quoteToExport) {
        await exportQuoteToPDF(quoteToExport);
        toast({
          title: "Esportazione completata",
          description: "Il preventivo è stato esportato con successo in PDF",
        });
      }
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione in PDF",
        variant: "destructive",
      });
    }
  };
  
  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setIsFormOpen(true);
  };
  
  const handleAddQuote = () => {
    setEditingQuote(null);
    setIsFormOpen(true);
  };
  
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingQuote(null);
  };
  
  const handleFormSubmit = async () => {
    await refetch();
    setIsFormOpen(false);
    setEditingQuote(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Preventivi</h2>
        
        <div className="flex space-x-3">
          <Button onClick={handleAddQuote}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Preventivo
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Esporta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportToExcel}>
                Esporta tutti in Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-grow">
            <Input
              type="text"
              placeholder="Cerca preventivo per cliente, targa o codice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato preventivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="bozza">Bozza</SelectItem>
                <SelectItem value="inviato">Inviato</SelectItem>
                <SelectItem value="accettato">Accettato</SelectItem>
                <SelectItem value="rifiutato">Rifiutato</SelectItem>
                <SelectItem value="scaduto">Scaduto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <QuoteTable 
          quotes={filteredQuotes} 
          isLoading={isLoading} 
          onEdit={handleEditQuote}
          onExportPDF={handleExportToPDF}
          onDeleteSuccess={refetch}
        />
      </div>
      
      {isFormOpen && (
        <QuoteForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
          quote={editingQuote}
        />
      )}
    </div>
  );
}