import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Card, 
  CardContent,
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from "@/components/ui/card";

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
    
    // Calcola il nuovo prezzo totale dei soli pezzi (la manodopera viene gestita nel riepilogo)
    const partsPrice = currentService.parts.reduce((sum, part) => sum + part.finalPrice, 0) + sparePart.finalPrice;
    
    // Aggiorna la lista degli items
    const updatedItems = items.map(item => {
      if (item.id === currentService.id) {
        return {
          ...item,
          parts: [...item.parts, sparePart],
          // Il prezzo totale mantiene la gestione della manodopera per compatibilità
          totalPrice: (item.laborPrice * item.laborHours) + partsPrice
        };
      }
      return item;
    });
    
    onChange(updatedItems);
    resetForm();
  }, [currentService, articleCode, articlePrice, articleQuantity, 
      articleDescription, articleBrand, items, onChange, resetForm]);
  
  // Rimuove servizio
  const handleRemoveService = useCallback((serviceId: string) => {
    const newItems = items.filter(item => item.id !== serviceId);
    onChange(newItems);
    
    if (selectedServiceId === serviceId) {
      setSelectedServiceId(newItems.length > 0 ? newItems[0].id : null);
    }
  }, [items, onChange, selectedServiceId]);
  
  // Rimuove un ricambio
  const handleRemovePart = useCallback((partId: string) => {
    if (!currentService) return;
    
    const updatedItems = items.map(item => {
      if (item.id === currentService.id) {
        const newParts = item.parts.filter(p => p.id !== partId);
        const partsPrice = newParts.reduce((sum, p) => sum + p.finalPrice, 0);
        
        return {
          ...item,
          parts: newParts,
          // Mantiene la gestione della manodopera per compatibilità
          totalPrice: (item.laborPrice * item.laborHours) + partsPrice
        };
      }
      return item;
    });
    
    onChange(updatedItems);
  }, [currentService, items, onChange]);
  
  // Calcola totale ricambi per un servizio
  const calculatePartsTotal = useCallback((service: QuoteItem): number => {
    return service.parts.reduce((sum, part) => sum + part.finalPrice, 0);
  }, []);
  
  // Struttura del rendering principali ed elementi memoizzati
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Inserimento Ricambi</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Colonna sinistra - Menu servizi */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Servizi</CardTitle>
              <CardDescription className="text-xs">
                Seleziona un servizio per aggiungere ricambi
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-300px)] pr-4 mx-1">
                {Object.entries(servicesByCategory).map(([category, categoryItems]) => (
                  <div key={category} className="mb-3 mx-3">
                    <div className="bg-primary/10 font-medium p-2 px-3 rounded-t-lg text-sm text-primary">
                      {category}
                    </div>
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
                              <span className="truncate text-xs">{item.serviceType.name}</span>
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
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        {/* Colonna destra - Form ricambi e lista */}
        <div className="md:col-span-4">
          {currentService ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Colonna form inserimento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <span className="material-icons text-primary mr-2 text-base">build</span>
                    {currentService.serviceType.name}
                  </CardTitle>
                  <CardDescription>
                    Categoria: <span className="text-primary">{currentService.serviceType.category}</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {/* Form inserimento ricambi */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="articleCode" className="text-primary text-xs font-medium">Codice Articolo*</Label>
                        <Input
                          id="articleCode"
                          value={articleCode}
                          onChange={(e) => setArticleCode(e.target.value)}
                          placeholder="Inserisci il codice"
                          className="mt-1"
                          autoFocus
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="articleDescription" className="text-xs">Descrizione (opzionale)</Label>
                        <Input
                          id="articleDescription"
                          value={articleDescription}
                          onChange={(e) => setArticleDescription(e.target.value)}
                          placeholder="Descrizione"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="articlePrice" className="text-primary text-xs font-medium">Prezzo (€)*</Label>
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
                        <Label htmlFor="articleQuantity" className="text-primary text-xs font-medium">Quantità*</Label>
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
                      
                      <div>
                        <Label htmlFor="articleBrand" className="text-xs">Brand (opzionale)</Label>
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
                </CardContent>
                
                <CardFooter className="flex justify-between border-t pt-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Totale ricambi:</span> {formatCurrency(calculatePartsTotal(currentService))}
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleAddSparePart}
                    disabled={!articleCode || articlePrice === ""}
                  >
                    <span className="material-icons mr-1 text-base">add</span>
                    Aggiungi Ricambio
                  </Button>
                </CardFooter>
              </Card>
              
              {/* Colonna lista ricambi */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <span className="material-icons text-primary mr-2 text-base">inventory_2</span>
                    Ricambi aggiunti
                    {currentService.parts.length > 0 && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {currentService.parts.length}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {currentService.parts.length === 0 
                      ? "Nessun ricambio aggiunto. Usa il form a sinistra per aggiungere ricambi."
                      : "Elenco dei ricambi aggiunti a questo servizio"}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {currentService.parts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <ScrollArea className="h-[calc(100vh-320px)]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Codice</TableHead>
                              <TableHead>Descrizione</TableHead>
                              <TableHead className="text-right w-[60px]">Qtà</TableHead>
                              <TableHead className="text-right w-[80px]">Prezzo</TableHead>
                              <TableHead className="text-right w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentService.parts.map(part => (
                              <TableRow key={part.id}>
                                <TableCell className="font-medium">{part.code}</TableCell>
                                <TableCell>
                                  <div className="text-sm truncate max-w-[200px]">
                                    {part.name}
                                  </div>
                                  {part.brand && (
                                    <div className="text-xs text-muted-foreground">
                                      Brand: {part.brand}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">{part.quantity}</TableCell>
                                <TableCell className="text-right">
                                  <div>{formatCurrency(part.finalPrice)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatCurrency(part.unitPrice)} cad.
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemovePart(part.id)}
                                    className="h-7 w-7"
                                  >
                                    <span className="material-icons text-destructive text-sm">delete</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground">
                      <span className="material-icons text-4xl mb-2">inventory</span>
                      <p>Nessun ricambio aggiunto</p>
                      <p className="text-sm mt-1">Usa il form a sinistra per aggiungere ricambi</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="h-full">
              <div className="flex items-center justify-center h-[calc(100vh-280px)] text-center text-muted-foreground">
                <div>
                  <span className="material-icons text-5xl mb-3">arrow_back</span>
                  <h3 className="text-xl font-medium mb-2">Seleziona un servizio</h3>
                  <p className="text-sm">Per inserire ricambi, seleziona un servizio dalla colonna di sinistra</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}