import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download } from "lucide-react";

import { getAllClients } from "@shared/supabase";
import { Client } from "@shared/types";

import ClientForm from "../components/clients/ClientForm";
import ClientTable from "../components/clients/ClientTable";
import { exportClientsToExcel } from "../services/exportService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientsCount, setClientsCount] = useState(0);
  const [noResultsAfterCreate, setNoResultsAfterCreate] = useState(false);
  
  const { toast } = useToast();
  
  const queryClient = useQueryClient();
  
  // Fetch clients
  const { 
    data: clients = [], 
    isLoading,
    refetch
  } = useQuery({ 
    queryKey: ['/api/clients'],
    queryFn: getAllClients,
  });
  
  // Filter clients based on searchQuery and filterValue
  const filteredClients = useMemo(() => {
    let result = clients;

    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(client => 
        `${client.name} ${client.surname}`.toLowerCase().includes(query) || 
        client.phone.toLowerCase().includes(query) || 
        (client.email && client.email.toLowerCase().includes(query)) ||
        (client.plate && client.plate.toLowerCase().includes(query)) ||
        (client.model && client.model.toLowerCase().includes(query)) ||
        (client.vin && client.vin.toLowerCase().includes(query))
      );
    }

    // Apply additional filters if needed
    if (filterValue === 'with-appointments') {
      // Logic for filtering clients with appointments
    } else if (filterValue === 'without-appointments') {
      // Logic for filtering clients without appointments
    }

    return result;
  }, [clients, searchQuery, filterValue]);
  
  // Memorizza il conteggio dei clienti per rilevare aggiunte
  useEffect(() => {
    // Se il conteggio dei clienti è aumentato ma i risultati filtrati sono 0,
    // è probabile che sia stato appena aggiunto un cliente che non corrisponde alla ricerca
    if (clients.length > clientsCount && filteredClients.length === 0 && searchQuery.trim() !== '') {
      setNoResultsAfterCreate(true);
    } else {
      setNoResultsAfterCreate(false);
    }
    
    // Aggiorna il conteggio dei clienti
    setClientsCount(clients.length);
  }, [clients.length, filteredClients.length, clientsCount, searchQuery]);
  
  // Sort clients
  const sortedClients = [...filteredClients].sort((a, b) => {
    switch (sortOrder) {
      case "name-asc":
        return `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`);
      case "name-desc":
        return `${b.name} ${b.surname}`.localeCompare(`${a.name} ${a.surname}`);
      case "date-asc":
        // Gestisce i casi in cui createdAt potrebbe essere undefined
        const aCreatedAt = a.createdAt || 0;
        const bCreatedAt = b.createdAt || 0;
        return aCreatedAt - bCreatedAt;
      case "date-desc":
        // Gestisce i casi in cui createdAt potrebbe essere undefined
        const aCreatedAtDesc = a.createdAt || 0;
        const bCreatedAtDesc = b.createdAt || 0;
        return bCreatedAtDesc - aCreatedAtDesc;
      default:
        return 0;
    }
  });
  
  const handleExportClients = async () => {
    try {
      await exportClientsToExcel(sortedClients);
      toast({
        title: "Esportazione completata",
        description: "I clienti sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    }
  };
  
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };
  
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingClient(null);
  };
  
  const handleFormSubmit = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      
      await queryClient.refetchQueries({ 
        queryKey: ['/api/clients'],
        type: 'active',
        exact: true 
      });
      
      // console.log("Dati clienti aggiornati con successo");
      
      // Terzo passo: esegui un secondo refetch con un piccolo ritardo
      // per assicurarti che i dati dal server siano completamente aggiornati
      setTimeout(async () => {
        await refetch();
        // console.log("Seconda ricerca completata");
      }, 500);
      
      toast({
        description: "Dati clienti aggiornati",
      });
    } catch (error) {
      console.error("Errore durante l'aggiornamento della lista clienti:", error);
      toast({
        title: "Errore aggiornamento",
        description: "Impossibile aggiornare la lista clienti. Ricarica la pagina.",
        variant: "destructive"
      });
    }
    
    setIsFormOpen(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-bold">Clienti</h2>
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2 sm:space-x-3">
          <Button className="w-full sm:w-auto" onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="sm:inline">Nuovo Cliente</span>
            <span className="inline sm:hidden">Nuovo</span>
          </Button>
          
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportClients}>
            <Download className="mr-2 h-4 w-4" />
            Esporta
          </Button>
        </div>
      </div>
      
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col justify-between gap-3">
          <div className="relative w-full">
            <Input
              type="text"
              placeholder="Cerca cliente per nome, telefono, targa o VIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-full"
            />
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Messaggio di suggerimento dopo la creazione */}
          {noResultsAfterCreate && filteredClients.length === 0 && searchQuery.trim() !== '' && (
            <div className="p-2 bg-primary/10 text-primary text-sm rounded flex items-center justify-between">
              <span>Hai aggiunto un nuovo cliente ma la ricerca non produce risultati.</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2 h-7 text-xs" 
                onClick={() => setSearchQuery("")}
              >
                Mostra tutti
              </Button>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtra clienti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i clienti</SelectItem>
                <SelectItem value="with-appointments">Con appuntamenti</SelectItem>
                <SelectItem value="without-appointments">Senza appuntamenti</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Ordinamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="date-desc">Data (Recente)</SelectItem>
                <SelectItem value="date-asc">Data (Meno recente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <ClientTable 
          clients={sortedClients} 
          isLoading={isLoading} 
          onEdit={handleEditClient}
          onDeleteSuccess={refetch}
        />
      </div>
      
      {isFormOpen && (
        <ClientForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
          client={editingClient}
        />
      )}
    </div>
  );
}
