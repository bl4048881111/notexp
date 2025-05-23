import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DynamicChecklist from '../checklist/DynamicChecklist';
import { FileText, Eye, EyeOff } from 'lucide-react';

interface WorkingPhaseChecklistProps {
  vehicleId: string;
  appointmentId?: string;
}

export default function WorkingPhaseChecklist({ vehicleId, appointmentId }: WorkingPhaseChecklistProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'export'>('edit');
  
  return (
    <Card className="border border-border mb-6">
      <CardHeader className="py-3 px-4 border-b border-border">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium text-orange-500">
            Controlli Fase 2
          </CardTitle>
          {showChecklist && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'edit' ? 'export' : 'edit')}
                className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground"
                title={viewMode === 'edit' ? 'Visualizza formato esportazione' : 'Torna alla modalità modifica'}
              >
                {viewMode === 'edit' ? (
                  <>
                    <FileText size={16} />
                    <span>Esporta</span>
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    <span>Modifica</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {!showChecklist ? (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Visualizza e compila la checklist di controllo per questo veicolo.
            </p>
            <button
              onClick={() => setShowChecklist(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded"
            >
              Mostra Checklist
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowChecklist(false)}
                className="text-sm text-muted-foreground hover:text-foreground underline flex items-center gap-1"
              >
                <EyeOff size={16} />
                <span>Nascondi</span>
              </button>
            </div>
            <DynamicChecklist 
              vehicleId={vehicleId} 
              appointmentId={appointmentId}
              onClose={() => setShowChecklist(false)}
              exportView={viewMode === 'export'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
} 