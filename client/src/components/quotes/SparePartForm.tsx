import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Plus, Trash, Edit } from "lucide-react";

interface SparePartFormProps {
  parts: SparePart[];
  onChange: (parts: SparePart[]) => void;
  serviceName?: string; // Nome del servizio che si sta modificando
  editingPart?: SparePart | null; // Parte che si sta modificando
}

export default function SparePartForm({ 
  parts, 
  onChange, 
  serviceName,
  editingPart = null 
}: SparePartFormProps) {
  const [code, setCode] = useState(editingPart?.code || "");
  const [brand, setBrand] = useState(editingPart?.brand || "");
  const [description, setDescription] = useState(editingPart?.description || "");
  const [price, setPrice] = useState<number | string>(editingPart?.unitPrice || "");
  const [quantity, setQuantity] = useState<number>(editingPart?.quantity || 1);
  const [activeCategory, setActiveCategory] = useState<string>(editingPart?.category || "tagliando");
  const [finalPrice, setFinalPrice] = useState<number>(editingPart?.finalPrice || 0);
  
  // All'inizializzazione, verifica e correggi i prezzi finali di tutti i ricambi
  useEffect(() => {
    if (parts.length > 0) {
      // console.log("Verifica prezzi ricambi esistenti:", parts.length, "ricambi trovati");
      
      // Controlla se ci sono ricambi con prezzi finali non validi
      const partsWithInvalidPrices = parts.filter(part => 
        !part.finalPrice || 
        part.finalPrice <= 0 || 
        part.finalPrice !== (part.unitPrice || 0) * (part.quantity || 1)
      );
      
      if (partsWithInvalidPrices.length > 0) {
        // console.log("Trovati", partsWithInvalidPrices.length, "ricambi con prezzi non validi");
        
        // Correggi i prezzi finali
        const correctedParts = parts.map(part => {
          const unitPrice = part.unitPrice || 0;
          const quantity = part.quantity || 1;
          const expectedFinalPrice = unitPrice * quantity;
          
          // Se il prezzo finale non è corretto, correggilo
          if (!part.finalPrice || part.finalPrice !== expectedFinalPrice) {
            // console.log(`Correzione prezzo per ${part.code || part.name}:`, {
            //   unitPrice: unitPrice,
            //   quantity: quantity,
            //   finalPriceAttuale: part.finalPrice || 0,
            //   finalPriceCorretto: expectedFinalPrice
            // });
            
            return {
              ...part,
              finalPrice: expectedFinalPrice
            };
          }
          
          return part;
        });
        
        // Aggiorna i ricambi con i prezzi corretti
        onChange(correctedParts);
      } else {
        // console.log("Tutti i ricambi hanno prezzi finali corretti");
      }
    }
  }, [parts]); // Esegui solo all'inizializzazione o quando cambiano i ricambi

  // Aggiorno il prezzo finale quando cambiano prezzo o quantità
  useEffect(() => {
    const priceNum = typeof price === "string" ? parseFloat(price) : price || 0;
    if (!isNaN(priceNum)) {
      setFinalPrice(priceNum * quantity);
    }
  }, [price, quantity]);
  
  // Raggruppa i ricambi per categoria
  const partsByCategory = parts.reduce((acc, part) => {
    const category = part.category || "altro";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(part);
    return acc;
  }, {} as Record<string, SparePart[]>);
  
  // Tutte le categorie usate nei ricambi, più quelle predefinite
  const categories = [
    ...Object.keys(partsByCategory),
    "tagliando", "frenante", "sospensioni", "accessori", "altro"
  ];
  const allCategories = Array.from(new Set(categories));
  
  const handleAddPart = () => {
    if (!code || !price) return;
    
    const priceNum = typeof price === "string" ? parseFloat(price) : price || 0;
    if (isNaN(priceNum)) {
      // console.error("Prezzo non valido:", price);
      return;
    }
    
    // Assicuriamoci che finalPrice sia calcolato correttamente
    const calculatedFinalPrice = priceNum * quantity;
    
    if (editingPart) {
      // Modifica una parte esistente
      const updatedParts = parts.map(part => {
        if (part.id === editingPart.id) {
          const updatedPart = {
            ...part,
            code,
            name: description || code,
            description: description || undefined,
            brand: brand || undefined,
            category: activeCategory,
            unitPrice: priceNum,
            quantity,
            finalPrice: calculatedFinalPrice
          };
          
          // console.log("Ricambio aggiornato:", {
          //   codice: updatedPart.code,
          //   prezzo: updatedPart.unitPrice,
          //   quantità: updatedPart.quantity,
          //   totale: updatedPart.finalPrice
          // });
          
          return updatedPart;
        }
        return part;
      });
      
      onChange(updatedParts);
    } else {
      // Aggiunge una nuova parte
      const newPart: SparePart = {
        id: uuidv4(),
        name: description || code, // Se non c'è descrizione, usa il codice come nome
        code,
        description: description || undefined,
        brand: brand || undefined,
        category: activeCategory,
        unitPrice: priceNum,
        quantity,
        finalPrice: calculatedFinalPrice
      };
      
      // Mostra un log per debug
      // console.log("Nuovo ricambio aggiunto:", {
      //   codice: newPart.code,
      //   prezzo: newPart.unitPrice,
      //   quantità: newPart.quantity,
      //   totale: newPart.finalPrice
      // });
      
      onChange([...parts, newPart]);
    }
    
    // Resetta i campi
    setCode("");
    setBrand("");
    setDescription("");
    setPrice("");
    setQuantity(1);
    setFinalPrice(0);
  };
  
  const handleRemovePart = (id: string) => {
    onChange(parts.filter(part => part.id !== id));
  };
  
  const handleEditPart = (part: SparePart) => {
    setCode(part.code || "");
    setBrand(part.brand || "");
    setDescription(part.description || part.name || "");
    setPrice(part.unitPrice || 0);
    setQuantity(part.quantity || 1);
    setActiveCategory(part.category || "altro");
    setFinalPrice(part.finalPrice || 0);
    
    // Verifica se il prezzo finale è corretto
    const expectedFinalPrice = (part.unitPrice || 0) * (part.quantity || 1);
    if (part.finalPrice !== expectedFinalPrice) {
      // console.warn(`Ricambio ${part.code} ha un prezzo finale non corretto:`, {
      //   unitPrice: part.unitPrice,
      //   quantity: part.quantity,
      //   finalPrice: part.finalPrice,
      //   expectedFinalPrice: expectedFinalPrice
      // });
    }
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  // Calcola il totale di tutti i ricambi
  const totalPartsPrice = parts.reduce((total, part) => {
    return total + (part.finalPrice || 0);
  }, 0);
  
  return (
    <div className="space-y-4">
      {/* Titolo principale con nome del servizio */}
      {serviceName && (
        <div className="mb-4 border-b pb-2">
          <h2 className="text-xl font-bold text-primary">
            {serviceName}
            {editingPart && (
              <span className="ml-2 text-orange-500">
                → {editingPart.description || editingPart.name || editingPart.code}
              </span>
            )}
          </h2>
        </div>
      )}
      
      {/* Selezione categoria */}
      <div className="mb-4">
        <Label htmlFor="category" className="mb-2 block">Categoria</Label>
        <TabsList className="w-full">
          {allCategories.map((category) => (
            <TabsTrigger 
              key={category} 
              value={category}
              onClick={() => setActiveCategory(category)}
              className={activeCategory === category ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" : ""}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      
      {/* Form di inserimento */}
      <div className="p-4 border rounded-md bg-card">
        <h3 className="text-lg font-medium mb-4">
          {editingPart ? (
            <span className="text-primary">{serviceName || activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}</span>
          ) : (
            <span className="text-primary">{activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}</span>
          )}
          {editingPart ? (
            <span> - {editingPart.description || editingPart.name || editingPart.code}</span>
          ) : (
            serviceName ? ` - ${serviceName}` : " - Inserimento articolo"
          )}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label htmlFor="code" className="text-primary font-medium">Codice Articolo*</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Codice articolo"
              autoFocus
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="price" className="text-primary font-medium">Prezzo Unitario*</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder="0.00"
                min={0}
                step={0.01}
              />
              <span>€</span>
            </div>
          </div>
          
          <div>
            <Label htmlFor="quantity" className="text-primary font-medium">Quantità*</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              placeholder="1"
              min={1}
              max={100}
              className="mt-1"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label htmlFor="description">Descrizione (opzionale)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrizione dell'articolo"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="brand">Brand (opzionale)</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Marca dell'articolo"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="finalPrice" className="text-primary font-medium">Prezzo Totale</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input
                id="finalPrice"
                value={finalPrice.toFixed(2)}
                readOnly
                className="mt-1 bg-muted"
              />
              <span>€</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button 
            type="button" 
            onClick={handleAddPart}
            disabled={!code || !price || isNaN(Number(price))}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {editingPart ? "Aggiorna Ricambio" : "Aggiungi Ricambio"}
          </Button>
        </div>
      </div>
      
      {/* Tabelle dei ricambi per categoria */}
      <Tabs defaultValue={Object.keys(partsByCategory)[0] || activeCategory}>
        <TabsList className="w-full mb-4">
          {Object.keys(partsByCategory).map((category) => (
            <TabsTrigger key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {Object.entries(partsByCategory).map(([category, categoryParts]) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="border rounded-md overflow-hidden">
              <div className="bg-secondary p-2">
                <h3 className="font-medium">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  <span className="ml-2 text-sm text-muted-foreground">({categoryParts.length} articoli)</span>
                </h3>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Codice</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Prezzo</TableHead>
                    <TableHead className="text-right">Qt.</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryParts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.code}</TableCell>
                      <TableCell>{part.description || part.name}</TableCell>
                      <TableCell>{part.brand || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(part.unitPrice || 0)}</TableCell>
                      <TableCell className="text-right">{part.quantity}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(part.finalPrice || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPart(part)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePart(part.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Mostra il totale di tutti i ricambi */}
      {parts.length > 0 && (
        <div className="bg-primary/10 p-4 rounded-md mt-4">
          <div className="flex justify-between items-center">
            <span className="font-bold">Totale ricambi:</span>
            <span className="font-bold text-primary text-lg">{formatCurrency(totalPartsPrice)}</span>
          </div>
        </div>
      )}
    </div>
  );
}