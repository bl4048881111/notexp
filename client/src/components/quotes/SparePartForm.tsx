import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SparePart } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SparePartFormProps {
  parts: SparePart[];
  onChange: (parts: SparePart[]) => void;
}

export default function SparePartForm({ parts, onChange }: SparePartFormProps) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [netPrice, setNetPrice] = useState<number | "">(0);
  const [markup, setMarkup] = useState<number | "">(20); // Default markup percentage
  
  const handleAddPart = () => {
    if (!description || netPrice === "" || markup === "") return;
    
    const netPriceNum = typeof netPrice === "string" ? parseFloat(netPrice) : netPrice;
    const markupNum = typeof markup === "string" ? parseFloat(markup) : markup;
    
    const margin = (netPriceNum * markupNum) / 100;
    const finalPrice = netPriceNum + margin;
    
    const newPart: SparePart = {
      id: uuidv4(),
      code: code || `PART-${Math.floor(Math.random() * 10000)}`,
      description,
      netPrice: netPriceNum,
      markup: markupNum,
      margin,
      finalPrice
    };
    
    onChange([...parts, newPart]);
    
    // Reset form
    setCode("");
    setDescription("");
    setNetPrice(0);
    setMarkup(20);
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
    <div className="space-y-4 border rounded-md p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="part-code">Codice</Label>
          <Input
            id="part-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Codice ricambio"
          />
        </div>
        
        <div className="md:col-span-2">
          <Label htmlFor="part-description">Descrizione</Label>
          <Input
            id="part-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione ricambio"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="part-price">Prezzo</Label>
            <Input
              id="part-price"
              type="number"
              value={netPrice}
              onChange={(e) => setNetPrice(e.target.value ? parseFloat(e.target.value) : "")}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          
          <div>
            <Label htmlFor="part-markup">Ricarico %</Label>
            <Input
              id="part-markup"
              type="number"
              value={markup}
              onChange={(e) => setMarkup(e.target.value ? parseFloat(e.target.value) : "")}
              placeholder="20"
              min="0"
              step="1"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button 
          type="button" 
          size="sm" 
          onClick={handleAddPart}
          disabled={!description || netPrice === "" || markup === ""}
        >
          Aggiungi Ricambio
        </Button>
      </div>
      
      {parts.length > 0 && (
        <>
          <Separator />
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Descrizione</TableHead>
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
                    <TableCell>{part.description}</TableCell>
                    <TableCell className="text-right">{formatCurrency(part.netPrice)}</TableCell>
                    <TableCell className="text-right">{part.markup}%</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(part.finalPrice)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePart(part.id)}
                        className="h-8 w-8"
                      >
                        <span className="material-icons text-destructive">delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
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
        </>
      )}
    </div>
  );
}