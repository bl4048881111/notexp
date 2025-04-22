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
const services = {
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
  
  const handleAddService = (categoryId: string, service: { id: string, name: string, price: number }) => {
    // Crea un nuovo servizio da aggiungere al preventivo
    const serviceType: ServiceType = {
      id: service.id,
      name: service.name,
      category: categoryId,
      description: `${categoryId} - ${service.name}`,
      price: service.price,
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="mb-4">
            <Label className="mb-1 block">Tariffa oraria manodopera</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={laborPrice}
                onChange={(e) => setLaborPrice(parseFloat(e.target.value) || 0)}
                className="w-24"
                min={0}
              />
              <span>€/ora</span>
            </div>
          </div>
          
          <div className="mb-4">
            <Label className="mb-1 block">Ore di manodopera</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value ? parseFloat(e.target.value) : "")}
                className="w-24"
                min={0}
                step={0.5}
              />
              <span>ore</span>
            </div>
          </div>
          
          <div className="mb-4">
            <Label className="mb-1 block">Note</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note per il servizio (opzionale)"
              className="h-24"
            />
          </div>
        </div>
        
        <div className="border rounded-md">
          <Accordion type="multiple" defaultValue={["Tagliando", "Frenante", "Sospensioni", "Accessori"]}>
            {Object.entries(services).map(([category, categoryServices]) => (
              <AccordionItem value={category} key={category}>
                <AccordionTrigger className="px-4">
                  {category}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-2">
                  <div className="space-y-2">
                    {categoryServices.map((service) => (
                      <div key={service.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id={service.id}
                            checked={selectedServices[service.id] || false}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleAddService(category, service);
                              } else {
                                const itemId = items.find(
                                  item => item.serviceType.id === service.id
                                )?.id;
                                if (itemId) handleRemoveItem(itemId);
                              }
                            }}
                          />
                          <Label htmlFor={service.id} className="cursor-pointer">
                            {service.name}
                          </Label>
                        </div>
                        <span className="text-sm">{formatCurrency(service.price)}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
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
                    <TableCell className="text-right">{formatCurrency(item.serviceType.price)}</TableCell>
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