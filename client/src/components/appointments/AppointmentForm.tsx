import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Appointment, CreateAppointmentInput, Client, SparePart } from "@shared/types";
import { createAppointmentSchema } from "@shared/schema";
import { createAppointment, updateAppointment, getAllClients, getClientById } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { X } from "lucide-react";
import SparePartForm from "./SparePartForm";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import ClientForm from "../clients/ClientForm";

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: Appointment | null;
  selectedDate?: string | null;
}

export default function AppointmentForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointment, 
  selectedDate 
}: AppointmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newService, setNewService] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const { toast } = useToast();
  
  // Fetch clients for autocomplete
  const { data: clients = [] } = useQuery({ 
    queryKey: ['/api/clients'],
    queryFn: getAllClients,
  });
  
  // Filter clients based on search query
  const filteredClients = clients.filter(client => 
    `${client.name} ${client.surname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone.includes(searchQuery)
  );
  
  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      clientId: "",
      clientName: "",
      phone: "",
      plate: "",
      model: "",
      date: selectedDate || format(new Date(), 'yyyy-MM-dd'),
      time: "09:00",
      duration: 60,
      services: [],
      notes: "",
      status: "programmato",
    }
  });
  
  // Set form values when editing an appointment
  useEffect(() => {
    if (appointment) {
      const { id, ...appointmentData } = appointment;
      form.reset(appointmentData);
      setServices(appointmentData.services || []);
      
      // Fetch client data for the appointment
      getClientById(appointmentData.clientId).then(client => {
        if (client) {
          setSelectedClient(client);
        }
      });
    } else if (selectedDate) {
      form.setValue("date", selectedDate);
    }
  }, [appointment, form, selectedDate]);
  
  // Update services field when services array changes
  useEffect(() => {
    form.setValue("services", services);
  }, [services, form]);
  
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id);
    form.setValue("clientName", `${client.name} ${client.surname}`);
    form.setValue("phone", client.phone);
    form.setValue("plate", client.plate);
    form.setValue("model", client.model);
    setSearchQuery(`${client.name} ${client.surname}`);
  };
  
  const handleAddService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()]);
      setNewService("");
    }
  };
  
  const handleRemoveService = (serviceToRemove: string) => {
    setServices(services.filter(service => service !== serviceToRemove));
  };
  
  const handleAddNewClient = () => {
    setIsClientFormOpen(true);
  };
  
  const handleClientFormSuccess = () => {
    setIsClientFormOpen(false);
    // Refetch clients
    setTimeout(() => {
      getAllClients().then(updatedClients => {
        const newClient = updatedClients[updatedClients.length - 1];
        if (newClient) {
          handleSelectClient(newClient);
        }
      });
    }, 1000);
  };
  
  const onSubmit = async (data: CreateAppointmentInput) => {
    setIsSubmitting(true);
    
    try {
      if (appointment) {
        // Update existing appointment
        await updateAppointment(appointment.id, data);
        toast({
          title: "Appuntamento aggiornato",
          description: "L'appuntamento è stato aggiornato con successo",
        });
      } else {
        // Create new appointment
        await createAppointment(data);
        toast({
          title: "Appuntamento aggiunto",
          description: "Il nuovo appuntamento è stato aggiunto con successo",
        });
      }
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio dell'appuntamento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{appointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <div className="relative">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Input 
                        placeholder="Cerca cliente per nome o telefono..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="max-h-60 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <div 
                              key={client.id}
                              className="p-2 cursor-pointer hover:bg-accent"
                              onClick={() => handleSelectClient(client)}
                            >
                              <div>{client.name} {client.surname}</div>
                              <div className="text-xs text-muted-foreground">{client.phone} - {client.plate}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-muted-foreground">Nessun cliente trovato</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={handleAddNewClient}
                    title="Aggiungi nuovo cliente"
                  >
                    <span className="material-icons text-primary">person_add</span>
                  </Button>
                </div>
              </FormItem>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Targa</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Targa" 
                          {...field} 
                          readOnly={!!selectedClient}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modello Veicolo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Modello veicolo" 
                          {...field} 
                          readOnly={!!selectedClient}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ora</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durata (minuti)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="15" 
                          step="15" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stato</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona stato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="programmato">Programmato</SelectItem>
                          <SelectItem value="completato">Completato</SelectItem>
                          <SelectItem value="annullato">Annullato</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormItem>
                <FormLabel>Servizi</FormLabel>
                <div className="flex flex-wrap p-2 bg-background border border-border rounded-md min-h-[80px]">
                  {services.map((service, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="group m-1 py-1 px-3 rounded-full bg-primary/15 border-primary"
                    >
                      <span className="mr-1">{service}</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => handleRemoveService(service)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  <div className="flex">
                    <Input
                      type="text"
                      placeholder="Aggiungi servizio..."
                      className="border-0 bg-transparent p-1 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddService();
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="p-1 h-auto"
                      onClick={handleAddService}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </FormItem>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Note aggiuntive..." 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button type="submit" disabled={isSubmitting || !selectedClient}>
                  {isSubmitting 
                    ? "Salvataggio in corso..." 
                    : appointment ? "Aggiorna Appuntamento" : "Salva Appuntamento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {isClientFormOpen && (
        <ClientForm
          isOpen={isClientFormOpen}
          onClose={() => setIsClientFormOpen(false)}
          onSuccess={handleClientFormSuccess}
        />
      )}
    </>
  );
}
