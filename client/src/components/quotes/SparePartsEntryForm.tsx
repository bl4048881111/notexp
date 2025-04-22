import { useState, useEffect } from "react";
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
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface SparePartsEntryFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

export default function SparePartsEntryForm({ 
  items, 
  onChange 
}: SparePartsEntryFormProps) {
  // Stati per la maschera di inserimento articoli manuali
  const [currentServiceIndex, setCurrentServiceIndex] = useState<number | null>(null);
  const [articleCode, setArticleCode] = useState<string>("");
  const [articleDescription, setArticleDescription] = useState<string>("");
  const [articleBrand, setArticleBrand] = useState<string>("");
  const [articleQuantity, setArticleQuantity] = useState<number | "">(1);
  const [articlePrice, setArticlePrice] = useState<number | "">(0);
  const [laborHours, setLaborHours] = useState<number | "">("");
  const [laborPrice, setLaborPrice] = useState<number>(45);
  
  // Seleziona il primo servizio senza ricambi se non c'è un servizio corrente selezionato
  useEffect(() => {
    // Eseguiamo questa logica solo una volta all'inizializzazione
    if (currentServiceIndex === null && items.length > 0) {
      // Trova il primo elemento che non ha ricambi
      const firstWithoutParts = items.findIndex(item => item.parts.length === 0);
      if (firstWithoutParts !== -1) {
        setCurrentServiceIndex(firstWithoutParts);
      } else {
        // Se tutti hanno ricambi, seleziona il primo
        setCurrentServiceIndex(0);
      }
    }
  }, [items]);
  
  // Reset dei campi del form
  const resetForm = () => {
    setArticleCode("");
    setArticleDescription("");
    setArticleBrand("");
    setArticleQuantity(1);
    setArticlePrice(0);
  };
  
  // Aggiunge un articolo manuale al servizio corrente
  const handleAddSparePart = () => {
    if (currentServiceIndex === null) return;
    
    const currentItem = items[currentServiceIndex];
    
    // Validazione
    if (!articleCode || articlePrice === "" || articleQuantity === "") {
      alert("Inserisci tutti i campi obbligatori: codice, prezzo e quantità");
      return;
    }
    
    // Converti i valori in numeri
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    const laborHoursNum = typeof laborHours === "string" ? 
                         (parseFloat(laborHours) || currentItem.laborHours) : 
                         (laborHours || currentItem.laborHours);
    
    // Crea la parte manuale
    const manualPart: SparePart = {
      id: uuidv4(),
      code: articleCode,
      name: articleDescription || `${currentItem.serviceType.name} - Codice: ${articleCode}`,
      brand: articleBrand || undefined,
      category: currentItem.serviceType.category.toLowerCase(),
      quantity: quantity,
      unitPrice: price,
      finalPrice: price * quantity
    };
    
    // Calcola il prezzo totale
    const partsPrice = currentItem.parts.reduce((sum, part) => sum + part.finalPrice, 0) + manualPart.finalPrice;
    const laborCost = laborPrice * laborHoursNum;
    const totalPrice = laborCost + partsPrice;
    
    // Crea una copia profonda dell'elemento corrente per evitare modifiche dirette
    const updatedItem = {
      ...currentItem,
      laborPrice,
      laborHours: laborHoursNum,
      parts: [...currentItem.parts, manualPart],
      totalPrice
    };
    
    // Aggiorna l'elemento corrente
    const updatedItems = [...items];
    updatedItems[currentServiceIndex] = updatedItem;
    
    // Aggiorna lo stato
    onChange(updatedItems);
    
    // Reset del form
    resetForm();
  };
  
  // Rimuove un ricambio dall'elemento corrente
  const handleRemoveSparePart = (itemIndex: number, partId: string) => {
    const currentItem = items[itemIndex];
    
    // Rimuove il ricambio
    const updatedParts = currentItem.parts.filter(part => part.id !== partId);
    
    // Ricalcola il prezzo totale
    const partsPrice = updatedParts.reduce((sum, part) => sum + part.finalPrice, 0);
    const laborCost = currentItem.laborPrice * currentItem.laborHours;
    const totalPrice = laborCost + partsPrice;
    
    // Crea un nuovo oggetto aggiornato
    const updatedItem = {
      ...currentItem,
      parts: updatedParts,
      totalPrice
    };
    
    // Aggiorna tutti gli elementi con una copia completa
    const updatedItems = items.map((item, idx) => 
      idx === itemIndex ? updatedItem : item
    );
    
    // Aggiorna lo stato
    onChange(updatedItems);
  };
  
  // Seleziona un servizio per l'inserimento ricambi
  const handleSelectService = (index: number) => {
    // Preveniamo cambiamenti inutili se è già selezionato
    if (index === currentServiceIndex) {
      return;
    }
    
    setCurrentServiceIndex(index);
    resetForm();
    
    // Imposta i valori di manodopera dal servizio selezionato
    const selectedItem = items[index];
    setLaborHours(selectedItem.laborHours);
    setLaborPrice(selectedItem.laborPrice);
  };
  
  // Formatta i numeri come valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Inserimento Ricambi</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lista dei servizi selezionati, raggruppati per categoria */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-4">Servizi selezionati per categoria</h4>
          
          {/* Raggruppamento dei servizi per categoria */}
          {Object.entries(
            items.reduce((acc, item) => {
              const category = item.serviceType.category;
              if (!acc[category]) acc[category] = [];
              acc[category].push(item);
              return acc;
            }, {} as Record<string, QuoteItem[]>)
          ).map(([category, categoryItems]) => (
            <div key={category} className="mb-4">
              <div className="font-medium text-primary mb-2 pb-1 border-b">{category}</div>
              <div className="space-y-2">
                {categoryItems.map((item, itemIndex) => {
                  // Trova l'indice globale di questo item nel array items completo
                  const index = items.findIndex(i => i.id === item.id);
                  return (
                    <div 
                      key={item.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        currentServiceIndex === index ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                      onClick={() => handleSelectService(index)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-medium">{item.serviceType.name}</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Se stiamo eliminando l'elemento attivo, resetta l'indice
                            if (index === currentServiceIndex) {
                              setCurrentServiceIndex(null);
                            } 
                            // Se stiamo eliminando un elemento con indice inferiore a quello attuale, aggiorna l'indice
                            else if (currentServiceIndex !== null && index < currentServiceIndex) {
                              setCurrentServiceIndex(currentServiceIndex - 1);
                            }
                            
                            // Rimuovi l'elemento dall'array
                            const newItems = items.filter((_, i) => i !== index);
                            onChange(newItems);
                          }}
                          className="h-6 w-6 -mt-1 -mr-1"
                        >
                          <span className="material-icons text-destructive text-xs">close</span>
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground flex justify-between mt-1">
                        <span>
                          {item.parts.length > 0 
                            ? `${item.parts.length} ricambi inseriti` 
                            : 'Nessun ricambio'}
                        </span>
                        {currentServiceIndex === index && (
                          <span className="text-primary font-medium">ATTIVO</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Form per l'inserimento ricambi */}
        {currentServiceIndex !== null && (
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">
                Aggiungi Ricambi per <span className="text-primary">{items[currentServiceIndex].serviceType.name}</span>
              </h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="articleCode" className="text-primary font-medium">Codice Articolo*</Label>
                <Input
                  id="articleCode"
                  value={articleCode}
                  onChange={(e) => setArticleCode(e.target.value)}
                  placeholder="Inserisci il codice articolo"
                  autoFocus
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="articlePrice" className="text-primary font-medium">Prezzo (€)*</Label>
                <Input
                  id="articlePrice"
                  type="number"
                  value={articlePrice}
                  onChange={(e) => setArticlePrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="Prezzo articolo"
                  min={0}
                  step={0.01}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="articleQuantity" className="text-primary font-medium">Quantità*</Label>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="articleDescription">Descrizione (opzionale)</Label>
                <Input
                  id="articleDescription"
                  value={articleDescription}
                  onChange={(e) => setArticleDescription(e.target.value)}
                  placeholder="Inserisci la descrizione"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="articleBrand">Brand (opzionale)</Label>
                <Input
                  id="articleBrand"
                  value={articleBrand}
                  onChange={(e) => setArticleBrand(e.target.value)}
                  placeholder="Inserisci il brand"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg mb-4">
              <div>
                <p className="font-medium text-sm">Servizio: <span className="text-primary font-bold">{items[currentServiceIndex].serviceType.name}</span></p>
                <p className="font-medium text-sm mt-1">Categoria: <span className="text-primary">{items[currentServiceIndex].serviceType.category}</span></p>
              </div>
              
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
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="button" 
                onClick={handleAddSparePart}
                disabled={!articleCode || articlePrice === ""}
              >
                Aggiungi Ricambio
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Tabella dei ricambi per il servizio corrente */}
      {currentServiceIndex !== null && (
        <div className="mt-6">
          <Separator className="mb-4" />
          
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium">
              Ricambi per <span className="text-primary">{items[currentServiceIndex].serviceType.name}</span>
            </h4>
            <div className="bg-muted/50 px-3 py-1 rounded text-sm">
              Categoria: <span className="font-medium">{items[currentServiceIndex].serviceType.category}</span>
            </div>
          </div>
          
          {items[currentServiceIndex].parts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Prezzo</TableHead>
                    <TableHead className="text-right">Quantità</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items[currentServiceIndex].parts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.code}</TableCell>
                      <TableCell>{part.brand || '-'}</TableCell>
                      <TableCell>{part.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(part.unitPrice)}</TableCell>
                      <TableCell className="text-right">{part.quantity}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(part.finalPrice)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSparePart(currentServiceIndex, part.id)}
                          className="h-8 w-8"
                        >
                          <span className="material-icons text-destructive">delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-medium">
                      Totale Ricambi:
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(items[currentServiceIndex].parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
              <p>Nessun ricambio inserito per questo servizio</p>
              <p className="text-sm mt-1">Compila il form sopra per aggiungere ricambi a {items[currentServiceIndex].serviceType.name}</p>
            </div>
          )}
        </div>
      )}
      

    </div>
  );
}