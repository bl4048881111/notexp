import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Quote } from "@shared/schema";
import { deleteQuote, updateQuote } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";

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
import { MoreHorizontal, FileEdit, Trash2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuoteTableProps {
  quotes: Quote[];
  isLoading: boolean;
  onEdit: (quote: Quote) => void;
  onExportPDF: (quoteId: string) => void;
  onDeleteSuccess: () => void;
}

export default function QuoteTable({ 
  quotes, 
  isLoading, 
  onEdit, 
  onExportPDF,
  onDeleteSuccess 
}: QuoteTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const { toast } = useToast();
  
  const handleDeleteClick = (quote: Quote) => {
    setQuoteToDelete(quote);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    
    try {
      await deleteQuote(quoteToDelete.id);
      toast({
        title: "Preventivo eliminato",
        description: `Il preventivo ${quoteToDelete.id} è stato eliminato con successo`,
      });
      onDeleteSuccess();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del preventivo",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };
  
  const handleUpdateStatus = async (quote: Quote, newStatus: "accettato" | "rifiutato") => {
    try {
      await updateQuote(quote.id, { status: newStatus });
      toast({
        title: "Stato aggiornato",
        description: `Il preventivo è stato contrassegnato come ${newStatus}`,
      });
      onDeleteSuccess(); // Actually refreshes the list
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "bozza":
        return <Badge variant="outline">Bozza</Badge>;
      case "inviato":
        return <Badge variant="secondary">Inviato</Badge>;
      case "accettato":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Accettato</Badge>;
      case "rifiutato":
        return <Badge variant="destructive">Rifiutato</Badge>;
      case "scaduto":
        return <Badge variant="outline" className="bg-gray-200 hover:bg-gray-300">Scaduto</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veicolo</TableHead>
              <TableHead>Servizi</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">Caricamento preventivi...</div>
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <div className="text-muted-foreground">Nessun preventivo trovato</div>
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">#{quote.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    {format(new Date(quote.createdAt), "dd/MM/yyyy", { locale: it })}
                  </TableCell>
                  <TableCell>
                    <div>{quote.clientName}</div>
                    <div className="text-xs text-muted-foreground">{quote.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div>{quote.model}</div>
                    <div className="text-xs text-muted-foreground">{quote.plate}</div>
                  </TableCell>
                  <TableCell>{quote.items.length} servizi</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(quote.total)}
                  </TableCell>
                  <TableCell>{getStatusBadge(quote.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Apri menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(quote)}>
                          <FileEdit className="mr-2 h-4 w-4" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExportPDF(quote.id)}>
                          <FileText className="mr-2 h-4 w-4" />
                          Esporta PDF
                        </DropdownMenuItem>
                        
                        {quote.status === "inviato" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleUpdateStatus(quote, "accettato")}
                              className="text-green-600"
                            >
                              Segna come accettato
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleUpdateStatus(quote, "rifiutato")}
                              className="text-destructive"
                            >
                              Segna come rifiutato
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(quote)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Elimina
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
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo preventivo? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}