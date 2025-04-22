import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, ServiceType } from "@shared/schema";
import { getAllServiceTypes, getServiceTypesByCategory } from "@shared/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function ServiceItemForm({ items, onChange }: ServiceItemFormProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<ServiceType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Load service types on component mount
  useEffect(() => {
    const loadServiceTypes = async () => {
      const types = await getAllServiceTypes();
      setServiceTypes(types);
      setFilteredTypes(types);
    };
    
    loadServiceTypes();
  }, []);
  
  // Filter service types by category
  useEffect(() => {
    const filterTypes = async () => {
      if (selectedCategory === "all") {
        setFilteredTypes(serviceTypes);
      } else {
        const types = await getServiceTypesByCategory(selectedCategory);
        setFilteredTypes(types);
      }
    };
    
    filterTypes();
  }, [selectedCategory, serviceTypes]);
  
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
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Servizi e Ricambi</h2>
          <p className="text-sm text-muted-foreground">Aggiungi servizi e ricambi al preventivo</p>
        </div>
        
        <Select
          value={selectedCategory}
          onValueChange={setSelectedCategory}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtra per categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            <SelectItem value="Tagliando">Tagliando</SelectItem>
            <SelectItem value="Frenante">Frenante</SelectItem>
            <SelectItem value="Sospensioni">Sospensioni</SelectItem>
            <SelectItem value="Accessori">Accessori</SelectItem>
            <SelectItem value="Altro">Altro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredTypes.map(serviceType => (
          <Card key={serviceType.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{serviceType.name}</CardTitle>
              <CardDescription className="text-xs">{serviceType.category}</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex justify-between text-sm">
                <span>Manodopera:</span>
                <span className="font-medium">{formatCurrency(serviceType.laborPrice)}/ora</span>
              </div>
              {serviceType.description && (
                <p className="text-xs text-muted-foreground mt-2">{serviceType.description}</p>
              )}
            </CardContent>
            <CardFooter className="pt-0">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => handleAddItem(serviceType)}
              >
                Aggiungi al preventivo
              </Button>
            </CardFooter>
          </Card>
        ))}
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