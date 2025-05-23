import { Client, CreateClientInput } from "@shared/types";
import { 
  getAllClients, 
  getClientById, 
  createClient, 
  updateClient, 
  deleteClient, 
  getRecentClients 
} from "@shared/firebase";

// Client service
export const clientService = {
  // Get all clients
  getAll: async (): Promise<Client[]> => {
    return await getAllClients();
  },
  
  // Get a client by ID
  getById: async (id: string): Promise<Client | null> => {
    return await getClientById(id);
  },
  
  // Get recent clients
  getRecent: async (limit: number = 5): Promise<Client[]> => {
    return await getRecentClients(limit);
  },
  
  // Create a new client
  create: async (client: CreateClientInput): Promise<Client> => {
    return await createClient(client);
  },
  
  // Update a client
  update: async (id: string, client: Partial<Client>): Promise<void> => {
    await updateClient(id, client);
  },
  
  // Delete a client
  delete: async (id: string): Promise<void> => {
    await deleteClient(id);
  },
  
  // Search clients by name, plate, or model
  search: async (query: string): Promise<Client[]> => {
    const clients = await getAllClients();
    if (!query) return clients;
    
    const lowerQuery = query.toLowerCase();
    return clients.filter(client => 
      client.name.toLowerCase().includes(lowerQuery) ||
      client.surname.toLowerCase().includes(lowerQuery) ||
      client.plate.toLowerCase().includes(lowerQuery)
    );
  },
  
  // Cerca un cliente tramite codice cliente o email
  findByCodeOrEmail: async (identifier: string): Promise<Client | null> => {
    const clients = await getAllClients();
    const lowered = identifier.toLowerCase();
    return (
      clients.find(c => c.id?.toLowerCase() === lowered || c.email?.toLowerCase() === lowered) || null
    );
  }
};
