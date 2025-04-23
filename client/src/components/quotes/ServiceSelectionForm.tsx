import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, ServiceType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { getAllServiceTypes } from "@shared/firebase";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

// Definizione delle categorie e dei servizi
type ServiceCategory = "Tagliando" | "Frenante" | "Sospensioni" | "Accessori" | string;

// Definizione servizi predefiniti per fallback
const defaultServices: Record<ServiceCategory, Array<{id: string, name: string}>> = {
  "Tagliando": [
    { id: "filtro-aria", name: "Filtro Aria" },
    { id: "filtro-olio", name: "Filtro Olio" },
    { id: "filtro-carburante", name: "Filtro Carburante" },
    { id: "filtro-abitacolo", name: "Filtro Abitacolo" },
    { id: "olio-motore", name: "Olio Motore" },
  ],
  "Frenante": [
    { id: "pastiglie-anteriori", name: "Pastiglie Anteriori" },
    { id: "pastiglie-posteriori", name: "Pastiglie Posteriori" },
    { id: "dischi-anteriori", name: "Dischi Anteriori" },
    { id: "dischi-posteriori", name: "Dischi/Ganasce Posteriori" },
  ],
  "Sospensioni": [
    { id: "ammortizzatori-anteriori", name: "Ammortizzatori Anteriori" },
    { id: "ammortizzatori-posteriori", name: "Ammortizzatori Posteriori" },
    { id: "bracci-sospensione", name: "Bracci Sospensione" },
    { id: "silent-block", name: "Silent Block" },
  ],
  "Accessori": [
    { id: "batteria", name: "Batteria" },
    { id: "spazzole-tergicristallo", name: "Spazzole Tergicristallo" },
    { id: "lampadine", name: "Lampadine" },
    { id: "candele", name: "Candele" },
  ]
};

interface ServiceSelectionFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

export default function ServiceSelectionForm({ 
  items, 
  onChange 
}: ServiceSelectionFormProps) {
  // Stati del componente
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("Tagliando");
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [dynamicServices, setDynamicServices] = useState<Record<ServiceCategory, Array<{id: string, name: string}>>>({
    "Tagliando": [],
    "Frenante": [],
    "Sospensioni": [],
    "Accessori": []
  });
  
  // Carica tutti i tipi di servizio dal database
  useEffect(() => {
    async function loadAllServiceTypes() {
      try {
        const allServiceTypes = await getAllServiceTypes();
        
        // Inizializza con i servizi predefiniti come fallback
        const servicesByCategory = {...defaultServices};
        
        if (allServiceTypes && allServiceTypes.length > 0) {
          // Reset delle categorie se abbiamo servizi dal database
          Object.keys(servicesByCategory).forEach(key => {
            servicesByCategory[key as ServiceCategory] = [];
          });
          
          // Aggiungi i servizi alle rispettive categorie
          allServiceTypes.forEach(service => {
            const category = service.category as ServiceCategory;
            
            // Se la categoria non esiste ancora, creala
            if (!servicesByCategory[category]) {
              servicesByCategory[category] = [];
            }
            
            servicesByCategory[category].push({
              id: service.id,
              name: service.name
            });
          });
        }
        
        // Se dopo il caricamento alcune categorie sono vuote, usa i servizi predefiniti
        Object.keys(servicesByCategory).forEach(key => {
          if (servicesByCategory[key as ServiceCategory].length === 0) {
            servicesByCategory[key as ServiceCategory] = defaultServices[key as ServiceCategory];
          }
        });
        
        setDynamicServices(servicesByCategory);
        console.log("Servizi caricati:", servicesByCategory);
      } catch (error) {
        console.error("Errore durante il caricamento dei servizi:", error);
        // In caso di errore, usa i servizi predefiniti
        setDynamicServices(defaultServices);
      }
    }
    
    loadAllServiceTypes();
  }, []);
  
  // Gestisce il click su un servizio
  const handleServiceClick = (categoryId: ServiceCategory, service: { id: string, name: string }) => {
    // Creiamo un nuovo oggetto per evitare problemi di riferimento
    const currentSelectedServices = {...selectedServices};
    
    // Se il servizio è già selezionato, rimuovilo
    if (currentSelectedServices[service.id]) {
      const itemId = items.find(
        item => item.serviceType.id === service.id
      )?.id;
      if (itemId) {
        // Rimuovi l'elemento dalla lista
        const newItems = items.filter(item => item.id !== itemId);
        
        // Rimuovi il flag di selezione
        const newSelectedServices = {...currentSelectedServices};
        delete newSelectedServices[service.id];
        
        // Aggiorna lo stato
        setSelectedServices(newSelectedServices);
        onChange(newItems);
      }
      return;
    }
    
    // Verifica che la categoria sia valida secondo lo schema
    const isValidCategory = ["Tagliando", "Frenante", "Sospensioni", "Accessori", 
                         "Manutenzione", "Riparazione", "Carrozzeria", 
                         "Motore", "Elettronica", "Altro", "Personalizzato"].includes(categoryId);
    
    // Crea un nuovo servizio con valori temporanei (saranno compilati nel passo 3)
    const serviceType: ServiceType = {
      id: service.id,
      name: service.name,
      category: isValidCategory ? categoryId as any : "Altro",
      description: `${categoryId} - ${service.name}`,
      laborPrice: 0, // Nessun prezzo predefinito
    };
    
    // Crea un nuovo item temporaneo (sarà completato nel passo 3)
    const newItem: QuoteItem = {
      id: uuidv4(),
      serviceType,
      laborPrice: 45, // Valore di default
      laborHours: 1,  // Valore di default
      parts: [],      // Sarà compilato nel passo 3
      notes: "",
      totalPrice: 45  // Solo manodopera temporanea
    };
    
    // Crea una copia dell'array per evitare modifiche dirette
    const newItems = [...items, newItem];
    
    // Aggiorna lo stato del servizio selezionato come nuova referenza
    const newSelectedServices = {...currentSelectedServices, [service.id]: true};
    setSelectedServices(newSelectedServices);
    
    // Aggiorna gli items
    onChange(newItems);
  };
  
  // Gestisce la rimozione di un elemento
  const handleRemoveItem = (id: string) => {
    const itemToRemove = items.find(item => item.id === id);
    if (itemToRemove) {
      // Crea una nuova copia dell'array items senza l'elemento da rimuovere
      const newItems = items.filter(item => item.id !== id);
      
      // Crea una nuova copia dell'oggetto selectedServices
      const newSelectedServices = {...selectedServices};
      delete newSelectedServices[itemToRemove.serviceType.id];
      
      // Aggiorna lo stato dei servizi selezionati
      setSelectedServices(newSelectedServices);
      
      // Aggiorna gli items
      onChange(newItems);
    }
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  return (
    <div className="space-y-6">
      <div className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {Object.entries(dynamicServices).map(([category, categoryServices]) => (
            <div key={category} 
              className="border rounded-lg hover:border-primary/70 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => setActiveCategory(category as ServiceCategory)}
            >
              <div className={`p-4 rounded-t-lg flex justify-center items-center font-medium h-20 ${activeCategory === category ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                {category}
              </div>
            </div>
          ))}
        </div>
        
        {activeCategory && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">Servizi {activeCategory}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dynamicServices[activeCategory]?.map((service: {id: string, name: string}) => (
                <div 
                  key={service.id} 
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedServices[service.id] ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleServiceClick(activeCategory, service)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-sm border flex items-center justify-center ${
                        selectedServices[service.id] ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                      }`}>
                        {selectedServices[service.id] && <span className="material-icons text-sm">check</span>}
                      </div>
                      <div>
                        <Label className="cursor-pointer font-medium">
                          {service.name}
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {items.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Servizi selezionati: {items.length}</h4>
            {items.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-green-600">{Object.keys(items.reduce((acc, item) => {
                  acc[item.serviceType.category] = true;
                  return acc;
                }, {} as Record<string, boolean>)).length}</span> categorie
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg px-3 py-2 flex items-center gap-2 bg-muted/20">
                <span>{item.serviceType.name}</span>
                <Badge variant="outline">{item.serviceType.category}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(item.id)}
                  className="h-6 w-6 ml-1"
                >
                  <span className="material-icons text-destructive text-sm">close</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}