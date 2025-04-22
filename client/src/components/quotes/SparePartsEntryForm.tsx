import { useState, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Inserimento Ricambi</h3>
      
      <div className="flex flex-col space-y-5">
        {/* Sezione Lista Servizi */}
        <div className="border rounded-lg p-4">
          <h4 className="text-lg font-medium mb-4">Seleziona un Servizio</h4>
          
          {Object.entries(servicesByCategory).map(([category, categoryItems]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h5 className="mb-2 text-primary font-medium border-b pb-1">{category}</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {categoryItems.map(item => (
                  <div 
                    key={item.id}
                    className={`
                      p-3 rounded-md border cursor-pointer hover:border-primary transition-colors
                      ${selectedServiceId === item.id ? 'bg-primary/10 border-primary' : 'bg-card hover:bg-muted/40'}
                    `}
                    onClick={() => handleSelectService(item.id)}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{item.serviceType.name}</span>
                      {item.parts.length > 0 && (
                        <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                          {item.parts.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(servicesByCategory).length === 0 && (
            <div className="text-center text-muted-foreground p-8">
              <p>Nessun servizio selezionato</p>
              <p className="text-sm mt-1">Torna al passo precedente per selezionare i servizi</p>
            </div>
          )}
        </div>
        
        {/* Sezione Form e Lista Ricambi */}
        {currentService && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium">
                Ricambi per: <span className="text-primary">{currentService.serviceType.name}</span>
              </h4>
              <span className="text-sm text-muted-foreground">
                {currentService.parts.length} ricambi aggiunti
              </span>
            </div>
            
            {/* Form inserimento ricambi */}
            <div className="bg-muted/20 p-4 rounded-lg mb-6">
              <h5 className="font-medium mb-3">Aggiungi Nuovo Ricambio</h5>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="articleCode">Codice Articolo*</Label>
                  <Input
                    id="articleCode"
                    value={articleCode}
                    onChange={(e) => setArticleCode(e.target.value)}
                    placeholder="Codice"
                    className="mt-1"
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
                    className="mt-1"
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
                    className="mt-1"
                  />
                </div>
                
                <div className="flex items-end">
                  <Button 
                    onClick={handleAddSparePart} 
                    disabled={!articleCode || articlePrice === ""}
                    className="w-full"
                  >
                    Aggiungi
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="articleDescription">Descrizione (opzionale)</Label>
                  <Input
                    id="articleDescription"
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="Descrizione"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="articleBrand">Brand (opzionale)</Label>
                  <Input
                    id="articleBrand"
                    value={articleBrand}
                    onChange={(e) => setArticleBrand(e.target.value)}
                    placeholder="Brand"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            
            {/* Lista ricambi */}
            {currentService.parts.length > 0 ? (
              <div>
                <h5 className="font-medium mb-3">Ricambi Aggiunti</h5>
                <div className="space-y-2">
                  {currentService.parts.map(part => (
                    <div key={part.id} className="flex justify-between border p-3 rounded-md">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium">{part.code}</span>
                          {part.brand && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              ({part.brand})
                            </span>
                          )}
                        </div>
                        {part.name && (
                          <div className="text-sm text-muted-foreground">
                            {part.name}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-sm text-right">
                          <div>{part.quantity} pz</div>
                          <div>{formatCurrency(part.unitPrice)} cad.</div>
                        </div>
                        
                        <div className="font-medium text-right min-w-[80px]">
                          {formatCurrency(part.finalPrice)}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePart(currentService.id, part.id)}
                          className="h-8 w-8 ml-2"
                        >
                          <span className="material-icons text-destructive">delete</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-end mt-4 border-t pt-2">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Totale Ricambi:</div>
                      <div className="font-medium text-lg">
                        {formatCurrency(currentService.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <span className="material-icons text-4xl mb-2">inventory</span>
                <p>Nessun ricambio aggiunto</p>
                <p className="text-sm">Usa il form sopra per aggiungere ricambi</p>
              </div>
            )}
          </div>
        )}
        
        {!currentService && (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <span className="material-icons text-5xl mb-3">arrow_upward</span>
            <h4 className="text-xl font-medium mb-2">Seleziona un servizio</h4>
            <p>Seleziona un servizio dalla lista sopra per iniziare ad aggiungere ricambi</p>
          </div>
        )}
      </div>
    </div>
  );
}