import React, { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Car, User, MapPin, X, CheckCircle, Loader2, FileText, Calendar as CalendarIcon, Phone, Mail, AlertCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RequestQuotePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  // Dati veicolo
  targa: string;
  modello: string;
  chilometraggio: string;
  
  // Dati personali
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  dataNascita: Date | null;
  dataNascitaManuale: string;
  
  // Località e note
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  note: string;
  
  // Configurazione
  tipoRichiesta: string;
  sedeRiferimento: string;
  coupon: string;
}

export default function RequestQuotePopup({ isOpen, onClose }: RequestQuotePopupProps): React.JSX.Element {
  const { toast } = useToast();
  const [showTypeSelection, setShowTypeSelection] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [captchaValue, setCaptchaValue] = useState("");
  const [captchaChallenge, setCaptchaChallenge] = useState({ num1: 0, num2: 0 });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoadingVehicleData, setIsLoadingVehicleData] = useState(false);
  const [mapUrl, setMapUrl] = useState<string>('');
  const targaTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Stato del form
  const [formData, setFormData] = useState<FormData>({
    targa: "",
    modello: "",
    chilometraggio: "",
    nome: "",
    cognome: "",
    telefono: "",
    email: "",
    dataNascita: null,
    dataNascitaManuale: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    note: "",
    tipoRichiesta: "preventivo",
    sedeRiferimento: "monopoli",
    coupon: ""
  });

  // Genera captcha
  const generateCaptchaChallenge = () => {
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    setCaptchaChallenge({ num1, num2 });
    setCaptchaValue("");
  };

  useEffect(() => {
    generateCaptchaChallenge();
  }, []);

  // Cleanup timeout quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (targaTimeoutRef.current) {
        clearTimeout(targaTimeoutRef.current);
      }
    };
  }, []);

  // Reset quando si chiude il popup
  useEffect(() => {
    if (!isOpen) {
      setShowTypeSelection(true);
      setCurrentStep(1);
      setIsSubmitted(false);
      setPrivacyChecked(false);
      setValidationErrors({});
      setFormData({
        targa: "", modello: "", chilometraggio: "",
        nome: "", cognome: "", telefono: "", email: "", dataNascita: null, dataNascitaManuale: "",
        indirizzo: "", citta: "", cap: "", provincia: "", note: "",
        tipoRichiesta: "preventivo", sedeRiferimento: "monopoli",
        coupon: ""
      });
      generateCaptchaChallenge();
    }
  }, [isOpen]);

  // Funzione per recuperare i dati del veicolo dalla targa
  const fetchVehicleData = async (plate: string) => {
    if (!plate || plate.length !== 7) return;

    setIsLoadingVehicleData(true);
    try {
      // Chiamata al nostro endpoint backend nascosto
      const response = await fetch(`/.netlify/functions/vehicle-lookup?plate=${plate}`);
      const data = await response.json();
      
      if (data.success && data.vehicleDetails?.data?.getVehicleByVehicleNumber) {
        const vehicle = data.vehicleDetails.data.getVehicleByVehicleNumber;
        const make = vehicle.make?.name || '';
        const model = vehicle.model?.descriptions?.[0]?.value || '';
        const engineName = vehicle.names?.[0]?.value || '';
        
        // Componiamo il modello completo
        let fullModel = '';
        if (make && model) {
          fullModel = `${make} ${model}`;
          if (engineName && engineName !== model) {
            fullModel += ` - ${engineName}`;
          }
        }

        if (fullModel) {
          setFormData(prev => ({ ...prev, modello: fullModel }));
          
          // Rimuoviamo eventuali errori di validazione per targa e modello
          const errors = { ...validationErrors };
          delete errors.modello;
          delete errors.targa; // Rimuovi anche l'errore della targa se l'API ha successo
          setValidationErrors(errors);

        }
      } else {
        toast({
          title: "ℹ️ Veicolo non trovato",
          description: "Inserisci manualmente marca e modello del veicolo",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Errore nel recupero dati veicolo:', error);
      toast({
        title: "⚠️ Errore di connessione",
        description: "Impossibile recuperare i dati automaticamente. Inserisci manualmente i dati del veicolo.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsLoadingVehicleData(false);
    }
  };

  // Validazione in tempo reale
  const validateField = (field: keyof FormData, value: string) => {
    const errors = { ...validationErrors };
    
    switch (field) {
      case 'email':
        if (value && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          errors[field] = "Inserisci un'email valida";
        } else {
          delete errors[field];
        }
        break;
      case 'telefono':
        if (value && !value.match(/^[\d\s\-\+\(\)]{10,}$/)) {
          errors[field] = "Inserisci un numero di telefono valido";
        } else {
          delete errors[field];
        }
        break;
      case 'targa':
        if (value && value.length === 7 && !value.match(/^[A-Z]{2}[\d]{3}[A-Z]{2}$/)) {
          errors[field] = "Formato targa: AB123CD (7 caratteri)";
        } else {
          delete errors[field];
        }
        break;
      case 'cap':
        if (value && !value.match(/^\d{5}$/)) {
          errors[field] = "CAP deve essere di 5 cifre";
        } else {
          delete errors[field];
        }
        break;
      default:
        if (value.trim() === '' && ['nome', 'cognome', 'email', 'telefono', 'targa', 'modello'].includes(field)) {
          errors[field] = "Questo campo è obbligatorio";
        } else {
          delete errors[field];
        }
    }
    
    setValidationErrors(errors);
  };

  const handleInputChange = (field: keyof FormData, value: string | Date | null) => {
    const finalValue = field === 'targa' && typeof value === 'string' ? value.toUpperCase() : value;
    setFormData(prev => ({ ...prev, [field]: finalValue }));
    
    // Validazione in tempo reale
    if (typeof finalValue === 'string') {
      validateField(field, finalValue);
    }

    // Auto-fetch dei dati veicolo quando viene inserita una targa valida
    if (field === 'targa' && typeof finalValue === 'string' && finalValue.length === 7) {
      // Debounce per evitare chiamate eccessive
      if (targaTimeoutRef.current) {
        clearTimeout(targaTimeoutRef.current);
      }
      targaTimeoutRef.current = setTimeout(() => {
        fetchVehicleData(finalValue);
      }, 800);
    }
  };

  const handleTypeSelection = (type: string) => {
    setFormData(prev => ({ ...prev, tipoRichiesta: type }));
    setShowTypeSelection(false);
    setCurrentStep(1);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ 
        ...prev, 
        dataNascita: date,
        dataNascitaManuale: format(date, "dd/MM/yyyy")
      }));
    }
  };

  const handleDateManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    const numerics = inputValue.replace(/[^\d]/g, '');
    
    let formatted = '';
    if (numerics.length > 0) {
      formatted = numerics.substring(0, 2);
      if (numerics.length > 2) {
        formatted += '/' + numerics.substring(2, 4);
      }
      if (numerics.length > 4) {
        formatted += '/' + numerics.substring(4, 8);
      }
    }
    
    setFormData(prev => ({ ...prev, dataNascitaManuale: formatted }));
    
    // Auto-parse se formato valido
    if (formatted.length === 10) {
      const parts = formatted.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= new Date().getFullYear()) {
          const parsedDate = new Date(year, month, day);
          setFormData(prev => ({ ...prev, dataNascita: parsedDate }));
        }
      }
    }
  };

  // Validazioni
  const isStep1Valid = () => {
    return formData.targa.trim() !== "" && 
           formData.modello.trim() !== "" &&
           !validationErrors.targa;
  };

  const isStep2Valid = () => {
    return formData.nome.trim() !== "" && 
           formData.cognome.trim() !== "" && 
           formData.telefono.trim() !== "" && 
           formData.email.trim() !== "" &&
           !validationErrors.nome &&
           !validationErrors.cognome &&
           !validationErrors.telefono &&
           !validationErrors.email;
  };

  const isStep3Valid = () => {
    return privacyChecked && 
           parseInt(captchaValue) === (captchaChallenge.num1 + captchaChallenge.num2);
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1: return isStep1Valid();
      case 2: return isStep2Valid();
      case 3: return isStep3Valid();
      default: return false;
    }
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!isStep3Valid()) return;

    setIsSubmitting(true);
    
    try {
      const netlifyFormData = new FormData();
      netlifyFormData.append('form-name', formData.tipoRichiesta === "checkup" ? "richiesta-checkup" : "richiesta-preventivo");
      netlifyFormData.append('nome', formData.nome);
      netlifyFormData.append('cognome', formData.cognome);
      netlifyFormData.append('email', formData.email);
      netlifyFormData.append('telefono', formData.telefono);
      netlifyFormData.append('targa', formData.targa);
      netlifyFormData.append('data-nascita', formData.dataNascita ? format(formData.dataNascita, 'dd/MM/yyyy') : formData.dataNascitaManuale);
      
      const noteComplete = `Modello: ${formData.modello}${formData.chilometraggio ? `, Km: ${formData.chilometraggio}` : ''}. Indirizzo: ${formData.indirizzo}, ${formData.cap} ${formData.citta} (${formData.provincia}).${formData.note ? ` Note aggiuntive: ${formData.note}` : ''}`;
      netlifyFormData.append('note', noteComplete);
      
      netlifyFormData.append('coupon', '');
      netlifyFormData.append('tipo-richiesta', formData.tipoRichiesta);
      netlifyFormData.append('sede-riferimento', formData.sedeRiferimento);
      netlifyFormData.append('captcha-challenge', `${captchaChallenge.num1} + ${captchaChallenge.num2}`);
      netlifyFormData.append('captcha-result', captchaValue);
      netlifyFormData.append('privacy-policy', privacyChecked ? "accettata" : "non-accettata");
      
      if (formData.tipoRichiesta === "checkup") {
        netlifyFormData.append('data-appuntamento', '');
        netlifyFormData.append('ora-appuntamento', '');
        netlifyFormData.append('preferenza-orario', 'mattina');
      }
      
      const response = await fetch('/.netlify/functions/form-handler', {
        method: 'POST',
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(netlifyFormData as any).toString()
      });

      if (response.ok) {
        setIsSubmitted(true);
        
        toast({
          title: "🎉 Richiesta inviata!",
          description: "Perfetto! Ti contatteremo entro 24 ore per fornirti tutte le informazioni.",
          duration: 5000,
        });

        setTimeout(() => {
          onClose();
          setFormData({
            targa: "", modello: "", chilometraggio: "",
            nome: "", cognome: "", telefono: "", email: "", dataNascita: null, dataNascitaManuale: "",
            indirizzo: "", citta: "", cap: "", provincia: "", note: "",
            tipoRichiesta: "preventivo", sedeRiferimento: "monopoli",
            coupon: ""
          });
          setCurrentStep(1);
          setIsSubmitted(false);
          setPrivacyChecked(false);
          setShowTypeSelection(true);
          setValidationErrors({});
          generateCaptchaChallenge();
        }, 3000);
        
      } else {
        throw new Error('Errore nell\'invio del form');
      }
    } catch (error) {
      toast({
        title: "Ops! Qualcosa è andato storto",
        description: "Non riusciamo a inviare la richiesta. Riprova tra qualche istante o chiamaci direttamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Funzione per recuperare l'URL della mappa dal backend
  const fetchMapUrl = async () => {
    try {
      const response = await fetch('/.netlify/functions/maps-api');
      const data = await response.json();
      
      if (data.success && data.mapUrl) {
        setMapUrl(data.mapUrl);
      }
    } catch (error) {
      console.error('Errore nel caricamento mappa:', error);
      // Fallback: usa un'immagine placeholder se l'API fallisce
      setMapUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDYwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMzc0MTUxIi8+Cjx0ZXh0IHg9IjMwMCIgeT0iMzAwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiPk1hcHBhIE5vbiBEaXNwb25pYmlsZTwvdGV4dD4KPC9zdmc+');
    }
  };

  // Carica la mappa quando il componente viene montato
  useEffect(() => {
    fetchMapUrl();
  }, []);

  // Schermata di selezione tipo richiesta - TEMA NERO/ARANCIONE
  const renderTypeSelection = () => (
    <div className="relative min-h-[600px] bg-gradient-to-br from-gray-900 to-black">
      <div className="p-12 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Ciao! Cosa desideri?</h1>
          <br></br> 
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTypeSelection('preventivo')}
            className="group p-8 bg-gray-800 rounded-3xl shadow-2xl hover:shadow-orange-500/20 transition-all duration-300 border-2 border-gray-700 hover:border-orange-500"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Preventivo Gratuito</h3>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Ricevi un preventivo dettagliato e personalizzato per il tuo veicolo, senza alcun impegno
            </p>
            <div className="flex items-center justify-center gap-2 text-orange-500 font-semibold">
              <span>Inizia ora</span>
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                →
              </motion.div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTypeSelection('checkup')}
            className="group p-8 bg-gray-800 rounded-3xl shadow-2xl hover:shadow-orange-500/20 transition-all duration-300 border-2 border-gray-700 hover:border-orange-500"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Car className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Checkup Completo</h3>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Prenota un controllo professionale per verificare le condizioni del tuo veicolo
            </p>
            <div className="flex items-center justify-center gap-2 text-orange-500 font-semibold">
              <span>Prenota ora</span>
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                →
              </motion.div>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );

  // Form step - TEMA NERO/ARANCIONE RIPRISTINATO
  const renderFormStep = (): React.JSX.Element => {
    const stepTitles = [
      "Il tuo veicolo",
      "I tuoi dati", 
      "Conferma e invia"
    ];
    
    const stepDescriptions = [
      "Inserisci la targa o i dettagli del veicolo",
      "Inserisci i tuoi dati",
      "Conferma e invia"
    ];

    return (
      <div className="min-h-[700px] bg-gray-900">
        {/* Header migliorato con tema scuro */}
        <div className="relative p-6 bg-gray-800 border-b border-gray-700">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-r from-orange-500 to-orange-600`}>
                {formData.tipoRichiesta === 'checkup' ? 
                  <Car className="w-6 h-6 text-white" /> : 
                  <FileText className="w-6 h-6 text-white" />
                }
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {formData.tipoRichiesta === 'checkup' ? 'Checkup Veicolo' : 'Preventivo Gratuito'}
                </h1>
                <p className="text-gray-300">{stepDescriptions[currentStep - 1]}</p>
              </div>
            </div>

            {/* Progress bar migliorata con tema arancione */}
            <div className="flex items-center justify-between max-w-md mx-auto">
              {[1, 2, 3].map((step) => {
                const isActive = currentStep === step;
                const isCompleted = currentStep > step;
                
                return (
                  <div key={step} className="flex items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${isActive ? 'bg-orange-500 text-white shadow-lg scale-110' : 
                        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}
                    `}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-20 h-1 mx-3 rounded ${currentStep > step ? 'bg-green-500' : 'bg-gray-600'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contenuto step con tema scuro */}
        <div className="p-8">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Step 1: VEICOLO */}
                {currentStep === 1 && (
                  <div className="space-y-8">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold text-orange-500 mb-2">{stepTitles[0]}</h2>
                    </div>

                    <div className="bg-gray-800 rounded-2xl p-8 shadow-lg space-y-6 border border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            Targa *
                            {isLoadingVehicleData && <Loader2 className="w-4 h-4 animate-spin text-orange-400" />}
                          </label>
                          <Input
                            placeholder="es. AB123CD"
                            value={formData.targa}
                            onChange={(e) => handleInputChange('targa', e.target.value)}
                            className={`h-14 text-center text-xl tracking-widest font-mono border-2 bg-gray-700 text-white ${
                              validationErrors.targa ? 'border-red-500 bg-red-900/20' : 'border-gray-600 focus:border-orange-500'
                            } ${isLoadingVehicleData ? 'animate-pulse' : ''}`}
                            maxLength={7}
                            disabled={isLoadingVehicleData}
                          />
                          {validationErrors.targa && (
                            <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {validationErrors.targa}
                            </p>
                          )}
                          {isLoadingVehicleData && (
                            <p className="text-orange-400 text-sm mt-2 flex items-center gap-1">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Ricerca dati veicolo in corso...
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            Modello *
                          </label>
                          <Input
                            placeholder="es. Fiat Panda, BMW Serie 3"
                            value={formData.modello}
                            onChange={(e) => handleInputChange('modello', e.target.value)}
                            className="h-14 border-2 bg-gray-700 text-white border-gray-600 focus:border-orange-500"
                          />
                          {validationErrors.modello && (
                            <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {validationErrors.modello}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="max-w-md mx-auto">
                        <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                          Chilometraggi
                        </label>
                        <Input
                          placeholder="es. 50000"
                          value={formData.chilometraggio}
                          onChange={(e) => handleInputChange('chilometraggio', e.target.value)}
                          className="h-14 border-2 bg-gray-700 text-white border-gray-600 focus:border-orange-500"
                          type="number"
                        />
                        <p className="text-gray-400 text-sm mt-2"><u>Ci aiuta a fornirti un preventivo più preciso</u></p>
                      </div>

                      <Alert className="bg-orange-900/20 border-orange-600/50">
                        <Info className="h-4 w-4 text-orange-400" />
                        <AlertDescription className="text-orange-200">
                          <strong>Funzione intelligente:</strong> Inserisci la targa e recupereremo automaticamente i dati del veicolo. 
                          Se non dovesse funzionare, puoi compilare manualmente.
                        </AlertDescription>
                      </Alert>
                    </div>

                    <Button
                      onClick={handleNext}
                      disabled={!isStep1Valid()}
                      className="w-full h-16 text-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continua
                    </Button>
                  </div>
                )}

                {/* Step 2: DATI PERSONALI */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold text-white mb-2">{stepTitles[1]}</h2>
                      <p className="text-gray-300 text-lg">Solo le informazioni essenziali per contattarti</p>
                    </div>

                    <div className="bg-gray-800 rounded-2xl p-8 shadow-lg space-y-6 border border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            Nome *
                          </label>
                          <Input
                            placeholder="Mario"
                            value={formData.nome}
                            onChange={(e) => handleInputChange('nome', e.target.value)}
                            className={`h-14 border-2 bg-gray-700 text-white ${
                              validationErrors.nome ? 'border-red-500 bg-red-900/20' : 'border-gray-600 focus:border-orange-500'
                            }`}
                          />
                          {validationErrors.nome && (
                            <p className="text-red-400 text-sm mt-2">{validationErrors.nome}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            Cognome *
                          </label>
                          <Input
                            placeholder="Rossi"
                            value={formData.cognome}
                            onChange={(e) => handleInputChange('cognome', e.target.value)}
                            className={`h-14 border-2 bg-gray-700 text-white ${
                              validationErrors.cognome ? 'border-red-500 bg-red-900/20' : 'border-gray-600 focus:border-orange-500'
                            }`}
                          />
                          {validationErrors.cognome && (
                            <p className="text-red-400 text-sm mt-2">{validationErrors.cognome}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            Telefono *
                          </label>
                          <Input
                            placeholder="320 123 4567"
                            value={formData.telefono}
                            onChange={(e) => handleInputChange('telefono', e.target.value)}
                            className={`h-14 border-2 bg-gray-700 text-white ${
                              validationErrors.telefono ? 'border-red-500 bg-red-900/20' : 'border-gray-600 focus:border-orange-500'
                            }`}
                            type="tel"
                          />
                          {validationErrors.telefono && (
                            <p className="text-red-400 text-sm mt-2">{validationErrors.telefono}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                            Email *
                          </label>
                          <Input
                            placeholder="mario.rossi@email.com"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={`h-14 border-2 bg-gray-700 text-white ${
                              validationErrors.email ? 'border-red-500 bg-red-900/20' : 'border-gray-600 focus:border-orange-500'
                            }`}
                            type="email"
                          />
                          {validationErrors.email && (
                            <p className="text-red-400 text-sm mt-2">{validationErrors.email}</p>
                          )}
                        </div>
                      </div>


                      <Textarea
                        placeholder="Hai qualche richiesta particolare? Descrivici il problema o cosa ti serve... (opzionale)"
                        value={formData.note}
                        onChange={(e) => handleInputChange('note', e.target.value)}
                        className="min-h-[100px] border-2 bg-gray-700 text-white border-gray-600 focus:border-orange-500"
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button
                        onClick={() => setCurrentStep(1)}
                        variant="outline"
                        className="flex-1 h-16 text-lg border-2 border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
                      >
                        ← Indietro
                      </Button>
                      <Button
                        onClick={handleNext}
                        disabled={!isStep2Valid()}
                        className="flex-1 h-16 text-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg disabled:opacity-50"
                      >
                        Quasi fatto →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: CONFERMA */}
                {currentStep === 3 && (
                  <div className="h-full">
                    {/* Layout responsive per step 3 */}
                    <div className="absolute inset-0 bg-gray-800 rounded-xl overflow-hidden">
                      <div className="h-full flex flex-col lg:flex-row">
                        
                        {/* Colonna principale - Riepilogo e conferma */}
                        <div className="flex-1 lg:w-1/2 p-4 lg:p-6 overflow-y-auto scrollbar-hide">
                          <div className="mb-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-orange-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                              </div>
                              <div>
                                <h2 className="text-xl lg:text-2xl font-bold text-white">CONFERMA RICHIESTA</h2>
                                <p className="text-sm lg:text-base text-gray-300">Controlla i dati e conferma l'invio</p>
                              </div>
                            </div>
                          </div>

                          {/* Riepilogo */}
                          <div className="bg-gray-700 rounded-xl p-4 lg:p-6 mb-4 lg:mb-6">
                            <div className="space-y-3 lg:space-y-4">
                              <div className="bg-orange-900/30 rounded-lg p-3 lg:p-4">
                                <h4 className="font-semibold text-orange-400 mb-2 text-sm lg:text-base">Veicolo</h4>
                                <p className="text-orange-200 text-sm lg:text-base">{formData.targa || 'Targa non specificata'} {formData.modello || 'Modello non specificato'} {formData.chilometraggio ? `- ${formData.chilometraggio} km` : ''}</p>
                              </div>
                              
                              <div className="bg-gray-600/50 rounded-lg p-3 lg:p-4">
                                <h4 className="font-semibold text-gray-200 mb-2 text-sm lg:text-base">Contatto</h4>
                                <p className="text-gray-300 text-sm lg:text-base">{formData.nome} {formData.cognome}</p>
                                <p className="text-gray-300 text-sm lg:text-base">{formData.telefono}</p>
                                <p className="text-gray-300 text-sm lg:text-base">{formData.email}</p>
                              </div>
                            </div>
                          </div>

                          {/* Coupon */}
                          <div className="mb-4 lg:mb-6">
                            <label className="block text-sm font-semibold text-gray-200 mb-2 lg:mb-3">
                              Coupon (opzionale)
                            </label>
                            <Input
                              value={formData.coupon}
                              onChange={(e) => handleInputChange('coupon', e.target.value)}
                              className={`h-12 lg:h-14 border-2 bg-gray-700 text-white ${
                                validationErrors.coupon ? 'border-red-500 bg-red-900/20' : 'border-gray-600 focus:border-orange-500'
                              }`}
                              placeholder="Inserisci codice coupon"
                            />
                            {validationErrors.coupon && (
                              <p className="text-red-400 text-sm mt-2">{validationErrors.coupon}</p>
                            )}
                          </div>

                          {/* Captcha */}
                          <div className="bg-yellow-900/30 rounded-lg p-3 lg:p-4 mb-4 lg:mb-6">
                            <h4 className="font-semibold text-yellow-400 mb-2 lg:mb-3 text-sm lg:text-base">
                              Verifica di sicurezza
                            </h4>
                            <div className="flex items-center gap-3 lg:gap-4">
                              <span className="text-lg lg:text-xl font-bold text-yellow-300">
                                {captchaChallenge.num1} + {captchaChallenge.num2} =
                              </span>
                              <Input
                                placeholder="?"
                                value={captchaValue}
                                onChange={(e) => setCaptchaValue(e.target.value)}
                                className="w-14 lg:w-16 h-8 lg:h-10 text-center text-base lg:text-lg font-bold border-2 border-yellow-600 bg-gray-700 text-white"
                                type="number"
                              />
                            </div>
                          </div>

                          {/* Privacy policy */}
                          <div className="flex items-start gap-3 p-3 lg:p-4 bg-gray-600/50 rounded-lg mb-4 lg:mb-6">
                            <Checkbox 
                              checked={privacyChecked}
                              onCheckedChange={(checked) => setPrivacyChecked(checked === true)}
                              className="mt-1 flex-shrink-0"
                            />
                            <div>
                              <p className="text-gray-300 text-xs lg:text-sm leading-relaxed">
                                Accetto che i miei dati vengano utilizzati per contattarmi riguardo questa richiesta 
                                e per inviarmi informazioni sui servizi AutoExpress. 
                                <a href="https://www.race-tech.it/privacy-policy/" className="text-orange-400 hover:underline ml-1">
                                  Leggi l'informativa privacy
                                </a>
                              </p>
                            </div>
                          </div>

                          {/* Pulsanti di navigazione */}
                          <div className="flex gap-3 lg:gap-4 pt-3 lg:pt-4 border-t border-gray-600">
                            <Button
                              onClick={() => setCurrentStep(2)}
                              variant="outline"
                              className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-12 lg:h-16 text-sm lg:text-lg"
                            >
                              Indietro
                            </Button>
                            <Button
                              onClick={handleSubmit}
                              disabled={!isStep3Valid() || isSubmitting}
                              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold h-12 lg:h-16 rounded-xl disabled:opacity-50 text-sm lg:text-lg"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 mr-2 animate-spin" />
                                  Invio...
                                </>
                              ) : (
                                'Invia richiesta'
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Colonna mappa - Solo su desktop */}
                        <div className="hidden lg:block lg:w-1/2 relative bg-blue-100">
                          <div 
                            className="absolute inset-0 w-full h-full bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${mapUrl})`
                            }}
                          >
                            {/* Overlay informazioni */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent">
                              
                              {/* Info sede sulla mappa */}
                              <div className="absolute bottom-6 left-6 bg-blue-900/95 backdrop-blur-sm rounded-lg p-4 shadow-xl max-w-xs">
                                <div className="flex items-start gap-3">
                                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mt-1">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-white text-sm">AUTOEXPRESS MONOPOLI</h4>
                                    <p className="text-xs text-orange-600">Via Eugenio Montale, 4</p>
                                    <p className="text-xs text-orange-600 mt-1">3293888702</p>
                                  </div>
                                </div>
                              </div>
                              {/* Copyright */}
                              <div className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded">
                                © Google Maps
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Info sede mobile - Solo su mobile */}
                        <div className="lg:hidden bg-gray-700 p-4 border-t border-gray-600">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                              <div className="w-4 h-4 bg-white rounded-full"></div>
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">AUTOEXPRESS MONOPOLI</h4>
                              <p className="text-xs text-orange-400">Via Eugenio Montale, 4 - Tel: 3293888702</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };
  if (isSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 p-0 overflow-hidden">
          <div className="text-center py-12 px-8 bg-gradient-to-br from-gray-900 to-black">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="w-20 h-20 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="text-3xl font-bold text-white mb-4">🎉 Perfetto!</h3>
            <p className="text-xl text-gray-300 mb-6">
              La tua richiesta è stata inviata con successo
            </p>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-white">Cosa succede ora?</strong><br/>
                📞 Ti chiameremo entro 24 ore<br/>
                ✉️ Riceverai un'email di conferma<br/>
                🔧 I nostri esperti prepareranno la tua richiesta
              </p>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              Questa finestra si chiuderà automaticamente tra qualche secondo
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[90vw] h-[90vh] p-0 overflow-hidden bg-gray-900 border-gray-700">
        {showTypeSelection ? renderTypeSelection() : renderFormStep()}

        {/* Form nascosti per Netlify */}
        <form ref={formRef} name="richiesta-preventivo" data-netlify="true" data-netlify-honeypot="bot-field" hidden>
          <input type="hidden" name="bot-field" />
          <input type="text" name="nome" />
          <input type="text" name="cognome" />
          <input type="email" name="email" />
          <input type="tel" name="telefono" />
          <input type="text" name="targa" />
          <input type="hidden" name="data-nascita" />
          <textarea name="note"></textarea>
          <input type="hidden" name="coupon" />
          <input type="hidden" name="tipo-richiesta" />
          <input type="hidden" name="sede-riferimento" />
          <input type="text" name="captcha-result" />
          <input type="hidden" name="captcha-challenge" />
          <input type="hidden" name="privacy-policy" />
          <input type="hidden" name="data-appuntamento" />
          <input type="hidden" name="ora-appuntamento" />
          <input type="hidden" name="preferenza-orario" />
        </form>
        
        <form name="richiesta-checkup" data-netlify="true" data-netlify-honeypot="bot-field" hidden>
          <input type="hidden" name="bot-field" />
          <input type="text" name="nome" />
          <input type="text" name="cognome" />
          <input type="email" name="email" />
          <input type="tel" name="telefono" />
          <input type="text" name="targa" />
          <input type="hidden" name="data-nascita" />
          <textarea name="note"></textarea>
          <input type="hidden" name="coupon" />
          <input type="hidden" name="tipo-richiesta" />
          <input type="hidden" name="sede-riferimento" />
          <input type="text" name="captcha-result" />
          <input type="hidden" name="captcha-challenge" />
          <input type="hidden" name="privacy-policy" />
          <input type="hidden" name="data-appuntamento" />
          <input type="hidden" name="ora-appuntamento" />
          <input type="hidden" name="preferenza-orario" />
        </form>
      </DialogContent>
    </Dialog>
  );
} 