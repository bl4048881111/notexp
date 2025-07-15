import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Link } from "wouter";

import { serviceCategories, createServiceTypeSchema, ServiceType, CreateServiceTypeInput } from "@shared/schema";
import { 
  getAllServiceTypes, 
  getServiceTypesByCategory, 
  createServiceType, 
  updateServiceType, 
  deleteServiceType 
} from "@shared/supabase";

import {
  Table,
  TableBody,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading } from "@/components/ui/heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function ServiceManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Aggiunge stile CSS per nascondere la scrollbar
  useEffect(() => {
    // Aggiungi stili CSS per nascondere le scrollbar
    const style = document.createElement('style');
    style.innerHTML = `
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Cache per i servizi filtrati per categoria
  const serviceCache = useRef<Record<string, ServiceType[]>>({
    all: [],
  });
  
  // Stati per i servizi filtrati per tab
  const [allServices, setAllServices] = useState<ServiceType[]>([]);
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, ServiceType[]>>({});
  
  // Query per ottenere tutti i tipi di servizi
  const { 
    data: serviceTypes = [], 
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['/serviceTypes'],
    queryFn: async () => {
      return await getAllServiceTypes();
    },
  });
  
  // Filtra i servizi in base alla ricerca
  const filteredServices = useMemo(() => {
    let result = serviceTypes;

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(service => 
        service.name.toLowerCase().includes(query) || 
        (service.description && service.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [serviceTypes, searchQuery]);
  
  // Ordina i servizi
  const sortedServices = useMemo(() => {
    return [...filteredServices].sort((a, b) => {
      switch (sortOrder) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "category-asc":
          return a.category.localeCompare(b.category);
        case "category-desc":
          return b.category.localeCompare(a.category);
        default:
          return 0;
      }
    });
  }, [filteredServices, sortOrder]);
  
  // Distribuisci i servizi nei tab
  useEffect(() => {
    if (sortedServices.length > 0) {
      // Aggiorna tutti i servizi
      setAllServices(sortedServices);
      
      // Distribuisci i servizi per categoria
      const categorized: Record<string, ServiceType[]> = {};
      
      // Inizializza array vuoti per ogni categoria
      serviceCategories.forEach(category => {
        categorized[category] = [];
      });
      
      // Popola gli array per categoria
      sortedServices.forEach(service => {
        if (categorized[service.category]) {
          categorized[service.category].push(service);
        }
      });
      
      // Aggiorna gli stati
      setServicesByCategory(categorized);
    }
  }, [sortedServices]);
  
  const handleEditService = (service: ServiceType) => {
    setEditingService(service);
    setIsFormOpen(true);
  };
  
  const handleDeleteService = (service: ServiceType) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteServiceType(serviceToDelete.id);
      toast({
        title: "Servizio eliminato",
        description: "Il servizio è stato eliminato con successo",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Errore di eliminazione",
        description: "Si è verificato un errore durante l'eliminazione del servizio",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  };
  
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingService(null);
  };
  
  const handleFormSubmit = async (data: CreateServiceTypeInput) => {
    try {
      if (editingService) {
        await updateServiceType(editingService.id, data);
        toast({
          title: "Servizio aggiornato",
          description: "Il servizio è stato aggiornato con successo",
        });
      } else {
        await createServiceType(data);
        toast({
          title: "Servizio creato",
          description: "Il servizio è stato creato con successo",
        });
      }
      
      // Aggiornare i dati
      await queryClient.invalidateQueries({ queryKey: ['/serviceTypes'] });
      await refetch();
      
      setIsFormOpen(false);
      setEditingService(null);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del servizio",
        variant: "destructive",
      });
    }
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Componente per la tabella dei servizi
  const ServiceTable = ({ services }: { services: ServiceType[] }) => {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(services.length / ITEMS_PER_PAGE);
    
    const paginatedServices = services.slice(
      (page - 1) * ITEMS_PER_PAGE, 
      page * ITEMS_PER_PAGE
    );
    
    const goToNextPage = () => {
      if (page < totalPages) {
        setPage(page + 1);
      }
    };
    
    const goToPrevPage = () => {
      if (page > 1) {
        setPage(page - 1);
      }
    };
    
    return (
      <div className="overflow-y-hidden hide-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome Servizio</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="hidden md:table-cell">Descrizione</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(3).fill(0).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center p-4 text-muted-foreground">
                  Nessun servizio trovato
                </TableCell>
              </TableRow>
            ) : (
              paginatedServices.map((service) => (
                <TableRow key={service.id} className="hover:bg-accent/50">
                  <TableCell>
                    <div className="font-medium">{service.name}</div>
                  </TableCell>
                  <TableCell>
                    {service.category}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {service.description || 'Nessuna descrizione'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1 md:space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEditService(service)}
                        title="Modifica"
                      >
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteService(service)}
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
        <div className="p-3 md:px-6 md:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border gap-2">
          <div className="text-xs sm:text-sm text-muted-foreground">
            Mostrando <span className="font-medium">{services.length > 0 ? (page - 1) * ITEMS_PER_PAGE + 1 : 0}-{Math.min(page * ITEMS_PER_PAGE, services.length)}</span> di <span className="font-medium">{services.length}</span> servizi
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={page === 1}
                className="h-8 w-8 p-0"
              >
                &lt;
              </Button>
              <div className="text-xs sm:text-sm">
                Pagina {page} di {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={page === totalPages}
                className="h-8 w-8 p-0"
              >
                &gt;
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">

        
        <div className="hidden sm:block">
          <Heading title="Gestione Servizi" description="Gestisci i servizi e i pacchetti disponibili" />
        </div>
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2 sm:space-x-3">
          <Button className="w-full sm:w-auto" onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="sm:inline">Nuovo Servizio</span>
            <span className="inline sm:hidden">Nuovo</span>
          </Button>
          
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={() => refetch()} 
            className="ml-auto sm:ml-2"
            title="Ricarica dati"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border hide-scrollbar">
        <div className="p-3 md:p-4 border-b border-border">
          <div className="flex justify-end">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Ordinamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="category-asc">Categoria (A-Z)</SelectItem>
                <SelectItem value="category-desc">Categoria (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="all" onValueChange={handleTabChange} className="rounded-none">
          <TabsList className="mb-4 w-full overflow-x-auto flex-nowrap overflow-y-hidden hide-scrollbar">
            <TabsTrigger 
              value="all" 
              className="text-xs sm:text-sm"
            >
              Tutti
            </TabsTrigger>
            {serviceCategories
              .filter(category => (servicesByCategory[category] || []).length > 0)
              .map(category => (
                <TabsTrigger 
                  key={category} 
                  value={category} 
                  className="text-xs sm:text-sm"
                >
                  {category}
                </TabsTrigger>
              ))
            }
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            <ServiceTable services={allServices} />
          </TabsContent>
          
          {serviceCategories
            .filter(category => (servicesByCategory[category] || []).length > 0)
            .map(category => (
              <TabsContent key={category} value={category} className="space-y-4">
                <ServiceTable services={servicesByCategory[category] || []} />
              </TabsContent>
            ))
          }
        </Tabs>
      </div>
      
      {isFormOpen && (
        <ServiceForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          service={editingService}
        />
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questo servizio?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Verranno eliminati tutti i dati del servizio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Eliminazione in corso..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Componente form per la creazione/modifica di un servizio
function ServiceForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  service 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (data: CreateServiceTypeInput) => void;
  service: ServiceType | null;
}) {
  // Form per la creazione/modifica di un servizio
  const form = useForm<CreateServiceTypeInput>({
    resolver: zodResolver(createServiceTypeSchema),
    defaultValues: {
      name: service?.name || "",
      category: service?.category || "Tagliando",
      description: service?.description || "",
      laborPrice: 0, // Manteniamo il campo ma impostiamo sempre a 0
    },
  });
  
  // Imposta i valori del form quando si modifica un servizio
  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        category: service.category,
        description: service.description || "",
        laborPrice: 0, // Manteniamo il campo ma impostiamo sempre a 0
      });
    }
  }, [service, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{service ? "Modifica Servizio" : "Nuovo Servizio"}</DialogTitle>
          <DialogDescription>
            {service ? "Modifica i dettagli del servizio esistente." : "Inserisci i dettagli del nuovo servizio."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Servizio</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome del servizio" {...field} />
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
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
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
                    <Input placeholder="Descrizione (opzionale)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Campo laborPrice nascosto: manteniamo il campo nello schema ma non lo mostriamo all'utente */}
            <input type="hidden" {...form.register("laborPrice")} value="0" />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button type="submit">
                {service ? "Aggiorna Servizio" : "Crea Servizio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}