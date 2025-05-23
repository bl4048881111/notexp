import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Client, CreateClientInput } from "@shared/types";
import { createClientSchema } from "@shared/schema";
import { useClientOperations } from "@/hooks/useClientOperations";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { SimplePopover } from "@/components/ui/simple-popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  const { create, update } = useClientOperations();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      surname: "",
      phone: "",
      birthDate: "", 
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
      // Assicuriamoci che tutti i campi siano definiti correttamente
      const cleanedData = {
        ...data,
        // Se birthDate è undefined o null, impostiamo una stringa vuota
        birthDate: data.birthDate || "",
        // Assicuriamoci che anche gli altri campi non siano undefined
        name: data.name || "",
        surname: data.surname || "",
        phone: data.phone || "",
        email: data.email || "",
        plate: data.plate || "",
        vin: data.vin || "",
        createdAt: data.createdAt || Date.now(),
      };
      
      if (client) {
        // Utilizziamo l'hook personalizzato per l'aggiornamento
        const updatedClient = await update(client.id, cleanedData);
        
        if (updatedClient) {
          // Non serve più il timeout, gestito dall'hook
          onSuccess();
          onClose();
        }
      } else {
        // Genera una password casuale sicura
        const password = nanoid(12);
        setGeneratedPassword(password);
        // Utilizziamo l'hook personalizzato per la creazione
        const newClient = await create({ ...cleanedData, password });
        
        if (newClient) {
          // Mostra la password generata all'admin
          toast({
            title: "Password generata",
            description: `La password temporanea del cliente è: ${password}`,
            duration: 10000
          });
          onSuccess();
          onClose();
        }
      }
    } catch (error) {
      console.error("Errore durante il salvataggio del cliente:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del cliente.",
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
          <DialogDescription>
            {client ? "Modifica i dati del cliente esistente." : "Inserisci i dati del nuovo cliente."}
          </DialogDescription>
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data di nascita</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="gg/mm/aaaa"
                            defaultValue={field.value ? format(new Date(field.value), "dd/MM/yyyy") : ""}
                            onBlur={(e) => {
                              const inputValue = e.target.value;
                              if (!inputValue) {
                                field.onChange("");
                                return;
                              }
                              
                              if (inputValue.length === 10) {
                                const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                                const match = inputValue.match(datePattern);
                                
                                if (match) {
                                  const [_, day, month, year] = match;
                                  const dateStr = `${year}-${month}-${day}`;
                                  const date = new Date(dateStr);
                                  
                                  if (!isNaN(date.getTime())) {
                                    field.onChange(dateStr);
                                  } else {
                                    // Data non valida, impostiamo una stringa vuota
                                    field.onChange("");
                                  }
                                } else {
                                  // Formato non corretto, impostiamo una stringa vuota
                                  field.onChange("");
                                }
                              } else {
                                // Input incompleto, impostiamo una stringa vuota
                                field.onChange("");
                              }
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLInputElement;
                              target.value = target.value.replace(/[^0-9\/]/g, '');
                              
                              // Aggiunge automaticamente gli slash
                              if (target.value.length === 2 && !target.value.includes('/')) {
                                target.value += '/';
                              } else if (target.value.length === 5 && target.value.indexOf('/', 3) === -1) {
                                target.value += '/';
                              }
                            }}
                          />
                        </div>
                      </FormControl>
                      <SimplePopover
                        trigger={
                          <Button
                            variant="outline"
                            type="button"
                            size="icon"
                          >
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                        }
                        align="start"
                        className="p-0"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date: Date | undefined) => {
                            if (date) {
                              field.onChange(format(date, "yyyy-MM-dd"));
                            }
                          }}
                          locale={it}
                          initialFocus
                        />
                      </SimplePopover>
                    </div>
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
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Input placeholder="Password" {...field} />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Genera nuova password"
                          onClick={() => {
                            const newPassword = nanoid(12);
                            field.onChange(newPassword);
                            setGeneratedPassword(newPassword);
                            toast({
                              title: "Nuova password generata",
                              description: `La nuova password è: ${newPassword}`,
                              duration: 8000
                            });
                          }}
                          style={{ marginLeft: 4 }}
                        >
                          <RefreshCw size={18} />
                        </Button>
                      </div>
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
