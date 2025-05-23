import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { FileDown, Search, RefreshCw, FileText, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from 'xlsx';

import { Heading } from "@/components/ui/heading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

import { getAllQuotes, getAllAppointments } from "@shared/firebase";
import { raggruppaPerTipoRicambio } from "@/utils/ricambi";

export default function OrdersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: getAllQuotes,
    staleTime: 1000, // Cache valida solo per 1 secondo
    refetchInterval: 3000, // Refetch automatico ogni 3 secondi
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  
  // Aggiungi una query per ottenere gli appuntamenti necessari a determinare lo stato dei ricambi
  const { data: appointments = [], isLoading: appointmentsLoading, refetch: refetchAppointments } = useQuery({
    queryKey: ["/appointments"],
    queryFn: getAllAppointments,
    staleTime: 1000, // Cache valida solo per 1 secondo
    refetchInterval: 3000, // Refetch automatico ogni 3 secondi
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
  
  // Verifico se abbiamo dati validi
  useEffect(() => {
    console.log("Dati disponibili:", {
      ordini: orders.length,
      appuntamenti: appointments.length
    });
  }, [orders, appointments]);
  
  // Utilizzo la funzione raggruppaPerTipoRicambio per ottenere i ricambi raggruppati con lo stato
  const ricambiRaggruppati = raggruppaPerTipoRicambio(orders, search, appointments);
  
  // Conteggio totale dei ricambi prima del filtraggio (per debugging)
  const totalPartsBeforeFiltering = Object.values(ricambiRaggruppati).reduce((total, parts) => total + parts.length, 0);
  
  // Estrai tutte le parti di tutti gli ordini
  // Filtra per mostrare SOLO i ricambi da ordinare (partsOrdered = false)
  const partsToOrder = Object.values(ricambiRaggruppati)
    .flat()
    .filter(part => part.partsOrdered === false);
  
  // Log dei ricambi filtrati per debugging
  useEffect(() => {
    console.log("DEBUG - Ricambi:", {
      totale: partsToOrder.length,
      esempio: partsToOrder.length > 0 ? partsToOrder[0] : null
    });
  }, [partsToOrder]);
  
  // Funzione per aggiornare i dati
  const refreshData = async () => {
    try {
      console.log("Forzatura aggiornamento dati...");
      
      // Invalida la cache per forzare un nuovo caricamento
      await queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/appointments"] });
      
      // Forza un refetch immediato
      await Promise.all([refetchOrders(), refetchAppointments()]);
      
      // Aggiorna la pagina per essere sicuri che tutto venga ricreato
      setTimeout(() => {
        console.log("Ricaricamento completo della funzione di raggruppamento...");
        // Questo forza un re-render completo del componente
        setSearch(s => s + " ");
        setTimeout(() => setSearch(s => s.trim()), 100);
      }, 500);
      
      toast({
        title: "Dati aggiornati",
        description: "I dati degli ordini sono stati aggiornati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore di aggiornamento",
        description: "Si è verificato un errore durante l'aggiornamento dei dati",
        variant: "destructive",
      });
    }
  };
  
  // Effetto per il polling automatico dei dati
  useEffect(() => {
    // Imposta un intervallo per aggiornare automaticamente i dati
    const interval = setInterval(() => {
      console.log("Aggiornamento automatico degli ordini...");
      refreshData();
    }, 10 * 1000); // Ogni 10 secondi
    
    // Pulisci l'intervallo quando il componente viene smontato
    return () => clearInterval(interval);
  }, []);

  // Funzione per esportare le parti in Excel
  const handleExportOrders = async () => {
    try {
      setIsExporting(true);
      const exportData = partsToOrder.map(row => ({
        'Nome e Cognome': row.clientName || '-',
        'Targa': row.plate || '-',
        'Codice Articolo': row.code || '-',
        'Quantità': row.quantity || '-',
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "Ordini Da Effettuare");
      XLSX.writeFile(wb, `ordini_da_effettuare_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({
        title: "Esportazione completata",
        description: "Gli ordini da effettuare sono stati esportati con successo",
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

  const isLoading = ordersLoading || appointmentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pb-2">
        <Heading title="Gestione Ordini" description="Monitora i ricambi da ordinare per i tuoi clienti" />
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto" 
            onClick={handleExportOrders}
            disabled={isExporting || partsToOrder.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {isExporting ? "Esportazione..." : "Esporta Excel"}
          </Button>
          
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={refreshData} 
            className="ml-auto sm:ml-2"
            title="Ricarica dati"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Barra di ricerca */}
      <div className="w-full relative">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per cliente, targa o codice articolo..."
          className="pl-9 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      {/* Tabella degli ordini da effettuare */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Caricamento ordini in corso...</p>
          </div>
        ) : partsToOrder.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Nessun ricambio da ordinare trovato</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NOME E COGNOME</TableHead>
                <TableHead>TARGA</TableHead>
                <TableHead>CODICE ARTICOLO</TableHead>
                <TableHead className="text-right">QUANTITÀ</TableHead>
                <TableHead className="text-center">STATO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partsToOrder.map((row, idx) => (
                <TableRow key={row.code + row.plate + idx}>
                  <TableCell className="font-medium">{row.clientName || '-'}</TableCell>
                  <TableCell>{row.plate || '-'}</TableCell>
                  <TableCell>{row.code || '-'}</TableCell>
                  <TableCell className="text-right">{row.quantity || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      Da ordinare
                    </Badge>
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