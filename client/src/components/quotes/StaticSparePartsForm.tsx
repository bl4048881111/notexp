// Versione STATICA del form ricambi - nessuno stato locale, solo props
import { useState } from "react";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StaticSparePartsFormProps {
  items: QuoteItem[];
  onAddPart: (serviceId: string, part: Omit<SparePart, 'id'>) => void;
  onRemovePart: (serviceId: string, partId: string) => void;
}

export default function StaticSparePartsForm({ 
  items, 
  onAddPart,
  onRemovePart
}: StaticSparePartsFormProps) {
  // Ora abbiamo bisogno di alcuni stati locali per il popup
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [partCode, setPartCode] = useState("");
  const [partDescription, setPartDescription] = useState("");
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
    setActiveServiceId(serviceId);
    setPartCode("");
    setPartDescription("");
    setPartQuantity(1);
    setPartPrice(0);
    setIsDialogOpen(true);
  };
  
  // Funzione per salvare il nuovo ricambio
  const handleSavePart = () => {
    if (!activeServiceId || !partCode) return;
    
    // Trova servizio attivo per ottenere la categoria
    const activeService = items.find(item => item.id === activeServiceId);
    if (!activeService) return;
    
    // Crea e aggiunge il ricambio
    onAddPart(activeServiceId, {
      code: partCode,
      name: partDescription || `Ricambio ${partCode}`,
      category: activeService.serviceType.category.toLowerCase(),
      quantity: partQuantity,
      unitPrice: partPrice,
      finalPrice: partPrice * partQuantity
    });
    
    // Chiudi il dialog
    setIsDialogOpen(false);
  };
  
  return (
    <div className="space-y-8">
      {categories.map(category => (
        <div key={category} className="border rounded-lg overflow-hidden">
          <h3 className="bg-black text-white p-3 font-medium">{category}</h3>
          
          <div className="p-4">
            {categoriesMap[category].map(service => (
              <div key={service.id} className="mb-6 last:mb-0">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-lg text-primary">
                    {service.serviceType.name}
                  </h4>
                  <span className="text-sm">
                    Prezzo base: {formatCurrency(service.serviceType.laborPrice || 0)}
                  </span>
                </div>
                
                {/* Tabella ricambi */}
                {service.parts && service.parts.length > 0 ? (
                  <div className="mb-3">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-primary/10 text-left">
                          <th className="p-2 text-sm font-medium">Codice</th>
                          <th className="p-2 text-sm font-medium">Descrizione</th>
                          <th className="p-2 text-sm font-medium text-center">Qtà</th>
                          <th className="p-2 text-sm font-medium text-right">Prezzo Un.</th>
                          <th className="p-2 text-sm font-medium text-right">Totale</th>
                          <th className="p-2 w-[100px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {service.parts.map((part, idx) => (
                          <tr key={part.id} className={`border-b ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                            <td className="p-2">{part.code}</td>
                            <td className="p-2">{part.name}</td>
                            <td className="p-2 text-center">{part.quantity}</td>
                            <td className="p-2 text-right">{formatCurrency(part.unitPrice)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(part.finalPrice)}</td>
                            <td className="p-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-destructive"
                                onClick={() => onRemovePart(service.id, part.id)}
                              >
                                Elimina
                              </Button>
                            </td>
                          </tr>
                        ))}
                        
                        <tr className="border-t bg-primary/5">
                          <td colSpan={4} className="p-2 text-right font-bold">Totale:</td>
                          <td className="p-2 text-right font-bold">
                            {formatCurrency(service.parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 px-6 bg-muted/10 rounded-lg mb-3">
                    <p className="text-muted-foreground">Nessun ricambio aggiunto.</p>
                  </div>
                )}
                
                {/* Pulsante per aggiungere nuovo ricambio */}
                <div className="text-right">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openPartDialog(service.id)}
                  >
                    Aggiungi ricambio
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {/* Dialog per aggiungere ricambi */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Aggiungi Ricambio</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="partCode" className="text-right">
                Codice*
              </Label>
              <Input
                id="partCode"
                value={partCode}
                onChange={(e) => setPartCode(e.target.value)}
                className="col-span-3"
                placeholder="Inserisci codice ricambio"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="partDescription" className="text-right">
                Descrizione
              </Label>
              <Input
                id="partDescription"
                value={partDescription}
                onChange={(e) => setPartDescription(e.target.value)}
                className="col-span-3"
                placeholder="Inserisci descrizione (opzionale)"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="partQuantity" className="text-right">
                Quantità
              </Label>
              <Input
                id="partQuantity"
                type="number"
                value={partQuantity}
                onChange={(e) => setPartQuantity(parseFloat(e.target.value) || 1)}
                className="col-span-3"
                min={1}
                step={1}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="partPrice" className="text-right">
                Prezzo €
              </Label>
              <Input
                id="partPrice"
                type="number"
                value={partPrice}
                onChange={(e) => setPartPrice(parseFloat(e.target.value) || 0)}
                className="col-span-3"
                min={0}
                step={0.01}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" onClick={handleSavePart} disabled={!partCode}>
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}