import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash } from "lucide-react";

interface SparePartFormProps {
  parts: SparePart[];
  onChange: (parts: SparePart[]) => void;
}

export default function SparePartForm({ parts, onChange }: SparePartFormProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [netPrice, setNetPrice] = useState<number | string>("");
  const [markup, setMarkup] = useState<number>(30); // 30% di default
  const [quantity, setQuantity] = useState<number>(1);
  
  const handleAddPart = () => {
    if (!code || !netPrice) return;
    
    const netPriceNum = typeof netPrice === "string" ? parseFloat(netPrice) : netPrice;
    const margin = (netPriceNum * markup) / 100;
    const finalPrice = (netPriceNum + margin) * quantity;
    
    const newPart: SparePart = {
      id: uuidv4(),
      code,
      description: description || undefined,
      netPrice: netPriceNum,
      markup,
      margin,
      quantity,
      finalPrice
    };
    
    onChange([...parts, newPart]);
    
    // Resetta i campi
    setCode("");
    setDescription("");
    setNetPrice("");
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="code">Codice</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Codice ricambio"
          />
        </div>
        
        <div>
          <Label htmlFor="netPrice">Prezzo netto</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="netPrice"
              type="number"
              value={netPrice}
              onChange={(e) => setNetPrice(e.target.value ? parseFloat(e.target.value) : "")}
              placeholder="0.00"
              min={0}
              step={0.01}
            />
            <span>€</span>
          </div>
        </div>
        
        <div>
          <Label htmlFor="markup">Ricarico (%)</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="markup"
              type="number"
              value={markup}
              onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
              placeholder="30"
              min={0}
              max={100}
            />
            <span>%</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="description">Descrizione</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione (opzionale)"
          />
        </div>
        
        <div>
          <Label htmlFor="quantity">Quantità</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              placeholder="1"
              min={1}
              max={100}
            />
            <Button 
              type="button" 
              onClick={handleAddPart}
              className="gap-1"
              disabled={!code || !netPrice}
            >
              <Plus size={16} />
              <span>Aggiungi</span>
            </Button>
          </div>
        </div>
      </div>
      
      {parts.length > 0 ? (
        <div className="space-y-4 mt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Quantità</TableHead>
                  <TableHead className="text-right">Prezzo Netto</TableHead>
                  <TableHead className="text-right">Ricarico</TableHead>
                  <TableHead className="text-right">Prezzo Finale</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell>{part.code}</TableCell>
                    <TableCell>{part.description || "-"}</TableCell>
                    <TableCell className="text-right">{part.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(part.netPrice)}</TableCell>
                    <TableCell className="text-right">{`${part.markup}% (${formatCurrency(part.margin)})`}</TableCell>
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
                    Totale Ricambi:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(parts.reduce((sum, part) => sum + part.finalPrice, 0))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground border rounded-md">
          <p>Nessun ricambio aggiunto</p>
        </div>
      )}
    </div>
  );
}