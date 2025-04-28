import { Quote, CreateQuoteInput } from "@shared/schema";
import { 
  getAllQuotes, 
  getQuoteById, 
  createQuote, 
  updateQuote, 
  deleteQuote,
  getQuotesByClientId,
  calculateQuoteTotals
} from "@shared/firebase";

// Quote service
export const quoteService = {
  // Get all quotes
  getAll: async (): Promise<Quote[]> => {
    return await getAllQuotes();
  },
  
  // Get a quote by ID
  getById: async (id: string): Promise<Quote | null> => {
    return await getQuoteById(id);
  },
  
  // Get quotes by client ID
  getByClientId: async (clientId: string): Promise<Quote[]> => {
    return await getQuotesByClientId(clientId);
  },
  
  // Create a new quote
  create: async (quote: CreateQuoteInput): Promise<Quote> => {
    return await createQuote(quote);
  },
  
  // Update a quote
  update: async (id: string, quote: Partial<Quote>): Promise<Quote> => {
    return await updateQuote(id, quote);
  },
  
  // Delete a quote
  delete: async (id: string): Promise<void> => {
    await deleteQuote(id);
  },
  
  // Recalculate the quote totals without affecting the laborHours
  recalculateTotals: async (id: string): Promise<Quote> => {
    // Ottieni il preventivo attuale
    const currentQuote = await getQuoteById(id);
    if (!currentQuote) throw new Error(`Quote with ID ${id} not found`);
    
    // Manteniamo le ore di manodopera originali
    const originalLaborHours = currentQuote.laborHours;
    
    // Ricalcoliamo i totali
    const recalculatedQuote = calculateQuoteTotals(currentQuote);
    
    // Ripristiniamo le ore di manodopera originali se ci sono
    if (originalLaborHours !== undefined) {
      recalculatedQuote.laborHours = originalLaborHours;
    }
    
    // Aggiorna il preventivo
    return await updateQuote(id, recalculatedQuote);
  }
}; 