import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { serviceCategories, createServiceTypeSchema, ServiceType, CreateServiceTypeInput } from "@shared/schema";
import { 
  getAllServiceTypes, 
  getServiceTypesByCategory, 
  createServiceType, 
  updateServiceType, 
  deleteServiceType 
} from "@shared/firebase";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  Settings, 
  Filter, 
  CheckCircle, 
  XCircle,
  Plus, 
  Search 
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ServiceManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceType | null>(null);
  
  const queryClient = useQueryClient();
  
  // Query per ottenere tutti i tipi di servizi
  const { data: serviceTypes = [], isLoading } = useQuery({
    queryKey: ['/serviceTypes'],
    queryFn: async () => {
      return await getAllServiceTypes();
    },
  });
  
  // Mutation per creare un nuovo tipo di servizio
  const createMutation = useMutation({
    mutationFn: (serviceType: CreateServiceTypeInput) => createServiceType(serviceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/serviceTypes'] });
      toast({
        title: "Servizio creato",
        description: "Il servizio è stato creato con successo.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Errore nella creazione del servizio:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione del servizio.",
        variant: "destructive",
      });
    },
  });
  
  // Mutation per aggiornare un tipo di servizio
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceType> }) => updateServiceType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/serviceTypes'] });
      toast({
        title: "Servizio aggiornato",
        description: "Il servizio è stato aggiornato con successo.",
      });
      setIsDialogOpen(false);
      setEditingService(null);
      form.reset();
    },
    onError: (error) => {
      console.error("Errore nell'aggiornamento del servizio:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del servizio.",
        variant: "destructive",
      });
    },
  });
  
  // Mutation per eliminare un tipo di servizio
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteServiceType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/serviceTypes'] });
      toast({
        title: "Servizio eliminato",
        description: "Il servizio è stato eliminato con successo.",
      });
      setIsDeleteDialogOpen(false);
      setServiceToDelete(null);
    },
    onError: (error) => {
      console.error("Errore nell'eliminazione del servizio:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del servizio.",
        variant: "destructive",
      });
    },
  });
  
  // Form per la creazione/modifica di un servizio
  const form = useForm<CreateServiceTypeInput>({
    resolver: zodResolver(createServiceTypeSchema),
    defaultValues: {
      name: "",
      category: "Tagliando",
      description: "",
      laborPrice: 0,
    },
  });
  
  // Imposta i valori del form quando si modifica un servizio
  useEffect(() => {
    if (editingService) {
      form.reset({
        name: editingService.name,
        category: editingService.category,
        description: editingService.description || "",
        laborPrice: editingService.laborPrice || 0,
      });
    }
  }, [editingService, form]);
  
  // Gestisce la creazione o l'aggiornamento di un servizio
  const onSubmit = (data: CreateServiceTypeInput) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };
  
  // Filtra i servizi in base alla ricerca e alla categoria
  const filteredServices = serviceTypes.filter((service) => {
    const matchesSearch = 
      !searchQuery || 
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      !categoryFilter || 
      service.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  // Raggruppa i servizi per categoria
  const servicesByCategory = filteredServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, ServiceType[]>);
  
  // Gestisce l'apertura del form di modifica
  const handleEditService = (service: ServiceType) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };
  
  // Gestisce l'apertura della conferma di eliminazione
  const handleDeleteService = (service: ServiceType) => {
    setServiceToDelete(service);
    setIsDeleteDialogOpen(true);
  };
  
  // Gestisce la chiusura del form
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    form.reset();
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestione <span className="text-orange-500">Servizi</span></h1>
          <p className="text-gray-300">Gestisci i tipi di servizi offerti dalla tua officina</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 bg-orange-600 hover:bg-orange-700">
          <PlusCircle className="h-4 w-4" />
          Nuovo Servizio
        </Button>
      </div>
      
      {/* Filtri */}
      <Card className="mb-6 bg-gray-900 border-gray-800 text-white">
        <CardHeader className="pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-lg">Filtra Servizi</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block text-gray-300">Cerca per nome o descrizione</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cerca servizio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-gray-300">Filtra per categoria</Label>
              <Select
                value={categoryFilter || "all"}
                onValueChange={(value) => setCategoryFilter(value === "all" ? null : value)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Tutte le categorie" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="all" className="text-white focus:bg-orange-500 focus:text-white">Tutte le categorie</SelectItem>
                  {serviceCategories.map((category) => (
                    <SelectItem key={category} value={category} className="text-white focus:bg-orange-500 focus:text-white">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabella Servizi */}
      <div className="bg-gray-900 rounded-md border border-gray-800 shadow-sm">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Settings className="h-5 w-5 text-orange-500" />
            Servizi Disponibili
          </h2>
        </div>
        
        {/* Mostra avviso se non ci sono servizi */}
        {filteredServices.length === 0 ? (
          <div className="p-8 text-center">
            {isLoading ? (
              <p className="text-gray-300">Caricamento servizi in corso...</p>
            ) : (
              <>
                <p className="text-lg font-medium text-orange-500">Nessun servizio trovato</p>
                <p className="text-sm mt-1 text-gray-300">Aggiungi un nuovo servizio o modifica i filtri di ricerca.</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4">
            {/* Raggruppa i servizi per categoria */}
            {Object.entries(
              filteredServices.reduce((acc, service) => {
                if (!acc[service.category]) {
                  acc[service.category] = [];
                }
                acc[service.category].push(service);
                return acc;
              }, {} as Record<string, ServiceType[]>)
            ).map(([category, services]) => (
              <div key={category} className="mb-6">
                {/* Intestazione categoria */}
                <div className="mb-3 px-4 py-2 rounded-md font-semibold text-white bg-orange-600">
                  <h3 className="text-lg flex items-center">
                    {category === "Frenante" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Sospensioni" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Accessori" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Manutenzione" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Riparazione" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Carrozzeria" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Motore" && <Settings className="h-5 w-5 mr-2" />}
                    {category === "Elettronica" && <Settings className="h-5 w-5 mr-2" />}
                    {(category === "Altro" || category === "Personalizzato") && <Settings className="h-5 w-5 mr-2" />}
                    {category} ({services.length})
                  </h3>
                </div>

                {/* Elenco servizi per categoria */}
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <div key={service.id} className="bg-gray-900 border border-gray-800 rounded-md p-4 relative">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium mb-1 text-white">{service.name}</h4>
                          <p className="text-sm text-gray-300 mb-2">
                            {service.description || "Nessuna descrizione"}
                          </p>
                          <div className="text-sm font-medium">
                            <span className="inline-block bg-orange-500 text-white rounded-full px-3 py-1">
                              {service.laborPrice} €/ora
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-orange-500 border-orange-500 hover:bg-orange-500/10"
                            onClick={() => handleEditService(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive border-destructive hover:bg-destructive/10" 
                            onClick={() => handleDeleteService(service)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Dialog per creare/modificare servizio */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingService ? "Modifica Servizio" : "Nuovo Servizio"}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {editingService 
                ? "Modifica i dettagli del servizio selezionato." 
                : "Aggiungi un nuovo tipo di servizio alla tua officina."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome servizio*</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Es. Cambio olio" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona una categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Es. Sostituzione olio motore" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="laborPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tariffa oraria (€/h)*</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <Input 
                          {...field} 
                          type="number" 
                          min={0} 
                          step={0.01}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                        <span>€/ora</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Annulla
                </Button>
                <Button type="submit">
                  {editingService ? "Aggiorna" : "Crea"} Servizio
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog per confermare l'eliminazione */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Elimina Servizio</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo servizio? Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          
          {serviceToDelete && (
            <div className="p-4 border rounded-md bg-muted/30">
              <div className="font-medium">{serviceToDelete.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Categoria:</span> {serviceToDelete.category}
              </div>
              {serviceToDelete.description && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Descrizione:</span> {serviceToDelete.description}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Annulla
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={() => serviceToDelete && deleteMutation.mutate(serviceToDelete.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Elimina Servizio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}