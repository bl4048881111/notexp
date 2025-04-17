import { useState, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Appointment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  
  // Generate calendar days array
  useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Include days from previous and next month to fill the calendar grid
    const dayOfWeek = monthStart.getDay() || 7; // Convert Sunday (0) to 7 for European calendar
    const prevMonthDays = Array.from({ length: dayOfWeek - 1 }, (_, i) => {
      return new Date(monthStart.getFullYear(), monthStart.getMonth(), -i);
    }).reverse();
    
    const nextMonthDays = [];
    const totalDaysNeeded = 42; // 6 rows of 7 days
    const daysToAdd = totalDaysNeeded - (prevMonthDays.length + daysInMonth.length);
    for (let i = 1; i <= daysToAdd; i++) {
      nextMonthDays.push(new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + i));
    }
    
    setCalendarDays([...prevMonthDays, ...daysInMonth, ...nextMonthDays]);
  }, [currentMonth]);
  
  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const handleToday = () => {
    setCurrentMonth(new Date());
  };
  
  // Group appointments by date
  const appointmentsByDate = appointments.reduce((acc, appointment) => {
    const date = appointment.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(appointment);
    return acc;
  }, {} as Record<string, Appointment[]>);
  
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
  
  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-xl font-bold">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </h3>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Oggi
          </Button>
          <div className="flex border border-border rounded-md overflow-hidden">
            <Button 
              variant="outline"
              size="sm"
              className="rounded-none"
            >
              Giorno
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="rounded-none"
            >
              Settimana
            </Button>
            <Button 
              variant="default"
              size="sm"
              className="rounded-none"
            >
              Mese
            </Button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-7 text-center p-2 border-b border-border bg-accent/50">
        <div className="p-2 text-xs font-medium text-muted-foreground">Lun</div>
        <div className="p-2 text-xs font-medium text-muted-foreground">Mar</div>
        <div className="p-2 text-xs font-medium text-muted-foreground">Mer</div>
        <div className="p-2 text-xs font-medium text-muted-foreground">Gio</div>
        <div className="p-2 text-xs font-medium text-muted-foreground">Ven</div>
        <div className="p-2 text-xs font-medium text-muted-foreground">Sab</div>
        <div className="p-2 text-xs font-medium text-muted-foreground">Dom</div>
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
              onClick={() => onSelectDate(formattedDate)}
              className={`p-1 border-r border-b border-border min-h-[100px] cursor-pointer hover:bg-accent/30 transition-colors ${
                !isCurrentMonth ? 'text-muted-foreground' : ''
              } ${
                isTodayDate ? 'bg-accent/50' : ''
              }`}
            >
              <div className={`text-right p-1 text-xs ${
                isTodayDate ? 'font-bold text-primary' : ''
              }`}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayAppointments.map((appointment) => (
                  <div 
                    key={appointment.id}
                    className="text-xs p-1 rounded-sm border-l-2 border-primary bg-primary/15 truncate"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAppointment(appointment);
                    }}
                  >
                    <div className="font-medium truncate">
                      {appointment.time} - {appointment.clientName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
