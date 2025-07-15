import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LaborCalculator } from '@/components/quotes/LaborCalculator';
import { ServiceItemLaborCalculator } from '@/components/quotes/ServiceItemLaborCalculator';
import { Separator } from '@/components/ui/separator';

export default function LaborTestPage() {
  const [globalLaborData, setGlobalLaborData] = useState({
    rate: 35,
    hours: 0,
    total: 0
  });
  
  const [serviceLaborHours, setServiceLaborHours] = useState({
    service1: 0,
    service2: 1
  });

  const handleGlobalLaborChange = (data: { rate: number; hours: number; total: number }) => {
    setGlobalLaborData(data);
    // console.log('Manodopera globale aggiornata:', data);
  };
  
  const handleServiceLaborChange = (serviceId: string, hours: number) => {
    setServiceLaborHours(prev => ({
      ...prev,
      [serviceId]: hours
    }));
    // console.log(`Manodopera per servizio ${serviceId} aggiornata:`, hours);
  };
  
  // Calcola i totali
  const calculateTotals = () => {
    // Calcola la manodopera dei servizi
    const service1Labor = serviceLaborHours.service1 * globalLaborData.rate;
    const service2Labor = serviceLaborHours.service2 * globalLaborData.rate;
    const serviceLaborTotal = service1Labor + service2Labor;
    
    // Calcola la manodopera extra (globale)
    const extraLabor = globalLaborData.total;
    
    // Calcola il totale generale
    const totalLabor = serviceLaborTotal + extraLabor;
    
    return {
      service1Labor,
      service2Labor,
      serviceLaborTotal,
      extraLabor,
      totalLabor
    };
  };
  
  const totals = calculateTotals();
  
  // Funzione per formattare la valuta
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Test Calcolatore Manodopera</h1>
        <p className="text-muted-foreground">
          Questa pagina dimostra come gestire correttamente la manodopera sia a livello di preventivo che di singoli servizi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <LaborCalculator 
            initialRate={globalLaborData.rate}
            initialHours={globalLaborData.hours}
            title="Manodopera Extra"
            description="Ore di lavoro aggiuntive non incluse nei singoli servizi."
            onChange={handleGlobalLaborChange}
          />
          
          <ServiceItemLaborCalculator 
            serviceName="Tagliando Olio"
            hourlyRate={globalLaborData.rate}
            initialHours={serviceLaborHours.service1}
            onChange={(hours) => handleServiceLaborChange('service1', hours)}
          />
          
          <ServiceItemLaborCalculator 
            serviceName="Cambio Freni"
            hourlyRate={globalLaborData.rate}
            initialHours={serviceLaborHours.service2}
            onChange={(hours) => handleServiceLaborChange('service2', hours)}
          />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Riepilogo Manodopera</CardTitle>
            <CardDescription>Dettaglio dei costi di manodopera</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium">Manodopera per servizi</h3>
              <div className="grid grid-cols-2 gap-2 pl-2">
                <div className="text-muted-foreground">Tagliando Olio ({serviceLaborHours.service1} ore):</div>
                <div className="font-medium">{formatCurrency(totals.service1Labor)}</div>

                <div className="text-muted-foreground">Cambio Freni ({serviceLaborHours.service2} ore):</div>
                <div className="font-medium">{formatCurrency(totals.service2Labor)}</div>

                <div className="text-muted-foreground border-t pt-2 mt-1 font-medium">Totale manodopera servizi:</div>
                <div className="font-medium border-t pt-2 mt-1">{formatCurrency(totals.serviceLaborTotal)}</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h3 className="font-medium">Manodopera extra</h3>
              <div className="grid grid-cols-2 gap-2 pl-2">
                <div className="text-muted-foreground">Ore aggiuntive ({globalLaborData.hours} ore):</div>
                <div className="font-medium">{formatCurrency(totals.extraLabor)}</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h3 className="font-medium">Totale manodopera</h3>
              <div className="grid grid-cols-2 gap-2 pl-2 border p-4 rounded-md bg-muted/20">
                <div className="text-primary font-bold">TOTALE MANODOPERA:</div>
                <div className="font-bold text-xl">{formatCurrency(totals.totalLabor)}</div>
                
                <div className="text-xs text-muted-foreground col-span-2 pt-1">
                  Totale calcolato sommando la manodopera di tutti i servizi e la manodopera extra
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 