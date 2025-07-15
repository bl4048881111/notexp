import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Check, X, AlertTriangle, Edit, ChevronLeft, ChevronRight } from 'lucide-react';

interface DynamicChecklistSectionProps {
  sectionName: string;
  parameters: Record<string, { name: string; section: string; defaultState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE' }>;
  parameterIds: string[];
  onControlChange: (parameterId: string, newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => void;
  onNoteChange: (parameterId: string, note: string) => void;
  onTabPress?: (parameterId: string, shiftKey: boolean) => void;
}

// Store globale per i controlli - NON causa re-render
const globalControlsStore: Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }> = {};

// Componente separato per ogni input di nota per evitare re-render
function NoteInput({ 
  parameterId, 
  initialValue, 
  onNoteChange
}: { 
  parameterId: string; 
  initialValue: string; 
  onNoteChange: (parameterId: string, note: string) => void;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const onNoteChangeRef = useRef(onNoteChange);
  
  // Aggiorna i ref senza causare re-render
  useEffect(() => {
    onNoteChangeRef.current = onNoteChange;
  }, [onNoteChange]);
  
  // Aggiorna il valore locale solo se l'input non ha il focus
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(initialValue);
    }
  }, [initialValue]);

  // Gestione migliorata del focus per tablet
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Previeni lo scroll automatico
    e.preventDefault();
    
    // Salva la posizione di scroll corrente
    const currentScrollTop = window.scrollY;
    
    // Forza il mantenimento della posizione di scroll
    requestAnimationFrame(() => {
      window.scrollTo(0, currentScrollTop);
    });
  }, []);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    
    // Debounce la chiamata al parent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onNoteChangeRef.current(parameterId, value);
    }, 300);
  }, [parameterId]);
  
  return (
    <input 
      ref={inputRef}
      type="text" 
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      data-parameter-id={parameterId}
      className="w-full p-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      placeholder="Aggiungi note..."
      autoComplete="off"
      autoCorrect="off"
      spellCheck="false"
    />
  );
}

export default function DynamicChecklistSection({
  sectionName,
  parameters,
  parameterIds,
  onControlChange,
  onNoteChange,
  onTabPress
}: DynamicChecklistSectionProps) {
  
  // Stato per gestire gli elementi selezionati
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 9;
  
  // Forza re-render quando cambia la sezione
  useEffect(() => {
    setCurrentPage(0); // Reset alla prima pagina quando cambia sezione
  }, [sectionName]);
  
  // Filtra i parametri validi per questa sezione
  const validParameterIds = parameterIds?.filter(id => parameters[id] !== undefined) || [];
  
  // Calcola la paginazione
  const totalPages = Math.ceil(validParameterIds.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = validParameterIds.slice(startIndex, endIndex);
  
  // Debug paginazione
  // console.log(`Sezione ${sectionName}:`, {
  //   validParameterIds: validParameterIds.length,
  //   itemsPerPage,
  //   totalPages,
  //   currentPage,
  //   startIndex,
  //   endIndex,
  //   currentPageItems: currentPageItems.length,
  //   shouldShowPagination: validParameterIds.length > itemsPerPage,
  //   currentPageItemsIds: currentPageItems
  // });
  
  // VERIFICA CRITICA: currentPageItems dovrebbe avere max 9 elementi
  if (sectionName === "Sospensione Anteriore") {
    // console.log("🔍 VERIFICA PAGINAZIONE:", {
    //   totalElements: validParameterIds.length,
    //   currentPageElements: currentPageItems.length,
    //   elementsToRender: currentPageItems
    // });
  }
  
  // Callback per gestire il cambio delle note - NON aggiorna stato locale
  const handleNoteChange = useCallback((parameterId: string, value: string) => {
    // Aggiorna solo il store globale
    globalControlsStore[parameterId] = {
      ...globalControlsStore[parameterId],
      note: value
    };
    
    // Notifica il parent
    onNoteChange(parameterId, value);
  }, [onNoteChange]);

  // Callback per gestire il cambio di stato - NON aggiorna stato locale
  const handleControlChange = useCallback((parameterId: string, newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => {
    // Salva la posizione di scroll corrente
    const currentScrollTop = window.scrollY;
    
    // Aggiorna solo il store globale
    globalControlsStore[parameterId] = {
      ...globalControlsStore[parameterId],
      stato: newState
    };
    
    // Notifica il parent
    onControlChange(parameterId, newState);
    
    // Forza un re-render solo per aggiornare l'icona dello stato
    setSelectedParameters(prev => [...prev]);
    
    // Ripristina la posizione di scroll
    requestAnimationFrame(() => {
      window.scrollTo(0, currentScrollTop);
    });
  }, [onControlChange]);
  
  // Funzioni di navigazione pagina
  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  // Se non ci sono parametri per questa sezione, non renderizzare nulla
  if (!parameterIds || parameterIds.length === 0) {
    // console.log(`La sezione ${sectionName} non ha parametri da visualizzare`);
    return null;
  }

  // console.log(`Rendering sezione ${sectionName} con parametri:`, parameterIds);
  
  if (validParameterIds.length === 0) {
    // console.log(`La sezione ${sectionName} non ha parametri validi da visualizzare`);
    return null;
  }
  
  // console.log(`Parametri validi per la sezione ${sectionName}:`, validParameterIds);

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
      handleControlChange(parameterId, action);
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
                  <div className="flex gap-2">
                    <button 
                      onClick={() => applyBulkAction('CONTROLLATO')}
                      className="text-sm px-3 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200"
                    >
                      Segna come Controllato ({selectedParameters.length})
                    </button>
                    <button 
                      onClick={() => applyBulkAction('NON CONTROLLATO')}
                      className="text-sm px-3 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200"
                    >
                      Segna come Non Controllato ({selectedParameters.length})
                    </button>
                    <button 
                      onClick={() => applyBulkAction('DA FARE')}
                      className="text-sm px-3 py-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                    >
                      Segna come Da Fare ({selectedParameters.length})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button 
                onClick={() => setBulkEditMode(true)}
                className="text-sm px-3 py-1 rounded bg-orange-100 text-orange-800 hover:bg-orange-200 flex items-center"
              >
                <Edit size={14} className="mr-1" />
                Modifica multipla
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Controlli di paginazione */}
      {validParameterIds.length > itemsPerPage && (
        <div className="flex justify-between items-center mb-4 px-4 py-2 bg-gray-50 rounded-lg">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 0}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
              currentPage === 0 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ChevronLeft size={16} />
            Precedente
          </button>
          
          <span className="text-sm text-gray-600">
            Pagina {currentPage + 1} di {totalPages} ({validParameterIds.length} elementi totali) - Mostrando {currentPageItems.length} elementi
          </span>
          
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages - 1}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
              currentPage === totalPages - 1 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Successiva
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      
      {currentPageItems.map((parameterId) => {
        const parameter = parameters[parameterId];
        if (!parameter) {
          // console.warn(`Parametro ${parameterId} non trovato`);
          return null;
        }
        
        // Usa il store globale o il default
        const control = globalControlsStore[parameterId] || { 
          stato: parameter.defaultState,
          note: ''
        };
        
        return (
          <div 
            key={`${parameterId}-page-${currentPage}`}
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
                  handleControlChange(parameterId, newState);
                }} 
                className="p-2 rounded-full hover:bg-accent transition-colors"
              >
                <StatusIcon status={control.stato} />
              </button>
            </div>
            
            <div className="flex-1">
              <NoteInput 
                parameterId={parameterId}
                initialValue={control.note}
                onNoteChange={handleNoteChange}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
} 