// Versione completamente ricostruita e semplificata
import { useState, useCallback, useMemo, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash } from "lucide-react";
import SparePartForm from "./SparePartForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  // Determina un tab attivo iniziale
  const firstTabId = items.length > 0 ? items[0].id : null;
  // Usa initialActiveTab se presente, altrimenti il primo tab disponibile
  const [activeTab, setActiveTab] = useState<string | null>(
    initialActiveTab || firstTabId
  );
  const [articleCode, setArticleCode] = useState<string>("");
  const [articleDescription, setArticleDescription] = useState<string>("");
  const [articleBrand, setArticleBrand] = useState<string>("");
  const [articleQuantity, setArticleQuantity] = useState<number | "">(1);
  const [articlePrice, setArticlePrice] = useState<number | "">(0);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  // Raggruppo i servizi per categoria
  const servicesByCategory = useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      const category = item.serviceType.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, QuoteItem[]>);
    
    // Se non c'è una categoria espansa, espandi la prima automaticamente
    if (expandedCategory === null && Object.keys(grouped).length > 0) {
      setExpandedCategory(Object.keys(grouped)[0]);
    }
    
    return grouped;
  }, [items, expandedCategory]);
  
  // Trova il servizio attivo corrente
  const activeService = useMemo(() => {
    if (!activeTab) return null;
    return items.find(item => item.id === activeTab) || null;
  }, [items, activeTab]);
  
  // Trova il ricambio che si sta modificando, se presente
  const editingPart = useMemo(() => {
    if (!activeService || !editingPartId) return null;
    return activeService.parts.find(part => part.id === editingPartId) || null;
  }, [activeService, editingPartId]);
  
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
    if (isNaN(amount)) return "€ 0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace('€', '€ ');
  }, []);
  
  // Carica un ricambio nel form per la modifica
  const handleEditPart = useCallback((part: SparePart) => {
    if (!activeService || !part) return;
    
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
      return;
    }
    
    // Converti i valori in numeri
    const price = typeof articlePrice === "string" ? parseFloat(articlePrice) || 0 : articlePrice;
    const quantity = typeof articleQuantity === "string" ? parseFloat(articleQuantity) || 1 : articleQuantity;
    
    // Determina se è un'aggiunta o una modifica
    const isEditing = editingPartId !== null;
    
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
            totalPrice: partsPrice
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
            totalPrice: partsPrice
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
          totalPrice: partsPrice
        };
      }
      return item;
    });
    
    onChange(updatedItems);
  }, [activeService, items, onChange]);
  
  // Funzione per gestire l'apertura/chiusura delle categorie
  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };
  
  // Gestisci la modifica tramite il form dedicato
  const handleSpareParts = (updatedParts: SparePart[]) => {
    if (!activeService) return;
    
    const updatedItems = items.map(item => {
      if (item.id === activeService.id) {
        return { 
          ...item, 
          parts: updatedParts,
          totalPrice: item.laborPrice * item.laborHours + updatedParts.reduce((sum, part) => sum + part.finalPrice, 0)
        };
      }
      return item;
    });
    
    onChange(updatedItems);
    setEditingPartId(null); // Reset editing state
  };
  
  return (
    <div className="space-y-6 bg-zinc-900 text-white p-4 rounded-lg">
      <h1 className="text-xl font-bold text-primary">Inserimento Ricambi</h1>
      <div className="text-sm text-zinc-400 mb-4">Passo 3 di 4</div>
      
      <div className="max-h-[60vh] overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Sidebar con categorie e servizi - 4 colonne su desktop */}
          <div className="md:col-span-4 bg-zinc-800 rounded-lg p-2 h-min">
            <div className="space-y-2">
              {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                <div key={category} className="overflow-hidden rounded-md border border-zinc-700">
                  <button
                    className="w-full p-3 bg-zinc-800 flex justify-between items-center hover:bg-zinc-700"
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="font-semibold text-primary">{category}</span>
                    {expandedCategory === category ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </button>
                  
                  {expandedCategory === category && (
                    <div className="space-y-1 p-2 bg-zinc-850">
                      {categoryServices.map(service => (
                        <button
                          key={service.id}
                          onClick={() => {
                            setActiveTab(service.id);
                            if (onActiveTabChange) {
                              onActiveTabChange(service.id);
                            }
                            setEditingPartId(null); // Reset editing state when changing service
                          }}
                          className={`w-full px-3 py-2 text-left transition-colors rounded ${
                            activeTab === service.id 
                              ? "bg-primary text-black font-medium" 
                              : "text-white hover:bg-zinc-700"
                          }`}
                        >
                          {service.serviceType.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Contenuto principale - 8 colonne su desktop */}
          <div className="md:col-span-8 bg-zinc-800 rounded-lg">
            {activeService ? (
              <div className="p-4 space-y-4">
                {/* Usa il componente SparePartForm con il ricambio che si sta modificando */}
                <SparePartForm 
                  parts={activeService.parts} 
                  onChange={handleSpareParts}
                  serviceName={activeService.serviceType.name}
                  editingPart={editingPart}
                />
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-zinc-400 mb-4">Seleziona un servizio dalla lista per aggiungere ricambi</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeService && editingPart && (
        <Dialog open={!!editingPart} onOpenChange={(open) => !open && setEditingPartId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-primary">
                {activeService.serviceType.name} 
                <span className="ml-2 text-orange-500">
                  → {editingPart.description || editingPart.name || editingPart.code}
                </span>
              </DialogTitle>
            </DialogHeader>
            
            {/* Contenuto della dialog */}
            <SparePartForm 
              parts={activeService.parts} 
              onChange={handleSpareParts}
              serviceName={activeService.serviceType.name}
              editingPart={editingPart}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}