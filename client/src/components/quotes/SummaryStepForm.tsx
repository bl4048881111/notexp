import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { QuoteItem } from "@shared/schema";
import { UseFormReturn } from "react-hook-form";
import React from "react";

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
  // Stato locale per la tariffa oraria per evitare la perdita del focus
  const [localLaborPrice, setLocalLaborPrice] = useState<number>(45);

  // Inizializza il valore della tariffa oraria se non è già impostato
  useEffect(() => {
    const currentLaborPrice = form.getValues().laborPrice;
    if (currentLaborPrice !== undefined && currentLaborPrice !== null) {
      setLocalLaborPrice(currentLaborPrice);
    } else {
      form.setValue("laborPrice", 45);
      setLocalLaborPrice(45);
    }
  }, [form]);

  // Sincronizza lo stato locale quando il valore del form cambia dall'esterno
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'laborPrice' && value.laborPrice !== undefined) {
        setLocalLaborPrice(value.laborPrice);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Forza l'aggiornamento immediato del valore dal form
  useEffect(() => {
    const currentValue = form.getValues().laborPrice;
    if (currentValue !== undefined && currentValue !== localLaborPrice) {
      setLocalLaborPrice(currentValue);
    }
  }, [form.getValues().laborPrice, localLaborPrice]);

  // Calcoli dei totali utilizzando il valore locale
  const laborCost = laborHours * localLaborPrice;
  
  // Calcola solo il subtotale dei ricambi (senza manodopera dei servizi)
  const partsTotal = items.reduce((sum, item) => {
    return sum + (Array.isArray(item.parts) 
      ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
      : 0); 
  }, 0);
  
  // Subtotale (ricambi + SOLO manodopera extra)
  const subtotal = partsTotal + laborCost;
  
  // IVA e totale
  const vatAmount = subtotal * taxRate / 100;
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

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-180px)] pb-14 relative bg-black text-white">
      {/* Header sempre visibile */}
      <div className="sticky top-0 z-10 bg-black pb-2">
        <div className="bg-orange-900/30 dark:bg-gray-800 rounded-lg p-2 mb-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-orange-400">
              Passo 4 di 4
            </div>
            <div className="w-2/3 bg-gray-800 rounded-full h-2.5">
              <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
        
        <h2 className="text-lg font-bold text-orange-500">Riepilogo e Conferma</h2>
      </div>
      
      <div className="border border-gray-800 rounded-lg overflow-hidden bg-black">
        <h3 className="bg-orange-950 text-orange-400 p-2 font-medium text-sm">Servizi ({items.length})</h3>
        
        <div className="p-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-1.5 font-medium text-xs text-orange-300">Servizio</th>
                  <th className="text-left p-1.5 font-medium text-xs text-orange-300 hidden sm:table-cell">Categoria</th>
                  <th className="text-right p-1.5 font-medium text-xs text-orange-300">Ricambi</th>
                  <th className="text-right p-1.5 font-medium text-xs text-orange-300">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-800 text-xs">
                    <td className="p-1.5">{item.serviceType.name}</td>
                    <td className="p-1.5 hidden sm:table-cell">{item.serviceType.category}</td>
                    <td className="p-1.5 text-right font-bold text-orange-400">
                      {Array.isArray(item.parts) && item.parts.length > 0 
                        ? `${formatCurrency(calculateItemTotal(item))} (${item.parts.length})`
                        : "-"}
                    </td>
                    <td className="p-1.5 text-right">
                      <button 
                        type="button" 
                        className="text-orange-500 hover:text-orange-400 transition-colors"
                        onClick={() => {
                          // Logica per tornare al passaggio 3 (ricambi) con questo servizio selezionato
                          if (goToPreviousStep) {
                            // Memorizza l'ID del servizio in localStorage per poterlo selezionare in passaggio 3
                            localStorage.setItem('editServiceId', item.id);
                            // Torna al passaggio precedente (3 - Ricambi)
                            goToPreviousStep();
                          }
                        }}
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
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
      </div>
      
      {/* Sezione manodopera e totali - condensato per risparmiare spazio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Manodopera a sinistra */}
        <div className="border border-gray-800 rounded-lg overflow-hidden bg-black">
          <h3 className="bg-orange-950 text-orange-400 p-2 font-medium text-sm">Manodopera Extra</h3>
          <div className="p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="extraLaborRate" className="text-xs font-medium text-orange-300">Tariffa €/ora</Label>
                <Input
                  id="extraLaborRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={localLaborPrice}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    // Permetti qualsiasi valore numerico valido, incluso 0
                    if (!isNaN(value) && value >= 0) {
                      setLocalLaborPrice(value);
                      form.setValue("laborPrice", value);
                    }
                  }}
                  className="h-8 text-xs mt-1 bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="extraLaborHours" className="text-xs font-medium text-orange-300">Ore</Label>
                <Input 
                  id="extraLaborHours"
                  type="number" 
                  min="0" 
                  step="0.5" 
                  value={laborHours} 
                  onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs mt-1 bg-gray-900 border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded-md text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-gray-400">Totale ore:</span>
                <span>{laborHours}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-medium text-gray-400">Costo manodopera:</span>
                <span className="font-bold text-orange-400">{formatCurrency(laborCost)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Totali a destra */}
        <div className="border border-gray-800 rounded-lg overflow-hidden bg-black">
          <h3 className="bg-orange-950 text-orange-400 p-2 font-medium text-sm">Totali</h3>
          <div className="p-2 space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="taxRate" className="text-xs font-medium whitespace-nowrap text-orange-300">IVA %</Label>
              <Input 
                id="taxRate"
                type="number" 
                min="0" 
                max="100"
                value={taxRate} 
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="h-8 text-xs w-20 bg-gray-900 border-gray-700 text-white"
              />
            </div>
          
            <div className="space-y-1 text-xs mt-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotale (ricambi):</span>
                <span>{formatCurrency(partsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Manodopera:</span>
                <span>{formatCurrency(laborCost)}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-gray-800 pt-1 mt-1">
                <span>Subtotale:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>IVA ({taxRate}%):</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold bg-orange-950/50 p-2 rounded mt-2">
                <span className="text-orange-400">TOTALE:</span>
                <span className="text-orange-400">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Note - riduzione spazio verticale */}
      <div className="border border-gray-800 rounded-lg overflow-hidden bg-black">
        <h3 className="bg-gray-900 text-orange-400 p-2 font-medium text-sm">Note</h3>
        <div className="p-2">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea 
                    {...field}
                    placeholder="Inserisci eventuali note o commenti..."
                    className="min-h-[80px] text-sm resize-none bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
      
      {/* Barra di navigazione fissa in basso */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 py-2 px-3 flex justify-between items-center z-30">
        <Button 
          variant="outline"
          onClick={goToPreviousStep}
          className="text-xs h-8 border-orange-500 text-orange-500 hover:bg-orange-950/50 bg-transparent"
        >
          ← Indietro
        </Button>
        
        <Button 
          type="submit" 
          className="text-xs h-8 bg-orange-600 hover:bg-orange-700 text-white"
          disabled={form.formState.isSubmitting}
          onClick={form.handleSubmit(onSubmit)}
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center">
              <span className="animate-spin mr-1">
                <Loader2 className="h-3 w-3" />
              </span>
              Salvataggio...
            </span>
          ) : (
            <span>Salva Preventivo</span>
          )}
        </Button>
      </div>
    </div>
  );
} 