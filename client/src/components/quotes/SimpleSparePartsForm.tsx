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
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  
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
    setEditingPartId(null);
  }
  
  // Formatta un prezzo come valuta
  function formatCurrency(amount: number): string {
    if (isNaN(amount)) return "€0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
  
  // Carica un ricambio nel form per la modifica
  function handleEditPart(part: SparePart) {
    if (!activeService || !part) return;
    
    setEditingPartId(part.id);
    setArticleCode(part.code || '');
    setArticleDescription(part.name || '');
    setArticleQuantity(part.quantity || 1);
    setArticlePrice(part.unitPrice || 0);
  }
  
  // Salva le modifiche o aggiunge un nuovo ricambio
  function handleSavePart() {
    if (!activeService || !articleCode || articlePrice === "" || articleQuantity === "") {
      return;
    }
    
    // Calcola prezzi
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    
    let updatedItems;
    
    // Determina se stiamo modificando o aggiungendo
    if (editingPartId) {
      // Modifica un ricambio esistente
      updatedItems = items.map(item => {
        if (item.id === activeServiceId) {
          // Assicurati che parts sia un array
          const existingParts = Array.isArray(item.parts) ? item.parts : [];
          
          // Aggiorna il ricambio specifico
          const updatedParts = existingParts.map(part => {
            if (part.id === editingPartId) {
              return {
                ...part,
                code: articleCode,
                name: articleDescription || `${activeService.serviceType.name} - Codice: ${articleCode}`,
                quantity,
                unitPrice: price,
                finalPrice: price * quantity
              };
            }
            return part;
          });
          
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
    } else {
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
      updatedItems = items.map(item => {
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
    }
    
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
    
    // Se stavamo modificando il ricambio che è stato eliminato, resetta il form
    if (editingPartId === partId) {
      resetForm();
    }
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
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium">
                {editingPartId ? 'Modifica ricambio' : 'Aggiungi nuovo ricambio'}
              </h5>
              {editingPartId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-8 px-2 text-muted-foreground"
                >
                  Annulla modifica
                </Button>
              )}
            </div>
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
                  onClick={handleSavePart}
                  disabled={!articleCode || articlePrice === ""}
                  className="w-full"
                >
                  {editingPartId ? 'Aggiorna' : 'Aggiungi'}
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
                      <th className="p-2 text-center">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeService.parts.map((part, index) => (
                      <tr key={part.id} className={`border-b ${index % 2 === 0 ? 'bg-zinc-100' : 'bg-primary/10'} ${editingPartId === part.id ? 'bg-primary/5 outline outline-1 outline-primary' : ''}`}>
                        <td className="p-2 font-medium">{part.code}</td>
                        <td className="p-2">{part.name}</td>
                        <td className="p-2 text-center">{part.quantity}</td>
                        <td className="p-2 text-right">{formatCurrency(part.unitPrice)}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(part.finalPrice)}</td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPart(part)}
                              className="h-7 w-7 p-0 text-primary mr-2"
                              title="Modifica ricambio"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                              </svg>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemovePart(part.id)}
                              className="h-7 w-7 p-0 border-destructive"
                              title="Elimina ricambio"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-destructive" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM13 3H3V2h10z"/>
                              </svg>
                            </Button>
                          </div>
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