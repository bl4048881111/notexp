import { useState } from "react";
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
import { Plus, Trash } from "lucide-react";

interface SparePartFormProps {
  parts: SparePart[];
  onChange: (parts: SparePart[]) => void;
}

export default function SparePartForm({ parts, onChange }: SparePartFormProps) {
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [activeCategory, setActiveCategory] = useState<string>("tagliando");
  
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
    const finalPrice = priceNum * quantity;
    
    const newPart: SparePart = {
      id: uuidv4(),
      name: description || code, // Se non c'è descrizione, usa il codice come nome
      code,
      description: description || undefined,
      brand: brand || undefined,
      category: activeCategory,
      unitPrice: priceNum,
      quantity,
      finalPrice
    };
    
    onChange([...parts, newPart]);
    
    // Resetta i campi
    setCode("");
    setBrand("");
    setDescription("");
    setPrice("");
    setQuantity(1);
  };
  
  const handleRemovePart = (id: string) => {
    onChange(parts.filter(part => part.id !== id));
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  return (
    <div className="space-y-4">
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
        <h3 className="text-lg font-medium mb-4">Aggiungi ricambio - {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="code">Codice Articolo*</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Codice ricambio"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand (opzionale)"
              className="mt-1"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="price">Prezzo*</Label>
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
            <Label htmlFor="quantity">Quantità*</Label>
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
        
        <div className="mb-4">
          <Label htmlFor="description">Descrizione</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione (opzionale)"
            className="mt-1"
          />
        </div>
        
        <div className="flex justify-end">
          <Button 
            type="button" 
            onClick={handleAddPart}
            className="gap-1"
            disabled={!code || !price}
          >
            <Plus size={16} />
            <span>Aggiungi</span>
          </Button>
        </div>
      </div>
      
      {/* Visualizzazione dei ricambi per categoria */}
      <div className="mt-6">
        <Tabs defaultValue={allCategories[0]}>
          <TabsList className="mb-4">
            {allCategories.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)} 
                {partsByCategory[category]?.length ? ` (${partsByCategory[category].length})` : ''}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {allCategories.map((category) => (
            <TabsContent key={category} value={category} className="space-y-4">
              {partsByCategory[category]?.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Codice</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead className="text-right">Quantità</TableHead>
                        <TableHead className="text-right">Prezzo Unit.</TableHead>
                        <TableHead className="text-right">Totale</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partsByCategory[category].map((part) => (
                        <TableRow key={part.id}>
                          <TableCell>{part.code}</TableCell>
                          <TableCell>{part.description || "-"}</TableCell>
                          <TableCell>{part.brand || "-"}</TableCell>
                          <TableCell className="text-right">{part.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(part.unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(part.finalPrice)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePart(part.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash size={16} className="text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={5} className="text-right font-medium">
                          Totale {category.charAt(0).toUpperCase() + category.slice(1)}:
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(partsByCategory[category]?.reduce((sum, part) => sum + part.finalPrice, 0) || 0)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground border rounded-md">
                  <p>Nessun ricambio nella categoria {category}</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        
        {parts.length > 0 && (
          <div className="mt-6 p-4 border rounded-md bg-muted/20">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Totale Ricambi:</span>
              <span className="text-xl font-bold">
                {formatCurrency(parts.reduce((sum, part) => sum + part.finalPrice, 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}