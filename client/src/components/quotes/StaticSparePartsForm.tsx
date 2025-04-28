// Versione STATICA del form ricambi - nessuno stato locale, solo props
import { useState } from "react";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface StaticSparePartsFormProps {
  items: QuoteItem[];
  onAddPart: (serviceId: string, part: Omit<SparePart, 'id'>, index?: number) => void;
  onRemovePart: (serviceId: string, partId: string) => void;
  // Nuova prop per aggiornare direttamente l'array di items
  onUpdateItems?: (newItems: QuoteItem[]) => void;
}

export default function StaticSparePartsForm({ 
  items, 
  onAddPart,
  onRemovePart,
  onUpdateItems
}: StaticSparePartsFormProps) {
  // Ora abbiamo bisogno di alcuni stati locali per il popup
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [partCode, setPartCode] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [partBrand, setPartBrand] = useState("");
  const [partQuantity, setPartQuantity] = useState<number>(1);
  const [partPrice, setPartPrice] = useState<number>(0);
  
  // Raggruppa servizi per categoria (pura computazione, non stato)
  const categoriesMap: Record<string, QuoteItem[]> = {};
  items.forEach(item => {
    const category = item.serviceType.category;
    if (!categoriesMap[category]) {
      categoriesMap[category] = [];
    }
    categoriesMap[category].push(item);
  });
  
  // Ordina le categorie
  const categories = Object.keys(categoriesMap).sort();
  
  // Formatta un prezzo come valuta (funzione pura)
  function formatCurrency(amount: number): string {
    if (isNaN(amount)) return "€0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
  
  // Funzione per aprire il dialog con il servizio attivo
  const openPartDialog = (serviceId: string) => {
    // Reset dei campi quando apri il dialog per un nuovo ricambio
    setActiveServiceId(serviceId);
    setPartCode("");
    
    // Trova il servizio per usare il nome come suggerimento per la descrizione
    const activeService = items.find(item => item.id === serviceId);
    if (activeService) {
      setPartDescription(`Ricambio per ${activeService.serviceType.name}`);
    } else {
      setPartDescription("");
    }
    
    setPartBrand("");
    setPartQuantity(1);
    setPartPrice(0);
    setEditingPartId(null); // Assicurati che non stiamo modificando un ricambio esistente
    setIsDialogOpen(true);
  };
  
  // Funzione per aprire il dialog di modifica di un ricambio esistente
  const openEditPartDialog = (serviceId: string, part: SparePart) => {
    // Imposta i valori dal ricambio esistente
    setActiveServiceId(serviceId);
    setPartCode(part.code);
    setPartDescription(part.name);
    setPartBrand(part.brand || "");
    setPartQuantity(part.quantity);
    setPartPrice(part.unitPrice);
    setEditingPartId(part.id); // Imposta l'ID del ricambio che stiamo modificando
    setIsDialogOpen(true);
  };
  
  // Stato per tracciare se stiamo modificando un ricambio esistente
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  
  // Funzione per salvare il nuovo ricambio o aggiornare uno esistente
  const handleSavePart = () => {
    if (!activeServiceId || !partCode) return;
    
    // Trova servizio attivo per ottenere la categoria
    const activeService = items.find(item => item.id === activeServiceId);
    if (!activeService) return;
    
    // Preparazione dati ricambio
    const partData = {
      code: partCode,
      name: partDescription || `Ricambio ${partCode}`,
      brand: partBrand || undefined,
      category: activeService.serviceType.category.toLowerCase(),
      quantity: partQuantity,
      unitPrice: partPrice,
      finalPrice: partPrice * partQuantity
    };
    
    // Se stiamo modificando un ricambio esistente e abbiamo onUpdateItems
    if (editingPartId && onUpdateItems) {
      // Crea una copia dell'array di items
      const newItems = [...items];
      
      // Trova il servizio e il ricambio da modificare
      const serviceIndex = newItems.findIndex(item => item.id === activeServiceId);
      if (serviceIndex >= 0) {
        const service = newItems[serviceIndex];
        if (service.parts && Array.isArray(service.parts)) {
          // Trova l'indice del ricambio da modificare
          const partIndex = service.parts.findIndex(part => part.id === editingPartId);
          if (partIndex >= 0) {
            // Crea una copia dell'array di ricambi
            const newParts = [...service.parts];
            
            // Aggiorna il ricambio mantenendo lo stesso ID
            newParts[partIndex] = {
              ...partData,
              id: editingPartId
            };
            
            // Aggiorna il servizio con i ricambi aggiornati
            newItems[serviceIndex] = {
              ...service,
              parts: newParts,
              // Ricalcola il prezzo totale
              totalPrice: newParts.reduce((sum, part) => sum + part.finalPrice, 0)
            };
            
            // Aggiorna tutto l'array di items
            onUpdateItems(newItems);
          }
        }
      }
    } else {
      // Se non stiamo modificando o non abbiamo onUpdateItems, usa onAddPart
      onAddPart(activeServiceId, partData);
    }
    
    // Chiudi il dialog e resetta lo stato di modifica
    setIsDialogOpen(false);
    setEditingPartId(null);
  };
  
  return (
    <div className="space-y-6">
      <div className="max-h-[60vh] overflow-y-auto scrollbar-hide pr-1">
        {categories.map(category => (
          <div key={category} className="border rounded-lg overflow-hidden mb-4">
            <h3 className="bg-black text-white p-3 font-medium sticky top-0 z-10 text-base">{category}</h3>
            
            <div className="p-3 md:p-4">
              {categoriesMap[category].map(service => (
                <div key={service.id} className="mb-5 last:mb-0">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2">
                    <h4 className="font-bold text-primary text-base">
                      {service.serviceType.name}
                    </h4>
                    <span className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-0">
                      Prezzo base: {formatCurrency(service.serviceType.laborPrice || 0)}
                    </span>
                  </div>
                  
                  {/* Tabella ricambi per desktop */}
                  {service.parts && service.parts.length > 0 ? (
                    <div className="mb-3">
                      {/* Vista desktop */}
                      <div className="hidden md:block">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-primary/10 text-left">
                              <th className="p-2 text-sm font-medium">Codice</th>
                              <th className="p-2 text-sm font-medium">Descrizione</th>
                              <th className="p-2 text-sm font-medium">Brand</th>
                              <th className="p-2 text-sm font-medium text-center">Qtà</th>
                              <th className="p-2 text-sm font-medium text-right">Prezzo Un.</th>
                              <th className="p-2 text-sm font-medium text-right">Totale</th>
                              <th className="p-2 w-[100px]"></th>
                            </tr>
                          </thead>
                          <tbody className="overflow-y-auto scrollbar-hide">
                            {service.parts.map((part, idx) => (
                              <tr key={part.id} className={`border-b ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                                <td className="p-2">{part.code}</td>
                                <td className="p-2">{part.name}</td>
                                <td className="p-2">{part.brand || "-"}</td>
                                <td className="p-2 text-center">{part.quantity}</td>
                                <td className="p-2 text-right">{formatCurrency(part.unitPrice)}</td>
                                <td className="p-2 text-right font-medium">{formatCurrency(part.finalPrice)}</td>
                                <td className="p-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-primary"
                                      onClick={() => openEditPartDialog(service.id, part)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => onRemovePart(service.id, part.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            
                            <tr className="border-t bg-primary/5">
                              <td colSpan={5} className="p-2 text-right font-bold">Totale:</td>
                              <td className="p-2 text-right font-bold">
                                {formatCurrency(service.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                              </td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Vista mobile - card layout */}
                      <div className="md:hidden space-y-3">
                        {service.parts.map((part, idx) => (
                          <div key={part.id} className={`border-2 rounded-md p-3 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-bold text-base">{part.code}</div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-primary border border-primary"
                                  onClick={() => openEditPartDialog(service.id, part)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-destructive border border-destructive"
                                  onClick={() => onRemovePart(service.id, part.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="text-sm mb-2">{part.name}</div>
                            
                            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                              <div>
                                <span className="text-muted-foreground">Brand: </span>
                                <span className="font-medium">{part.brand || "-"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Qtà: </span>
                                <span className="font-medium">{part.quantity}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-muted-foreground">Prezzo: </span>
                                <span className="font-medium">{formatCurrency(part.unitPrice)}</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center border-t pt-2 mt-2">
                              <span className="font-medium">Totale:</span>
                              <span className="font-bold text-base text-primary">{formatCurrency(part.finalPrice)}</span>
                            </div>
                          </div>
                        ))}
                        
                        <div className="bg-primary/15 rounded-md p-3 flex justify-between items-center">
                          <span className="font-bold">Totale ricambi:</span>
                          <span className="font-bold text-lg text-primary">
                            {formatCurrency(service.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 px-4 bg-muted/10 rounded-lg mb-3 text-sm">
                      <p className="text-muted-foreground">Nessun ricambio aggiunto.</p>
                    </div>
                  )}
                  
                  {/* Pulsante per aggiungere nuovo ricambio */}
                  <div className="text-right mt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="px-3 py-2 h-9 text-sm md:text-sm border-primary text-primary"
                      onClick={() => openPartDialog(service.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      <span>Aggiungi ricambio</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Dialog per aggiungere ricambi */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] max-h-[90vh] overflow-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="text-lg">{editingPartId ? "Modifica Ricambio" : "Aggiungi Ricambio"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-2">
            {/* Form mobile: layout a colonna singola */}
            <div className="grid md:hidden gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-partCode" className="font-medium">Codice*</Label>
                <Input
                  id="m-partCode"
                  value={partCode}
                  onChange={(e) => setPartCode(e.target.value)}
                  placeholder="Inserisci codice ricambio"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="m-partDescription" className="font-medium">Descrizione</Label>
                <Input
                  id="m-partDescription"
                  value={partDescription}
                  onChange={(e) => setPartDescription(e.target.value)}
                  placeholder="Inserisci descrizione (opzionale)"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="m-partBrand" className="font-medium">Brand</Label>
                <Input
                  id="m-partBrand"
                  value={partBrand}
                  onChange={(e) => setPartBrand(e.target.value)}
                  placeholder="Inserisci marca ricambio (opzionale)"
                  className="h-10"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-partQuantity" className="font-medium">Quantità</Label>
                  <Input
                    id="m-partQuantity"
                    type="number"
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(parseFloat(e.target.value) || 1)}
                    min={1}
                    step={1}
                    className="h-10"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="m-partPrice" className="font-medium">Prezzo €</Label>
                  <Input
                    id="m-partPrice"
                    type="number"
                    value={partPrice}
                    onChange={(e) => setPartPrice(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="h-10"
                  />
                </div>
              </div>
            </div>
            
            {/* Form desktop: layout a 2 colonne */}
            <div className="hidden md:grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="partCode" className="text-right font-medium">
                  Codice*
                </Label>
                <Input
                  id="partCode"
                  value={partCode}
                  onChange={(e) => setPartCode(e.target.value)}
                  className="col-span-3 h-10"
                  placeholder="Inserisci codice ricambio"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="partDescription" className="text-right font-medium">
                  Descrizione
                </Label>
                <Input
                  id="partDescription"
                  value={partDescription}
                  onChange={(e) => setPartDescription(e.target.value)}
                  className="col-span-3 h-10"
                  placeholder="Inserisci descrizione (opzionale)"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="partBrand" className="text-right font-medium">
                  Brand
                </Label>
                <Input
                  id="partBrand"
                  value={partBrand}
                  onChange={(e) => setPartBrand(e.target.value)}
                  className="col-span-3 h-10"
                  placeholder="Inserisci marca ricambio (opzionale)"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="partQuantity" className="text-right font-medium">
                  Quantità
                </Label>
                <Input
                  id="partQuantity"
                  type="number"
                  value={partQuantity}
                  onChange={(e) => setPartQuantity(parseFloat(e.target.value) || 1)}
                  className="col-span-3 h-10"
                  min={1}
                  step={1}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="partPrice" className="text-right font-medium">
                  Prezzo €
                </Label>
                <Input
                  id="partPrice"
                  type="number"
                  value={partPrice}
                  onChange={(e) => setPartPrice(parseFloat(e.target.value) || 0)}
                  className="col-span-3 h-10"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between mt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-10">
              Annulla
            </Button>
            <Button type="submit" onClick={handleSavePart} disabled={!partCode} className="h-10">
              {editingPartId ? "Aggiorna" : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}