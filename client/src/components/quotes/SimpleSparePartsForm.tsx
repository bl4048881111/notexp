// Versione estremamente semplificata del form ricambi, senza effetti collaterali
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SimpleSparePartsFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
}

export default function SimpleSparePartsForm({ items, onChange }: SimpleSparePartsFormProps) {
  // Funzionalità minima: un solo stato per il tab attivo e campi per il form
  const [activeServiceId, setActiveServiceId] = useState<string | null>(items[0]?.id || null);
  const [articleCode, setArticleCode] = useState<string>("");
  const [articleDescription, setArticleDescription] = useState<string>("");
  const [articleQuantity, setArticleQuantity] = useState<number | "">(1);
  const [articlePrice, setArticlePrice] = useState<number | "">(0);
  
  // Trova il servizio attivo (se presente)
  const activeService = activeServiceId 
    ? items.find(item => item.id === activeServiceId) 
    : null;
  
  // Funzionalità di base: raggruppa servizi per categoria
  const servicesByCategory: Record<string, QuoteItem[]> = {};
  for (const item of items) {
    const category = item.serviceType.category;
    if (!servicesByCategory[category]) {
      servicesByCategory[category] = [];
    }
    servicesByCategory[category].push(item);
  }
  
  // Reimposta i campi del form
  function resetForm() {
    setArticleCode("");
    setArticleDescription("");
    setArticleQuantity(1);
    setArticlePrice(0);
  }
  
  // Formatta un prezzo come valuta
  function formatCurrency(amount: number): string {
    if (isNaN(amount)) return "€0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
  
  // Aggiunge un nuovo ricambio
  function handleAddPart() {
    if (!activeService || !articleCode || articlePrice === "" || articleQuantity === "") {
      return;
    }
    
    // Calcola prezzi
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    
    // Crea il nuovo ricambio
    const newPart: SparePart = {
      id: uuidv4(),
      code: articleCode,
      name: articleDescription || `${activeService.serviceType.name} - Codice: ${articleCode}`,
      category: activeService.serviceType.category.toLowerCase(),
      quantity,
      unitPrice: price,
      finalPrice: price * quantity
    };
    
    // Crea una nuova lista di servizi
    const updatedItems = items.map(item => {
      if (item.id === activeServiceId) {
        // Ensure parts is an array
        const existingParts = Array.isArray(item.parts) ? item.parts : [];
        
        // Aggiungi il nuovo ricambio
        const updatedParts = [...existingParts, newPart];
        
        // Calcola il totale
        const partsTotal = updatedParts.reduce((sum, part) => sum + part.finalPrice, 0);
        
        return {
          ...item,
          parts: updatedParts,
          totalPrice: partsTotal
        };
      }
      return item;
    });
    
    // Notifica il cambiamento al componente parent
    onChange(updatedItems);
    
    // Reimposta i campi del form
    resetForm();
  }
  
  // Rimuove un ricambio
  function handleRemovePart(partId: string) {
    if (!activeService) return;
    
    const updatedItems = items.map(item => {
      if (item.id === activeServiceId) {
        // Ensure parts is an array and remove the part
        const existingParts = Array.isArray(item.parts) ? item.parts : [];
        const updatedParts = existingParts.filter(part => part.id !== partId);
        
        // Calcola il totale
        const partsTotal = updatedParts.reduce((sum, part) => sum + part.finalPrice, 0);
        
        return {
          ...item,
          parts: updatedParts,
          totalPrice: partsTotal
        };
      }
      return item;
    });
    
    // Notifica il cambiamento al componente parent
    onChange(updatedItems);
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Inserimento Ricambi</h3>
      
      {/* Navigazione fra categorie e servizi */}
      <div className="space-y-4">
        {Object.entries(servicesByCategory).map(([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <h4 className="font-medium text-sm text-primary">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {categoryItems.map(service => (
                <button
                  key={service.id}
                  onClick={() => {
                    setActiveServiceId(service.id);
                    resetForm();
                  }}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium
                    ${activeServiceId === service.id 
                      ? 'bg-primary text-white' 
                      : 'bg-muted hover:bg-muted/80'}
                    flex items-center space-x-1
                  `}
                >
                  <span>{service.serviceType.name}</span>
                  {service.parts && service.parts.length > 0 && (
                    <span className={`
                      ml-1 px-1.5 py-0.5 rounded-full text-xs
                      ${activeServiceId === service.id 
                        ? 'bg-white text-primary' 
                        : 'bg-primary/20 text-primary'}
                    `}>
                      {service.parts.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Form per aggiunta ricambi */}
      {activeService ? (
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-lg">
              {activeService.serviceType.name}
            </h4>
            <span className="text-sm text-muted-foreground">
              Categoria: {activeService.serviceType.category}
            </span>
          </div>
          
          {/* Form semplificato */}
          <div className="bg-muted/20 p-4 rounded-lg mb-4">
            <h5 className="font-medium mb-3">Aggiungi nuovo ricambio</h5>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3">
                <Label htmlFor="articleCode">Codice*</Label>
                <Input
                  id="articleCode"
                  value={articleCode}
                  onChange={(e) => setArticleCode(e.target.value)}
                  placeholder="Codice articolo"
                />
              </div>
              
              <div className="col-span-3">
                <Label htmlFor="articleDescription">Descrizione</Label>
                <Input
                  id="articleDescription"
                  value={articleDescription}
                  onChange={(e) => setArticleDescription(e.target.value)}
                  placeholder="Descrizione"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="articleQuantity">Qtà*</Label>
                <Input
                  id="articleQuantity"
                  type="number"
                  value={articleQuantity}
                  onChange={(e) => setArticleQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  min={1}
                  step={1}
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="articlePrice">Prezzo*</Label>
                <Input
                  id="articlePrice"
                  type="number"
                  value={articlePrice}
                  onChange={(e) => setArticlePrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="€"
                  min={0}
                  step={0.01}
                />
              </div>
              
              <div className="col-span-2 flex items-end">
                <Button
                  onClick={handleAddPart}
                  disabled={!articleCode || articlePrice === ""}
                  className="w-full"
                >
                  <span>Aggiungi</span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Lista ricambi */}
          <div>
            <h5 className="font-medium">Ricambi aggiunti</h5>
            
            {activeService.parts && activeService.parts.length > 0 ? (
              <div className="mt-2">
                <table className="w-full border-collapse border rounded-md overflow-hidden">
                  <thead>
                    <tr className="bg-black text-white text-left text-sm">
                      <th className="p-2 font-medium">Codice</th>
                      <th className="p-2 font-medium">Descrizione</th>
                      <th className="p-2 font-medium">Qtà</th>
                      <th className="p-2 font-medium text-right">Prezzo Un.</th>
                      <th className="p-2 font-medium text-right">Totale</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeService.parts.map((part, index) => (
                      <tr key={part.id} className={`border-b ${index % 2 === 0 ? 'bg-zinc-100' : 'bg-primary/10'}`}>
                        <td className="p-2 font-medium">{part.code}</td>
                        <td className="p-2">{part.name}</td>
                        <td className="p-2 text-center">{part.quantity}</td>
                        <td className="p-2 text-right">{formatCurrency(part.unitPrice)}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(part.finalPrice)}</td>
                        <td className="p-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePart(part.id)}
                            className="h-7 px-2 py-0 text-destructive hover:text-destructive/80"
                            title="Elimina ricambio"
                          >
                            Elimina
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium bg-primary/10">
                      <td colSpan={4} className="p-2 text-right font-bold">Totale ricambi:</td>
                      <td className="p-2 text-right text-primary font-bold">
                        {formatCurrency(activeService.parts && Array.isArray(activeService.parts) ? 
                          activeService.parts.reduce((sum, part) => sum + (part?.finalPrice || 0), 0) : 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 border rounded-lg mt-2 text-muted-foreground">
                <p>Nessun ricambio aggiunto</p>
                <p className="text-sm">Usa il form sopra per aggiungere ricambi</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg text-muted-foreground">
          <p className="text-lg font-medium">Seleziona un servizio</p>
          <p className="text-sm">Fai click su uno dei servizi sopra per aggiungere ricambi</p>
        </div>
      )}
    </div>
  );
}