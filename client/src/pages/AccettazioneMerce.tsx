import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Search, RefreshCw, Check, X, ChevronDown, ChevronUp, History, Calendar } from "lucide-react";

import { Heading } from "@/components/ui/heading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { getAllQuotes, getAllAppointments, getOrderedParts, updateOrderedPartStatus, createOrderedPart } from "@shared/supabase";
import { raggruppaPerTipoRicambio } from "@/utils/ricambi";
import { OrderedPart } from "@shared/schema";

interface ProdottoOrdinato {
  id?: string;
  code: string;
  description?: string;
  unitPrice?: number;
  quantity: number;
  clientName: string;
  plate: string;
  quoteId: string;
  appointmentId: string;
  ricevuto: boolean;
  dataRicezione?: string;
}

interface PreventivoGruppo {
  quoteId: string;
  clientName: string;
  plate: string;
  prodotti: ProdottoOrdinato[];
  isExpanded: boolean;
}

// Nuovo interface per lo storico
interface StoricoGruppo {
  quoteId: string;
  clientName: string;
  plate: string;
  prodotti: ProdottoOrdinato[];
  dataRicezione: string;
}

export default function AccettazioneMercePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [storicoExpanded, setStoricoExpanded] = useState(false);
  const queryClient = useQueryClient();
  
  // Ref per mantenere lo stato di espansione tra i re-render
  const expansionStateRef = useRef<Map<string, boolean>>(new Map());
  
  // Ref per evitare aggiornamenti durante il mounting
  const isMountedRef = useRef(false);
  
  // Stato per forzare re-render quando cambia l'espansione
  const [expansionTrigger, setExpansionTrigger] = useState(0);

  // Query per ottenere ordini, appuntamenti e prodotti ordinati
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders, error: ordersError } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      // console.log('🔄 Caricamento ordini...');
      const result = await getAllQuotes();
      // console.log('📦 Ordini caricati:', result?.length || 0);
      return result || [];
    },
    staleTime: 0, // Sempre considera stale
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Sempre ricarica al mount
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: appointments = [], isLoading: appointmentsLoading, refetch: refetchAppointments, error: appointmentsError } = useQuery({
    queryKey: ["/appointments"],
    queryFn: async () => {
      // console.log('🔄 Caricamento appuntamenti...');
      const result = await getAllAppointments();
      // console.log('📅 Appuntamenti caricati:', result?.length || 0);
      return result || [];
    },
    staleTime: 0, // Sempre considera stale
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Sempre ricarica al mount
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: orderedParts = [], isLoading: orderedPartsLoading, refetch: refetchOrderedParts, error: orderedPartsError } = useQuery({
    queryKey: ["/ordered-parts"],
    queryFn: async () => {
      // console.log('🔄 Caricamento parti ordinate...');
      const result = await getOrderedParts();
      // console.log('🔧 Parti ordinate caricate:', result?.length || 0);
      return result || [];
    },
    staleTime: 0, // Sempre considera stale
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Sempre ricarica al mount
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Log di mounting - SPOSTATO DOPO le query per evitare problemi di timing
  useEffect(() => {
    // console.log('🏗️ AccettazioneMercePage montato');
    
    // Non chiamare refetch qui - le query sono già configurate per ricaricarsi al mount
    // Invalida le query per sicurezza
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/appointments"] });
    queryClient.invalidateQueries({ queryKey: ["/ordered-parts"] });

    return () => {
      // console.log('🚮 AccettazioneMercePage smontato');
    };
  }, []); // Solo al mount, senza dipendenze da refetch

  // Funzione stabile per processare i dati - SEMPLIFICATA per evitare ricreazioni
  const processedGruppi = useMemo(() => {
    // console.log('🔍 ProcessData chiamata - dati disponibili:', {
    //   orders: orders?.length || 0,
    //   appointments: appointments?.length || 0,
    //   orderedParts: orderedParts?.length || 0
    // });

    if (!orders?.length || !appointments?.length || !orderedParts) {
      // console.log('⚠️ Dati mancanti per processare');
      return [];
    }

    try {
      const ricambiRaggruppati = raggruppaPerTipoRicambio(orders, "", appointments);
      // console.log('📊 Ricambi raggruppati trovati:', Object.keys(ricambiRaggruppati).length);
      
      const gruppiTemp = new Map<string, PreventivoGruppo>();

      // Mappa per tenere traccia dei prodotti ordinati per codice e ID preventivo
      const orderedPartsMap = new Map<string, OrderedPart>();
      orderedParts.forEach(part => {
        const key = `${part.code}-${part.quoteId}`;
        orderedPartsMap.set(key, part);
      });

      let processedCount = 0;
      let acceptedCount = 0;

      Object.values(ricambiRaggruppati).forEach(gruppo => {
        gruppo.forEach(ricambio => {
          processedCount++;
          const key = `${ricambio.code}-${ricambio.quoteId}`;
          const orderedPart = orderedPartsMap.get(key);

          // Verifica se il preventivo ha lo status appropriato per l'accettazione
          const preventivo = orders.find(o => o.id === ricambio.quoteId);

          // Solo preventivi accettati
          if (!preventivo || !['accettato'].includes(preventivo.status)) {
            return;
          }

          acceptedCount++;

          const prodotto: ProdottoOrdinato = {
            id: orderedPart?.id,
            code: ricambio.code,
            description: orderedPart?.description || getPartDescriptionFromQuote(preventivo, ricambio.code),
            unitPrice: orderedPart?.unitPrice || getPartPriceFromQuote(preventivo, ricambio.code),
            quantity: ricambio.quantity,
            clientName: ricambio.clientName,
            plate: ricambio.plate,
            quoteId: ricambio.quoteId,
            appointmentId: ricambio.appointmentId,
            ricevuto: orderedPart?.received || false,
            dataRicezione: orderedPart?.receivedAt ? 
              format(new Date(orderedPart.receivedAt), 'dd/MM/yyyy', { locale: it }) : 
              undefined
          };

          if (!gruppiTemp.has(ricambio.quoteId)) {
            // Usa lo stato di espansione dal ref
            const isExpanded = expansionStateRef.current.get(ricambio.quoteId) ?? false;
            gruppiTemp.set(ricambio.quoteId, {
              quoteId: ricambio.quoteId,
              clientName: ricambio.clientName,
              plate: ricambio.plate,
              prodotti: [],
              isExpanded: isExpanded
            });
          }
          gruppiTemp.get(ricambio.quoteId)?.prodotti.push(prodotto);
        });
      });

      // console.log(`📈 Statistiche: ${processedCount} ricambi trovati, ${acceptedCount} accettati, ${gruppiTemp.size} gruppi creati`);

      // Filtra i gruppi per mostrare solo quelli con prodotti da ricevere
      const gruppiConProdottiDaRicevere = Array.from(gruppiTemp.values()).filter(gruppo => {
        return gruppo.prodotti.some(prodotto => !prodotto.ricevuto);
      });

      // console.log('✅ Gruppi finali con prodotti da ricevere:', gruppiConProdottiDaRicevere.length);
      return gruppiConProdottiDaRicevere;
    } catch (error) {
      // console.error('❌ Errore nel processamento dati:', error);
      return [];
    }
  }, [orders, appointments, orderedParts, expansionTrigger]); // Aggiungo expansionTrigger per forzare re-render

  // Funzione per creare lo storico dei prodotti ricevuti - STABILIZZATA
  const storicoProdotti = useMemo(() => {
    if (!orderedParts?.length || !orders?.length || !appointments?.length) {
      return [];
    }

    try {
      // Filtra solo i prodotti già ricevuti
      const prodottiRicevuti = orderedParts.filter(part => part.received && part.receivedAt);
      
      const storicoArray: ProdottoOrdinato[] = [];
      
      prodottiRicevuti.forEach(orderedPart => {
        // Trova il preventivo corrispondente
        const preventivo = orders.find(o => o.id === orderedPart.quoteId);
        if (!preventivo) return;
        
        // Trova l'appuntamento corrispondente
        const appuntamento = appointments.find(a => a.quoteId === orderedPart.quoteId);
        if (!appuntamento) return;

        const prodotto: ProdottoOrdinato = {
          id: orderedPart.id,
          code: orderedPart.code,
          description: orderedPart.description || getPartDescriptionFromQuote(preventivo, orderedPart.code),
          unitPrice: orderedPart.unitPrice || getPartPriceFromQuote(preventivo, orderedPart.code),
          quantity: orderedPart.quantity,
          clientName: preventivo.clientName,
          plate: preventivo.plate,
          quoteId: orderedPart.quoteId,
          appointmentId: orderedPart.appointmentId || appuntamento.id,
          ricevuto: true,
          dataRicezione: format(new Date(orderedPart.receivedAt!), 'dd/MM/yyyy HH:mm', { locale: it })
        };

        storicoArray.push(prodotto);
      });

      // Ordina per data di ricezione (più recenti prima)
      const storicoOrdinato = storicoArray.sort((a, b) => {
        if (!a.dataRicezione || !b.dataRicezione) return 0;
        const dateA = new Date(a.dataRicezione.split(' ')[0].split('/').reverse().join('-') + ' ' + a.dataRicezione.split(' ')[1]);
        const dateB = new Date(b.dataRicezione.split(' ')[0].split('/').reverse().join('-') + ' ' + b.dataRicezione.split(' ')[1]);
        return dateB.getTime() - dateA.getTime();
      });

      // console.log('📚 Storico processato:', storicoOrdinato.length, 'prodotti');
      return storicoOrdinato.slice(0, 10); // Limita ai primi 10
    } catch (error) {
      // console.error('❌ Errore nel processamento storico:', error);
      return [];
    }
  }, [orderedParts, orders, appointments]); // Tutto in un useMemo

  // Funzione per espandere/comprimere un gruppo
  const toggleGruppo = useCallback((quoteId: string) => {
    // Aggiorna il ref
    const currentState = expansionStateRef.current.get(quoteId) ?? false;
    expansionStateRef.current.set(quoteId, !currentState);
    
    // Forza re-render
    setExpansionTrigger(prev => prev + 1);
  }, []);

  // Funzione per aggiornare lo stato di ricezione di un prodotto
  const toggleRicezione = useCallback(async (prodotto: ProdottoOrdinato, event: React.MouseEvent) => {
    // Previeni la propagazione dell'evento per evitare che il click arrivi al contenitore
    event.stopPropagation();

    try {
      const nuovoStato = !prodotto.ricevuto;
      
      if (prodotto.id) {
        await updateOrderedPartStatus(prodotto.id, nuovoStato);
      } else {
        await createOrderedPart({
          quoteId: prodotto.quoteId,
          appointmentId: prodotto.appointmentId,
          code: prodotto.code,
          description: prodotto.description,
          unitPrice: prodotto.unitPrice,
          quantity: prodotto.quantity,
          received: nuovoStato,
          receivedAt: nuovoStato ? new Date().toISOString() : null
        });
      }

      // Invalidate queries in background
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/ordered-parts"] });
      }, 500);

      toast({
        title: nuovoStato ? "Prodotto ricevuto" : "Prodotto non ricevuto",
        description: `${prodotto.code} è stato marcato come ${nuovoStato ? 'ricevuto' : 'non ricevuto'}`,
      });

    } catch (error) {
      // console.error('Errore toggleRicezione:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  // Funzione per aggiornare manualmente i dati
  const refreshData = useCallback(() => {
    toast({
      title: "Aggiornamento in corso",
      description: "Sto aggiornando i dati...",
    });
    
    Promise.all([
      refetchOrders(),
      refetchAppointments(),
      refetchOrderedParts()
    ]).then(() => {
      toast({
        title: "Aggiornamento completato",
        description: "I dati sono stati aggiornati con successo",
      });
    }).catch((error) => {
      // console.error('Errore refresh:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dei dati",
        variant: "destructive",
      });
    });
  }, [refetchOrders, refetchAppointments, refetchOrderedParts, toast]);

  // Filtra i gruppi in base alla ricerca con useMemo per evitare ricalcoli
  const gruppiFiltrati = useMemo(() => {
    if (!search) return processedGruppi;
    
    const searchLower = search.toLowerCase();
    return processedGruppi.filter(gruppo => {
      return (
        gruppo.clientName.toLowerCase().includes(searchLower) ||
        gruppo.plate.toLowerCase().includes(searchLower) ||
        gruppo.prodotti.some(p => p.code.toLowerCase().includes(searchLower))
      );
    });
  }, [processedGruppi, search]);

  // Filtra lo storico in base alla ricerca generale
  const storicoFiltrato = useMemo(() => {
    if (!search) return storicoProdotti;
    
    const searchLower = search.toLowerCase();
    return storicoProdotti.filter(prodotto => {
      return (
        prodotto.clientName.toLowerCase().includes(searchLower) ||
        prodotto.plate.toLowerCase().includes(searchLower) ||
        prodotto.code.toLowerCase().includes(searchLower) ||
        (prodotto.description && prodotto.description.toLowerCase().includes(searchLower))
      );
    });
  }, [storicoProdotti, search]);

  const isLoading = ordersLoading || appointmentsLoading || orderedPartsLoading;
  const hasErrors = ordersError || appointmentsError || orderedPartsError;

  // Mostra errori in toast quando si verificano - SEMPLIFICATO per evitare loop
  useEffect(() => {
    if (ordersError) {
      toast({
        title: "Errore caricamento ordini",
        description: ordersError.message || "Errore sconosciuto",
        variant: "destructive",
      });
    }
    if (appointmentsError) {
      toast({
        title: "Errore caricamento appuntamenti", 
        description: appointmentsError.message || "Errore sconosciuto",
        variant: "destructive",
      });
    }
    if (orderedPartsError) {
      toast({
        title: "Errore caricamento parti ordinate",
        description: orderedPartsError.message || "Errore sconosciuto", 
        variant: "destructive",
      });
    }
  }, [ordersError, appointmentsError, orderedPartsError, toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pb-2">
        <Heading 
          title="Accettazione Merce" 
          description="Gestisci la ricezione dei prodotti in attesa" 
        />
        
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

      {/* Barra di ricerca */}
      <div className="w-full relative">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per codice prodotto, cliente o targa..."
          className="pl-9 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Indicatori di errore */}
      {hasErrors && (
        <Card className="p-4 border-red-500 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <X className="h-4 w-4" />
            <span className="font-semibold">Errori di caricamento rilevati:</span>
          </div>
          <div className="mt-2 text-sm text-red-600">
            {ordersError && <div>• Ordini: {ordersError.message}</div>}
            {appointmentsError && <div>• Appuntamenti: {appointmentsError.message}</div>}
            {orderedPartsError && <div>• Parti ordinate: {orderedPartsError.message}</div>}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            className="mt-2 border-red-500 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Riprova
          </Button>
        </Card>
      )}

      {/* Lista dei preventivi con prodotti da ricevere */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-orange-600">
          <Check className="h-5 w-5" />
          Prodotti in Attesa di Ricezione
        </div>
        {isLoading ? (
          <Card className="p-8">
            <div className="flex items-center justify-center">
              <p className="text-muted-foreground">Caricamento prodotti in corso...</p>
            </div>
          </Card>
        ) : gruppiFiltrati.length === 0 ? (
          <Card className="p-8">
            <div className="flex items-center justify-center">
              <p className="text-muted-foreground">Nessun prodotto da ricevere trovato</p>
            </div>
          </Card>
        ) : (
          gruppiFiltrati.map((gruppo) => (
            <Card key={gruppo.quoteId} className="overflow-hidden">
              {/* Intestazione del gruppo */}
              <div 
                className="p-4 bg-secondary/10 flex items-center justify-between cursor-pointer hover:bg-secondary/20"
                onClick={() => toggleGruppo(gruppo.quoteId)}
              >
                <div>
                  <h3 className="text-lg font-semibold text-orange-500">Cliente: {gruppo.clientName} - Targa: {gruppo.plate}</h3>
                  <p className="text-sm text-muted-foreground mt-1 text-left text-white">
                    Prodotti da ricevere: {gruppo.prodotti.filter(p => !p.ricevuto).length} / {gruppo.prodotti.length}
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  {gruppo.isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Tabella dei prodotti */}
              {gruppo.isExpanded && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CODICE PRODOTTO</TableHead>
                      <TableHead>DESCRIZIONE</TableHead>
                      <TableHead className="text-right">PRZ.UNITARIO</TableHead>
                      <TableHead className="text-right">QTÀ</TableHead>
                      <TableHead className="text-center">STATO</TableHead>
                      <TableHead className="text-center">DATA RICEZIONE</TableHead>
                      <TableHead className="text-center">AZIONI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gruppo.prodotti.map((prodotto, idx) => (
                      <TableRow key={`${prodotto.code}-${idx}`}>
                        <TableCell className="font-medium">{prodotto.code}</TableCell>
                        <TableCell>{prodotto.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          {prodotto.unitPrice ? `€ ${prodotto.unitPrice.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">{prodotto.quantity}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={prodotto.ricevuto ? 
                              "bg-green-500/10 text-green-500 border-green-500/20" : 
                              "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"}
                          >
                            {prodotto.ricevuto ? "RICEVUTO" : "ATTESA"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {prodotto.dataRicezione || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => toggleRicezione(prodotto, e)}
                            className={prodotto.ricevuto ? "text-red-500" : "text-green-500"}
                          >
                            {prodotto.ricevuto ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Storico Accettazione Merce - Menu a tendina */}
      {storicoProdotti.length > 0 && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {/* Intestazione cliccabile per espandere/comprimere */}
            <div 
              className="p-4 bg-secondary/10 flex items-center justify-between cursor-pointer hover:bg-secondary/20"
              onClick={() => setStoricoExpanded(!storicoExpanded)}
            >
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-orange-500">
                  Storico Accettazione Merce (Ultimi 10)
                </h3>
                <span className="text-sm text-muted-foreground">
                  ({storicoFiltrato.length} prodotti)
                </span>
              </div>
              <Button variant="ghost" size="icon">
                {storicoExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Tabella dello storico - mostrata solo se espansa */}
            {storicoExpanded && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CLIENTE</TableHead>
                    <TableHead>TARGA</TableHead>
                    <TableHead>CODICE PRODOTTO</TableHead>
                    <TableHead>DESCRIZIONE</TableHead>
                    <TableHead className="text-right">PRZ.UNITARIO</TableHead>
                    <TableHead className="text-right">QTÀ</TableHead>
                    <TableHead className="text-center">STATO</TableHead>
                    <TableHead className="text-center">DATA/ORA RICEZIONE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storicoFiltrato.map((prodotto, idx) => (
                    <TableRow key={`storico-${prodotto.id}-${idx}`}>
                      <TableCell className="font-medium text-orange-600">{prodotto.clientName}</TableCell>
                      <TableCell className="font-medium">{prodotto.plate}</TableCell>
                      <TableCell className="font-medium">{prodotto.code}</TableCell>
                      <TableCell>{prodotto.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        {prodotto.unitPrice ? `€ ${prodotto.unitPrice.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">{prodotto.quantity}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className="bg-green-500/10 text-green-500 border-green-500/20"
                        >
                          RICEVUTO
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {prodotto.dataRicezione || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// Funzioni helper per ottenere dati dal preventivo
const getPartDescriptionFromQuote = (preventivo: any, partCode: string): string => {
  // Cerca nella struttura items
  if (preventivo.items && Array.isArray(preventivo.items)) {
    for (const item of preventivo.items) {
      if (item.parts && Array.isArray(item.parts)) {
        const part = item.parts.find((p: any) => p.code === partCode);
        if (part) {
          return part.name || part.description || "Ricambio";
        }
      }
    }
  }
  
  // Cerca nella struttura legacy parts
  if (preventivo.parts && Array.isArray(preventivo.parts)) {
    const part = preventivo.parts.find((p: any) => p.code === partCode);
    if (part) {
      return part.description || part.name || "Ricambio";
    }
  }
  
  return "Ricambio";
};

const getPartPriceFromQuote = (preventivo: any, partCode: string): number => {
  // Cerca nella struttura items
  if (preventivo.items && Array.isArray(preventivo.items)) {
    for (const item of preventivo.items) {
      if (item.parts && Array.isArray(item.parts)) {
        const part = item.parts.find((p: any) => p.code === partCode);
        if (part) {
          return part.unitPrice || part.price || 0;
        }
      }
    }
  }
  
  // Cerca nella struttura legacy parts
  if (preventivo.parts && Array.isArray(preventivo.parts)) {
    const part = preventivo.parts.find((p: any) => p.code === partCode);
    if (part) {
      return part.price || part.unitPrice || 0;
    }
  }
  return 0;
}; 