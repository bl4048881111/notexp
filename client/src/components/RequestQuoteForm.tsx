import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Car, StickyNote, ShieldCheck, ArrowRight, Radio, FileText, Calendar, Clock, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addMinutes, isSameDay, isBefore, startOfDay, endOfDay, parseISO, isAfter } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Orari disponibili dalle 9:00 alle 18:00, intervalli di 30 minuti
const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

// Interfaccia per uno slot prenotato
interface BookedSlot {
  date: string;
  time: string;
}

// Definizione gruppi di preferenza oraria (per traduzione)
const TIME_PREFERENCES = {
  "mattina": "Mattina (9:00-13:00)",
  "pomeriggio": "Pomeriggio (14:00-18:00)"
};

export default function RequestQuoteForm() {
  const { toast } = useToast(); 
  const [form, setForm] = useState({
    nome: "",
    cognome: "",
    email: "",
    telefono: "",
    targa: "",
    dataNascita: null as Date | null,
    dataNascitaManuale: "", // Campo per l'inserimento manuale
    note: "",
    tipoRichiesta: "preventivo", // Default a preventivo
    dataAppuntamento: null as Date | null,
    oraAppuntamento: "",
    preferenzaOrario: "mattina" as "mattina" | "pomeriggio"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaValue, setCaptchaValue] = useState("");
  const [captchaChallenge, setCaptchaChallenge] = useState({ num1: 0, num2: 0 });
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Stato per gli slot disponibili
  const [availableSlots, setAvailableSlots] = useState<string[]>(TIME_SLOTS);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  // Carica gli appuntamenti prenotati dal server quando la data cambia
  useEffect(() => {
    if (!form.dataAppuntamento) return;
    
    const fetchAvailability = async () => {
      setIsLoadingSlots(true);
      try {
        // Chiamata API reale per recuperare gli slot già prenotati
        // Questa data è sicuramente una Date valida perché abbiamo già controllato form.dataAppuntamento all'inizio
        const selectedDate = form.dataAppuntamento as Date; // Type assertion sicura qui
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const response = await fetch(`/.netlify/functions/getBookedSlots?date=${formattedDate}`);
        
        if (!response.ok) {
          throw new Error(`Errore nella risposta: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.message || "Errore nel recupero delle disponibilità");
        }
        
        console.log("Slot prenotati ricevuti:", data.bookedSlots);
        setBookedSlots(data.bookedSlots);
        
        // Filtra gli slot disponibili
        const available = TIME_SLOTS.filter(slot => 
          !data.bookedSlots.some((bookedSlot: BookedSlot) => 
            bookedSlot.time === slot
          )
        );
        
        setAvailableSlots(available);
        
        // Se era selezionato un orario non più disponibile, resetta l'orario
        if (form.oraAppuntamento && !available.includes(form.oraAppuntamento)) {
          setForm(prev => ({ ...prev, oraAppuntamento: "" }));
        }
      } catch (error) {
        console.error("Errore nel caricamento delle disponibilità:", error);
        toast({ 
          title: "Errore", 
          description: "Impossibile caricare le disponibilità. Riprova più tardi.", 
          variant: "destructive" 
        });
      } finally {
        setIsLoadingSlots(false);
      }
    };
    
    fetchAvailability();
  }, [form.dataAppuntamento, toast]);

  // Genera una nuova sfida matematica semplice
  const generateCaptchaChallenge = () => {
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    setCaptchaChallenge({ num1, num2 });
    setCaptchaValue("");
  };

  // Genera la sfida al caricamento del componente
  useState(() => {
    generateCaptchaChallenge();
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleTipoRichiestaChange = (value: string) => {
    setForm({ ...form, tipoRichiesta: value });
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setForm(prev => ({ ...prev, dataAppuntamento: date, oraAppuntamento: "" }));
    }
  };
  
  const handleTimeSelect = (time: string) => {
    setForm(prev => ({ ...prev, oraAppuntamento: time }));
  };

  const handleCaptchaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCaptchaValue(e.target.value);
  };

  // Gestisce il cambio di preferenza oraria
  const handleTimePreferenceChange = (value: "mattina" | "pomeriggio") => {
    setForm(prev => ({ 
      ...prev, 
      preferenzaOrario: value
    }));
  };

  // Data di nascita
  const handleBirthDateSelect = (date: Date | undefined) => {
    if (date) {
      setForm(prev => ({ 
        ...prev, 
        dataNascita: date,
        dataNascitaManuale: format(date, "dd/MM/yyyy")
      }));
    }
  };
  
  // Gestione input manuale data di nascita
  const handleBirthDateManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Rimuovi tutti i caratteri non numerici
    const numerics = inputValue.replace(/[^\d]/g, '');
    
    // Formatta automaticamente inserendo gli slash
    let formatted = '';
    if (numerics.length > 0) {
      // Primi due caratteri (giorno)
      formatted = numerics.substring(0, 2);
      
      // Aggiungi slash e mese se ci sono abbastanza cifre
      if (numerics.length > 2) {
        formatted += '/' + numerics.substring(2, 4);
      }
      
      // Aggiungi slash e anno se ci sono abbastanza cifre
      if (numerics.length > 4) {
        formatted += '/' + numerics.substring(4, 8);
      }
    }
    
    // Aggiorna lo stato con il valore formattato
    setForm(prev => ({ ...prev, dataNascitaManuale: formatted }));
    
    // Tenta di convertire l'input in data valida
    if (formatted.length === 10) { // Formato completo gg/mm/yyyy
      const parts = formatted.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // I mesi in JavaScript sono 0-indexed
        const year = parseInt(parts[2], 10);
        
        const date = new Date(year, month, day);
        
        // Verifica se la data è valida e non è nel futuro
        if (!isNaN(date.getTime()) && date <= new Date()) {
          setForm(prev => ({ ...prev, dataNascita: date }));
        }
      }
    } else if (formatted.length < 10) {
      // Se la data non è completa, annulla la data selezionata
      setForm(prev => ({ ...prev, dataNascita: null }));
    }
  };

  const validateForm = () => {
    // Valida la soluzione del CAPTCHA
    const captchaResult = captchaChallenge.num1 + captchaChallenge.num2;
    const userResult = parseInt(captchaValue);
    
    if (isNaN(userResult) || userResult !== captchaResult) {
      toast({ 
        title: "Verifica fallita", 
        description: "La soluzione matematica inserita non è corretta. Riprova.", 
        variant: "destructive" 
      });
      generateCaptchaChallenge(); // Genera una nuova sfida
      return false;
    }
    
    // Verifica che data e ora siano selezionate per i checkup
    if (form.tipoRichiesta === "checkup") {
      // Data sempre richiesta
      if (!form.dataAppuntamento) {
        toast({ 
          title: "Data richiesta", 
          description: "Seleziona una data per il checkup.", 
          variant: "destructive" 
        });
        return false;
      }
    }

    // Verifica che il consenso privacy sia stato dato
    if (!privacyChecked) {
      setAttemptedSubmit(true);
      toast({ 
        title: "Consenso richiesto", 
        description: "Devi accettare la politica sulla privacy per continuare.", 
        variant: "destructive" 
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (!validateForm()) {
      e.preventDefault();
      return;
    }
    
    // Debug: mostra quale action viene usato
    const formAction = form.tipoRichiesta === "checkup" ? "/success-checkup" : "/success-preventivo";
    console.log("Form action:", formAction, "Tipo richiesta:", form.tipoRichiesta);
    
    // Se la validazione passa, lascia che Netlify gestisca l'invio del form
    // Il form verrà inviato automaticamente e l'utente verrà reindirizzato alla pagina di successo
  };

  const fieldAnim = {
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.2 }
  };
  
  // Disabilita i giorni passati e il weekend
  const disabledDays = {
    before: new Date(),
    daysOfWeek: [0]  // 0 è domenica
  };

  return (
    <motion.form
      ref={formRef}
      onSubmit={handleSubmit}
      name={form.tipoRichiesta === "checkup" ? "richiesta-checkup" : "richiesta-preventivo"}
      method="POST"
      action={form.tipoRichiesta === "checkup" ? "/success-checkup" : "/success-preventivo"}
      data-netlify="true"
      data-netlify-honeypot="bot-field"
      className="w-full max-w-3xl mx-auto bg-black border border-zinc-800 rounded-lg p-4 md:p-6 shadow-md"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      {/* Campo nascosto per Netlify Forms */}
      <input type="hidden" name="form-name" value={form.tipoRichiesta === "checkup" ? "richiesta-checkup" : "richiesta-preventivo"} />
      
      {/* Campo honeypot per prevenire spam */}
      <div style={{ display: 'none' }}>
        <label>
          Non compilare questo campo se sei umano: <input name="bot-field" />
        </label>
      </div>

      {/* Campi nascosti per dati complessi */}
      <input type="hidden" name="data-nascita" value={form.dataNascita ? format(form.dataNascita, 'dd/MM/yyyy') : ''} />
      <input type="hidden" name="data-appuntamento" value={form.dataAppuntamento ? format(form.dataAppuntamento, 'dd/MM/yyyy') : ''} />
      <input type="hidden" name="ora-appuntamento" value={form.oraAppuntamento} />
      <input type="hidden" name="preferenza-orario" value={form.preferenzaOrario} />

      {/* Tipo Richiesta */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-orange-500 mb-3 border-b border-zinc-800 pb-2">Cosa ti serve?</h2>
        <RadioGroup 
          value={form.tipoRichiesta} 
          onValueChange={handleTipoRichiestaChange}
          className="flex flex-col md:flex-row gap-3"
        >
          <div className={`flex-1 flex items-start p-4 rounded-lg border ${form.tipoRichiesta === "preventivo" ? "bg-orange-950/30 border-orange-500/50" : "bg-zinc-900 border-zinc-800"} transition-colors duration-200`}>
            <RadioGroupItem value="preventivo" id="preventivo" className="text-orange-500 mt-1" />
            <Label htmlFor="preventivo" className="flex flex-col ml-3 cursor-pointer">
              <span className="flex items-center text-base font-medium text-white">
                <FileText className="h-5 w-5 text-orange-500 mr-2" />
                Preventivo Gratuito
              </span>
              <span className="text-xs text-zinc-400 mt-1">
                Ricevi un preventivo dettagliato senza impegno per la tua auto
              </span>
            </Label>
          </div>
          
          <div className={`flex-1 flex items-start p-4 rounded-lg border ${form.tipoRichiesta === "checkup" ? "bg-orange-950/30 border-orange-500/50" : "bg-zinc-900 border-zinc-800"} transition-colors duration-200`}>
            <RadioGroupItem value="checkup" id="checkup" className="text-orange-500 mt-1" />
            <Label htmlFor="checkup" className="flex flex-col ml-3 cursor-pointer">
              <span className="flex items-center text-base font-medium text-white">
                <Car className="h-5 w-5 text-orange-500 mr-2" />
                Checkup Veicolo
              </span>
              <span className="text-xs text-zinc-400 mt-1">
                Prenota un controllo completo con i nostri tecnici specializzati
              </span>
            </Label>
          </div>
        </RadioGroup>
        {/* Campo nascosto per Netlify */}
        <input type="hidden" name="tipo-richiesta" value={form.tipoRichiesta} />
      </div>

      {/* Dati personali e veicolo */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-orange-500 mb-3 border-b border-zinc-800 pb-2">Dati personali</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col">
            <label htmlFor="nome" className="text-xs font-medium text-orange-500 mb-1 flex items-center">
              <User className="h-3 w-3 text-orange-500 mr-1" /> Nome
            </label>
            <Input id="nome" name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} required className="h-8 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="cognome" className="text-xs font-medium text-orange-500 mb-1 flex items-center">
              <User className="h-3 w-3 text-orange-500 mr-1" /> Cognome
            </label>
            <Input id="cognome" name="cognome" placeholder="Cognome" value={form.cognome} onChange={handleChange} required className="h-8 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="email" className="text-xs font-medium text-orange-500 mb-1 flex items-center">
              <Mail className="h-3 w-3 text-orange-500 mr-1" /> Email
            </label>
            <Input id="email" name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required className="h-8 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="telefono" className="text-xs font-medium text-orange-500 mb-1 flex items-center">
              <Phone className="h-3 w-3 text-orange-500 mr-1" /> Telefono
            </label>
            <Input id="telefono" name="telefono" placeholder="Telefono" value={form.telefono} onChange={handleChange} required className="h-8 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-orange-500 mb-1 flex items-center">
              <Calendar className="h-3 w-3 text-orange-500 mr-1" /> Data di nascita
            </label>
            <div className="flex gap-2 items-center">
              <Input
                name="data-nascita-manuale"
                placeholder="GG/MM/AAAA"
                value={form.dataNascitaManuale}
                onChange={handleBirthDateManualInput}
                className="h-8 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-orange-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 text-white">
                  <CalendarComponent
                    mode="single"
                    selected={form.dataNascita || undefined}
                    onSelect={handleBirthDateSelect}
                    disabled={{ after: new Date() }}
                    initialFocus
                    className="bg-zinc-900 text-white"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex flex-col">
            <label htmlFor="targa" className="text-xs font-medium text-orange-500 mb-1 flex items-center">
              <Car className="h-3 w-3 text-orange-500 mr-1" /> Targa
            </label>
            <Input id="targa" name="targa" placeholder="Targa" maxLength={7} value={form.targa} onChange={handleChange} required className="h-8 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500 uppercase" />
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col">
          <label htmlFor="note" className="text-xs font-medium text-orange-500 mb-1 flex items-center">
            <StickyNote className="h-3 w-3 text-orange-500 mr-1" /> Note
          </label>
          <Textarea 
            id="note" 
            name="note" 
            placeholder="Dettagli o richieste specifiche (opzionale)" 
            value={form.note} 
            onChange={handleChange} 
            className="h-20 text-sm bg-zinc-900 border-zinc-800 focus:border-orange-500 text-white placeholder-zinc-500" 
          />
        </div>
      </div>
        
      {/* Sezione appuntamento per checkup */}
      {form.tipoRichiesta === "checkup" && (
        <div className="mb-6 p-4 border border-zinc-800 rounded-lg bg-zinc-900/50">
          <h2 className="text-lg font-medium text-orange-500 mb-3 border-b border-zinc-800 pb-2">Dettagli appuntamento</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-orange-500 mb-1 flex items-center">
                <Calendar className="h-3 w-3 text-orange-500 mr-1" /> Data preferita
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`w-full h-10 text-sm justify-start bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-left font-normal ${!form.dataAppuntamento ? 'text-zinc-500' : 'text-white'}`}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-orange-500" />
                    {form.dataAppuntamento ? (
                      format(form.dataAppuntamento, "PPP", { locale: it })
                    ) : (
                      <span>Seleziona data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 text-white">
                  <CalendarComponent
                    mode="single"
                    selected={form.dataAppuntamento || undefined}
                    onSelect={handleDateSelect}
                    disabled={disabledDays}
                    initialFocus
                    className="bg-zinc-900 text-white"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-zinc-500 mt-1">Siamo aperti dal lunedì al sabato</p>
            </div>

            <fieldset className="border border-zinc-800 rounded-md p-3">
              <legend className="text-xs font-medium text-orange-500 px-1 flex items-center gap-1">
                <Clock className="h-3 w-3 text-orange-500" /> Fascia oraria
              </legend>
              <RadioGroup value={form.preferenzaOrario} onValueChange={handleTimePreferenceChange}>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex-1 flex items-center ${form.preferenzaOrario === "mattina" ? "bg-orange-950/30 border-orange-500/50" : "bg-zinc-900 border-zinc-800"} p-2 rounded border transition-colors duration-200`}>
                    <RadioGroupItem id="orario-mattina" value="mattina" className="text-orange-500 h-3 w-3" />
                    <Label htmlFor="orario-mattina" className="flex items-center ml-2 cursor-pointer text-sm">
                      <Sun className="h-4 w-4 text-orange-500 mr-2" />
                      <span className="font-medium text-white">Mattina (9:00-13:00)</span>
                    </Label>
                  </div>
                  
                  <div className={`flex-1 flex items-center ${form.preferenzaOrario === "pomeriggio" ? "bg-orange-950/30 border-orange-500/50" : "bg-zinc-900 border-zinc-800"} p-2 rounded border transition-colors duration-200`}>
                    <RadioGroupItem id="orario-pomeriggio" value="pomeriggio" className="text-orange-500 h-3 w-3" />
                    <Label htmlFor="orario-pomeriggio" className="flex items-center ml-2 cursor-pointer text-sm">
                      <Moon className="h-4 w-4 text-orange-500 mr-2" />
                      <span className="font-medium text-white">Pomeriggio (14:00-18:00)</span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </fieldset>
            <p className="text-xs text-zinc-400 mt-1">Ti ricontatteremo per confermare l'appuntamento</p>
          </div>
        </div>
      )}
      
      {/* CAPTCHA e Privacy in una riga */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* CAPTCHA Challenge */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-3">
          <label htmlFor="captcha" className="text-xs font-medium text-orange-500 flex items-center mr-3">
            <ShieldCheck className="h-4 w-4 text-orange-500 mr-1" /> Verifica
          </label>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>{captchaChallenge.num1} + {captchaChallenge.num2} =</span>
            <Input 
              id="captcha"
              name="captcha-result"
              value={captchaValue}
              onChange={handleCaptchaChange}
              type="number" 
              className="h-8 w-14 text-center bg-zinc-900 border-zinc-700 focus:border-orange-500 text-white"
              required
            />
            <Button 
              type="button" 
              onClick={generateCaptchaChallenge}
              variant="outline" 
              size="icon"
              className="h-8 w-8 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-orange-500 p-1"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Campi nascosti per il CAPTCHA */}
          <input type="hidden" name="captcha-challenge" value={`${captchaChallenge.num1} + ${captchaChallenge.num2}`} />
        </div>
        
        {/* Privacy Checkbox */}
        <div className="flex items-start bg-zinc-900 border border-zinc-800 rounded p-3">
          <Checkbox 
            id="privacy" 
            name="privacy-accepted"
            checked={privacyChecked}
            onCheckedChange={(checked) => setPrivacyChecked(!!checked)}
            className={`h-4 w-4 mt-0.5 ${attemptedSubmit && !privacyChecked ? 'border-red-500' : 'border-zinc-700'} data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500`}
          />
          <label htmlFor="privacy" className="text-sm text-zinc-400 ml-2 cursor-pointer">
            Accetto la <a href="/privacy-policy" className="text-orange-500 hover:underline">Privacy Policy</a>
          </label>
          <input type="hidden" name="privacy-policy" value={privacyChecked ? "accettata" : "non-accettata"} />
        </div>
      </div>
      
      <div className="flex justify-end">
        <motion.button
          type="submit"
          className="bg-orange-600 hover:bg-orange-700 text-white text-base py-2 px-4 rounded-lg"
          whileTap={{ scale: 0.9, backgroundColor: "#c2410c" }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          Invia richiesta
        </motion.button>
      </div>
    </motion.form>
  );
} 