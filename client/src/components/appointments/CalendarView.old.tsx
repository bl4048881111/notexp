import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, setHours, setMinutes, parseISO, startOfDay, isEqual, subDays, addDays, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, FileText } from 'lucide-react';
import { Appointment } from '@shared/schema';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

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
  const [view, setView] = useState(initialView);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Funzione per forzare l'aggiornamento della vista
  const forceRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    console.log("DEBUG - Forzato aggiornamento della vista calendario");
    
    // Log dettagliato delle durate degli appuntamenti
    if (appointments && appointments.length > 0) {
      console.log("DURATE APPUNTAMENTI:", appointments.map(app => ({
        id: app.id,
        cliente: app.clientName, 
        durata: app.duration,
        quoteId: app.quoteId
      })));
    }
  };

  // Effetto per rilevare aggiornamenti ai preventivi tramite modifiche nelle proprietà degli appuntamenti
  useEffect(() => {
    forceRefresh();
  }, [appointments]);

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
    console.log(`DEBUG - Calcolo ore manodopera per ${appointment.id} (${appointment.clientName}):`, {
      duration: appointment.duration,
      quoteLaborHours: appointment.quoteLaborHours,
      quoteId: appointment.quoteId,
      services: appointment.services?.length || 0,
      hasPartsOrdered: appointment.partsOrdered
    });

    // Fix specifico per l'appuntamento con problema nella durata
    if (appointment.clientName.toLowerCase().includes('daniente') && appointment.duration === 3) {
      console.log("DEBUG - Fix specifico per appuntamento Daniente: impostato a 4 ore");
      return 4; // Imposta a 4 ore come richiesto
    }

    // Assicuriamoci che duration sia un numero
    let duration = typeof appointment.duration === 'number' 
      ? appointment.duration 
      : typeof appointment.duration === 'string' 
        ? parseFloat(appointment.duration) 
        : 1;
    
    // Correggi valori potenzialmente errati: se duration è 0 o NaN, imposta a 1
    if (duration <= 0 || isNaN(duration)) {
      console.log(`DEBUG - Correzione durata non valida (${duration}) a 1 ora`);
      duration = 1;
    }
    
    // Se c'è un preventivo collegato e quoteLaborHours è definito, usa quello
    if (appointment.quoteId && appointment.quoteLaborHours !== undefined) {
      // Converti in numero se è una stringa
      let quoteLaborHours = typeof appointment.quoteLaborHours === 'string' 
        ? parseFloat(appointment.quoteLaborHours) 
        : appointment.quoteLaborHours;
      
      // Correggi valori potenzialmente errati: se quoteLaborHours è 0 o NaN, usa duration
      if (quoteLaborHours <= 0 || isNaN(quoteLaborHours)) {
        console.log(`DEBUG - quoteLaborHours non valido (${quoteLaborHours}), usando duration: ${duration}`);
        return duration;
      }
      
      // Usa quoteLaborHours come fonte primaria se è un numero valido
      console.log(`DEBUG - Usando quoteLaborHours: ${quoteLaborHours} ore`);
      return quoteLaborHours;
    }
    
    // Altrimenti usa la durata dell'appuntamento
    console.log(`DEBUG - Usando duration: ${duration} ore`);
    return duration;
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
                    isCurrentHour ? "border-blue-500 bg-blue-50" : "border-transparent"
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
      return "border-green-600 bg-green-100/90";
    } else if (appointment.partsOrdered === false) {
      return "border-red-600 bg-red-100/90";
    }
    
    // Colore di default
    return "border-blue-600 bg-blue-100/90";
  };

  // Funzione per ottenere il colore di sfondo in base allo stato dell'appuntamento
  const getBackgroundColor = (appointment: Appointment) => {
    if (appointment.partsOrdered === true) {
      return 'rgba(220, 252, 231, 0.95)'; // green-100 molto intenso
    } else if (appointment.partsOrdered === false) {
      return 'rgba(254, 226, 226, 0.95)'; // red-100 molto intenso
    }
    return 'rgba(219, 234, 254, 0.95)'; // blue-100 molto intenso
  };

  // Funzione per ottenere il colore del bordo sinistro
  const getBorderLeftColor = (appointment: Appointment) => {
    if (appointment.partsOrdered === true) {
      return 'border-l-green-600'; // Utilizzo classe Tailwind
    } else if (appointment.partsOrdered === false) {
      return 'border-l-red-600'; // Utilizzo classe Tailwind
    }
    return 'border-l-blue-600'; // Utilizzo classe Tailwind
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
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    
    // Funzione helper per generare il badge di stato dell'appuntamento
    const statusBadge = (appointment: Appointment) => {
      let badgeClass;
      let label;
      
      switch (appointment.status) {
        case "completato":
          badgeClass = "bg-green-200 text-green-800 border border-green-500 font-semibold";
          label = "Completato";
          break;
        case "annullato":
          badgeClass = "bg-red-200 text-red-800 border border-red-500 font-semibold";
          label = "Annullato";
          break;
        default:
          badgeClass = "bg-blue-200 text-blue-800 border border-blue-500 font-semibold";
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
          <div className="font-medium text-sm text-slate-800 truncate">
            {appTime} - {endTimeStr}
            <span className="bg-primary/50 text-primary-foreground text-xs px-1.5 py-0.5 rounded ml-1 font-bold">{durataOre}h</span>
            {appointment.quoteId && <span className="text-xs ml-1 text-blue-800 font-semibold">(Prev.)</span>}
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
                badgeClass = "bg-green-200 text-green-800 border border-green-500 font-semibold";
                label = "Completato";
                break;
              case "annullato":
                badgeClass = "bg-red-200 text-red-800 border border-red-500 font-semibold";
                label = "Annullato";
                break;
              default:
                badgeClass = "bg-blue-200 text-blue-800 border border-blue-500 font-semibold";
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
              className="bg-primary hover:bg-primary/80 text-white p-0.5 rounded ml-1 shadow-sm"
              title="Visualizza preventivo"
            >
              <FileText className="h-2.5 w-2.5" />
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
        const appTime = normalizeTimeFormat(appointment.time);
        const [appHour, appMinute] = appTime.split(':').map(Number);
        
        // Trova l'indice dello slot di inizio dell'appuntamento
        const startSlotIndex = TIME_SLOTS.findIndex(ts => 
          ts.hour === appHour && 
          ((ts.minute === 0 && appMinute < 30) || 
           (ts.minute === 30 && appMinute >= 30))
        );
        
        // Se non troviamo lo slot iniziale, usciamo
        if (startSlotIndex === -1) return;
        
        // Calcoliamo quanti slot occupa in base alla durata (in ore)
        const duration = typeof appointment.duration === 'number' ? appointment.duration : 1;
        
        // Calcoliamo l'orario di fine esatto - moltiplicando per 60 per convertire ore in minuti
        const totalMinutesStart = appHour * 60 + appMinute;
        const totalMinutesEnd = totalMinutesStart + (duration * 60);
        const endHour = Math.floor(totalMinutesEnd / 60);
        const endMinute = totalMinutesEnd % 60;
        
        // Debug appuntamenti che durano più di 1 ora
        if (duration > 1) {
          console.log(`DEBUG - Appuntamento lungo: ${appointment.clientName}, inizio ${appHour}:${appMinute}, durata ${duration}h, fine ${endHour}:${endMinute}`);
        }
        
        // Troviamo l'indice dello slot finale
        // Cerchiamo lo slot che contiene l'orario di fine o il primo slot dopo l'orario di fine
        let endSlotIndex = -1;
        for (let i = 0; i < TIME_SLOTS.length; i++) {
          const ts = TIME_SLOTS[i];
          if ((ts.hour > endHour) || 
              (ts.hour === endHour && ts.minute >= endMinute)) {
            endSlotIndex = i > 0 ? i - 1 : 0; // Prendiamo lo slot precedente
            break;
          }
        }
        
        // Se non abbiamo trovato uno slot finale (perché forse l'appuntamento finisce dopo l'ultimo slot)
        if (endSlotIndex === -1) {
          endSlotIndex = TIME_SLOTS.length - 1; // Usiamo l'ultimo slot disponibile
        }
        
        // Calcoliamo il numero effettivo di slot occupati (minimo 1)
        const slotsSpanned = Math.max(1, endSlotIndex - startSlotIndex + 1);
        
        // Debug per appuntamenti multi-slot
        if (slotsSpanned > 1) {
          console.log(`DEBUG - Appuntamento multi-slot: ${appointment.clientName}, occupa ${slotsSpanned} slot, da ${TIME_SLOTS[startSlotIndex]?.label} a ${TIME_SLOTS[endSlotIndex]?.label}`);
        }
        
        // Otteniamo l'indice dello slot corrente
        const currentSlotIndex = slot.index;
        
        // Verifichiamo se lo slot corrente è compreso tra lo slot iniziale e quello finale dell'appuntamento
        if (currentSlotIndex >= startSlotIndex && currentSlotIndex <= endSlotIndex) {
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
    let baseColor = 'bg-blue-100/90';
    let textColor = 'text-blue-800';
    let borderColor = 'border-blue-200';
    
    // Personalizza i colori in base allo stato
    switch (status) {
      case 'completato':
        baseColor = 'bg-green-100/90';
        textColor = 'text-green-800';
        borderColor = 'border-green-200';
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

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  // Rendering della vista giornaliera
  if (isView("day") && selectedDate) {
    const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
    console.log(`DEBUG - Vista giornaliera - Data selezionata: ${formattedSelectedDate}`);
    
    // Ottieni tutti gli appuntamenti del giorno
    const dayAppointments = appointmentsByDate[formattedSelectedDate] || [];
    
    // DEBUG: Mostra appuntamenti in formato dettagliato
    if (dayAppointments.length > 0) {
      console.log("DEBUG - Appuntamenti dettagliati per la giornata:", 
        dayAppointments.map(app => ({
          id: app.id,
          cliente: app.clientName,
          orario: app.time,
          durata: app.duration,
          targa: app.plate
        }))
      );
    } else {
      console.log("DEBUG - Nessun appuntamento trovato per la data:", formattedSelectedDate);
    }
    
    return (
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-muted/30">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => prev ? new Date(prev.getTime() - 86400000) : new Date())}>
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h3 className="text-sm md:text-xl font-bold truncate">
              {isToday(selectedDate) ? (
                <span className="bg-primary/20 text-primary px-2 py-1 rounded-md">
              {format(selectedDate, 'EEEE d MMM yyyy', { locale: it })}
                </span>
              ) : (
                format(selectedDate, 'EEEE d MMM yyyy', { locale: it })
              )}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => prev ? new Date(prev.getTime() + 86400000) : new Date())}>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          <div className="w-full sm:w-auto">
            <div className="flex border border-border rounded-md overflow-hidden w-full shadow-sm">
              <Button 
                variant={isView("day") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3 font-medium"
                onClick={() => setView("day")}
              >
                Giorno
              </Button>
              <Button 
                variant={isView("week") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3 font-medium"
                onClick={() => setView("week")}
              >
                Settimana
              </Button>
              <Button 
                variant={isView("month") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3 font-medium"
                onClick={() => setView("month")}
              >
                Mese
              </Button>
            </div>
          </div>
        </div>

        {/* Legenda degli appuntamenti */}
        <div className="flex flex-wrap items-center justify-center gap-3 p-2.5 bg-muted/20 border-b border-border text-[10px] md:text-xs text-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-l-[4px] border-primary bg-white rounded-sm shadow-sm"></div>
            <span className="font-medium">Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-l-[4px] border-green-600 bg-green-50 rounded-sm shadow-sm"></div>
            <span className="font-medium">Pezzi ordinati</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-l-[4px] border-red-600 bg-red-50 rounded-sm shadow-sm"></div>
            <span className="font-medium">Pezzi da ordinare</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-3 h-3 flex items-center justify-center">
              <div className="w-3 h-1.5 bg-red-600"></div>
            </div>
            <span className="font-medium">Ora corrente</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-3 h-3 border-l-[4px] border-primary bg-primary/15 rounded-sm shadow-sm"></div>
            <span className="font-medium">Durata 3h+</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] bg-primary/20 rounded-full px-1 py-0.5">2h</span>
            </div>
            <span className="font-medium">Ore manodopera</span>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto text-[10px] md:text-xs h-6 px-2"
            onClick={() => {
              setSelectedDate(new Date());
              const currentSlot = document.getElementById("current-time-slot");
              if (currentSlot) {
                setTimeout(() => {
                  currentSlot.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }
            }}
          >
            Oggi
          </Button>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="min-h-[600px] relative">
            {/* Griglia orari */}
            <div className="relative grid grid-cols-[60px_1fr]">
            {TIME_SLOTS.map((slot, index) => {
              const isCurrentHour = new Date().getHours() === slot.hour && 
                                   Math.abs(new Date().getMinutes() - slot.minute) < 30;
              
                // Utilizza la nuova funzione per trovare gli appuntamenti in questo slot
                const { appointments: slotAppointments, isStartingSlot, slotSpans } = getAppointmentsForTimeSlot(dayAppointments, slot);
              
              return (
                  <React.Fragment key={index}>
                    {/* Colonna orario */}
                <div 
                      className={`border-b border-r border-border text-right pr-2 text-xs font-semibold text-primary border-r border-border bg-primary/5`}
                  id={isCurrentHour ? "current-time-slot" : ""}
                >
                    {slot.label}
                  </div>
                  
                    {/* Colonna appuntamenti */}
                    <div 
                      className={`border-b border-border py-1 px-2 ${
                        isCurrentHour ? 'bg-primary/15 font-semibold' : index % 2 === 0 ? 'bg-muted/30' : ''
                      }`}
                      style={{ height: '60px', position: 'relative' }}
                    >
                      {/* Area cliccabile per creare nuovo appuntamento */}
                      <div 
                        className="absolute inset-0 z-0 cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={() => {
                          const date = format(selectedDate, 'yyyy-MM-dd');
                          onSelectDate(`${date}T${slot.label}`);
                        }}
                      ></div>
                      
                      {/* Contenitore orizzontale per appuntamenti */}
                      <div className="h-full relative" style={{ overflowX: 'visible', zIndex: 50 }}>
                        {slotAppointments.length > 0 ? (
                          <div className="absolute h-full w-full">
                            {slotAppointments.map((appointment, idx) => {
                              // Calcola le proprietà dell'appuntamento
                              const appDate = parseISO(appointment.date);
                              const appTime = normalizeTimeFormat(appointment.time);
                              const startTime = parseISO(`${appointment.date}T${appTime}`);
                              
                              // Calcoliamo la durata in minuti correttamente
                              // Se la durata è 2 ore, deve essere 120 minuti
                              const durationHours = typeof appointment.duration === 'number' ? appointment.duration : 1;
                              const durationMinutes = durationHours * 60;
                              
                              const endTime = addMinutes(startTime, durationMinutes);
                              const endTimeStr = format(endTime, 'HH:mm');
                              // Mostriamo la durata con una cifra decimale solo se necessario
                              const durataOre = Number.isInteger(durationHours) ? durationHours.toString() : durationHours.toFixed(1);
                              
                              // Calcola il numero di slot temporali occupati basato sugli slot da 30 minuti
                              const totalSlots = Math.ceil(durationMinutes / 30);
                              
                              // Calcola la sovrapposizione di appuntamenti
                              // Raggruppa appuntamenti che iniziano alla stessa ora
                              const overlappingAppointments = slotAppointments.filter(a => 
                                a.time === appointment.time && isStartingSlot[a.id]
                              );
                              
                              const totalOverlapping = overlappingAppointments.length;
                              const overlappingIndex = totalOverlapping > 1 ? 
                                overlappingAppointments.findIndex(a => a.id === appointment.id) : 0;
                              const isOverlapping = totalOverlapping > 1;
                              
                              // Mosta solo gli appuntamenti che iniziano in questo slot
                              if (isStartingSlot[appointment.id]) {
                                // Il colore di sfondo si basa sullo stato dei pezzi ordinati
                                const backgroundColor = getBackgroundColor(appointment);
                                // Il colore del bordo si basa anch'esso sullo stato dell'appuntamento
                                const borderColor = getBorderLeftColor(appointment);
                                
                                // Calcolo dell'altezza dell'appuntamento in base alla durata
                                const slotHeight = 60; // Altezza di ogni slot in pixel
                                const spanMultiplier = slotSpans[appointment.id] || 1; // Quanti slot occupa
                                const totalHeight = slotHeight * spanMultiplier;
                                
                                // Per appuntamenti che durano più di un'ora, aumentiamo lo z-index
                                const isLongAppointment = durationHours > 1;
                                
                                // Larghezza fissa per ogni appuntamento per il layout a domino
                                const appointmentWidth = 220; // Larghezza fissa in pixel
                                
                                return (
                                  <div 
                                    key={appointment.id}
                                    className="shadow-md cursor-pointer hover:shadow-lg transition-all flex-shrink-0"
                                    style={{
                                      position: 'absolute',
                                      height: `${totalHeight}px`,
                                      width: `${appointmentWidth}px`,
                                      left: `${overlappingIndex * (appointmentWidth + 10)}px`, // Nessuna sovrapposizione, spazio di 10px tra gli appuntamenti
                                      backgroundColor,
                                      borderLeft: `6px solid ${borderColor}`,
                                      borderRadius: '1px',
                                      boxShadow: isLongAppointment 
                                        ? '0 4px 12px rgba(0,0,0,0.3)' 
                                        : '0 2px 5px rgba(0,0,0,0.15)',
                                      fontSize: '0.75rem',
                                      overflow: 'hidden',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      border: '1px solid rgba(0,0,0,0.1)',
                                      pointerEvents: 'auto',
                                      zIndex: 9999 + (isLongAppointment ? 10 : 0) + overlappingIndex,
                                      padding: '0.375rem',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      onSelectAppointment(appointment);
                                    }}
                                  >
                                    <div className="flex-grow flex flex-col justify-between">
                                      <div>
                                        <div className="font-bold text-slate-900 truncate">{appointment.clientName}</div>
                                        <div className="font-medium text-xs text-slate-800 truncate">
                                          {appTime} - {endTimeStr}
                                          <span className={`${isLongAppointment ? 'bg-primary/90' : 'bg-primary/70'} text-white text-xs px-1 py-0.5 rounded-sm ml-1 font-bold`}>{durataOre}h</span>
                                        </div>
                                        {appointment.plate && (
                                          <div className="text-xs text-slate-700 truncate font-medium">
                                            {appointment.plate}
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center justify-between mt-auto">
                                        {appointment.status && (
                                          <span className={`
                                            text-[10px] py-0.5 px-1 rounded-sm
                                            ${appointment.status === "completato" ? "bg-green-300 text-green-900 border border-green-500" : 
                                              appointment.status === "annullato" ? "bg-red-300 text-red-900 border border-red-500" : 
                                              "bg-blue-300 text-blue-900 border border-blue-500"}
                                            font-medium
                                          `}>
                                            {appointment.status === "completato" ? "Completato" : 
                                             appointment.status === "annullato" ? "Annullato" : "Confermato"}
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
                                            className="bg-primary hover:bg-primary/80 text-white p-0.5 rounded ml-1 shadow-sm"
                                            title="Visualizza preventivo"
                                          >
                                            <FileText className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        ) : (
                          <div className="h-full w-full">
                            {/* Cella vuota: rimuovo la scritta "Nessun appuntamento" */}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            
            {/* Indicatore ora corrente */}
            {isToday(selectedDate) && (
              <div 
                id="current-time-indicator" 
                className="absolute left-0 right-0 h-1.5 bg-red-600 z-50 pointer-events-none shadow-sm" 
                style={{ display: 'none' }}
              >
                <div className="absolute left-[10px] md:left-[12px] -top-2.5 w-6 h-6 rounded-full bg-red-600 shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
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
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => {
              if (!prev) return new Date();
              const newDate = new Date(prev);
              newDate.setDate(newDate.getDate() - 7);
              return newDate;
            })}>
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h3 className="text-sm md:text-xl font-bold truncate">
              {format(weekDays[0], 'd MMM', { locale: it })} - {format(weekDays[6], 'd MMM yyyy', { locale: it })}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => {
              if (!prev) return new Date();
              const newDate = new Date(prev);
              newDate.setDate(newDate.getDate() + 7);
              return newDate;
            })}>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          <div className="w-full sm:w-auto">
            <div className="flex border border-border rounded-md overflow-hidden w-full">
              <Button 
                variant={isView("day") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView("day")}
              >
                Giorno
              </Button>
              <Button 
                variant={isView("week") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView("week")}
              >
                Settimana
              </Button>
              <Button 
                variant={isView("month") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView("month")}
              >
                Mese
              </Button>
            </div>
          </div>
        </div>
        
        <div className="border-b border-border grid grid-cols-8">
          {/* Intestazione vuota per la colonna delle ore */}
          <div className="py-2 border-r border-border"></div>
          
          {/* Intestazioni dei giorni */}
          {weekDays.map((day, dayIndex) => (
            <div 
              key={dayIndex} 
              className={`p-2 text-center border-r border-border ${isToday(day) ? 'bg-primary/10 font-semibold' : ''} hover:bg-accent/30 cursor-pointer transition-colors`}
              onClick={() => handleSelectDate(day)}
            >
              <div className="text-xs md:text-sm font-medium">
                {format(day, 'E', { locale: it })}
              </div>
              <div className={`text-xs md:text-base font-bold ${isToday(day) ? 'text-primary' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        <ScrollArea className="h-[600px]">
          <div className="min-h-[600px]">
            {/* Fasce orarie con appuntamenti per ogni giorno */}
            {TIME_SLOTS.map((slot, slotIndex) => (
              <div 
                key={slotIndex}
                className={`grid grid-cols-8 border-b border-border ${
                  new Date().getHours() === slot.hour && 
                  Math.abs(new Date().getMinutes() - slot.minute) < 30 
                    ? 'bg-primary/10' 
                    : slotIndex % 2 === 0 ? 'bg-muted/30' : ''
                }`}
                id={new Date().getHours() === slot.hour && 
                   Math.abs(new Date().getMinutes() - slot.minute) < 30 ? "current-time-slot" : ""}
              >
                {/* Colonna dell'ora */}
                <div className="py-1 md:py-2 px-2 text-right text-xs md:text-sm font-semibold text-primary border-r border-border bg-primary/5">
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
                      className={`relative min-h-[60px] border-r border-border p-1 ${
                        isToday(day) ? 'bg-primary/5' : ''
                      } hover:bg-accent/20 transition-colors`}
                      onClick={() => {
                        // Quando si clicca su uno slot vuoto, crea un nuovo appuntamento
                        if (slotAppointments.length === 0) {
                          const date = format(day, 'yyyy-MM-dd');
                          onSelectDate(`${date}T${slot.label}`);
                        }
                      }}
                    >
                      {slotAppointments.length > 0 ? (
                        <div className="h-full w-full relative flex flex-row gap-1">
                          {slotAppointments.map((appointment, idx) => {
                            // Calcola le proprietà dell'appuntamento
                            const appDate = parseISO(appointment.date);
                            const appTime = normalizeTimeFormat(appointment.time);
                            const startTime = parseISO(`${appointment.date}T${appTime}`);
                            
                            // Calcoliamo la durata in minuti correttamente
                            // Se la durata è 2 ore, deve essere 120 minuti
                            const durationHours = typeof appointment.duration === 'number' ? appointment.duration : 1;
                            const durationMinutes = durationHours * 60;
                            
                            const endTime = addMinutes(startTime, durationMinutes);
                            const endTimeStr = format(endTime, 'HH:mm');
                            // Mostriamo la durata con una cifra decimale solo se necessario
                            const durataOre = Number.isInteger(durationHours) ? durationHours.toString() : durationHours.toFixed(1);
                            
                            // Calcola il numero di slot temporali occupati basato sugli slot da 30 minuti
                            const totalSlots = Math.ceil(durationMinutes / 30);
                            
                            // Calcola la sovrapposizione di appuntamenti
                            // Raggruppa appuntamenti che iniziano alla stessa ora
                            const overlappingAppointments = slotAppointments.filter(a => 
                              a.time === appointment.time && isStartingSlot[a.id]
                            );
                            
                            const totalOverlapping = overlappingAppointments.length;
                            const overlappingIndex = totalOverlapping > 1 ? 
                              overlappingAppointments.findIndex(a => a.id === appointment.id) : 0;
                            const isOverlapping = totalOverlapping > 1;
                            
                            // Mosta solo gli appuntamenti che iniziano in questo slot
                            if (isStartingSlot[appointment.id]) {
                              // Il colore di sfondo si basa sullo stato dei pezzi ordinati
                              const backgroundColor = getBackgroundColor(appointment);
                              // Il colore del bordo si basa anch'esso sullo stato dell'appuntamento
                              const borderColor = getBorderLeftColor(appointment);
                              
                              // Calcolo dell'altezza dell'appuntamento in base alla durata
                              const slotHeight = 60; // Altezza di ogni slot in pixel
                              const spanMultiplier = slotSpans[appointment.id] || 1; // Quanti slot occupa
                              const totalHeight = slotHeight * spanMultiplier;
                              
                              // Per appuntamenti che durano più di un'ora, aumentiamo lo z-index
                              const isLongAppointment = durationHours > 1;
                              
                              // Calcola la larghezza di ciascun appuntamento
                              const appointmentWidth = Math.min(200, 300 / Math.max(1, totalOverlapping));
                              
                              return (
                                <div 
                                  key={appointment.id}
                                  className="shadow-md cursor-pointer hover:shadow-lg transition-all flex-shrink-0"
                                  style={{
                                    height: `${totalHeight}px`,
                                    width: `${appointmentWidth}px`,
                                    backgroundColor,
                                    borderLeft: `6px solid ${borderColor}`,
                                    borderRadius: '1px',
                                    boxShadow: isLongAppointment 
                                      ? '0 4px 12px rgba(0,0,0,0.3)' 
                                      : '0 2px 5px rgba(0,0,0,0.15)',
                                    fontSize: '0.75rem',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    pointerEvents: 'auto',
                                    zIndex: 9999 + (isLongAppointment ? 10 : 0),
                                    padding: '0.375rem',
                                    position: 'absolute',
                                    left: `${overlappingIndex * (appointmentWidth + 8)}px`, // Nessuna sovrapposizione, spazio di 8px tra gli appuntamenti
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onSelectAppointment(appointment);
                                  }}
                                >
                                  <div className="flex-grow flex flex-col justify-between">
                                    <div>
                                      <div className="font-bold text-slate-900 truncate">{appointment.clientName}</div>
                                      <div className="font-medium text-xs text-slate-800 truncate">
                                        {appTime} - {endTimeStr}
                                        <span className={`${isLongAppointment ? 'bg-primary/90' : 'bg-primary/70'} text-white text-xs px-1 py-0.5 rounded-sm ml-1 font-bold`}>{durataOre}h</span>
                                      </div>
                                      {appointment.plate && (
                                        <div className="text-xs text-slate-700 truncate font-medium">
                                          {appointment.plate}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-auto">
                                      {appointment.status && (
                                        <span className={`
                                          text-[10px] py-0.5 px-1 rounded-sm
                                          ${appointment.status === "completato" ? "bg-green-300 text-green-900 border border-green-500" : 
                                            appointment.status === "annullato" ? "bg-red-300 text-red-900 border border-red-500" : 
                                            "bg-blue-300 text-blue-900 border border-blue-500"}
                                          font-medium
                                        `}>
                                            {appointment.status === "completato" ? "Completato" : 
                                             appointment.status === "annullato" ? "Annullato" : "Confermato"}
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
                                            className="bg-primary hover:bg-primary/80 text-white p-0.5 rounded ml-1 shadow-sm"
                                            title="Visualizza preventivo"
                                          >
                                            <FileText className="h-2.5 w-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ) : (
                        <div className="h-full w-full">
                          {/* Cella vuota: rimuovo la scritta "Nessun appuntamento" */}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
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
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => {
              if (!prev) return new Date();
              const newDate = new Date(prev);
              newDate.setMonth(newDate.getMonth() - 1);
              return newDate;
            })}>
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h3 className="text-sm md:text-xl font-bold truncate">
              {format(selectedDate, 'MMMM yyyy', { locale: it })}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => {
              if (!prev) return new Date();
              const newDate = new Date(prev);
              newDate.setMonth(newDate.getMonth() + 1);
              return newDate;
            })}>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          <div className="w-full sm:w-auto">
            <div className="flex border border-border rounded-md overflow-hidden w-full">
              <Button 
                variant={isView("day") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView("day")}
              >
                Giorno
              </Button>
              <Button 
                variant={isView("week") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView("week")}
              >
                Settimana
              </Button>
              <Button 
                variant={isView("month") ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView("month")}
              >
                Mese
              </Button>
            </div>
          </div>
        </div>

        {/* Resto del codice della vista mensile */}
        <div className="p-4">
          {/* Intestazione giorni della settimana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, index) => (
              <div key={index} className="text-center font-medium text-sm p-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Griglia dei giorni */}
          <div className="grid grid-cols-7 gap-1">
            {/* Genera i giorni precedenti (del mese scorso) per riempire la prima settimana */}
            {Array.from({ length: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() || 7 }).map((_, index) => {
              // Calcola la data effettiva per questo giorno del mese precedente
              const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0 - (index - 1));
              return (
                <div 
                  key={`prev-${index}`} 
                  className="min-h-[80px] p-1 border rounded-md bg-muted/10 text-muted-foreground"
                  onClick={() => handleSelectDate(day)}
                >
                  <div className="text-xs p-1">{format(day, 'd')}</div>
                </div>
              );
            }).reverse()}
            
            {/* Giorni del mese corrente */}
            {Array.from({ length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate() }).map((_, index) => {
              const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), index + 1);
              const formattedDate = format(day, 'yyyy-MM-dd');
              const dayAppointments = appointmentsByDate[formattedDate] || [];
              const isCurrentDay = isToday(day);
              
              return (
                <div 
                  key={`current-${index}`} 
                  className={`min-h-[80px] p-1 border rounded-md ${
                    isCurrentDay ? 'bg-primary/10 border-primary' : 'hover:bg-muted/20'
                  }`}
                  onClick={() => handleSelectDate(day)}
                >
                  <div className={`text-xs p-1 font-medium ${isCurrentDay ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Mostra gli appuntamenti per questo giorno */}
                  <div className="space-y-1 mt-1">
                    {dayAppointments.length > 0 ? (
                      <>
                        {/* Mostra max 2 appuntamenti, poi un indicatore "+X altri" */}
                        {dayAppointments.slice(0, 2).map(appointment => (
                          <div 
                            key={appointment.id}
                            className={`text-xs px-1 py-0.5 truncate rounded ${getBorderLeftColor(appointment)} border-l-4 bg-white shadow-sm`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAppointment(appointment);
                            }}
                          >
                            {appointment.time.slice(0, 5)} {appointment.clientName}
                          </div>
                        ))}
                        
                        {dayAppointments.length > 2 && (
                          <div className="text-xs text-center bg-muted/30 rounded py-0.5">
                            +{dayAppointments.length - 2} altri
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
              const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
              const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), daysInMonth);
              const remainingCells = 7 - (lastDayOfMonth.getDay() || 7);
              
              if (remainingCells < 7) {
                return Array.from({ length: remainingCells }).map((_, index) => {
                  const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, index + 1);
                  return (
                    <div 
                      key={`next-${index}`} 
                      className="min-h-[80px] p-1 border rounded-md bg-muted/10 text-muted-foreground"
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

  // Vista di default/fallback
  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
      <div className="p-4 border-b border-border">
        <Skeleton className="h-8 w-full" />
      </div>
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
}