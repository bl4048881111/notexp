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

const services: Record<ServiceCategory, Array<{ id: string, name: string, price: number }>> = {
  "Tagliando": [
    { id: "filtro-aria", name: "Filtro Aria", price: 25 },
    { id: "filtro-olio", name: "Filtro Olio", price: 20 },
    { id: "filtro-carburante", name: "Filtro Carburante", price: 30 },
    { id: "filtro-abitacolo", name: "Filtro Abitacolo", price: 25 },
    { id: "olio-motore", name: "Olio Motore", price: 80 },
  ],
  "Frenante": [
    { id: "pastiglie-anteriori", name: "Pastiglie Anteriori", price: 120 },
    { id: "pastiglie-posteriori", name: "Pastiglie Posteriori", price: 100 },
    { id: "dischi-anteriori", name: "Dischi Anteriori", price: 180 },
    { id: "dischi-posteriori", name: "Dischi/Ganasce Posteriori", price: 160 },
  ],
  "Sospensioni": [
    { id: "ammortizzatori-anteriori", name: "Ammortizzatori Anteriori", price: 220 },
    { id: "ammortizzatori-posteriori", name: "Ammortizzatori Posteriori", price: 220 },
  ],
  "Accessori": [
    { id: "spazzole", name: "Spazzole", price: 40 },
    { id: "batteria", name: "Batteria", price: 120 },
    { id: "additivo", name: "Additivo", price: 30 },
    { id: "altro", name: "Altro", price: 50 },
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
  
  const handleAddService = (categoryId: ServiceCategory, service: { id: string, name: string, price: number }) => {
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
      laborPrice: service.price,
    };
    
    const laborHoursNum = typeof laborHours === "string" ? parseFloat(laborHours) || 1 : laborHours;
    
    const totalPrice = (laborPrice * laborHoursNum) + service.price;
    
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
        
        {activeCategory && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">Servizi {activeCategory}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services[activeCategory].map((service) => (
                <div 
                  key={service.id} 
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedServices[service.id] ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    if (selectedServices[service.id]) {
                      const itemId = items.find(
                        item => item.serviceType.id === service.id
                      )?.id;
                      if (itemId) handleRemoveItem(itemId);
                    } else {
                      handleAddService(activeCategory, service);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id={service.id}
                        checked={selectedServices[service.id] || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleAddService(activeCategory, service);
                          } else {
                            const itemId = items.find(
                              item => item.serviceType.id === service.id
                            )?.id;
                            if (itemId) handleRemoveItem(itemId);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <Label htmlFor={service.id} className="cursor-pointer font-medium">
                          {service.name}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Prezzo: {formatCurrency(service.price)}
                        </p>
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