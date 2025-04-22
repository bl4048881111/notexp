// Helper per il calcolo dei totali dei preventivi
import { Quote, QuoteItem } from "@shared/schema";

/**
 * Calcola il totale di un elemento del preventivo includendo manodopera e parti
 * @param item Elemento del preventivo
 * @returns Prezzo totale calcolato
 */
export function calculateItemTotal(item: QuoteItem): number {
  // Calcola il totale delle parti
  const partsTotal = Array.isArray(item.parts) 
    ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) 
    : 0;
  
  // Calcola il costo manodopera
  const laborTotal = (item.laborPrice || 0);
  
  // Totale dell'elemento (manodopera + parti)
  const totalPrice = partsTotal + laborTotal;
  
  return totalPrice;
}

/**
 * Calcola i totali per un intero preventivo
 * @param quote Preventivo da calcolare
 * @returns Preventivo con totali aggiornati
 */
export function calculateQuoteTotals(quote: Quote): Quote {
  if (!quote || !Array.isArray(quote.items)) {
    return quote;
  }
  
  // Calcola il totale per ogni elemento del preventivo
  const items = quote.items.map(item => ({
    ...item,
    totalPrice: calculateItemTotal(item)
  }));
  
  // Calcola il subtotale di tutti gli elementi
  const itemsSubtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  
  // Eventuali costi aggiuntivi di manodopera
  const extraLaborCost = (quote.laborPrice || 0) * (quote.laborHours || 0);
  
  // Subtotale (elementi + manodopera extra)
  const subtotal = itemsSubtotal + extraLaborCost;
  
  // Calcola l'imposta
  const taxRate = quote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  
  // Calcola il totale
  const total = subtotal + taxAmount;
  
  // Restituisce il preventivo aggiornato
  return {
    ...quote,
    items,
    subtotal,
    taxAmount,
    total
  };
}