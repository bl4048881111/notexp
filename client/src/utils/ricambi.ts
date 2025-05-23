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
  console.log("---- ESECUZIONE raggruppaPerTipoRicambio CON DATI AGGIORNATI ----", {
    numOrdini: orders.length,
    numAppuntamenti: appointments.length
  });
  
  const result: Record<string, PartOrderItem[]> = {};
  
  // FASE 1: Trova appuntamenti con preventivi associati
  console.log("---- FASE 1: RICERCA APPUNTAMENTI CON PREVENTIVI ----");
  
  // Stampa tutti gli appuntamenti per debug
  console.log("Tutti gli appuntamenti:", appointments.map(app => ({
    id: app.id,
    clientName: app.clientName,
    quoteId: app.quoteId,
    partsOrdered: app.partsOrdered,
    partsOrderedType: typeof app.partsOrdered
  })));
  
  // Controllo specifico per AP062
  const ap062 = appointments.find(app => app.id === 'AP062');
  if (ap062) {
    console.log("APPUNTAMENTO AP062 TROVATO:", {
      id: ap062.id,
      clientName: ap062.clientName,
      quoteId: ap062.quoteId,
      partsOrdered: ap062.partsOrdered,
      partsOrderedType: typeof ap062.partsOrdered
    });
  } else {
    console.log("APPUNTAMENTO AP062 NON TROVATO");
  }
  
  // Prendiamo tutti gli appuntamenti che hanno un preventivo associato
  const appuntamentiConPreventivo = appointments.filter(app => app.quoteId);
  
  console.log(`Trovati ${appuntamentiConPreventivo.length} appuntamenti con preventivi associati:`, 
    appuntamentiConPreventivo.map(app => ({
      id: app.id,
      clientName: app.clientName,
      quoteId: app.quoteId,
      partsOrdered: app.partsOrdered
    }))
  );
  
  // Mappa per accesso rapido ai preventivi per ID
  const preventivoPerId: Record<string, any> = {};
  orders.forEach(order => {
    if (order.id) {
      preventivoPerId[order.id] = order;
    }
  });
  
  console.log("Preventivi disponibili:", Object.keys(preventivoPerId));
  
  // FASE 2: Per ogni appuntamento, trova il preventivo collegato ed estrai i ricambi
  console.log("---- FASE 2: ESTRAZIONE RICAMBI DAI PREVENTIVI COLLEGATI ----");
  
  appuntamentiConPreventivo.forEach(appuntamento => {
    if (!appuntamento.quoteId) return;
    
    console.log(`Cerco preventivo ${appuntamento.quoteId} per appuntamento ${appuntamento.id}`);
    
    const preventivo = preventivoPerId[appuntamento.quoteId];
    if (!preventivo) {
      console.log(`⚠️ Preventivo ${appuntamento.quoteId} collegato all'appuntamento ${appuntamento.id} non trovato`);
      return;
    }
    
    console.log(`✅ Trovato preventivo ${preventivo.id} collegato all'appuntamento ${appuntamento.id}`);
    console.log(`Struttura preventivo:`, {
      id: preventivo.id,
      clientName: preventivo.clientName,
      hasItems: Boolean(preventivo.items),
      itemsCount: preventivo.items?.length || 0
    });
    
    // Verifica se l'ordine corrisponde al filtro di ricerca
    const orderMatchesSearch = testo === "" || 
      (preventivo.clientName && preventivo.clientName.toLowerCase().includes(testo.toLowerCase())) ||
      (preventivo.clientId && preventivo.clientId.toLowerCase().includes(testo.toLowerCase())) ||
      (preventivo.plate && preventivo.plate.toLowerCase().includes(testo.toLowerCase()));
    
    // Controlla se ci sono pezzi nel preventivo
    if (!preventivo.items || !Array.isArray(preventivo.items) || preventivo.items.length === 0) {
      console.log(`Preventivo ${preventivo.id} non ha items, cerco nella struttura legacy (parts)`);
      
      // Prova a cercare nella struttura legacy (parts invece di items)
      if (preventivo.parts && Array.isArray(preventivo.parts) && preventivo.parts.length > 0) {
        console.log(`Trovati ${preventivo.parts.length} ricambi nella struttura legacy`);
        
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
            partsOrdered: false, // Questi sono sempre da ordinare perché filtrati all'inizio
          });
        });
        
        return; // Abbiamo già aggiunto i ricambi dalla struttura legacy
      }
      
      console.log(`Preventivo ${preventivo.id} non ha ricambi, saltato`);
      return;
    }
    
    // Flag per controllare se il preventivo ha effettivamente dei ricambi
    let hasParts = false;
    
    preventivo.items.forEach((item: any, index: number) => {
      console.log(`Analisi item ${index} del preventivo ${preventivo.id}:`, {
        serviceType: item.serviceType?.name,
        hasParts: Boolean(item.parts && Array.isArray(item.parts)),
        partsCount: item.parts?.length || 0
      });
      
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
        
        console.log(`Ricambio trovato in preventivo ${preventivo.id}:`, {
          code: part.code || "N/D",
          name: part.name || "N/D",
          quantity: part.quantity || 0
        });
        
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
    
    if (!hasParts) {
      console.log(`Preventivo ${preventivo.id} non ha ricambi validi, saltato`);
    }
  });
  
  // FASE 3: Statistiche finali
  console.log("---- FASE 3: STATISTICHE FINALI ----");
  let totalPartsCount = 0;
  
  // Cicla su tutti i tipi di ricambi
  Object.keys(result).forEach(tipoRicambio => {
    // Conta i ricambi per tipo
    const count = result[tipoRicambio].length;
    totalPartsCount += count;
    
    // Se non ci sono ricambi per questo tipo, rimuovilo
    if (count === 0) {
      console.log(`Rimosso tipo ricambio vuoto: ${tipoRicambio}`);
      delete result[tipoRicambio];
    }
  });
  
  console.log(`RIEPILOGO: ${totalPartsCount} ricambi da ordinare trovati in ${Object.keys(result).length} categorie`);
  return result;
}; 