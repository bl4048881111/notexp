import { useState, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SparePartsEntryFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

export default function SparePartsEntryForm({ 
  items, 
  onChange 
}: SparePartsEntryFormProps) {
  // Stati locali
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [articleCode, setArticleCode] = useState<string>("");
  const [articleDescription, setArticleDescription] = useState<string>("");
  const [articleBrand, setArticleBrand] = useState<string>("");
  const [articleQuantity, setArticleQuantity] = useState<number | "">(1);
  const [articlePrice, setArticlePrice] = useState<number | "">(0);
  
  // Raggruppo i servizi per categoria
  const servicesByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      const category = item.serviceType.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, QuoteItem[]>);
  }, [items]);
  
  // Trova il servizio selezionato corrente
  const currentService = useMemo(() => {
    if (!selectedServiceId) return null;
    return items.find(item => item.id === selectedServiceId) || null;
  }, [items, selectedServiceId]);
  
  // Reset campi del form
  const resetForm = useCallback(() => {
    setArticleCode("");
    setArticleDescription("");
    setArticleBrand("");
    setArticleQuantity(1);
    setArticlePrice(0);
  }, []);
  
  // Seleziona un servizio
  const handleSelectService = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    resetForm();
  }, [resetForm]);
  
  // Formatta numeri come valuta
  const formatCurrency = useCallback((amount: number): string => {
    if (isNaN(amount)) return "€0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }, []);
  
  // Aggiunge un ricambio al servizio selezionato
  const handleAddSparePart = useCallback(() => {
    if (!currentService || !articleCode || articlePrice === "" || articleQuantity === "") {
      return;
    }
    
    // Converti i valori in numeri
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    
    // Crea il nuovo ricambio
    const newPart: SparePart = {
      id: uuidv4(),
      code: articleCode,
      name: articleDescription || `${currentService.serviceType.name} - Codice: ${articleCode}`,
      brand: articleBrand || undefined,
      category: currentService.serviceType.category.toLowerCase(),
      quantity,
      unitPrice: price,
      finalPrice: price * quantity
    };
    
    // Aggiorna i servizi
    const updatedItems = items.map(item => {
      if (item.id === currentService.id) {
        // Calcola il nuovo prezzo totale dei ricambi
        const partsPrice = item.parts.reduce((sum, part) => sum + part.finalPrice, 0) + newPart.finalPrice;
        
        return {
          ...item,
          parts: [...item.parts, newPart],
          // Mantiene il calcolo della manodopera per compatibilità
          totalPrice: (item.laborPrice * item.laborHours) + partsPrice
        };
      }
      return item;
    });
    
    onChange(updatedItems);
    resetForm();
  }, [currentService, articleCode, articlePrice, articleQuantity, 
      articleDescription, articleBrand, items, onChange, resetForm]);
  
  // Rimuove un ricambio
  const handleRemovePart = useCallback((serviceId: string, partId: string) => {
    const updatedItems = items.map(item => {
      if (item.id === serviceId) {
        // Rimuove il ricambio
        const updatedParts = item.parts.filter(part => part.id !== partId);
        // Ricalcola il prezzo totale
        const partsPrice = updatedParts.reduce((sum, part) => sum + part.finalPrice, 0);
        
        return {
          ...item,
          parts: updatedParts,
          totalPrice: (item.laborPrice * item.laborHours) + partsPrice
        };
      }
      return item;
    });
    
    onChange(updatedItems);
  }, [items, onChange]);
  
  // Ottieni tutti i servizi in un array piatto per il menu a tendina
  const allServices = useMemo(() => {
    return items.map(item => ({
      id: item.id,
      name: item.serviceType.name,
      category: item.serviceType.category,
      partsCount: item.parts.length
    }));
  }, [items]);
  
  return (
    <div className="space-y-5">
      <h3 className="text-xl font-medium">Inserimento Ricambi</h3>
      
      {/* Menu a tendina per selezionare il servizio */}
      <div className="border rounded-lg p-5">
        <div className="mb-4">
          <Label htmlFor="service-select" className="text-base font-medium mb-2 block">
            Seleziona un Servizio
          </Label>
          <Select
            value={selectedServiceId || ""}
            onValueChange={handleSelectService}
          >
            <SelectTrigger id="service-select" className="w-full">
              <SelectValue placeholder="Seleziona un servizio per aggiungere ricambi" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(servicesByCategory).map(([category, categoryItems]) => (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {categoryItems.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      <div className="flex justify-between w-full">
                        <span>{service.serviceType.name}</span>
                        {service.parts.length > 0 && (
                          <span className="ml-2 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                            {service.parts.length}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Se è selezionato un servizio, mostra il form e la lista ricambi */}
        {currentService && (
          <div className="space-y-5">
            {/* Form di inserimento ricambi */}
            <div className="border p-4 rounded-lg">
              <h4 className="font-medium text-lg flex items-center">
                <span className="material-icons text-primary mr-2">add_circle</span>
                Aggiungi ricambio per: <span className="text-primary ml-2">{currentService.serviceType.name}</span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label htmlFor="articleCode">Codice Articolo*</Label>
                  <Input
                    id="articleCode"
                    value={articleCode}
                    onChange={(e) => setArticleCode(e.target.value)}
                    placeholder="Inserisci codice"
                  />
                </div>
                
                <div>
                  <Label htmlFor="articlePrice">Prezzo (€)*</Label>
                  <Input
                    id="articlePrice"
                    type="number"
                    value={articlePrice}
                    onChange={(e) => setArticlePrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="Prezzo"
                    min={0}
                    step={0.01}
                  />
                </div>
                
                <div>
                  <Label htmlFor="articleQuantity">Quantità*</Label>
                  <Input
                    id="articleQuantity"
                    type="number"
                    value={articleQuantity}
                    onChange={(e) => setArticleQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="Quantità"
                    min={1}
                    step={1}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="articleDescription">Descrizione (opzionale)</Label>
                  <Input
                    id="articleDescription"
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="Descrizione ricambio"
                  />
                </div>
                
                <div>
                  <Label htmlFor="articleBrand">Brand (opzionale)</Label>
                  <Input
                    id="articleBrand"
                    value={articleBrand}
                    onChange={(e) => setArticleBrand(e.target.value)}
                    placeholder="Brand ricambio"
                  />
                </div>
              </div>
              
              <div className="mt-5 flex justify-end">
                <Button
                  onClick={handleAddSparePart}
                  disabled={!articleCode || articlePrice === ""}
                >
                  <span className="material-icons mr-2">add</span>
                  Aggiungi Ricambio
                </Button>
              </div>
            </div>
            
            {/* Lista ricambi come accordion */}
            <Accordion type="single" collapsible defaultValue="ricambi" className="border rounded-lg">
              <AccordionItem value="ricambi" className="border-none">
                <AccordionTrigger className="px-4 py-3">
                  <div className="flex items-center">
                    <span className="material-icons text-primary mr-2">inventory_2</span>
                    <span className="font-medium">Ricambi Aggiunti</span>
                    <span className="ml-2 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                      {currentService.parts.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {currentService.parts.length > 0 ? (
                    <div className="space-y-2">
                      {currentService.parts.map((part) => (
                        <div key={part.id} className="flex items-center border p-3 rounded-md">
                          <div className="flex-1">
                            <div className="font-medium">{part.code}</div>
                            <div className="text-sm text-muted-foreground">{part.name}</div>
                          </div>
                          <div className="flex items-center">
                            <div className="text-sm text-right pr-4">
                              <div>{part.quantity} x {formatCurrency(part.unitPrice)}</div>
                              <div className="font-medium">{formatCurrency(part.finalPrice)}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePart(currentService.id, part.id)}
                            >
                              <span className="material-icons text-destructive">delete</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex justify-end pt-2 border-t mt-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Totale Ricambi:</div>
                          <div className="font-bold text-primary text-lg">
                            {formatCurrency(currentService.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 text-muted-foreground">
                      <span className="material-icons text-4xl mb-2">inventory</span>
                      <p>Nessun ricambio aggiunto</p>
                      <p className="text-sm">Usa il form sopra per aggiungere ricambi</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
        
        {/* Se non è selezionato un servizio, mostra un messaggio */}
        {!currentService && items.length > 0 && (
          <div className="text-center p-8 text-muted-foreground">
            <span className="material-icons text-4xl mb-2">arrow_upward</span>
            <p>Seleziona un servizio dal menu a tendina</p>
            <p className="text-sm">Per iniziare ad aggiungere ricambi</p>
          </div>
        )}
        
        {/* Se non ci sono servizi disponibili */}
        {items.length === 0 && (
          <div className="text-center p-8 text-muted-foreground">
            <span className="material-icons text-4xl mb-2">engineering</span>
            <p>Nessun servizio disponibile</p>
            <p className="text-sm">Torna al passaggio precedente per selezionare servizi</p>
          </div>
        )}
      </div>
    </div>
  );
}