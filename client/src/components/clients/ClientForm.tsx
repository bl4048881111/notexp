import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Client, CreateClientInput } from "@shared/types";
import { createClientSchema } from "@shared/schema";
import { createClient, updateClient } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import { lookupVehicleByPlate, formatVehicleDetails } from "@/services/vehicleLookupService";

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

interface ClientFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client?: Client | null;
}

export default function ClientForm({ isOpen, onClose, onSuccess, client }: ClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      surname: "",
      phone: "",
      email: "",
      plate: "",
      model: "",
      vin: "",
      createdAt: Date.now(),
    }
  });
  
  // Set form values when editing a client
  useEffect(() => {
    if (client) {
      const { id, ...clientData } = client;
      form.reset(clientData);
    }
  }, [client, form]);
  
  // Funzione per cercare i dettagli del veicolo tramite targa
  const handleLookupVehicle = async () => {
    const plate = form.getValues('plate');
    if (!plate || plate.length < 3) {
      toast({
        title: "Targa non valida",
        description: "Inserisci una targa valida per cercare le informazioni sul veicolo.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoadingVehicle(true);
    
    try {
      const vehicleDetails = await lookupVehicleByPlate(plate);
      
      if (!vehicleDetails) {
        toast({
          title: "Veicolo non trovato",
          description: "Non è stato possibile trovare informazioni per questa targa.",
          variant: "destructive",
        });
        return;
      }
      
      const formattedDetails = formatVehicleDetails(vehicleDetails);
      
      // Aggiorna i campi del form con i dettagli del veicolo
      const model = `${formattedDetails.make} ${formattedDetails.model} ${formattedDetails.year}`;
      form.setValue("model", model);
      
      // Se disponibile, aggiorna anche il VIN
      if (vehicleDetails.vin) {
        form.setValue("vin", vehicleDetails.vin);
      }
      
      toast({
        title: "Veicolo trovato",
        description: `${formattedDetails.make} ${formattedDetails.fullModel} ${formattedDetails.power ? `(${formattedDetails.power})` : ''}`,
      });
    } catch (error) {
      console.error("Errore durante la ricerca del veicolo:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la ricerca del veicolo.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVehicle(false);
    }
  };
  
  const onSubmit = async (data: CreateClientInput) => {
    setIsSubmitting(true);
    
    try {
      if (client) {
        // Update existing client
        await updateClient(client.id, data);
        toast({
          title: "Cliente aggiornato",
          description: "Il cliente è stato aggiornato con successo",
        });
      } else {
        // Create new client
        await createClient(data);
        toast({
          title: "Cliente aggiunto",
          description: "Il nuovo cliente è stato aggiunto con successo",
        });
      }
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del cliente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{client ? "Modifica Cliente" : "Nuovo Cliente"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="surname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome</FormLabel>
                    <FormControl>
                      <Input placeholder="Cognome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl>
                      <Input placeholder="Telefono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Targa</FormLabel>
                    <div className="flex w-full items-center space-x-2">
                      <FormControl className="flex-1">
                        <Input 
                          placeholder="Targa" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        onClick={handleLookupVehicle}
                        disabled={isLoadingVehicle}
                        className="shrink-0"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
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
                      <Input placeholder="Modello veicolo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Codice VIN (opzionale)</FormLabel>
                    <FormControl>
                      <Input placeholder="Codice VIN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? "Salvataggio in corso..." 
                  : client ? "Aggiorna Cliente" : "Salva Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
