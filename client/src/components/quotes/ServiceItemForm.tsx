import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart, ServiceType } from "@shared/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

// Definizione delle categorie e dei servizi
type ServiceCategory = "Tagliando" | "Frenante" | "Sospensioni" | "Accessori";

const services: Record<ServiceCategory, Array<{ id: string, name: string }>> = {
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
  ],
  "Accessori": [
    { id: "spazzole", name: "Spazzole" },
    { id: "batteria", name: "Batteria" },
    { id: "additivo", name: "Additivo" },
    { id: "altro", name: "Altro" },
  ]
};

interface ServiceItemFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

export default function ServiceItemForm({ items, onChange }: ServiceItemFormProps) {
  const [laborPrice, setLaborPrice] = useState<number>(45);
  const [laborHours, setLaborHours] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("Tagliando");
  
  // Stati per la maschera di inserimento articoli manuali
  const [showArticleForm, setShowArticleForm] = useState<boolean>(false);
  const [articleCode, setArticleCode] = useState<string>("");
  const [articleDescription, setArticleDescription] = useState<string>("");
  const [articleBrand, setArticleBrand] = useState<string>("");
  const [articleQuantity, setArticleQuantity] = useState<number | "">(1);
  const [articlePrice, setArticlePrice] = useState<number | "">(0);
  const [currentService, setCurrentService] = useState<{id: string, name: string, price?: number} | null>(null);
  
  // Gestisce l'aggiunta di un articolo manuale dopo la selezione del servizio
  const handleAddManualArticle = () => {
    if (!currentService) return;
    
    // Validazione
    if (!articleCode || articlePrice === "" || articleQuantity === "") {
      alert("Inserisci tutti i campi obbligatori: codice, prezzo e quantità");
      return;
    }
    
    // Crea l'oggetto serviceType
    const isValidCategory = ["Tagliando", "Frenante", "Sospensioni", "Accessori", 
                           "Manutenzione", "Riparazione", "Carrozzeria", 
                           "Motore", "Elettronica", "Altro", "Personalizzato"].includes(activeCategory);
    
    const serviceType: ServiceType = {
      id: currentService.id,
      name: currentService.name,
      category: isValidCategory ? activeCategory as any : "Altro",
      description: `${activeCategory} - ${currentService.name}`,
      laborPrice: typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice,
    };
    
    const laborHoursNum = typeof laborHours === "string" ? parseFloat(laborHours) || 1 : laborHours;
    
    // Crea la parte manuale
    const manualPart: SparePart = {
      id: uuidv4(),
      code: articleCode,
      name: articleDescription || `${currentService.name} - Codice: ${articleCode}`,
      brand: articleBrand || undefined,
      category: isValidCategory ? activeCategory.toLowerCase() : "altro",
      quantity: typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity,
      unitPrice: typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice,
      finalPrice: (typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice) * 
                  (typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity)
    };
    
    // Calcola il prezzo totale
    const partsPrice = manualPart.finalPrice;
    const laborCost = laborPrice * laborHoursNum;
    const totalPrice = laborCost + partsPrice;
    
    // Crea il nuovo elemento
    const newItem: QuoteItem = {
      id: uuidv4(),
      serviceType,
      laborPrice,
      laborHours: laborHoursNum,
      parts: [manualPart],
      notes: notes || undefined,
      totalPrice
    };
    
    // Aggiungi l'elemento
    onChange([...items, newItem]);
    
    // Reset dei campi
    setArticleCode("");
    setArticleDescription("");
    setArticleBrand("");
    setArticleQuantity(1);
    setArticlePrice(0);
    setLaborHours("");
    setNotes("");
    setShowArticleForm(false);
    setCurrentService(null);
    
    // Marca il servizio come selezionato
    setSelectedServices({
      ...selectedServices,
      [currentService.id]: true
    });
  };
  
  // Gestisce il click su un servizio
  const handleServiceClick = (categoryId: ServiceCategory, service: { id: string, name: string }) => {
    // Se il servizio è già selezionato, rimuovilo
    if (selectedServices[service.id]) {
      const itemId = items.find(
        item => item.serviceType.id === service.id
      )?.id;
      if (itemId) handleRemoveItem(itemId);
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
    
    // Aggiungi l'elemento
    onChange([...items, newItem]);
    
    // Marca il servizio come selezionato
    setSelectedServices({
      ...selectedServices,
      [service.id]: true
    });
  };
  
  // Gestisce l'aggiunta standard di un servizio (non più usata direttamente, ma tenuta per compatibilità)
  const handleAddService = (categoryId: ServiceCategory, service: { id: string, name: string }) => {
    // Crea un nuovo servizio da aggiungere al preventivo
    // Verifica che la categoria sia valida secondo lo schema
    const isValidCategory = ["Tagliando", "Frenante", "Sospensioni", "Accessori", 
                           "Manutenzione", "Riparazione", "Carrozzeria", 
                           "Motore", "Elettronica", "Altro", "Personalizzato"].includes(categoryId);
    
    const serviceType: ServiceType = {
      id: service.id,
      name: service.name,
      category: isValidCategory ? categoryId as any : "Altro",
      description: `${categoryId} - ${service.name}`,
      laborPrice: 0, // Nessun prezzo predefinito
    };
    
    const laborHoursNum = typeof laborHours === "string" ? parseFloat(laborHours) || 1 : laborHours;
    
    const totalPrice = (laborPrice * laborHoursNum);
    
    const newItem: QuoteItem = {
      id: uuidv4(),
      serviceType,
      laborPrice,
      laborHours: laborHoursNum,
      parts: [],
      notes: notes || undefined,
      totalPrice
    };
    
    onChange([...items, newItem]);
    
    // Reset dei campi
    setLaborHours("");
    setNotes("");
    
    // Marca il servizio come selezionato
    setSelectedServices({
      ...selectedServices,
      [service.id]: true
    });
  };
  
  // Gestisce la rimozione di un elemento
  const handleRemoveItem = (id: string) => {
    const itemToRemove = items.find(item => item.id === id);
    if (itemToRemove) {
      // Rimuovi il segno di spunta dal servizio
      setSelectedServices({
        ...selectedServices,
        [itemToRemove.serviceType.id]: false
      });
    }
    
    onChange(items.filter(item => item.id !== id));
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
          {Object.entries(services).map(([category, categoryServices]) => (
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
        
        {activeCategory && !showArticleForm && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">Servizi {activeCategory}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services[activeCategory].map((service) => (
                <div 
                  key={service.id} 
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedServices[service.id] ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleServiceClick(activeCategory, service)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id={service.id}
                        checked={selectedServices[service.id] || false}
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            const itemId = items.find(
                              item => item.serviceType.id === service.id
                            )?.id;
                            if (itemId) handleRemoveItem(itemId);
                          } else {
                            handleServiceClick(activeCategory, service);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <Label htmlFor={service.id} className="cursor-pointer font-medium">
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
        <>
          <Separator />
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servizio</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Prezzo</TableHead>
                  <TableHead className="text-right">Manodopera</TableHead>
                  <TableHead className="text-right">Ricambi</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.serviceType.name}
                      {item.parts.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.parts.map(part => (
                            <div key={part.id} className="mt-1">
                              {part.code && <strong>{part.code}</strong>} - {part.name} (x{part.quantity}) - {formatCurrency(part.finalPrice)}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{item.notes}</div>
                      )}
                    </TableCell>
                    <TableCell>{item.serviceType.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.serviceType.laborPrice)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.laborPrice * item.laborHours)}
                      <div className="text-xs text-muted-foreground">
                        {item.laborHours} ore × {formatCurrency(item.laborPrice)}/h
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                      <div className="text-xs text-muted-foreground">
                        {item.parts.length} ricambi
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-8 w-8"
                      >
                        <span className="material-icons text-destructive">delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Totale Servizi:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}