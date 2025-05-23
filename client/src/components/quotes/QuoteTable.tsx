import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Quote } from "@shared/schema";
import { deleteQuote, updateQuote, mergeQuotes } from "@shared/firebase";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Edit, 
  Trash, 
  FileDown,
  Clock,
  Send,
  CheckCircle,
  MoreHorizontal,
  Timer,
  CheckCircle2,
  Loader2,
  MergeIcon
} from "lucide-react";
import { appointmentService } from "@/services/appointmentService";
import { Appointment } from "@shared/types";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface QuoteTableProps {
  quotes: Quote[];
  isLoading: boolean;
  onEdit: (quote: Quote) => void;
  onDeleteSuccess: () => void;
  onStatusChange: () => void;
  onRequestAppointment?: (quote: Quote) => void;
  readOnly?: boolean;
}

export default function QuoteTable({ 
  quotes, 
  isLoading, 
  onEdit, 
  onDeleteSuccess,
  onStatusChange,
  onRequestAppointment,
  readOnly = false
}: QuoteTableProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Stato per la selezione di preventivi
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  // Stato per la modalità selezione
  const [selectionMode, setSelectionMode] = useState(false);
  
  // Ordina i preventivi: bozze, inviati, accettati, completati
  const sortedQuotes = useMemo(() => {
    const statusOrder = {
      'bozza': 1,
      'inviato': 2, 
      'accettato': 3,
      'completato': 4,
      'scaduto': 5
    };
    
    return [...quotes].sort((a, b) => {
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });
  }, [quotes]);
  
  // Formatta la data
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: it });
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
  
  // Funzione per ottenere il totale corretto del preventivo
  const getQuoteTotal = (quote: Quote): number => {
    if (quote.totalPrice !== undefined) {
      return quote.totalPrice;
    }
    return 0;
  };
  
  // Formatta le ore di manodopera
  const formatLaborHours = (hours: number | undefined): string => {
    if (hours === undefined) return "0h";
    return `${hours.toFixed(1)}h`;
  };
  
  // Funzione per contare il numero di pezzi in un preventivo
  const countParts = (quote: Quote): number => {
    try {
      if (!(quote as any).items) return 0;
      
      const items = (quote as any).items;
      let count = 0;
      
      for (const item of items) {
        if (Array.isArray(item.parts)) {
          for (const part of item.parts) {
            count += (part.quantity || 1);
          }
        }
      }
      
      return count;
    } catch (error) {
      console.error("Errore nel conteggio pezzi:", error);
      return 0;
    }
  };
  
  // Gestisce il click su una checkbox
  const handleToggleSelect = (quoteId: string, checked: boolean) => {
    if (checked) {
      setSelectedQuotes(prev => [...prev, quoteId]);
    } else {
      setSelectedQuotes(prev => prev.filter(id => id !== quoteId));
    }
  };
  
  // Attiva la modalità selezione
  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedQuotes([]);
    }
  };
  
  // Gestisce l'unione dei preventivi selezionati
  const handleMergeQuotes = async () => {
    if (selectedQuotes.length < 2) {
      toast({
        title: "Selezione insufficiente",
        description: "Seleziona almeno due preventivi da unire.",
        variant: "destructive",
      });
      return;
    }
    
    // Verifica che i preventivi siano dello stesso cliente
    const clientId = quotes.find(q => q.id === selectedQuotes[0])?.clientId;
    const allSameClient = selectedQuotes.every(id => 
      quotes.find(q => q.id === id)?.clientId === clientId
    );
    
    if (!allSameClient) {
      toast({
        title: "Preventivi incompatibili",
        description: "I preventivi selezionati devono appartenere allo stesso cliente.",
        variant: "destructive",
      });
      return;
    }
    
    setIsMerging(true);
    try {
      // Chiama la funzione di unione preventivi
      const mergedQuote = await mergeQuotes(selectedQuotes);
      
      if (mergedQuote) {
        toast({
          title: "Preventivi uniti",
          description: `I preventivi selezionati sono stati uniti nel nuovo preventivo ${mergedQuote.id}.`,
        });
        
        // Ricarica la pagina per mostrare il nuovo preventivo
        onStatusChange();
        setSelectedQuotes([]);
      } else {
        toast({
          title: "Errore",
          description: "Si è verificato un errore durante l'unione dei preventivi.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Errore durante l'unione dei preventivi:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'unione dei preventivi.",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };
  
  // Gestisce il click su Elimina
  const handleDeleteClick = (quote: Quote) => {
    setQuoteToDelete(quote);
    setDeleteConfirmOpen(true);
  };
  
  // Gestisce la conferma dell'eliminazione
  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    
    setIsDeleting(true);
    try {
      // Prima di eliminare il preventivo, troviamo tutti gli appuntamenti collegati
      // e aggiorniamo i loro riferimenti
      const appointments = await appointmentService.getAll();
      const linkedAppointments = appointments.filter(app => app.quoteId === quoteToDelete.id);
      
      if (linkedAppointments.length > 0) {
        // Aggiorniamo ogni appuntamento collegato
        for (const app of linkedAppointments) {
          const updates: Partial<Appointment> = {
            quoteId: "", // Rimuovi il riferimento al preventivo
            partsOrdered: false, // Reset dello stato dei pezzi
          };
          
          // Aggiorna l'appuntamento rimuovendo il riferimento al preventivo
          await appointmentService.update(app.id, updates);
        }
      }
      
      // Elimina il preventivo
      await deleteQuote(quoteToDelete.id);
      
      toast({
        title: "Preventivo eliminato",
        description: "Il preventivo è stato eliminato con successo.",
      });
      onDeleteSuccess();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del preventivo.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setQuoteToDelete(null);
    }
  };
  
  // Gestisce il cambio di stato
  const handleStatusChange = async (quote: Quote, newStatus: Quote['status']) => {
    // Salva lo stato precedente per poter ripristinare in caso di errore
    const previousStatus = quote.status;
    
    try {
      // Approccio "optimistic update":
      // Notifica subito l'utente che lo stato è cambiato per dare un feedback immediato
      toast({
        title: "Aggiornamento in corso...",
        description: `Stato modificato in "${getStatusLabel(newStatus)}"`,
      });
      
      // Esegui l'aggiornamento sul server
      await updateQuote(quote.id, { status: newStatus });
      
      // Forza un refresh dei dati
      onStatusChange();
      
      // Notifica l'utente che l'aggiornamento è stato completato
      toast({
        title: "Stato aggiornato",
        description: `Lo stato del preventivo è stato aggiornato in "${getStatusLabel(newStatus)}"`,
      });
    } catch (error) {
      // In caso di errore, notifica l'utente e offri la possibilità di riprovare
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dello stato. Prova a ricaricare la pagina.",
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleStatusChange(quote, newStatus)}
            className="bg-background text-xs"
          >
            Riprova
          </Button>
        ),
      });
      
      // Forza comunque un refresh per ripristinare lo stato corretto dal server
      onStatusChange();
    }
  };
  
  // Esporta il preventivo in PDF
  const handleExportToPDF = async (quote: Quote) => {
    try {
      await exportQuoteToPDF(quote);
      
      toast({
        title: "PDF generato",
        description: "Il preventivo è stato esportato in PDF con successo.",
      });
    } catch (error) {
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
      'scaduto': 'Scaduto',
      'completato': 'Completato'
    };
    return statusMap[status] || status;
  };
  
  // Restituisce il colore del badge in base allo stato
  const getStatusBadgeVariant = (status: Quote['status']) => {
    const variantMap: Record<Quote['status'], "default" | "secondary" | "destructive" | "outline" | "success" | null | undefined> = {
      'bozza': "outline",
      'inviato': "secondary",
      'accettato': "default",
      'scaduto': "outline",
      'completato': "success"
    };
    return variantMap[status];
  };
  
  // Restituisce l'icona dello stato
  const getStatusIcon = (status: Quote['status']) => {
    const iconMap: Record<Quote['status'], React.ReactNode> = {
      'bozza': <Clock className="h-4 w-4" />,
      'inviato': <Send className="h-4 w-4" />,
      'accettato': <CheckCircle className="h-4 w-4" />,
      'scaduto': <Clock className="h-4 w-4" />,
      'completato': <CheckCircle2 className="h-4 w-4 text-green-600" />
    };
    return iconMap[status];
  };
  
  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
      </div>
    );
  }
  
  if (quotes.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-background">
        <p className="text-muted-foreground">
          Nessun preventivo trovato.
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-full overflow-hidden">
      {/* Barra delle azioni visibile solo se ci sono preventivi selezionati e non readOnly */}
      {(!readOnly && selectedQuotes.length > 0) && (
        <div className="flex items-center justify-between mb-4 p-2 bg-muted rounded-md">
          <div className="text-sm">
            {`${selectedQuotes.length} preventivi selezionati`}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleMergeQuotes}
              disabled={isMerging || selectedQuotes.length < 2}
              className="gap-2"
            >
              {isMerging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MergeIcon className="h-4 w-4" />
              )}
              Unisci Preventivi
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => {
                if (selectedQuotes.length === 0) {
                  toast({
                    title: "Selezione vuota",
                    description: "Seleziona almeno un preventivo da eliminare.",
                    variant: "destructive",
                  });
                  return;
                }
                if (confirm(`Sei sicuro di voler eliminare ${selectedQuotes.length} preventivi selezionati?`)) {
                  // Eliminiamo i preventivi uno per uno
                  const deleteQuotes = async () => {
                    try {
                      for (const id of selectedQuotes) {
                        await deleteQuote(id);
                      }
                      toast({
                        title: "Preventivi eliminati",
                        description: `${selectedQuotes.length} preventivi sono stati eliminati con successo.`,
                      });
                      onDeleteSuccess();
                      setSelectedQuotes([]);
                    } catch (error) {
                      toast({
                        title: "Errore",
                        description: "Si è verificato un errore durante l'eliminazione dei preventivi.",
                        variant: "destructive",
                      });
                    }
                  };
                  deleteQuotes();
                }
              }}
              disabled={selectedQuotes.length === 0}
              className="gap-2"
            >
              <Trash className="h-4 w-4" />
              Elimina Preventivi
            </Button>
          </div>
        </div>
      )}
      <div className="border rounded-lg">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {/* Colonna selezione solo se non readOnly */}
              {!readOnly && (
                <TableHead className="w-[5%]">
                  {selectionMode && (
                    /* Header per le caselle di selezione */
                    <Checkbox 
                      checked={selectedQuotes.length > 0 && selectedQuotes.length === quotes.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedQuotes(quotes.map(q => q.id));
                        } else {
                          setSelectedQuotes([]);
                        }
                      }}
                    />
                  )}
                </TableHead>
              )}
              <TableHead className="w-[10%]">Codice</TableHead>
              <TableHead className="w-[20%]">Cliente</TableHead>
              <TableHead className="w-[10%]">Veicolo</TableHead>
              <TableHead className="w-[15%]">Totale</TableHead>
              <TableHead className="w-[10%]">Data</TableHead>
              <TableHead className="w-[5%]">Ore</TableHead>
              <TableHead className="w-[10%]">Stato</TableHead>
              {!readOnly && <TableHead className="w-[10%] text-right">Azioni</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedQuotes.map((quote) => (
              <TableRow 
                key={quote.id} 
                className={`cursor-pointer hover:bg-muted/50 ${selectedQuotes.includes(quote.id) ? 'bg-muted' : ''}`}
                onClick={(e) => {
                  if (readOnly) return; // Nessuna azione in sola lettura
                  // Se siamo in modalità selezione, il click sulla riga seleziona/deseleziona il preventivo
                  if (selectionMode) {
                    const isSelected = selectedQuotes.includes(quote.id);
                    handleToggleSelect(quote.id, !isSelected);
                    return;
                  }
                  // Altrimenti, se il click non è su un pulsante o un elemento dropdown, apri il preventivo
                  const target = e.target as HTMLElement;
                  if (!target.closest('button') && !target.closest('[role="menuitem"]') && !target.closest('input[type="checkbox"]')) {
                    onEdit(quote);
                  }
                }}
              >
                {/* Colonna selezione solo se non readOnly */}
                {!readOnly && (
                  <TableCell>
                    {selectionMode && (
                      <Checkbox
                        checked={selectedQuotes.includes(quote.id)}
                        onCheckedChange={(checked) => handleToggleSelect(quote.id, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {quote.id.substring(0, 5).toUpperCase()}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{quote.clientName}</div>
                  <div className="text-xs text-muted-foreground">{quote.phone}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{quote.plate}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(getQuoteTotal(quote))}</div>
                  <div className="text-xs text-muted-foreground">
                    {countParts(quote)} pezzi
                  </div>
                </TableCell>
                <TableCell>
                  {formatDate(quote.date)}
                </TableCell>
                <TableCell>
                  {formatLaborHours(quote.laborHours)}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(quote.status)} className="flex items-center gap-1 w-fit">
                    {getStatusIcon(quote.status)}
                    {getStatusLabel(quote.status)}
                  </Badge>
                </TableCell>
                {/* Colonna azioni solo se non readOnly */}
                {!readOnly && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => onEdit(quote)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportToPDF(quote)}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Esporta PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, "bozza")}> <Clock className="mr-2 h-4 w-4" /> Stato: Bozza </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, "inviato")}> <Send className="mr-2 h-4 w-4" /> Stato: Inviato </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, "accettato")}> <CheckCircle className="mr-2 h-4 w-4" /> Stato: Accettato </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, "completato")}> <CheckCircle2 className="mr-2 h-4 w-4" /> Stato: Completato </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(quote.status === "inviato" || quote.status === "accettato") && (
                            <DropdownMenuItem onClick={() => onRequestAppointment && onRequestAppointment(quote)}>
                              <Timer className="mr-2 h-4 w-4" />
                              Crea Appuntamento
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDeleteClick(quote)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" />
                            Elimina
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={toggleSelectionMode}>
                            <Checkbox className="mr-2 h-4 w-4" checked={selectionMode} />
                            {selectionMode ? "Disattiva selezione" : "Attiva selezione"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Dialog di conferma eliminazione visibile solo se non readOnly */}
      {!readOnly && (
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione eliminerà definitivamente il preventivo
                {quoteToDelete && ` per ${quoteToDelete.clientName}`}.
                I dati non potranno essere recuperati.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminazione...
                  </>
                ) : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}