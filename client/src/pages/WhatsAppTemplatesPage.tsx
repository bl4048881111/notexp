import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Edit, Trash2, Plus, MessageSquare, Search, Loader2 } from "lucide-react";
import { 
  getAllWhatsappTemplates, 
  createWhatsappTemplate, 
  updateWhatsappTemplate, 
  deleteWhatsappTemplate,
  assignOrderIdsToExistingTemplates 
} from "../../../shared/supabase";

/**
 * Interfaccia per i template WhatsApp
 * Definisce la struttura dei messaggi predefiniti per l'invio automatico
 */
interface WhatsAppTemplate {
  id: string;
  title: string;       // Titolo descrittivo del template
  content: string;     // Contenuto del messaggio (supporta variabili dinamiche)
  category: string;    // Categoria per organizzare i template (preventivi, appuntamenti, etc.)
  idgil?: number;      // ID per l'ordinamento dei template
  created_at: string;
  updated_at: string;
  created_by?: string; // Utente che ha creato il template
}

/**
 * Componente principale per la gestione dei Template WhatsApp
 * Questo sistema permette di creare e gestire risposte automatiche personalizzate
 * per diversi scenari di business (preventivi, appuntamenti, reminder, etc.)
 */
const WhatsAppTemplatesPage: React.FC = () => {
  // Stati per la gestione dei template
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<WhatsAppTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("tutti");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "generale",
    idgil: 1
  });

  const { toast } = useToast();

  /**
   * Categorie disponibili per i template WhatsApp
   * Ogni categoria corrisponde a un diverso scenario di utilizzo:
   * - generale: Messaggi di uso comune
   * - appuntamenti: Gestione prenotazioni e conferme
   * - preventivi: Comunicazioni sui preventivi
   * - completato: Messaggi post-servizio
   * - cortesia: Messaggi di cortesia e follow-up
   * - promemoria: Reminder automatici
   */
  const categories = [
    { value: "tutti", label: "Tutti" },
    { value: "generale", label: "Generale" },
    { value: "appuntamenti", label: "Appuntamenti" },
    { value: "preventivi", label: "Preventivi" },
    { value: "checkup", label: "Checkup" },
    { value: "completato", label: "Completato" },
    { value: "cortesia", label: "Cortesia" },
    { value: "feedback", label: "Feedback" },
    { value: "oggi", label: "Oggi" },
    { value: "domani", label: "Domani" },
    //{ value: "urgenze", label: "Urgenze" },
    { value: "promemoria", label: "Promemoria" }
  ];

  /**
   * Carica tutti i template dal database Supabase
   * I template vengono ordinati per ID di ordinamento e data di creazione
   */
  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await getAllWhatsappTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Errore nel caricamento dei template:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i template WhatsApp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Carica i template al primo rendering
  useEffect(() => {
    loadTemplates();
  }, []);

  /**
   * Sistema di filtro per i template
   * Permette di filtrare per testo (titolo o contenuto) e per categoria
   */
  useEffect(() => {
    let filtered = templates;

    // Filtro per testo di ricerca
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro per categoria
    if (selectedCategory !== "tutti") {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchTerm, selectedCategory]);

  /**
   * Copia il contenuto del template negli appunti
   * Utile per copiare rapidamente un messaggio da inviare manualmente
   */
  const handleCopyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: "Copiato!",
        description: "Il messaggio è stato copiato negli appunti",
        duration: 2000,
      });
    });
  };

  const handleSaveTemplate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Errore",
        description: "Titolo e contenuto sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      
      if (editingTemplate) {
        // Modifica template esistente
        await updateWhatsappTemplate(editingTemplate.id, {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          idgil: formData.idgil
        });
        
        toast({
          title: "Template aggiornato",
          description: formData.idgil !== editingTemplate.idgil 
            ? `Template aggiornato. ${formData.idgil !== editingTemplate.idgil ? 'ID ordinamento modificato.' : ''}`
            : "Il template è stato modificato con successo",
        });
      } else {
        // Nuovo template
        await createWhatsappTemplate({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          idgil: formData.idgil
        });
        
        toast({
          title: "Risposta automatica creata",
          description: "La risposta automatica è stata creata con successo",
        });
      }

      // Ricarica i templates
      await loadTemplates();
      
      // Reset form
      setFormData({ title: "", content: "", category: "generale", idgil: 1 });
      setEditingTemplate(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Errore nel salvataggio del template:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      content: template.content,
      category: template.category,
      idgil: template.idgil || 1
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo template?")) return;
    
    try {
      await deleteWhatsappTemplate(id);
      toast({
        title: "Template eliminato",
        description: "Il template è stato rimosso con successo",
      });
      
      // Ricarica i templates
      await loadTemplates();
    } catch (error) {
      console.error('Errore nella cancellazione del template:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il template",
        variant: "destructive",
      });
    }
  };

  const handleAssignOrderIds = async () => {
    if (!confirm("Assegnare automaticamente gli ID di ordinamento ai template esistenti? Questa operazione non può essere annullata.")) return;
    
    try {
      setIsLoading(true);
      const result = await assignOrderIdsToExistingTemplates();
      
      if (result.success) {
        toast({
          title: "Migrazione completata",
          description: result.message,
        });
        
        // Ricarica i templates per mostrare i nuovi ID
        await loadTemplates();
      } else {
        toast({
          title: "Errore nella migrazione",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore nella migrazione:', error);
      toast({
        title: "Errore",
        description: "Impossibile eseguire la migrazione",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(cat => cat.value === category)?.label || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      generale: "bg-blue-600 text-white",
      appuntamenti: "bg-green-600 text-white",
      preventivi: "bg-yellow-600 text-white",
      pagamenti: "bg-red-600 text-white",
      cortesia: "bg-purple-600 text-white",
      feedback: "bg-orange-600 text-white",
      oggi: "bg-indigo-600 text-white",
      domani: "bg-indigo-600 text-white",
      //urgenze: "bg-orange-600 text-white",
      promemoria: "bg-indigo-600 text-white"
    };
    return colors[category] || "bg-gray-600 text-white";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-400">Caricamento template...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Risposte Automatiche WhatsApp</h1>
          <p className="text-gray-400 mt-2">
            Risposte predefinite per WhatsApp per gay
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Pulsante di migrazione - mostra solo se ci sono template senza idgil */}
          {templates.some(t => !t.idgil) && (
            <Button 
              onClick={handleAssignOrderIds} 
              variant="outline"
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-900"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assegna ID Ordinamento
            </Button>
          )}
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingTemplate(null);
                setFormData({ title: "", content: "", category: "generale", idgil: 1 });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-[#1a1a1a] border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {editingTemplate ? "Modifica" : "Nuovo"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Titolo</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Es: Saluto iniziale"
                    className="bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400"
                    disabled={isSaving}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2 border border-gray-600 rounded-md bg-[#2a2a2a] text-white"
                    disabled={isSaving}
                  >
                    {categories.slice(1).map(cat => (
                      <option key={cat.value} value={cat.value} className="bg-[#2a2a2a]">{cat.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">ID Ordinamento</label>
                  <Input
                    type="number"
                    value={formData.idgil}
                    onChange={(e) => setFormData({ ...formData, idgil: parseInt(e.target.value) || 1 })}
                    placeholder="Es: 1, 2, 3..."
                    min="1"
                    className="bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400"
                    disabled={isSaving}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Contenuto del messaggio</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Scrivi qui il contenuto del messaggio..."
                    rows={6}
                    className="bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400"
                    disabled={isSaving}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)} 
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    disabled={isSaving}
                  >
                    Annulla
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingTemplate ? "Aggiorna" : "Salva"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtri e ricerca */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Cerca templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-400"
          />
        </div>
        
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 sm:grid-cols-8 w-full bg-[#2a2a2a]">
            {categories.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="text-xs text-gray-300 data-[state=active]:bg-primary data-[state=active]:text-white">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Lista templates */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow bg-[#1a1a1a] border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg text-white">{template.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getCategoryColor(template.category)}>
                      {getCategoryLabel(template.category)}
                    </Badge>
                    <Badge variant="outline" className="text-gray-400 border-gray-600">
                      ID: {template.idgil || 'N/A'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(template.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-[#2a2a2a] p-3 rounded-md border border-gray-700">
                <p className="text-sm whitespace-pre-wrap text-gray-200">{template.content}</p>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <Button
                  onClick={() => handleCopyToClipboard(template.content)}
                  className="flex-1 mr-2"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copia
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditTemplate(template)}
                  className="mr-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="text-red-400 border-red-600 hover:bg-red-900 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && !isLoading && (
        <Card className="text-center py-12 bg-[#1a1a1a] border-gray-700">
          <CardContent>
            <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2 text-white">Nessun template trovato</h3>
            <p className="text-gray-400 mb-4">
              {searchTerm || selectedCategory !== "tutti"
                ? "Prova a modificare i filtri di ricerca"
                : "Inizia creando il tuo primo template di risposta automatica"}
            </p>
            {!searchTerm && selectedCategory === "tutti" && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crea il primo template
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WhatsAppTemplatesPage; 