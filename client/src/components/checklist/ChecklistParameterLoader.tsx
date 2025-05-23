import { rtdb as database } from '../../firebase';
import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";

// Definizione dei tipi
interface ChecklistParameter {
  name: string;
  section: string;
  defaultState: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
}

interface ChecklistParameterMapping {
  [key: string]: string[];
}

export function useChecklistParameters() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [parameters, setParameters] = useState<Record<string, ChecklistParameter>>({});
  const [mapping, setMapping] = useState<ChecklistParameterMapping>({
    "Motore": [],
    "Sistema Sterzo": [],
    "Sistema Freni": [],
    "Sospensione Anteriore": [],
    "Pneumatici": [],
    "Altro": []
  });

  useEffect(() => {
    async function loadParameters() {
      try {
        setLoading(true);
        console.log("Caricamento parametri checklist dal database...");
        
        // Utilizziamo un unico percorso standardizzato per i parametri
        const parametersRef = ref(database, "parameters");
        const snapshot = await get(parametersRef);
        
        if (snapshot.exists()) {
          const parametersData = snapshot.val();
          console.log(`Trovati ${Object.keys(parametersData).length} parametri nella tabella 'parameters'`);
          setParameters(parametersData);
          
          // Inizializza il mapping con le sezioni predefinite
          const newMapping: ChecklistParameterMapping = {
            "Motore": [],
            "Sistema Sterzo": [],
            "Sistema Freni": [],
            "Sospensione Anteriore": [],
            "Pneumatici": [],
            "Altro": []
          };
          
          // Contatori per debugging
          const sectionCounts: Record<string, number> = {};
          
          // Mappa i parametri alle loro sezioni
          Object.entries(parametersData).forEach(([parameterId, parameterValue]) => {
            const parameter = parameterValue as ChecklistParameter;
            const section = parameter.section;
            
            // Incrementa il contatore per questa sezione
            sectionCounts[section] = (sectionCounts[section] || 0) + 1;
            
            // Se la sezione non è valida o non esiste, assegna ad "Altro"
            if (!section || !newMapping[section]) {
              // Se "Altro" non esiste, crealo
              if (!newMapping["Altro"]) {
                newMapping["Altro"] = [];
              }
              
              newMapping["Altro"].push(parameterId);
            } else {
              // Se la sezione esiste ma l'array non è inizializzato, crealo
              if (!newMapping[section]) {
                newMapping[section] = [];
              }
              
              newMapping[section].push(parameterId);
            }
          });
          
          // Stampa statistiche di riassunto 
          console.log("Distribuzione parametri per sezione:");
          Object.entries(sectionCounts).forEach(([section, count]) => {
            console.log(`- ${section}: ${count} parametri`);
          });
          
          // Informazioni dettagliate solo per debug avanzato
          if (process.env.NODE_ENV === 'development') {
            Object.entries(newMapping).forEach(([section, parameterIds]) => {
              if (parameterIds.length > 0) {
                console.log(`Parametri in sezione "${section}":`);
                parameterIds.forEach(parameterId => {
                  console.log(`  - ${parameterId}: ${parametersData[parameterId]?.name}`);
                });
              }
            });
          }
          
          setMapping(newMapping);
        } else {
          console.log("Nessun parametro trovato nella tabella 'parameters'");
          // Mantieni il mapping predefinito vuoto
        }
      } catch (error) {
        console.error("Errore nel caricamento dei parametri:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    }

    loadParameters();
  }, []);

  return { parameters, mapping, loading, error };
}

interface ChecklistParameterLoaderProps {
  children: (data: {
    parameters: Record<string, ChecklistParameter>;
    mapping: ChecklistParameterMapping;
    loading: boolean;
    error: Error | null;
  }) => React.ReactNode;
}

export default function ChecklistParameterLoader({ 
  children 
}: ChecklistParameterLoaderProps) {
  const { parameters, mapping, loading, error } = useChecklistParameters();
  
  return <>{children({ parameters, mapping, loading, error })}</>;
} 