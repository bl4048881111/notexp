import { useCallback, useMemo, useState } from "react";
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
  const [laborHours, setLaborHours] = useState<number | "">(1);
  const [laborPrice, setLaborPrice] = useState<number>(45);
  
  // Utilizza useMemo per la categorizzazione dei servizi
  const servicesByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      const category = item.serviceType.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, QuoteItem[]>);
  }, [items]);
  
  // Trova il servizio corrente utilizzando useMemo per evitare ricalcoli eccessivi
  const currentService = useMemo(() => {
    if (!selectedServiceId) return null;
    return items.find(item => item.id === selectedServiceId) || null;
  }, [items, selectedServiceId]);
  
  // Reset form con useCallback per stabilità
  const resetForm = useCallback(() => {
    setArticleCode("");
    setArticleDescription("");
    setArticleBrand("");
    setArticleQuantity(1);
    setArticlePrice(0);
  }, []);
  
  // Seleziona servizio in modo stabile
  const handleSelectService = useCallback((item: QuoteItem) => {
    setSelectedServiceId(item.id);
    setLaborHours(item.laborHours);
    setLaborPrice(item.laborPrice);
    resetForm();
  }, [resetForm]);
  
  // Formatta valuta in modo stabile
  const formatCurrency = useCallback((amount: number): string => {
    if (isNaN(amount)) return "€0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }, []);
  
  // Calcola totale manodopera in modo stabile
  const totalLaborCost = useMemo(() => {
    if (typeof laborPrice !== "number" || typeof laborHours !== "number") return 0;
    return laborPrice * laborHours;
  }, [laborPrice, laborHours]);

  // Aggiunge ricambio
  const handleAddSparePart = useCallback(() => {
    if (!currentService) return;
    
    // Validazione
    if (!articleCode || articlePrice === "" || articleQuantity === "") {
      alert("Inserisci tutti i campi obbligatori: codice, prezzo e quantità");
      return;
    }
    
    // Converti i valori in numeri
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    const laborHoursNum = typeof laborHours === "string" ? 
                         (parseFloat(laborHours) || currentService.laborHours) : 
                         (laborHours || currentService.laborHours);
    
    // Crea il ricambio
    const sparePart: SparePart = {
      id: uuidv4(),
      code: articleCode,
      name: articleDescription || `${currentService.serviceType.name} - Codice: ${articleCode}`,
      brand: articleBrand || undefined,
      category: currentService.serviceType.category.toLowerCase(),
      quantity,
      unitPrice: price,
      finalPrice: price * quantity
    };
    
    // Calcola il nuovo prezzo totale
    const partsPrice = currentService.parts.reduce((sum, part) => sum + part.finalPrice, 0) + sparePart.finalPrice;
    const laborCost = laborPrice * laborHoursNum;
    
    // Aggiorna la lista degli items
    const updatedItems = items.map(item => {
      if (item.id === currentService.id) {
        return {
          ...item,
          laborHours: laborHoursNum,
          laborPrice,
          parts: [...item.parts, sparePart],
          totalPrice: laborCost + partsPrice
        };
      }
      return item;
    });
    
    onChange(updatedItems);
    resetForm();
  }, [currentService, articleCode, articlePrice, articleQuantity, laborHours, laborPrice, 
      articleDescription, articleBrand, items, onChange, resetForm]);
  
  // Rimuove servizio
  const handleRemoveService = useCallback((serviceId: string) => {
    const newItems = items.filter(item => item.id !== serviceId);
    onChange(newItems);
    
    if (selectedServiceId === serviceId) {
      setSelectedServiceId(newItems.length > 0 ? newItems[0].id : null);
    }
  }, [items, onChange, selectedServiceId]);
  
  // Struttura del rendering principali ed elementi memoizzati
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Inserimento Ricambi</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Colonna sinistra - Menu servizi */}
        <div className="md:col-span-1">
          {Object.entries(servicesByCategory).map(([category, categoryItems]) => (
            <div key={category} className="mb-4">
              <div className="bg-primary/10 font-medium p-2 rounded-t-lg text-primary">{category}</div>
              <div className="border rounded-b-lg">
                {categoryItems.map(item => (
                  <div 
                    key={item.id}
                    className={`p-2.5 cursor-pointer transition-all border-b last:border-b-0 ${
                      selectedServiceId === item.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => handleSelectService(item)}
                  >
                    <div className="flex justify-between items-center gap-1">
                      <div className="font-medium flex items-center truncate">
                        {selectedServiceId === item.id ? (
                          <span className="material-icons text-primary mr-1 text-sm">check_circle</span>
                        ) : (
                          <span className="material-icons text-muted-foreground mr-1 text-sm">radio_button_unchecked</span>
                        )}
                        <span className="truncate">{item.serviceType.name}</span>
                      </div>
                      {item.parts.length > 0 && (
                        <span className="flex-shrink-0 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                          {item.parts.length}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveService(item.id);
                        }}
                        className="h-6 w-6 flex-shrink-0"
                      >
                        <span className="material-icons text-destructive text-xs">close</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(servicesByCategory).length === 0 && (
            <div className="border rounded-lg p-4 text-center text-muted-foreground">
              <p>Nessun servizio selezionato</p>
              <p className="text-sm mt-1">Torna al passo precedente per selezionare servizi</p>
            </div>
          )}
        </div>
        
        {/* Colonna destra - Form ricambi */}
        <div className="md:col-span-3">
          {currentService ? (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h4 className="font-medium">
                  Aggiungi Ricambi per: <span className="text-primary font-bold">{currentService.serviceType.name}</span>
                </h4>
                <div className="bg-muted/30 px-3 py-1 rounded-full text-xs">
                  Categoria: <span className="font-medium text-primary">{currentService.serviceType.category}</span>
                </div>
              </div>
              
              {/* Manodopera per servizio */}
              <div className="mb-6 bg-muted/10 p-3 rounded-lg border border-dashed">
                <h5 className="font-medium text-sm mb-3">Manodopera per questo servizio</h5>
                <div className="flex items-center gap-4">
                  <div>
                    <Label htmlFor="laborHours" className="text-sm">Ore di Manodopera</Label>
                    <Input
                      id="laborHours"
                      type="number"
                      value={laborHours}
                      onChange={(e) => setLaborHours(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="Ore"
                      min={0}
                      step={0.5}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="laborPrice" className="text-sm">Costo/Ora (€)</Label>
                    <Input
                      id="laborPrice"
                      type="number"
                      value={laborPrice}
                      onChange={(e) => setLaborPrice(parseFloat(e.target.value))}
                      placeholder="€/ora"
                      min={0}
                      step={0.01}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                  
                  <div className="ml-4 text-sm text-muted-foreground">
                    Totale manodopera: <span className="font-medium text-foreground">
                      {formatCurrency(totalLaborCost)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Form inserimento ricambi */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm">Dettagli Ricambio</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="articleCode" className="text-primary text-sm font-medium">Codice Articolo*</Label>
                    <Input
                      id="articleCode"
                      value={articleCode}
                      onChange={(e) => setArticleCode(e.target.value)}
                      placeholder="Inserisci il codice"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="articlePrice" className="text-primary text-sm font-medium">Prezzo (€)*</Label>
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
                    <Label htmlFor="articleQuantity" className="text-primary text-sm font-medium">Quantità*</Label>
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
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="articleDescription" className="text-sm">Descrizione (opzionale)</Label>
                    <Input
                      id="articleDescription"
                      value={articleDescription}
                      onChange={(e) => setArticleDescription(e.target.value)}
                      placeholder="Inserisci la descrizione"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="articleBrand" className="text-sm">Brand (opzionale)</Label>
                    <Input
                      id="articleBrand"
                      value={articleBrand}
                      onChange={(e) => setArticleBrand(e.target.value)}
                      placeholder="Inserisci il brand"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end mt-4">
                  <Button 
                    type="button" 
                    onClick={handleAddSparePart}
                    disabled={!articleCode || articlePrice === ""}
                  >
                    Aggiungi Ricambio
                  </Button>
                </div>
              </div>
              
              {/* Elenco ricambi aggiunti */}
              {currentService.parts.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-medium">Ricambi aggiunti</h5>
                    <div className="text-sm text-muted-foreground">
                      {currentService.parts.length} ricambi
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {currentService.parts.map(part => (
                      <div key={part.id} className="flex justify-between items-center bg-muted/10 p-2 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{part.code}</div>
                          <div className="text-sm text-muted-foreground">
                            {part.name} {part.brand && `(${part.brand})`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div>{formatCurrency(part.finalPrice)}</div>
                          <div className="text-sm text-muted-foreground">
                            {part.quantity} x {formatCurrency(part.unitPrice)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newItems = items.map(item => {
                              if (item.id === currentService.id) {
                                const newParts = item.parts.filter(p => p.id !== part.id);
                                const partsPrice = newParts.reduce((sum, p) => sum + p.finalPrice, 0);
                                return {
                                  ...item,
                                  parts: newParts,
                                  totalPrice: (item.laborPrice * item.laborHours) + partsPrice
                                };
                              }
                              return item;
                            });
                            onChange(newItems);
                          }}
                          className="h-8 w-8 ml-2"
                        >
                          <span className="material-icons text-destructive">delete</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-8 text-center text-muted-foreground h-full flex items-center justify-center">
              <div>
                <span className="material-icons text-4xl mb-2">arrow_back</span>
                <p className="text-lg">Seleziona un servizio dalla lista</p>
                <p className="text-sm mt-1">Per inserire ricambi, seleziona un servizio dalla colonna di sinistra</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}