import { Appointment } from "@shared/types";

// Tipo per un elemento della lista ricambi (output)
export interface PartOrderItem {
  code: string;
  quantity: number;
  clientId: string;
  clientName: string;
  plate: string;
  quoteId: string;
  appointmentId: string;
  partsOrdered: boolean; // Flag per indicare se i ricambi sono stati ordinati
}

// Ottimizzazione: usiamo una cache per le query frequenti
// Cache degli ID dei preventivi associati a ciascun cliente+veicolo
const clientVehicleToActiveQuoteId: Record<string, string> = {};
// Cache dello stato di ordinazione per ciascun preventivo
const quoteOrderStatus: Record<string, boolean> = {};
// Ultimo intervallo di pulizia della cache
let lastCacheCleanup = Date.now();

// Funzione principale che raggruppa i ricambi per tipo
export const raggruppaPerTipoRicambio = (
  orders: any[],
  testo: string,
  appointments: Appointment[]
): Record<string, PartOrderItem[]> => {
  const result: Record<string, PartOrderItem[]> = {};
  
  // FASE 1: Trova appuntamenti con preventivi associati
  const appuntamentiConPreventivo = appointments.filter(app => app.quoteId);
  
  // Mappa per accesso rapido ai preventivi per ID
  const preventivoPerId: Record<string, any> = {};
  orders.forEach(order => {
    if (order.id) {
      preventivoPerId[order.id] = order;
    }
  });
  
  // FASE 2: Per ogni appuntamento, trova il preventivo collegato ed estrai i ricambi
  appuntamentiConPreventivo.forEach(appuntamento => {
    if (!appuntamento.quoteId) return;
    
    const preventivo = preventivoPerId[appuntamento.quoteId];
    if (!preventivo) {
      return;
    }
    
    // Verifica se l'ordine corrisponde al filtro di ricerca
    const orderMatchesSearch = testo === "" || 
      (preventivo.clientName && preventivo.clientName.toLowerCase().includes(testo.toLowerCase())) ||
      (preventivo.clientId && preventivo.clientId.toLowerCase().includes(testo.toLowerCase())) ||
      (preventivo.plate && preventivo.plate.toLowerCase().includes(testo.toLowerCase()));
    
    // Controlla se ci sono pezzi nel preventivo
    if (!preventivo.items || !Array.isArray(preventivo.items) || preventivo.items.length === 0) {
      // Prova a cercare nella struttura legacy (parts invece di items)
      if (preventivo.parts && Array.isArray(preventivo.parts) && preventivo.parts.length > 0) {
        // Crea un item fittizio per ogni ricambio nella struttura legacy
        preventivo.parts.forEach((part: any) => {
          const tipoRicambio = part.description || "Ricambio";
          if (!result[tipoRicambio]) result[tipoRicambio] = [];
          
          result[tipoRicambio].push({
            code: part.code || "N/D",
            quantity: part.quantity || 0,
            clientId: preventivo.clientId || "",
            clientName: preventivo.clientName || "Cliente sconosciuto",
            plate: preventivo.plate || "Targa N/D",
            quoteId: preventivo.id || "",
            appointmentId: appuntamento.id || "",
            partsOrdered: appuntamento.partsOrdered === true,
          });
        });
        
        return; // Abbiamo già aggiunto i ricambi dalla struttura legacy
      }
      
      return;
    }
    
    // Flag per controllare se il preventivo ha effettivamente dei ricambi
    let hasParts = false;
    
    preventivo.items.forEach((item: any, index: number) => {
      if (!item.parts || !Array.isArray(item.parts) || item.parts.length === 0) return;
      
      hasParts = true;
      
      item.parts.forEach((part: any) => {
        // Aggiungiamo ricerca anche sui codici dei ricambi
        const partMatchesSearch = orderMatchesSearch || 
          (part.code && part.code.toLowerCase().includes(testo.toLowerCase())) ||
          (part.name && part.name.toLowerCase().includes(testo.toLowerCase()));
          
        // Se c'è un filtro di ricerca e né l'ordine né il ricambio corrispondono, salta
        if (testo !== "" && !partMatchesSearch) return;
          
        const tipoRicambio = part.name || "Senza tipo";
        if (!result[tipoRicambio]) result[tipoRicambio] = [];
        
        result[tipoRicambio].push({
          code: part.code || "N/D",
          quantity: part.quantity || 0,
          clientId: preventivo.clientId || "",
          clientName: preventivo.clientName || "Cliente sconosciuto",
          plate: preventivo.plate || "Targa N/D",
          quoteId: preventivo.id || "",
          appointmentId: appuntamento.id || "",
          partsOrdered: appuntamento.partsOrdered === true,
        });
      });
    });
  });
  
  // FASE 3: Pulizia risultati
  let totalPartsCount = 0;
  
  // Cicla su tutti i tipi di ricambi
  Object.keys(result).forEach(tipoRicambio => {
    // Conta i ricambi per tipo
    const count = result[tipoRicambio].length;
    totalPartsCount += count;
    
    // Se non ci sono ricambi per questo tipo, rimuovilo
    if (count === 0) {
      delete result[tipoRicambio];
    }
  });
  
  return result;
}; 