// Versione STATICA del form ricambi - nessuno stato locale, solo props
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";

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
  // NO STATI LOCALI - tutto è gestito dal componente parent
  
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
                    onClick={() => {
                      // Richiede all'utente i dati del nuovo ricambio
                      const code = prompt("Codice ricambio:");
                      if (!code) return;
                      
                      const description = prompt("Descrizione (opzionale):", "");
                      
                      let quantity = 1;
                      const quantityStr = prompt("Quantità:", "1");
                      if (quantityStr) {
                        quantity = parseFloat(quantityStr) || 1;
                      }
                      
                      let price = 0;
                      const priceStr = prompt("Prezzo unitario:", "0");
                      if (priceStr) {
                        price = parseFloat(priceStr) || 0;
                      }
                      
                      // Crea e aggiunge il ricambio
                      onAddPart(service.id, {
                        code,
                        name: description || `Ricambio ${code}`,
                        category: service.serviceType.category.toLowerCase(),
                        quantity,
                        unitPrice: price,
                        finalPrice: price * quantity
                      });
                    }}
                  >
                    Aggiungi ricambio
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}