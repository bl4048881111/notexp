import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SparePartFormProps {
  parts: SparePart[];
  onChange: (parts: SparePart[]) => void;
}

export default function SparePartForm({ parts, onChange }: SparePartFormProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [netPrice, setNetPrice] = useState<number>(0);
  const [markupPercentage, setMarkupPercentage] = useState<number>(20);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  
  // Calculate final price based on net price and markup
  useEffect(() => {
    const calculatedPrice = netPrice * (1 + markupPercentage / 100);
    setFinalPrice(parseFloat(calculatedPrice.toFixed(2)));
  }, [netPrice, markupPercentage]);
  
  const handleAddPart = () => {
    if (code.trim() === "" || netPrice <= 0) return;
    
    const newPart: SparePart = {
      id: `part_${Date.now()}`,
      code,
      description,
      netPrice,
      markupPercentage,
      finalPrice
    };
    
    onChange([...parts, newPart]);
    
    // Reset form
    setCode("");
    setDescription("");
    setNetPrice(0);
    setMarkupPercentage(20);
  };
  
  const handleRemovePart = (partId: string) => {
    onChange(parts.filter(part => part.id !== partId));
  };
  
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <Label htmlFor="code">Codice</Label>
          <Input
            id="code"
            placeholder="Codice"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        
        <div className="md:col-span-2">
          <Label htmlFor="description">Descrizione</Label>
          <Input
            id="description"
            placeholder="Descrizione"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="netPrice">Prezzo netto</Label>
          <div className="relative">
            <Input
              id="netPrice"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={netPrice}
              onChange={(e) => setNetPrice(parseFloat(e.target.value) || 0)}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-sm text-muted-foreground">
              €
            </div>
          </div>
        </div>
        
        <div>
          <Label htmlFor="markup">Ricarico (%)</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="markup"
              type="number"
              placeholder="20"
              min="0"
              value={markupPercentage}
              onChange={(e) => setMarkupPercentage(parseFloat(e.target.value) || 0)}
            />
            <div className="text-sm font-semibold bg-background rounded-md px-3 py-2 border border-input">
              {formatCurrency(finalPrice)}
            </div>
          </div>
        </div>
      </div>
      
      <Button type="button" onClick={handleAddPart} variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Aggiungi Pezzo
      </Button>
      
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-2 border-b">
          <h3 className="text-sm font-medium">Pezzi Aggiunti</h3>
        </div>
        <div className="p-4 space-y-2">
          {parts.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              Nessun pezzo aggiunto
            </div>
          ) : (
            <div className="space-y-2">
              {parts.map((part) => (
                <div key={part.id} className="flex items-center justify-between bg-background rounded-md p-2 border">
                  <div className="flex-1">
                    <div className="font-medium flex items-center">
                      <Badge variant="outline" className="mr-2">
                        {part.code}
                      </Badge>
                      {part.description}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(part.netPrice)} + {part.markupPercentage}% = {formatCurrency(part.finalPrice)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemovePart(part.id)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="text-right font-medium pt-2 border-t">
                Totale: {formatCurrency(parts.reduce((sum, part) => sum + part.finalPrice, 0))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}