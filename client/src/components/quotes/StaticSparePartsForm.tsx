// Versione STATICA del form ricambi - nessuno stato locale, solo props
import { useState, useEffect } from "react";
import { QuoteItem, SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import React from "react";

interface StaticSparePartsFormProps {
  items: QuoteItem[];
  onAddPart: (serviceId: string, part: Omit<SparePart, 'id'>, index?: number) => void;
  onRemovePart: (serviceId: string, partId: string) => void;
  // Nuova prop per aggiornare direttamente l'array di items
  onUpdateItems?: (newItems: QuoteItem[]) => void;
  editPartRequest?: { serviceId: string, partId: string } | null;
  onResetEditPartRequest?: () => void;
  onEditPart?: (serviceId: string, part: SparePart) => void;
  // Props per la navigazione tra i passaggi
  onPrevStep?: () => void;
  onNextStep?: () => void;
  isNewQuote?: boolean;
}

export default function StaticSparePartsForm({ 
  items, 
  onAddPart,
  onRemovePart,
  onUpdateItems,
  editPartRequest,
  onResetEditPartRequest,
  onEditPart,
  onPrevStep,
  onNextStep,
  isNewQuote = false
}: StaticSparePartsFormProps) {
  // Implementiamo un sistema diretto senza alcun dialog
  const [activeServiceId, setActiveServiceId] = useState<string>("");
  const [partCode, setPartCode] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [partBrand, setPartBrand] = useState("");
  const [partQuantity, setPartQuantity] = useState<number>(1);
  const [partPrice, setPartPrice] = useState<number>(0);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manteniamo il dialogo originale per modifica
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<{
    serviceId: string;
    partId: string;
    code: string;
    description: string;
    brand: string;
    quantity: string;
    unitPrice: string;
  } | null>(null);
  
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
  
  // Formatta numeri come valuta
  const formatCurrency = (amount: number): string => {
    if (isNaN(amount)) return "€ 0,00";
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace('€', '€ ');
  };
  
  // Funzione per generare UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Funzione per mostrare il form di aggiunta ricambi
  const showAddPartForm = (serviceId: string) => {
    const activeService = items.find(item => item.id === serviceId);
    
    setActiveServiceId(serviceId);
    setPartCode("");
    setPartDescription(activeService ? `Ricambio per ${activeService.serviceType.name}` : "");
    setPartBrand("");
    setPartQuantity(1);
    setPartPrice(0);
    setEditingPartId(null);
  };
  
  // Funzione per mostrare il form di modifica ricambi
  const showEditPartForm = (serviceId: string, part: SparePart) => {
    setActiveServiceId(serviceId);
    setPartCode(part.code || "");
    setPartDescription(part.name || "");
    setPartBrand(part.brand || "");
    setPartQuantity(part.quantity || 1);
    setPartPrice(part.unitPrice || 0);
    setEditingPartId(part.id);
  };
  
  // Funzione per nascondere il form
  const hidePartForm = () => {
    setActiveServiceId("");
    setEditingPartId(null);
  };
  
  // Controlla se c'è un serviceId da editare al caricamento
  useEffect(() => {
    // Controlla se c'è un ID di servizio da modificare in localStorage
    const editServiceId = localStorage.getItem('editServiceId');
    if (editServiceId) {
      // Verifica che questo servizio esista negli items
      const serviceExists = items.some(item => item.id === editServiceId);
      
      if (serviceExists) {
        // Imposta il servizio attivo
        setActiveServiceId(editServiceId);
        // Mostra il form per l'aggiunta di parti
        showAddPartForm(editServiceId);
        
        // Rimuovi l'ID dal localStorage dopo averlo usato
        localStorage.removeItem('editServiceId');
      }
    } else if (items.length > 0 && !activeServiceId) {
      // Se non c'è un ID da modificare e non è stato selezionato alcun servizio, 
      // seleziona il primo disponibile
      setActiveServiceId(items[0].id);
    }
  }, [items, activeServiceId]);
  
  // Funzione per aggiungere un ricambio
  const addPart = async () => {
    if (!activeServiceId || !partCode) {
      alert("Inserisci almeno il codice del ricambio");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const activeService = items.find(item => item.id === activeServiceId);
      if (!activeService) {
        throw new Error("Servizio non trovato");
      }
      
      // Dati del ricambio
    const partData = {
      code: partCode,
      name: partDescription || `Ricambio ${partCode}`,
      brand: partBrand || undefined,
      category: activeService.serviceType.category.toLowerCase(),
      quantity: partQuantity,
      unitPrice: partPrice,
      finalPrice: partPrice * partQuantity
    };
    
      // IMPORTANTE: Utilizziamo onUpdateItems direttamente per evitare il rirender problematico
      // Crea un nuovo array di servizi con il nuovo ricambio
      const newItems = items.map(item => {
        if (item.id === activeServiceId) {
          // Se stiamo modificando un ricambio esistente
          if (editingPartId) {
          const updatedParts = item.parts.map(part => {
            if (part.id === editingPartId) {
              return {
                ...part,
                ...partData,
                  id: editingPartId, // Mantieni lo stesso ID
                  code: partData.code,
                  name: partData.name,
                  brand: partData.brand,
                  quantity: partData.quantity,
                  unitPrice: partData.unitPrice,
                  finalPrice: partData.finalPrice
              };
            }
            return part;
          });
          
            // Calcola il nuovo prezzo totale
            const totalPrice = updatedParts.reduce((sum, part) => sum + (part.finalPrice || 0), 0);
          
            return {
              ...item,
              parts: updatedParts,
              totalPrice
            };
          } else {
            // Se stiamo aggiungendo un nuovo ricambio
            const newPart = {
              ...partData,
              id: generateUUID(),
              code: partData.code,
              quantity: partData.quantity,
              name: partData.name,
              category: partData.category,
              unitPrice: partData.unitPrice,
              finalPrice: partData.finalPrice
            };
          
            // Ottieni l'array delle parti esistenti
            let parts = Array.isArray(item.parts) ? [...item.parts] : [];
            parts.push(newPart);
          
            // Calcola il nuovo prezzo totale
            const totalPrice = parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0);
          
            return {
              ...item,
              parts,
              totalPrice
            };
          }
        }
        return item;
      });
    
      // Aggiorna lo stato con il nuovo array usando onUpdateItems e onAddPart se disponibili
      if (onUpdateItems) {
        // Forza l'aggiornamento immediato dei dati
        onUpdateItems(JSON.parse(JSON.stringify(newItems)));
        
        // Comunica al componente padre che l'aggiornamento è stato completato
        console.log("Aggiornamento dati completato, refresh vista...");
        
        // Notifica di aggiornamento per il componente padre (solo se non è un'operazione di modifica)
        if (!editingPartId && onAddPart && activeServiceId) {
          // Nota: qui utilizziamo onAddPart solo per notificare al componente padre che c'è stato un cambiamento
          const partToAdd = {
            code: partCode,
            name: partDescription || `Ricambio ${partCode}`,
            brand: partBrand || undefined,
            category: activeService.serviceType.category.toLowerCase(),
            quantity: partQuantity,
            unitPrice: partPrice,
            finalPrice: partPrice * partQuantity
          };
          
          // Utilizziamo un timeout per assicurarci che l'UI sia stata aggiornata prima di procedere
          setTimeout(() => {
            try {
              // Utilizziamo un indice -1 per indicare "aggiungi in fondo"
              onAddPart(activeServiceId, partToAdd, -1);
            } catch (error) {
              console.log("Nota: addPart secondario completato silenziosamente");
            }
          }, 10);
        }
      }
      
      // Reset del form
      setPartCode("");
      setPartDescription(activeService ? `Ricambio per ${activeService.serviceType.name}` : "");
      setPartBrand("");
      setPartQuantity(1);
      setPartPrice(0);
      setEditingPartId(null);
      
      // Feedback all'utente che l'operazione è stata completata
      console.log(`Ricambio ${editingPartId ? 'modificato' : 'aggiunto'} con successo, vista aggiornata`);
    } catch (error) {
      console.error("Errore durante l'aggiunta/modifica del ricambio:", error);
      alert("Si è verificato un errore. Riprova.");
    } finally {
      // Non nascondiamo il form automaticamente, così l'utente può aggiungere altri ricambi
      setIsSubmitting(false);
    }
  };
  
  // Funzione per aggiungere un ricambio e chiudere il form
  const addPartAndClose = async () => {
    if (!activeServiceId || !partCode) {
      alert("Inserisci almeno il codice del ricambio");
      return;
    }
    
    await addPart();
    hidePartForm();
  };
  
  // Funzione per aprire il dialog di modifica di un ricambio esistente tramite Radix UI
  const openEditPartDialog = (serviceId: string, part: SparePart) => {
    setEditingPart({
      serviceId,
      partId: part.id,
      code: part.code || "",
      description: part.name || part.description || "",
      brand: part.brand || "",
      quantity: String(part.quantity || 1),
      unitPrice: String(part.unitPrice || 0)
    });
    
    setIsEditDialogOpen(true);
  };
  
  // Funzione per salvare le modifiche
  const saveEditPart = () => {
    if (!editingPart) return;
    
    // Trova il servizio
    const service = items.find(item => item.id === editingPart.serviceId);
    if (!service) return;
    
    // Calcola il prezzo finale
    const quantity = Number(editingPart.quantity);
    const unitPrice = Number(editingPart.unitPrice);
    const finalPrice = quantity * unitPrice;
    
    // Crea l'oggetto ricambio aggiornato
    const updatedPart: Partial<SparePart> = {
      id: editingPart.partId,
      code: editingPart.code,
      name: editingPart.description, // Aggiorniamo la proprietà name con la descrizione
      description: editingPart.description,
      brand: editingPart.brand,
      quantity,
      unitPrice,
      finalPrice
    };
    
    // Trova l'indice del ricambio da aggiornare
    const partIndex = service.parts?.findIndex(p => p.id === editingPart.partId) ?? -1;
    
    if (partIndex !== -1) {
      // Crea un nuovo array di ricambi
      const newParts = [...(service.parts || [])];
      newParts[partIndex] = { ...newParts[partIndex], ...updatedPart };
      
      // Aggiorna il servizio con i nuovi ricambi
      const updatedItems = items.map(item => {
        if (item.id === editingPart.serviceId) {
          return {
            ...item,
            parts: newParts,
            totalPrice: newParts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
          };
        }
        return item;
      });
      
      // Aggiorna lo stato
      if (onUpdateItems) {
        // Forza un aggiornamento completo creando una copia profonda degli oggetti
        onUpdateItems(JSON.parse(JSON.stringify(updatedItems)));
        
        // Forza un aggiornamento anche tramite la callback di edit se disponibile
        if (onEditPart) {
          try {
            const fullUpdatedPart = {
              ...updatedPart,
              id: editingPart.partId,
              name: updatedPart.description || "",
              description: updatedPart.description || "",
              category: service.serviceType.category.toLowerCase(),
            } as SparePart;
            
            // Notifica immediata della modifica
            onEditPart(editingPart.serviceId, fullUpdatedPart);
          } catch (error) {
            console.log("Errore nella notifica di modifica:", error);
          }
        }
        
        console.log("Ricambio modificato con successo, vista aggiornata");
      }
    }
    
    // Chiudi il dialog
    setIsEditDialogOpen(false);
    setEditingPart(null);
  };
  
  return (
    <div className="space-y-4 overflow-y-auto max-h-[100vh] flex flex-col bg-black text-white scrollbar-hide">
      {/* Form di aggiunta/modifica ricambi inline */}
      {activeServiceId && (
        <div className="mb-3 border border-gray-800 rounded-lg overflow-hidden bg-black shadow-lg w-full">
          <div className="bg-orange-600 text-white p-2 flex justify-between items-center">
            <h3 className="font-medium text-sm sm:text-base truncate max-w-[70%]">
              {editingPartId 
                ? (items.find(item => item.id === activeServiceId)?.serviceType?.name || "Modifica Ricambio")
                : "Aggiungi Ricambio"}
            </h3>
            <div>
              <button 
                onClick={hidePartForm}
                className="bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
                disabled={isSubmitting}
                aria-label="Chiudi"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
          
          <div className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <Label htmlFor="partCode" className="font-medium text-xs sm:text-sm text-orange-300">Codice*</Label>
                <Input
                  id="partCode"
                  value={partCode}
                  onChange={(e) => setPartCode(e.target.value)}
                  placeholder="Inserisci codice"
                  className="h-8 sm:h-10 text-sm bg-gray-900 border-gray-700 text-white"
                  required
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="partDescription" className="font-medium text-xs sm:text-sm text-orange-300">Descrizione</Label>
                <Input
                  id="partDescription"
                  value={partDescription}
                  onChange={(e) => setPartDescription(e.target.value)}
                  placeholder="Descrizione"
                  className="h-8 sm:h-10 text-sm bg-gray-900 border-gray-700 text-white"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="partBrand" className="font-medium text-xs sm:text-sm text-orange-300">Brand</Label>
                <Input
                  id="partBrand"
                  value={partBrand}
                  onChange={(e) => setPartBrand(e.target.value)}
                  placeholder="Marca (opzionale)"
                  className="h-8 sm:h-10 text-sm bg-gray-900 border-gray-700 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="partQuantity" className="font-medium text-xs sm:text-sm text-orange-300">Quantità</Label>
                  <Input
                    id="partQuantity"
                    type="number"
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(parseFloat(e.target.value) || 1)}
                    className="h-8 sm:h-10 text-sm bg-gray-900 border-gray-700 text-white"
                    min={1}
                    step={1}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="partPrice" className="font-medium text-xs sm:text-sm text-orange-300">Prezzo €</Label>
                  <Input
                    id="partPrice"
                    type="number"
                    value={partPrice}
                    onChange={(e) => setPartPrice(parseFloat(e.target.value) || 0)}
                    className="h-8 sm:h-10 text-sm bg-gray-900 border-gray-700 text-white"
                    min={0}
                    step={0.01}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex flex-row justify-end gap-2 border-t border-gray-800 pt-3">
              <Button 
                variant="outline" 
                onClick={hidePartForm} 
                disabled={isSubmitting}
                className="h-8 text-xs sm:text-sm px-2 sm:px-3 bg-transparent border-gray-600 text-white hover:bg-gray-800"
              >
                Annulla
              </Button>
              <div className="flex flex-row gap-2">
                <Button 
                  variant="default" 
                  onClick={addPart}
                  disabled={!partCode || isSubmitting}
                  className="h-8 text-xs sm:text-sm px-2 sm:px-3 bg-orange-600 hover:bg-orange-700 relative"
                >
                  {isSubmitting ? (
                    <>
                      <span className="opacity-0">In corso...</span>
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </span>
                    </>
                  ) : (
                    editingPartId ? "Salva" : "Aggiungi"
                  )}
                </Button>
                {!editingPartId && (
                  <Button 
                    variant="default" 
                    onClick={addPartAndClose}
                    disabled={!partCode || isSubmitting}
                    className="h-8 text-xs sm:text-sm px-2 sm:px-3 bg-green-600 hover:bg-green-700 relative"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="opacity-0">In corso...</span>
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </span>
                      </>
                    ) : (
                      "Aggiungi e Chiudi"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto pr-1 pb-20 mb-4 scrollbar-hide">
        {categories.map(category => (
          <div key={category} className="border border-gray-800 rounded-lg overflow-hidden mb-3 bg-black">
            <h3 className="bg-orange-950 text-orange-400 p-2 font-medium sticky top-0 z-10 text-sm sm:text-base">{category}</h3>
            
            <div className="p-2 sm:p-3">
              {categoriesMap[category].map(service => (
                <div key={service.id} className="mb-4 last:mb-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2">
                    <h4 className="font-bold text-orange-500 text-sm sm:text-base">
                      {service.serviceType.name}
                    </h4>
                    <span className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-0">
                      Prezzo base: {formatCurrency(service.serviceType.laborPrice || 0)}
                    </span>
                  </div>
                  
                  {service.parts && service.parts.length > 0 ? (
                    <div className="mb-2">
                      <div className="hidden sm:block">
                        <table className="w-full border-collapse text-xs md:text-sm">
                          <thead>
                            <tr className="bg-orange-950/50 text-left border-b border-gray-800">
                              <th className="p-1 md:p-2 font-medium text-orange-300">Codice</th>
                              <th className="p-1 md:p-2 font-medium text-orange-300">Descrizione</th>
                              <th className="p-1 md:p-2 font-medium text-orange-300">Brand</th>
                              <th className="p-1 md:p-2 font-medium text-orange-300 text-center">Qtà</th>
                              <th className="p-1 md:p-2 font-medium text-orange-300 text-right">Prezzo</th>
                              <th className="p-1 md:p-2 font-medium text-orange-300 text-right">Totale</th>
                              <th className="p-1 md:p-2 w-[80px]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {service.parts.map((part, idx) => (
                              <tr key={part.id} className={`border-b border-gray-800 ${idx % 2 === 0 ? '' : 'bg-gray-900/30'}`}>
                                <td className="p-1 md:p-2">{part.code}</td>
                                <td className="p-1 md:p-2 max-w-[120px] truncate">{part.name}</td>
                                <td className="p-1 md:p-2">{part.brand || "-"}</td>
                                <td className="p-1 md:p-2 text-center">{part.quantity}</td>
                                <td className="p-1 md:p-2 text-right">{formatCurrency(part.unitPrice)}</td>
                                <td className="p-1 md:p-2 text-right font-medium text-orange-400">{formatCurrency(part.finalPrice)}</td>
                                <td className="p-1 md:p-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-orange-500 hover:text-orange-400 hover:bg-transparent"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (e.nativeEvent) {
                                          e.nativeEvent.stopImmediatePropagation();
                                        }
                                        showEditPartForm(service.id, part);
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-transparent"
                                      onClick={() => onRemovePart(service.id, part.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-orange-950/20 border-t border-gray-800 font-medium">
                              <td colSpan={5} className="p-1 md:p-2 text-right">Totale ricambi:</td>
                              <td className="p-1 md:p-2 text-right text-orange-500 font-bold">
                                {formatCurrency(
                                  service.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0)
                                )}
                              </td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="sm:hidden space-y-3 max-h-[40vh] overflow-y-auto scrollbar-hide">
                        {service.parts.map((part, idx) => (
                          <div key={part.id} className={`border border-gray-800 rounded-md p-2 ${idx % 2 === 0 ? 'bg-black' : 'bg-gray-900/30'} text-xs`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-bold truncate max-w-[65%] text-orange-400">{part.code}</div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6 text-orange-500 border border-orange-500 bg-transparent hover:bg-orange-950/30 p-0"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.nativeEvent) {
                                      e.nativeEvent.stopImmediatePropagation();
                                    }
                                    showEditPartForm(service.id, part);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 border border-red-500 bg-transparent hover:bg-red-950/30 p-0"
                                  onClick={() => onRemovePart(service.id, part.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="text-xs mb-1 truncate">{part.name}</div>
                            
                            <div className="grid grid-cols-3 gap-1 text-xs mb-1">
                              <div className="overflow-hidden">
                                <span className="text-gray-400">Brand: </span>
                                <span className="font-medium truncate block">{part.brand || "-"}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Qtà: </span>
                                <span className="font-medium">{part.quantity}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-400">Prezzo: </span>
                                <span className="font-medium">{formatCurrency(part.unitPrice)}</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center border-t border-gray-800 pt-1 mt-1">
                              <span className="font-medium text-gray-300">Totale:</span>
                              <span className="font-bold text-orange-400">{formatCurrency(part.finalPrice)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 px-2 bg-gray-900/30 rounded-lg mb-2 text-xs sm:text-sm">
                      <p className="text-gray-400">Nessun ricambio aggiunto.</p>
                    </div>
                  )}
                  
                  <div className="text-right mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="px-2 py-1 h-7 text-xs border-orange-500 text-orange-500 bg-transparent hover:bg-orange-950/30"
                      onClick={() => showAddPartForm(service.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      <span>Aggiungi ricambio</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Dialog per modificare un ricambio - mantengo il dialogo originale ma con stile migliorato */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (open === false) {
          setIsEditDialogOpen(false);
        }
      }}>
        <DialogContent 
          className="bg-black text-white border-gray-800 overflow-visible max-w-[90vw] sm:max-w-lg p-3 sm:p-5 rounded-lg z-50 scrollbar-hide"
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-gray-800 pb-3 mb-3">
            <DialogTitle className="text-orange-500 text-base sm:text-lg">
              {editingPart && items.find(i => i.id === editingPart.serviceId)?.serviceType?.name ? 
                items.find(i => i.id === editingPart.serviceId)?.serviceType.name : 
                "Modifica Ricambio"}
            </DialogTitle>
            <DialogDescription className="text-gray-400 mt-1 text-xs sm:text-sm">
              {editingPart?.description ? editingPart.description : "Aggiorna i dettagli del ricambio"}
            </DialogDescription>
          </DialogHeader>
          
          {editingPart && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code" className="text-orange-300 text-xs">Codice *</Label>
                <Input
                  id="edit-code"
                  value={editingPart.code}
                  onChange={(e) => setEditingPart({ ...editingPart, code: e.target.value })}
                  placeholder="Codice ricambio"
                  className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-orange-300 text-xs">Descrizione</Label>
                <Input
                  id="edit-description"
                  value={editingPart.description}
                  onChange={(e) => setEditingPart({ ...editingPart, description: e.target.value })}
                  placeholder="Descrizione ricambio"
                  className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-brand" className="text-orange-300 text-xs">Brand</Label>
                <Input
                  id="edit-brand"
                  value={editingPart.brand}
                  onChange={(e) => setEditingPart({ ...editingPart, brand: e.target.value })}
                  placeholder="Brand/Marca"
                  className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity" className="text-orange-300 text-xs">Quantità *</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    min="1"
                    value={editingPart.quantity}
                    onChange={(e) => setEditingPart({ ...editingPart, quantity: e.target.value })}
                    className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-unitPrice" className="text-orange-300 text-xs">Prezzo Un. *</Label>
                  <Input
                    id="edit-unitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingPart.unitPrice}
                    onChange={(e) => setEditingPart({ ...editingPart, unitPrice: e.target.value })}
                    className="bg-gray-900 border-gray-700 text-white h-8 text-sm"
                    required
                  />
                </div>
              </div>
              
              <div className="col-span-1 sm:col-span-2 bg-gray-900 p-3 rounded-md border border-gray-700">
                <div className="text-orange-300 font-semibold mb-1 text-xs">Totale ricambio:</div>
                <div className="text-base sm:text-lg font-bold text-orange-500">
                  {(Number(editingPart.unitPrice) * Number(editingPart.quantity)).toFixed(2)} €
              </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-row justify-end gap-2 pt-2 border-t border-gray-800">
            <Button 
              variant="outline"
              className="bg-transparent border-gray-600 text-white hover:bg-gray-800 h-8 text-xs sm:text-sm px-3"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditDialogOpen(false);
              }}
            >
              Annulla
            </Button>
            <Button 
              type="button" 
              className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs sm:text-sm px-3"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                saveEditPart();
              }}
            >
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barra di navigazione fissa in basso con indicatore di passaggio */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 py-2 px-3 flex justify-between items-center z-30">
        <Button
          variant="outline"
          onClick={() => {
            if (onPrevStep) {
              onPrevStep();
            }
          }}
          className="border-orange-500 text-orange-500 hover:bg-orange-950/30 h-8 text-xs sm:text-sm bg-transparent"
          disabled={!onPrevStep}
        >
          ← Indietro
        </Button>
        
        <div className="text-center hidden sm:block">
          <div className="text-xs font-medium text-orange-500">
            Passo 3: Ricambi
          </div>
        </div>
        
        <div className="flex gap-2">
          {isNewQuote && (
            <Button 
              variant="outline" 
              onClick={() => {
                if (onPrevStep) {
                  onPrevStep();
                }
              }}
              className="border-orange-500 text-orange-500 hover:bg-orange-950/30 h-8 text-xs sm:text-sm px-2 bg-transparent"
            >
              <Plus className="h-3 w-3 mr-1" /> 
              <span className="hidden sm:inline">Aggiungi Servizi</span>
              <span className="sm:hidden">Servizi</span>
            </Button>
          )}
          
          <Button
            variant="default"
            onClick={() => {
              if (onNextStep) {
                onNextStep();
              }
            }}
            className="bg-orange-600 hover:bg-orange-700 h-8 text-xs sm:text-sm"
            disabled={!onNextStep}
          >
            Avanti →
          </Button>
        </div>
      </div>
    </div>
  );
}