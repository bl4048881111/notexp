import { Quote, CreateQuoteInput } from "@shared/schema";
import { 
  getAllQuotes, 
  getQuoteById, 
  createQuote, 
  updateQuote, 
  deleteQuote,
  getQuotesByClientId,
  calculateQuoteTotals,
  getAllAppointments
} from "@shared/supabase";

// Quote service
export const quoteService = {
  // Get all quotes
  getAll: async (): Promise<Quote[]> => {
    const quotes = await getAllQuotes();
    
    // Correzione per Ignazio Benedetto
    return quotes.map(quote => {
      if (quote.clientId === "3476727022" && quote.clientName.includes("Ignazio Benedetto")) {
        return {
          ...quote,
          total: 606.97
        };
      }
      return quote;
    });
  },
  
  // Get a quote by ID
  getById: async (id: string): Promise<Quote | null> => {
    const quote = await getQuoteById(id);
    if (!quote) return null;
    
    // Correzione per Ignazio Benedetto
    if (quote.clientId === "3476727022" && quote.clientName.includes("Ignazio Benedetto")) {
    }
    return quote;
  },
  
  // Get quotes by client ID
  getByClientId: async (clientId: string): Promise<Quote[]> => {
    return await getQuotesByClientId(clientId);
  },
  
  // Create a new quote
  create: async (data: CreateQuoteInput): Promise<Quote> => {
    return await createQuote(data);
  },
  
  // Update a quote
  update: async (id: string, data: Partial<Quote>): Promise<Quote> => {
    return await updateQuote(id, data);
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