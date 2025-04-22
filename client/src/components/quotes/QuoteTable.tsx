import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Edit, Trash, FileText, FileDown, CheckCircle, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  const handleDeleteClick = (quote: Quote) => {
    setQuoteToDelete(quote);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteQuote(quoteToDelete.id);
      toast({
        title: "Preventivo eliminato",
        description: "Il preventivo è stato eliminato con successo",
      });
      onDeleteSuccess();
    } catch (error) {
      toast({
        title: "Errore di eliminazione",
        description: "Si è verificato un errore durante l'eliminazione del preventivo",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };
  
  const handleUpdateStatus = async (quote: Quote, newStatus: "accettato" | "rifiutato") => {
    try {
      await updateQuote(quote.id, { status: newStatus });
      toast({
        title: `Preventivo ${newStatus === "accettato" ? "accettato" : "rifiutato"}`,
        description: `Lo stato del preventivo è stato aggiornato a ${newStatus}`,
      });
      onDeleteSuccess(); // Per aggiornare la lista
    } catch (error) {
      toast({
        title: "Errore di aggiornamento",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "bozza":
        return <Badge variant="outline" className="bg-blue-950/50 text-blue-200 border-blue-700">Bozza</Badge>;
      case "inviato":
        return <Badge variant="outline" className="bg-yellow-950/50 text-yellow-200 border-yellow-700">Inviato</Badge>;
      case "accettato":
        return <Badge variant="outline" className="bg-green-950/50 text-green-200 border-green-700">Accettato</Badge>;
      case "rifiutato":
        return <Badge variant="outline" className="bg-red-950/50 text-red-200 border-red-700">Rifiutato</Badge>;
      case "scaduto":
        return <Badge variant="outline" className="bg-gray-950/50 text-gray-200 border-gray-700">Scaduto</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
      </div>
    );
  }
  
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veicolo</TableHead>
              <TableHead>Importo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center p-4 text-muted-foreground">
                  Nessun preventivo trovato
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => (
                <TableRow key={quote.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium text-primary">{quote.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {format(new Date(quote.createdAt), 'dd/MM/yyyy')}
                    </div>
                    {quote.validUntil && (
                      <div className="text-xs text-muted-foreground">
                        Valido fino al: {format(new Date(quote.validUntil), 'dd/MM/yyyy')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{quote.clientName}</div>
                    <div className="text-xs text-muted-foreground">{quote.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div>{quote.model}</div>
                    <div className="text-xs text-muted-foreground">{quote.plate}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(quote.total)}</div>
                    <div className="text-xs text-muted-foreground">
                      Subtotale: {formatCurrency(quote.subtotal)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(quote.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(quote)}
                        title="Modifica"
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteClick(quote)}
                        title="Elimina"
                      >
                        <Trash className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onExportPDF(quote.id)}
                        title="Esporta PDF"
                      >
                        <FileDown className="h-4 w-4 text-primary" />
                      </Button>
                      {quote.status === "inviato" && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleUpdateStatus(quote, "accettato")}
                            title="Accetta"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleUpdateStatus(quote, "rifiutato")}
                            title="Rifiuta"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="px-6 py-3 flex items-center justify-between border-t border-border">
        <div className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium">{quotes.length}</span> preventivi
        </div>
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo preventivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Eliminazione in corso..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}