import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Client, CreateClientInput, Vehicle, Appointment } from "@shared/types";
import { Quote } from "@shared/schema";
import { createClientSchema } from "@shared/schema";
import { useClientOperations } from "@/hooks/useClientOperations";
import { getAppointmentsByClientId, getQuotesByClientId } from "@shared/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar as CalendarIcon, RefreshCw, Plus, Trash2, Upload, X, User, Car, Clock, FileText, Calendar, Phone, Mail, FileImage, Camera, Eye, Building2, UserCheck } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ClientFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client?: Client | null;
}

interface VehicleForForm {
  id: string;
  plate: string;
  vin: string;
  registrationPhotos?: string[];
  createdAt?: number;
}

// Tipo specifico per il form che risolve i problemi TypeScript
type ClientFormData = {
  name?: string;
  surname?: string;
  phone: string;
  email?: string;
  plate?: string;
  vin?: string;
  password?: string;
  tipo_cliente: "privato" | "azienda";
  cf?: string;
  piva?: string;
  sdi?: string;
  pec?: string;
  birthDate?: string;
  vehicles?: VehicleForForm[];
  createdAt?: number;
};

export default function ClientForm({ isOpen, onClose, onSuccess, client }: ClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { create, update } = useClientOperations();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleForForm[]>([]);
  const [lastAppointment, setLastAppointment] = useState<Appointment | null>(null);
  const [lastQuote, setLastQuote] = useState<Quote | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [tipoCliente, setTipoCliente] = useState<"privato" | "azienda">("privato");
  
  // Nuovo state per gestire le maschere
  const [currentStep, setCurrentStep] = useState<"tipo_cliente" | "form_dati">("tipo_cliente");
  
  // ✅ SOLUZIONE: Ref per tracciare l'apertura iniziale
  const isInitialOpenRef = useRef(false);
  
  // Gestione dell'apertura e chiusura del dialog
  useEffect(() => {
    if (isOpen && !isInitialOpenRef.current) {
      // ✅ Prima apertura del dialog
      isInitialOpenRef.current = true;
      
      if (client) {
        // Cliente esistente → vai direttamente al form dati
        setCurrentStep("form_dati");
      } else {
        // Nuovo cliente → inizia dalla selezione tipo
        setCurrentStep("tipo_cliente");
      }
      
      // Timeout per permettere al dialog di renderizzarsi completamente
      const timer = setTimeout(() => {
        const firstInput = document.querySelector('[data-dialog-content] input:not([type="hidden"])') as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      // ✅ Dialog chiuso → reset completo
      isInitialOpenRef.current = false;
      setCurrentStep("tipo_cliente");
    }
  }, [isOpen, client]);
  
  const form = useForm<ClientFormData>({
    defaultValues: {
      name: "",
      surname: "",
      phone: "",
      birthDate: "", 
      email: "",
      plate: "",
      vin: "",
      password: "",
      tipo_cliente: "privato",
      cf: "",
      piva: "",
      sdi: "",
      pec: "",
      vehicles: [],
      createdAt: Date.now(),
    }
  });

  const { fields: vehicleFields, append: appendVehicle, remove: removeVehicle } = useFieldArray({
    control: form.control,
    name: "vehicles" as any,
  });

  // Funzione per procedere alla seconda maschera
  const proceedToFormData = () => {
    setCurrentStep("form_dati");
  };

  // Funzione per tornare alla prima maschera
  const backToTipoCliente = () => {
    setCurrentStep("tipo_cliente");
  };

  // Funzione per caricare ultimo appuntamento e preventivo
  const loadClientHistory = async (clientId: string) => {
    if (!clientId) return;
    
    setIsLoadingData(true);
    try {
      // Carica ultimi appuntamenti
      const appointments = await getAppointmentsByClientId(clientId);
      if (appointments.length > 0) {
        // Ordina per data più recente
        const sortedAppointments = appointments.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });
        setLastAppointment(sortedAppointments[0]);
      } else {
        setLastAppointment(null);
      }

      // Carica ultimi preventivi
      const quotes = await getQuotesByClientId(clientId);
      if (quotes.length > 0) {
        // Ordina per data più recente
        const sortedQuotes = quotes.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });
        setLastQuote(sortedQuotes[0]);
      } else {
        setLastQuote(null);
      }
    } catch (error) {
      console.error("Errore nel caricamento della storia del cliente:", error);
    } finally {
      setIsLoadingData(false);
    }
  };
  
  // Set form values when editing a client
  useEffect(() => {
    if (client) {
      const { id, ...clientData } = client;
      form.reset({
        ...clientData,
        tipo_cliente: client.tipo_cliente || "privato",
        cf: client.cf || "",
        piva: client.piva || "",
        sdi: client.sdi || "",
        pec: client.pec || ""
      });
      
      // Imposta il tipo cliente nello stato locale
      setTipoCliente(client.tipo_cliente || "privato");
      
      // Carica la storia del cliente
      loadClientHistory(client.id);
      
      // Imposta i veicoli se presenti
      if (client.vehicles && client.vehicles.length > 0) {
        setVehicles(client.vehicles.map(v => ({ 
          id: v.id,
          plate: v.plate,
          vin: v.vin || "",
          registrationPhotos: v.registrationPhotos || [],
          createdAt: v.createdAt || Date.now()
        })));
      } else {
        // Se il cliente ha targa/vin singoli, creane un veicolo
        if (client.plate || client.vin) {
          setVehicles([{
            id: nanoid(),
            plate: client.plate || "",
            vin: client.vin || "",
            registrationPhotos: [],
            createdAt: Date.now()
          }]);
        }
      }
    }
  }, [client, form]);
  
  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        name: "",
        surname: "",
        phone: "",
        birthDate: "", 
        email: "",
        plate: "",
        vin: "",
        password: "",
        tipo_cliente: "privato",
        cf: "",
        piva: "",
        sdi: "",
        pec: "",
        vehicles: [],
        createdAt: Date.now(),
      });
      setGeneratedPassword(null);
      setVehicles([]);
      setLastAppointment(null);
      setLastQuote(null);
    } else if (isOpen && !client) {
      // ✅ NUOVO: Quando si apre il form per un nuovo cliente, inizializza con un veicolo vuoto
      setVehicles([{
        id: nanoid(),
        plate: "",
        vin: "",
        registrationPhotos: [],
        createdAt: Date.now()
      }]);
    }
  }, [isOpen, client, form]);

  const addVehicle = () => {
    // ✅ LIMITE MASSIMO: Non più di 4 veicoli per cliente
    if (vehicles.length >= 4) {
      toast({
        title: "Limite raggiunto",
        description: "È possibile aggiungere massimo 4 veicoli per cliente.",
        variant: "destructive",
      });
      return;
    }
    
    const newVehicle: VehicleForForm = {
      id: nanoid(),
      plate: "",
      vin: "",
      registrationPhotos: [],
      createdAt: Date.now()
    };
    setVehicles([...vehicles, newVehicle]);
  };

  const removeVehicleAt = (index: number) => {
    const newVehicles = vehicles.filter((_, i) => i !== index);
    setVehicles(newVehicles);
  };

  const updateVehicle = (index: number, field: keyof VehicleForForm, value: string) => {
    const newVehicles = [...vehicles];
    newVehicles[index] = { 
      ...newVehicles[index], 
      [field]: value,
      // Aggiungi timestamp se non presente
      createdAt: newVehicles[index].createdAt || Date.now()
    };
    setVehicles(newVehicles);
  };

  const handleFileUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newVehicles = [...vehicles];
    const currentPhotos = newVehicles[index].registrationPhotos || [];
    
    // Limita a max 1 foto per veicolo
    if (currentPhotos.length + files.length > 1) {
      toast({
        title: "Troppi file",
        description: "Puoi caricare massimo 1 foto del libretto per veicolo",
        variant: "destructive",
      });
      return;
    }
    
    // Se c'è già una foto, sostituiscila
    if (currentPhotos.length > 0) {
      toast({
        title: "Foto sostituita",
        description: "La foto precedente del libretto è stata sostituita",
      });
    }

    // Funzione per tentare l'upload con retry
    const uploadWithRetry = async (file: File, maxRetries = 2): Promise<string> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const formData = new FormData();
          formData.append('image', file);
          formData.append('key', import.meta.env.VITE_IMGBBPREVENTIVO_API_KEY || 'de4ed1622d20d44b474de3b43f3e062d');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondi timeout

          const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          if (data.success) {
            return data.data.url;
          } else {
            throw new Error(data.error?.message || 'Errore API ImgBB');
          }
        } catch (error: any) {
          console.warn(`Tentativo ${attempt}/${maxRetries} fallito:`, error.message);
          
          if (attempt === maxRetries) {
            // Se tutti i tentativi sono falliti, usa fallback locale
            console.log('Tutti i tentativi ImgBB falliti, uso fallback locale');
            return await createLocalImageUrl(file);
          }
          
          // Attendi prima del prossimo tentativo
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      
      throw new Error('Upload fallito dopo tutti i tentativi');
    };

    // Fallback: converti l'immagine in base64 per storage locale
    const createLocalImageUrl = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            // Crea un identificatore unico per l'immagine locale
            const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const dataUrl = reader.result as string;
            
            // Salva nel localStorage per persistenza (opzionale)
            try {
              localStorage.setItem(`vehicle_photo_${localId}`, dataUrl);
            } catch (e) {
              console.warn('Impossibile salvare nel localStorage:', e);
            }
            
            resolve(dataUrl);
          } else {
            reject(new Error('Impossibile leggere il file'));
          }
        };
        reader.onerror = () => reject(new Error('Errore lettura file'));
        reader.readAsDataURL(file);
      });
    };

    try {
      toast({
        description: "Caricamento foto in corso...",
      });

      const uploadPromises = Array.from(files).map(file => uploadWithRetry(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      
      // Sostituisci completamente le foto (max 1)
      newVehicles[index].registrationPhotos = uploadedUrls.slice(0, 1);
      setVehicles(newVehicles);
      
      // Verifica se è un URL locale o remoto per il messaggio
      const isLocalStorage = uploadedUrls[0].startsWith('data:');
      
      toast({
        title: isLocalStorage ? "Foto salvata localmente" : "Foto caricata online",
        description: isLocalStorage 
          ? "Foto salvata nel dispositivo (sarà caricata online al salvataggio)" 
          : "Foto del libretto caricata con successo!",
      });
    } catch (error: any) {
      console.error('Errore durante il caricamento delle foto:', error);
      toast({
        title: "Errore nel caricamento",
        description: `Impossibile caricare la foto. ${error?.message || 'Errore sconosciuto'}`,
        variant: "destructive",
      });
    }
  };

  const handleCameraCapture = async (vehicleIndex: number) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Errore",
          description: "Il tuo browser non supporta l'accesso alla camera",
          variant: "destructive",
        });
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      }

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      // Crea interfaccia di acquisizione
      const captureDialog = document.createElement('div');
      captureDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      `;

      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = `
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        min-height: 0;
      `;

      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;

      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 20px;
        display: flex;
        gap: 15px;
        justify-content: center;
        background: rgba(0,0,0,0.9);
        z-index: 100000;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-top: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
      `;

      const captureBtn = document.createElement('button');
      captureBtn.textContent = 'Scatta Foto';
      captureBtn.style.cssText = `
        background: #ec6b00;
        color: white;
        border: none;
        padding: 18px 30px;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 140px;
        min-height: 54px;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 4px 12px rgba(236, 107, 0, 0.3);
        z-index: 100001;
        position: relative;
      `;

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Annulla';
      cancelBtn.style.cssText = `
        background: #666;
        color: white;
        border: none;
        padding: 18px 30px;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 140px;
        min-height: 54px;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 4px 12px rgba(102, 102, 102, 0.3);
        z-index: 100001;
        position: relative;
      `;

      // Aggiungi effetti hover/active per mobile
      const addButtonEffects = (button: HTMLElement, activeColor: string) => {
        button.addEventListener('touchstart', () => {
          button.style.transform = 'scale(0.95)';
          button.style.backgroundColor = activeColor;
        });
        
        button.addEventListener('touchend', () => {
          button.style.transform = 'scale(1)';
          setTimeout(() => {
            if (button === captureBtn) {
              button.style.backgroundColor = '#ec6b00';
            } else {
              button.style.backgroundColor = '#666';
            }
          }, 100);
        });
        
        button.addEventListener('touchcancel', () => {
          button.style.transform = 'scale(1)';
          if (button === captureBtn) {
            button.style.backgroundColor = '#ec6b00';
          } else {
            button.style.backgroundColor = '#666';
          }
        });
      };

      addButtonEffects(captureBtn, '#d4590a');
      addButtonEffects(cancelBtn, '#555');

      videoContainer.appendChild(video);
      buttonsContainer.appendChild(captureBtn);
      buttonsContainer.appendChild(cancelBtn);
      captureDialog.appendChild(videoContainer);
      captureDialog.appendChild(buttonsContainer);
      document.body.appendChild(captureDialog);

      // Previeni lo scroll del body dietro il modal
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';

      const cleanup = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(captureDialog);
        // Ripristina lo scroll del body
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };

      const captureImage = () => {
        try {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            toast({
              title: "Errore",
              description: "Video non ancora pronto. Riprova tra un momento.",
              variant: "destructive",
            });
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context!.drawImage(video, 0, 0);

          canvas.toBlob(async (blob) => {
            if (!blob) {
              toast({
                title: "Errore",
                description: "Errore nella creazione dell'immagine",
                variant: "destructive",
              });
              cleanup();
              return;
            }

            cleanup();

            // Funzione di upload con retry per la camera
            const uploadCapturedImage = async (blob: Blob): Promise<string> => {
              const maxRetries = 2;
              
              for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                  const formData = new FormData();
                  formData.append('image', blob, `libretto-${Date.now()}.jpg`);
                  formData.append('key', import.meta.env.VITE_IMGBBPREVENTIVO_API_KEY || 'de4ed1622d20d44b474de3b43f3e062d');

                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondi timeout

                  const response = await fetch('https://api.imgbb.com/1/upload', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal,
                  });

                  clearTimeout(timeoutId);

                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }

                  const data = await response.json();
                  if (data.success) {
                    return data.data.url;
                  } else {
                    throw new Error(data.error?.message || 'Errore API ImgBB');
                  }
                } catch (error: any) {
                  console.warn(`Tentativo upload camera ${attempt}/${maxRetries} fallito:`, error.message);
                  
                  if (attempt === maxRetries) {
                    // Se tutti i tentativi sono falliti, usa fallback locale
                    console.log('Tutti i tentativi ImgBB falliti per foto camera, uso fallback locale');
                    return await createLocalImageFromBlob(blob);
                  }
                  
                  // Attendi prima del prossimo tentativo
                  await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
              }
              
              throw new Error('Upload camera fallito dopo tutti i tentativi');
            };

            // Fallback locale per blob della camera
            const createLocalImageFromBlob = (blob: Blob): Promise<string> => {
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (reader.result) {
                    const localId = `camera_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const dataUrl = reader.result as string;
                    
                    // Salva nel localStorage per persistenza (opzionale)
                    try {
                      localStorage.setItem(`vehicle_photo_${localId}`, dataUrl);
                    } catch (e) {
                      console.warn('Impossibile salvare nel localStorage:', e);
                    }
                    
                    resolve(dataUrl);
                  } else {
                    reject(new Error('Impossibile leggere il blob'));
                  }
                };
                reader.onerror = () => reject(new Error('Errore lettura blob'));
                reader.readAsDataURL(blob);
              });
            };

            try {
              toast({
                description: "Caricamento foto scattata...",
              });

              const imgUrl = await uploadCapturedImage(blob);
              
              // Aggiungi la foto al veicolo
              const newVehicles = [...vehicles];
              const currentPhotos = newVehicles[vehicleIndex].registrationPhotos || [];
              
              if (currentPhotos.length >= 1) {
                toast({
                  title: "Foto sostituita",
                  description: "La foto precedente del libretto è stata sostituita",
                });
              }
              
              newVehicles[vehicleIndex].registrationPhotos = [imgUrl]; // Solo 1 foto
              setVehicles(newVehicles);
              
              // Verifica se è un URL locale o remoto per il messaggio
              const isLocalStorage = imgUrl.startsWith('data:');
              
              toast({
                title: isLocalStorage ? "Foto salvata localmente" : "Foto caricata online",
                description: isLocalStorage 
                  ? "Foto salvata nel dispositivo (sarà caricata online al salvataggio)" 
                  : "Foto del libretto scattata e caricata con successo!",
              });
            } catch (error: any) {
              console.error('Errore durante il caricamento della foto scattata:', error);
              toast({
                title: "Errore nel caricamento",
                description: `Impossibile caricare la foto scattata. ${error?.message || 'Errore sconosciuto'}`,
                variant: "destructive",
              });
            }
          }, 'image/jpeg', 0.85);
        } catch (error) {
          console.error('Errore nella cattura:', error);
          toast({
            title: "Errore",
            description: "Errore nella cattura dell'immagine. Riprova.",
            variant: "destructive",
          });
          cleanup();
        }
      };

      captureBtn.onclick = captureImage;
      cancelBtn.onclick = cleanup;

      // Aggiungi evento per chiudere premendo ESC
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', handleKeyDown);
        }
      };
      document.addEventListener('keydown', handleKeyDown);

    } catch (error) {
      console.error('Errore nell\'accesso alla camera:', error);
    }
  };

  const removePhoto = (vehicleIndex: number, photoIndex: number) => {
    const newVehicles = [...vehicles];
    const currentPhotos = newVehicles[vehicleIndex].registrationPhotos || [];
    // Se sono URLs (string), rimuovi normalmente
    if (typeof currentPhotos[photoIndex] === 'string') {
      newVehicles[vehicleIndex].registrationPhotos = currentPhotos.filter((_, i) => i !== photoIndex);
    }
    setVehicles(newVehicles);
  };

  // Funzione per formattare le date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: it });
    } catch {
      return "Data non valida";
    }
  };

  // Funzione per ottenere l'icona del badge di stato
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      'programmato': { color: 'bg-blue-500', text: 'Programmato' },
      'in_lavorazione': { color: 'bg-yellow-500', text: 'In Lavorazione' },
      'completato': { color: 'bg-green-500', text: 'Completato' },
      'annullato': { color: 'bg-red-500', text: 'Annullato' },
      'bozza': { color: 'bg-gray-500', text: 'Bozza' },
      'inviato': { color: 'bg-blue-500', text: 'Inviato' },
      'accettato': { color: 'bg-green-500', text: 'Accettato' },
      'scaduto': { color: 'bg-red-500', text: 'Scaduto' },
      'archiviato': { color: 'bg-gray-500', text: 'Archiviato' }
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-500', text: status };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${config.color}`}>
        {config.text}
      </span>
    );
  };
  
  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    
    try {
      // ✅ VALIDAZIONE OBBLIGATORIA: Almeno un veicolo deve essere presente
      if (vehicles.length === 0) {
        toast({
          title: "Veicolo obbligatorio",
          description: "È necessario aggiungere almeno un veicolo per il cliente.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // ✅ VALIDAZIONE: Ogni veicolo deve avere almeno la targa
      const vehiclesWithoutPlate = vehicles.filter(v => !v.plate || v.plate.trim() === "");
      if (vehiclesWithoutPlate.length > 0) {
        toast({
          title: "Targa obbligatoria",
          description: "Ogni veicolo deve avere una targa valida.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // ✅ VALIDAZIONE: Ogni veicolo deve avere il telaio (VIN)
      const vehiclesWithoutVin = vehicles.filter(v => !v.vin || v.vin.trim() === "");
      if (vehiclesWithoutVin.length > 0) {
        toast({
          title: "Telaio obbligatorio",
          description: "Ogni veicolo deve avere un codice telaio (VIN) valido.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Ordina i veicoli per data di aggiunta (il più vecchio prima)
      const sortedVehicles = [...vehicles].sort((a, b) => {
        const dateA = a.createdAt || 0;
        const dateB = b.createdAt || 0;
        return dateA - dateB;
      });

      // Prepara i dati del cliente nel formato corretto
      const clientData: any = {
        name: data.name,
        surname: data.surname,
        phone: data.phone,
        email: data.email,
        password: data.password || (client ? undefined : nanoid(12)),
        birthDate: data.birthDate || "",
        tipo_cliente: data.tipo_cliente,
        cf: data.cf,
        piva: data.piva,
        sdi: data.sdi,
        pec: data.pec,
        // Usa i veicoli ordinati
        vehicles: sortedVehicles.map(v => ({
          id: v.id,
          plate: v.plate.trim(),
          vin: v.vin?.trim() || "",
          registrationPhotos: v.registrationPhotos || [],
          createdAt: v.createdAt || Date.now()
        })),
        // Mantieni compatibilità con campi legacy (primo veicolo più vecchio)
        plate: sortedVehicles[0]?.plate?.trim() || "",
        vin: sortedVehicles[0]?.vin?.trim() || ""
      };

      let result;
      if (client) {
        // Modalità modifica - aggiorna cliente esistente
        // Per la modifica, non inviare la password se è vuota
        if (!data.password || data.password.trim() === "") {
          const { password, ...dataWithoutPassword } = clientData;
          result = await update(client.id, dataWithoutPassword);
        } else {
          result = await update(client.id, clientData);
        }
      } else {
        // Modalità creazione - crea nuovo cliente
        // Genera una password casuale se non fornita
        if (!clientData.password) {
          clientData.password = nanoid(12);
          setGeneratedPassword(clientData.password);
        }
        result = await create(clientData);
      }

      if (result) {
        if (!client && generatedPassword) {
          // Mostra la password generata all'admin per nuovi clienti
          toast({
            title: "Password generata",
            description: `La password temporanea del cliente è: ${generatedPassword}`,
            duration: 10000
          });
        }
        
        // Chiudi il form e notifica il successo
        onClose();
        onSuccess();
      }
    } catch (error) {
      console.error('Errore durante il salvataggio del cliente:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del cliente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewPhoto = (photoUrl: string) => {
    setViewingPhoto(photoUrl);
  };

  const closePhotoViewer = () => {
    setViewingPhoto(null);
  };

  // Gestione ESC per il modal foto
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && viewingPhoto) {
        closePhotoViewer();
      }
    };

    if (viewingPhoto) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [viewingPhoto]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] overflow-y-auto z-[9999] p-2" 
        data-dialog-content
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (!isSubmitting) {
            onClose();
          } else {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {client ? 'Modifica Cliente' : 'Nuovo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {client ? 'Modifica i dati del cliente selezionato' : 'Inserisci i dati per creare un nuovo cliente'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            
            {/* PRIMA MASCHERA: Selezione Tipo Cliente */}
            {currentStep === "tipo_cliente" && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-full mb-4">
                    <Building2 className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Tipo di cliente</h3>
                  <p className="text-gray-300">Seleziona per personalizzare i dati necessari</p>
                </div>
                
                <FormField
                  control={form.control}
                  name="tipo_cliente"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                          {/* Card Cliente Privato */}
                          <div 
                            className={`relative cursor-pointer transition-all duration-300 group ${
                              field.value === "privato" 
                                ? "ring-2 ring-orange-500 bg-gray-800" 
                                : "hover:bg-gray-800 hover:border-orange-400"
                            }`}
                            onClick={() => {
                              field.onChange("privato");
                              setTipoCliente("privato");
                            }}
                          >
                            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 h-full flex flex-col items-center text-center">
                              <div className={`flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-colors ${
                                field.value === "privato" 
                                  ? "bg-orange-500" 
                                  : "bg-gray-700 group-hover:bg-orange-500"
                              }`}>
                                <UserCheck className="h-6 w-6 text-white" />
                              </div>
                              
                              <h4 className="font-semibold text-white mb-2">Cliente Privato</h4>
                              <p className="text-sm text-gray-300 mb-4 flex-grow">
                                Per persone fisiche.<br/>
                                Richiede solo il codice fiscale.
                              </p>
                              
                              <div className={`text-sm font-medium transition-colors ${
                                field.value === "privato" ? "text-orange-400" : "text-gray-400"
                              }`}>
                                {field.value === "privato" ? "✓ Selezionato" : "Seleziona"}
                              </div>
                            </div>
                          </div>

                          {/* Card Azienda */}
                          <div 
                            className={`relative cursor-pointer transition-all duration-300 group ${
                              field.value === "azienda" 
                                ? "ring-2 ring-orange-500 bg-gray-800" 
                                : "hover:bg-gray-800 hover:border-orange-400"
                            }`}
                            onClick={() => {
                              field.onChange("azienda");
                              setTipoCliente("azienda");
                            }}
                          >
                            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 h-full flex flex-col items-center text-center">
                              <div className={`flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-colors ${
                                field.value === "azienda" 
                                  ? "bg-orange-500" 
                                  : "bg-gray-700 group-hover:bg-orange-500"
                              }`}>
                                <Building2 className="h-6 w-6 text-white" />
                              </div>
                              
                              <h4 className="font-semibold text-white mb-2">Azienda</h4>
                              <p className="text-sm text-gray-300 mb-4 flex-grow">
                                Per aziende e professionisti.<br/>
                                Richiede dati fiscali completi.
                              </p>
                              
                              <div className={`text-sm font-medium transition-colors ${
                                field.value === "azienda" ? "text-orange-400" : "text-gray-400"
                              }`}>
                                {field.value === "azienda" ? "✓ Selezionato" : "Seleziona"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />


                {/* Pulsanti minimali */}
                <div className="flex justify-center gap-4 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={onClose} 
                    className="px-6 text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    Annulla
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => {
                      setTipoCliente(form.getValues("tipo_cliente"));
                      proceedToFormData();
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8"
                  >
                    Continua
                  </Button>
                </div>
              </div>
            )}

            {/* SECONDA MASCHERA: Form Dati Completo */}
            {currentStep === "form_dati" && (
              <div className="space-y-3">
                
                {/* Badge Tipo Cliente per modifica/seconda maschera */}
                <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-orange-500 rounded-full">
                        {tipoCliente === "privato" ? (
                          <UserCheck className="h-5 w-5 text-white" />
                        ) : (
                          <Building2 className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          {tipoCliente === "privato" ? "Cliente Privato" : "Azienda"}
                        </h4>
                        <p className="text-sm text-gray-300">
                          {client ? "Modifica dati cliente" : "Nuovo cliente"}
                        </p>
                      </div>
                    </div>
                    {!client && (
                      <Button 
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={backToTipoCliente}
                        className="text-gray-300 hover:text-orange-400 hover:bg-gray-700"
                      >
                        ← Cambia
                      </Button>
                    )}
                  </div>
                </div>

                {/* Grid principale con allineamento perfetto */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
                  
                  {/* COLONNA 1: DATI PERSONALI */}
                  <div className="flex flex-col space-y-4">
                    {/* Header sezione con altezza fissa */}
                    <div className="flex items-center gap-2 h-12 border-b border-gray-600">
                      <User className="h-4 w-4 text-orange-500" />
                      <h3 className="font-medium text-white">Dati Personali</h3>
                    </div>
                    
                    {/* Container campi con altezza minima */}
                    <div className="grid grid-cols-1 gap-3 min-h-[400px]">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-300">Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome" {...field} className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="surname"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-300">Cognome</FormLabel>
                            <FormControl>
                              <Input placeholder="Cognome" {...field} className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs flex items-center gap-1 text-gray-300">
                              <Phone className="h-3 w-3" />
                              Telefono
                              <span className="text-red-400 ml-1">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Telefono" {...field} className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs flex items-center gap-1 text-gray-300">
                              <Mail className="h-3 w-3" />
                              Email
                              <span className="text-red-400 ml-1">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Email" type="email" {...field} className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="birthDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-300">Data di nascita</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="gg/mm/aaaa"
                                value={field.value ? (() => {
                                  // Se è in formato ISO (YYYY-MM-DD), convertilo in formato italiano
                                  if (/^\d{4}-\d{2}-\d{2}$/.test(field.value)) {
                                    const [year, month, day] = field.value.split('-');
                                    return `${day}/${month}/${year}`;
                                  }
                                  // Se è già in formato italiano o altro, usalo così com'è
                                  return field.value;
                                })() : ""}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  // Aggiorna il valore mentre l'utente digita
                                  field.onChange(inputValue);
                                }}
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
                                className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-300">Password</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input placeholder="Password" {...field} className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400" />
                                <Button
                                  type="button"
                                  size="sm"
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
                                  className="h-9 w-9 p-0 text-gray-300 hover:text-orange-400 hover:bg-gray-700"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* SEZIONE DATI FISCALI DINAMICA */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 h-12 border-b border-gray-600">
                        {tipoCliente === "privato" ? (
                          <UserCheck className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Building2 className="h-4 w-4 text-orange-500" />
                        )}
                        <h3 className="font-medium text-white">
                          {tipoCliente === "privato" ? "Codice Fiscale" : "Dati Fiscali"}
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {/* Codice Fiscale - SEMPRE VISIBILE */}
                        <FormField
                          control={form.control}
                          name="cf"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-300">Codice Fiscale</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="RSSMRA80A01H501X" 
                                  {...field} 
                                  className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400" 
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        
                        {/* Campi SOLO per AZIENDE */}
                        {tipoCliente === "azienda" && (
                          <>
                            <FormField
                              control={form.control}
                              name="piva"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-gray-300">Partita IVA</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="12345678901" 
                                      {...field} 
                                      className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="sdi"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-gray-300">Codice SDI</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="ABCDEFG" 
                                      {...field} 
                                      className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="pec"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs text-gray-300">PEC</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="nome@pec.it" 
                                      type="email"
                                      {...field} 
                                      className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COLONNA 2-3: GARAGE (ESPANSO) */}
                  <div className="xl:col-span-2 flex flex-col space-y-4">
                    {/* Header sezione con altezza fissa identica */}
                    <div className="flex items-center justify-between h-12 border-b border-gray-600">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-orange-500" />
                        <h3 className="font-medium text-white">
                          Garage del Cliente
                          <span className="text-red-400 ml-1">*</span>
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          vehicles.length >= 4 
                            ? "text-red-400 bg-red-900" 
                            : "text-gray-300 bg-gray-700"
                        }`}>
                          {vehicles.length}/4 veicolo{vehicles.length !== 1 ? '/i' : ''}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addVehicle}
                        className="flex items-center gap-1 h-9 text-xs border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                        disabled={vehicles.length >= 4}
                        title={vehicles.length >= 4 ? "Massimo 4 veicoli per cliente" : "Aggiungi nuovo veicolo"}
                      >
                        <Plus className="h-3 w-3" />
                        Aggiungi
                      </Button>
                    </div>
                    
                    {/* Contenuto garage con altezza minima uniforme */}
                    <div className="min-h-[500px]">
                      {vehicles.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-red-800 rounded-lg bg-red-900/20">
                          <Car className="h-8 w-8 mx-auto mb-3 text-red-400" />
                          <p className="text-sm text-red-400 font-medium">⚠️ Almeno un veicolo è obbligatorio</p>
                          <p className="text-xs text-red-500 mt-1">Clicca su "Aggiungi" per inserire un veicolo.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {vehicles.map((vehicle, index) => (
                            <div key={vehicle.id} className="border border-gray-600 bg-gray-800/50 rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">Veicolo {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeVehicleAt(index)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-900/50 h-8 w-8 p-0"
                                  disabled={vehicles.length === 1}
                                  title={vehicles.length === 1 ? "Non puoi rimuovere l'ultimo veicolo" : "Rimuovi veicolo"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-gray-300 block mb-1">
                                    Targa
                                    <span className="text-red-400 ml-1">*</span>
                                  </label>
                                  <Input
                                    placeholder="Targa obbligatoria"
                                    value={vehicle.plate}
                                    onChange={(e) => updateVehicle(index, 'plate', e.target.value.toUpperCase())}
                                    className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-300 block mb-1">
                                    Codice VIN
                                    <span className="text-red-400 ml-1">*</span>
                                  </label>
                                  <Input
                                    placeholder="Codice VIN obbligatorio"
                                    value={vehicle.vin}
                                    onChange={(e) => updateVehicle(index, 'vin', e.target.value)}
                                    className="h-9 text-xs bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                                    required
                                  />
                                </div>

                                {/* Sezione Foto Libretto */}
                                <div className="space-y-2">
                                  <label className="text-xs font-medium flex items-center gap-1 text-gray-300">
                                    <FileImage className="h-3 w-3" />
                                    Foto Libretto ({(vehicle.registrationPhotos || []).length}/1)
                                  </label>
                                  
                                  {/* Mostra pulsanti di caricamento SOLO se non c'è una foto */}
                                  {(!vehicle.registrationPhotos || vehicle.registrationPhotos.length === 0) && (
                                    <div className="flex gap-2">
                                      <label className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium cursor-pointer transition-colors">
                                        <Upload size={12} />
                                        <span>Galleria</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => handleFileUpload(index, e.target.files)}
                                          className="hidden"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleCameraCapture(index)}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors"
                                      >
                                        <Camera size={12} />
                                        <span>Scatta</span>
                                      </button>
                                    </div>
                                  )}
                                  
                                  {/* Griglia foto - Solo 1 foto */}
                                  {vehicle.registrationPhotos && vehicle.registrationPhotos.length > 0 && (
                                    <div className="mt-2">
                                      <div className="relative group border border-gray-600 rounded overflow-hidden bg-gray-700 w-full max-w-32">
                                        <div className="aspect-square">
                                          <img 
                                            src={typeof vehicle.registrationPhotos[0] === 'string' ? vehicle.registrationPhotos[0] : URL.createObjectURL(vehicle.registrationPhotos[0] as any)}
                                            alt="Libretto"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => viewPhoto(typeof vehicle.registrationPhotos?.[0] === 'string' ? vehicle.registrationPhotos[0] : URL.createObjectURL(vehicle.registrationPhotos?.[0] as any))}
                                              className="bg-blue-500/90 hover:bg-blue-500 text-white p-1 rounded-full transition-colors"
                                              title="Visualizza foto"
                                              type="button"
                                            >
                                              <Eye size={12} />
                                            </button>
                                            <button
                                              onClick={() => removePhoto(index, 0)}
                                              className="bg-red-500/90 hover:bg-red-500 text-white p-1 rounded-full transition-colors"
                                              title="Rimuovi foto"
                                              type="button"
                                            >
                                              <X size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Pulsanti per sostituire la foto */}
                                      <div className="flex gap-2 mt-2">
                                        <label className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium cursor-pointer transition-colors">
                                          <Upload size={12} />
                                          <span>Sostituisci</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(index, e.target.files)}
                                            className="hidden"
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => handleCameraCapture(index)}
                                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors"
                                        >
                                          <Camera size={12} />
                                          <span>Riscatta</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLONNA 4: STORICO CLIENTI */}
                  <div className="flex flex-col space-y-4">
                    {/* Header sezione con altezza fissa identica */}
                    <div className="flex items-center gap-2 h-12 border-b border-gray-600">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <h3 className="font-medium text-white">Storico Cliente</h3>
                    </div>
                    
                    {/* Contenuto storico con altezza minima */}
                    <div className="min-h-[500px]">
                      {!client ? (
                        <div className="text-center py-8 text-gray-400">
                          <Clock className="h-8 w-8 mx-auto mb-3 text-gray-500" />
                          <p className="text-sm">Salva il cliente per vedere</p>
                          <p className="text-sm">il suo storico.</p>
                        </div>
                      ) : isLoadingData ? (
                        <div className="text-center py-8">
                          <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin text-gray-400" />
                          <p className="text-sm text-gray-400">Caricamento storico...</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {/* Ultimo Appuntamento */}
                          <div className="bg-slate-800 text-white rounded-lg p-3 border border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-blue-400" />
                                <span className="text-xs font-semibold text-blue-400">ULTIMO APPUNTAMENTO</span>
                              </div>
                              {lastAppointment && getStatusBadge(lastAppointment.status)}
                            </div>
                            {lastAppointment ? (
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-3">
                                  <span className="text-blue-300">#{lastAppointment.id}</span>
                                  <span className="text-gray-300">{formatDate(lastAppointment.date)} • {lastAppointment.time}</span>
                                  <span className="text-orange-300">{lastAppointment.plate}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Nessun appuntamento registrato</p>
                            )}
                          </div>

                          {/* Ultimo Preventivo */}
                          <div className="bg-emerald-800 text-white rounded-lg p-3 border border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-emerald-400" />
                                <span className="text-xs font-semibold text-emerald-400">ULTIMO PREVENTIVO</span>
                              </div>
                              {lastQuote && getStatusBadge(lastQuote.status)}
                            </div>
                            {lastQuote ? (
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-3">
                                  <span className="text-emerald-300">#{lastQuote.id}</span>
                                  <span className="text-gray-300">{formatDate(lastQuote.date)}</span>
                                  <span className="text-orange-300">{lastQuote.plate}</span>
                                </div>
                                <span className="text-emerald-200 font-semibold">
                                  €{(lastQuote.totalPrice || lastQuote.total || 0).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">Nessun preventivo registrato</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pulsanti seconda maschera */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-600">
                  {!client && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={backToTipoCliente}
                      className="text-gray-300 hover:text-orange-400 hover:bg-gray-700"
                    >
                      ← Indietro
                    </Button>
                  )}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    Annulla
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6"
                  >
                    {isSubmitting 
                      ? "Salvataggio..." 
                      : client ? "Aggiorna" : "Salva Cliente"}
                  </Button>
                </div>
              </div>
            )}
            
          </form>
        </Form>
        
        {/* Modal per visualizzare la foto */}
        {viewingPhoto && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9998]"
            onClick={closePhotoViewer}
            role="dialog"
            aria-modal="true"
            aria-label="Visualizzazione foto libretto"
          >
            <div className="relative max-w-4xl max-h-4xl w-full h-full flex items-center justify-center p-4">
              <img 
                src={viewingPhoto}
                alt="Foto libretto ingrandita"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={closePhotoViewer}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white text-black p-2 rounded-full transition-colors"
                title="Chiudi"
                aria-label="Chiudi visualizzazione foto"
                autoFocus
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
