import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Loader2, MessageSquare, Plus } from "lucide-react";
import { QuoteItem } from "@shared/schema";
import { UseFormReturn } from "react-hook-form";
import FocusableNumberInput, { globalSummaryStore } from "./FocusableNumberInput";
import { toast } from "react-hot-toast";

// Reimplementiamo la funzione per calcolare solo i ricambi, senza riferimenti a manodopera
const calculateItemTotal = (item: QuoteItem): number => {
  // Calcola solo il totale dei ricambi
  return Array.isArray(item.parts) 
    ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
    : 0;
};

interface SummaryStepFormProps {
  items: QuoteItem[];
  laborHours: number;
  setLaborHours: (hours: number) => void;
  taxRate: number;
  setTaxRate: (rate: number) => void;
  form: UseFormReturn<any>;
  goToPreviousStep: () => void;
  onSubmit: (data: any) => void;
}

export default function SummaryStepForm({
  items,
  laborHours,
  setLaborHours,
  taxRate,
  setTaxRate,
  form,
  goToPreviousStep,
  onSubmit
}: SummaryStepFormProps) {
  // Stato locale per il prezzo del lavoro per evitare loop di aggiornamento
  const [localLaborPrice, setLocalLaborPrice] = useState(form.getValues("laborPrice") || 35);
  
  // Flag per prevenire doppi submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Forza il re-render quando i valori cambiano - SOLO per aggiornare la UI
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Stato per il popup delle note
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  
  // Refresh periodico SOLO per aggiornare la UI dei calcoli
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Inizializza lo store globale
  useEffect(() => {
    globalSummaryStore["extraLaborHours"] = laborHours;
    globalSummaryStore["extraLaborRate"] = localLaborPrice;
    globalSummaryStore["taxRate"] = taxRate;
    
    // FIX FIREFOX: Per la modifica di preventivi esistenti, forza la sincronizzazione
    if (navigator.userAgent.includes('Firefox')) {
      console.log("🔥 FIREFOX FIX: Inizializzazione per modifica preventivo esistente", {
        laborHours,
        localLaborPrice,
        taxRate
      });
      
      // Aspetta un momento per assicurarsi che i campi siano renderizzati
      setTimeout(() => {
        // Forza l'aggiornamento dei valori nei campi numerici
        const laborHoursInput = document.getElementById('extraLaborHours') as HTMLInputElement;
        const laborRateInput = document.getElementById('extraLaborRate') as HTMLInputElement;
        const taxRateInput = document.getElementById('taxRate') as HTMLInputElement;
        
        if (laborHoursInput && laborHoursInput.value !== laborHours.toString()) {
          laborHoursInput.value = laborHours.toString();
          laborHoursInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (laborRateInput && laborRateInput.value !== localLaborPrice.toString()) {
          laborRateInput.value = localLaborPrice.toString();
          laborRateInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (taxRateInput && taxRateInput.value !== taxRate.toString()) {
          taxRateInput.value = taxRate.toString();
          taxRateInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        console.log("🔥 FIREFOX FIX: Valori sincronizzati nei campi input");
      }, 100);
    }
  }, [laborHours, localLaborPrice, taxRate]); // Aggiunto le dipendenze per Firefox

  // Sincronizza localLaborPrice con il form quando cambia
  useEffect(() => {
    form.setValue("laborPrice", localLaborPrice);
    globalSummaryStore["extraLaborRate"] = localLaborPrice;
  }, [localLaborPrice, form]);

  // Reset del flag di submit quando il componente cambia
  useEffect(() => {
    setIsSubmitting(false);
  }, [items]);

  // Cleanup quando il componente si smonta
  useEffect(() => {
    return () => {
      setIsSubmitting(false);
    };
  }, []);

  // Calcoli dei totali utilizzando SOLO lo store globale 
  const laborCost = (globalSummaryStore["extraLaborHours"] || 0) * (globalSummaryStore["extraLaborRate"] || 35);
  const partsTotal = items.reduce((sum, item) => {
    return sum + (Array.isArray(item.parts) 
      ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
      : 0); 
  }, 0);
  const subtotal = partsTotal + laborCost;
  const vatAmount = subtotal * (globalSummaryStore["taxRate"] || 22) / 100;
  const grandTotal = subtotal + vatAmount;

  // Formatta valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace('€', '€ ');
  };

  // Gestisce il submit con protezione contro doppi click
  const protectedOnSubmit = useCallback((data: any) => {
    // Previeni doppi submit
    if (isSubmitting) {
      // console.log('Submit già in corso, ignorando...');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Sincronizza tutti i valori dallo store globale
      if (globalSummaryStore["extraLaborHours"] !== undefined) {
        setLaborHours(globalSummaryStore["extraLaborHours"]);
      }
      
      if (globalSummaryStore["taxRate"] !== undefined) {
        setTaxRate(globalSummaryStore["taxRate"]);
      }
      
      if (globalSummaryStore["extraLaborRate"] !== undefined) {
        setLocalLaborPrice(globalSummaryStore["extraLaborRate"]);
        form.setValue("laborPrice", globalSummaryStore["extraLaborRate"]);
      }
      
      // Chiamata all'onSubmit originale
      onSubmit(data);
    } catch (error) {
      console.error('Errore nel submit:', error);
      setIsSubmitting(false);
    }
  }, [isSubmitting, setLaborHours, setTaxRate, setLocalLaborPrice, form, onSubmit]);

  return (
    <div className="space-y-4 bg-gray-900 text-white p-3 pb-2">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Riepilogo e Conferma</h2>
        <div className="text-xs text-muted-foreground">Passo 3 di 3</div>
      </div>
      
      <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/50">
        <h3 className="font-medium text-white flex items-center gap-2 mb-3 text-sm">
          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
          Servizi ({items.length})
          <div className="text-xs text-muted-foreground">
            <Button variant="outline" size="icon" className="text-gray-400" onClick={(e) => {
              e.preventDefault(); // Previene la chiusura del form
              const servicesText = items.map(item => item.serviceType.description).join('\n');
              const clientInfo = `Cliente: ${form.getValues().clientName}\nTarga: ${form.getValues().plate}\n\nRicambi:\n${servicesText}\n\nNote: \n${form.getValues().notes}`;
              navigator.clipboard.writeText(clientInfo);
              toast("Copiato! Il messaggio è stato copiato negli appunti", {
                icon: "📋",
                duration: 2000,
              });
            }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-700">
              <th className="text-left p-1.5 font-medium text-gray-300">Codice</th>
                <th className="text-left p-1.5 font-medium text-gray-300">Descrizione</th>
                <th className="text-left p-1.5 font-medium text-gray-300 hidden sm:table-cell">Q.tà</th>
                <th className="text-right p-1.5 font-medium text-gray-300">Ricambi</th>
                <th className="text-right p-1.5 font-medium text-gray-300">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter(item => item && Array.isArray(item.parts) && item.parts.length > 0)
                .map((item, index) => (
                <tr key={index} className="border-b border-gray-700/50">
                  <td className="p-1.5 text-white">
                    {item.parts && item.parts[0] ? item.parts[0].code : 'N/D'}
                  </td>
                  <td className="p-1.5 text-white">
                    {item.serviceType ? item.serviceType.description : 'Servizio sconosciuto'}
                  </td>
                  <td className="p-1.5 text-gray-400 hidden sm:table-cell">
                    {item.parts && item.parts[0] ? item.parts[0].quantity : 0}
                  </td>
                  <td className="p-1.5 text-right font-bold text-orange-400">
                    {Array.isArray(item.parts) && item.parts.length > 0 
                      ? `${formatCurrency(calculateItemTotal(item))} (${item.parts.length})`
                      : "-"}
                  </td>
                  <td className="p-1.5 text-right">
                    <button 
                      type="button" 
                      className="p-1 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                      onClick={() => {
                        // Logica per tornare al passaggio 2 (ricambi) con questo servizio selezionato
                        if (goToPreviousStep) {
                          // Memorizza l'ID del servizio in localStorage per poterlo selezionare in passaggio 2
                          localStorage.setItem('editServiceId', item.id);
                          // Torna al passaggio precedente (2 - Ricambi)
                          goToPreviousStep();
                        }
                      }}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Sezione manodopera e totali */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Manodopera a sinistra */}
        <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/50">
          <h3 className="font-medium text-white flex items-center gap-2 mb-3 text-sm">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            Manodopera Extra
          </h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="extraLaborRate" className="block text-xs font-medium text-gray-300 mb-1">Tariffa €/ora</Label>
                <FocusableNumberInput
                  id="extraLaborRate"
                  value={localLaborPrice}
                  onChange={setLocalLaborPrice}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  min={0}
                  step={0.01}
                />
              </div>
              <div>
                <Label htmlFor="extraLaborHours" className="block text-xs font-medium text-gray-300 mb-1">Ore</Label>
                <FocusableNumberInput
                  id="extraLaborHours"
                  value={laborHours}
                  onChange={setLaborHours}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  min={0}
                  step={0.5}
                />
              </div>
            </div>
            <div className="bg-gray-800/70 p-2 rounded border border-gray-700/50">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Totale ore:</span>
                <span className="text-white">{globalSummaryStore["extraLaborHours"] || 0}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">Costo manodopera:</span>
                <span className="font-bold text-orange-400">{formatCurrency(laborCost)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Totali a destra */}
        <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/50">
          <h3 className="font-medium text-white flex items-center gap-2 mb-3 text-sm">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
            Totali
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="taxRate" className="text-xs font-medium text-gray-300 whitespace-nowrap">IVA %</Label>
              <FocusableNumberInput
                id="taxRate"
                value={taxRate}
                onChange={setTaxRate}
                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                min={0}
                max={100}
              />
            </div>
          
            <div className="bg-gray-800/70 p-2 rounded border border-gray-700/50 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotale (ricambi):</span>
                <span className="text-white">{formatCurrency(partsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Manodopera:</span>
                <span className="text-white">{formatCurrency(laborCost)}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-gray-600 pt-1 mt-1">
                <span className="text-gray-300">Subtotale:</span>
                <span className="text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IVA ({globalSummaryStore["taxRate"] || 22}%):</span>
                <span className="text-white">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold bg-orange-900/30 p-1.5 rounded mt-2 border border-orange-500/30">
                <span className="text-orange-400">TOTALE:</span>
                <span className="text-orange-400">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            
            {/* Bottone per aprire le note */}
            <Button
              type="button"
              onClick={() => setIsNotesOpen(true)}
              className="w-full mt-2 bg-gray-600 hover:bg-gray-700 text-white text-xs py-2"
            >
              <MessageSquare className="mr-2 h-3 w-3" />
              {form.getValues("notes") ? "Modifica Note" : "Aggiungi Note"}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Popup per le note */}
      <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
        <DialogContent className="max-w-md bg-gray-900 text-white border border-gray-700 z-[1200]">
          <DialogHeader>
            <DialogTitle className="text-orange-500">Note del Preventivo</DialogTitle>
            <DialogDescription className="text-gray-400">
              Inserisci eventuali note o commenti per questo preventivo
            </DialogDescription>
          </DialogHeader>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    {...field}
                    placeholder="Inserisci eventuali note o commenti..."
                    className="min-h-[120px] bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsNotesOpen(false)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Salva Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 