// Versione STATICA del form ricambi - nessuno stato locale, solo props
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { QuoteItem, SparePart, ServiceType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2, X, Upload, Percent } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { getAllServiceTypes } from "@shared/supabase";
import { v4 as uuidv4 } from "uuid";
import React from "react";

// Definizione servizi predefiniti
const defaultServices: Record<string, Array<{id: string, name: string}>> = {
  "Tagliando": [
    { id: "filtro-aria", name: "Filtro Aria" },
    { id: "filtro-olio", name: "Filtro Olio" },
    { id: "filtro-carburante", name: "Filtro Carburante" },
    { id: "filtro-abitacolo", name: "Filtro Abitacolo" },
    { id: "olio-motore", name: "Olio Motore" },
  ],
  "Frenante": [
    { id: "pastiglie-anteriori", name: "Pastiglie Anteriori" },
    { id: "pastiglie-posteriori", name: "Pastiglie Posteriori" },
    { id: "dischi-anteriori", name: "Dischi Anteriori" },
    { id: "dischi-posteriori", name: "Dischi/Ganasce Posteriori" },
  ],
  "Sospensioni": [
    { id: "ammortizzatori-anteriori", name: "Ammortizzatori Anteriori" },
    { id: "ammortizzatori-posteriori", name: "Ammortizzatori Posteriori" },
    { id: "bracci-sospensione", name: "Bracci Sospensione" },
    { id: "silent-block", name: "Silent Block" },
  ],
  "Accessori": [
    { id: "batteria", name: "Batteria" },
    { id: "spazzole-tergicristallo", name: "Spazzole Tergicristallo" },
    { id: "lampadine", name: "Lampadine" },
    { id: "candele", name: "Candele" },
  ]
};

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
  // Stati per la selezione di categoria e servizio
  const [selectedCategory, setSelectedCategory] = useState<string>("Frenante");
  const [selectedService, setSelectedService] = useState<string>("");
  const [availableServices, setAvailableServices] = useState<Record<string, Array<{id: string, name: string}>>>(defaultServices);
  
  // Stati per il form ricambi
  const [partCode, setPartCode] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [partBrand, setPartBrand] = useState("");
  const [partQuantity, setPartQuantity] = useState<number>(1);
  const [partPrice, setPartPrice] = useState<number>(0);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stato per controllare la visibilità del form
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Ref per il file input CSV
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  
  // Stati per la preview CSV
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [csvPreviewData, setCSVPreviewData] = useState<Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    brand?: string;
    selectedCategory: string;
    selectedService: string;
    margin?: number; // Margine in percentuale
  }>>([]);

  // Stato per il margine globale di default
  const [defaultMargin, setDefaultMargin] = useState<number>(30); // 30% di default

  // Dialog per modifica ricambi esistenti
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

  // Ref per il container del dialog CSV
  const csvDialogRef = useRef<HTMLDivElement | null>(null);

  // Funzione per calcolare il prezzo finale con margine
  const calculateFinalPrice = (unitPrice: number, quantity: number, margin: number = 0): number => {
    const basePrice = unitPrice * quantity;
    return basePrice * (1 + margin / 100);
  };

  // Carica servizi dal database
  useEffect(() => {
    async function loadServices() {
      try {
        const allServiceTypes = await getAllServiceTypes();
        const servicesByCategory = {...defaultServices};
        
        if (allServiceTypes && allServiceTypes.length > 0) {
          // Reset delle categorie
          Object.keys(servicesByCategory).forEach(key => {
            servicesByCategory[key] = [];
          });
          
          // Raggruppa servizi per categoria
          allServiceTypes.forEach(service => {
            if (!servicesByCategory[service.category]) {
              servicesByCategory[service.category] = [];
            }
            servicesByCategory[service.category].push({
              id: service.id,
              name: service.name
            });
          });
        }
        
        // Usa servizi predefiniti per categorie vuote
        Object.keys(servicesByCategory).forEach(key => {
          if (servicesByCategory[key].length === 0) {
            servicesByCategory[key] = defaultServices[key] || [];
          }
        });
        
        setAvailableServices(servicesByCategory);
      } catch (error) {
        setAvailableServices(defaultServices);
      }
    }
    
    loadServices();
  }, []);

  // Aggiorna servizio selezionato quando cambia categoria (ma solo se non stiamo modificando un ricambio)
  useEffect(() => {
    // Non aggiornare automaticamente il servizio se stiamo modificando un ricambio esistente
    if (editingPartId) return;
    
    if (availableServices[selectedCategory]?.length > 0) {
      setSelectedService(availableServices[selectedCategory][0].id);
    }
  }, [selectedCategory, availableServices, editingPartId]);

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
  
  // Funzione per selezionare un servizio
  const selectService = (serviceId: string) => {
    setSelectedService(serviceId);
    
    // Reset del form
    const activeService = items.find(item => item.id === serviceId);
    setPartCode("");
    setPartDescription(activeService ? `Ricambio per ${activeService.serviceType.name}` : "");
    setPartBrand("");
    setPartQuantity(1);
    setPartPrice(0);
    setEditingPartId(null);
  };

  // Servizio selezionato
  const selectedServiceObj = items.find(item => item.id === selectedService);
  
  // Controlla se c'è un serviceId da editare al caricamento
  useEffect(() => {
    const editServiceId = localStorage.getItem('editServiceId');
    if (editServiceId) {
      const serviceExists = items.some(item => item.id === editServiceId);
      
      if (serviceExists && selectedService !== editServiceId) {
        setSelectedService(editServiceId);
        localStorage.removeItem('editServiceId');
      }
    } else if (items.length > 0 && !selectedService) {
      // Imposta solo se non c'è già un servizio selezionato
      setSelectedService(items[0].id);
    }
  }, [items.length]); // Dipendenze ridotte per evitare loop
  
  // Effetto per mostrare automaticamente il form per nuovi preventivi
  useEffect(() => {
    if (isNewQuote && items.length === 0) {
      setShowAddForm(true);
    }
  }, [isNewQuote, items.length]);
  
  // Funzione per aggiungere un ricambio con creazione automatica del servizio
  const addPartWithService = async () => {
    if (!selectedService || !partCode) {
      alert("Seleziona un servizio e inserisci il codice ricambio");
      return;
    }

    setIsSubmitting(true);

    try {
      // Trova il servizio negli availableServices
      const categoryServices = availableServices[selectedCategory];
      const serviceInfo = categoryServices?.find(s => s.id === selectedService);
      
      if (!serviceInfo) {
        throw new Error("Servizio non trovato");
      }

      // Dati del ricambio
      const partData = {
        code: partCode,
        name: partDescription || `Ricambio ${partCode}`,
        brand: partBrand || undefined,
        category: selectedCategory.toLowerCase() || "altro",
        quantity: partQuantity,
        unitPrice: partPrice,
        finalPrice: partPrice * partQuantity
      };

      // Cerca se il servizio esiste già negli items
      const existingServiceIndex = items.findIndex(item => item.serviceType.id === selectedService);
      
      let newItems;
      
      if (editingPartId) {
        // MODALITÀ MODIFICA - gestisce cambio di servizio
        let partFound = false;
        let originalServiceId = null;
        
        // Prima trova dove si trova attualmente il ricambio
        for (const item of items) {
          const partExists = item.parts?.find(p => p.id === editingPartId);
          if (partExists) {
            originalServiceId = item.serviceType.id;
            partFound = true;
            break;
          }
        }
        
        if (!partFound) {
          throw new Error("Ricambio da modificare non trovato");
        }
        
        // Se il servizio è cambiato, rimuovi dal vecchio e aggiungi al nuovo
        if (originalServiceId !== selectedService) {
          // Rimuovi dal servizio originale
          newItems = items.map(item => {
            if (item.serviceType.id === originalServiceId) {
              const updatedParts = item.parts?.filter(p => p.id !== editingPartId) || [];
              const totalPrice = updatedParts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) + item.laborPrice;
              
              return {
                ...item,
                parts: updatedParts,
                totalPrice
              };
            }
            return item;
          });
          
          // Trova o crea il nuovo servizio
          const newServiceIndex = newItems.findIndex(item => item.serviceType.id === selectedService);
          
          if (newServiceIndex === -1) {
            // Il nuovo servizio non esiste, crealo
            const newPart = {
              ...partData,
              id: editingPartId, // Mantieni lo stesso ID
            };
            
            const newService: QuoteItem = {
              id: uuidv4(),
              serviceType: {
                id: selectedService,
                name: serviceInfo.name,
                category: selectedCategory as any,
                description: `${selectedCategory} - ${serviceInfo.name}`,
                laborPrice: 35
              },
              laborPrice: 35,
              laborHours: 1,
              parts: [newPart],
              notes: "",
              totalPrice: newPart.finalPrice + 35
            };
            
            newItems = [...newItems, newService];
          } else {
            // Il nuovo servizio esiste, aggiungi il ricambio modificato
            newItems = newItems.map((item, index) => {
              if (index === newServiceIndex) {
                const newPart = {
                  ...partData,
                  id: editingPartId, // Mantieni lo stesso ID
                };
                
                const parts = Array.isArray(item.parts) ? [...item.parts, newPart] : [newPart];
                const totalPrice = parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) + item.laborPrice;
                
                return {
                  ...item,
                  parts,
                  totalPrice
                };
              }
              return item;
            });
          }
        } else {
          // Il servizio non è cambiato, modifica solo i dati del ricambio
          newItems = items.map(item => {
            if (item.serviceType.id === selectedService) {
              const updatedParts = item.parts?.map(part => {
                if (part.id === editingPartId) {
                  return {
                    ...part,
                    ...partData,
                    id: editingPartId,
                  };
                }
                return part;
              }) || [];
              
              const totalPrice = updatedParts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) + item.laborPrice;
              
              return {
                ...item,
                parts: updatedParts,
                totalPrice
              };
            }
            return item;
          });
        }
      } else if (existingServiceIndex === -1) {
        // MODALITÀ AGGIUNTA - il servizio non esiste, crealo
        const newPart = {
          ...partData,
          id: uuidv4(),
        };
        
        const newService: QuoteItem = {
          id: uuidv4(),
          serviceType: {
            id: selectedService,
            name: serviceInfo.name,
            category: selectedCategory as any,
            description: `${selectedCategory} - ${serviceInfo.name}`,
            laborPrice: 35
          },
          laborPrice: 35,
          laborHours: 1,
          parts: [newPart],
          notes: "",
          totalPrice: newPart.finalPrice + 35
        };
        
        // Aggiungi il nuovo servizio agli items esistenti
        newItems = [...items, newService];
      } else {
        // MODALITÀ AGGIUNTA - il servizio esiste già, aggiungi solo il ricambio
        newItems = items.map((item, index) => {
          if (index === existingServiceIndex) {
            const newPart = {
              ...partData,
              id: uuidv4(),
            };
            
            const parts = Array.isArray(item.parts) ? [...item.parts, newPart] : [newPart];
            const totalPrice = parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) + item.laborPrice;
            
            return {
              ...item,
              parts,
              totalPrice
            };
          }
          return item;
        });
      }
      
      // Rimuovi servizi vuoti (senza ricambi)
      const itemsWithoutEmpty = newItems.filter(item => 
        Array.isArray(item.parts) && item.parts.length > 0
      );
      
      if (onUpdateItems) {
        onUpdateItems(itemsWithoutEmpty);
      }

      // Reset del form
      setPartCode("");
      setPartDescription("");
      setPartBrand("");
      setPartQuantity(1);
      setPartPrice(0);
      setEditingPartId(null);
      
      // Chiudi il form dopo aver salvato
      setShowAddForm(false);

    } catch (error) {
      alert("Si è verificato un errore. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Funzione per modificare un ricambio esistente
  const editPart = (part: SparePart, serviceId: string) => {
    // Trova il servizio a cui appartiene il ricambio
    const service = items.find(item => item.id === serviceId);
    if (service) {
      // Imposta categoria e servizio per la modifica
      setSelectedCategory(service.serviceType.category);
      setSelectedService(service.serviceType.id);
    }
    
    // Popola il form con i dati del ricambio
    setPartCode(part.code || "");
    setPartDescription(part.name || "");
    setPartBrand(part.brand || "");
    setPartQuantity(part.quantity || 1);
    setPartPrice(part.unitPrice || 0);
    setEditingPartId(part.id);
    
    // Apri il form
    setShowAddForm(true);
  };

  // Funzione per aprire il form di aggiunta
  const openAddForm = () => {
    // Reset del form
    const activeService = items.find(item => item.id === selectedService);
    setPartCode("");
    setPartDescription(activeService ? `Ricambio per ${activeService.serviceType.name}` : "");
    setPartBrand("");
    setPartQuantity(1);
    setPartPrice(0);
    setEditingPartId(null);
    setShowAddForm(true);
  };

  // Funzione per chiudere il form
  const closeAddForm = () => {
    setShowAddForm(false);
    setEditingPartId(null);
    // Reset del form
    const activeService = items.find(item => item.id === selectedService);
    setPartCode("");
    setPartDescription(activeService ? `Ricambio per ${activeService.serviceType.name}` : "");
    setPartBrand("");
    setPartQuantity(1);
    setPartPrice(0);
  };

  // Funzione per gestire il caricamento del file CSV
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verifica che sia un file CSV
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Per favore seleziona un file CSV valido');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        alert('Il file CSV è vuoto');
        return;
      }

      // Parsing delle righe CSV (colonne 5=CODICE, 6=DESCRIZIONE, 7=QTA, 8=PREZZO)
      const partsToAdd: Array<{
        code: string;
        description: string;
        quantity: number;
        unitPrice: number;
      }> = [];

      // Salta la prima riga (header) e inizia dalla seconda
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Prova diversi separatori
        let columns = [];
        if (line.includes(';')) {
          // Usa punto e virgola come separatore
          columns = line.split(';').map(col => col.trim().replace(/"/g, ''));
        } else {
          // Usa virgola come separatore
          columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        }
        
        // Controlla che ci siano almeno 8 colonne
        if (columns.length < 8) {
          continue;
        }
        
        const code = columns[4]; // Colonna 5 (indice 4)
        const description = columns[5]; // Colonna 6 (indice 5)
        const quantityStr = columns[6]; // Colonna 7 (indice 6)
        const priceStr = columns[7]; // Colonna 8 (indice 7)
        
        // Valida i dati
        if (!code || !description) {
          continue;
        }
        
        const quantity = parseFloat(quantityStr.replace(',', '.')) || 1;
        const unitPrice = parseFloat(priceStr.replace(',', '.')) || 0;
        
        partsToAdd.push({
          code,
          description,
          quantity,
          unitPrice
        });
      }

      if (partsToAdd.length === 0) {
        alert(`Nessun ricambio valido trovato nel file CSV. 
        
Debug info:
- Righe totali: ${lines.length}
- Formato esempio prima riga dati: ${lines[1] || 'N/A'}

Verifica che:
1. I dati siano nelle colonne 5 (CODICE), 6 (DESCRIZIONE), 7 (QUANTITÀ), 8 (PREZZO)
2. Il file usi virgole (,) o punto e virgola (;) come separatori
3. Non ci siano righe vuote tra i dati`);
        return;
      }

      // Prepara i dati per la preview con valori di default
      const previewData = partsToAdd.map(part => ({
        code: part.code,
        description: part.description,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        brand: "", // Campo vuoto da compilare
        selectedCategory: "Accessori", // Default sempre Accessori
        selectedService: "altro", // Default sempre altro
        margin: defaultMargin // Margine di default
      }));

      setCSVPreviewData(previewData);
      setShowCSVPreview(true);
      
    } catch (error) {
      alert('Errore durante l\'importazione del file CSV. Verifica il formato del file.');
    } finally {
      setIsSubmitting(false);
      // Reset del file input
      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = '';
      }
    }
  };

  // Funzione per aprire il dialog di selezione file CSV
  const openCSVUpload = () => {
    csvFileInputRef.current?.click();
  };

  // Funzione per confermare l'importazione CSV dopo la preview
  const confirmCSVImport = async () => {
    try {
      setIsSubmitting(true);

      // Crea i nuovi items
      const newItems: QuoteItem[] = [...items];
      
      // Raggruppa i ricambi per servizio ma mantieni ogni ricambio separato
      const serviceMap = new Map<string, QuoteItem>();
      
      for (const partData of csvPreviewData) {
        const serviceKey = `${partData.selectedCategory}:${partData.selectedService}`;
        
        // Trova o crea il servizio per questo gruppo
        let targetService = serviceMap.get(serviceKey);
        
        if (!targetService) {
          // Cerca se il servizio esiste già negli items esistenti
          targetService = newItems.find(item => item.serviceType.id === partData.selectedService);
          
          if (!targetService) {
            // Crea il servizio se non esiste
            const serviceInfo = availableServices[partData.selectedCategory]?.find(s => s.id === partData.selectedService) || 
                              { id: partData.selectedService, name: `Ricambi ${partData.selectedCategory}` };
            
            targetService = {
              id: uuidv4(),
              serviceType: {
                id: serviceInfo.id,
                name: serviceInfo.name,
                category: partData.selectedCategory as any,
                description: `${partData.selectedCategory} - ${serviceInfo.name}`,
                laborPrice: 0
              },
              laborPrice: 0,
              laborHours: 0,
              parts: [],
              totalPrice: 0,
              notes: "Servizio creato dall'importazione CSV"
            };
            
            newItems.push(targetService);
          }
          
          serviceMap.set(serviceKey, targetService);
        }

        // Calcola il prezzo finale con margine
        const finalPrice = calculateFinalPrice(partData.unitPrice, partData.quantity, partData.margin === -1 ? 30 : (partData.margin || 30));
        
        // Crea il ricambio SEPARATO
        const newPart = {
          id: uuidv4(),
          code: partData.code,
          name: partData.description,
          brand: partData.brand || undefined,
          category: partData.selectedCategory.toLowerCase() || "altro",
          quantity: partData.quantity,
          unitPrice: partData.unitPrice,
          finalPrice: parseFloat(finalPrice.toFixed(2))
        };

        // Aggiungi il ricambio al servizio
        if (!targetService.parts) {
          targetService.parts = [];
        }
        targetService.parts.push(newPart);
      }

      // Ricalcola i prezzi totali per tutti i servizi modificati
      serviceMap.forEach((service) => {
        const totalPartsPrice = service.parts?.reduce((sum, part) => sum + (part.finalPrice || 0), 0) || 0;
        service.totalPrice = totalPartsPrice + service.laborPrice;
      });

      // Chiudi PRIMA il dialog CSV
      setShowCSVPreview(false);
      setCSVPreviewData([]);
      
      // Aggiorna gli items
      if (onUpdateItems) {
        onUpdateItems(newItems);
      }
      
    } catch (error) {
      alert('Errore durante l\'importazione. Riprova.');
      
      // In caso di errore, apri il form manuale
      setShowCSVPreview(false);
      setCSVPreviewData([]);
      setShowAddForm(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Funzione per aggiornare un item nella preview
  const updatePreviewItem = (index: number, field: string, value: string | number | undefined) => {
    const updated = [...csvPreviewData];
    const currentItem = updated[index];
    
    // Gestione tipizzata per ogni campo
    if (field === 'margin') {
      updated[index] = { 
        ...currentItem, 
        margin: value === -1 ? -1 : (typeof value === 'number' ? value : parseFloat(value as string) || -1)
      };
    } else if (field === 'brand') {
      updated[index] = { 
        ...currentItem, 
        brand: value as string 
      };
    } else if (field === 'selectedCategory') {
      updated[index] = { 
        ...currentItem, 
        selectedCategory: value as string,
        selectedService: "altro" // Reset servizio quando cambia categoria
      };
    } else if (field === 'selectedService') {
      updated[index] = { 
        ...currentItem, 
        selectedService: value as string 
      };
    }
    
    setCSVPreviewData(updated);
  };

  return (
    <>
      {/* Dialog CSV Preview - VERSIONE REACT SEMPLICE */}
      {showCSVPreview && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-2">
          <div className="bg-gray-900 border border-gray-600 rounded-lg w-[95vw] h-[90vh] flex flex-col text-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-600 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Anteprima Importazione CSV</h2>
                <p className="text-gray-300 text-sm">Verifica e modifica i dati dei ricambi prima dell'importazione.</p>
              </div>
              <button
                onClick={() => {
                  setShowCSVPreview(false);
                  setCSVPreviewData([]);
                  setShowAddForm(true);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content */}
            <div 
              className="flex-1 p-4 overflow-y-auto [&::-webkit-scrollbar]:hidden"
              style={{
                scrollbarWidth: 'none', /* Firefox */
                msOverflowStyle: 'none', /* Internet Explorer 10+ */
              }}
            >
              <div className="space-y-4">
                {csvPreviewData.map((item, index) => (
                  <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {/* Codice */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Codice</label>
                        <Input value={item.code} readOnly className="bg-gray-700 border-gray-600 text-gray-300" />
                      </div>
                      
                      {/* Descrizione - span 2 colonne */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-300 mb-1">Descrizione</label>
                        <Input value={item.description} readOnly className="bg-gray-700 border-gray-600 text-gray-300" />
                      </div>
                      
                      {/* Brand */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Brand</label>
                        <Input 
                          value={item.brand || ''} 
                          onChange={(e) => updatePreviewItem(index, 'brand', e.target.value)}
                          placeholder="es. Bosch..."
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      
                      {/* Categoria */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Categoria</label>
                        <select 
                          value={item.selectedCategory}
                          onChange={(e) => updatePreviewItem(index, 'selectedCategory', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          {Object.keys(availableServices).map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Servizio */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Servizio</label>
                        <select 
                          value={item.selectedService}
                          onChange={(e) => updatePreviewItem(index, 'selectedService', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        >
                          {(availableServices[item.selectedCategory] || []).map(service => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Quantità */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Q.tà</label>
                        <Input value={item.quantity.toString()} readOnly className="bg-gray-700 border-gray-600 text-gray-300" />
                      </div>
                      
                      {/* Prezzo unitario */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Prezzo unitario €</label>
                        <Input value={item.unitPrice.toFixed(2)} readOnly className="bg-gray-700 border-gray-600 text-gray-300" />
                      </div>
                      
                      {/* Margine */}
                      <div>
                        <label className="block text-xs font-medium text-orange-400 mb-1">Margine %</label>
                        <Input 
                          type="number" 
                          value={item.margin !== undefined && item.margin !== -1 ? item.margin : ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Permetti campo vuoto durante la digitazione
                            if (value === '') {
                              updatePreviewItem(index, 'margin', -1); // -1 = campo vuoto
                            } else {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                updatePreviewItem(index, 'margin', numValue);
                              }
                            }
                          }}
                          min={0}
                          max={100}
                          placeholder="30"
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      
                      {/* Prezzo finale */}
                      <div>
                        <label className="block text-xs font-medium text-orange-400 mb-1">Finale €</label>
                        <Input 
                          value={calculateFinalPrice(item.unitPrice, item.quantity, item.margin === -1 ? 30 : (item.margin || 30)).toFixed(2)} 
                          readOnly 
                          className="bg-orange-900 border-orange-600 text-orange-200 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-600 flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCSVPreview(false);
                  setCSVPreviewData([]);
                  setShowAddForm(true);
                }}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Annulla
              </Button>
              <Button
                onClick={confirmCSVImport}
                disabled={isSubmitting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Importando...
                  </>
                ) : (
                  `Conferma (${csvPreviewData.length} ricambi)`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contenuto principale */}
      <div className="space-y-6 bg-gray-900 text-white p-4 pb-20">
        {/* Input file nascosto per CSV */}
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVUpload}
          style={{ display: 'none' }}
        />
        
        {/* Form selezione servizio e ricambi */}
        <div className="space-y-6">
          {/* Form aggiunta ricambio - CONDIZIONALE */}
          {showAddForm && (
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4" data-form="add-parts">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  {editingPartId ? "Modifica Ricambio" : "Nuovo Ricambio"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingPartId(null);
                    // Reset del form
                    setPartCode("");
                    setPartDescription("");
                    setPartBrand("");
                    setPartQuantity(1);
                    setPartPrice(0);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Chiudi form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              {/* Select categoria e servizio - SOLO quando si aggiunge/modifica ricambio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Categoria Servizio <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  >
                    {Object.keys(availableServices).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Servizio Specifico <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  >
                    {availableServices[selectedCategory]?.map(service => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Codice Ricambio <span className="text-red-400">*</span>
                  </label>
                  <input
                    placeholder="es. BR001, FL123..."
                    value={partCode}
                    onChange={(e) => setPartCode(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Descrizione</label>
                  <input
                    placeholder="Descrizione del ricambio"
                    value={partDescription}
                    onChange={(e) => setPartDescription(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Marca (opzionale)</label>
                  <input
                    placeholder="es. Bosch, Brembo..."
                    value={partBrand}
                    onChange={(e) => setPartBrand(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Quantità</label>
                    <input
                      type="number"
                      value={partQuantity}
                      onChange={(e) => setPartQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                      min={1}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Prezzo unitario €</label>
                    <input
                      type="number"
                      value={partPrice}
                      onChange={(e) => setPartPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                      step={0.01}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              {/* Pulsante azione */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addPartWithService}
                  disabled={!partCode || !selectedService || isSubmitting}
                  className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded font-medium transition-all duration-200 shadow-lg hover:shadow-orange-500/25 disabled:shadow-none flex items-center gap-2 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      {editingPartId ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {editingPartId ? "Salva Modifiche" : "Aggiungi Ricambio"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Ricambi aggiunti */}
          {items.length > 0 && (
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-white flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                  Ricambi Aggiunti
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    {items.reduce((total, item) => total + (item.parts?.length || 0), 0)} ricambi
                  </span>
                  <button
                    type="button"
                    onClick={openCSVUpload}
                    disabled={isSubmitting}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-xs flex items-center gap-1 transition-colors"
                    title="Carica ricambi da file CSV"
                  >
                    <Upload className="h-3 w-3" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center gap-1 transition-colors"
                    title="Aggiungi nuovo ricambio"
                  >
                    <Plus className="h-3 w-3" />
                    Aggiungi
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((service) => (
                  <div key={service.id}>
                    <div className="font-medium text-white mb-1.5 text-sm">{service.serviceType.name}</div>
                    {service.parts?.map((part) => (
                      <div key={part.id} className="flex justify-between items-center p-2 bg-gray-800/70 rounded border border-gray-600/50 ml-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-orange-300 bg-orange-900/30 px-1.5 py-0.5 rounded">
                              {part.code}
                            </span>
                            <span className="text-white text-xs font-medium truncate">{part.name}</span>
                            {part.brand && (
                              <span className="text-xs text-gray-400">• {part.brand}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-2">
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Q.tà {part.quantity}</div>
                            <div className="font-bold text-orange-400 text-xs">{formatCurrency(part.finalPrice)}</div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                editPart(part, service.id);
                              }}
                              type="button"
                              className="p-1 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                              title="Modifica ricambio"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemovePart(service.id, part.id);
                              }}
                              type="button"
                              className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Rimuovi ricambio"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Messaggio quando non ci sono ricambi e il form non è visibile */}
          {items.length === 0 && !showAddForm && (
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-6 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <h3 className="font-medium text-white mb-2">Nessun ricambio aggiunto</h3>
                <p className="text-sm text-gray-400 mb-4">Inizia ad aggiungere ricambi e servizi per il preventivo</p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={openCSVUpload}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-blue-500/25 disabled:shadow-none"
                >
                  <Upload className="h-4 w-4" />
                  Carica da CSV
                </button>
                <button
                  type="button"
                  onClick={openAddForm}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-orange-500/25 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi Primo Ricambio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}