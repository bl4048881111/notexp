import { useState, useEffect } from 'react';
import { ref, get, set, update, remove } from 'firebase/database';
import { rtdb } from '../../firebase';
import { Plus, Save, Trash2, X, Edit, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChecklistParameter {
  id: string;
  name: string;
  section: string;
  defaultState: 'CONTROLLATO' | 'DA FARE' | 'NON CONTROLLATO';
}

const DEFAULT_SECTIONS = [
  "Motore",
  "Sistema Sterzo",
  "Sistema Freni",
  "Sospensione Anteriore",
  "Pneumatici",
  "Altro"
];

export default function ChecklistEditor() {
  const [parameters, setParameters] = useState<ChecklistParameter[]>([]);
  const [newParameter, setNewParameter] = useState<Partial<ChecklistParameter>>({
    name: '',
    section: 'Motore',
    defaultState: 'NON CONTROLLATO'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Stati per la modifica di massa
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [bulkSection, setBulkSection] = useState<string>('Motore');
  const [bulkDefaultState, setBulkDefaultState] = useState<'CONTROLLATO' | 'DA FARE' | 'NON CONTROLLATO'>('NON CONTROLLATO');
  
  // Popup states
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showBulkEditPopup, setShowBulkEditPopup] = useState(false);
  const [showDeleteConfirmPopup, setShowDeleteConfirmPopup] = useState(false);
  
  // Stato per la ricerca
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredParameters, setFilteredParameters] = useState<ChecklistParameter[]>([]);
  
  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const parametersPerPage = 10;
  
  // Calcola il numero totale di pagine
  const totalPages = Math.ceil(filteredParameters.length / parametersPerPage);
  
  // Ottieni i parametri per la pagina corrente
  const indexOfLastParameter = currentPage * parametersPerPage;
  const indexOfFirstParameter = indexOfLastParameter - parametersPerPage;
  const currentParameters = filteredParameters.slice(indexOfFirstParameter, indexOfLastParameter);
  
  // Gestione cambio pagina
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  useEffect(() => {
    loadParameters();
  }, []);
  
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredParameters(parameters);
    } else {
      const lowerCaseSearch = searchTerm.toLowerCase();
      setFilteredParameters(
        parameters.filter(param => 
          param.name.toLowerCase().includes(lowerCaseSearch) || 
          param.section.toLowerCase().includes(lowerCaseSearch)
        )
      );
    }
    // Reset alla prima pagina quando cambia la ricerca
    setCurrentPage(1);
  }, [searchTerm, parameters]);

  const loadParameters = async () => {
    setIsLoading(true);
    try {
      const checklistParamsRef = ref(rtdb, 'parameters');
      const snapshot = await get(checklistParamsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const paramsList: ChecklistParameter[] = Object.entries(data).map(
          ([id, value]) => ({
            id,
            ...(value as Omit<ChecklistParameter, 'id'>)
          })
        );
        setParameters(paramsList);
      } else {
        setParameters([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei parametri:', error);
      toast.error('Errore nel caricamento dei parametri della checklist');
    } finally {
      setIsLoading(false);
    }
  };

  const saveParameter = async () => {
    if (!newParameter.name || !newParameter.section) {
      toast.error('Compila tutti i campi richiesti');
      return;
    }

    setIsLoading(true);
    try {
      // Crea un ID basato sul nome (pulito per uso come chiave)
      let parameterId;
      
      if (editingId) {
        parameterId = editingId;
      } else {
        // Per i nuovi parametri, genera un ID unico con timestamp per garantire unicità
        parameterId = `${newParameter.name?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
      }
      
      // Assicuriamoci che la sezione esista o utilizziamo "Altro"
      let section = newParameter.section || "Altro";
      
      // Struttura del parametro da salvare
      const paramData = {
        name: newParameter.name,
        section: section,
        defaultState: newParameter.defaultState || 'NON CONTROLLATO'
      };
      
      // Riferimento alla raccolta dei parametri
      const checklistParamsRef = ref(rtdb, 'parameters');
      
      // Prima verifica se il parametro esiste già
      const paramsSnapshot = await get(checklistParamsRef);
      const existingParams = paramsSnapshot.exists() ? paramsSnapshot.val() : {};
      
      if (editingId) {
        // Aggiorna parametro esistente
        const paramRef = ref(rtdb, `parameters/${parameterId}`);
        await update(paramRef, paramData);
        
        toast.success('Parametro aggiornato con successo');
        setEditingId(null);
      } else {
        // Aggiungi nuovo parametro
        const newParamRef = ref(rtdb, `parameters/${parameterId}`);
        await set(newParamRef, paramData);
        
        // Aggiungi il parametro alla checklist dei veicoli attivi usando il percorso standardizzato
        try {
          // Ottieni tutti i veicoli che potrebbero essere in fase di lavorazione
          const vehiclesRef = ref(rtdb, 'vehicles');
          const vehiclesSnapshot = await get(vehiclesRef);
          
          if (vehiclesSnapshot.exists()) {
            const vehicles = vehiclesSnapshot.val();
            let vehiclesAggiornati = 0;
            
            for (const vehicleId in vehicles) {
              const vehicle = vehicles[vehicleId];
              
              // Se il veicolo ha una fase di lavorazione o è in una fase interessata
              if (vehicle.lavorazione || vehicle.fase2 || vehicle.workingPhase) {
                vehiclesAggiornati++;
                
                // Utilizza sempre il percorso standardizzato
                const controlsRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione/controls/${parameterId}`);
                await set(controlsRef, {
                  stato: paramData.defaultState,
                  note: ''
                });
                
                // Aggiorna anche checklist per retrocompatibilità
                const checklistRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione/checklist/${parameterId}`);
                await set(checklistRef, {
                  stato: paramData.defaultState,
                  note: ''
                });
              }
            }
          }
        } catch (e) {
          console.error('Errore nell\'aggiornamento dei veicoli con il nuovo parametro:', e);
        }
        
        toast.success('Nuovo parametro aggiunto con successo');
      }
      
      // Resetta il form e ricarica i parametri
      setNewParameter({
        name: '',
        section: 'Motore',
        defaultState: 'NON CONTROLLATO'
      });
      
      // Chiudi popup
      setShowAddPopup(false);
      
      loadParameters();
    } catch (error) {
      console.error('Errore nel salvataggio del parametro:', error);
      toast.error('Errore nel salvataggio del parametro');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteParameter = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo parametro? Questa azione non può essere annullata.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const paramRef = ref(rtdb, `parameters/${id}`);
      await remove(paramRef);
      
      toast.success('Parametro eliminato con successo');
      loadParameters();
    } catch (error) {
      console.error('Errore nell\'eliminazione del parametro:', error);
      toast.error('Errore nell\'eliminazione del parametro');
    } finally {
      setIsLoading(false);
    }
  };

  const editParameter = (param: ChecklistParameter) => {
    setNewParameter({
      name: param.name,
      section: param.section,
      defaultState: param.defaultState
    });
    setEditingId(param.id);
    setShowAddPopup(true);
  };

  const cancelEdit = () => {
    setNewParameter({
      name: '',
      section: 'Motore',
      defaultState: 'NON CONTROLLATO'
    });
    setEditingId(null);
    setShowAddPopup(false);
  };
  
  // Funzione per selezionare o deselezionare un parametro
  const toggleSelection = (paramId: string) => {
    if (selectedParameters.includes(paramId)) {
      setSelectedParameters(selectedParameters.filter(id => id !== paramId));
    } else {
      setSelectedParameters([...selectedParameters, paramId]);
    }
  };
  
  // Funzione per selezionare o deselezionare tutti i parametri
  const toggleSelectAll = () => {
    if (selectedParameters.length === currentParameters.length) {
      setSelectedParameters([]);
    } else {
      setSelectedParameters(currentParameters.map(param => param.id));
    }
  };
  
  // Funzione per applicare la modifica di massa (cambio sezione)
  const applyBulkSectionChange = async () => {
    if (selectedParameters.length === 0) {
      toast.error('Nessun parametro selezionato');
      return;
    }
    
    setIsLoading(true);
    try {
      // Per ogni parametro selezionato, aggiorna la sezione
      for (const paramId of selectedParameters) {
        const param = parameters.find(p => p.id === paramId);
        if (param) {
          const paramRef = ref(rtdb, `parameters/${paramId}`);
          await update(paramRef, { 
            section: bulkSection,
            defaultState: bulkDefaultState
          });
        }
      }
      
      toast.success(`Aggiornati ${selectedParameters.length} parametri`);
      
      // Esci dalla modalità di modifica di massa e ricarica i parametri
      setBulkEditMode(false);
      setSelectedParameters([]);
      setShowBulkEditPopup(false);
      loadParameters();
    } catch (error) {
      console.error('Errore nell\'aggiornamento di massa:', error);
      toast.error('Errore durante l\'aggiornamento di massa');
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per eliminare i parametri selezionati
  const bulkDeleteParameters = async () => {
    if (selectedParameters.length === 0) {
      toast.error('Nessun parametro selezionato');
      return;
    }
    
    setIsLoading(true);
    try {
      // Per ogni parametro selezionato, elimina
      for (const paramId of selectedParameters) {
        const paramRef = ref(rtdb, `parameters/${paramId}`);
        await remove(paramRef);
      }
      
      toast.success(`Eliminati ${selectedParameters.length} parametri`);
      
      // Esci dalla modalità di modifica di massa e ricarica i parametri
      setBulkEditMode(false);
      setSelectedParameters([]);
      setShowDeleteConfirmPopup(false);
      loadParameters();
    } catch (error) {
      console.error('Errore nell\'eliminazione di massa:', error);
      toast.error('Errore durante l\'eliminazione di massa');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-bold">Parametri Checklist</h2>
        
        <div className="flex w-full sm:w-auto gap-2">
          {bulkEditMode ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setBulkEditMode(false);
                  setSelectedParameters([]);
                }}
              >
                Annulla
              </Button>
              
              {selectedParameters.length > 0 && (
                <>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirmPopup(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina ({selectedParameters.length})
                  </Button>
                  
                  <Button 
                    onClick={() => setShowBulkEditPopup(true)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Applica ({selectedParameters.length})
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setBulkEditMode(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifica di massa
              </Button>
              
              <Button 
                onClick={() => {
                  setNewParameter({
                    name: '',
                    section: 'Motore',
                    defaultState: 'NON CONTROLLATO'
                  });
                  setEditingId(null);
                  setShowAddPopup(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Parametro
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Barra di ricerca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Cerca parametri..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Tabella dei parametri */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {bulkEditMode && (
                <TableHead className="w-10">
                  <input 
                    type="checkbox" 
                    checked={currentParameters.length > 0 && selectedParameters.length >= currentParameters.length} 
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </TableHead>
              )}
              <TableHead>Nome Parametro</TableHead>
              <TableHead>Sezione</TableHead>
              <TableHead>Stato Predefinito</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={bulkEditMode ? 5 : 4} className="h-24 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : currentParameters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={bulkEditMode ? 5 : 4} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'Nessun parametro trovato con questa ricerca.' : 'Nessun parametro definito. Aggiungi il primo parametro.'}
                </TableCell>
              </TableRow>
            ) : (
              currentParameters.map((param) => (
                <TableRow 
                  key={param.id} 
                  className={`${bulkEditMode ? 'cursor-pointer hover:bg-accent/50' : ''} ${
                    bulkEditMode && selectedParameters.includes(param.id) ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => bulkEditMode ? toggleSelection(param.id) : null}
                >
                  {bulkEditMode && (
                    <TableCell>
                      <input 
                        type="checkbox" 
                        checked={selectedParameters.includes(param.id)}
                        onChange={() => toggleSelection(param.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{param.name}</TableCell>
                  <TableCell>{param.section}</TableCell>
                  <TableCell>
                    <span 
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        param.defaultState === 'CONTROLLATO' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border dark:border-green-800' 
                          : param.defaultState === 'DA FARE'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 dark:border dark:border-red-800'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 dark:border dark:border-gray-600'
                      }`}
                    >
                      {param.defaultState === 'CONTROLLATO' 
                        ? 'Controllato' 
                        : param.defaultState === 'DA FARE' 
                          ? 'Da Fare' 
                          : 'Non Controllato'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          editParameter(param);
                        }}
                        title="Modifica"
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteParameter(param.id);
                        }}
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Paginazione */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t pt-4 gap-2">
        <div className="text-xs sm:text-sm text-muted-foreground">
          Mostrando <span className="font-medium">{filteredParameters.length > 0 ? indexOfFirstParameter + 1 : 0}-{Math.min(indexOfLastParameter, filteredParameters.length)}</span> di <span className="font-medium">{filteredParameters.length}</span> parametri
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-sm font-medium">
              Pagina {currentPage} di {totalPages}
            </span>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Dialog per aggiungere/modificare parametri */}
      <Dialog open={showAddPopup} onOpenChange={setShowAddPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifica Parametro' : 'Aggiungi Nuovo Parametro'}</DialogTitle>
            <DialogDescription>
              Inserisci i dettagli del parametro della checklist.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Parametro</label>
              <Input
                value={newParameter.name}
                onChange={(e) => setNewParameter({...newParameter, name: e.target.value})}
                placeholder="Es. Livello olio motore"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Sezione</label>
              <Select
                value={newParameter.section}
                onValueChange={(value) => setNewParameter({...newParameter, section: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una sezione" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_SECTIONS.map((section) => (
                    <SelectItem key={section} value={section}>{section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Stato Predefinito</label>
              <Select
                value={newParameter.defaultState}
                onValueChange={(value) => setNewParameter({
                  ...newParameter, 
                  defaultState: value as 'CONTROLLATO' | 'DA FARE' | 'NON CONTROLLATO'
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona lo stato predefinito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NON CONTROLLATO">Non Controllato</SelectItem>
                  <SelectItem value="CONTROLLATO">Controllato</SelectItem>
                  <SelectItem value="DA FARE">Da Fare</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              Annulla
            </Button>
            <Button onClick={saveParameter} disabled={isLoading}>
              {isLoading && <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              <span>{editingId ? 'Aggiorna' : 'Salva'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog per modifica di massa */}
      <Dialog open={showBulkEditPopup} onOpenChange={setShowBulkEditPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica di massa ({selectedParameters.length} parametri)</DialogTitle>
            <DialogDescription>
              Modifica sezione e stato predefinito per i parametri selezionati.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cambia Sezione</label>
              <Select
                value={bulkSection}
                onValueChange={setBulkSection}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una sezione" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_SECTIONS.map((section) => (
                    <SelectItem key={section} value={section}>{section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Cambia Stato Predefinito</label>
              <Select
                value={bulkDefaultState}
                onValueChange={(value) => setBulkDefaultState(value as 'CONTROLLATO' | 'DA FARE' | 'NON CONTROLLATO')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona lo stato predefinito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NON CONTROLLATO">Non Controllato</SelectItem>
                  <SelectItem value="CONTROLLATO">Controllato</SelectItem>
                  <SelectItem value="DA FARE">Da Fare</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditPopup(false)}>
              Annulla
            </Button>
            <Button onClick={applyBulkSectionChange} disabled={isLoading}>
              {isLoading && <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              <span>Applica</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog per conferma eliminazione di massa */}
      <Dialog open={showDeleteConfirmPopup} onOpenChange={setShowDeleteConfirmPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare {selectedParameters.length} parametri? 
              Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmPopup(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={bulkDeleteParameters} disabled={isLoading}>
              {isLoading && <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              <span>Elimina</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 