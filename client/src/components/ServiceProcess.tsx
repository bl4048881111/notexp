import React, { useState } from 'react';
import AcceptancePhase from './AcceptancePhase';
import WorkPhase from './WorkPhase';
import DeliveryPhase from './DeliveryPhase.tsx';

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

  const handlePhaseClick = (phase: ProcessPhase) => {
    setCurrentPhase(phase);
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
          <div 
            className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 transition-all cursor-pointer hover:scale-110
              ${currentPhase === 'acceptance' ? 'bg-primary border-2 border-primary' : 'bg-transparent border-2 border-primary/50 hover:border-primary'}`}
            onClick={() => handlePhaseClick('acceptance')}
          >
            <span className={`text-lg font-bold transition-all
              ${currentPhase === 'acceptance' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}>1</span>
          </div>
          <span className={`transition-all ${currentPhase === 'acceptance' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Accettazione</span>
        </div>
        <div className="text-center flex-1">
          <div 
            className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 transition-all cursor-pointer hover:scale-110
              ${currentPhase === 'work' ? 'bg-primary border-2 border-primary' : 'bg-transparent border-2 border-primary/50 hover:border-primary'}`}
            onClick={() => handlePhaseClick('work')}
          >
            <span className={`text-lg font-bold transition-all
              ${currentPhase === 'work' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}>2</span>
          </div>
          <span className={`transition-all ${currentPhase === 'work' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Lavorazione</span>
        </div>
        <div className="text-center flex-1">
          <div 
            className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 transition-all cursor-pointer hover:scale-110
              ${currentPhase === 'delivery' ? 'bg-primary border-2 border-primary' : 'bg-transparent border-2 border-primary/50 hover:border-primary'}`}
            onClick={() => handlePhaseClick('delivery')}
          >
            <span className={`text-lg font-bold transition-all
              ${currentPhase === 'delivery' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}>3</span>
          </div>
          <span className={`transition-all ${currentPhase === 'delivery' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>Consegna</span>
        </div>
      </div>

      {currentPhase === 'acceptance' && (
        <AcceptancePhase
          vehicleId={vehicleId}
          appointmentId={appointmentId}
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