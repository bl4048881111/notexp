import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Search, RefreshCw, FileDown, Filter, Clock, DollarSign, Calculator, Settings } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from 'xlsx';

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerWithRange } from "../components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";

import { getAllQuotes } from "@shared/supabase";
import { Quote } from "@shared/schema";
import { useAuth } from "../contexts/AuthContext";

interface ReportData {
  clientName: string;
  clientId: string;
  plate: string;
  completionDate: string;
  laborHours: number;
  laborPrice: number;
  parts_subtotal: number;
  total_price: number;
  service: string;
  quoteId: string;
}

export default function ReportLavoriPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const { user } = useAuth();
  const clientId = user?.clientId;
  const isAdmin = !clientId; // Se non ha clientId è admin

  // Query per ottenere tutti i preventivi completati
  const { data: allQuotes = [], isLoading, refetch: refetchQuotes } = useQuery({
    queryKey: ['/api/quotes'],
    queryFn: getAllQuotes,
    staleTime: 0, // Nessuna cache
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000, // Ricarica ogni 30 secondi automaticamente
  });

  // Query per ottenere tutti gli appuntamenti
  const { data: allAppointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: async () => {
      const { getAllAppointments } = await import("@shared/supabase");
      return getAllAppointments();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000,
  });

  // Filtra solo i preventivi completati e per il cliente se necessario
  const completedQuotes = useMemo(() => {
    return (allQuotes as Quote[]).filter((quote: Quote) => {
      const isCompleted = quote.status === 'completato';
      const isClientMatch = !clientId || quote.clientId === clientId;
      return isCompleted && isClientMatch;
    });
  }, [allQuotes, clientId]);

  // Calcola i dati del report direttamente dai preventivi completati
  const reportData = useMemo<ReportData[]>(() => {
    return completedQuotes.map((quote: Quote) => {
      // Usa i dati direttamente dal preventivo
      const laborHours = quote.laborHours || 0;
      const laborPrice = quote.laborPrice || 0;
      const parts_subtotal = (quote as any).parts_subtotal || 0; // Usa il campo mappato dal database
      
      // Calcola il totale SENZA IVA sottraendo la tax_rate
      const totalWithIva = quote.totalPrice || quote.total || 0; // Totale CON IVA dal database
      const taxRate = quote.taxRate || 22; // IVA (default 22%)
      const total_price = totalWithIva / (1 + taxRate / 100); // Totale SENZA IVA
      
      // Calcola i servizi eseguiti dal preventivo
      let service = '';
      if (quote.items && Array.isArray(quote.items)) {
        const services = quote.items.map((item: any) => {
          if (item.serviceType?.category === "Altro") {
            return item.serviceType.name;
          } else {
            return item.serviceType?.category || 'Servizio non specificato';
          }
        });
        service = Array.from(new Set(services)).join(', ');
      } else {
        service = 'Servizio non specificato';
      }
      
      // CORRETTO: Trova la data di completamento dall'appuntamento associato
      let completionDate = quote.date || ''; // Fallback alla data del preventivo se non trova l'appuntamento
      
      // Cerca l'appuntamento completato associato a questo preventivo
      const relatedAppointment = allAppointments.find((appointment: any) => 
        appointment.quoteId === quote.id && appointment.status === 'completato'
      );
      
      if (relatedAppointment) {
        // Usa la data dell'appuntamento completato come data di completamento
        completionDate = relatedAppointment.date;
      }
      
      return {
        clientName: quote.clientName || 'Cliente sconosciuto',
        clientId: quote.clientId || '',
        plate: quote.plate || '',
        completionDate,
        laborHours,
        laborPrice,
        parts_subtotal,
        total_price,
        service,
        quoteId: quote.id,
      };
    }).sort((a: ReportData, b: ReportData) => {
      // Ordina per data di completamento (più recente prima)
      return new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime();
    });
  }, [completedQuotes, allAppointments]);

  // Filtra i dati in base alla ricerca e al range di date
  const filteredReportData = useMemo(() => {
    return reportData.filter(data => {
      // Filtro per ricerca
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        data.clientName.toLowerCase().includes(query) ||
        data.plate.toLowerCase().includes(query) ||
        data.clientId.toLowerCase().includes(query) ||
        data.service.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // Filtro per range di date
      if (dateRange.from || dateRange.to) {
        const completionDate = new Date(data.completionDate);
        
        if (dateRange.from && completionDate < dateRange.from) return false;
        if (dateRange.to && completionDate > dateRange.to) return false;
      }

      return true;
    });
  }, [reportData, searchQuery, dateRange]);

  // Calcola i totali
  const totals = useMemo(() => {
    return filteredReportData.reduce(
      (acc, item) => ({
        totalHours: acc.totalHours + item.laborHours,
        totalPartsSubtotal: acc.totalPartsSubtotal + item.parts_subtotal,
        totalLaborPrice: acc.totalLaborPrice + (item.laborHours * item.laborPrice),
        grandTotal: acc.grandTotal + item.total_price,
        totalRecords: acc.totalRecords + 1,
      }),
      {
        totalHours: 0,
        totalPartsSubtotal: 0,
        totalLaborPrice: 0,
        grandTotal: 0,
        totalRecords: 0,
      }
    );
  }, [filteredReportData]);

  // Funzione per formattare la valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Funzione per formattare le ore
  const formatHours = (hours: number): string => {
    return `${hours.toFixed(1)}h`;
  };

  // Funzione per formattare la data
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: it });
    } catch (e) {
      return dateString;
    }
  };

  // Funzione per aggiornare i dati
  const handleRefresh = async () => {
    try {
      // Invalida e ricarica la cache di React Query per entrambe le query
      await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      // Esegui il refetch di entrambe le query
      await Promise.all([refetchQuotes(), refetchAppointments()]);
      
      // Refresh silenzioso - nessun toast
    } catch (error) {
      console.error('Errore durante l\'aggiornamento:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dei dati",
        variant: "destructive",
      });
    }
  };

  // Funzione per sincronizzare appuntamenti completati con preventivi
  const handleSyncQuotes = async () => {
    if (!isAdmin) return;
    
    try {
      setIsSyncing(true);
      
      const { syncCompletedAppointmentsWithQuotes } = await import("@shared/supabase");
      const result = await syncCompletedAppointmentsWithQuotes();
      
      if (result.updated > 0) {
        toast({
          title: "Sincronizzazione completata",
          description: `${result.updated} preventivi aggiornati a "completato". ${result.skipped} già sincronizzati.`,
        });
        
        // Ricarica i dati
        await handleRefresh();
      } else {
        toast({
          title: "Nessun aggiornamento necessario",
          description: `Tutti i preventivi sono già sincronizzati. ${result.skipped} appuntamenti verificati.`,
        });
      }
      
      if (result.errors.length > 0) {
        console.error('Errori durante la sincronizzazione:', result.errors);
      }
      
    } catch (error) {
      console.error('Errore durante la sincronizzazione:', error);
      toast({
        title: "Errore nella sincronizzazione",
        description: "Si è verificato un errore durante la sincronizzazione",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Funzione per esportare in Excel
  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);
      
      const exportData = filteredReportData.map(item => ({
        'Cliente': item.clientName,
        'Cod. Cliente': item.clientId,
        'Targa': item.plate,
        'Data Completamento': formatDate(item.completionDate),
        'Servizio': item.service,
        'Ore Lavoro': item.laborHours,
        'Prezzo Manodopera €': item.laborPrice,
        'Subtotale Parti €': item.parts_subtotal,
        'Totale €': item.total_price,
        'Nr. Preventivo': item.quoteId,
      }));

      // Aggiungi riga totali
      exportData.push({
        'Cliente': '=== TOTALI ===',
        'Cod. Cliente': '',
        'Targa': '',
        'Data Completamento': '',
        'Servizio': '',
        'Ore Lavoro': totals.totalHours,
        'Prezzo Manodopera €': totals.totalLaborPrice,
        'Subtotale Parti €': totals.totalPartsSubtotal,
        'Totale €': totals.grandTotal,
        'Nr. Preventivo': `${totals.totalRecords} lavori`,
      });
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "Report Lavori");
      
      const fileName = `report_lavori_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Esportazione completata",
        description: `File ${fileName} scaricato con successo`,
      });
    } catch (error) {
      console.error('Errore durante l\'esportazione:', error);
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading
          title="Report Lavori Completati"
          description="Visualizza ore di lavoro, costi e totali per i lavori completati"
        />
        <div className="flex items-center gap-2">
          {/* Pulsante di sincronizzazione - solo per admin */}
          {isAdmin && (
            <Button
              onClick={handleSyncQuotes}
              variant="outline"
              size="sm"
              disabled={isSyncing}
              title="Sincronizza i preventivi degli appuntamenti completati"
            >
              <Settings className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? "Sincronizzando..." : "Sincronizza"}
            </Button>
          )}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          <Button
            onClick={handleExportToExcel}
            variant="outline"
            size="sm"
            disabled={isExporting || filteredReportData.length === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? "Esportando..." : "Esporta Excel"}
          </Button>
        </div>
      </div>

      {/* Card con i totali */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Lavori</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalRecords}</div>
            <p className="text-xs text-muted-foreground">
              lavori completati
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Totali</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totals.totalHours)}</div>
            <p className="text-xs text-muted-foreground">
              ore di manodopera
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parti</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalPartsSubtotal)}</div>
            <p className="text-xs text-muted-foreground">
              subtotale parti
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.grandTotal)}</div>
            <p className="text-xs text-muted-foreground">
              totale complessivo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per cliente, targa, codice cliente o servizio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex-1">
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                placeholder="Seleziona periodo di completamento"
              />
            </div>
            {(searchQuery || dateRange.from || dateRange.to) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setDateRange({ from: undefined, to: undefined });
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Pulisci filtri
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabella dei risultati */}
      <Card>
        <CardHeader>
          <CardTitle>Dettaglio Lavori</CardTitle>
          <CardDescription>
            {filteredReportData.length} lavori trovati
            {dateRange.from && dateRange.to && 
              ` dal ${formatDate(dateRange.from.toISOString())} al ${formatDate(dateRange.to.toISOString())}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Targa</TableHead>
                  <TableHead>Data Completamento</TableHead>
                  <TableHead>Servizio</TableHead>
                  <TableHead className="text-right">Ore Lavoro</TableHead>
                  <TableHead className="text-right">Prezzo Manodopera</TableHead>
                  <TableHead className="text-right">Subtotale Parti</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead>Preventivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={9} className="text-center">
                        <div className="animate-pulse bg-muted rounded h-6"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredReportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nessun lavoro completato trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReportData.map((item) => (
                    <TableRow key={item.quoteId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.clientName}</div>
                          <div className="text-sm text-muted-foreground">{item.clientId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {item.plate}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.completionDate)}</TableCell>
                      <TableCell>
                        <div className="max-w-32 truncate" title={item.service}>
                          {item.service}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatHours(item.laborHours)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.laborPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.parts_subtotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {item.quoteId}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 