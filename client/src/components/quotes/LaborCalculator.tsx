import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface LaborCalculatorProps {
  initialRate?: number;
  initialHours?: number;
  onChange?: (data: { rate: number; hours: number; total: number }) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
}

export function LaborCalculator({
  initialRate = 35,
  initialHours = 0,
  onChange,
  readOnly = false,
  title = "Manodopera",
  description
}: LaborCalculatorProps) {
  const [rate, setRate] = useState<number>(initialRate);
  const [hours, setHours] = useState<number>(initialHours);
  const [total, setTotal] = useState<number>(initialRate * initialHours);

  // Funzione per formattare la valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Calcola il totale quando rate o hours cambiano
  useEffect(() => {
    const newTotal = rate * hours;
    setTotal(newTotal);
    
    // Callback per notificare il componente padre dei valori aggiornati
    if (onChange) {
      onChange({ rate, hours, total: newTotal });
    }
  }, [rate, hours, onChange]);

  // Gestisce il cambio della tariffa oraria
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    if (!isNaN(newRate) && newRate >= 0) {
      setRate(newRate);
    }
  };

  // Gestisce il cambio delle ore
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHours = parseFloat(e.target.value);
    if (!isNaN(newHours) && newHours >= 0) {
      setHours(newHours);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-[#111111]">
      <h3 className="font-medium text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
      )}
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="laborRate">Tariffa oraria</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="laborRate"
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={handleRateChange}
                disabled={readOnly}
                className="h-10 text-base"
              />
              <span className="text-base">€/ora</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="laborHours">Ore di lavoro</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="laborHours"
                type="number"
                min="0"
                step="0.5"
                value={hours}
                onChange={handleHoursChange}
                disabled={readOnly}
                className="h-10 text-base"
              />
              <span className="text-base">ore</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t text-sm">
          <div className="text-muted-foreground">Ore totali:</div>
          <div className="font-medium">
            {hours} ore
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-1 text-sm">
          <div className="text-muted-foreground">Costo manodopera:</div>
          <div className="font-medium">
            {formatCurrency(total)}
          </div>
        </div>
      </div>
    </div>
  );
} 