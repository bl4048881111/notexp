import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, setHours, setMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Appointment } from '@shared/schema';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

// Definizione tipo di vista per il calendario
enum ViewType {
  Day = "day",
  Week = "week",
  Month = "month"
}
// Variabile di tipo stringa per utilizzare l'enum nei confronti
type ViewTypeString = "day" | "week" | "month";

// Definizione delle fasce orarie (dalle 8 alle 19)
const TIME_SLOTS = Array.from({ length: 22 }, (_, i) => ({
  hour: Math.floor((8 * 60 + i * 30) / 60),
  minute: (8 * 60 + i * 30) % 60,
  label: format(
    setMinutes(setHours(new Date(), Math.floor((8 * 60 + i * 30) / 60)), (8 * 60 + i * 30) % 60),
    'HH:mm',
    { locale: it }
  )
}));

interface CalendarViewProps {
  appointments: Appointment[];
  isLoading: boolean;
  onSelectDate: (date: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}

export default function CalendarView({ 
  appointments, 
  isLoading, 
  onSelectDate,
  onSelectAppointment
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [view, setView] = useState<ViewType>(ViewType.Day);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

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
    if (view === ViewType.Month) {
      setView(ViewType.Day);
    }
  };

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    return appointments.reduce((acc, appointment) => {
      const date = appointment.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(appointment);
      return acc;
    }, {} as Record<string, Appointment[]>);
  }, [appointments]);
  
  // Group appointments by time slot for day view
  const appointmentsByTimeSlot = useMemo(() => {
    if (!selectedDate) return {};
    
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const dayAppointments = appointmentsByDate[formattedDate] || [];
    
    return dayAppointments.reduce((acc, appointment) => {
      const timeKey = appointment.time.substring(0, 5); // Formato HH:mm
      if (!acc[timeKey]) {
        acc[timeKey] = [];
      }
      acc[timeKey].push(appointment);
      return acc;
    }, {} as Record<string, Appointment[]>);
  }, [selectedDate, appointmentsByDate]);

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
  if (view === ViewType.Day && selectedDate) {
    return (
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => prev ? new Date(prev.getTime() - 86400000) : new Date())}>
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h3 className="text-sm md:text-xl font-bold truncate">
              {format(selectedDate, 'EEEE d MMM yyyy', { locale: it })}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => prev ? new Date(prev.getTime() + 86400000) : new Date())}>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          <div className="w-full sm:w-auto">
            <div className="flex border border-border rounded-md overflow-hidden w-full">
              <Button 
                variant={view === ViewType.Day ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView(ViewType.Day)}
              >
                Giorno
              </Button>
              <Button 
                variant={view === ViewType.Week ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView(ViewType.Week)}
              >
                Settimana
              </Button>
              <Button 
                variant={view === ViewType.Month ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView(ViewType.Month)}
              >
                Mese
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="min-h-[600px] p-4">
            {TIME_SLOTS.map((slot, index) => {
              const timeSlotAppointments = appointmentsByTimeSlot[slot.label] || [];
              const isCurrentHour = new Date().getHours() === slot.hour && 
                                   Math.abs(new Date().getMinutes() - slot.minute) < 30;
              
              return (
                <div 
                  key={index}
                  className={`flex border-b border-border py-1 md:py-2 ${isCurrentHour ? 'bg-primary/5' : ''}`}
                >
                  <div className="w-14 md:w-20 flex-shrink-0 text-right pr-2 md:pr-4 text-xs md:text-sm font-medium text-muted-foreground">
                    {slot.label}
                  </div>
                  
                  <div className="flex-1 min-h-[50px] md:min-h-[60px] relative">
                    {timeSlotAppointments.length > 0 ? (
                      <div className="flex flex-wrap gap-1 md:gap-2">
                        {timeSlotAppointments.map(appointment => (
                          <Card 
                            key={appointment.id}
                            className="flex-1 min-w-[130px] md:min-w-[200px] p-1.5 md:p-2 border-l-4 border-l-primary bg-primary/10 cursor-pointer hover:bg-primary/15 transition-colors"
                            onClick={() => onSelectAppointment(appointment)}
                          >
                            <div className="flex items-center gap-1 text-xs md:text-sm font-medium">
                              <Clock className="h-3 w-3" />
                              <span>{appointment.time}</span>
                              <span className="text-[10px] md:text-xs mx-1">({appointment.duration} min)</span>
                            </div>
                            <div className="font-medium text-xs md:text-sm truncate">{appointment.clientName}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground truncate">
                              {appointment.model} - {appointment.plate}
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full min-h-[50px] md:min-h-[60px] cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
                        onClick={() => {
                          const date = format(selectedDate, 'yyyy-MM-dd');
                          onSelectDate(`${date}T${slot.label}`);
                        }}
                      ></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Rendering vista settimanale (implementazione semplificata)
  if (view === ViewType.Week && selectedDate) {
    // TODO: Implementazione completa della vista settimanale
    return (
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => prev ? new Date(prev.getTime() - 7 * 86400000) : new Date())}>
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h3 className="text-sm md:text-xl font-bold truncate">
              Settimana {format(selectedDate, 'w', { locale: it })} - {format(selectedDate, 'MMM yyyy', { locale: it })}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => prev ? new Date(prev.getTime() + 7 * 86400000) : new Date())}>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          <div className="w-full sm:w-auto">
            <div className="flex border border-border rounded-md overflow-hidden w-full">
              <Button 
                variant={view === ViewType.Day ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView(ViewType.Day)}
              >
                Giorno
              </Button>
              <Button 
                variant={view === ViewType.Week ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView(ViewType.Week)}
              >
                Settimana
              </Button>
              <Button 
                variant={view === ViewType.Month ? "default" : "outline"}
                size="sm"
                className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setView(ViewType.Month)}
              >
                Mese
              </Button>
            </div>
          </div>
        </div>

        <div className="p-8 text-center">
          <p>Vista settimanale non implementata</p>
          <Button className="mt-4" onClick={() => setView(ViewType.Month)}>
            Torna alla vista mensile
          </Button>
        </div>
      </div>
    );
  }

  // Vista mensile (default)
  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <h3 className="text-sm md:text-xl font-bold capitalize truncate">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </h3>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>

        <div className="w-full sm:w-auto">
          <div className="flex border border-border rounded-md overflow-hidden w-full">
            <Button 
              variant={view === ViewType.Day ? "default" : "outline"}
              size="sm"
              className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => setView(ViewType.Day)}
            >
              Giorno
            </Button>
            <Button 
              variant={view === ViewType.Week ? "default" : "outline"}
              size="sm"
              className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => setView(ViewType.Week)}
            >
              Settimana
            </Button>
            <Button 
              variant={view === ViewType.Month ? "default" : "outline"}
              size="sm"
              className="rounded-none flex-1 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => setView(ViewType.Month)}
            >
              Mese
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center p-1 md:p-2 border-b border-border bg-accent/50">
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">L</div>
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">M</div>
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">M</div>
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">G</div>
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">V</div>
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">S</div>
        <div className="p-1 md:p-2 text-[10px] md:text-xs font-medium text-muted-foreground">D</div>
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day, index) => {
          const formattedDate = format(day, 'yyyy-MM-dd');
          const dayAppointments = appointmentsByDate[formattedDate] || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <div 
              key={index}
              onClick={() => handleSelectDate(day)}
              className={`p-0.5 md:p-1 border-r border-b border-border min-h-[60px] md:min-h-[100px] cursor-pointer hover:bg-accent/30 transition-colors ${
                !isCurrentMonth ? 'text-muted-foreground' : ''
              } ${
                isTodayDate ? 'bg-accent/50' : ''
              }`}
            >
              <div className={`text-right p-0.5 md:p-1 text-[10px] md:text-xs ${
                isTodayDate ? 'font-bold text-primary' : ''
              }`}>
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5 md:space-y-1">
                {dayAppointments.length > 0 && dayAppointments
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .slice(0, isCurrentMonth ? (isTodayDate ? 2 : 1) : 0)
                  .map((appointment) => (
                    <div 
                      key={appointment.id}
                      className="text-[8px] md:text-xs p-0.5 md:p-1 rounded-sm border-l-2 border-primary bg-primary/15 truncate"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAppointment(appointment);
                      }}
                    >
                      <div className="font-medium truncate">
                        <span className="hidden sm:inline">{appointment.time} - </span>
                        {appointment.clientName}
                      </div>
                    </div>
                  ))
                }
                {isCurrentMonth && dayAppointments.length > (isTodayDate ? 2 : 1) && (
                  <div className="text-[8px] md:text-xs text-center text-primary font-medium">
                    +{dayAppointments.length - (isTodayDate ? 2 : 1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}