import { QuoteItem } from "@shared/schema";

/**
 * Calcola i totali per un preventivo
 * @param items - Gli elementi del preventivo
 * @param laborRate - La tariffa oraria della manodopera
 * @param laborHours - Le ore di manodopera
 * @param taxRate - L'aliquota IVA (in percentuale)
 * @returns Oggetto con subtotale, importo IVA e totale finale
 */
export function calculateTotals(
  items: QuoteItem[],
  laborRate: number,
  laborHours: number,
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  // Calcola il totale degli elementi (ricambi)
  const itemsTotal = items.reduce((sum, item) => {
    // Calcola il totale delle parti per questo item
    const partsTotal = Array.isArray(item.parts)
      ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
      : 0;
    
    return sum + partsTotal;
  }, 0);
  
  // Calcola il costo della manodopera
  const laborTotal = laborRate * laborHours;
  
  // Calcola il subtotale (ricambi + manodopera)
  const subtotal = itemsTotal + laborTotal;
  
  // Calcola l'IVA
  const taxAmount = (subtotal * taxRate) / 100;
  
  // Calcola il totale finale
  const total = subtotal + taxAmount;
  
  return {
    subtotal,
    taxAmount,
    total
  };
} 