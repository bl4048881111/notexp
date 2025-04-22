import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, ServiceType } from "@shared/schema";
import { getAllServiceTypes, getServiceTypesByCategory } from "@shared/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import SparePartForm from "./SparePartForm";

interface ServiceItemFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

type ServiceCategory = "Tagliando" | "Frenante" | "Sospensioni" | "Accessori" | "Manutenzione" | "Riparazione" | "Carrozzeria" | "Motore" | "Elettronica" | "Altro" | "Personalizzato";

export default function ServiceItemForm({ items, onChange }: ServiceItemFormProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [customServiceName, setCustomServiceName] = useState("");
  
  // Load service types on component mount
  useEffect(() => {
    const loadServiceTypes = async () => {
      const types = await getAllServiceTypes();
      setServiceTypes(types);
    };
    
    loadServiceTypes();
  }, []);
  
  const handleAddItem = (serviceType: ServiceType) => {
    const newItem: QuoteItem = {
      id: uuidv4(),
      serviceType,
      description: serviceType.description || "",
      laborPrice: serviceType.laborPrice,
      laborHours: 1,
      parts: [],
      totalPrice: serviceType.laborPrice // Initial price without parts
    };
    
    onChange([...items, newItem]);
  };
  
  const handleRemoveItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };
  
  const handleItemChange = (id: string, updates: Partial<QuoteItem>) => {
    onChange(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, ...updates };
        
        // Calculate the total price (labor + parts)
        const laborTotal = updatedItem.laborPrice * updatedItem.laborHours;
        const partsTotal = updatedItem.parts.reduce((sum, part) => sum + part.finalPrice, 0);
        updatedItem.totalPrice = laborTotal + partsTotal;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const handleAddCustomService = () => {
    if (!customServiceName.trim()) return;
    
    // Creare un tipo di servizio personalizzato
    const customType: ServiceType = {
      id: uuidv4(),
      name: customServiceName,
      category: "Personalizzato" as ServiceCategory,
      laborPrice: 40,
      description: "Servizio personalizzato"
    };
    
    handleAddItem(customType);
    setCustomServiceName("");
  };
  
  const isCategorySelected = (category: ServiceCategory) => {
    return items.some(item => item.serviceType.category === category);
  };
  
  const handleCategoryToggle = (category: ServiceCategory, checked: boolean) => {
    if (checked) {
      const serviceType = serviceTypes.find(st => st.category === category);
      if (serviceType) handleAddItem(serviceType);
    } else {
      onChange(items.filter(item => item.serviceType.category !== category));
    }
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-primary">Servizi ({items.length} selezionati)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border rounded-md overflow-hidden p-4 bg-muted/20">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-2 p-3 rounded-md border border-primary/50 bg-muted/30">
                <Checkbox 
                  id="service-tagliando" 
                  checked={isCategorySelected("Tagliando")}
                  onCheckedChange={(checked) => handleCategoryToggle("Tagliando", checked as boolean)}
                />
                <Label htmlFor="service-tagliando" className="text-lg cursor-pointer font-semibold">Tagliando</Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-md border border-primary/50 bg-muted/30">
                <Checkbox 
                  id="service-frenante" 
                  checked={isCategorySelected("Frenante")}
                  onCheckedChange={(checked) => handleCategoryToggle("Frenante", checked as boolean)}
                />
                <Label htmlFor="service-frenante" className="text-lg cursor-pointer font-semibold">Frenante</Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-md border border-primary/50 bg-muted/30">
                <Checkbox 
                  id="service-sospensioni" 
                  checked={isCategorySelected("Sospensioni")}
                  onCheckedChange={(checked) => handleCategoryToggle("Sospensioni", checked as boolean)}
                />
                <Label htmlFor="service-sospensioni" className="text-lg cursor-pointer font-semibold">Sospensioni</Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-md border border-border bg-muted/30">
                <Checkbox 
                  id="service-accessori" 
                  checked={isCategorySelected("Accessori")}
                  onCheckedChange={(checked) => handleCategoryToggle("Accessori", checked as boolean)}
                />
                <Label htmlFor="service-accessori" className="text-lg cursor-pointer font-semibold">Accessori</Label>
              </div>
            </div>
          </div>
          
          <div className="border border-border rounded-md overflow-hidden p-4 bg-muted/20">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-2 p-3 rounded-md border border-border bg-muted/30">
                <Checkbox 
                  id="service-manutenzione" 
                  checked={isCategorySelected("Manutenzione")}
                  onCheckedChange={(checked) => handleCategoryToggle("Manutenzione", checked as boolean)}
                />
                <Label htmlFor="service-manutenzione" className="text-lg cursor-pointer font-semibold">Manutenzione</Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-md border border-border bg-muted/30">
                <Checkbox 
                  id="service-riparazione" 
                  checked={isCategorySelected("Riparazione")}
                  onCheckedChange={(checked) => handleCategoryToggle("Riparazione", checked as boolean)}
                />
                <Label htmlFor="service-riparazione" className="text-lg cursor-pointer font-semibold">Riparazione</Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-md border border-border bg-muted/30">
                <Checkbox 
                  id="service-carrozzeria" 
                  checked={isCategorySelected("Carrozzeria")}
                  onCheckedChange={(checked) => handleCategoryToggle("Carrozzeria", checked as boolean)}
                />
                <Label htmlFor="service-carrozzeria" className="text-lg cursor-pointer font-semibold">Carrozzeria</Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 rounded-md border border-border bg-muted/30">
                <Checkbox 
                  id="service-altro" 
                  checked={isCategorySelected("Altro")}
                  onCheckedChange={(checked) => handleCategoryToggle("Altro", checked as boolean)}
                />
                <Label htmlFor="service-altro" className="text-lg cursor-pointer font-semibold">Altro</Label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border border-primary rounded-md p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label htmlFor="servizio-personalizzato" className="font-semibold text-primary">Servizio personalizzato</Label>
            <Button 
              type="button" 
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={handleAddCustomService}
              disabled={!customServiceName.trim()}
            >
              <span className="mr-1">+</span> Aggiungi
            </Button>
          </div>
          <Input 
            id="servizio-personalizzato" 
            className="mt-2" 
            placeholder="Inserisci servizio personalizzato (es. Riparazione specifica)"
            value={customServiceName}
            onChange={(e) => setCustomServiceName(e.target.value)}
          />
        </div>
      </div>
      
      <Separator className="my-4" />
      
      <div>
        <h2 className="text-lg font-medium mb-4">Servizi Selezionati</h2>
        
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nessun servizio selezionato
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {items.map((item, index) => (
              <AccordionItem 
                key={item.id} 
                value={item.id} 
                className="border rounded-md overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-2 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{index + 1}. {item.serviceType.name}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {item.serviceType.category}
                      </span>
                    </div>
                    <div className="font-bold">{formatCurrency(item.totalPrice)}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`description-${item.id}`}>Descrizione</Label>
                        <Textarea 
                          id={`description-${item.id}`}
                          value={item.description || ""}
                          onChange={(e) => handleItemChange(item.id, { description: e.target.value })}
                          placeholder="Descrizione del servizio"
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`laborPrice-${item.id}`}>Costo Manodopera/ora</Label>
                            <Input 
                              id={`laborPrice-${item.id}`}
                              type="number"
                              value={item.laborPrice}
                              onChange={(e) => handleItemChange(item.id, { 
                                laborPrice: parseFloat(e.target.value) || 0 
                              })}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`laborHours-${item.id}`}>Ore di Lavoro</Label>
                            <Input 
                              id={`laborHours-${item.id}`}
                              type="number"
                              value={item.laborHours}
                              onChange={(e) => handleItemChange(item.id, { 
                                laborHours: parseFloat(e.target.value) || 0 
                              })}
                              min="0.25"
                              step="0.25"
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <div>
                            <div className="text-sm font-medium">Totale Manodopera</div>
                            <div className="text-muted-foreground text-sm">
                              {item.laborPrice} € x {item.laborHours} ore
                            </div>
                          </div>
                          <div className="font-bold">{formatCurrency(item.laborPrice * item.laborHours)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Ricambi</Label>
                      <SparePartForm 
                        parts={item.parts} 
                        onChange={(parts) => handleItemChange(item.id, { parts })}
                      />
                    </div>
                    
                    <div className="flex justify-between pt-2 border-t">
                      <div>
                        <div className="text-sm font-medium">Totale Servizio</div>
                        <div className="text-muted-foreground text-sm">
                          Manodopera + Ricambi
                        </div>
                      </div>
                      <div className="font-bold text-lg">{formatCurrency(item.totalPrice)}</div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        Rimuovi servizio
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
      
      <div className="flex justify-between pt-4 border-t">
        <div>
          <div className="font-medium">Subtotale Servizi</div>
          <div className="text-sm text-muted-foreground">
            {items.length} servizi selezionati
          </div>
        </div>
        <div className="font-bold text-xl">
          {formatCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))}
        </div>
      </div>
    </div>
  );
}
