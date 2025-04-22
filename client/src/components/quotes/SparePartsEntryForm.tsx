import { useState, useCallback, useMemo, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SparePartsEntryFormProps {
  items: QuoteItem[];
  onChange: (items: QuoteItem[]) => void;
  initialActiveTab?: string | null;
  onActiveTabChange?: (tabId: string) => void;
}

export default function SparePartsEntryForm({ 
  items, 
  onChange,
  initialActiveTab = null,
  onActiveTabChange
}: SparePartsEntryFormProps) {
  // Stati locali
  const [activeTab, setActiveTab] = useState<string | null>(initialActiveTab);
  
  // Aggiorna il tab attivo quando cambia initialActiveTab
  useEffect(() => {
    console.log("initialActiveTab:", initialActiveTab);
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
      
      // Assicurati che un tab sia selezionato se ci sono servizi disponibili
      if (!activeTab && items.length > 0) {
        setActiveTab(items[0].id);
        if (onActiveTabChange) onActiveTabChange(items[0].id);
      }
    }
  }, [initialActiveTab, items, activeTab, onActiveTabChange]);
  const [articleCode, setArticleCode] = useState<string>("");
  const [articleDescription, setArticleDescription] = useState<string>("");
  const [articleBrand, setArticleBrand] = useState<string>("");
  const [articleQuantity, setArticleQuantity] = useState<number | "">(1);
  const [articlePrice, setArticlePrice] = useState<number | "">(0);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  
  // Raggruppo i servizi per categoria
  const servicesByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      const category = item.serviceType.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, QuoteItem[]>);
  }, [items]);
  
  // Trova il servizio attivo corrente
  const activeService = useMemo(() => {
    if (!activeTab) return null;
    return items.find(item => item.id === activeTab) || null;
  }, [items, activeTab]);
  
  // Reset campi del form
  const resetForm = useCallback(() => {
    setArticleCode("");
    setArticleDescription("");
    setArticleBrand("");
    setArticleQuantity(1);
    setArticlePrice(0);
    setEditingPartId(null);
  }, []);
  
  // Formatta numeri come valuta
  const formatCurrency = useCallback((amount: number): string => {
    if (isNaN(amount)) return "€0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }, []);
  
  // Carica un ricambio nel form per la modifica
  const handleEditPart = useCallback((part: SparePart) => {
    if (!activeService || !part) return;
    
    console.log('Modifica ricambio:', part);
    
    setEditingPartId(part.id);
    setArticleCode(part.code || '');
    setArticleDescription(part.name || '');
    setArticleBrand(part.brand || '');
    setArticleQuantity(part.quantity || 1);
    setArticlePrice(part.unitPrice || 0);
  }, [activeService]);

  // Salva le modifiche al ricambio o ne aggiunge uno nuovo
  const handleSavePartChanges = useCallback(() => {
    if (!activeService || !articleCode || articlePrice === "" || articleQuantity === "") {
      console.warn("Dati ricambio incompleti:", { activeService, articleCode, articlePrice, articleQuantity });
      return;
    }
    
    // Converti i valori in numeri
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    
    // Determina se è un'aggiunta o una modifica
    const isEditing = editingPartId !== null;
    
    // Debug
    console.log(`${isEditing ? 'Modifica' : 'Aggiunta'} ricambio nel servizio:`, activeService.serviceType.name);
    console.log(`Dati del ricambio: Codice=${articleCode}, Desc=${articleDescription}, Prezzo=${price}, Qtà=${quantity}`);
    
    let updatedItems;
    
    if (isEditing) {
      // Modifica un ricambio esistente
      updatedItems = items.map(item => {
        if (item.id === activeService.id) {
          // Aggiorna il ricambio specifico
          const updatedParts = item.parts.map(part => {
            if (part.id === editingPartId) {
              return {
                ...part,
                code: articleCode,
                name: articleDescription || `${activeService.serviceType.name} - Codice: ${articleCode}`,
                brand: articleBrand || undefined,
                quantity,
                unitPrice: price,
                finalPrice: price * quantity
              };
            }
            return part;
          });
          
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
    } else {
      // Aggiunge un nuovo ricambio
      const newPart: SparePart = {
        id: uuidv4(),
        code: articleCode,
        name: articleDescription || `${activeService.serviceType.name} - Codice: ${articleCode}`,
        brand: articleBrand || undefined,
        category: activeService.serviceType.category.toLowerCase(),
        quantity,
        unitPrice: price,
        finalPrice: price * quantity
      };
      
      updatedItems = items.map(item => {
        if (item.id === activeService.id) {
          // Calcola il prezzo totale dei ricambi
          const partsPrice = item.parts.reduce((sum, part) => sum + part.finalPrice, 0) + newPart.finalPrice;
          
          return {
            ...item,
            parts: [...item.parts, newPart],
            totalPrice: (item.laborPrice * item.laborHours) + partsPrice
          };
        }
        return item;
      });
    }
    
    onChange(updatedItems);
    resetForm();
  }, [activeService, articleCode, articlePrice, articleQuantity, 
      articleDescription, articleBrand, items, onChange, resetForm, editingPartId]);
  
  // Rimuove un ricambio
  const handleRemovePart = useCallback((partId: string) => {
    if (!activeService) return;
    
    const updatedItems = items.map(item => {
      if (item.id === activeService.id) {
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
  }, [activeService, items, onChange]);
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Inserimento Ricambi</h3>
      
      {/* Tabs di navigazione semplici */}
      <div className="flex overflow-x-auto">
        {Object.entries(servicesByCategory).map(([category, services]) => (
          <div key={category} className="mr-4 min-w-fit">
            <h4 className="font-medium text-sm text-primary mb-2">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => {
                    setActiveTab(service.id);
                    if (onActiveTabChange) onActiveTabChange(service.id);
                    resetForm();
                  }}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium
                    ${activeTab === service.id 
                      ? 'bg-primary text-white' 
                      : 'bg-muted hover:bg-muted/80'}
                    flex items-center space-x-1
                  `}
                >
                  <span>{service.serviceType.name}</span>
                  {service.parts && service.parts.length > 0 && (
                    <span className={`
                      ml-1 px-1.5 py-0.5 rounded-full text-xs
                      ${activeTab === service.id 
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
      
      {/* Contenuto principale */}
      <div className="border rounded-lg p-4">
        {activeService ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-lg">
                {activeService.serviceType.name}
              </h4>
              <span className="text-sm text-muted-foreground">
                Categoria: {activeService.serviceType.category}
              </span>
            </div>
            
            {/* Form semplice per inserimento ricambi */}
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
                    <span className="material-icons mr-1" style={{fontSize: "16px"}}>cancel</span>
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
                  <Label htmlFor="articleBrand">Brand</Label>
                  <Input
                    id="articleBrand"
                    value={articleBrand}
                    onChange={(e) => setArticleBrand(e.target.value)}
                    placeholder="Brand"
                  />
                </div>
                
                <div className="col-span-1">
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
                
                <div className="col-span-1 flex items-end">
                  <Button
                    onClick={handleSavePartChanges}
                    disabled={!articleCode || articlePrice === ""}
                    className="w-full"
                  >
                    <span className="material-icons">{editingPartId ? 'save' : 'add'}</span>
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
                        <tr key={part.id} className={`border-b ${index % 2 === 0 ? 'bg-zinc-100' : 'bg-primary/10'} ${editingPartId === part.id ? 'bg-primary/5 outline outline-1 outline-primary' : ''}`}>
                          <td className="p-2 font-medium">{part.code}</td>
                          <td className="p-2">
                            {part.name}
                            {part.brand && <span className="text-sm text-muted-foreground ml-1">({part.brand})</span>}
                          </td>
                          <td className="p-2 text-center">{part.quantity}</td>
                          <td className="p-2 text-right">{formatCurrency(part.unitPrice)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(part.finalPrice)}</td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPart(part)}
                                className="h-7 w-7 p-0 text-primary hover:text-primary"
                                title="Modifica ricambio"
                              >
                                <span className="material-icons" style={{fontSize: "16px"}}>edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemovePart(part.id)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                title="Elimina ricambio"
                              >
                                <span className="material-icons" style={{fontSize: "16px"}}>delete</span>
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
                  <span className="material-icons text-4xl mb-2">inventory</span>
                  <p>Nessun ricambio aggiunto</p>
                  <p className="text-sm">Usa il form sopra per aggiungere ricambi</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            <span className="material-icons text-5xl mb-2">touch_app</span>
            <p className="text-lg font-medium">Seleziona un servizio</p>
            <p className="text-sm">Fai click su uno dei servizi sopra per aggiungere ricambi</p>
          </div>
        )}
      </div>
    </div>
  );
}