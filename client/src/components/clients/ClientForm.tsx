import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Client, CreateClientInput } from "@shared/types";
import { createClientSchema } from "@shared/schema";
import { createClient, updateClient } from "@shared/firebase";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      surname: "",
      phone: "",
      email: "",
      plate: "",
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
  
  const onSubmit = async (data: CreateClientInput) => {
    setIsSubmitting(true);
    
    try {
      // Carica il modulo di logging in modo dinamico
      const activityModule = await import('../dev/ActivityLogger');
      const { useActivityLogger } = activityModule;
      let logActivity;
      
      try {
        logActivity = useActivityLogger().logActivity;
      } catch (error) {
        console.warn("ActivityLogger non disponibile:", error);
      }
      
      if (client) {
        // Update existing client
        await updateClient(client.id, data);
        
        // Log dell'attività di aggiornamento
        if (logActivity) {
          logActivity(
            'update_client',
            `Cliente aggiornato: ${data.name} ${data.surname}`,
            {
              clientId: client.id,
              name: data.name,
              surname: data.surname,
              phone: data.phone,
              plate: data.plate,
              timestamp: new Date()
            }
          );
        }
        
        toast({
          title: "Cliente aggiornato",
          description: "Il cliente è stato aggiornato con successo",
        });
      } else {
        // Create new client
        const newClient = await createClient(data);
        
        // Log dell'attività di creazione
        if (logActivity) {
          logActivity(
            'create_client',
            `Nuovo cliente: ${data.name} ${data.surname}`,
            {
              clientId: newClient.id,
              name: data.name,
              surname: data.surname,
              phone: data.phone,
              plate: data.plate,
              timestamp: new Date()
            }
          );
        }
        
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
                    <FormControl>
                      <Input 
                        placeholder="Targa" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
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
