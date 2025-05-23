import React, { useState } from 'react';
import AcceptancePhase from './AcceptancePhase';
import WorkPhase from './WorkPhase';
import { DeliveryPhase } from './DeliveryPhase';

interface ServiceProcessProps {
  vehicleId: string;
  customerPhone: string;
  appointmentId?: string;
  onCompleteProcess?: () => void; // Callback opzionale per il completamento dell'intero processo
}

type ProcessPhase = 'acceptance' | 'work' | 'delivery';

const ServiceProcess: React.FC<ServiceProcessProps> = ({ vehicleId, customerPhone, appointmentId, onCompleteProcess }) => {
  const [currentPhase, setCurrentPhase] = useState<ProcessPhase>('acceptance');

  const handlePhaseComplete = (nextPhase: ProcessPhase) => {
    setCurrentPhase(nextPhase);
  };

  const handleDeliveryComplete = () => {
    // Notifica il completamento dell'intero processo
    if (onCompleteProcess) {
      onCompleteProcess();
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-8">
        <div className="text-center flex-1">
          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 transition-all
            ${currentPhase === 'acceptance' ? 'bg-primary border-2 border-primary' : 'bg-transparent border-2 border-primary/50'}`}
          >
            <span className={`text-lg font-bold transition-all
              ${currentPhase === 'acceptance' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>1</span>
          </div>
          <span className={`transition-all ${currentPhase === 'acceptance' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Accettazione</span>
        </div>
        <div className="text-center flex-1">
          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 transition-all
            ${currentPhase === 'work' ? 'bg-primary border-2 border-primary' : 'bg-transparent border-2 border-primary/50'}`}
          >
            <span className={`text-lg font-bold transition-all
              ${currentPhase === 'work' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>2</span>
          </div>
          <span className={`transition-all ${currentPhase === 'work' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Lavorazione</span>
        </div>
        <div className="text-center flex-1">
          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 transition-all
            ${currentPhase === 'delivery' ? 'bg-primary border-2 border-primary' : 'bg-transparent border-2 border-primary/50'}`}
          >
            <span className={`text-lg font-bold transition-all
              ${currentPhase === 'delivery' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>3</span>
          </div>
          <span className={`transition-all ${currentPhase === 'delivery' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Consegna</span>
        </div>
      </div>

      {currentPhase === 'acceptance' && (
        <AcceptancePhase
          vehicleId={vehicleId}
          onComplete={() => handlePhaseComplete('work')}
        />
      )}

      {currentPhase === 'work' && (
        <WorkPhase
          vehicleId={vehicleId}
          appointmentId={appointmentId}
          onComplete={() => handlePhaseComplete('delivery')}
        />
      )}

      {currentPhase === 'delivery' && (
        <DeliveryPhase
          vehicleId={vehicleId}
          customerPhone={customerPhone}
          onComplete={handleDeliveryComplete}
        />
      )}
    </div>
  );
};

export default ServiceProcess; 