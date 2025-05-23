import { useEffect, useState } from "react";
import { rtdb as database, saveChecklistControl, getVehicleControlsPath, getVehicleChecklistPath, getAppointmentChecklistPath } from "../../firebase";
import { ref, get, set } from "firebase/database";
import DynamicChecklistSection from "./DynamicChecklistSection";
import ChecklistParameterLoader from "./ChecklistParameterLoader";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";

interface DynamicChecklistProps {
  vehicleId?: string;
  appointmentId?: string;
  onChecklistChange?: (controls: Record<string, { stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'; note: string }>) => void;
  readOnly?: boolean;
  exportView?: boolean;
  onClose?: () => void;
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
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Carica i controlli esistenti dal database
  useEffect(() => {
    if (!vehicleId && !appointmentId) {
      setLoading(false);
      return;
    }

    async function loadExistingControls() {
      try {
        setLoading(true);
        
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
                console.log(`Controlli trovati in ${path}:`, data);
                foundControls = normalizeControls(data);
                foundPath = path;
                break;
              }
            }
          }
        }
        
        if (foundControls) {
          console.log(`Utilizzo controlli da ${foundPath}`);
          setControls(foundControls);
        } else {
          console.log("Nessun controllo trovato nei percorsi disponibili");
        }
      } catch (error) {
        console.error("Errore nel caricamento dei controlli:", error);
      } finally {
        setLoading(false);
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
  const handleControlChange = (parameterId: string, newState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE') => {
    if (readOnly) return;
    
    const updatedControls = {
      ...controls,
      [parameterId]: {
        ...controls[parameterId],
        stato: newState
      }
    };
    
    setControls(updatedControls);
    
    // Utilizza la funzione centralizzata per salvare il controllo
    const control = updatedControls[parameterId] || { stato: newState, note: '' };
    saveChecklistControl(vehicleId || null, appointmentId || null, parameterId, control)
      .then(() => {
        console.log(`Stato del controllo ${parameterId} aggiornato con successo`);
        if (onChecklistChange) {
          onChecklistChange(updatedControls);
        }
      })
      .catch(error => {
        console.error(`Errore nell'aggiornamento dello stato del controllo ${parameterId}:`, error);
      });
  };

  // Gestisce il cambio delle note di un controllo
  const handleNoteChange = (parameterId: string, newNote: string) => {
    if (readOnly) return;
    
    const updatedControls = {
      ...controls,
      [parameterId]: {
        ...controls[parameterId],
        note: newNote
      }
    };
    
    setControls(updatedControls);
    
    // Utilizza la funzione centralizzata per salvare il controllo
    const control = updatedControls[parameterId] || { stato: 'NON CONTROLLATO', note: newNote };
    saveChecklistControl(vehicleId || null, appointmentId || null, parameterId, control)
      .then(() => {
        console.log(`Note del controllo ${parameterId} aggiornate con successo`);
        if (onChecklistChange) {
          onChecklistChange(updatedControls);
        }
      })
      .catch(error => {
        console.error(`Errore nell'aggiornamento delle note del controllo ${parameterId}:`, error);
      });
  };

  return (
    <ChecklistParameterLoader>
      {({ parameters, mapping, loading: loadingParams, error }) => {
        // Imposta la sezione attiva basandoti sulla presenza di parametri
        useEffect(() => {
          if (!loadingParams && !activeSection) {
            // Ordine standard delle sezioni (in ordine di priorità)
            const standardSections = [
              "Motore",
              "Sistema Sterzo",
              "Sistema Freni",
              "Sospensione Anteriore",
              "Pneumatici",
              "Altro"
            ];
            
            // Trova la prima sezione non vuota nell'ordine standard
            const firstNonEmptySection = standardSections.find(
              section => mapping[section] && mapping[section].length > 0
            );
            
            // Se nessuna sezione standard ha parametri, trova la prima sezione non vuota
            if (!firstNonEmptySection) {
              const firstSection = Object.entries(mapping).find(
                ([_, paramIds]) => paramIds && paramIds.length > 0
              );
              
              if (firstSection) {
                setActiveSection(firstSection[0]);
              }
            } else {
              setActiveSection(firstNonEmptySection);
            }
          }
        }, [loadingParams, mapping, activeSection]);
        
        // Filtra le sezioni che hanno effettivamente parametri
        const sectionsWithParameters = Object.entries(mapping)
          .filter(([_, paramIds]) => paramIds && paramIds.length > 0)
          .map(([section]) => section);
        
        if (loading || loadingParams) {
          return <div className="p-4 text-center">Caricamento checklist...</div>;
        }
        
        if (error) {
          return <div className="p-4 text-red-500">Errore: {error.message}</div>;
        }
        
        if (sectionsWithParameters.length === 0) {
          return <div className="p-4 text-center">Nessun parametro configurato per la checklist</div>;
        }
        
        // Se è richiesta la visualizzazione di esportazione, renderizza il componente di esportazione
        if (exportView) {
          return <ExportViewChecklist 
            sections={mapping} 
            parameters={parameters} 
            controls={controls} 
          />;
        }
        
        const activeIndex = activeSection ? sectionsWithParameters.indexOf(activeSection) : 0;
        
        return (
          <div className="p-4 bg-background rounded-lg shadow">
            <Tabs 
              selectedIndex={activeIndex >= 0 ? activeIndex : 0}
              onSelect={(index: number) => setActiveSection(sectionsWithParameters[index])}
            >
              <TabList className="flex flex-wrap border-b border-border">
                {sectionsWithParameters.map((section) => (
                  <Tab 
                    key={section}
                    className="px-4 py-2 border-b-2 border-transparent cursor-pointer hover:text-primary transition-colors selected:border-primary selected:text-primary"
                    selectedClassName="border-primary text-primary"
                  >
                    {section} ({mapping[section].length})
                  </Tab>
                ))}
              </TabList>
              
              {sectionsWithParameters.map((section) => (
                <TabPanel key={section}>
                  <DynamicChecklistSection
                    sectionName={section}
                    parameters={parameters}
                    parameterIds={mapping[section]}
                    controls={controls}
                    onControlChange={handleControlChange}
                    onNoteChange={handleNoteChange}
                  />
                </TabPanel>
              ))}
            </Tabs>
            
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
      }}
    </ChecklistParameterLoader>
  );
}

export default DynamicChecklist; 