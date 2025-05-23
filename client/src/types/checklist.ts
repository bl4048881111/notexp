// Definizione dei tipi per la checklist
export interface ChecklistParameter {
  name: string;
  section: string;
  defaultState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
}

export interface ChecklistParameterMapping {
  [key: string]: string[];
}

export interface Controllo {
  stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
  note: string;
}

export interface DynamicChecklistProps {
  vehicleId?: string;
  appointmentId?: string;
  onChecklistChange?: (controls: Record<string, Controllo>) => void;
  readOnly?: boolean;
}

export interface DynamicChecklistSectionProps {
  sectionName: string;
  parameters: Record<string, ChecklistParameter>;
  parameterIds: string[];
  controls: Record<string, Controllo>;
  onControlChange: (parameterId: string, newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => void;
  onNoteChange: (parameterId: string, note: string) => void;
}

export interface ChecklistParameterLoaderProps {
  children: (data: {
    parameters: Record<string, ChecklistParameter>;
    mapping: ChecklistParameterMapping;
    loading: boolean;
    error: Error | null;
  }) => React.ReactNode;
} 