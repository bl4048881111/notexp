import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Quote } from "@shared/schema";
import { deleteQuote, updateQuote } from "@shared/firebase";
import { exportQuoteToPDF } from "@/services/exportService";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table";
import {
  SimpleDropdown,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/simple-dropdown";
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
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal, 
  Pencil, 
  Trash, 
  Search, 
  FileDown,
  CheckCircle,
  XCircle,
  Clock,
  Send
} from "lucide-react";
import { Card } from "@/components/ui/card";

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const { toast } = useToast();
  
  // Filtra i preventivi in base alla ricerca
  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    return (
      quote.clientName.toLowerCase().includes(searchLower) ||
      quote.plate.toLowerCase().includes(searchLower) ||
      quote.model.toLowerCase().includes(searchLower) ||
      quote.phone.toLowerCase().includes(searchLower)
    );
  });
  
  // Formatta la data
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: it });
    } catch (e) {
      return dateString;
    }
  };
  
  // Formatta il prezzo
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  // Gestisce il click su Elimina
  const handleDeleteClick = (quote: Quote) => {
    setQuoteToDelete(quote);
    setDeleteConfirmOpen(true);
  };
  
  // Gestisce la conferma dell'eliminazione
  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    
    try {
      await deleteQuote(quoteToDelete.id);
      
      // Registra l'attività di eliminazione preventivo
      try {
        const activityModule = await import('../dev/ActivityLogger');
        const { useActivityLogger } = activityModule;
        const { logActivity } = useActivityLogger();
        
        logActivity(
          'delete_quote',
          `Preventivo eliminato: ${quoteToDelete.clientName}`,
          {
            quoteId: quoteToDelete.id,
            clientName: quoteToDelete.clientName,
            plate: quoteToDelete.plate,
            timestamp: new Date()
          }
        );
      } catch (error) {
        console.warn("Impossibile registrare l'attività:", error);
      }
      
      toast({
        title: "Preventivo eliminato",
        description: "Il preventivo è stato eliminato con successo.",
      });
      onDeleteSuccess();
    } catch (error) {
      console.error("Errore durante l'eliminazione del preventivo:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del preventivo.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setQuoteToDelete(null);
    }
  };
  
  // Gestisce il cambio di stato
  const handleStatusChange = async (quote: Quote, newStatus: Quote['status']) => {
    try {
      console.log(`Tentativo di aggiornamento preventivo ${quote.id} - Da ${quote.status} a ${newStatus}`);
      const updatedQuote = await updateQuote(quote.id, { status: newStatus });
      console.log("Preventivo aggiornato:", updatedQuote);
      
      // Registra l'attività di cambio stato
      try {
        const activityModule = await import('../dev/ActivityLogger');
        const { useActivityLogger } = activityModule;
        const { logActivity } = useActivityLogger();
        
        let statusText = getStatusLabel(newStatus);
        
        logActivity(
          'change_quote_status',
          `Preventivo marcato come "${statusText}": ${quote.clientName}`,
          {
            quoteId: quote.id,
            clientName: quote.clientName,
            oldStatus: quote.status,
            newStatus: newStatus,
            total: quote.total,
            timestamp: new Date()
          }
        );
      } catch (error) {
        console.warn("Impossibile registrare l'attività:", error);
      }
      
      toast({
        title: "Stato aggiornato",
        description: `Lo stato del preventivo è stato aggiornato in "${getStatusLabel(newStatus)}".`,
      });
      
      // Forza un refresh dei dati
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
  
  // Esporta il preventivo in PDF
  const handleExportToPDF = async (quote: Quote) => {
    try {
      await exportQuoteToPDF(quote);
      
      // Registra l'attività di esportazione
      try {
        const activityModule = await import('../dev/ActivityLogger');
        const { useActivityLogger } = activityModule;
        const { logActivity } = useActivityLogger();
        
        logActivity(
          'export_data',
          `Preventivo esportato in PDF: ${quote.clientName}`,
          {
            quoteId: quote.id,
            clientName: quote.clientName,
            fileType: 'PDF',
            timestamp: new Date()
          }
        );
      } catch (error) {
        console.warn("Impossibile registrare l'attività:", error);
      }
      
      toast({
        title: "PDF generato",
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
  
  // Restituisce l'etichetta dello stato
  const getStatusLabel = (status: Quote['status']): string => {
    const statusMap: Record<Quote['status'], string> = {
      'bozza': 'Bozza',
      'inviato': 'Inviato',
      'accettato': 'Accettato',
      'rifiutato': 'Rifiutato',
      'scaduto': 'Scaduto'
    };
    return statusMap[status] || status;
  };
  
  // Restituisce il colore del badge in base allo stato
  const getStatusBadgeVariant = (status: Quote['status']) => {
    const variantMap: Record<Quote['status'], "default" | "secondary" | "destructive" | "outline" | null | undefined> = {
      'bozza': "outline",
      'inviato': "secondary",
      'accettato': "default",
      'rifiutato': "destructive",
      'scaduto': "outline"
    };
    return variantMap[status];
  };
  
  // Restituisce l'icona dello stato
  const getStatusIcon = (status: Quote['status']) => {
    const iconMap: Record<Quote['status'], React.ReactNode> = {
      'bozza': <Clock className="h-4 w-4" />,
      'inviato': <Send className="h-4 w-4" />,
      'accettato': <CheckCircle className="h-4 w-4" />,
      'rifiutato': <XCircle className="h-4 w-4" />,
      'scaduto': <Clock className="h-4 w-4" />
    };
    return iconMap[status];
  };
  
  // Se non ci sono preventivi
  if (quotes.length === 0 && !isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Nessun preventivo trovato</p>
        <p className="text-sm">Crea un nuovo preventivo per iniziare a gestire le tue offerte.</p>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-full">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca preventivi..."
            className="pl-9 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Veicolo</TableHead>
              <TableHead className="hidden md:table-cell">Data</TableHead>
              <TableHead className="hidden lg:table-cell">Ricambi</TableHead>
              <TableHead className="hidden sm:table-cell">Totale</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Caricamento preventivi...
                </TableCell>
              </TableRow>
            ) : filteredQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Nessun preventivo trovato. Prova a cambiare i criteri di ricerca.
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">
                    {quote.clientName}
                    <div className="text-xs text-muted-foreground mt-1">
                      {quote.phone}
                    </div>
                    {/* Informazioni extra visibili solo su mobile */}
                    <div className="sm:hidden mt-1">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>{quote.model} - {quote.plate}</span>
                      </div>
                      <div className="text-xs font-medium mt-1">{formatCurrency(quote.total)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {quote.model}
                    <div className="text-xs text-muted-foreground mt-1">
                      {quote.plate}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(quote.date)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {quote.items && quote.items.some(item => Array.isArray(item.parts) && item.parts.length > 0) ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-primary">
                          {quote.items.reduce((count, item) => 
                            count + (Array.isArray(item.parts) ? item.parts.length : 0), 0)} ricambi totali
                        </span>
                        {quote.items
                          .filter(item => Array.isArray(item.parts) && item.parts.length > 0)
                          .map((item, idx) => (
                            <div key={idx} className="text-xs flex items-center gap-1">
                              <span className="text-muted-foreground">{item.serviceType.name}:</span>
                              <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-sm">
                                {item.parts.length}
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nessun ricambio</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatCurrency(quote.total)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(quote.status)}
                      className="gap-1 whitespace-nowrap"
                    >
                      {getStatusIcon(quote.status)}
                      <span>{getStatusLabel(quote.status)}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <SimpleDropdown
                      trigger={
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Apri menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      }
                      content={
                        <div className="min-w-[12rem]">
                          <div className="px-2 py-1.5 text-sm font-semibold">Azioni</div>
                          <DropdownMenuItem onClick={() => onEdit(quote)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Modifica</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportToPDF(quote)}>
                            <FileDown className="mr-2 h-4 w-4" />
                            <span>Esporta PDF</span>
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <div className="px-2 py-1.5 text-sm font-semibold">Cambia stato</div>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(quote, 'bozza')}
                            disabled={quote.status === 'bozza'}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            <span>Bozza</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(quote, 'inviato')}
                            disabled={quote.status === 'inviato'}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            <span>Inviato</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(quote, 'accettato')}
                            disabled={quote.status === 'accettato'}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            <span>Accettato</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(quote, 'rifiutato')}
                            disabled={quote.status === 'rifiutato'}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            <span>Rifiutato</span>
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(quote)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            <span>Elimina</span>
                          </DropdownMenuItem>
                        </div>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo preventivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. Il preventivo verrà eliminato definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}