// Soluzione temporanea alternativa per creare preventivi semplici senza usare il form con tab
import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import { ServiceType, Quote, QuoteItem, SparePart, Client } from "@shared/schema";
import { getAllClients, getClientById, getAllServiceTypes, createQuote } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface QuickCreateQuoteProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickCreateQuote({ isOpen, onClose, onSuccess }: QuickCreateQuoteProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [availableServices, setAvailableServices] = useState<ServiceType[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([]);
  const [notes, setNotes] = useState("");
  
  const { toast } = useToast();
  
  // Carica clienti
  const searchClients = useCallback(async (query: string) => {
    if (query.length < 2) return;
    
    setIsLoading(true);
    try {
      const allClients = await getAllClients();
      const filtered = allClients.filter(client => {
        const fullName = `${client.name} ${client.surname}`.toLowerCase();
        return fullName.includes(query.toLowerCase()) || 
               client.phone.includes(query) ||
               client.plate.toLowerCase().includes(query.toLowerCase());
      });
      setClients(filtered);
    } catch (error) {
      console.error('Errore nella ricerca clienti:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Carica servizi disponibili
  const loadServices = useCallback(async () => {
    if (availableServices.length === 0) {
      setIsLoading(true);
      try {
        const services = await getAllServiceTypes();
        setAvailableServices(services);
      } catch (error) {
        console.error('Errore nel caricamento servizi:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [availableServices.length]);
  
  // Seleziona un client
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    // Dopo la selezione del cliente, carica i servizi
    loadServices();
    // Pulisce la ricerca
    setClientSearch("");
    setClients([]);
  };
  
  // Aggiunge un servizio alla selezione
  const handleAddService = (service: ServiceType) => {
    if (!selectedServices.find(s => s.id === service.id)) {
      setSelectedServices([...selectedServices, service]);
    }
  };
  
  // Rimuove un servizio dalla selezione
  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
  };
  
  // Crea e salva il preventivo
  const handleCreateQuote = async () => {
    if (!selectedClient || selectedServices.length === 0) {
      toast({
        title: "Dati incompleti",
        description: "Seleziona un cliente e almeno un servizio.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Crea gli item del preventivo dai servizi selezionati
      const quoteItems: QuoteItem[] = selectedServices.map(service => ({
        id: uuidv4(),
        serviceType: service,
        parts: [],
        totalPrice: service.laborPrice || 0,
        laborPrice: service.laborPrice || 0,
        laborHours: 0
      }));
      
      // Crea il preventivo con tutti i campi obbligatori
      const newQuote: Omit<Quote, 'id'> = {
        clientId: selectedClient.id,
        clientName: `${selectedClient.name} ${selectedClient.surname}`,
        phone: selectedClient.phone,
        plate: selectedClient.plate,
        model: selectedClient.model,
        date: format(new Date(), "yyyy-MM-dd"),
        status: "bozza",
        items: quoteItems,
        subtotal: quoteItems.reduce((sum, item) => sum + item.totalPrice, 0),
        taxRate: 22,
        taxAmount: 0, // Verrà calcolato da calculateQuoteTotals
        total: 0, // Verrà calcolato da calculateQuoteTotals
        notes: notes,
        laborPrice: 45,
        laborHours: 0,
        kilometrage: 0,
        createdAt: Date.now()
      };
      
      // Salva il preventivo
      await createQuote(newQuote);
      
      toast({
        title: "Preventivo creato",
        description: "Il preventivo base è stato creato con successo. Puoi modificarlo in seguito per aggiungere ricambi."
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Errore nella creazione del preventivo:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore nella creazione del preventivo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Creazione Rapida Preventivo</DialogTitle>
          <DialogDescription>
            Crea un preventivo base senza aggiungere ricambi.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Selezione cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            {selectedClient ? (
              <div className="flex items-center justify-between border p-3 rounded-md bg-muted/20">
                <div>
                  <div className="font-medium">{selectedClient.name} {selectedClient.surname}</div>
                  <div className="text-sm text-muted-foreground">
                    Tel: {selectedClient.phone} | Veicolo: {selectedClient.model} ({selectedClient.plate})
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClient(null)}
                >
                  Cambia
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cerca cliente (nome, telefono, targa...)"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') {
                        searchClients(clientSearch);
                      }
                    }}
                  />
                  <Button 
                    onClick={() => searchClients(clientSearch)}
                    disabled={clientSearch.length < 2}
                  >
                    Cerca
                  </Button>
                </div>
                
                {clients.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {clients.map(client => (
                      <div 
                        key={client.id}
                        className="p-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="font-medium">{client.name} {client.surname}</div>
                        <div className="text-sm text-muted-foreground">
                          {client.phone} | {client.model} ({client.plate})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Selezione servizi */}
          {selectedClient && (
            <div className="space-y-2">
              <Label>Servizi</Label>
              
              {/* Lista servizi selezionati */}
              {selectedServices.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {selectedServices.map(service => (
                    <div key={service.id} className="flex justify-between items-center border p-2 rounded-md">
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">{service.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">
                          {new Intl.NumberFormat('it-IT', {
                            style: 'currency',
                            currency: 'EUR'
                          }).format(service.laborPrice || 0)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveService(service.id)}
                          className="text-destructive p-1 h-auto"
                        >
                          Rimuovi
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 border rounded-md bg-muted/10 mb-4">
                  <p className="text-muted-foreground">Nessun servizio selezionato</p>
                </div>
              )}
              
              {/* Dropdown per aggiungere servizi */}
              {availableServices.length > 0 && (
                <div className="space-y-2">
                  <Label>Aggiungi servizio</Label>
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {availableServices
                      .filter(service => !selectedServices.find(s => s.id === service.id))
                      .map(service => (
                        <div 
                          key={service.id}
                          className="p-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleAddService(service)}
                        >
                          <div className="font-medium">{service.name}</div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{service.category}</span>
                            <span>{new Intl.NumberFormat('it-IT', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(service.laborPrice || 0)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Note */}
          {selectedClient && selectedServices.length > 0 && (
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea 
                placeholder="Note aggiuntive per il preventivo"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-24"
              />
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Annulla
          </Button>
          <Button
            onClick={handleCreateQuote}
            disabled={isLoading || !selectedClient || selectedServices.length === 0}
          >
            Crea Preventivo Base
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}