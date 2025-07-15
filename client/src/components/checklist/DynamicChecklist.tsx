import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { rtdb as database, saveChecklistControl, getVehicleControlsPath, getVehicleChecklistPath, getAppointmentChecklistPath } from "../../firebase";
import { ref, get, set } from "firebase/database";
import DynamicChecklistSection from "./DynamicChecklistSection";

// CSS personalizzato per prevenire lo scroll automatico
const customTabsStyle = `
  .react-tabs-no-scroll .react-tabs__tab-panel {
    outline: none;
  }
  .react-tabs-no-scroll .react-tabs__tab:focus {
    outline: none;
    box-shadow: none;
  }
  .react-tabs-no-scroll .react-tabs__tab-list {
    scroll-behavior: auto !important;
  }
  .react-tabs-no-scroll {
    scroll-behavior: auto !important;
  }
  .react-tabs-no-scroll * {
    scroll-behavior: auto !important;
  }
`;

interface DynamicChecklistProps {
  vehicleId?: string;
  appointmentId?: string;
  onChecklistChange?: (controls: Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }>) => void;
  readOnly?: boolean;
  exportView?: boolean;
  onClose?: () => void;
}

interface ChecklistParameter {
  name: string;
  section: string;
  defaultState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
}

// Componente per la visualizzazione dei parametri in formato tabellare (export view)
export function ExportViewChecklist({ 
  sections, 
  parameters,
  controls 
}: { 
  sections: Record<string, string[]>,
  parameters: Record<string, { name: string, section: string }>,
  controls: Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }>
}) {
  return (
    <div className="space-y-4">
      {Object.entries(sections).map(([section, paramIds]) => (
        <div key={section} className="mb-8">
          <h3 className="text-orange-500 font-medium text-lg mb-2">{section}</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left w-2/5">Componente</th>
                <th className="border border-gray-300 p-2 text-center w-1/5">Stato</th>
                <th className="border border-gray-300 p-2 text-left w-2/5">Note</th>
              </tr>
            </thead>
            <tbody>
              {paramIds.map(paramId => {
                const param = parameters[paramId];
                const control = controls[paramId] || { stato: 'DA FARE', note: '' };
                if (!param) return null;
                
                // Formattazione stati per la view di esportazione
                let statoDisplay = '';
                let statoClass = '';
                let statoIcon = '';
                
                if (control.stato === 'CONTROLLATO') {
                  statoIcon = '•';
                  statoDisplay = 'CONTROLLATO';
                  statoClass = 'text-green-600 font-medium';
                } else if (control.stato === 'NON CONTROLLATO') {
                  statoIcon = '?';
                  statoDisplay = 'NON CONTROLLATO';
                  statoClass = 'text-orange-600 font-medium';
                } else {
                  statoIcon = '!';
                  statoDisplay = 'DA FARE';
                  statoClass = 'text-red-600 font-medium';
                }
                
                return (
                  <tr key={paramId} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="border border-gray-300 p-2 font-medium">
                      {param.name}
                    </td>
                    <td className={`border border-gray-300 p-2 text-center ${statoClass}`}>
                      <div className="flex items-center justify-center">
                        <span className="inline-block w-5 text-center font-bold">{statoIcon}</span>
                        <span className="inline-block">{statoDisplay}</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 p-2">{control.note || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function DynamicChecklist({
  vehicleId,
  appointmentId,
  onChecklistChange,
  readOnly = false,
  exportView = false,
  onClose
}: DynamicChecklistProps) {
  const [controls, setControls] = useState<Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }>>({});
  const [parameters, setParameters] = useState<Record<string, ChecklistParameter>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Carica i parametri della checklist
  useEffect(() => {
    async function loadParameters() {
      try {
        const parametersRef = ref(database, 'checklistParameters');
        const snapshot = await get(parametersRef);
        
        if (snapshot.exists()) {
          setParameters(snapshot.val());
        } else {
          // console.log("Nessun parametro di checklist trovato");
        }
      } catch (error) {
        console.error("Errore nel caricamento dei parametri:", error);
        setError(error as Error);
      } finally {
        setLoading(false);
      }
    }
    
    loadParameters();
  }, []);

  // Carica i controlli esistenti dal database
  useEffect(() => {
    if (!vehicleId && !appointmentId) {
      return;
    }

    async function loadExistingControls() {
      try {        
        // Array di percorsi da controllare in ordine di priorità
        const paths = [];
        
        if (appointmentId) {
          // Gli appuntamenti hanno sempre priorità
          paths.push(getAppointmentChecklistPath(appointmentId));
        }
        
        if (vehicleId) {
          // Percorso principale standardizzato
          paths.push(getVehicleControlsPath(vehicleId));
          paths.push(getVehicleChecklistPath(vehicleId));
          
          // Percorsi alternativi per retrocompatibilità (in ordine di priorità decrescente)
          paths.push(`vehicles/${vehicleId}/fase2/controls`);
          paths.push(`vehicles/${vehicleId}/fase2/checklist`);
          paths.push(`vehicles/${vehicleId}/workingPhase/controls`);
          paths.push(`vehicles/${vehicleId}/workingPhase/checklist`);
          paths.push(`workingPhase/${vehicleId}/controls`);
          paths.push(`workingPhase/${vehicleId}/checklist`);
          paths.push(`lavorazione/${vehicleId}/controls`);
          paths.push(`lavorazione/${vehicleId}/checklist`);
        }
        
        // Controlla ogni percorso finché non trova controlli validi
        let foundControls = null;
        let foundPath = "";
        
        for (const path of paths) {
          const dbRef = ref(database, path);
          const snapshot = await get(dbRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Se abbiamo trovato dati validi
            if (typeof data === 'object' && Object.keys(data).length > 0) {
              // Se i dati hanno la struttura corretta con stato e note
              if (Object.values(data).some((item: any) => item?.stato !== undefined)) {
                // console.log(`Controlli trovati in ${path}:`, data);
                foundControls = normalizeControls(data);
                foundPath = path;
                break;
              }
            }
          }
        }
        
        if (foundControls) {
          // console.log(`Utilizzo controlli da ${foundPath}`);
          setControls(foundControls);
        } else {
          // console.log("Nessun controllo trovato nei percorsi disponibili");
        }
      } catch (error) {
        console.error("Errore nel caricamento dei controlli:", error);
      }
    }
    
    // Normalizza i controlli in un formato standard
    function normalizeControls(data: any): Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }> {
      const result: Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }> = {};
      
      // Se i controlli sono direttamente nell'oggetto
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (value && typeof value === 'object' && value.stato !== undefined) {
          result[key] = {
            stato: value.stato,
            note: value.note || ""
          };
        }
      });
      
      return result;
    }

    loadExistingControls();
  }, [vehicleId, appointmentId]);

  // Gestisce il cambio di stato di un controllo
  const handleControlChange = useCallback((parameterId: string, newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => {
    if (readOnly) return;
    
    setControls(prevControls => {
      const updatedControls = {
        ...prevControls,
        [parameterId]: {
          ...prevControls[parameterId],
          stato: newState
        }
      };
      
      const control = updatedControls[parameterId] || { stato: newState, note: '' };
      saveChecklistControl(vehicleId || null, appointmentId || null, parameterId, control)
        .then(() => {
          // console.log(`Stato del controllo ${parameterId} aggiornato con successo`);
          if (onChecklistChange) {
            onChecklistChange(updatedControls);
          }
        })
        .catch(error => {
          console.error(`Errore nell'aggiornamento dello stato del controllo ${parameterId}:`, error);
        });
      
      return updatedControls;
    });
  }, [readOnly, vehicleId, appointmentId, onChecklistChange]);

  // Gestisce il cambio delle note di un controllo con debouncing
  const handleNoteChange = useCallback((parameterId: string, newNote: string) => {
    if (readOnly) return;
    
    // NON aggiornare lo stato locale durante la digitazione per evitare re-render
    // L'input gestisce il proprio stato locale
    
    // Debounce il salvataggio per evitare troppe chiamate al database
    const timeoutId = setTimeout(() => {
      // Aggiorna lo stato solo quando salviamo
      setControls(currentControls => {
        const updatedControls = {
          ...currentControls,
          [parameterId]: {
            ...currentControls[parameterId],
            note: newNote
          }
        };
        
        const control = { 
          stato: currentControls[parameterId]?.stato || 'NON CONTROLLATO', 
          note: newNote 
        };
        
        saveChecklistControl(vehicleId || null, appointmentId || null, parameterId, control)
          .then(() => {
            // console.log(`Note del controllo ${parameterId} aggiornate con successo`);
            // Chiama onChecklistChange solo dopo il salvataggio riuscito
            if (onChecklistChange) {
              onChecklistChange(updatedControls);
            }
          })
          .catch(error => {
            console.error(`Errore nell'aggiornamento delle note del controllo ${parameterId}:`, error);
          });
        
        return updatedControls;
      });
    }, 1000); // Aumentato il debounce a 1 secondo
    
    // Pulisci il timeout precedente se esiste
    if ((window as any)[`noteTimeout_${parameterId}`]) {
      clearTimeout((window as any)[`noteTimeout_${parameterId}`]);
    }
    (window as any)[`noteTimeout_${parameterId}`] = timeoutId;
  }, [readOnly, vehicleId, appointmentId, onChecklistChange]);

  // Gestisce la navigazione Tab globale - STABILIZZATA
  const handleGlobalTabPress = useCallback((currentParameterId: string, shiftKey: boolean) => {
    // Usa i ref per accedere ai valori correnti senza dipendenze
    const currentParameters = parameters;
    
    // Raggruppa i parametri per sezione usando i valori correnti
    const mapping: { [section: string]: string[] } = {};
    Object.entries(currentParameters).forEach(([id, param]) => {
      if (!mapping[param.section]) {
        mapping[param.section] = [];
      }
      mapping[param.section].push(id);
    });

    const sectionsWithParameters = Object.keys(mapping).filter(section => mapping[section].length > 0);
    
    // Ottieni tutti i parametri di tutte le sezioni in ordine
    const allParameterIds: string[] = [];
    const parameterToSection: { [key: string]: string } = {};
    
    sectionsWithParameters.forEach(section => {
      const sectionParams = mapping[section] || [];
      sectionParams.forEach(paramId => {
        if (currentParameters[paramId]) {
          allParameterIds.push(paramId);
          parameterToSection[paramId] = section;
        }
      });
    });
    
    const currentIndex = allParameterIds.indexOf(currentParameterId);
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (shiftKey) {
      // Shift+Tab: vai al precedente
      nextIndex = currentIndex > 0 ? currentIndex - 1 : allParameterIds.length - 1;
    } else {
      // Tab: vai al successivo
      nextIndex = currentIndex < allParameterIds.length - 1 ? currentIndex + 1 : 0;
    }
    
    const nextParameterId = allParameterIds[nextIndex];
    const nextSection = parameterToSection[nextParameterId];
    
    // Se il prossimo parametro è in una sezione diversa, cambia sezione
    setActiveSection(currentActiveSection => {
      if (nextSection !== currentActiveSection) {
        // Aspetta che il DOM si aggiorni e poi focalizza l'input
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-parameter-id="${nextParameterId}"]`) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          }
        }, 50);
        return nextSection;
      } else {
        // Se è nella stessa sezione, focalizza direttamente
        const nextInput = document.querySelector(`input[data-parameter-id="${nextParameterId}"]`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
        }
        return currentActiveSection;
      }
    });
  }, []); // NESSUNA DIPENDENZA - completamente stabilizzata

  // Raggruppa i parametri per sezione
  const mapping: { [section: string]: string[] } = {};
  Object.entries(parameters).forEach(([id, param]) => {
    if (!mapping[param.section]) {
      mapping[param.section] = [];
    }
    mapping[param.section].push(id);
  });

  const sectionsWithParameters = Object.keys(mapping).filter(section => mapping[section].length > 0);

  if (sectionsWithParameters.length === 0) {
    return <div className="p-4 text-center">Nessuna sezione con parametri disponibile</div>;
  }

  // Se activeSection non è impostata o non è valida, usa la prima sezione disponibile
  if (!activeSection || !sectionsWithParameters.includes(activeSection)) {
    setActiveSection(sectionsWithParameters[0]);
    return <div className="p-4 text-center">Inizializzazione...</div>;
  }

  const activeIndex = sectionsWithParameters.indexOf(activeSection);

  // Gestisce il loading e il render
  if (loading) {
    return <div className="p-4 text-center">Caricamento checklist...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Errore nel caricamento: {error.toString()}</div>;
  }

  if (!parameters || Object.keys(parameters).length === 0) {
    return <div className="p-4 text-center">Nessun parametro di checklist disponibile</div>;
  }

  return (
    <div className="p-4 bg-background rounded-lg shadow">
      <style>{customTabsStyle}</style>
      
      {/* Tab personalizzate senza react-tabs */}
      <div className="border-b border-border mb-4">
        <div className="flex flex-wrap">
          {sectionsWithParameters.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeSection === section
                  ? 'border-primary text-primary'
                  : 'border-transparent hover:text-primary'
              }`}
            >
              {section} ({mapping[section].length})
            </button>
          ))}
        </div>
      </div>
      
      {/* Contenuto della sezione attiva - RENDERING STATICO */}
      <div>
        {sectionsWithParameters.map((section) => (
          <div 
            key={section} 
            style={{ display: activeSection === section ? 'block' : 'none' }}
          >
            <DynamicChecklistSection
              sectionName={section}
              parameters={parameters}
              parameterIds={mapping[section]}
              onControlChange={handleControlChange}
              onNoteChange={handleNoteChange}
              onTabPress={handleGlobalTabPress}
            />
          </div>
        ))}
      </div>
      
      {onClose && (
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}

export default DynamicChecklist; 