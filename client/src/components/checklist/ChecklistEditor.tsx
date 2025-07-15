import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, X, Edit, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAllChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  bulkUpdateChecklistTemplates,
  bulkDeleteChecklistTemplates
} from '@shared/supabase';
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

interface ChecklistTemplate {
  id: string;
  item_name: string;
  item_category: string;
  description?: string;
  sort_order: number;
}

// Categorie disponibili basate sulla nuova checklist TIE
const AVAILABLE_CATEGORIES = [
  "CONTROLLO MOTORE",
  "STERZO AUTO", 
  "ILLUMINAZIONE",
  "CLIMATIZZAZIONE",
  "IMPIANTO FRENANTE",
  "SOSPENSIONE ANTERIORE",
  "SOSPENSIONE POSTERIORE", 
  "TRASMISSIONE ANT/POST",
  "IMPIANTO DI SCARICO",
  "PNEUMATICI",
  "IMPIANTO ELETTRICO",
  "ALTRO"
];

export default function ChecklistEditor() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [newTemplate, setNewTemplate] = useState<Partial<ChecklistTemplate>>({
    item_name: '',
    item_category: 'CONTROLLO MOTORE',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Stati per la modifica di massa
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string>('CONTROLLO MOTORE');
  
  // Popup states
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showBulkEditPopup, setShowBulkEditPopup] = useState(false);
  const [showDeleteConfirmPopup, setShowDeleteConfirmPopup] = useState(false);
  
  // Stato per la ricerca
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTemplates, setFilteredTemplates] = useState<ChecklistTemplate[]>([]);
  
  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const templatesPerPage = 10;
  
  // Calcola il numero totale di pagine
  const totalPages = Math.ceil(filteredTemplates.length / templatesPerPage);
  
  // Ottieni i template per la pagina corrente
  const indexOfLastTemplate = currentPage * templatesPerPage;
  const indexOfFirstTemplate = indexOfLastTemplate - templatesPerPage;
  const currentTemplates = filteredTemplates.slice(indexOfFirstTemplate, indexOfLastTemplate);
  
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
    loadTemplates();
  }, []);
  
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredTemplates(templates);
    } else {
      const lowerCaseSearch = searchTerm.toLowerCase();
      setFilteredTemplates(
        templates.filter(template => 
          template.item_name.toLowerCase().includes(lowerCaseSearch) || 
          template.item_category.toLowerCase().includes(lowerCaseSearch)
        )
      );
    }
    // Reset alla prima pagina quando cambia la ricerca
    setCurrentPage(1);
  }, [searchTerm, templates]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await getAllChecklistTemplates();
      setTemplates(data);
      console.log(`✅ Caricati ${data.length} template checklist`);
    } catch (error) {
      console.error('Errore nel caricamento dei template:', error);
      toast.error('Errore nel caricamento dei template della checklist');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!newTemplate.item_name || !newTemplate.item_category) {
      toast.error('Compila tutti i campi richiesti');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        // Aggiorna template esistente
        await updateChecklistTemplate(editingId, {
          itemName: newTemplate.item_name,
          itemCategory: newTemplate.item_category,
          description: newTemplate.description
        });
        toast.success('Template aggiornato con successo');
        setEditingId(null);
      } else {
        // Crea nuovo template
        await createChecklistTemplate({
          itemName: newTemplate.item_name,
          itemCategory: newTemplate.item_category,
          description: newTemplate.description || ''
        });
        toast.success('Template creato con successo');
      }
      
      // Ricarica i dati PRIMA di chiudere il popup e resettare il form
      await loadTemplates();
      
      // Reset form e chiudi popup solo dopo aver ricaricato i dati
      setNewTemplate({
        item_name: '',
        item_category: 'CONTROLLO MOTORE',
        description: ''
      });
      setShowAddPopup(false);
      
    } catch (error) {
      console.error('Errore nel salvataggio del template:', error);
      toast.error('Errore nel salvataggio del template');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteChecklistTemplate(id);
      toast.success('Template eliminato con successo');
      await loadTemplates();
    } catch (error) {
      console.error('Errore nell\'eliminazione del template:', error);
      toast.error('Errore nell\'eliminazione del template');
    } finally {
      setIsLoading(false);
    }
  };

  const editTemplate = (template: ChecklistTemplate) => {
    setNewTemplate({
      item_name: template.item_name,
      item_category: template.item_category,
      description: template.description || ''
    });
    setEditingId(template.id);
    setShowAddPopup(true);
  };

  const cancelEdit = () => {
    setNewTemplate({
      item_name: '',
      item_category: 'CONTROLLO MOTORE',
      description: ''
    });
    setEditingId(null);
    setShowAddPopup(false);
  };

  const toggleSelection = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTemplates.length === currentTemplates.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(currentTemplates.map(t => t.id));
    }
  };

  const applyBulkCategoryChange = async () => {
    if (selectedTemplates.length === 0) {
      toast.error('Seleziona almeno un template');
      return;
    }

    setIsLoading(true);
    try {
      await bulkUpdateChecklistTemplates(selectedTemplates, {
        itemCategory: bulkCategory
      });
      
      toast.success(`Categoria aggiornata per ${selectedTemplates.length} template`);
      
      // Ricarica i dati PRIMA di chiudere i popup e resettare gli stati
      await loadTemplates();
      
      setShowBulkEditPopup(false);
      setSelectedTemplates([]);
      setBulkEditMode(false);
    } catch (error) {
      console.error('Errore nell\'aggiornamento di massa:', error);
      toast.error('Errore nell\'aggiornamento di massa');
    } finally {
      setIsLoading(false);
    }
  };

  const bulkDeleteTemplates = async () => {
    if (selectedTemplates.length === 0) {
      toast.error('Seleziona almeno un template');
      return;
    }

    setIsLoading(true);
    try {
      await bulkDeleteChecklistTemplates(selectedTemplates);
      
      toast.success(`Eliminati ${selectedTemplates.length} template`);
      setShowDeleteConfirmPopup(false);
      setSelectedTemplates([]);
      setBulkEditMode(false);
      await loadTemplates();
    } catch (error) {
      console.error('Errore nell\'eliminazione di massa:', error);
      toast.error('Errore nell\'eliminazione di massa');
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
                  setSelectedTemplates([]);
                }}
              >
                Annulla
              </Button>
              
              {selectedTemplates.length > 0 && (
                <>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirmPopup(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina ({selectedTemplates.length})
                  </Button>
                  
                  <Button 
                    onClick={() => setShowBulkEditPopup(true)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Applica ({selectedTemplates.length})
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
                  setNewTemplate({
                    item_name: '',
                    item_category: 'CONTROLLO MOTORE',
                    description: ''
                  });
                  setEditingId(null);
                  setShowAddPopup(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuovo
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
          placeholder="Cerca template..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Tabella dei template */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {bulkEditMode && (
                <TableHead className="w-10">
                  <input 
                    type="checkbox" 
                    checked={currentTemplates.length > 0 && selectedTemplates.length >= currentTemplates.length} 
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </TableHead>
              )}
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={bulkEditMode ? 4 : 3} className="h-24 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : currentTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={bulkEditMode ? 4 : 3} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'Nessun template trovato con questa ricerca.' : 'Nessun template definito. Aggiungi il primo template.'}
                </TableCell>
              </TableRow>
            ) : (
              currentTemplates.map((template) => (
                <TableRow 
                  key={template.id} 
                  className={`${bulkEditMode ? 'cursor-pointer hover:bg-accent/50' : ''} ${
                    bulkEditMode && selectedTemplates.includes(template.id) ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => bulkEditMode ? toggleSelection(template.id) : null}
                >
                  {bulkEditMode && (
                    <TableCell>
                      <input 
                        type="checkbox" 
                        checked={selectedTemplates.includes(template.id)}
                        onChange={() => toggleSelection(template.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{template.item_name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                      {template.item_category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          editTemplate(template);
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
                          if (confirm('Sei sicuro di voler eliminare questo template?')) {
                            deleteTemplate(template.id);
                          }
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
          Mostrando <span className="font-medium">{filteredTemplates.length > 0 ? indexOfFirstTemplate + 1 : 0}-{Math.min(indexOfLastTemplate, filteredTemplates.length)}</span> di <span className="font-medium">{filteredTemplates.length}</span> template
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
      
      {/* Dialog per aggiungere/modificare template */}
      <Dialog open={showAddPopup} onOpenChange={setShowAddPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifica Template' : 'Aggiungi Nuovo'}</DialogTitle>
            <DialogDescription>
              Inserisci i dettagli del template della checklist.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newTemplate.item_name}
                onChange={(e) => setNewTemplate({...newTemplate, item_name: e.target.value})}
                placeholder="Es. Livello olio motore"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={newTemplate.item_category}
                onValueChange={(value) => setNewTemplate({...newTemplate, item_category: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una categoria" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrizione (opzionale)</label>
              <Input
                value={newTemplate.description || ''}
                onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                placeholder="Descrizione aggiuntiva..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              Annulla
            </Button>
            <Button onClick={saveTemplate} disabled={isLoading}>
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
            <DialogTitle>Modifica di massa ({selectedTemplates.length} template)</DialogTitle>
            <DialogDescription>
              Modifica categoria per i   selezionati.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuova Categoria</label>
              <Select
                value={bulkCategory}
                onValueChange={setBulkCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una categoria" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditPopup(false)}>
              Annulla
            </Button>
            <Button onClick={applyBulkCategoryChange} disabled={isLoading}>
              {isLoading && <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              Applica Modifiche
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
              Sei sicuro di voler eliminare {selectedTemplates.length}   selezionati? 
              Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmPopup(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={bulkDeleteTemplates} disabled={isLoading}>
              {isLoading && <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              Elimina Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 