/**
 * Utility per l'estrazione di informazioni sui veicoli
 */

/**
 * Estrae la marca del veicolo dalla stringa del modello.
 * Il formato tipico del modello è "Marca Modello Anno", ad esempio "BMW 320d 2015"
 * La funzione restituisce solo la prima parola, che di solito è la marca.
 * 
 * @param modelString - La stringa del modello completo, ad esempio "BMW 320d 2015"
 * @returns La marca del veicolo o stringa vuota se non disponibile
 */
export function extractVehicleBrand(modelString: string): string {
  if (!modelString || typeof modelString !== 'string') {
    return '';
  }
  
  // Estrai la prima parola, che di solito è la marca
  const parts = modelString.trim().split(' ');
  if (parts.length > 0) {
    return parts[0];
  }
  
  return '';
}

/**
 * Estrae il modello del veicolo senza la marca e l'anno, se possibile.
 * 
 * @param modelString - La stringa del modello completo, ad esempio "BMW 320d 2015"
 * @returns Il modello specifico del veicolo o stringa vuota se non disponibile
 */
export function extractVehicleModel(modelString: string): string {
  if (!modelString || typeof modelString !== 'string') {
    return '';
  }
  
  const parts = modelString.trim().split(' ');
  
  // Se c'è solo una parola, potrebbe essere solo la marca, quindi restituisci vuoto
  if (parts.length <= 1) {
    return '';
  }
  
  // Se ci sono almeno 2 parti, prendi la seconda parte come modello
  // Se ci sono più parti, il modello potrebbe includere più parole, ma 
  // per semplicità prendiamo solo la seconda parola
  return parts[1];
} 