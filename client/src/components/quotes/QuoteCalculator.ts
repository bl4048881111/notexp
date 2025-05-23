// Helper per il calcolo dei totali dei preventivi
import { Quote, QuoteItem, SparePart } from "@shared/schema";

/**
 * Calcola il totale per un singolo item (servizio)
 * Modificato per includere solo il costo dei ricambi, senza manodopera
 */
export const calculateItemTotal = (item: QuoteItem): number => {
  // Calcola il totale dei ricambi per questo item
  const partsTotal = Array.isArray(item.parts) 
    ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
    : 0;
  
  // Ritorna solo il costo dei ricambi, senza aggiungere la manodopera
  return partsTotal;
};

/**
 * Calcola il subtotale dei ricambi per tutti gli item
 */
export const calculatePartsSubtotal = (items: QuoteItem[]): number => {
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
};

/**
 * Calcola i totali per un intero preventivo
 * @param quote Preventivo da calcolare
 * @returns Preventivo con totali aggiornati
 */
export function calculateQuoteTotals(quote: Quote): Quote {
  if (!quote || !Array.isArray(quote.items)) {
    return quote;
  }
  
  // Calcola il totale per ogni elemento del preventivo (solo ricambi)
  const items = quote.items.map(item => ({
    ...item,
    totalPrice: calculateItemTotal(item)
  }));
  
  // Calcola il subtotale di tutti i ricambi
  const partsSubtotal = items.reduce((sum, item) => {
    const itemTotal = calculateItemTotal(item);
    return sum + itemTotal;
  }, 0);
  
  // Calcola SOLO la manodopera extra, ignorando completamente la manodopera dei servizi
  const laborTotal = (quote.laborPrice || 0) * (quote.laborHours || 0);
  
  // Subtotale (ricambi + SOLO manodopera extra)
  const subtotal = partsSubtotal + laborTotal;
  
  // Calcola l'imposta
  const taxRate = quote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  
  // Calcola il totale
  const totalPrice = subtotal + taxAmount;
  
  // Restituisce il preventivo aggiornato
  return {
    ...quote,
    items,
    subtotal,
    taxAmount,
    totalPrice,
    // Aggiungiamo i subtotali separati per uso in altre parti dell'applicazione
    partsSubtotal,
    laborTotal
  } as Quote & { partsSubtotal: number; laborTotal: number };
}