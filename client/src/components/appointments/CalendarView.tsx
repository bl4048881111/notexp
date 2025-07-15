import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, setHours, setMinutes, parseISO, startOfDay, isEqual, subDays, addDays, addMinutes, isSameDay, getDay, getDate, startOfWeek, endOfWeek, getDaysInMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, FileText, Plus, ViewIcon } from 'lucide-react';
import { Appointment } from '@shared/schema';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarIcon, Calendar } from "lucide-react";
import { raggruppaPerTipoRicambio } from '@/utils/ricambi';


// Definizione tipo di vista per il calendario
type CalendarViewType = "day" | "week" | "month";

// Hook per rilevare la dimensione dello schermo
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Chiamata iniziale
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// Definizione delle fasce orarie (dalle 8:00 fino a +12 ore)
const currentHour = new Date().getHours();
const currentMinute = new Date().getMinutes();
// Arrotondiamo ai 30 minuti più vicini
const startMinute = currentMinute < 30 ? 0 : 30;

// Creiamo TIME_SLOTS che inizia dalle 8:00 anziché dall'ora corrente
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(8 + i * 0.5) % 24; // Inizia dalle 8:00, incrementa di 30 min
  const minute = (i % 2) * 30; // Alterna 0 e 30 minuti
  return {
    hour,
    minute,
    label: format(
      setMinutes(setHours(new Date(), hour), minute),
      'HH:mm',
      { locale: it }
    ),
    index: i // Aggiungiamo un indice per facilitare i calcoli di durata
  };
});

// Per trovare l'indice dell'ora corrente
const currentTimeSlotIndex = TIME_SLOTS.findIndex(slot => 
  (slot.hour > currentHour) || 
  (slot.hour === currentHour && slot.minute >= startMinute)
);

interface CalendarViewProps {
  appointments: Appointment[];
  isLoading: boolean;
  onSelectDate: (date: Date | string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  initialView?: CalendarViewType;
  showCompletedAppointments?: boolean;
  isClient?: boolean;
}

export default function CalendarView({ 
  appointments, 
  isLoading, 
  onSelectDate,
  onSelectAppointment,
  initialView = "day", // Valore predefinito, ma può essere sovrascritto
  showCompletedAppointments = false,
  isClient = false
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [view, setView] = useState(initialView); // Ripristiniamo la possibilità di cambiare vista
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [totalAppointmentsCount, setTotalAppointmentsCount] = useState(0);
  const { width } = useWindowSize(); // Utilizziamo il nuovo hook
  const isMobile = width < 768; // Definiamo quando considerare il dispositivo come mobile

  // Imposta automaticamente la vista giornaliera su dispositivi mobili
  useEffect(() => {
    if (isMobile && view !== "day") {
      setView("day");
    }
  }, [isMobile]);

  // Filtra gli appuntamenti in base allo stato di completamento
  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => 
      showCompletedAppointments || appointment.status !== "completato"
    );
  }, [appointments, showCompletedAppointments]);

  // Funzione per forzare l'aggiornamento della vista
  const forceRefresh = () => {
    console.log("DEBUG - Forzato aggiornamento della vista calendario:", filteredAppointments.length);
    
    // Log dettagliato delle durate degli appuntamenti
    if (filteredAppointments && filteredAppointments.length > 0) {
      console.log("DURATE APPUNTAMENTI:", filteredAppointments.map(app => ({
        id: app.id,
        cliente: app.clientName, 
        durata: getLaborHours(app),
        quoteId: app.quoteId,
        real_durata: app.duration,
        kevin: app.clientName && app.clientName.toLowerCase().includes('kevin')
      })));
    }
    
    // Tenta una ricarica forzata se disponibile
    try {
      if (window && window.parent && (window.parent as any).reloadAppointments) {
        console.log("DEBUG - Richiamo reloadAppointments da parent window");
        (window.parent as any).reloadAppointments();
      }
    } catch (error) {
      console.error("Errore nella ricarica forzata:", error);
    }
    
    // Forza il re-render
    setRefreshTrigger(prev => prev + 1);
  };

  // Rendo disponibile la funzione forceRefresh a livello di componente
  (window as any).forceCalendarRefresh = forceRefresh;
  
  // Risposta al cambio di appointments (incluse le proprietà interne)
  useEffect(() => {
    // Utilizziamo refreshTrigger solo quando cambia, non controlliamo tutti gli appuntamenti
    console.log("DEBUG - Trigger di aggiornamento rilevato:", refreshTrigger);
    
    // Log dettagliato delle durate degli appuntamenti (solo quando viene aggiornato effettivamente)
    if (filteredAppointments && filteredAppointments.length > 0) {
      console.log("DURATE APPUNTAMENTI (on refresh):", filteredAppointments.map(app => ({
        id: app.id,
        cliente: app.clientName, 
        durata: getLaborHours(app),
        quoteId: app.quoteId,
        real_durata: app.duration,
        kevin: app.clientName && app.clientName.toLowerCase().includes('kevin')
      })));
    }
  }, [refreshTrigger]);
  
  // Rimuoviamo la dipendenza da JSON.stringify che causa loop infiniti
  
  // Aggiungo un listener globale per gli eventi di aggiornamento del calendario
  useEffect(() => {
    const handleCalendarUpdate = () => {
      console.log("DEBUG - Ricevuta richiesta di aggiornamento calendario");
      setRefreshTrigger(prev => prev + 1);
    };
    
    // Registra l'evento personalizzato
    window.addEventListener('calendar:update', handleCalendarUpdate);
    
    // Pulizia dell'evento quando il componente viene smontato
    return () => {
      window.removeEventListener('calendar:update', handleCalendarUpdate);
    };
  }, []);

  // DEBUG: Stampiamo informazioni sugli appuntamenti
  useEffect(() => {
    // Ottieni la data odierna nel formato YYYY-MM-DD
    const today = format(new Date(), 'yyyy-MM-dd');
    console.log("DEBUG CalendarView - Data odierna:", today);
    console.log("DEBUG CalendarView - Numero totale appuntamenti:", filteredAppointments.length);
    
    // Stampa i dettagli di tutti gli appuntamenti per debug
    if (filteredAppointments.length > 0) {
      console.log("DEBUG CalendarView - Tutti gli appuntamenti:", 
        filteredAppointments.map(app => ({
          id: app.id,
          date: app.date,
          time: app.time,
          duration: app.duration,
          clientName: app.clientName
        }))
      );
      
      // Verifica il formato delle date
      const dateFormats = filteredAppointments.map(app => {
        try {
          return {
            id: app.id,
            originalDate: app.date,
            formattedDate: format(new Date(app.date), 'yyyy-MM-dd'),
            originalTime: app.time,
            duration: app.duration
          };
        } catch (e) {
          return { id: app.id, originalDate: app.date, error: "Errore formato data" };
        }
      });
      console.log("DEBUG - Formati delle date e durate:", dateFormats);
    }
  }, [filteredAppointments]);

  // Funzione helper per confrontare il valore della vista in modo sicuro
  const isView = (viewType: string): boolean => view === viewType;

  // Generate calendar days array
  useEffect(() => {
    console.log("Rigenerando giorni del calendario per:", format(currentMonth, 'MMMM yyyy', { locale: it }));
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Calcola correttamente i giorni del mese precedente
    const firstDayOfWeek = getDay(monthStart) || 7; // Trasforma domenica (0) in 7 per il calendario italiano
    const prevMonthDays = Array.from({ length: firstDayOfWeek - 1 }, (_, i) => {
      return new Date(monthStart.getFullYear(), monthStart.getMonth(), -i);
    }).reverse();

    const nextMonthDays = [];
    const totalDaysNeeded = 42; // 6 righe di calendario
    const daysToAdd = totalDaysNeeded - (prevMonthDays.length + daysInMonth.length);
    for (let i = 1; i <= daysToAdd; i++) {
      nextMonthDays.push(new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + i));
    }

    setCalendarDays([...prevMonthDays, ...daysInMonth, ...nextMonthDays]);
    
    // Se non c'è una data selezionata, imposta oggi
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [currentMonth]); // Rimuovo view e selectedDate dalle dipendenze

  const handlePreviousMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    setCurrentMonth(prevMonth);
    console.log("Mese cambiato a:", format(prevMonth, 'MMMM yyyy', { locale: it }));
    
    // Aggiorna anche selectedDate mantenendo lo stesso giorno del mese se possibile
    if (selectedDate) {
      const newSelectedDate = new Date(selectedDate);
      newSelectedDate.setFullYear(prevMonth.getFullYear());
      newSelectedDate.setMonth(prevMonth.getMonth());
      
      // Verifica che il giorno sia valido nel nuovo mese
      const daysInNewMonth = getDaysInMonth(prevMonth);
      if (newSelectedDate.getDate() > daysInNewMonth) {
        newSelectedDate.setDate(daysInNewMonth);
      }
      
      setSelectedDate(newSelectedDate);
    }
  };
  
  const handleNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    setCurrentMonth(nextMonth);
    console.log("Mese cambiato a:", format(nextMonth, 'MMMM yyyy', { locale: it }));
    
    // Aggiorna anche selectedDate mantenendo lo stesso giorno del mese se possibile
    if (selectedDate) {
      const newSelectedDate = new Date(selectedDate);
      newSelectedDate.setFullYear(nextMonth.getFullYear());
      newSelectedDate.setMonth(nextMonth.getMonth());
      
      // Verifica che il giorno sia valido nel nuovo mese
      const daysInNewMonth = getDaysInMonth(nextMonth);
      if (newSelectedDate.getDate() > daysInNewMonth) {
        newSelectedDate.setDate(daysInNewMonth);
      }
      
      setSelectedDate(newSelectedDate);
    }
  };
  
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  // Seleziona una data specifica
  const handleSelectDate = (date: Date) => {
    // Se l'utente è un cliente, non permettere la selezione della data per creare un nuovo appuntamento
    if (isClient) return;
    
    setSelectedDate(date);
    onSelectDate(format(date, 'yyyy-MM-dd'));
    
    // Se siamo in visualizzazione mensile, passa alla visualizzazione giornaliera
    if (isView("month")) {
      setView("day");
    }
  };

  // Funzione di utilità per normalizzare il formato dell'orario
  const normalizeTimeFormat = (time: string | undefined): string => {
    if (!time) return "08:00"; // Fallback a 8:00 se non c'è orario
    
    // Se è già in formato HH:MM, ritorna così com'è
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      return time.length === 4 ? `0${time}` : time; // Aggiungi uno zero iniziale se necessario (8:00 -> 08:00)
    }
    
    // Se è solo un numero (es. "8" o "14")
    if (/^\d{1,2}$/.test(time)) {
      return `${time.padStart(2, '0')}:00`;
    }
    
    // Altri formati possibili...
    try {
      // Tentativo di estrarre ore e minuti
      const timeInt = parseInt(time, 10);
      if (!isNaN(timeInt)) {
        return `${timeInt.toString().padStart(2, '0')}:00`;
      }
    } catch (e) {
      console.warn(`Formato orario non riconosciuto: ${time}`);
    }
    
    return "08:00"; // Fallback a 8:00 per formati non riconosciuti
  };

  // Funzione per convertire l'orario nel formato "HH:MM" in minuti
  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const result = {} as Record<string, Appointment[]>;
    
    console.log("DEBUG - appointmentsByDate - Normalizzando date e durate...");
    console.log("DEBUG - appointmentsByDate - Totale appuntamenti:", filteredAppointments.length);
    console.log("DEBUG - appointmentsByDate - Refresh trigger:", refreshTrigger);
    
    filteredAppointments.forEach(appointment => {
      try {
        // Normalizza il formato della data
        let dateObj: Date;
        let formattedDate: string;
        
        // Gestisci diversi formati di data possibili
        if (typeof appointment.date === 'string') {
          // Controlla se la data è già in formato ISO (YYYY-MM-DD)
          if (/^\d{4}-\d{2}-\d{2}/.test(appointment.date)) {
            formattedDate = appointment.date.split('T')[0]; // Rimuovi eventuali timestamp
          } else {
            // Prova a creare un oggetto Date e formattarlo
            try {
              dateObj = new Date(appointment.date);
              formattedDate = format(dateObj, 'yyyy-MM-dd');
            } catch (error) {
              console.error(`Errore nel parsing della data: ${appointment.date} per appuntamento ${appointment.id}`, error);
              // Utilizziamo la data di oggi come fallback in caso di errore
              formattedDate = format(new Date(), 'yyyy-MM-dd');
            }
          }
        } else if (typeof appointment.date === 'object' && appointment.date !== null) {
          // Se è un oggetto Date
          try {
            formattedDate = format(appointment.date as Date, 'yyyy-MM-dd');
          } catch (error) {
            console.error(`Errore nel parsing dell'oggetto data per appuntamento ${appointment.id}`, error);
            formattedDate = format(new Date(), 'yyyy-MM-dd');
          }
        } else {
          // Se non è né stringa né Date, utilizziamo la data di oggi
          console.warn(`Formato data non riconosciuto per appuntamento ${appointment.id}: ${appointment.date}`);
          formattedDate = format(new Date(), 'yyyy-MM-dd');
        }
        
        // Verifica esplicitamente la durata degli appuntamenti
        const durata = typeof appointment.duration === 'number' ? appointment.duration : 1;
        console.log(`DEBUG - Appuntamento ${appointment.id}: Data=${formattedDate}, Durata=${durata}h`);
        
        if (!result[formattedDate]) {
          result[formattedDate] = [];
        }
        
        // Normalizziamo anche il formato dell'orario per maggiore coerenza
        const normalizedAppointment = {
          ...appointment,
          time: normalizeTimeFormat(appointment.time)
        };
        
        result[formattedDate].push(normalizedAppointment);
      } catch (error) {
        console.error(`Errore nel parsing della data: ${appointment.date} per appuntamento ${appointment.id}`, error);
      }
    });
    
    // Stampa debug delle date
    const oggi = format(new Date(), 'yyyy-MM-dd');
    console.log(`DEBUG - appointmentsByDate - Date raggruppate:`, Object.keys(result));
    console.log(`DEBUG - appointmentsByDate - Appuntamenti oggi (${oggi}):`, result[oggi] || 'Nessuno');
    
    return result;
  }, [filteredAppointments, refreshTrigger]);
  
  // Calcola le ore di manodopera totali prioritizzando il valore laborHours dal preventivo
  const getLaborHours = (appointment: Appointment): number => {
    // Prova a leggere la durata come numero
    let duration = 1;
    if (appointment.duration !== undefined && appointment.duration !== null) {
      duration = Number(appointment.duration);
      if (isNaN(duration) || duration <= 0) duration = 1;
    }
    
    // Prova a leggere quoteLaborHours se esiste
    let quoteLaborHours = 0;
    if (appointment.quoteLaborHours !== undefined && appointment.quoteLaborHours !== null) {
      quoteLaborHours = Number(appointment.quoteLaborHours);
      if (isNaN(quoteLaborHours) || quoteLaborHours <= 0) quoteLaborHours = 0;
    }
    
    // Per garantire la compatibilità, usiamo il valore che esiste o il maggiore tra i due
    if (quoteLaborHours > 0) {
      // Usa sempre quoteLaborHours se disponibile
      console.log(`DEBUG: Appuntamento ${appointment.id} (${appointment.clientName || 'N/D'}) - Usando quoteLaborHours=${quoteLaborHours} invece di duration=${duration}`);
      return quoteLaborHours;
    }
    
    console.log(`DEBUG: Appuntamento ${appointment.id} (${appointment.clientName || 'N/D'}) - Usando duration=${duration} (quoteLaborHours non disponibile)`);
    return duration;
  };

  // Funzione per calcolare l'orario di fine dell'appuntamento
  const endOfAppointment = (appointment: Appointment) => {
    // Calcola l'orario di fine usando la durata corretta
    const hours = getLaborHours(appointment);
    const timeComponents = appointment.time.split(':');
    const startHour = parseInt(timeComponents[0]);
    const startMinute = parseInt(timeComponents[1]);
    
    // Calcola le ore e i minuti di fine
    const durationHours = Math.floor(hours);
    const durationMinutes = Math.round((hours - durationHours) * 60);
    
    let endHour = startHour + durationHours;
    let endMinute = startMinute + durationMinutes;
    
    // Gestisci il riporto dei minuti
    if (endMinute >= 60) {
      endHour += 1;
      endMinute -= 60;
    }
    
    // Crea un nuovo oggetto data con la data corretta dell'appuntamento
    const dateParts = appointment.date.split('-');
    const endDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      endHour,
      endMinute
    );
    
    return endDate;
  };

  // Effetto per aggiornare l'indicatore dell'ora corrente
  const updateCurrentTimeIndicator = () => {
    if (view === "day" && isToday(selectedDate || new Date())) {
      const now = new Date();
      const startOfDay = 8; // Orario di inizio del calendario (8:00)
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Calcola i minuti trascorsi dalle 8:00
      const minutesFromStart = (currentHours - startOfDay) * 60 + currentMinutes;
      // Ogni slot è alto 60px e rappresenta 30 minuti
      const topPosition = (minutesFromStart / 30) * 60;
      
      // Aggiorna la posizione dell'indicatore
      const indicator = document.getElementById("current-time-indicator");
      if (indicator) {
        indicator.style.top = `${topPosition}px`;
        indicator.style.display = currentHours >= startOfDay ? "block" : "none";
      }
    }
  };

  // Definizione del componente DailyView dopo la definizione di appointmentsByTimeSlot
  const DailyView = () => {
    if (!selectedDate) return null;

    const dayAppointments = appointmentsByDate[format(selectedDate, 'yyyy-MM-dd')] || [];
    const sortedAppointments = [...dayAppointments].sort((a, b) => {
      const timeA = normalizeTimeFormat(a.time);
      const timeB = normalizeTimeFormat(b.time);
      return timeA.localeCompare(timeB);
    });

    return (
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
        {/* Header migliorato */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-4 border-b border-orange-400/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}
                </h3>
                <p className="text-orange-100 text-sm">
                  {sortedAppointments.length} appuntamenti programmati
                </p>
              </div>
            </div>
            
            {/* Indicatori di stato */}
            <div className="flex gap-2">
              {['programmato', 'confermato', 'completato'].map(status => {
                const count = sortedAppointments.filter(app => app.status === status).length;
                if (count === 0) return null;
                
                const colors = {
                  programmato: 'bg-orange-400',
                  confermato: 'bg-blue-400', 
                  completato: 'bg-emerald-400'
                };
                
                return (
                  <div key={status} className={`${colors[status as keyof typeof colors]} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                    {count}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contenuto calendario */}
        <div className="flex h-[600px] overflow-hidden">
          {/* Colonna orari migliorata */}
          <div className="w-20 bg-gray-800/50 border-r border-gray-700 flex-shrink-0">
            <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-300">Orario</span>
            </div>
            {TIME_SLOTS.map((slot, index) => (
              <div 
                key={index}
                className={`
                  h-16 border-b border-gray-700/50 flex items-center justify-center text-xs font-medium
                  ${new Date().getHours() === slot.hour ? 'bg-orange-500/20 text-orange-300' : 'text-gray-400'}
                `}
              >
                {slot.label}
              </div>
            ))}
          </div>

          {/* Colonna appuntamenti migliorata */}
          <div className="flex-1 relative overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {TIME_SLOTS.map((slot, index) => {
              const { appointments: slotAppointments, isStartingSlot, slotSpans } = getAppointmentsForTimeSlot(filteredAppointments, slot);
              const isCurrentHour = new Date().getHours() === slot.hour;
              
              return (
                <div 
                  key={index}
                  className={`
                    relative h-16 border-b border-gray-700/30 transition-colors duration-200
                    ${isCurrentHour ? 'bg-orange-500/10 border-orange-500/30' : 'hover:bg-gray-800/30'}
                  `}
                  onClick={() => handleTimeSlotClick(slot)}
                >
                  {/* Indicatore ora corrente */}
                  {isCurrentHour && (
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gradient-to-r from-orange-500 to-transparent" />
                  )}
                  
                  {/* Appuntamenti */}
                  <div className="absolute inset-0 p-2">
                    {slotAppointments.length > 0 && (
                      <div className="h-full relative">
                        {slotAppointments.map((appointment, appIndex) => {
                          if (!isStartingSlot[appointment.id]) return null;
                          
                          const spanCount = slotSpans[appointment.id] || 1;
                          const heightInPixels = spanCount * 64;
                          
                          return (
                            <div
                              key={appointment.id}
                              className="absolute inset-x-2"
                              style={{
                                height: `${heightInPixels - 8}px`,
                                zIndex: 10 + appIndex
                              }}
                            >
                              <AppointmentCardEnhanced
                                appointment={appointment}
                                onClick={() => onSelectAppointment(appointment)}
                                isOverlapping={slotAppointments.length > 1}
                                index={appIndex}
                                isClient={isClient}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Area di click per nuovo appuntamento */}
                    {slotAppointments.length === 0 && !isClient && (
                      <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-gray-700/50 hover:bg-gray-600/50 border-2 border-dashed border-gray-500 rounded-lg p-2 text-center cursor-pointer transition-colors duration-200">
                          <Plus className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                          <span className="text-xs text-gray-400">Nuovo appuntamento</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Funzione per determinare il colore del bordo in base allo stato dell'appuntamento
  const getBorderColor = (appointment: Appointment) => {
    // Determina il colore del bordo in base allo stato dell'ordine pezzi
    if (appointment.partsOrdered === true) {
      return "border-orange-600 bg-orange-100/90";
    } else if (appointment.partsOrdered === false) {
      return "border-orange-600 bg-orange-100/90";
    }
    
    // Colore di default
    return "border-orange-600 bg-orange-100/90";
  };

  // Funzione per ottenere il colore di sfondo in base allo stato dell'appuntamento
  const getBackgroundColor = (appointment: Appointment) => {
    if (appointment.status === "completato") {
      return 'rgba(251, 146, 60, 0.95)'; // orange-400 molto intenso
    } else if (appointment.status === "annullato") {
      return 'rgba(38, 38, 38, 0.95)'; // neutral-800 molto intenso
    } else if (appointment.partsOrdered === true) {
      return 'rgba(249, 115, 22, 0.95)'; // orange-500 molto intenso
    } else if (appointment.partsOrdered === false) {
      return 'rgba(254, 215, 170, 0.95)'; // orange-200 molto intenso
    }
    return 'rgba(255, 237, 213, 0.95)'; // orange-100 molto intenso
  };

  // Funzione per ottenere il colore del bordo sinistro
  const getBorderLeftColor = (appointment: Appointment) => {
    if (appointment.partsOrdered === true) {
      return 'rgb(234, 88, 12)'; // orange-600 più intenso
    } else if (appointment.partsOrdered === false) {
      return 'rgb(249, 115, 22)'; // orange-500 più intenso
    } else if (appointment.status === "completato") {
      return 'rgb(154, 52, 18)'; // orange-800 più intenso
    } else if (appointment.status === "annullato") {
      return 'rgb(23, 23, 23)'; // neutral-900 più intenso
    }
    return 'rgb(234, 88, 12)'; // orange-600 più intenso
  };

  // Funzione per ottenere la classe di sfondo per la vista mensile
  const getMonthViewBackground = (appointment: Appointment) => {
    if (appointment.status === "completato") {
      return 'bg-orange-300 text-black border-orange-600';
    } else if (appointment.status === "annullato") {
      return 'bg-neutral-700 text-white border-neutral-900';
    } else if (appointment.partsOrdered === true) {
      return 'bg-orange-400 text-black border-orange-600';
    } else if (appointment.partsOrdered === false) {
      return 'bg-orange-200 text-black border-orange-400';
    }
    return 'bg-orange-100 text-black border-orange-300';
  };

  // Componente migliorato per le card degli appuntamenti
  const AppointmentCardEnhanced = ({ 
    appointment, 
    onClick, 
    isOverlapping = false, 
    index = 0,
    isClient = false 
  }: {
    appointment: Appointment;
    onClick: () => void;
    isOverlapping?: boolean;
    index?: number;
    isClient?: boolean;
  }) => {
    const getStatusConfig = (status: string) => {
      switch (status) {
        case "completato":
          return {
            bg: "bg-gradient-to-r from-emerald-500 to-emerald-600",
            border: "border-emerald-400",
            text: "text-white",
            icon: "✓",
            shadow: "shadow-emerald-500/25"
          };
        case "annullato":
          return {
            bg: "bg-gradient-to-r from-red-500 to-red-600",
            border: "border-red-400", 
            text: "text-white",
            icon: "✕",
            shadow: "shadow-red-500/25"
          };
        case "confermato":
          return {
            bg: "bg-gradient-to-r from-blue-500 to-blue-600",
            border: "border-blue-400",
            text: "text-white", 
            icon: "●",
            shadow: "shadow-blue-500/25"
          };
        default:
          return {
            bg: "bg-gradient-to-r from-orange-500 to-orange-600",
            border: "border-orange-400",
            text: "text-white",
            icon: "◐",
            shadow: "shadow-orange-500/25"
          };
      }
    };

    const config = getStatusConfig(appointment.status);
    const duration = getLaborHours(appointment);

    return (
      <div 
        className={`
          ${config.bg} ${config.border} ${config.text} ${config.shadow}
          rounded-lg border-l-4 p-3 cursor-pointer 
          hover:scale-105 hover:shadow-lg transition-all duration-200 ease-in-out
          backdrop-blur-sm relative overflow-hidden group
          ${isOverlapping ? 'opacity-95' : ''}
        `}
        onClick={onClick}
      >
        {/* Effetto lucido sulla card */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        {/* Header con status e orario */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{config.icon}</span>
            <span className="text-sm font-semibold">
              {appointment.time.slice(0, 5)}
            </span>
          </div>
          <div className="text-xs opacity-75 bg-black/20 px-2 py-1 rounded-full">
            {duration}h
          </div>
        </div>

        {/* Nome cliente */}
        <div className="font-bold text-base mb-1 truncate">
          {appointment.clientName}
        </div>

        {/* Dettagli servizio */}
        <div className="text-sm opacity-90 mb-2 line-clamp-2">
          {appointment.notes || appointment.services?.join(', ') || 'Servizio generico'}
        </div>

        {/* Footer con veicolo se disponibile */}
        {(appointment.plate || appointment.model) && (
          <div className="text-xs opacity-75 bg-black/20 px-2 py-1 rounded-md mt-2">
            🚗 {appointment.plate}{appointment.model ? ` - ${appointment.model}` : ''}
          </div>
        )}

        {/* Indicatore di sovrapposizione */}
        {isOverlapping && (
          <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        )}
      </div>
    );
  };

  // Effetto per scorrere automaticamente alla fascia oraria corrente quando si carica il calendario
  useEffect(() => {
    if (view === "day" || view === "week") {
      setTimeout(() => {
        const currentSlot = document.getElementById("current-time-slot");
        if (currentSlot) {
          currentSlot.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [view, selectedDate]);

  // Effetto per aggiornare l'indicatore dell'ora corrente
  useEffect(() => {
    // Aggiorna subito
    updateCurrentTimeIndicator();
    
    // Aggiorna ogni minuto
    const interval = setInterval(updateCurrentTimeIndicator, 60000);
    
    // Pulisci l'intervallo quando il componente viene smontato
    return () => clearInterval(interval);
  }, [view, selectedDate]);

  // Modifichiamo la funzione getAppointmentsForTimeSlot per tenere traccia degli slot occupati dagli appuntamenti
  const getAppointmentsForTimeSlot = (appointments: Appointment[], slot: typeof TIME_SLOTS[0]): {
    appointments: Appointment[], 
    isStartingSlot: Record<string, boolean>,
    slotSpans: Record<string, number>
  } => {
    const result: Appointment[] = [];
    const isStartingSlot: Record<string, boolean> = {};
    const slotSpans: Record<string, number> = {};
    
    appointments.forEach(appointment => {
      try {
        // Normalizza l'orario dell'appuntamento
        const appTime = normalizeTimeFormat(appointment.time);
        const [appHour, appMinute] = appTime.split(':').map(Number);
        
        // Ottieni la durata corretta dell'appuntamento usando getLaborHours
        const duration = getLaborHours(appointment);
        
        // Calcola l'ora di fine
        const totalMinutesStart = appHour * 60 + appMinute;
        const totalMinutesEnd = totalMinutesStart + (duration * 60);
        const endHour = Math.floor(totalMinutesEnd / 60) % 24;
        const endMinute = totalMinutesEnd % 60;
        
        // Log di debug
        console.log(`DEBUG - Calcolo slot per ${appointment.clientName}: inizio ${appHour}:${appMinute}, fine ${endHour}:${endMinute}, durata ${duration}h`);
        
        // Trova l'indice dello slot di inizio dell'appuntamento
        const startSlotIndex = TIME_SLOTS.findIndex(ts => 
          ts.hour === appHour && 
          ((ts.minute === 0 && appMinute < 30) || 
           (ts.minute === 30 && appMinute >= 30))
        );
        
        // Se non troviamo lo slot iniziale, usciamo
        if (startSlotIndex === -1) {
          console.warn(`DEBUG - Slot iniziale non trovato per ${appointment.clientName}`);
          return;
        }
        
        // Troviamo l'indice dello slot finale
        let endSlotIndex = -1;
        
        // Cerchiamo lo slot che contiene l'orario di fine o il primo slot dopo l'orario di fine
        for (let i = 0; i < TIME_SLOTS.length; i++) {
          const ts = TIME_SLOTS[i];
          // È lo slot finale se:
          // 1. L'ora dello slot è l'ora di fine E i minuti dello slot sono >= ai minuti di fine
          // 2. L'ora dello slot è maggiore dell'ora di fine
          if ((ts.hour > endHour) || 
              (ts.hour === endHour && ts.minute >= endMinute)) {
            // Prendiamo lo slot precedente come slot finale
            // perché l'attuale è il primo slot DOPO la fine dell'appuntamento
            endSlotIndex = i > 0 ? i - 1 : 0;
            break;
          }
        }
        
        // Se non abbiamo trovato uno slot finale, useremo l'ultimo slot disponibile
        if (endSlotIndex === -1) {
          console.warn(`DEBUG - Slot finale non trovato per ${appointment.clientName}, usando l'ultimo disponibile`);
          endSlotIndex = TIME_SLOTS.length - 1;
        }
        
        // Calcolo specifico per durate frazionarie
        // Per 2.5 ore: se l'appuntamento inizia alle 9:00, finirà alle 11:30 -> calcola 5 slot (9:00, 9:30, 10:00, 10:30, 11:00)
        const slotsSpanned = Math.ceil((duration * 2)); // Moltiplichiamo per 2 per ottenere il numero di slot da 30 minuti
        
        // Debug per appuntamenti multi-slot
        console.log(`DEBUG - Slot calcolati per ${appointment.clientName}: ${slotsSpanned}`);
        console.log(`DEBUG - Slot per ${appointment.clientName}: da ${startSlotIndex} (${TIME_SLOTS[startSlotIndex]?.label}) 
                   a ${endSlotIndex} (${TIME_SLOTS[endSlotIndex]?.label}), occupa ${slotsSpanned} slot`);
        
        // Otteniamo l'indice dello slot corrente
        const currentSlotIndex = slot.index;
        
        // Verifichiamo se lo slot corrente è compreso tra lo slot iniziale e quello finale dell'appuntamento
        if (currentSlotIndex >= startSlotIndex && currentSlotIndex < startSlotIndex + slotsSpanned) {
          // Aggiungiamo l'appuntamento alla lista di quelli da mostrare in questo slot
          result.push(appointment);
          
          // Indichiamo se si tratta dello slot iniziale
          isStartingSlot[appointment.id] = currentSlotIndex === startSlotIndex;
          
          // Salviamo il numero totale di slot che questo appuntamento occupa
          slotSpans[appointment.id] = slotsSpanned;
        }
      } catch (error) {
        console.error(`Errore nel valutare l'appuntamento per lo slot: ${error}`);
      }
    });
    
    return { appointments: result, isStartingSlot, slotSpans };
  };

  // Funzione migliorata per ottenere i colori degli appuntamenti
  const getColorStylesForAppointment = (appointment: Appointment, index: number = 0, isOverlapping: boolean = false) => {
    const baseColors = {
      completato: {
        bg: '#10b981', // emerald-500
        border: '#34d399', // emerald-400
        text: '#ffffff'
      },
      annullato: {
        bg: '#ef4444', // red-500
        border: '#f87171', // red-400
        text: '#ffffff'
      },
      confermato: {
        bg: '#3b82f6', // blue-500
        border: '#60a5fa', // blue-400
        text: '#ffffff'
      },
      default: {
        bg: '#f97316', // orange-500
        border: '#fb923c', // orange-400
        text: '#ffffff'
      }
    };

    return baseColors[appointment.status as keyof typeof baseColors] || baseColors.default;
  };

  // Funzione per aprire la pagina 4 del preventivo
  const handleOpenQuotePage = (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `/quotes/${quoteId}/edit?page=4`;
  };

  // Se non hai accesso a orders e search, usa array vuoto e stringa vuota
  const ricambiPerTipo = raggruppaPerTipoRicambio([], '', appointments);

  // Sincronizza gli appuntamenti in base alla proprietà showCompletedAppointments
  useEffect(() => {
    if (!Array.isArray(filteredAppointments)) return;
    
    // Calcola il numero totale di appuntamenti
    const total = Object.values(appointmentsByDate).reduce((sum, apps) => sum + apps.length, 0);
    setTotalAppointmentsCount(total);
    
  }, [filteredAppointments, appointmentsByDate]);

  // Funzione per calcolare la posizione dell'ora corrente
  const getCurrentTimePosition = (): number => {
    const now = new Date();
    const startHour = 8; // Calendario inizia alle 8:00
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Calcola i minuti dall'inizio del calendario
    const minutesFromStart = (currentHour - startHour) * 60 + currentMinute;
    
    // Ogni ora occupa 64px (2 slot da 32px ciascuno)
    return (minutesFromStart / 60) * 64;
  };

  // Funzione per verificare se uno slot corrisponde all'ora corrente
  const isCurrentTimeSlot = (slot: {hour: number, minute: number}): boolean => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Verifica se l'ora corrente corrisponde all'ora dello slot
    if (slot.hour !== currentHour) return false;
    
    // Verifica se i minuti correnti rientrano nell'intervallo dello slot
    return (
      (slot.minute === 0 && currentMinute < 30) || 
      (slot.minute === 30 && currentMinute >= 30)
    );
  };

  // Funzione per gestire il click su uno slot orario
  const handleTimeSlotClick = (slot: {hour: number, minute: number}) => {
    // Se l'utente è un cliente, non permettiamo la creazione di appuntamenti
    if (isClient) return;
    
    // Altrimenti, crea un nuovo appuntamento a quest'ora
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(slot.hour, slot.minute, 0, 0);
      onSelectDate(format(newDate, 'yyyy-MM-dd') + 'T' + format(newDate, 'HH:mm'));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black rounded-lg shadow-md overflow-hidden border border-gray-800 text-white">
        <div className="p-2 border-b border-gray-800">
          <Skeleton className="h-8 w-full bg-gray-800" />
        </div>
        <Skeleton className="h-[500px] w-full bg-gray-800" />
      </div>
    );
  }

  // Rendering della vista giornaliera
  if (isView("day") && selectedDate) {
    return (
      <div className="bg-black rounded-lg shadow-md overflow-hidden border border-gray-800">
        <div className="p-2 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedDate(prev => {
                if (!prev) return new Date();
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() - 1);
                return newDate;
              })}
              className="p-1 rounded-full hover:bg-gray-800 text-orange-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <h3 className="text-sm font-medium text-orange-500">
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}
            </h3>
            
            <button
              onClick={() => setSelectedDate(prev => {
                if (!prev) return new Date();
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() + 1);
                return newDate;
              })}
              className="p-1 rounded-full hover:bg-gray-800 text-orange-500"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="text-xs h-8 px-3 bg-orange-600 hover:bg-orange-700 text-white border-none mr-2"
            >
              Oggi
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {view === "month" 
                    ? "Mese" 
                    : view === "week" 
                    ? "Settimana" 
                    : "Giorno"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setView("day")}>
                  Giorno
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("week")}>
                  Settimana
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("month")}>
                  Mese
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contenitore principale della vista giornaliera */}
        <div className="flex flex-grow overflow-y-auto bg-black">
          {/* Colonna delle ore */}
          <div className="time-column w-10 flex-shrink-0 border-r bg-black border-gray-800">
            {Array.from({ length: 26 }, (_, i) => {
              const hour = Math.floor(i/2) + 8;
              const minute = (i % 2) * 30;
              return (
                <div key={`${hour}-${minute}`} className="h-8 border-b border-gray-800 text-[9px] font-medium text-gray-500 pl-1 flex items-center">
                  {minute === 0 ? `${hour}:00` : ''}
                </div>
              );
            })}
          </div>
          
          {/* Colonna principale degli appuntamenti */}
          <div 
            className="appointments-column flex-grow relative" 
            style={{ height: `${26 * 32}px`, backgroundColor: '#111111' }}
            onClick={(e) => {
              // Se l'utente è un cliente, non permettere l'aggiunta di appuntamenti
              if (isClient) return;
              
              const elem = e.currentTarget;
              const rect = elem.getBoundingClientRect();
              const offsetY = e.clientY - rect.top + elem.scrollTop;
              
              // Calcola l'ora in base alla posizione del clic
              const slotHeight = 32; // Altezza di ogni fascia di 30 minuti
              const slotIndex = Math.floor(offsetY / slotHeight);
              const hour = Math.floor(slotIndex / 2) + 8;
              const minute = (slotIndex % 2) * 30;
              
              const newDate = new Date(selectedDate || new Date());
              newDate.setHours(hour, minute, 0, 0);
              
              onSelectDate(format(newDate, 'yyyy-MM-dd'));
            }}
          >
            {/* Linee delle ore e mezz'ore */}
            {Array.from({ length: 26 }, (_, i) => {
              const isFullHour = i % 2 === 0;
              return (
                <div 
                  key={i} 
                  className={`h-8 border-b ${isFullHour ? 'border-gray-600' : 'border-gray-700'} relative`}
                >
                </div>
              );
            })}
            
            {/* Linea per l'ora corrente */}
            {isSameDay(selectedDate || new Date(), new Date()) && (
              <div 
                className="absolute w-full h-0.5 bg-orange-600 z-40"
                style={{ 
                  top: `${((new Date().getHours() - 8) * 2 + Math.floor(new Date().getMinutes() / 30)) * 32}px` 
                }}
              >
                <div className="absolute -left-[9px] -top-[3px] w-3 h-3 rounded-full bg-orange-600 shadow-md"></div>
              </div>
            )}
            
            {/* Appuntamenti */}
            {appointmentsByDate[format(selectedDate || new Date(), 'yyyy-MM-dd')]?.map((appointment) => {
              // Date degli appuntamenti
              const appointmentDate = new Date(appointment.date);
              
              // Usa la funzione endOfAppointment corretta per calcolare l'ora di fine
              const endTime = endOfAppointment(appointment);
              
              // Formattazione orari
              // Estrai l'orario dall'oggetto Date invece di usare il campo time
              const appTime = normalizeTimeFormat(appointment.time);
              const endTimeStr = format(endTime, "HH:mm");
              
              // Ottieni la durata corretta dell'appuntamento
              const durataOre = getLaborHours(appointment);
              
              // Calcola ora e minuto di inizio dall'orario normalizzato
              const [startHour, startMinute] = appTime.split(':').map(Number);
              
              // Calcola l'indice dello slot di 30 minuti
              const startSlotIndex = (startHour - 8) * 2 + Math.floor(startMinute / 30);
              
              // Posizione e dimensioni
              const topPosition = startSlotIndex * 32 + (startMinute % 30) / 30 * 32;
              
              // Assicurati che la durata sia calcolata correttamente per la visualizzazione
              const slotHeight = 32; // Altezza per ogni mezz'ora
              // Calcola quante mezz'ore occupa
              const halfHours = durataOre * 2; // 2.5 ore = 5 mezz'ore
              // Calcola l'altezza totale
              const totalHeight = halfHours * slotHeight;
              
              // Flag per appuntamenti lunghi (> 2 ore)
              const isLongAppointment = durataOre > 2;
              
              // Trova appuntamenti che si sovrappongono a questo
              const overlappingAppointments = appointmentsByDate[format(selectedDate || new Date(), 'yyyy-MM-dd')]?.filter(app => {
                if (app.id === appointment.id) return false;
                
                const appDate = new Date(app.date);
                const appEndTime = endOfAppointment(app);
                
                return (
                  (appointmentDate < appEndTime && endTime > appDate)
                );
              });
              
              // Calcola la larghezza e la posizione in base al numero di appuntamenti sovrapposti
              const totalOverlapping = overlappingAppointments.length + 1;
              const isOverlapping = overlappingAppointments.length > 0;
              const appointmentWidth = Math.min(100, isOverlapping ? 
                100 / totalOverlapping - 1 : 98);
                
              // Determine la posizione orizzontale
              let overlappingIndex = 0;
              const sortedOverlappingIds = [...overlappingAppointments, appointment]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(app => app.id);
              
              overlappingIndex = sortedOverlappingIds.indexOf(appointment.id);
              
              const backgroundColor = getBackgroundColor(appointment);
              const borderLeftColor = getBorderLeftColor(appointment);
              
              // Calcola lo stile di testo in base allo sfondo (light o dark)
              const isLightBackground = appointment.status !== "annullato";
              const textColor = isLightBackground ? 'text-slate-900' : 'text-white';
              
              return (
                <div 
                  key={appointment.id}
                  className="shadow-sm cursor-pointer hover:shadow-md transition-all flex-shrink-0"
                  style={{
                    position: 'absolute',
                    top: `${topPosition}px`,
                    height: `${Math.max(50, Math.ceil(getLaborHours(appointment) * 2) * 50)}px`,
                    width: `${appointmentWidth}%`,
                    left: isOverlapping ? `${overlappingIndex * (100 / totalOverlapping) + 1}%` : '1%',
                    backgroundColor,
                    borderLeft: `3px solid ${borderLeftColor}`,
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontSize: '0.7rem',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(0,0,0,0.05)',
                    pointerEvents: 'auto',
                    zIndex: 10 + (isLongAppointment ? 1 : 0) + Number(overlappingIndex),
                    padding: '0.25rem'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSelectAppointment(appointment);
                  }}
                >
                  <div className="flex-grow flex flex-col justify-between">
                    <div>
                      <div className={`font-bold ${textColor} truncate text-xs`}>{appointment.clientName}</div>
                      <div className={`font-medium text-[10px] ${textColor} truncate`}>
                        {normalizeTimeFormat(appointment.time)}-{format(endOfAppointment(appointment), 'HH:mm')}
                      </div>
                      {appointment.plate && totalHeight > 40 && (
                        <div className={`text-[9px] ${textColor} truncate font-medium mt-0.5`}>
                          {appointment.plate}
                        </div>
                      )}
                    </div>
                    
                    {totalHeight > 50 && (
                      <div className="flex items-center justify-between mt-auto">
                        {appointment.status && (
                          <span className={`
                            text-[8px] py-0 px-1 rounded
                            ${appointment.status === "completato" ? "bg-orange-300 text-black border border-orange-600" : 
                              appointment.status === "annullato" ? "bg-neutral-700 text-white border border-neutral-900" : 
                              "bg-orange-100 text-black border border-orange-300"}
                            font-bold
                          `}>
                              {appointment.status === "completato" ? "Comp." : 
                               appointment.status === "annullato" ? "Ann." : "Conf."}
                            </span>
                        )}
                        
                        {/* Bottone preventivo più compatto */}
                        {appointment.quoteId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleOpenQuotePage(appointment.quoteId as string, e);
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white p-0.5 rounded ml-1"
                            title="Visualizza preventivo"
                          >
                            <FileText className="h-2 w-2" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Rendering vista settimanale
  if (isView("week") && selectedDate) {
    // Calcola i giorni della settimana
    const day = selectedDate.getDay() || 7; // Trasforma 0 (domenica) in 7
    const diff = selectedDate.getDate() - day + 1; // Primo giorno (lunedì) della settimana
    const weekStart = new Date(selectedDate);
    weekStart.setDate(diff);
    
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      return day;
    });

    return (
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
        {/* Header migliorato */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-4 border-b border-orange-400/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedDate(prev => {
                  if (!prev) return new Date();
                  const newDate = new Date(prev);
                  newDate.setDate(newDate.getDate() - 7);
                  return newDate;
                })}
                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors duration-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="bg-white/20 p-2 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white">
                  {format(weekDays[0], 'd MMM', { locale: it })} - {format(weekDays[6], 'd MMM yyyy', { locale: it })}
                </h3>
                <p className="text-orange-100 text-sm">Vista settimanale</p>
              </div>
              
              <button
                onClick={() => setSelectedDate(prev => {
                  if (!prev) return new Date();
                  const newDate = new Date(prev);
                  newDate.setDate(newDate.getDate() + 7);
                  return newDate;
                })}
                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors duration-200"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleToday}
              className="bg-white/20 hover:bg-white/30 text-white border-none"
            >
              Oggi
            </Button>
          </div>
        </div>
        
        {/* Header giorni migliorato */}
        <div className="border-b border-gray-700 grid grid-cols-8 bg-gray-800/50">
          {/* Intestazione vuota per la colonna delle ore */}
          <div className="py-3 border-r border-gray-700 bg-gray-800">
            <span className="text-xs font-semibold text-gray-300 block text-center">Orario</span>
          </div>
          
          {/* Intestazioni dei giorni */}
          {weekDays.map((day, dayIndex) => (
            <div 
              key={dayIndex} 
              className={`text-center py-3 border-r border-gray-700 cursor-pointer transition-colors duration-200 ${
                isToday(day) ? 'bg-orange-500/20 border-orange-500/30' : 'hover:bg-gray-700/50'
              }`}
              onClick={() => {
                setSelectedDate(day);
                setView("day");
              }}
            >
              <div className={`text-xs font-medium ${isToday(day) ? 'text-orange-300' : 'text-gray-400'}`}>
                {format(day, 'EEE', { locale: it })}
              </div>
              <div className={`text-lg font-bold ${isToday(day) ? 'text-orange-400' : 'text-white'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Griglia oraria migliorata */}
        <div className="h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          <div className="min-h-[600px]">
            {TIME_SLOTS.map((slot, slotIndex) => {
              const isCurrentHour = new Date().getHours() === slot.hour;
              
              return (
                <div 
                  key={slotIndex}
                  className={`grid grid-cols-8 border-b border-gray-700/30 transition-colors duration-200 ${
                    isCurrentHour ? 'bg-orange-500/10 border-orange-500/30' : 
                    slotIndex % 2 === 0 ? 'bg-gray-900/30' : ''
                  }`}
                >
                  {/* Colonna dell'ora */}
                  <div className={`py-3 px-2 text-center text-xs font-medium border-r border-gray-700 bg-gray-800/40 ${
                    isCurrentHour ? 'text-orange-300 bg-orange-500/20' : 'text-gray-400'
                  }`}>
                    {slot.label}
                  </div>
                  
                  {/* Colonne dei giorni */}
                  {weekDays.map((day, dayIndex) => {
                    const formattedDate = format(day, 'yyyy-MM-dd');
                    const dayAppointments = appointmentsByDate[formattedDate] || [];
                    
                    // Ottieni appuntamenti per questo slot e giorno
                    const { appointments: slotAppointments, isStartingSlot, slotSpans } = getAppointmentsForTimeSlot(dayAppointments, slot);
                    
                    return (
                      <div 
                        key={dayIndex} 
                        className={`relative min-h-[60px] border-r border-gray-700/50 p-2 transition-colors duration-200 ${
                          isToday(day) ? 'bg-orange-900/5' : ''
                        } hover:bg-gray-800/30`}
                        onClick={() => {
                          // Quando si clicca su uno slot vuoto, crea un nuovo appuntamento
                          if (slotAppointments.length === 0 && !isClient) {
                            const date = format(day, 'yyyy-MM-dd');
                            onSelectDate(`${date}T${slot.label}`);
                          }
                        }}
                      >
                        {/* Indicatore ora corrente */}
                        {isCurrentHour && isToday(day) && (
                          <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gradient-to-r from-orange-500 to-transparent pointer-events-none" />
                        )}
                        
                        {/* Appuntamenti */}
                        {slotAppointments.length > 0 ? (
                          <div className="h-full w-full relative">
                            {slotAppointments
                              .slice(0, 2) // Limita a massimo 2 appuntamenti visibili per slot
                              .map((appointment, idx) => isStartingSlot[appointment.id] && (
                              <div 
                                key={appointment.id}
                                className="absolute inset-0"
                                style={{
                                  height: `${Math.max(60, Math.ceil(getLaborHours(appointment) * 2) * 60)}px`,
                                  width: slotAppointments.length > 1 ? `${94 / Math.min(slotAppointments.length, 2)}%` : '94%',
                                  left: slotAppointments.length > 1 ? `${(idx * (94 / Math.min(slotAppointments.length, 2))) + 3}%` : '3%',
                                  zIndex: 10 + idx
                                }}
                              >
                                <AppointmentCardEnhanced
                                  appointment={appointment}
                                  onClick={() => onSelectAppointment(appointment)}
                                  isOverlapping={slotAppointments.length > 1}
                                  index={idx}
                                  isClient={isClient}
                                />
                              </div>
                            ))}
                            
                            {/* Indicatore appuntamenti extra */}
                            {slotAppointments.length > 2 && (
                              <div className="absolute bottom-1 right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-lg">
                                +{slotAppointments.length - 2}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Area di click per nuovo appuntamento */
                          !isClient && (
                            <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                              <div className="bg-gray-700/30 hover:bg-gray-600/40 border border-dashed border-gray-500 rounded-md p-2 text-center cursor-pointer transition-colors duration-200">
                                <Plus className="h-3 w-3 text-gray-400 mx-auto mb-1" />
                                <span className="text-xs text-gray-400">Nuovo</span>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Rendering vista mensile
  if (isView("month") && selectedDate) {
    // Calcola i giorni del mese
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="bg-black text-gray-100 rounded-lg shadow-lg overflow-hidden flex flex-col border border-gray-800">
        <div className="flex justify-between items-center px-4 py-4 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-medium text-white">{isClient ? "Calendario Appuntamenti " : "Pianificazione"}</h3>
            <span className="text-orange-500 font-medium ml-2">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </span>
            {!isClient && (
              <span className="text-xs text-gray-400 ml-2">
                {filteredAppointments.length} appuntamenti
              </span>
            )}
          </div>
          
          <div className="flex space-x-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousMonth}
              className="h-8 w-8 p-0 text-orange-500 border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="text-xs h-8 px-3 bg-orange-600 hover:bg-orange-700 text-white border-none"
            >
              Oggi
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              className="h-8 w-8 p-0 text-orange-500 border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            {!isClient && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {view === "month" 
                      ? "Mese" 
                      : view === "week" 
                      ? "Settimana" 
                      : "Giorno"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setView("day")}>
                    Giorno
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("week")}>
                    Settimana
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("month")}>
                    Mese
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        {isView("month") && (
          <div className="flex-1 p-4 overflow-auto bg-black">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-orange-400 p-1 border-b border-orange-500/20">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {/* Genera i giorni precedenti (del mese scorso) per riempire la prima settimana */}
              {Array.from({ length: getDay(monthStart) || 7 }).map((_, index) => {
                // Calcola la data effettiva per questo giorno del mese precedente
                const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0 - (index - 1));
                return (
                  <div 
                    key={`prev-${index}`} 
                    className="min-h-[60px] p-1 border border-gray-800 rounded-md bg-black text-gray-600"
                    onClick={() => handleSelectDate(day)}
                  >
                    <div className="text-xs p-1">{format(day, 'd')}</div>
                  </div>
                );
              }).reverse()}
              
              {/* Giorni del mese corrente */}
              {Array.from({ length: getDate(monthEnd) }).map((_, index) => {
                const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), index + 1);
                const formattedDate = format(day, 'yyyy-MM-dd');
                const dayAppointments = appointmentsByDate[formattedDate] || [];
                const isCurrentDay = isToday(day);
                
                return (
                  <div
                    key={`current-${index}`} 
                    className={`min-h-[60px] p-1 border ${
                      isCurrentDay ? 'border-orange-600 bg-orange-900/30' : 'border-gray-800 hover:bg-gray-800/70 bg-black'
                    } rounded-md`}
                    onClick={() => handleSelectDate(day)}
                  >
                    <div className={`text-xs p-1 font-bold ${isCurrentDay ? 'text-orange-500' : 'text-white'}`}>
                      {format(day, 'd')}
                    </div>
                    
                    {/* Mostra gli appuntamenti per questo giorno */}
                    <div className="space-y-1 mt-0.5">
                      {dayAppointments.length > 0 ? (
                        <>
                          {/* Mostra max 2 appuntamenti, poi un indicatore "+X altri" */}
                          {dayAppointments.slice(0, 2).map(appointment => {
                            // Semplifichiamo per non usare lo sfondo custom
                            const backgroundColor = appointment.status === "completato" ? "bg-orange-300" :
                                                  appointment.status === "annullato" ? "bg-gray-700" :
                                                  "bg-orange-500/70";
                            return (
                              <div 
                                key={appointment.id}
                                className={`text-[8px] px-1 py-0.5 truncate rounded-sm ${backgroundColor} shadow-sm hover:shadow-md`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectAppointment(appointment);
                                }}
                              >
                                <span className="font-bold">{appointment.time.slice(0, 5)}</span> <span className="truncate">{appointment.clientName}</span>
                              </div>
                            );
                          })}
                          
                          {dayAppointments.length > 2 && (
                            <div className="text-[8px] text-center font-bold bg-orange-600/40 text-white rounded-sm py-0.5 mt-0.5">
                              +{dayAppointments.length - 2}
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              
              {/* Giorni del mese successivo per completare la griglia */}
              {(() => {
                const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), getDate(monthEnd));
                const remainingCells = 7 - ((getDay(lastDayOfMonth) || 7) % 7);
                
                if (remainingCells < 7) {
                  return Array.from({ length: remainingCells }).map((_, index) => {
                    const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, index + 1);
                    return (
                      <div 
                        key={`next-${index}`} 
                        className="min-h-[60px] p-1 border border-gray-800 rounded-md bg-black text-gray-600"
                        onClick={() => handleSelectDate(day)}
                      >
                        <div className="text-xs p-1">{format(day, 'd')}</div>
                      </div>
                    );
                  });
                }
                return null;
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      {/* Header unificato per tutte le viste */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-4 border-b border-orange-400/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousMonth}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors duration-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="bg-white/20 p-2 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            
            <div>
              <h2 className="text-lg font-bold text-white">
                {format(currentMonth, 'MMMM yyyy', { locale: it })}
              </h2>
              <p className="text-orange-100 text-sm">
                {filteredAppointments.length} appuntamenti
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="mx-2 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-colors duration-200"
            >
              Oggi
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors duration-200"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Controlli di vista migliorati */}
          <div className="flex bg-black/20 rounded-lg p-1 gap-1">
            <Button
              variant={isView("day") ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("day")}
              className={`${
                isView("day") 
                  ? 'bg-white text-gray-900 hover:bg-white/90' 
                  : 'text-white hover:bg-white/10'
              } transition-all duration-200`}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Giorno
            </Button>
            
            {!isMobile && (
              <>
                <Button
                  variant={isView("week") ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("week")}
                  className={`${
                    isView("week") 
                      ? 'bg-white text-gray-900 hover:bg-white/90' 
                      : 'text-white hover:bg-white/10'
                  } transition-all duration-200`}
                >
                  <ViewIcon className="h-4 w-4 mr-1" />
                  Settimana
                </Button>
                
                <Button
                  variant={isView("month") ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("month")}
                  className={`${
                    isView("month") 
                      ? 'bg-white text-gray-900 hover:bg-white/90' 
                      : 'text-white hover:bg-white/10'
                  } transition-all duration-200`}
                >
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  Mese
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contenuto del calendario */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col space-y-4 p-6">
            <Skeleton className="h-8 w-full bg-gray-800" />
            <Skeleton className="h-64 w-full bg-gray-800" />
            <Skeleton className="h-32 w-full bg-gray-800" />
          </div>
        ) : (
          <>
            {view === "day" && <DailyView />}
            {/* Le viste week e month hanno già il loro rendering implementato sopra */}
          </>
        )}
      </div>
    </div>
  );
}