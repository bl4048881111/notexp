import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, Check, X, Clipboard, Save } from 'lucide-react';
import { ref, get, update } from 'firebase/database';
import { rtdb } from '../../firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Controllo {
  stato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
  note: string;
}

interface ControlliVeicolo {
  [key: string]: Controllo;
}

interface SchedaIspezioneVeicoloProps {
  vehicleId: string;
  appointmentId?: string;
  model?: string;
  kilometrage?: string | number;
  clientName?: string;
  vehicleType?: string;
  inspectionDate?: string;
  parametri?: {
    [key: string]: string | number;
  };
}

export default function SchedaIspezioneVeicolo({ vehicleId, appointmentId, model, kilometrage, clientName, vehicleType, inspectionDate, parametri: parametriIniziali }: SchedaIspezioneVeicoloProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [parametri, setParametri] = useState<{[key: string]: string | number}>({});
  const [nuovoParametroChiave, setNuovoParametroChiave] = useState<string>('');
  const [nuovoParametroValore, setNuovoParametroValore] = useState<string>('');
  const [parametriDialog, setParametriDialog] = useState<boolean>(false);
  
  // Stato principale sincronizzato con il database
  const [controlliVeicolo, setControlliVeicolo] = useState<ControlliVeicolo>({
    // Motore
    livelloOlioMotore: { stato: 'CONTROLLATO', note: '' },
    livelloRefrigerante: { stato: 'CONTROLLATO', note: '' },
    olioMotore: { stato: 'DA FARE', note: '' },
    filtroOlio: { stato: 'DA FARE', note: '' },
    filtroAria: { stato: 'DA FARE', note: '' },
    filtroAbitacolo: { stato: 'DA FARE', note: '' },
    cinghiaServizi: { stato: 'CONTROLLATO', note: '' },
    cinghiaDistribuzione: { stato: 'CONTROLLATO', note: '' },
    
    // Sterzo
    tiranteDx: { stato: 'CONTROLLATO', note: '' },
    tiranteSx: { stato: 'CONTROLLATO', note: '' },
    testinaDx: { stato: 'CONTROLLATO', note: '' },
    testinaSx: { stato: 'CONTROLLATO', note: '' },
    cuffiaTiranteDx: { stato: 'CONTROLLATO', note: '' },
    cuffiaTiranteSx: { stato: 'CONTROLLATO', note: '' },
    
    // Freni
    livelloOlioFreni: { stato: 'CONTROLLATO', note: '' },
    discoAntSx: { stato: 'DA FARE', note: '' },
    discoAntDx: { stato: 'DA FARE', note: '' },
    discoPostSx: { stato: 'DA FARE', note: '' },
    discoPostDx: { stato: 'DA FARE', note: '' },
    pastiglieAntSx: { stato: 'CONTROLLATO', note: '' },
    pastiglieAntDx: { stato: 'CONTROLLATO', note: '' },
    pastigliePostSx: { stato: 'CONTROLLATO', note: '' },
    pastigliePostDx: { stato: 'CONTROLLATO', note: '' },
    tubiFrenoAnt: { stato: 'CONTROLLATO', note: '' },
    tubiFrenoPost: { stato: 'CONTROLLATO', note: '' },
    sistemaVacuum: { stato: 'CONTROLLATO', note: '' },

    // Sospensione anteriore
    ammortizzatoreAnterioreS: { stato: 'CONTROLLATO', note: '' },
    ammortizzatoreAnterioreD: { stato: 'CONTROLLATO', note: '' },
    paraPolvere: { stato: 'CONTROLLATO', note: '' },
    cuffiaStelo: { stato: 'CONTROLLATO', note: '' },
    mollaElicoidaleAnterioreS: { stato: 'CONTROLLATO', note: '' },
    mollaElicoidaleAnterioreD: { stato: 'CONTROLLATO', note: '' },
    tiranteAmmortizzatoreSospesoS: { stato: 'DA FARE', note: '' },
    tiranteAmmortizzatoreSospesoD: { stato: 'DA FARE', note: '' },
    braccioInferioreS: { stato: 'CONTROLLATO', note: '' },
    braccioInferioreD: { stato: 'CONTROLLATO', note: '' },
    barraStabilizzatriceAnte: { stato: 'CONTROLLATO', note: '' },
    gomminiBarraStabilizzatrice: { stato: 'CONTROLLATO', note: '' },

    // Pneumatici
    battistradaAnt: { stato: 'CONTROLLATO', note: '' },
    battistradaPost: { stato: 'CONTROLLATO', note: '' },
    controlloPressione: { stato: 'CONTROLLATO', note: '' },
    
    // Prova su strada
    provaSuStrada: { stato: 'CONTROLLATO', note: '' }
  });

  // Copia locale per modifiche prima del salvataggio - questa non viene sincronizzata finché non si salva
  const [controlliLocali, setControlliLocali] = useState<ControlliVeicolo>({});
  
  // Stati di lavoro
  const [commenti, setCommenti] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSaving, setNeedsSaving] = useState(false);

  // Inizializza i parametri
  useEffect(() => {
    if (parametriIniziali) {
      setParametri(parametriIniziali);
    }
  }, [parametriIniziali]);

  // Funzione per memorizzare la posizione di scroll
  const memorizzaPosizione = useCallback(() => {
    if (modalContentRef.current) {
      setScrollPosition(modalContentRef.current.scrollTop);
    }
  }, []);

  // Aggiungi event listener per lo scroll
  useEffect(() => {
    const modalContent = modalContentRef.current;
    if (modalContent) {
      modalContent.addEventListener('scroll', memorizzaPosizione);
      return () => {
        modalContent.removeEventListener('scroll', memorizzaPosizione);
      };
    }
  }, [memorizzaPosizione]);

  // Ripristina la posizione di scroll quando cambia lo stato
  useEffect(() => {
    if (modalContentRef.current && !isUpdating) {
      // Utilizza una variabile per tenere traccia se si sta digitando
      const activeElement = document.activeElement;
      const isInputActive = activeElement && 
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      
      // Ripristina lo scroll solo se non si sta digitando in un input
      if (!isInputActive) {
        setTimeout(() => {
          if (modalContentRef.current) {
            modalContentRef.current.scrollTop = scrollPosition;
          }
        }, 10);
      }
    }
  }, [controlliVeicolo, scrollPosition, isUpdating]);

  // Inizializza i controlli locali quando si apre una sezione
  useEffect(() => {
    if (openSection) {
      setControlliLocali({...controlliVeicolo});
    }
  }, [openSection, controlliVeicolo]);

  // Carica i dati dal database
  useEffect(() => {
    const loadChecklistData = async () => {
      setIsLoading(true);
      try {
        let checklistData = null;
        
        // Utilizziamo prima l'appointmentId se disponibile (prioritario)
        if (appointmentId) {
          console.log(`Tentativo di caricamento dati usando appointmentId: ${appointmentId}`);
          
          // Prova a caricare dai percorsi relativi all'appuntamento
          const percorsiAppuntamento = [
            `appointments/${appointmentId}`,
            `appointments/${appointmentId}/checklist`,
            `appointments/${appointmentId}/workingPhase`,
            `appointments/${appointmentId}/lavorazione`
          ];
          
          for (const percorso of percorsiAppuntamento) {
            try {
              const percorsoRef = ref(rtdb, percorso);
              const percorsoSnapshot = await get(percorsoRef);
              
              if (percorsoSnapshot.exists()) {
                const percorsoData = percorsoSnapshot.val();
                
                // Verifica se i dati sono direttamente la checklist o contengono un campo checklist
                if (percorsoData.checklist) {
                  checklistData = percorsoData.checklist;
                  console.log(`Trovata checklist nel percorso ${percorso}`);
                  break;
                } else if (Object.keys(percorsoData).length > 0 && 
                          percorsoData.livelloOlioMotore !== undefined) {
                  // Sembra che i dati siano direttamente la checklist
                  checklistData = percorsoData;
                  console.log(`Trovata checklist diretta nel percorso ${percorso}`);
                  break;
                }
              }
            } catch (e) {
              console.error(`Errore nel caricamento da percorso appuntamento ${percorso}:`, e);
            }
          }
        }
        
        // Se non abbiamo trovato dati usando l'appointmentId, proviamo con il vehicleId come fallback
        if (!checklistData && vehicleId) {
          console.log(`Fallback al caricamento usando vehicleId: ${vehicleId}`);
          
          // Proviamo prima il percorso principale
          const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
          const snapshot = await get(vehicleRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.checklist) {
              checklistData = data.checklist;
              console.log(`Trovata checklist nel percorso vehicles/${vehicleId}`);
            }
            
            if (data.commenti) {
              setCommenti(data.commenti);
            }
          }
          
          // Se non troviamo i dati nel percorso principale, proviamo la sezione lavorazione
          if (!checklistData) {
            const lavorazioneRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione`);
            const lavorazioneSnapshot = await get(lavorazioneRef);
            
            if (lavorazioneSnapshot.exists()) {
              const lavorazioneData = lavorazioneSnapshot.val();
              if (lavorazioneData.checklist) {
                checklistData = lavorazioneData.checklist;
                console.log(`Trovata checklist nel percorso vehicles/${vehicleId}/lavorazione`);
              }
              if (lavorazioneData.commenti) {
                setCommenti(lavorazioneData.commenti);
              }
            }
          }
          
          // Prova percorsi alternativi se ancora nessun dato
          if (!checklistData) {
            const percorsiAlternativi = [
              `vehicles/${vehicleId}/workingPhase`,
              `vehicles/${vehicleId}/fase2`,
              `workingPhase/${vehicleId}`,
              `lavorazione/${vehicleId}`
            ];
            
            for (const percorso of percorsiAlternativi) {
              try {
                const percorsoRef = ref(rtdb, percorso);
                const percorsoSnapshot = await get(percorsoRef);
                
                if (percorsoSnapshot.exists()) {
                  const percorsoData = percorsoSnapshot.val();
                  if (percorsoData.checklist) {
                    checklistData = percorsoData.checklist;
                    console.log(`Trovata checklist nel percorso ${percorso}`);
                    break;
                  }
                }
              } catch (e) {
                console.error(`Errore nel caricamento dal percorso ${percorso}:`, e);
              }
            }
          }
        }
        
        // Se abbiamo trovato i dati, aggiorniamo lo stato
        if (checklistData) {
          // Assicuriamoci che le note vuote rimangano vuote e non vengano sovrascritte
          for (const componente in checklistData) {
            if (checklistData[componente]?.note === undefined) {
              checklistData[componente].note = '';
            }
          }
          
          setControlliVeicolo(checklistData);
          setControlliLocali(checklistData);
          console.log("Dati checklist caricati con successo");
        } else {
          console.warn("Nessun dato di checklist trovato nei percorsi controllati");
        }
      } catch (error) {
        console.error('Errore nel caricamento della checklist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChecklistData();
  }, [vehicleId, appointmentId]);

  // Modifica anche la funzione di salvataggio per aggiornare anche nell'appointmentId
  const salvaModifiche = async () => {
    setIsUpdating(true);
    // Impostiamo immediatamente needsSaving a false per nascondere il pulsante
    setNeedsSaving(false);
    
    // Debug: mostriamo i valori attuali
    console.log("Valori locali prima del salvataggio:", JSON.stringify(controlliLocali, null, 2));
    
    // Prepariamo i dati da salvare con clonazione profonda per evitare riferimenti
    const nuoviControlli: ControlliVeicolo = {};
    
    // Crea una nuova struttura da zero con i valori esatti degli input
    Object.keys(controlliVeicolo).forEach((key) => {
      const k = key as keyof ControlliVeicolo;
      nuoviControlli[k] = {
        stato: controlliVeicolo[k]?.stato || 'DA FARE',
        note: '' // Inizializziamo con stringa vuota
      };
    });
    
    // Ora sovrascriviamo con i valori dai controlli locali
    Object.keys(controlliLocali).forEach((key) => {
      const k = key as keyof ControlliVeicolo;
      if (controlliLocali[k]) {
        nuoviControlli[k] = {
          stato: controlliLocali[k]?.stato || nuoviControlli[k]?.stato || 'DA FARE',
          note: controlliLocali[k]?.note // Manteniamo il valore esatto, anche se è stringa vuota
        };
      }
    });
    
    // Debug: mostriamo cosa stiamo per salvare
    console.log("Dati da salvare nel database:", JSON.stringify(nuoviControlli, null, 2));
    
    // Aggiorna lo stato principale
    setControlliVeicolo(nuoviControlli);
    
    try {
      // Percorsi da aggiornare
      const percorsiDaSalvare = [];
      
      // Se abbiamo un appointmentId, salviamo lì
      if (appointmentId) {
        percorsiDaSalvare.push(
          `appointments/${appointmentId}/checklist`
        );
      }
      
      // Per i veicoli, usiamo solo il percorso standardizzato
      if (vehicleId) {
        percorsiDaSalvare.push(
          `vehicles/${vehicleId}/lavorazione/checklist`
        );
      }
      
      // Esegui l'aggiornamento solo nei percorsi standardizzati
      for (const percorso of percorsiDaSalvare) {
        try {
          const percorsoRef = ref(rtdb, percorso);
          await update(percorsoRef, {
            checklist: nuoviControlli
          });
          console.log(`Dati salvati con successo in ${percorso}`);
        } catch (e) {
          console.error(`Errore nel salvataggio in ${percorso}:`, e);
        }
      }
      
      // Conferma salvataggio completato
      console.log("Salvataggio completato con successo");
    } catch (error) {
      console.error('Errore nel salvataggio della checklist:', error);
      // In caso di errore, ripristiniamo needsSaving per mostrare nuovamente il pulsante
      setNeedsSaving(true);
    } finally {
      setIsUpdating(false);
    }
  };

  // Gestione cambio stato (ora salva solo localmente senza aggiornare il database)
  const cambiaStato = (componente: keyof ControlliVeicolo, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Salva posizione scroll corrente
    memorizzaPosizione();
    
    const statoAttuale = controlliLocali[componente]?.stato || controlliVeicolo[componente]?.stato || 'DA FARE';
    let nuovoStato: 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE';
    
    if (statoAttuale === 'CONTROLLATO') {
      nuovoStato = 'NON CONTROLLATO';
    } else if (statoAttuale === 'NON CONTROLLATO') {
      nuovoStato = 'DA FARE';
    } else {
      nuovoStato = 'CONTROLLATO';
    }
    
    // Preserviamo la nota esistente durante il cambio di stato
    const notaEsistente = controlliLocali[componente]?.note !== undefined 
      ? controlliLocali[componente].note 
      : controlliVeicolo[componente]?.note || '';
    
    // Aggiorna i controlli locali, non salva nel database
    setControlliLocali(prev => ({
      ...prev,
      [componente]: {
        ...prev[componente] || {},
        stato: nuovoStato,
        note: notaEsistente  // Preserva la nota esistente
      }
    }));
    
    // Non aggiorniamo controlliVeicolo qui per evitare il re-render che causa la perdita di focus
    // Impostiamo solo needsSaving per indicare che ci sono modifiche da salvare
    setNeedsSaving(true);
  };

  // Gestione input delle note (solo a livello locale, senza salvataggio nel database)
  const gestisciInputNote = (componente: keyof ControlliVeicolo, nuovaNota: string) => {
    setControlliLocali(prev => {
      // Evita aggiornamenti inutili se il valore non è cambiato
      if (prev[componente]?.note === nuovaNota) return prev;
      
      return {
        ...prev,
        [componente]: {
          ...prev[componente] || {},
          note: nuovaNota
        }
      };
    });
    
    // Imposta needsSaving solo se c'è una modifica effettiva
    if (controlliVeicolo[componente]?.note !== nuovaNota) {
      setNeedsSaving(true);
    }
  };
  
  // Chiudi sezione con salvataggio
  const chiudiConSalvataggio = async () => {
    if (needsSaving) {
      await salvaModifiche();
    }
    setOpenSection(null);
  };

  const modificaCommenti = async (nuoviCommenti: string) => {
    setCommenti(nuoviCommenti);
    
    try {
      // Percorsi da aggiornare
      const percorsiDaSalvare = [
        // Percorso principale
        ref(rtdb, `vehicles/${vehicleId}`),
        // Percorso lavorazione
        ref(rtdb, `vehicles/${vehicleId}/lavorazione`),
        // Percorsi alternativi
        ref(rtdb, `vehicles/${vehicleId}/workingPhase`),
        ref(rtdb, `vehicles/${vehicleId}/fase2`),
        ref(rtdb, `workingPhase/${vehicleId}`),
        ref(rtdb, `lavorazione/${vehicleId}`)
      ];
      
      // Esegui ogni aggiornamento in una chiamata separata
      for (const percorsoRef of percorsiDaSalvare) {
        try {
          const snapshot = await get(percorsoRef);
          if (snapshot.exists()) {
            // Aggiorna con tutti i possibili nomi dei campi per i commenti
            await update(percorsoRef, {
              commenti: nuoviCommenti,
              note: nuoviCommenti,
              noteGenerali: nuoviCommenti
            });
          }
        } catch (e) {
          console.error(`Errore nell'aggiornamento dei commenti in ${percorsoRef.key}:`, e);
        }
      }
    } catch (error) {
      console.error('Errore nel salvataggio dei commenti:', error);
    }
  };

  const StatusIcon = ({ status }: { status: Controllo['stato'] }) => {
    if (status === 'CONTROLLATO') {
      return <Check className="text-green-500" size={20} />;
    } else if (status === 'NON CONTROLLATO') {
      return <X className="text-orange-500" size={20} />;
    } else {
      return <AlertTriangle className="text-gray-500" size={20} />;
    }
  };

  const sections = [
    { 
      id: 'motore', 
      title: 'Motore',
      components: [
        { key: 'livelloOlioMotore', label: 'Livello olio motore' },
        { key: 'livelloRefrigerante', label: 'Livello refrigerante' },
        { key: 'olioMotore', label: 'Olio motore' },
        { key: 'filtroOlio', label: 'Filtro olio' },
        { key: 'filtroAria', label: 'Filtro aria' },
        { key: 'filtroAbitacolo', label: 'Filtro abitacolo' },
        { key: 'cinghiaServizi', label: 'Cinghia servizi' },
        { key: 'cinghiaDistribuzione', label: 'Cinghia distribuzione' },
      ]
    },
    { 
      id: 'sterzo', 
      title: 'Sistema Sterzo',
      components: [
        { key: 'tiranteDx', label: 'Tirante Destro' },
        { key: 'tiranteSx', label: 'Tirante Sinistro' },
        { key: 'testinaDx', label: 'Testina Destra' },
        { key: 'testinaSx', label: 'Testina Sinistra' },
        { key: 'cuffiaTiranteDx', label: 'Cuffia Tirante Destra' },
        { key: 'cuffiaTiranteSx', label: 'Cuffia Tirante Sinistra' },
      ]
    },
    { 
      id: 'freni', 
      title: 'Sistema Freni',
      components: [
        { key: 'livelloOlioFreni', label: 'Livello Olio Freni' },
        { key: 'discoAntSx', label: 'Disco Anteriore Sinistro', defaultNote: '' },
        { key: 'discoAntDx', label: 'Disco Anteriore Destro', defaultNote: '' },
        { key: 'discoPostSx', label: 'Disco Posteriore Sinistro', defaultNote: '' },
        { key: 'discoPostDx', label: 'Disco Posteriore Destro', defaultNote: '' },
        { key: 'pastiglieAntSx', label: 'Pastiglie Anteriore Sinistro' },
        { key: 'pastiglieAntDx', label: 'Pastiglie Anteriore Destro' },
        { key: 'pastigliePostSx', label: 'Pastiglie Posteriore Sinistro' },
        { key: 'pastigliePostDx', label: 'Pastiglie Posteriore Destro' },
        { key: 'tubiFrenoAnt', label: 'Tubi Freno Anteriore' },
        { key: 'tubiFrenoPost', label: 'Tubi Freno Posteriore' },
        { key: 'sistemaVacuum', label: 'Sistema Vacuum' },
      ]
    },
    { 
      id: 'sospensione', 
      title: 'Sospensione Anteriore',
      components: [
        { key: 'ammortizzatoreAnterioreS', label: 'Ammortizzatore Anteriore Sinistro' },
        { key: 'ammortizzatoreAnterioreD', label: 'Ammortizzatore Anteriore Destro' },
        { key: 'paraPolvere', label: 'Para Polvere' },
        { key: 'cuffiaStelo', label: 'Cuffia Stelo' },
        { key: 'mollaElicoidaleAnterioreS', label: 'Molla Elicoidale Anteriore Sinistro' },
        { key: 'mollaElicoidaleAnterioreD', label: 'Molla Elicoidale Anteriore Destro' },
        { key: 'tiranteAmmortizzatoreSospesoS', label: 'Tirante Ammortizzatore Sospeso Sinistro' },
        { key: 'tiranteAmmortizzatoreSospesoD', label: 'Tirante Ammortizzatore Sospeso Destro' },
        { key: 'braccioInferioreS', label: 'Braccio Inferiore Sinistro' },
        { key: 'braccioInferioreD', label: 'Braccio Inferiore Destro' },
        { key: 'barraStabilizzatriceAnte', label: 'Barra Stabilizzatrice Anteriore' },
        { key: 'gomminiBarraStabilizzatrice', label: 'Gommini Barra Stabilizzatrice' },
      ]
    },
    { 
      id: 'pneumatici', 
      title: 'Pneumatici',
      components: [
        { key: 'battistradaAnt', label: 'Battistrada Anteriore', defaultNote: '' },
        { key: 'battistradaPost', label: 'Battistrada Posteriore', defaultNote: '' },
        { key: 'controlloPressione', label: 'Controllo Pressione' },
      ]
    },
  ];

  // Aggiungiamo una funzione per caricare e aggiornare dinamicamente i componenti della checklist
  const [dynamicSections, setDynamicSections] = useState(sections);

  // Carica tutti i parametri dal database e li organizza nelle sezioni
  useEffect(() => {
    const loadDynamicParameters = async () => {
      try {
        console.log("Caricamento parametri dinamici...");
        const parametersRef = ref(rtdb, 'parameters');
        const parametersSnapshot = await get(parametersRef);
        
        if (parametersSnapshot.exists()) {
          const parametersData = parametersSnapshot.val();
          
          // Creiamo una copia delle sezioni su cui lavorare
          const updatedSections = [...sections];
          
          // Mappa per verificare i parametri già inclusi nelle sezioni predefinite
          const existingParameters = new Set();
          updatedSections.forEach(section => {
            section.components.forEach(comp => {
              existingParameters.add(comp.key);
            });
          });
          
          // Aggiungiamo i parametri dal database alle rispettive sezioni
          Object.entries(parametersData).forEach(([parameterId, paramData]: [string, any]) => {
            // Se il parametro è già incluso nelle sezioni predefinite, lo saltiamo
            if (existingParameters.has(parameterId)) {
              return;
            }
            
            // Troviamo la sezione corrispondente o ne creiamo una nuova
            const sectionTitle = paramData.section || 'Altro';
            let sectionIndex = updatedSections.findIndex(s => s.title === sectionTitle);
            
            if (sectionIndex === -1) {
              // Se la sezione non esiste, la creiamo
              updatedSections.push({
                id: sectionTitle.toLowerCase().replace(/\s+/g, ''),
                title: sectionTitle,
                components: []
              });
              sectionIndex = updatedSections.length - 1;
            }
            
            // Aggiungiamo il parametro alla sezione
            console.log(`Aggiunto parametro dinamico: ${paramData.name} (${parameterId}) alla sezione ${sectionTitle}`);
            updatedSections[sectionIndex].components.push({
              key: parameterId,
              label: paramData.name
            });
          });
          
          // Aggiorniamo lo stato con le nuove sezioni
          setDynamicSections(updatedSections);
        }
      } catch (error) {
        console.error("Errore nel caricamento dei parametri dinamici:", error);
      }
    };
    
    loadDynamicParameters();
  }, [vehicleId, appointmentId]); // Riesegui quando cambia il veicolo o l'appuntamento

  const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-lg border border-border">
          <div className="flex justify-between items-center p-4 bg-muted/90 border-b border-border">
            <h2 className="text-xl font-bold text-orange-500">{title}</h2>
            <div className="flex items-center gap-2">
              {needsSaving && (
                <button 
                  onClick={salvaModifiche} 
                  className="bg-primary hover:bg-primary/90 text-white px-3 py-1 rounded flex items-center gap-1 text-sm"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1"></div>
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Salva
                    </>
                  )}
                </button>
              )}
              <button 
                onClick={chiudiConSalvataggio} 
                className="text-orange-500 hover:text-orange-400 transition-colors"
                disabled={isUpdating}
              >
                <X size={24} />
              </button>
            </div>
          </div>
          <div 
            ref={modalContentRef} 
            className="p-0 overflow-y-auto max-h-[calc(80vh-70px)] scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  };

  // Componenti nella tabella del popup
  const TableComponent = ({ 
    label, 
    keyName, 
    defaultNote 
  }: { 
    label: string; 
    keyName: keyof ControlliVeicolo; 
    defaultNote?: string 
  }) => {
    // Stato locale per il valore dell'input
    const [inputValue, setInputValue] = useState<string>('');
    
    // Stato locale per lo stato del componente
    const [showStatus, setShowStatus] = useState<'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'>(
      (controlliLocali[keyName]?.stato || controlliVeicolo[keyName]?.stato || 'DA FARE') as 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'
    );
    
    // Imposta il valore iniziale all'avvio e quando cambiano i valori esterni
    useEffect(() => {
      const initialValue = controlliLocali[keyName]?.note !== undefined 
        ? controlliLocali[keyName].note 
        : controlliVeicolo[keyName]?.note !== undefined 
          ? controlliVeicolo[keyName].note 
          : defaultNote || '';
          
      setInputValue(initialValue);
    }, [controlliLocali[keyName]?.note, controlliVeicolo[keyName]?.note, keyName, defaultNote]);
    
    // Aggiorna lo stato visualizzato quando cambiano i controlli locali
    useEffect(() => {
      setShowStatus((controlliLocali[keyName]?.stato || controlliVeicolo[keyName]?.stato || 'DA FARE') as 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE');
    }, [controlliLocali[keyName]?.stato, controlliVeicolo[keyName]?.stato, keyName]);
    
    // Gestisce il cambio del valore dell'input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    };
    
    // Salva le note solo quando l'utente perde il focus
    const handleBlur = () => {
      // Aggiorna solo se il valore è cambiato
      if (controlliLocali[keyName]?.note !== inputValue) {
        setControlliLocali(prev => ({
          ...prev,
          [keyName]: {
            ...prev[keyName] || {},
            stato: prev[keyName]?.stato || controlliVeicolo[keyName]?.stato || 'DA FARE',
            note: inputValue
          }
        }));
        
        // Imposta needsSaving se il valore è cambiato rispetto al database
        if (controlliVeicolo[keyName]?.note !== inputValue) {
          setNeedsSaving(true);
        }
      }
    };
    
    return (
      <div className="py-4 border-b border-border flex items-center">
        <div className="font-medium w-1/3">{label}</div>
        <div className="w-24 text-center">
          <button 
            onClick={(e) => cambiaStato(keyName, e)} 
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <StatusIcon status={showStatus} />
          </button>
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-full p-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Aggiungi note..."
            onFocus={memorizzaPosizione}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
      </div>
    );
  };

  // Stato locale per modifiche alla scheda principale
  const [notaProvaStrada, setNotaProvaStrada] = useState<string>('');
  useEffect(() => {
    setNotaProvaStrada(controlliVeicolo.provaSuStrada?.note || '');
  }, [controlliVeicolo.provaSuStrada?.note]);

  // Componente StatusIcon migliorato per la Prova su Strada
  const ProvaSuStradaStatusIcon = () => {
    const [statusIcon, setStatusIcon] = useState<'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'>(
      (controlliLocali.provaSuStrada?.stato || controlliVeicolo.provaSuStrada?.stato || 'CONTROLLATO') as 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE'
    );
    
    useEffect(() => {
      setStatusIcon((controlliLocali.provaSuStrada?.stato || controlliVeicolo.provaSuStrada?.stato || 'CONTROLLATO') as 'CONTROLLATO' | 'NON CONTROLLATO' | 'DA FARE');
    }, [controlliLocali.provaSuStrada?.stato, controlliVeicolo.provaSuStrada?.stato]);
    
    return <StatusIcon status={statusIcon} />;
  };

  // Funzione per gestire il cambiamento della nota prova su strada
  const handleNotaProvaSuStradaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotaProvaStrada(e.target.value);
    // Impostiamo needsSaving se il valore è cambiato rispetto al database
    if (controlliVeicolo.provaSuStrada?.note !== e.target.value) {
      setNeedsSaving(true);
    }
  };
  
  // Salva la nota della prova su strada quando l'input perde focus
  const handleNotaProvaSuStradaBlur = () => {
    if (controlliVeicolo.provaSuStrada?.note !== notaProvaStrada) {
      // Aggiorniamo i controlli locali
      setControlliLocali(prev => ({
        ...prev,
        provaSuStrada: {
          ...prev.provaSuStrada || {},
          stato: prev.provaSuStrada?.stato || controlliVeicolo.provaSuStrada?.stato || 'CONTROLLATO',
          note: notaProvaStrada
        }
      }));
      
      // Salviamo nel database
      salvaNotaProvaStrada(notaProvaStrada);
    }
  };
  
  // Salva la nota della prova su strada
  const salvaNotaProvaStrada = async (nuovaNota: string) => {
    if (nuovaNota === controlliVeicolo.provaSuStrada?.note) return;
    
    setIsUpdating(true);
    
    const nuoviControlli = {
      ...controlliVeicolo,
      provaSuStrada: {
        ...controlliVeicolo.provaSuStrada || { stato: 'CONTROLLATO' },
        note: nuovaNota
      }
    };
    
    setControlliVeicolo(nuoviControlli);
    
    try {
      // Prima, verifica in quali posizioni sono salvati i dati della checklist
      const percorsiDaSalvare = [];
      
      // Percorso principale
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      let vehicleData = snapshot.exists() ? snapshot.val() : {};
      percorsiDaSalvare.push({
        ref: vehicleRef,
        data: vehicleData
      });
      
      // Percorso lavorazione
      const lavorazioneRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione`);
      const lavorazioneSnapshot = await get(lavorazioneRef);
      if (lavorazioneSnapshot.exists()) {
        percorsiDaSalvare.push({
          ref: lavorazioneRef,
          data: lavorazioneSnapshot.val()
        });
      }
      
      // Percorsi alternativi
      const percorsiAlternativi = [
        `vehicles/${vehicleId}/workingPhase`,
        `vehicles/${vehicleId}/fase2`,
        `workingPhase/${vehicleId}`,
        `lavorazione/${vehicleId}`
      ];
      
      for (const percorso of percorsiAlternativi) {
        try {
          const percorsoRef = ref(rtdb, percorso);
          const percorsoSnapshot = await get(percorsoRef);
          
          if (percorsoSnapshot.exists()) {
            percorsiDaSalvare.push({
              ref: percorsoRef,
              data: percorsoSnapshot.val()
            });
          }
        } catch (e) {
          console.error(`Errore nell'accesso al percorso ${percorso}:`, e);
        }
      }
      
      // Ora esegui l'aggiornamento in tutti i percorsi trovati
      for (const { ref: percorsoRef, data: percorsoData } of percorsiDaSalvare) {
        try {
          // Verifica se questo percorso utilizza checklist, checklistLavorazione o altra struttura
          const updateData: Record<string, any> = {};
          
          if ('checklist' in percorsoData) {
            updateData.checklist = nuoviControlli;
          }
          
          if ('checklistLavorazione' in percorsoData) {
            updateData.checklistLavorazione = nuoviControlli;
          }
          
          if ('checks' in percorsoData) {
            updateData.checks = nuoviControlli;
          }
          
          if (Object.keys(updateData).length === 0) {
            // Se non abbiamo trovato una struttura conosciuta, proviamo ad aggiornare direttamente
            await update(percorsoRef, {
              checklist: nuoviControlli
            });
          } else {
            // Altrimenti aggiorniamo le strutture esistenti
            await update(percorsoRef, updateData);
          }
        } catch (e) {
          console.error(`Errore nell'aggiornamento del percorso ${percorsoRef.key}:`, e);
        }
      }
    } catch (error) {
      console.error('Errore nel salvataggio della nota prova su strada:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Salva i parametri nel database
  const salvaParametri = async () => {
    try {
      // Percorsi da aggiornare
      const percorsiDaSalvare = [];
      
      // Se abbiamo un appointmentId, salviamo solo in quella tabella
      if (appointmentId) {
        percorsiDaSalvare.push(
          `appointments/${appointmentId}/checklist`
        );
      }
      
      // Per i veicoli, usiamo solo il percorso standardizzato
      if (vehicleId) {
        percorsiDaSalvare.push(
          `vehicles/${vehicleId}/lavorazione/parametriChecklist`
        );
      }
      
      // Esegui l'aggiornamento nei percorsi standardizzati
      for (const percorso of percorsiDaSalvare) {
        try {
          const percorsoRef = ref(rtdb, percorso);
          await update(percorsoRef, {
            parametriChecklist: parametri
          });
          console.log(`Parametri salvati con successo in ${percorso}`);
        } catch (e) {
          console.error(`Errore nel salvataggio dei parametri in ${percorso}:`, e);
        }
      }
    } catch (error) {
      console.error('Errore nel salvataggio dei parametri:', error);
    }
  };

  // Carica i parametri dal database
  useEffect(() => {
    const loadParametriData = async () => {
      try {
        // Utilizziamo prima l'appointmentId se disponibile (prioritario)
        if (appointmentId) {
          // Prova a caricare dai percorsi relativi all'appuntamento
          const percorsiAppuntamento = [
            `appointments/${appointmentId}`,
            `appointments/${appointmentId}/checklist`
          ];
          
          for (const percorso of percorsiAppuntamento) {
            try {
              const percorsoRef = ref(rtdb, percorso);
              const percorsoSnapshot = await get(percorsoRef);
              
              if (percorsoSnapshot.exists()) {
                const percorsoData = percorsoSnapshot.val();
                
                if (percorsoData.parametriChecklist) {
                  setParametri(percorsoData.parametriChecklist);
                  console.log(`Trovati parametri nel percorso ${percorso}`);
                  return; // Termina se abbiamo trovato parametri
                }
              }
            } catch (e) {
              console.error(`Errore nel caricamento parametri da percorso ${percorso}:`, e);
            }
          }
        }
        
        // Se non abbiamo parametri dall'appointmentId, proviamo con il vehicleId
        if (vehicleId) {
          const percorsiVeicolo = [
            `vehicles/${vehicleId}`,
            `vehicles/${vehicleId}/lavorazione`,
            `vehicles/${vehicleId}/workingPhase`,
            `vehicles/${vehicleId}/fase2`,
            `workingPhase/${vehicleId}`,
            `lavorazione/${vehicleId}`
          ];
          
          for (const percorso of percorsiVeicolo) {
            try {
              const percorsoRef = ref(rtdb, percorso);
              const percorsoSnapshot = await get(percorsoRef);
              
              if (percorsoSnapshot.exists()) {
                const percorsoData = percorsoSnapshot.val();
                
                if (percorsoData.parametriChecklist) {
                  setParametri(percorsoData.parametriChecklist);
                  console.log(`Trovati parametri nel percorso ${percorso}`);
                  return; // Termina se abbiamo trovato parametri
                }
              }
            } catch (e) {
              console.error(`Errore nel caricamento parametri da percorso ${percorso}:`, e);
            }
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento dei parametri:', error);
      }
    };

    // Carica i parametri solo se non sono stati forniti come prop
    if (!parametriIniziali || Object.keys(parametriIniziali).length === 0) {
      loadParametriData();
    }
  }, [vehicleId, appointmentId, parametriIniziali]);
  
  // Aggiorna il metodo di aggiunta/rimozione parametri per salvare nel database
  const aggiungiParametro = () => {
    if (nuovoParametroChiave.trim() === '') return;
    
    const nuoviParametri = {
      ...parametri,
      [nuovoParametroChiave]: nuovoParametroValore
    };
    
    setParametri(nuoviParametri);
    setNuovoParametroChiave('');
    setNuovoParametroValore('');
    
    // Salva i parametri nel database
    setTimeout(() => {
      salvaParametri();
    }, 100);
  };
  
  const rimuoviParametro = (chiave: string) => {
    const nuoviParametri = {...parametri};
    delete nuoviParametri[chiave];
    setParametri(nuoviParametri);
    
    // Salva i parametri nel database
    setTimeout(() => {
      salvaParametri();
    }, 100);
  };

  const ParametriDialog = () => {
    if (!parametriDialog) return null;
    
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg w-full max-w-md overflow-hidden shadow-lg border border-border">
          <div className="flex justify-between items-center p-4 bg-muted/90 border-b border-border">
            <h2 className="text-xl font-bold text-orange-500">Gestione Parametri</h2>
            <button 
              onClick={() => setParametriDialog(false)} 
              className="text-orange-500 hover:text-orange-400 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={nuovoParametroChiave}
                onChange={(e) => setNuovoParametroChiave(e.target.value)}
                placeholder="Nome parametro"
                className="p-2 flex-1 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <input
                type="text"
                value={nuovoParametroValore}
                onChange={(e) => setNuovoParametroValore(e.target.value)}
                placeholder="Valore"
                className="p-2 flex-1 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={aggiungiParametro}
                className="bg-primary hover:bg-primary/90 text-white px-3 py-1 rounded"
              >
                Aggiungi
              </button>
            </div>
            
            <div className="space-y-2">
              {Object.entries(parametri).map(([chiave, valore]) => (
                <div key={chiave} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <div>
                    <span className="font-medium">{chiave}:</span> {valore}
                  </div>
                  <button
                    onClick={() => rimuoviParametro(chiave)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              {Object.keys(parametri).length === 0 && (
                <div className="text-center text-muted-foreground italic">Nessun parametro</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background text-foreground py-4 px-6">
      {/* Five Blocks Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6 mx-2">
        {dynamicSections.map((section) => (
          <div key={section.id} 
            className="bg-black border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <button 
              className="w-full h-24 flex flex-col items-center justify-center p-2 text-center focus:outline-none" 
              onClick={() => setOpenSection(section.id)}
            >
              <h3 className="text-base font-medium text-orange-500">{section.title}</h3>
            </button>
          </div>
        ))}
      </div>

      {/* Modals for Five Blocks */}
      {dynamicSections.map((section) => (
        <Modal 
          key={section.id}
          isOpen={openSection === section.id} 
          onClose={chiudiConSalvataggio} 
          title={section.title}
        >
          <div className="p-4">
            {section.components.map(({ key, label, defaultNote }) => (
              <TableComponent 
                key={key} 
                label={label} 
                keyName={key as keyof ControlliVeicolo} 
                defaultNote={defaultNote} 
              />
            ))}
          </div>
        </Modal>
      ))}

      {/* Spazio tra i blocchi e la sezione successiva */}
      <div className="mt-10"></div>

      {/* Prova su Strada e Note/Commenti nella stessa riga */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mx-2">
        {/* Prova su Strada */}
        <Card className="border border-border">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-lg font-medium text-orange-500">Prova su Strada</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-accent/50">
                    <TableHead className="font-medium w-1/3 py-4">Componente</TableHead>
                    <TableHead className="text-center w-24 py-4">Stato</TableHead>
                    <TableHead className="py-4">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-accent/50">
                    <TableCell className="font-medium py-4">Prova su Strada</TableCell>
                    <TableCell className="text-center py-4">
                      <button 
                        onClick={(e) => cambiaStato('provaSuStrada', e)} 
                        className="p-2 rounded-full hover:bg-accent transition-colors"
                      >
                        <ProvaSuStradaStatusIcon />
                      </button>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={notaProvaStrada}
                          onChange={handleNotaProvaSuStradaChange}
                          onBlur={handleNotaProvaSuStradaBlur}
                          className="w-full p-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          placeholder="Aggiungi note sulla prova su strada..."
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck="false"
                          onFocus={memorizzaPosizione}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Problemi e Commenti */}
        <Card className="print:page-break-before border border-border" id="commenti-sezione">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-lg font-medium text-orange-500">
              <div className="flex items-center gap-2">
                <Clipboard size={18} />
                Note e Commenti
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea
              value={commenti}
              onChange={(e) => modificaCommenti(e.target.value)}
              className="resize-y min-h-[120px] max-h-[250px]"
              placeholder="Inserisci commenti o problemi rilevati durante l'ispezione..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}