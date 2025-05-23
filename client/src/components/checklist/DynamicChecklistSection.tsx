import { useState, useEffect, useRef } from 'react';
import { Check, X, AlertTriangle, Edit, Settings } from 'lucide-react';

interface Controllo {
  stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
  note: string;
}

interface DynamicChecklistSectionProps {
  sectionName: string;
  parameters: {
    [key: string]: {
      name: string;
      section: string;
      defaultState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
    };
  };
  parameterIds: string[];
  controls: {
    [key: string]: Controllo;
  };
  onControlChange: (parameterId: string, newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => void;
  onNoteChange: (parameterId: string, note: string) => void;
}

export default function DynamicChecklistSection({
  sectionName,
  parameters,
  parameterIds,
  controls,
  onControlChange,
  onNoteChange
}: DynamicChecklistSectionProps) {
  // Stato per gestire gli elementi selezionati
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  
  // Se non ci sono parametri per questa sezione, non renderizzare nulla
  if (!parameterIds || parameterIds.length === 0) {
    console.log(`La sezione ${sectionName} non ha parametri da visualizzare`);
    return null;
  }

  console.log(`Rendering sezione ${sectionName} con parametri:`, parameterIds);
  
  // Filtra i parametri validi per questa sezione
  const validParameterIds = parameterIds.filter(id => parameters[id] !== undefined);
  
  if (validParameterIds.length === 0) {
    console.log(`La sezione ${sectionName} non ha parametri validi da visualizzare`);
    return null;
  }
  
  console.log(`Parametri validi per la sezione ${sectionName}:`, validParameterIds);

  const StatusIcon = ({ status }: { status: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE' }) => {
    if (status === 'CONTROLLATO') {
      return <Check className="text-green-500" size={20} />;
    } else if (status === 'NON CONTROLLATO') {
      return <X className="text-red-500" size={20} />;
    } else {
      return <AlertTriangle className="text-gray-500" size={20} />;
    }
  };

  // Funzione per gestire la selezione di un elemento
  const toggleSelection = (parameterId: string) => {
    if (selectedParameters.includes(parameterId)) {
      setSelectedParameters(selectedParameters.filter(id => id !== parameterId));
    } else {
      setSelectedParameters([...selectedParameters, parameterId]);
    }
  };

  // Funzione per selezionare o deselezionare tutti gli elementi
  const toggleSelectAll = () => {
    if (selectedParameters.length === validParameterIds.length) {
      setSelectedParameters([]);
    } else {
      setSelectedParameters([...validParameterIds]);
    }
  };

  // Funzione per applicare un'azione di massa agli elementi selezionati
  const applyBulkAction = (action: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => {
    selectedParameters.forEach(parameterId => {
      onControlChange(parameterId, action);
    });
    
    // Dopo l'azione, esci dalla modalità di modifica di massa
    setBulkEditMode(false);
    // Opzionale: deseleziona tutto dopo l'azione
    // setSelectedParameters([]);
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-orange-500">{sectionName}</h3>
        
        {validParameterIds.length > 1 && (
          <div className="flex items-center">
            {bulkEditMode ? (
              <>
                <button 
                  onClick={() => setBulkEditMode(false)}
                  className="text-sm px-3 py-1 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 mr-2"
                >
                  Annulla
                </button>
                <button 
                  onClick={toggleSelectAll}
                  className="text-sm px-3 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 mr-2"
                >
                  {selectedParameters.length === validParameterIds.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                </button>
                {selectedParameters.length > 0 && (
                  <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                    <button 
                      onClick={() => applyBulkAction('CONTROLLATO')}
                      className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 flex items-center"
                      title="Imposta tutti a CONTROLLATO"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => applyBulkAction('NON CONTROLLATO')}
                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 flex items-center border-l border-r border-gray-300"
                      title="Imposta tutti a NON CONTROLLATO"
                    >
                      <X size={16} />
                    </button>
                    <button 
                      onClick={() => applyBulkAction('DA FARE')}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 flex items-center"
                      title="Imposta tutti a DA FARE"
                    >
                      <AlertTriangle size={16} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button 
                onClick={() => setBulkEditMode(true)}
                className="flex items-center px-3 py-1 rounded bg-orange-100 text-orange-800 hover:bg-orange-200 text-sm"
              >
                <Edit size={14} className="mr-1" />
                Modifica di massa
              </button>
            )}
          </div>
        )}
      </div>
      
      {validParameterIds.map((parameterId) => {
        const parameter = parameters[parameterId];
        if (!parameter) {
          console.warn(`Parametro ${parameterId} non trovato`);
          return null;
        }
        
        const control = controls[parameterId] || { 
          stato: parameter.defaultState,
          note: ''
        };
        
        return (
          <div 
            key={parameterId} 
            className={`py-2 border-b border-border flex items-center ${
              bulkEditMode && selectedParameters.includes(parameterId) ? 'bg-blue-50' : ''
            }`}
          >
            {bulkEditMode && (
              <div className="mr-2">
                <input 
                  type="checkbox" 
                  checked={selectedParameters.includes(parameterId)}
                  onChange={() => toggleSelection(parameterId)}
                  className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                />
              </div>
            )}
            
            <div className="font-medium w-1/3">{parameter.name}</div>
            <div className="w-24 text-center">
              <button 
                onClick={() => {
                  // Cicla tra gli stati
                  let newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
                  if (control.stato === 'CONTROLLATO') {
                    newState = 'NON CONTROLLATO';
                  } else if (control.stato === 'NON CONTROLLATO') {
                    newState = 'DA FARE';
                  } else {
                    newState = 'CONTROLLATO';
                  }
                  onControlChange(parameterId, newState);
                }} 
                className="p-2 rounded-full hover:bg-accent transition-colors"
              >
                <StatusIcon status={control.stato} />
              </button>
            </div>
            <div className="flex-1">
              <input 
                type="text" 
                value={control.note}
                onChange={(e) => onNoteChange(parameterId, e.target.value)}
                className="w-full p-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Aggiungi note..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
} 