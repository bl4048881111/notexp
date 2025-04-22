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
  }, [items, currentServiceIndex]);
  
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
    
    // Crea la parte manuale
    const manualPart: SparePart = {
      id: uuidv4(),
      code: articleCode,
      name: articleDescription || `${currentItem.serviceType.name} - Codice: ${articleCode}`,
      brand: articleBrand || undefined,
      category: currentItem.serviceType.category.toLowerCase(),
      quantity: typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity,
      unitPrice: typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice,
      finalPrice: (typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice) * 
                 (typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity)
    };
    
    // Aggiorna il prezzo della manodopera
    const laborHoursNum = typeof laborHours === "string" ? 
                         (parseFloat(laborHours) || currentItem.laborHours) : 
                         (laborHours || currentItem.laborHours);
    
    // Calcola il prezzo totale
    const partsPrice = currentItem.parts.reduce((sum, part) => sum + part.finalPrice, 0) + manualPart.finalPrice;
    const laborCost = laborPrice * laborHoursNum;
    const totalPrice = laborCost + partsPrice;
    
    // Aggiorna l'elemento corrente
    const updatedItems = [...items];
    updatedItems[currentServiceIndex] = {
      ...currentItem,
      laborPrice,
      laborHours: laborHoursNum,
      parts: [...currentItem.parts, manualPart],
      totalPrice
    };
    
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
    
    // Aggiorna l'elemento
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...currentItem,
      parts: updatedParts,
      totalPrice
    };
    
    // Aggiorna lo stato
    onChange(updatedItems);
  };
  
  // Seleziona un servizio per l'inserimento ricambi
  const handleSelectService = (index: number) => {
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
        {/* Lista dei servizi selezionati */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-4">Servizi selezionati</h4>
          
          <div className="space-y-2">
            {items.map((item, index) => (
              <div 
                key={item.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  currentServiceIndex === index ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                }`}
                onClick={() => handleSelectService(index)}
              >
                <div className="font-medium">{item.serviceType.name}</div>
                <div className="text-sm text-muted-foreground">
                  {item.serviceType.category} - 
                  {item.parts.length > 0 
                    ? `${item.parts.length} ricambi inseriti` 
                    : 'Nessun ricambio inserito'}
                </div>
              </div>
            ))}
          </div>
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
      {currentServiceIndex !== null && items[currentServiceIndex].parts.length > 0 && (
        <div className="mt-6">
          <Separator className="mb-4" />
          
          <h4 className="font-medium mb-3">
            Ricambi per {items[currentServiceIndex].serviceType.name}
          </h4>
          
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
        </div>
      )}
      
      {/* Riepilogo di tutti i servizi */}
      <div className="mt-6">
        <Separator className="mb-4" />
        
        <h4 className="font-medium mb-3">Riepilogo Servizi e Ricambi</h4>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servizio</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Manodopera</TableHead>
                <TableHead className="text-right">Ricambi</TableHead>
                <TableHead className="text-right">Totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.serviceType.name}
                    {item.parts.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.parts.map(part => (
                          <div key={part.id} className="mt-1">
                            {part.code && <strong>{part.code}</strong>} {part.brand && `(${part.brand})`} - {part.name} (x{part.quantity}) - {formatCurrency(part.finalPrice)}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{item.serviceType.category}</TableCell>
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
                </TableRow>
              ))}
              
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">
                  Totale Servizi:
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}