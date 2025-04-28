import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, setHours, setMinutes, parseISO, startOfDay, isEqual, subDays, addDays, addMinutes, isSameDay, getDay, getDate } from 'date-fns';
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
}

export default function CalendarView({ 
  appointments, 
  isLoading, 
  onSelectDate,
  onSelectAppointment,
  initialView = "day" // Valore predefinito, ma può essere sovrascritto
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [view, setView] = useState(initialView); // Ripristiniamo la possibilità di cambiare vista
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Funzione per forzare l'aggiornamento della vista
  const forceRefresh = () => {
    console.log("DEBUG - Forzato aggiornamento della vista calendario:", appointments.length);
    
    // Log dettagliato delle durate degli appuntamenti
    if (appointments && appointments.length > 0) {
      console.log("DURATE APPUNTAMENTI:", appointments.map(app => ({
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
    if (appointments && appointments.length > 0) {
      console.log("DURATE APPUNTAMENTI (on refresh):", appointments.map(app => ({
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
    console.log("DEBUG CalendarView - Numero totale appuntamenti:", appointments.length);
    
    // Stampa i dettagli di tutti gli appuntamenti per debug
    if (appointments.length > 0) {
      console.log("DEBUG CalendarView - Tutti gli appuntamenti:", 
        appointments.map(app => ({
          id: app.id,
          date: app.date,
          time: app.time,
          duration: app.duration,
          clientName: app.clientName
        }))
      );
      
      // Verifica il formato delle date
      const dateFormats = appointments.map(app => {
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
  }, [appointments]);

  // Funzione helper per confrontare il valore della vista in modo sicuro
  const isView = (viewType: string): boolean => view === viewType;

  // Generate calendar days array
  useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dayOfWeek = monthStart.getDay() || 7;
    const prevMonthDays = Array.from({ length: dayOfWeek - 1 }, (_, i) => {
      return new Date(monthStart.getFullYear(), monthStart.getMonth(), -i);
    }).reverse();

    const nextMonthDays = [];
    const totalDaysNeeded = 42;
    const daysToAdd = totalDaysNeeded - (prevMonthDays.length + daysInMonth.length);
    for (let i = 1; i <= daysToAdd; i++) {
      nextMonthDays.push(new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + i));
    }

    setCalendarDays([...prevMonthDays, ...daysInMonth, ...nextMonthDays]);
    
    // Se non c'è una data selezionata, imposta oggi
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [currentMonth]);

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // Seleziona una data specifica
  const handleSelectDate = (date: Date) => {
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
    console.log("DEBUG - appointmentsByDate - Totale appuntamenti:", appointments.length);
    console.log("DEBUG - appointmentsByDate - Refresh trigger:", refreshTrigger);
    
    appointments.forEach(appointment => {
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
  }, [appointments, refreshTrigger]);
  
  // Calcola le ore di manodopera totali prioritizzando il valore laborHours dal preventivo
  const getLaborHours = (appointment: Appointment): number => {
    // Prova a leggere la durata come numero
    let duration = 1;
    if (appointment.duration !== undefined && appointment.duration !== null) {
      duration = Number(appointment.duration);
      if (isNaN(duration) || duration <= 0) duration = 1;
    }
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

  // Definizione del componente DailyView dopo la definizione di appointmentsByTimeSlot
  const DailyView = () => {
    // Non possiamo usare selectedDate direttamente se è null
    const effectiveDate = selectedDate || new Date();
    const formattedDate = format(effectiveDate, 'yyyy-MM-dd');
    
    // Usa appointmentsByDate per trovare gli appuntamenti di oggi
    const todaysAppointments = appointmentsByDate[formattedDate] || [];
    const hasAppointmentsToday = todaysAppointments.length > 0;
    
    console.log(`DEBUG - Vista giornaliera - Data: ${formattedDate}`);
    console.log(`DEBUG - Appuntamenti oggi: ${hasAppointmentsToday ? "SI" : "NO"} (${todaysAppointments.length})`);
    
    if (hasAppointmentsToday) {
      console.log("DEBUG - Dettagli appuntamenti:", todaysAppointments.map(a => ({
        id: a.id, 
        cliente: a.clientName, 
        orario: a.time, 
        durata: a.duration
      })));
    }

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Intestazione della data corrente */}
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <div className="text-lg font-semibold">
            {format(effectiveDate, "EEEE d MMMM yyyy", { locale: it })}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectDate(subDays(effectiveDate, 1))}
            >
              Giorno precedente
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSelectDate(new Date())}
            >
              Oggi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectDate(addDays(effectiveDate, 1))}
            >
              Giorno successivo
            </Button>
          </div>
        </div>

        {/* Visualizzazione dei time slots */}
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="space-y-1 py-2">
            {TIME_SLOTS.map((slot) => {
              // Trova gli appuntamenti per questo slot
              const slotAppointments = todaysAppointments.filter(app => {
                // Controlla se l'appuntamento cade in questo slot
                const appTime = normalizeTimeFormat(app.time);
                const [appHour, appMinute] = appTime.split(':').map(Number);
                
                return appHour === slot.hour && appMinute >= slot.minute && appMinute < slot.minute + 30;
              });
              
              const isCurrentHour = currentHour === slot.hour && currentMinute >= slot.minute && currentMinute < slot.minute + 30;
              
              return (
                <div 
                  key={slot.label}
                  className={`flex items-start px-4 py-2 border-l-4 ${
                    isCurrentHour ? "border-orange-500 bg-orange-50" : "border-transparent"
                  } hover:bg-gray-50`}
                >
                  <div className="w-16 flex-shrink-0 text-sm font-medium text-gray-500">
                    {slot.label}
                  </div>
                  
                  <div className="flex-1 ml-4 space-y-2">
                    {slotAppointments.length > 0 ? (
                      slotAppointments.map((appointment) => (
                        <AppointmentCardEnhanced
                          key={appointment.id}
                          appointment={appointment}
                          onClick={() => onSelectAppointment(appointment)}
                          isOverlapping={false}
                          index={0}
                        />
                      ))
                    ) : (
                      <div className="h-6 text-sm text-gray-400">-</div>
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

  // Versione migliorata dell'AppointmentCard per gestire meglio gli appuntamenti sovrapposti
  const AppointmentCardEnhanced = ({ 
    appointment, 
    onClick, 
    isOverlapping = false,
    index = 0
  }: { 
    appointment: Appointment, 
    onClick: () => void,
    isOverlapping?: boolean,
    index?: number
  }) => {
    const totalLaborHours = getLaborHours(appointment);
    
    // Calcola l'orario di fine
    const durataOre = typeof appointment.duration === 'number' ? appointment.duration : 1;
    const appTime = normalizeTimeFormat(appointment.time);
    const [appHour, appMinute] = appTime.split(':').map(Number);
    const totalMinutes = appHour * 60 + appMinute + (durataOre * 60);
    const endHour = Math.floor(totalMinutes / 60) % 24; // Aggiungiamo modulo 24 per gestire correttamente le ore
    const endMinute = totalMinutes % 60;
    const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    
    // Funzione helper per generare il badge di stato dell'appuntamento
    const statusBadge = (appointment: Appointment) => {
      let badgeClass;
      let label;
      
      switch (appointment.status) {
        case "completato":
          badgeClass = "bg-orange-200 text-orange-800 border border-orange-500 font-semibold";
          label = "Completato";
          break;
        case "annullato":
          badgeClass = "bg-neutral-700 text-white border border-neutral-900 font-semibold";
          label = "Annullato";
          break;
        default:
          badgeClass = "bg-orange-100 text-black border border-orange-300 font-semibold";
          label = "Confermato";
      }
      
      return (
        <span className={`text-xs py-0.5 px-2 rounded inline-block ${badgeClass}`}>
          {label}
        </span>
      );
    };
    
    return (
      <div
        onClick={onClick}
        className={`border-l-4 p-2 mb-1 rounded-md shadow-sm cursor-pointer hover:bg-opacity-90 hover:shadow-md transition-all ${getBorderColor(appointment)}`}
        style={{
          backgroundColor: getBackgroundColor(appointment),
          borderColor: getBorderLeftColor(appointment)
        }}
      >
        <div className="flex-grow">
          <div className="font-semibold text-slate-900 truncate">{appointment.clientName}</div>
          <div className={`font-medium text-[10px] text-slate-900 truncate`}>
            {normalizeTimeFormat(appointment.time)}-{format(endOfAppointment(appointment), 'HH:mm')}
          </div>
          <div className="font-medium text-[9px] bg-orange-600 text-white rounded px-1 w-fit mt-0.5">
            {getLaborHours(appointment)}h
          </div>
          {appointment.plate && (
            <div className="text-xs text-slate-700 truncate mt-0.5 font-medium">
              {appointment.plate}
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between">
          {(() => {
            let badgeClass;
            let label;
            
            switch (appointment.status) {
              case "completato":
                badgeClass = "bg-orange-200 text-orange-800 border border-orange-500 font-semibold";
                label = "Completato";
                break;
              case "annullato":
                badgeClass = "bg-neutral-700 text-white border border-neutral-900 font-semibold";
                label = "Annullato";
                break;
              default:
                badgeClass = "bg-orange-100 text-black border border-orange-300 font-semibold";
                label = "Confermato";
            }
            
            return (
              <span className={`text-xs py-0.5 px-2 rounded inline-block ${badgeClass}`}>
                {label}
              </span>
            );
          })()}
          
          {/* Bottone preventivo più compatto */}
          {appointment.quoteId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleOpenQuotePage(appointment.quoteId as string, e);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white p-1 rounded ml-1 shadow-sm"
              title="Visualizza preventivo"
            >
              <FileText className="h-3 w-3" />
            </button>
          )}
        </div>
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
    // Funzione per aggiornare l'ora corrente
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

  // Funzione per ottenere gli stili colore dell'appuntamento
  const getColorStylesForAppointment = (appointment: Appointment, index: number, isOverlapping: boolean) => {
    // Preleva lo stato dell'appuntamento
    const status = appointment.status || 'programmato';
    
    // Scelgo un colore base in base allo stato
    let baseColor = 'bg-orange-100/90';
    let textColor = 'text-orange-800';
    let borderColor = 'border-orange-200';
    
    // Personalizza i colori in base allo stato
    switch (status) {
      case 'completato':
        baseColor = 'bg-orange-200/90';
        textColor = 'text-orange-800';
        borderColor = 'border-orange-500';
        break;
      case 'programmato':
        baseColor = 'bg-yellow-100/90';
        textColor = 'text-yellow-800';
        borderColor = 'border-yellow-200';
        break;
      case 'annullato':
        baseColor = 'bg-gray-100/90';
        textColor = 'text-gray-800';
        borderColor = 'border-gray-200';
        break;
    }
    
    // Aggiungi variazione per appuntamenti sovrapposti
    if (isOverlapping) {
      const offsetX = index * 3;
      return `${baseColor} ${textColor} ${borderColor} translate-x-${offsetX}`;
    }
    
    return `${baseColor} ${textColor} ${borderColor}`;
  };

  // Funzione per aprire la pagina 4 del preventivo
  const handleOpenQuotePage = (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `/quotes/${quoteId}/edit?page=4`;
  };

  // Se non hai accesso a orders e search, usa array vuoto e stringa vuota
  const ricambiPerTipo = raggruppaPerTipoRicambio([], '', appointments);

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
            {/* Pulsanti di cambio vista */}
            <div className="flex bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "day" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("day")}
              >
                Giorno
              </button>
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "week" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("week")}
              >
                Settimana
              </button>
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "month" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("month")}
              >
                Mese
              </button>
            </div>
            <Button onClick={() => {
              const date = format(selectedDate, 'yyyy-MM-dd');
              onSelectDate(date);
            }} variant="outline" size="sm" className="h-7 gap-1 px-1 text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white border-none hover:text-white">
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">Nuovo</span>
            </Button>
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
                    zIndex: 9999 + (isLongAppointment ? 10 : 0) + Number(overlappingIndex),
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
      <div className="bg-black rounded-lg shadow-md overflow-hidden border border-gray-800">
        <div className="p-2 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedDate(prev => {
                if (!prev) return new Date();
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() - 7);
                return newDate;
              })}
              className="p-1 rounded-full hover:bg-gray-800 text-orange-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-medium text-orange-500 truncate">
              {format(weekDays[0], 'd MMM', { locale: it })} - {format(weekDays[6], 'd MMM yyyy', { locale: it })}
            </h3>
            <button
              onClick={() => setSelectedDate(prev => {
                if (!prev) return new Date();
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() + 7);
                return newDate;
              })}
              className="p-1 rounded-full hover:bg-gray-800 text-orange-500"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1">
            {/* Pulsanti di cambio vista */}
            <div className="flex bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "day" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("day")}
              >
                Giorno
              </button>
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "week" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("week")}
              >
                Settimana
              </button>
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "month" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("month")}
              >
                Mese
              </button>
            </div>
            <Button onClick={() => {
              const date = format(new Date(), 'yyyy-MM-dd');
              onSelectDate(date);
            }} variant="outline" size="sm" className="h-7 gap-1 px-1 text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white border-none hover:text-white">
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">Nuovo</span>
            </Button>
          </div>
        </div>
        
        <div className="border-b border-gray-700 grid grid-cols-8">
          {/* Intestazione vuota per la colonna delle ore */}
          <div className="py-2 border-r border-gray-700"></div>
          
          {/* Intestazioni dei giorni */}
          {weekDays.map((day, dayIndex) => (
            <div 
              key={dayIndex} 
              className={`p-2 text-center border-r border-gray-700 ${isToday(day) ? 'bg-orange-900/30 font-semibold' : ''} hover:bg-gray-800 cursor-pointer transition-colors`}
              onClick={() => handleSelectDate(day)}
            >
              <div className="text-xs font-medium text-gray-300">
                {format(day, 'E', { locale: it })}
              </div>
              <div className={`text-xs font-bold ${isToday(day) ? 'text-orange-500' : 'text-white'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        <div className="h-[600px] overflow-y-auto bg-black">
          <div className="min-h-[600px]">
            {/* Fasce orarie con appuntamenti per ogni giorno */}
            {TIME_SLOTS.map((slot, slotIndex) => (
              <div 
                key={slotIndex}
                className={`grid grid-cols-8 border-b border-gray-700 ${
                  new Date().getHours() === slot.hour && 
                  Math.abs(new Date().getMinutes() - slot.minute) < 30 
                    ? 'bg-orange-900/20' 
                    : slotIndex % 2 === 0 ? 'bg-gray-900/50' : ''
                }`}
                id={new Date().getHours() === slot.hour && 
                   Math.abs(new Date().getMinutes() - slot.minute) < 30 ? "current-time-slot" : ""}
              >
                {/* Colonna dell'ora */}
                <div className="py-1 px-2 text-right text-xs font-medium text-gray-400 border-r border-gray-700 bg-black/40">
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
                      className={`relative min-h-[50px] border-r border-gray-700 p-1 ${
                        isToday(day) ? 'bg-orange-900/10' : ''
                      } hover:bg-gray-800/50 transition-colors`}
                      onClick={() => {
                        // Quando si clicca su uno slot vuoto, crea un nuovo appuntamento
                        if (slotAppointments.length === 0) {
                          const date = format(day, 'yyyy-MM-dd');
                          onSelectDate(`${date}T${slot.label}`);
                        }
                      }}
                    >
                      {/* Logica per mostrare gli appuntamenti */}
                      {slotAppointments.length > 0 ? (
                        <div className="h-full w-full relative flex flex-row gap-1">
                          {slotAppointments
                            .slice(0, 2) // Limita a massimo 2 appuntamenti visibili per slot
                            .map((appointment, idx) => isStartingSlot[appointment.id] && (
                            <div 
                              key={appointment.id}
                              className="absolute shadow-sm cursor-pointer hover:shadow-md transition-all"
                              style={{
                                backgroundColor: getBackgroundColor(appointment),
                                borderLeft: `3px solid ${getBorderLeftColor(appointment)}`,
                                // Altezza fissa per Kevin Paride Miranda 
                                height: `${Math.max(50, Math.ceil(getLaborHours(appointment) * 2) * 50)}px`,
                                width: slotAppointments.length > 1 ? `${94 / Math.min(slotAppointments.length, 2)}%` : '94%',
                                left: slotAppointments.length > 1 ? `${(idx * (94 / Math.min(slotAppointments.length, 2))) + 3}%` : '3%',
                                fontSize: '0.65rem',
                                overflow: 'hidden',
                                borderRadius: '2px',
                                padding: '2px 4px',
                                zIndex: 10
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectAppointment(appointment);
                              }}
                            >
                              <div className="font-bold text-slate-900 truncate text-xs">{appointment.clientName}</div>
                              <div className="font-medium text-[10px] text-slate-900 truncate">
                                {normalizeTimeFormat(appointment.time)}-{format(endOfAppointment(appointment), 'HH:mm')}
                              </div>
                              <div className="font-medium text-[9px] bg-orange-600 text-white rounded px-1 w-fit mt-0.5">
                                {getLaborHours(appointment)}h
                              </div>
                            </div>
                          ))}
                          {slotAppointments.length > 2 && (
                            <div className="absolute right-0 top-0 px-1 py-0.5 bg-orange-700 text-white text-[8px] rounded-sm font-bold z-20">
                              +{slotAppointments.length - 2}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
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
      <div className="bg-black rounded-lg shadow-md overflow-hidden border border-gray-800">
        <div className="p-2 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedDate(prev => {
                if (!prev) return new Date();
                const newDate = new Date(prev);
                newDate.setMonth(newDate.getMonth() - 1);
                return newDate;
              })}
              className="p-1 rounded-full hover:bg-gray-800 text-orange-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-medium text-orange-500">
              {format(selectedDate, 'MMMM yyyy', { locale: it })}
            </h3>
            <button
              onClick={() => setSelectedDate(prev => {
                if (!prev) return new Date();
                const newDate = new Date(prev);
                newDate.setMonth(newDate.getMonth() + 1);
                return newDate;
              })}
              className="p-1 rounded-full hover:bg-gray-800 text-orange-500"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1">
            {/* Pulsanti di cambio vista */}
            <div className="flex bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "day" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("day")}
              >
                Giorno
              </button>
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "week" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("week")}
              >
                Settimana
              </button>
              <button 
                className={`px-2 py-1 text-xs font-medium ${view === "month" ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setView("month")}
              >
                Mese
              </button>
            </div>
            <Button onClick={() => {
              const date = format(new Date(), 'yyyy-MM-dd');
              onSelectDate(date);
            }} variant="outline" size="sm" className="h-7 gap-1 px-1 text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white border-none hover:text-white">
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">Nuovo</span>
            </Button>
          </div>
        </div>

        {/* Griglia mensile */}
        <div className="p-2">
          {/* Intestazione giorni della settimana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, index) => (
              <div key={index} className="text-center font-medium text-xs p-1 text-gray-400">
                {day}
              </div>
            ))}
          </div>
          
          {/* Griglia dei giorni */}
          <div className="grid grid-cols-7 gap-1">
            {/* Genera i giorni precedenti (del mese scorso) per riempire la prima settimana */}
            {Array.from({ length: getDay(monthStart) || 7 }).map((_, index) => {
              // Calcola la data effettiva per questo giorno del mese precedente
              const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0 - (index - 1));
              return (
                <div 
                  key={`prev-${index}`} 
                  className="min-h-[60px] p-1 border border-gray-700 rounded-md bg-gray-900/30 text-gray-600"
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
                  className={`min-h-[60px] p-1 border border-gray-700 rounded-md ${
                    isCurrentDay ? 'bg-orange-900/30 border-orange-600' : 'hover:bg-gray-800/70 bg-gray-900/60'
                  }`}
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
                      className="min-h-[60px] p-1 border border-gray-700 rounded-md bg-gray-900/30 text-gray-600"
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
      </div>
    );
  }

  return null;
}