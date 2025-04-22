import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { ServiceType, QuoteItem, SparePart, serviceCategories } from "@shared/schema";
import { getAllServiceTypes, getServiceTypesByCategory } from "@shared/firebase";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SparePartForm from "./SparePartForm";

interface ServiceItemFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

export default function ServiceItemForm({ items, onChange }: ServiceItemFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(serviceCategories[0]);
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
  const [serviceDescription, setServiceDescription] = useState<string>("");
  const [laborHours, setLaborHours] = useState<number>(1);
  const [laborPrice, setLaborPrice] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  
  // Fetch service types from Firebase
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['/api/serviceTypes'],
    queryFn: getAllServiceTypes,
  });
  
  // Filter service types by category
  const filteredServiceTypes = serviceTypes.filter(
    serviceType => serviceType.category === selectedCategory
  );
  
  // Calculate total price
  useEffect(() => {
    if (!selectedServiceType) {
      setTotalPrice(0);
      return;
    }
    
    const partsTotal = spareParts.reduce((sum, part) => sum + part.finalPrice, 0);
    const laborTotal = laborPrice * laborHours;
    setTotalPrice(partsTotal + laborTotal);
  }, [selectedServiceType, spareParts, laborPrice, laborHours]);
  
  // Set labor price when service type changes
  useEffect(() => {
    if (selectedServiceType) {
      setLaborPrice(selectedServiceType.laborPrice);
    } else {
      setLaborPrice(0);
    }
  }, [selectedServiceType]);
  
  const handleServiceTypeChange = (serviceTypeId: string) => {
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId) || null;
    setSelectedServiceType(serviceType);
    if (serviceType) {
      setServiceDescription(serviceType.description || "");
    }
  };
  
  const handleAddItem = () => {
    if (!selectedServiceType) return;
    
    const newItem: QuoteItem = {
      id: `item_${Date.now()}`,
      serviceType: selectedServiceType,
      description: serviceDescription,
      parts: [...spareParts],
      laborPrice: laborPrice,
      laborHours: laborHours,
      notes: notes,
      totalPrice: totalPrice
    };
    
    // If editing an existing item, update it
    if (editingItemIndex !== null && editingItemIndex >= 0 && editingItemIndex < items.length) {
      const updatedItems = [...items];
      updatedItems[editingItemIndex] = newItem;
      onChange(updatedItems);
    } else {
      // Otherwise add a new item
      onChange([...items, newItem]);
    }
    
    // Reset form
    resetForm();
  };
  
  const handleEditItem = (index: number) => {
    const item = items[index];
    setSelectedCategory(item.serviceType.category);
    setSelectedServiceType(item.serviceType);
    setServiceDescription(item.description || "");
    setLaborHours(item.laborHours);
    setLaborPrice(item.laborPrice);
    setNotes(item.notes || "");
    setSpareParts([...item.parts]);
    setEditingItemIndex(index);
  };
  
  const handleRemoveItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    onChange(updatedItems);
  };
  
  const resetForm = () => {
    setSelectedServiceType(null);
    setServiceDescription("");
    setLaborHours(1);
    setLaborPrice(0);
    setNotes("");
    setSpareParts([]);
    setEditingItemIndex(null);
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Tabs defaultValue={serviceCategories[0]} onValueChange={setSelectedCategory}>
            <TabsList className="w-full grid grid-cols-5">
              {serviceCategories.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {serviceCategories.map((category) => (
              <TabsContent key={category} value={category} className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="serviceType">Tipo di Servizio</Label>
                    <Select
                      value={selectedServiceType?.id || ""}
                      onValueChange={handleServiceTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona servizio" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredServiceTypes.map((serviceType) => (
                          <SelectItem key={serviceType.id} value={serviceType.id}>
                            {serviceType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="laborPrice">Costo Manodopera (€/ora)</Label>
                    <Input
                      id="laborPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={laborPrice}
                      onChange={(e) => setLaborPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="description">Descrizione Servizio</Label>
            <Textarea
              id="description"
              placeholder="Descrizione dettagliata del servizio"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              rows={2}
            />
          </div>
          
          <div>
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              placeholder="Note aggiuntive"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="laborHours">Ore di Manodopera</Label>
            <Input
              id="laborHours"
              type="number"
              min="0.5"
              step="0.5"
              value={laborHours}
              onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
            />
          </div>
          
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <Label>Totale Manodopera</Label>
              <div className="h-10 px-4 py-2 bg-muted rounded-md border border-input flex items-center">
                {formatCurrency(laborPrice * laborHours)}
              </div>
            </div>
            
            <Button 
              onClick={handleAddItem} 
              disabled={!selectedServiceType}
              className="mb-0"
            >
              {editingItemIndex !== null ? "Aggiorna" : "Aggiungi"} Servizio
            </Button>
            
            {editingItemIndex !== null && (
              <Button variant="outline" onClick={resetForm} className="mb-0">
                Annulla
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Pezzi di Ricambio</h3>
        <SparePartForm 
          parts={spareParts}
          onChange={setSpareParts}
        />
      </div>
      
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Servizi nel Preventivo</h3>
        
        {items.length === 0 ? (
          <div className="text-center p-4 border rounded-md bg-muted">
            <p className="text-muted-foreground">Nessun servizio aggiunto al preventivo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>
                        {item.serviceType.name} ({item.serviceType.category})
                      </CardTitle>
                      <CardDescription>
                        {item.description || item.serviceType.description}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEditItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-2">
                  <div className="text-sm">
                    <p><span className="font-medium">Manodopera:</span> {item.laborHours} ore x {formatCurrency(item.laborPrice)}/ora = {formatCurrency(item.laborHours * item.laborPrice)}</p>
                    
                    {item.parts.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Ricambi:</p>
                        <ul className="list-disc pl-5 text-xs">
                          {item.parts.map((part) => (
                            <li key={part.id}>
                              {part.code} - {part.description || "Ricambio"}: {formatCurrency(part.finalPrice)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {item.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">Note:</span> {item.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="pt-2 flex justify-between items-center border-t">
                  <div></div>
                  <div className="text-lg font-bold">
                    {formatCurrency(item.totalPrice)}
                  </div>
                </CardFooter>
              </Card>
            ))}
            
            <div className="flex justify-end pt-4 border-t">
              <div className="text-xl font-bold">
                Totale: {formatCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}