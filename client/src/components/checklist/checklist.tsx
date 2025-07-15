import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AlertTriangle, 
  Check, 
  X, 
  Clipboard, 
  Save, 
  Wrench,
  Navigation,
  Disc,
  Zap,
  Settings,
  Car,
  Wind,
  Circle as WheelIcon,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
  Lightbulb,
  Snowflake
} from 'lucide-react';
import {
  getChecklistItemsByAppointmentId,
  updateChecklistItem,
  createChecklistItemsFromTemplate,
  getAllChecklistTemplates,
  removeDuplicateChecklistItems,
  supabase
} from '@shared/supabase';
import type { ChecklistItem } from '@shared/schema';
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
import React from 'react';

// CSS personalizzato per prevenire lo scroll automatico
const customNoScrollStyle = `
  .checklist-no-scroll {
    scroll-behavior: auto !important;
    overflow-anchor: none !important;
    overscroll-behavior: none !important;
  }
  .checklist-no-scroll * {
    scroll-behavior: auto !important;
    overflow-anchor: none !important;
    overscroll-behavior: none !important;
  }
  .checklist-no-scroll button:focus {
    outline: none !important;
    box-shadow: none !important;
  }
  .checklist-no-scroll .status-button:focus {
    outline: none !important;
    box-shadow: none !important;
  }
  .checklist-no-scroll .status-button:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }
  .checklist-no-scroll button:active {
    outline: none !important;
    box-shadow: none !important;
  }
  .checklist-no-scroll button:hover {
    scroll-behavior: auto !important;
  }
  /* Previeni scroll durante le transizioni */
  .checklist-no-scroll .transition-all {
    overflow-anchor: none !important;
  }
  /* Previeni scroll automatico su input e select */
  .checklist-no-scroll input,
  .checklist-no-scroll select {
    scroll-behavior: auto !important;
    overflow-anchor: none !important;
    overscroll-behavior: none !important;
  }
  /* Forza il contenitore a mantenere la posizione */
  .checklist-no-scroll .modal-content {
    position: relative !important;
    transform: translateZ(0) !important;
    will-change: transform !important;
  }
  /* Classe per bloccare lo scroll */
  .scroll-locked {
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
  }
`;

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
  onClose?: () => void;
}

interface ChecklistItemGroup {
  category: string;
  items: ChecklistItem[];
}

// Funzione per ottenere l'icona della categoria
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'CONTROLLO MOTORE':
      return <Wrench className="w-6 h-6" />;
    case 'STERZO AUTO':
      return <Navigation className="w-6 h-6" />;
    case 'IMPIANTO FRENANTE':
      return <Disc className="w-6 h-6" />;
    case 'ILLUMINAZIONE':
      return <Lightbulb className="w-6 h-6" />;
    case 'CLIMATIZZAZIONE':
      return <Snowflake className="w-6 h-6" />;
    case 'SOSPENSIONE ANTERIORE':
    case 'SOSPENSIONE POSTERIORE':
      return <Zap className="w-6 h-6" />;
    case 'TRASMISSIONE ANT/POST':
      return <Settings className="w-6 h-6" />;
    case 'IMPIANTO DI SCARICO':
      return <Wind className="w-6 h-6" />;
    case 'PNEUMATICI':
      return <WheelIcon className="w-6 h-6" />;
    case 'IMPIANTO ELETTRICO':
      return <Zap className="w-6 h-6" />;
    default:
      return <Car className="w-6 h-6" />;
  }
};

// Funzione per ottenere la descrizione della categoria
const getCategoryDescription = (category: string) => {
  switch (category) {
    case 'CONTROLLO MOTORE':
      return 'Controlli motore, filtri, cinghie e supporti';
    case 'STERZO AUTO':
      return 'Sistema sterzo, tiranti, testine e cuffie';
    case 'ILLUMINAZIONE':
      return 'Lampade, segnaletica e retrovisori';
    case 'CLIMATIZZAZIONE':
      return 'Climatizzatore, filtro aria e condensatore';
    case 'IMPIANTO FRENANTE':
      return 'Dischi, pastiglie, tubi freno e sistema vacuum';
    case 'SOSPENSIONE ANTERIORE':
      return 'Ammortizzatori, molle, bracci anteriori';
    case 'SOSPENSIONE POSTERIORE':
      return 'Ammortizzatori, molle, bracci posteriori';
    case 'TRASMISSIONE ANT/POST':
      return 'Cambio, frizione, semiassi e giunti';
    case 'IMPIANTO DI SCARICO':
      return 'Filtro antiparticolato, marmitta e terminale';
    case 'PNEUMATICI':
      return 'Battistrada e pressione pneumatici';
    case 'IMPIANTO ELETTRICO':
      return 'Impianto elettrico, batterie, cablaggi e accessori';
    default:
      return 'Controlli generali del veicolo';
  }
};

// Funzione per ordinare le categorie secondo la priorità desiderata
const getCategoryOrder = (category: string): number => {
  const orderMap: { [key: string]: number } = {
    'CONTROLLO MOTORE': 1,
    'IMPIANTO FRENANTE': 2,
    'STERZO AUTO': 3,
    'SOSPENSIONE ANTERIORE': 4,
    'SOSPENSIONE POSTERIORE': 5,
    'TRASMISSIONE ANT/POST': 6,
    'IMPIANTO DI SCARICO': 7,
    'PNEUMATICI': 8,
    'ILLUMINAZIONE': 9,
    'CLIMATIZZAZIONE': 10,
    'IMPIANTO ELETTRICO': 11,
  };
  
  return orderMap[category] || 999; // Le categorie non mappate vanno alla fine
};

// Funzione di utilità per la chiave localStorage
function getChecklistStorageKey(vehicleId?: string, appointmentId?: string) {
  return `checklist_${vehicleId || ''}_${appointmentId || ''}`;
}

// Salva checklist su localStorage
function saveChecklistToStorage(vehicleId: string, appointmentId: string | undefined, items: ChecklistItem[]) {
  const key = getChecklistStorageKey(vehicleId, appointmentId);
  localStorage.setItem(key, JSON.stringify(items));
}

// Recupera checklist da localStorage
function loadChecklistFromStorage(vehicleId: string, appointmentId: string | undefined): ChecklistItem[] | null {
  const key = getChecklistStorageKey(vehicleId, appointmentId);
  const data = localStorage.getItem(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

export default function SchedaIspezioneVeicolo({ 
  vehicleId, 
  appointmentId, 
  model, 
  kilometrage, 
  clientName, 
  vehicleType, 
  inspectionDate, 
  parametri: parametriIniziali, 
  onClose 
}: SchedaIspezioneVeicoloProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const scrollLockTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Stati principali
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<ChecklistItemGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [needsSaving, setNeedsSaving] = useState(false);
  const [commenti, setCommenti] = useState<string>('');
  const [preservedScrollTop, setPreservedScrollTop] = useState<number>(0);
  
  // Stato per le note locali (solo per inizializzazione)
  const [localNotes, setLocalNotes] = useState<{[key: string]: string}>({});

  // Stati per il modal delle note
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedItemForNote, setSelectedItemForNote] = useState<ChecklistItem | null>(null);
  const [noteText, setNoteText] = useState('');

  // Funzione per bloccare temporaneamente lo scroll
  const lockScroll = useCallback(() => {
    if (modalContentRef.current) {
      const currentScrollTop = modalContentRef.current.scrollTop;
      setIsScrollLocked(true);
      document.body.classList.add('scroll-locked');
      
      // Rimuovi il lock dopo un breve delay
      if (scrollLockTimeoutRef.current) {
        clearTimeout(scrollLockTimeoutRef.current);
      }
      scrollLockTimeoutRef.current = setTimeout(() => {
        setIsScrollLocked(false);
        document.body.classList.remove('scroll-locked');
        if (modalContentRef.current) {
          modalContentRef.current.scrollTop = currentScrollTop;
        }
      }, 300);
    }
  }, []);

  // Funzione per memorizzare la posizione di scroll
  const memorizzaPosizione = useCallback(() => {
    if (modalContentRef.current) {
      const currentScroll = modalContentRef.current.scrollTop;
      setScrollPosition(currentScroll);
      setPreservedScrollTop(currentScroll);
    }
  }, []);

  // Effetto per preservare lo scroll durante i re-render
  useEffect(() => {
    if (modalContentRef.current && preservedScrollTop > 0 && !isLoading) {
      requestAnimationFrame(() => {
        modalContentRef.current!.scrollTop = preservedScrollTop;
      });
    }
  }, [groupedItems, preservedScrollTop, isLoading]);

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

  // Carica i dati dal database o da localStorage
  useEffect(() => {
    const loadChecklistData = async () => {
      setIsLoading(true);
      try {
        let items: ChecklistItem[] = [];
        
        // Prova a caricare da localStorage
        const localItems = loadChecklistFromStorage(vehicleId, appointmentId);
        if (localItems && localItems.length > 0) {
          items = localItems;
        } else {
          // Carica gli elementi checklist da Supabase
          if (appointmentId) {
            console.log(`🔍 Caricamento checklist per appointmentId: ${appointmentId}`);
            
            // Prima rimuovi eventuali duplicati
            try {
              await removeDuplicateChecklistItems(appointmentId);
            } catch (error) {
              console.warn('⚠️ Errore nella rimozione duplicati (continuo comunque):', error);
            }
            
            items = await getChecklistItemsByAppointmentId(appointmentId);
            
            // Se non ci sono elementi, crea dalla template
            if (items.length === 0) {
              console.log('🔄 Creazione checklist da template...');
              items = await createChecklistItemsFromTemplate(appointmentId, vehicleId, true);
            }
          } else if (vehicleId) {
            console.log(`🔍 Caricamento checklist per vehicleId: ${vehicleId}`);
            // Cerca per vehicleId se non abbiamo appointmentId
            const { data, error } = await supabase
              .from('checklist_items')
              .select('*')
              .eq('vehicleId', vehicleId);
            
            if (error) throw error;
            items = data || [];
          }
        }

        setChecklistItems(items);
        
        // Inizializza le note locali
        const notesMap: {[key: string]: string} = {};
        items.forEach(item => {
          notesMap[item.id] = item.notes || '';
        });
        setLocalNotes(notesMap);
        
        // Raggruppa per categoria
        const grouped = items.reduce((acc: ChecklistItemGroup[], item) => {
          const existingGroup = acc.find(g => g.category === item.itemCategory);
          if (existingGroup) {
            existingGroup.items.push(item);
          } else {
            acc.push({
              category: item.itemCategory,
              items: [item]
            });
          }
          return acc;
        }, []);
        
        // Ordina le categorie secondo l'ordine desiderato
        grouped.sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category));
        
        setGroupedItems(grouped);
        console.log(`✅ Caricati ${items.length} elementi checklist in ${grouped.length} categorie`);

      } catch (error) {
        console.error('❌ Errore nel caricamento checklist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChecklistData();
  }, [vehicleId, appointmentId]);

  // Salva checklist su localStorage ogni volta che cambia
  useEffect(() => {
    if (checklistItems.length > 0) {
      saveChecklistToStorage(vehicleId, appointmentId, checklistItems);
    }
  }, [checklistItems, vehicleId, appointmentId]);

  // Funzione per cambiare stato di un elemento tramite dropdown
  const cambiaStatoViaDropdown = useCallback(async (itemId: string, nuovoStato: ChecklistItem['status']) => {
    // Blocca lo scroll prima dell'aggiornamento
    lockScroll();
    
    try {
      setIsUpdating(true);
      
      // Aggiorna nel database
      await updateChecklistItem(itemId, { status: nuovoStato });
      
      // Aggiorna lo stato locale
      const updatedItems = checklistItems.map(i => 
        i.id === itemId ? { ...i, status: nuovoStato } : i
      );
      setChecklistItems(updatedItems);
      
      // Aggiorna i gruppi con ordinamento
      const grouped = updatedItems.reduce((acc: ChecklistItemGroup[], item) => {
        const existingGroup = acc.find(g => g.category === item.itemCategory);
        if (existingGroup) {
          existingGroup.items.push(item);
        } else {
          acc.push({
            category: item.itemCategory,
            items: [item]
          });
        }
        return acc;
      }, []);
      
      // Ordina le categorie secondo l'ordine desiderato
      grouped.sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category));
      
      setGroupedItems(grouped);
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento stato:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [checklistItems, lockScroll]);

  // Funzione per cambiare stato di un elemento (mantengo per compatibilità)
  const cambiaStato = useCallback(async (itemId: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      // Previeni anche il comportamento di scroll del focus
      const target = event.target as HTMLElement;
      target.blur();
    }
    // Salva la posizione di scroll corrente IMMEDIATAMENTE
    const currentScrollTop = modalContentRef.current?.scrollTop || 0;
    console.log('🔄 Scroll position prima dell\'aggiornamento:', currentScrollTop);
    
    const item = checklistItems.find(i => i.id === itemId);
    if (!item) return;
    
    // Cicla tra gli stati
    let nuovoStato: ChecklistItem['status'];
    switch (item.status) {
      case 'non_controllato':
        nuovoStato = 'ok';
        break;
      case 'ok':
        nuovoStato = 'da_sostituire';
        break;
      case 'da_sostituire':
        nuovoStato = 'sostituito';
        break;
      case 'sostituito':
        nuovoStato = 'attenzione';
        break;
      case 'attenzione':
        nuovoStato = 'non_controllato';
        break;
      default:
        nuovoStato = 'ok';
    }

    try {
      setIsUpdating(true);
      
      // Aggiorna nel database
      await updateChecklistItem(itemId, { status: nuovoStato });
      
      // Aggiorna lo stato locale
      const updatedItems = checklistItems.map(i => 
        i.id === itemId ? { ...i, status: nuovoStato } : i
      );
      setChecklistItems(updatedItems);
      
      // Aggiorna i gruppi con ordinamento
      const grouped = updatedItems.reduce((acc: ChecklistItemGroup[], item) => {
        const existingGroup = acc.find(g => g.category === item.itemCategory);
        if (existingGroup) {
          existingGroup.items.push(item);
        } else {
          acc.push({
            category: item.itemCategory,
            items: [item]
          });
        }
        return acc;
      }, []);
      
      // Ordina le categorie secondo l'ordine desiderato
      grouped.sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category));
      
      setGroupedItems(grouped);

      // Ripristina la posizione di scroll dopo l'aggiornamento
      requestAnimationFrame(() => {
        if (modalContentRef.current) {
          modalContentRef.current.scrollTop = currentScrollTop;
        }
      });
      
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento stato:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [checklistItems]);

  // Componente per l'icona dello stato
  const StatusIcon = ({ status }: { status: ChecklistItem['status'] }) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'da_sostituire':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'sostituito':
        return <Check className="w-5 h-5 text-blue-400" />;
      case 'attenzione':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  // Componente per una singola categoria ottimizzato con React.memo
  const CategorySection = React.memo(({ group }: { group: ChecklistItemGroup }) => {
    return (
      <div className="bg-gray-900 rounded-lg border-2 border-orange-500 shadow-md hover:shadow-lg transition-shadow">
        {/* Header della categoria */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 rounded-t-lg border-b border-orange-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-white">
                {getCategoryIcon(group.category)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{group.category}</h3>
                <p className="text-sm text-orange-100">
                  {getCategoryDescription(group.category)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista elementi in formato compatto */}
        <div className="p-4">
          <div className="grid grid-cols-1 gap-2">
            {group.items.map((item, index) => {
              const statusStyle = getStatusStyle(item.status);
              return (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 ${statusStyle.bg} ${statusStyle.text}`}
                >
                  {/* Nome elemento */}
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-xs text-orange-400 font-mono w-6 font-bold">
                      {String(index + 1).padStart(2, '0')}.
                    </span>
                    <span className="font-medium text-sm text-white">{item.itemName}</span>
                  </div>

                  {/* Dropdown stato */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <StatusIcon status={item.status} />
                      <select
                        value={item.status}
                        onChange={(e) => cambiaStatoViaDropdown(item.id, e.target.value as ChecklistItem['status'])}
                        className={`text-xs px-2 py-1.5 rounded-md border-2 transition-all duration-200 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-800 text-white border-orange-500 hover:border-orange-400`}
                      >
                        <option value="non_controllato" className="bg-gray-800 text-white">
                          Non Controllato
                        </option>
                        <option value="ok" className="bg-gray-800 text-green-400">
                          OK
                        </option>
                        <option value="da_sostituire" className="bg-gray-800 text-red-400">
                          Da Sostituire
                        </option>
                        <option value="sostituito" className="bg-gray-800 text-blue-400">
                          Sostituito
                        </option>
                        <option value="attenzione" className="bg-gray-800 text-yellow-400">
                          Attenzione
                        </option>
                      </select>
                    </div>
                    
                    {/* Pulsante note */}
                    <button
                      onClick={() => openNoteModal(item)}
                      className={`p-1.5 rounded-md border-2 transition-all duration-200 ${
                        item.notes 
                          ? 'bg-orange-600 border-orange-500 text-white hover:bg-orange-700' 
                          : 'bg-gray-800 border-orange-500 text-orange-400 hover:bg-gray-700'
                      }`}
                      title={item.notes ? 'Modifica nota' : 'Aggiungi nota'}
                    >
                      <Clipboard className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sezione note per la categoria (se necessario) */}
          {group.items.some(item => item.notes) && (
            <div className="mt-4 pt-4 border-t border-orange-500">
              <h4 className="text-sm font-semibold text-orange-400 mb-2">Note:</h4>
              <div className="space-y-2">
                {group.items.filter(item => item.notes).map((item) => (
                  <div key={`note-${item.id}`} className="bg-gray-800 border border-orange-500 p-2 rounded text-xs">
                    <span className="font-medium text-orange-400">{item.itemName}:</span> 
                    <span className="text-white ml-1">{item.notes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  });

  // Funzione per aprire il modal delle note
  const openNoteModal = (item: ChecklistItem) => {
    setSelectedItemForNote(item);
    setNoteText(item.notes || '');
    setNoteModalOpen(true);
  };

  // Funzione per salvare le note
  const saveNote = async () => {
    if (!selectedItemForNote) return;
    
    try {
      await updateChecklistItem(selectedItemForNote.id, { notes: noteText });
      
      // Aggiorna lo stato locale
      const updatedItems = checklistItems.map(i => 
        i.id === selectedItemForNote.id ? { ...i, notes: noteText } : i
      );
      setChecklistItems(updatedItems);
      
      // Aggiorna i gruppi
      const grouped = updatedItems.reduce((acc: ChecklistItemGroup[], item) => {
        const existingGroup = acc.find(g => g.category === item.itemCategory);
        if (existingGroup) {
          existingGroup.items.push(item);
        } else {
          acc.push({
            category: item.itemCategory,
            items: [item]
          });
        }
        return acc;
      }, []);
      
      // Ordina le categorie secondo l'ordine desiderato
      grouped.sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category));
      
      setGroupedItems(grouped);
      setNoteModalOpen(false);
      setSelectedItemForNote(null);
      
    } catch (error) {
      console.error('❌ Errore nel salvataggio nota:', error);
    }
  };

  // Componente per il colore di sfondo e testo dello stato
  const getStatusStyle = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'ok':
        return {
          bg: 'bg-gray-800 hover:bg-gray-700 border-green-500',
          text: 'text-white',
          button: 'bg-green-600 hover:bg-green-700 border-green-500 text-white'
        };
      case 'da_sostituire':
        return {
          bg: 'bg-gray-800 hover:bg-gray-700 border-red-500',
          text: 'text-white',
          button: 'bg-red-600 hover:bg-red-700 border-red-500 text-white'
        };
      case 'sostituito':
        return {
          bg: 'bg-gray-800 hover:bg-gray-700 border-blue-500',
          text: 'text-white',
          button: 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white'
        };
      case 'attenzione':
        return {
          bg: 'bg-gray-800 hover:bg-gray-700 border-yellow-500',
          text: 'text-white',
          button: 'bg-yellow-600 hover:bg-yellow-700 border-yellow-500 text-white'
        };
      default:
        return {
          bg: 'bg-gray-800 hover:bg-gray-700 border-gray-600',
          text: 'text-white',
          button: 'bg-gray-600 hover:bg-gray-700 border-gray-500 text-white'
        };
    }
  };

  // Funzione per ottenere il testo dello stato
  const getStatusText = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'ok':
        return 'OK';
      case 'da_sostituire':
        return 'Da Sostituire';
      case 'sostituito':
        return 'Sostituito';
      case 'attenzione':
        return 'Attenzione';
      default:
        return 'Non Controllato';
    }
  };

  // Cleanup del timeout quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (scrollLockTimeoutRef.current) {
        clearTimeout(scrollLockTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border-2 border-orange-500 rounded-lg p-8 shadow-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-500 mx-auto mb-4"></div>
            <p className="text-white text-lg font-medium">Caricamento checklist...</p>
            <p className="text-orange-400 text-sm mt-2">Preparazione controlli veicolo</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCompleted = checklistItems.filter(i => i.status === 'ok').length;
  const totalItems = checklistItems.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 checklist-no-scroll">
      <style>{customNoScrollStyle}</style>
      <div className="bg-gray-900 border-2 border-orange-500 rounded-xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col">
        {/* Header compatto */}
        <div className="p-4 border-b-2 border-orange-500 bg-gradient-to-r from-orange-600 to-orange-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white p-2 rounded-lg">
                <Clipboard className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Checklist Controlli Veicolo
                </h2>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={onClose}
                className="text-white hover:text-orange-200 transition-colors p-2 rounded-lg hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content in griglia */}
        <div 
          ref={modalContentRef}
          className="flex-1 overflow-y-auto p-4 bg-black"
        >
          {groupedItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-900 border-2 border-orange-500 rounded-lg p-8 shadow-lg max-w-md mx-auto">
                <Clipboard className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Nessun elemento trovato</h3>
                <p className="text-orange-300">
                  Non sono stati trovati elementi della checklist per questo veicolo.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedItems.map((group) => (
                <CategorySection key={group.category} group={group} />
              ))}
            </div>
          )}
        </div>

        {/* Footer compatto */}
        <div className="p-4 border-t-2 border-orange-500 bg-gray-900">
          <div className="flex justify-center">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl border border-orange-500"
            >
              Chiudi Checklist
            </button>
          </div>
        </div>
      </div>

      {/* Modal per le note */}
      {noteModalOpen && selectedItemForNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border-2 border-orange-500 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-orange-500 bg-gradient-to-r from-orange-600 to-orange-700">
              <h3 className="text-lg font-semibold text-white">
                Note per: {selectedItemForNote.itemName}
              </h3>
              <p className="text-sm text-orange-100 mt-1">
                Categoria: {selectedItemForNote.itemCategory}
              </p>
            </div>
            
            <div className="p-4">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Inserisci note per questo controllo..."
                className="min-h-[120px] resize-none bg-gray-800 border-orange-500 text-white placeholder-orange-300 focus:border-orange-400 focus:ring-orange-400"
                autoFocus
              />
            </div>
            
            <div className="p-4 border-t border-orange-500 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setNoteModalOpen(false);
                  setSelectedItemForNote(null);
                }}
                className="px-4 py-2 text-orange-400 border border-orange-500 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={saveNote}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors border border-orange-500"
              >
                Salva Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 