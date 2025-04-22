import { useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Quote } from "@shared/schema";
import { deleteQuote, updateQuote } from "@shared/firebase";
import { exportQuoteToPDF, exportQuotesToExcel } from "../../services/exportService";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  FileEdit, 
  FileText, 
  Filter, 
  MoreVertical, 
  Printer, 
  Search, 
  ShoppingCart, 
  Trash2, 
  User, 
  Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuoteTableProps {
  quotes: Quote[];
  isLoading: boolean;
  onEdit: (quote: Quote) => void;
  onDeleteSuccess: () => void;
  onStatusChange: () => void;
}

export default function QuoteTable({ 
  quotes, 
  isLoading,
  onEdit, 
  onDeleteSuccess,
  onStatusChange
}: QuoteTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const handleDeleteClick = (quote: Quote) => {
    setConfirmDeleteId(quote.id);
  };
  
  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    
    try {
      await deleteQuote(confirmDeleteId);
      toast({
        title: "Preventivo eliminato",
        description: "Il preventivo è stato eliminato con successo.",
      });
      onDeleteSuccess();
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione.",
        variant: "destructive",
      });
    } finally {
      setConfirmDeleteId(null);
    }
  };
  
  const handleExportToPDF = async (quote: Quote) => {
    try {
      await exportQuoteToPDF(quote);
      toast({
        title: "PDF Generato",
        description: "Il preventivo è stato esportato in PDF con successo.",
      });
    } catch (error) {
      console.error("Errore durante l'esportazione in PDF:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'esportazione in PDF.",
        variant: "destructive",
      });
    }
  };
  
  const handleExportToExcel = async () => {
    try {
      await exportQuotesToExcel(quotes);
      toast({
        title: "Excel Generato",
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
  
  const handleStatusChange = async (id: string, newStatus: Quote["status"]) => {
    try {
      await updateQuote(id, { status: newStatus });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato del preventivo è stato aggiornato con successo.",
      });
      onStatusChange();
    } catch (error) {
      console.error("Errore durante l'aggiornamento dello stato:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dello stato.",
        variant: "destructive",
      });
    }
  };
  
  const getStatusColor = (status: Quote["status"]) => {
    switch (status) {
      case "bozza":
        return "bg-gray-200 text-gray-800";
      case "inviato":
        return "bg-blue-100 text-blue-800";
      case "accettato":
        return "bg-green-100 text-green-800";
      case "rifiutato":
        return "bg-red-100 text-red-800";
      case "scaduto":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "d MMM yyyy", { locale: it });
    } catch (error) {
      return dateString;
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    return (
      quote.clientName.toLowerCase().includes(searchLower) ||
      quote.plate.toLowerCase().includes(searchLower) ||
      quote.model.toLowerCase().includes(searchLower) ||
      quote.phone.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca cliente, targa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={handleExportToExcel}
        >
          <Download size={16} />
          <span>Esporta Excel</span>
        </Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veicolo</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead className="text-center">Stato</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Caricamento preventivi...
                </TableCell>
              </TableRow>
            ) : filteredQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {searchQuery
                    ? "Nessun preventivo corrisponde alla ricerca"
                    : "Nessun preventivo trovato"}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <div className="font-medium">{formatDate(quote.date)}</div>
                    <div className="text-sm text-muted-foreground">
                      {quote.items.length} servizi
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-muted-foreground" />
                      <div>
                        <div className="font-medium">{quote.clientName}</div>
                        <div className="text-sm text-muted-foreground">{quote.phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={16} className="text-muted-foreground" />
                      <div>
                        <div className="font-medium">{quote.model}</div>
                        <div className="text-sm text-muted-foreground">{quote.plate}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(quote.total)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline"
                      className={`${getStatusColor(quote.status)} border-0`}
                    >
                      {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Apri menu</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                        <DropdownMenuItem 
                          onClick={() => onEdit(quote)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <FileEdit size={16} />
                          <span>Modifica</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleExportToPDF(quote)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <FileText size={16} />
                          <span>Esporta PDF</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Cambia stato</DropdownMenuLabel>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, "bozza")}
                          className="flex items-center gap-2 cursor-pointer"
                          disabled={quote.status === "bozza"}
                        >
                          <span className="h-2 w-2 rounded-full bg-gray-500"></span>
                          <span>Bozza</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, "inviato")}
                          className="flex items-center gap-2 cursor-pointer"
                          disabled={quote.status === "inviato"}
                        >
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          <span>Inviato</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, "accettato")}
                          className="flex items-center gap-2 cursor-pointer"
                          disabled={quote.status === "accettato"}
                        >
                          <span className="h-2 w-2 rounded-full bg-green-500"></span>
                          <span>Accettato</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, "rifiutato")}
                          className="flex items-center gap-2 cursor-pointer"
                          disabled={quote.status === "rifiutato"}
                        >
                          <span className="h-2 w-2 rounded-full bg-red-500"></span>
                          <span>Rifiutato</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(quote)}
                          className="flex items-center gap-2 cursor-pointer text-red-600"
                        >
                          <Trash2 size={16} />
                          <span>Elimina</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo preventivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il preventivo sarà eliminato definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}