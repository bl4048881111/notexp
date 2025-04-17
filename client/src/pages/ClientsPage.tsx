import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download } from "lucide-react";

import { getAllClients } from "@shared/firebase";
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
  
  const { toast } = useToast();
  
  // Fetch clients
  const { 
    data: clients = [], 
    isLoading,
    refetch
  } = useQuery({ 
    queryKey: ['/api/clients'],
    queryFn: getAllClients,
  });
  
  // Filter clients
  const filteredClients = clients.filter((client: Client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      client.surname.toLowerCase().includes(searchQuery.toLowerCase()) || 
      client.plate.toLowerCase().includes(searchQuery.toLowerCase()) || 
      client.model.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });
  
  // Sort clients
  const sortedClients = [...filteredClients].sort((a, b) => {
    switch (sortOrder) {
      case "name-asc":
        return `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`);
      case "name-desc":
        return `${b.name} ${b.surname}`.localeCompare(`${a.name} ${a.surname}`);
      case "date-asc":
        return a.createdAt - b.createdAt;
      case "date-desc":
        return b.createdAt - a.createdAt;
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
    await refetch();
    setIsFormOpen(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Clienti</h2>
        
        <div className="flex space-x-3">
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Cliente
          </Button>
          
          <Button variant="outline" onClick={handleExportClients}>
            <Download className="mr-2 h-4 w-4" />
            Esporta
          </Button>
        </div>
      </div>
      
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-grow">
            <Input
              type="text"
              placeholder="Cerca cliente per nome, targa o modello..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
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
          
          <div className="flex space-x-2">
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtra clienti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i clienti</SelectItem>
                <SelectItem value="with-appointments">Con appuntamenti</SelectItem>
                <SelectItem value="without-appointments">Senza appuntamenti</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Ordinamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="date-desc">Data aggiunta (Recente)</SelectItem>
                <SelectItem value="date-asc">Data aggiunta (Meno recente)</SelectItem>
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
