import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ServiceItemLaborCalculatorProps {
  serviceName: string;
  hourlyRate: number;
  initialHours?: number; 
  onChange?: (hours: number) => void;
  readOnly?: boolean;
}

export function ServiceItemLaborCalculator({
  serviceName,
  hourlyRate,
  initialHours = 0,
  onChange,
  readOnly = false
}: ServiceItemLaborCalculatorProps) {
  const [hours, setHours] = useState<number>(initialHours);
  
  // Funzione per formattare la valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Notifica il componente padre quando cambiano le ore
  useEffect(() => {
    if (onChange) {
      onChange(hours);
    }
  }, [hours, onChange]);

  // Gestisce il cambio delle ore
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHours = parseFloat(e.target.value);
    if (!isNaN(newHours) && newHours >= 0) {
      setHours(newHours);
    }
  };

  // Calcola il costo della manodopera
  const laborCost = hourlyRate * hours;

  return (
    <div className="border rounded-lg p-3 bg-[#111111]">
      <h4 className="font-medium mb-2">Manodopera: {serviceName}</h4>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="serviceHourlyRate" className="text-xs">Tariffa oraria</Label>
            <div className="flex items-center space-x-1">
              <Input
                id="serviceHourlyRate"
                type="number"
                value={hourlyRate}
                disabled={true}
                className="h-8 text-sm bg-muted/50"
              />
              <span className="text-sm">€/ora</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="serviceHours" className="text-xs">Ore necessarie</Label>
            <div className="flex items-center space-x-1">
              <Input
                id="serviceHours"
                type="number"
                min="0"
                step="0.5"
                value={hours}
                onChange={handleHoursChange}
                disabled={readOnly}
                className="h-8 text-sm"
              />
              <span className="text-sm">ore</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t text-xs">
          <div className="text-muted-foreground">Costo manodopera per questo servizio:</div>
          <div className="font-medium">
            {formatCurrency(laborCost)}
          </div>
        </div>
      </div>
    </div>
  );
} 