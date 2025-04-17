import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { SparePart, CreateSparePartInput } from "@shared/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { v4 as uuidv4 } from 'uuid';

interface SparePartFormProps {
  parts: SparePart[];
  onChange: (parts: SparePart[]) => void;
}

export default function SparePartForm({ parts, onChange }: SparePartFormProps) {
  const [partsList, setPartsList] = useState<SparePart[]>(parts || []);
  const [newPart, setNewPart] = useState<CreateSparePartInput>({
    code: "",
    description: "",
    netPrice: 0,
    markupPercentage: 10,
    finalPrice: 0
  });

  const calculateFinalPrice = (netPrice: number, markup: number): number => {
    return netPrice * (1 + markup / 100);
  };

  const handleAddPart = () => {
    if (!newPart.code) return;

    const finalPrice = calculateFinalPrice(newPart.netPrice, newPart.markupPercentage);
    
    const part: SparePart = {
      id: uuidv4(),
      code: newPart.code,
      description: newPart.description,
      netPrice: newPart.netPrice,
      markupPercentage: newPart.markupPercentage,
      finalPrice: parseFloat(finalPrice.toFixed(2))
    };

    const updatedParts = [...partsList, part];
    setPartsList(updatedParts);
    onChange(updatedParts);
    
    // Reset form
    setNewPart({
      code: "",
      description: "",
      netPrice: 0,
      markupPercentage: 10,
      finalPrice: 0
    });
  };

  const handleRemovePart = (partId: string) => {
    const updatedParts = partsList.filter(part => part.id !== partId);
    setPartsList(updatedParts);
    onChange(updatedParts);
  };

  const handleNetPriceChange = (value: string) => {
    const netPrice = parseFloat(value) || 0;
    const finalPrice = calculateFinalPrice(netPrice, newPart.markupPercentage);
    
    setNewPart({
      ...newPart,
      netPrice,
      finalPrice: parseFloat(finalPrice.toFixed(2))
    });
  };

  const handleMarkupChange = (value: string) => {
    const markupPercentage = parseFloat(value) || 0;
    const finalPrice = calculateFinalPrice(newPart.netPrice, markupPercentage);
    
    setNewPart({
      ...newPart,
      markupPercentage,
      finalPrice: parseFloat(finalPrice.toFixed(2))
    });
  };

  // Calculate total price
  const totalPrice = partsList.reduce((sum, part) => sum + part.finalPrice, 0);

  return (
    <div className="space-y-4">
      <Label>Pezzi di Ricambio</Label>
      
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-2">
          <Input
            placeholder="Codice articolo"
            value={newPart.code}
            onChange={(e) => setNewPart({ ...newPart, code: e.target.value })}
          />
        </div>
        <div className="col-span-1">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Prezzo netto"
            value={newPart.netPrice === 0 ? "" : newPart.netPrice}
            onChange={(e) => handleNetPriceChange(e.target.value)}
          />
        </div>
        <div className="col-span-1">
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="% Markup"
            value={newPart.markupPercentage === 0 ? "" : newPart.markupPercentage}
            onChange={(e) => handleMarkupChange(e.target.value)}
          />
        </div>
        <div className="col-span-1">
          <Input
            type="number"
            readOnly
            placeholder="Prezzo finale"
            value={calculateFinalPrice(newPart.netPrice, newPart.markupPercentage).toFixed(2)}
          />
        </div>
        <div className="col-span-1 flex justify-end">
          <Button type="button" onClick={handleAddPart} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {partsList.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Codice</TableHead>
                <TableHead className="w-[25%]">Descrizione</TableHead>
                <TableHead className="w-[15%]">Prezzo Netto</TableHead>
                <TableHead className="w-[15%]">% Markup</TableHead>
                <TableHead className="w-[15%]">Prezzo Finale</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partsList.map((part) => (
                <TableRow key={part.id}>
                  <TableCell className="font-medium">{part.code}</TableCell>
                  <TableCell>{part.description}</TableCell>
                  <TableCell>€{part.netPrice.toFixed(2)}</TableCell>
                  <TableCell>{part.markupPercentage}%</TableCell>
                  <TableCell>€{part.finalPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => handleRemovePart(part.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold">
                  Totale
                </TableCell>
                <TableCell className="font-bold">
                  €{totalPrice.toFixed(2)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}