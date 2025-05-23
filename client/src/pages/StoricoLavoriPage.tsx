import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Search, RefreshCw, FileText, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { ref, get, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { rtdb } from "@/firebase";
import jsPDF from "jspdf";

import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

import { getAllAppointments, getQuoteById } from "@shared/firebase";
import { Appointment, Quote } from "@shared/schema";
import { exportQuoteToPDF } from "@/services/exportService";
import { useAuth } from "../hooks/useAuth";

export default function StoricoLavoriPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const { user } = useAuth();
  const clientId = user?.clientId;

  // Query per ottenere tutti gli appuntamenti con autorefresh attivato
  const { data: appointments = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: getAllAppointments,
    staleTime: 0, // Considera i dati sempre obsoleti
    refetchInterval: autoRefreshEnabled ? 30000 : false, // Aggiorna ogni 30 secondi se autorefresh attivo
    refetchOnWindowFocus: true, // Aggiorna quando la finestra torna in focus
  });

  // Calcolo direttamente gli appuntamenti filtrati
  const filteredAppointments = (clientId
    ? appointments.filter(a => a.status === "completato" && a.clientId === clientId)
    : appointments.filter(a => a.status === "completato")
  ).filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.clientName?.toLowerCase().includes(q) ||
      a.plate?.toLowerCase().includes(q) ||
      (a.quoteId ? a.quoteId.toLowerCase().includes(q) : false)
    );
  });

  // Funzione per ricaricare i dati
  const handleRefresh = async () => {
    try {
      await refetch();
      setLastRefreshTime(new Date());
      toast({
        title: "Dati aggiornati",
        description: "L'elenco dei lavori completati è stato aggiornato",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dei dati",
        variant: "destructive",
      });
    }
  };

  // Funzione per esportare i dati in Excel
  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);
      
      const exportData = filteredAppointments.map(appointment => ({
        'Codice Cliente': appointment.clientId || '-',
        'Cognome e Nome': appointment.clientName || '-',
        'Targa': appointment.plate || '-',
        'Nr. Preventivo': appointment.quoteId || '-',
        'Data Completamento': appointment.date ? format(new Date(appointment.date), 'dd/MM/yyyy', { locale: it }) : '-',
      }));
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "Lavori Completati");
      XLSX.writeFile(wb, `storico_lavori_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Esportazione completata",
        description: "Lo storico dei lavori è stato esportato con successo",
      });
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Funzione per generare PDF del preventivo
  const handleGeneratePDF = async (quoteId: string) => {
    if (!quoteId) {
      toast({
        title: "Preventivo non disponibile",
        description: "Non c'è un preventivo associato a questo appuntamento",
        variant: "destructive",
      });
      return;
    }

    try {
      // Recupera i dati del preventivo
      const quote = await getQuoteById(quoteId);
      
      if (!quote) {
        toast({
          title: "Preventivo non trovato",
          description: "Il preventivo associato non è stato trovato",
          variant: "destructive",
        });
        return;
      }
      
      // Genera PDF
      await exportQuoteToPDF(quote);
      
      toast({
        title: "PDF generato",
        description: "Il PDF del preventivo è stato generato con successo",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la generazione del PDF",
        variant: "destructive",
      });
    }
  };

  // Funzione per generare PDF del tagliando completo
  const handleGenerateTagliandoPDF = async (plateId: string, phone: string) => {
    if (!plateId) {
      toast({
        title: "Targa non disponibile",
        description: "Non è possibile generare il PDF del tagliando senza la targa",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generazione in corso",
        description: "Sto generando il PDF del tagliando completo...",
      });
      
      // Recupera i dati del veicolo direttamente da Firebase Realtime Database
      const vehicleRef = ref(rtdb, `vehicles/${plateId}`);
      const vehicleSnapshot = await get(vehicleRef);
      
      if (!vehicleSnapshot.exists()) {
        toast({
          title: "Dati veicolo non trovati",
          description: "Non sono stati trovati i dati del veicolo per questo tagliando",
          variant: "destructive",
        });
        return;
      }
      
      // Semplice approccio alternativo: apriamo una nuova finestra con il componente di consegna
      // per quel veicolo specifico
      const baseUrl = window.location.origin;
      const deliveryUrl = `${baseUrl}/deliveryPhase/${plateId}?generatePdf=true&phone=${encodeURIComponent(phone || "")}&fromStorico=true`;
      
      // Apri la pagina in una nuova finestra
      window.open(deliveryUrl, '_blank');
      
      toast({
        title: "Pagina di consegna aperta",
        description: "La pagina di consegna è stata aperta in una nuova scheda. Il PDF verrà generato automaticamente.",
      });
    } catch (error) {
      console.error("Errore nella generazione del tagliando:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la generazione del PDF del tagliando",
        variant: "destructive",
      });
    }
  };

  // Formatta la data
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: it });
    } catch (e) {
      return dateString;
    }
  };

  if (clientId) {
    // AMBIENTE CLIENTE: solo tabella dei suoi lavori completati
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold mb-4">Storico lavori completati</h1>
        <Card className="overflow-hidden border rounded-md">
          {filteredAppointments.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Nessun lavoro completato trovato</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CODICE CLIENTE</TableHead>
                  <TableHead>COGNOME E NOME</TableHead>
                  <TableHead>TARGA</TableHead>
                  <TableHead>NR. PREVENTIVO</TableHead>
                  <TableHead>DATA COMPLETAMENTO</TableHead>
                  <TableHead className="text-center">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment: Appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">{appointment.clientId}</TableCell>
                    <TableCell>{appointment.clientName}</TableCell>
                    <TableCell>{appointment.plate}</TableCell>
                    <TableCell>{appointment.quoteId || "-"}</TableCell>
                    <TableCell>{formatDate(appointment.date)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center space-x-1">
                        {appointment.quoteId ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleGeneratePDF(appointment.quoteId as string)}
                            title="Genera PDF del preventivo"
                          >
                            <FileText className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {appointment.plate ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleGenerateTagliandoPDF(appointment.plate, appointment.phone || "")}
                            title="Genera PDF del tagliando completo"
                          >
                            <FileCheck className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  // ADMIN: mostra tutti i lavori completati filtrati e ricercabili
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pb-2">
        <Heading title="Storico Lavori" description="Visualizza tutti i lavori completati" />
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2 items-center">
          <div className="flex items-center mr-4 text-xs text-muted-foreground">
            <span className="ml-1 text-xs">
              (Ultimo: {format(lastRefreshTime, "HH:mm:ss")})
            </span>
          </div>
          <Button 
            variant="secondary" 
            className="w-full sm:w-auto" 
            onClick={handleExportToExcel}
            disabled={isExporting || filteredAppointments.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {isExporting ? "Esportazione..." : "Esporta Excel"}
          </Button>
          
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={handleRefresh} 
            className="ml-auto sm:ml-2"
            title="Ricarica dati"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Barra di ricerca */}
      <div className="w-full relative">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-orange-500" />
        <Input
          className="pl-9 w-full border-2 border-orange-500/30 focus:border-orange-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {/* Tabella dei lavori completati */}
      <Card className="overflow-hidden border rounded-md">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Caricamento lavori in corso...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Nessun lavoro completato trovato</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CODICE CLIENTE</TableHead>
                <TableHead>COGNOME E NOME</TableHead>
                <TableHead>TARGA</TableHead>
                <TableHead>NR. PREVENTIVO</TableHead>
                <TableHead>DATA COMPLETAMENTO</TableHead>
                <TableHead className="text-center">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appointment: Appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-medium text-orange-500">{appointment.clientId}</TableCell>
                  <TableCell>{appointment.clientName}</TableCell>
                  <TableCell>{appointment.plate}</TableCell>
                  <TableCell>{appointment.quoteId || "-"}</TableCell>
                  <TableCell>{formatDate(appointment.date)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center items-center space-x-1">
                      {appointment.quoteId ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleGeneratePDF(appointment.quoteId as string)}
                          title="Genera PDF del preventivo"
                        >
                          <FileText className="h-4 w-4 text-primary" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      
                      {appointment.plate ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleGenerateTagliandoPDF(appointment.plate, appointment.phone || "")}
                          title="Genera PDF del tagliando completo"
                        >
                          <FileCheck className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
} 