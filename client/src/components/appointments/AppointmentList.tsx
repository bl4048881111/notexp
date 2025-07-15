import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseISO, isToday, isAfter, compareAsc } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem 
} from '@/components/ui/select';
import { Search as SearchIcon } from 'lucide-react';
import { getAllAppointments } from '@shared/supabase';
import { Appointment } from '@shared/schema';

interface AppointmentListProps {
  onEditAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (appointmentId: string) => void;
}

export default function AppointmentList({ onEditAppointment, onDeleteAppointment }: AppointmentListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showPastAppointments, setShowPastAppointments] = useState(false);
  
  // Query per ottenere tutti gli appuntamenti
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['/appointments'],
    queryFn: async () => {
      const allAppointments = await getAllAppointments();
      return allAppointments;
    },
  });

  // Filtro appuntamenti in base al termine di ricerca e allo stato
  const filteredAppointments = useMemo(() => {
    let result = [...appointments];
    
    // Filtra in base alla ricerca
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        appointment => 
          appointment.clientName?.toLowerCase().includes(query) ||
          appointment.plate?.toLowerCase().includes(query) ||
          appointment.model?.toLowerCase().includes(query)
      );
    }
    
    // Filtra in base allo stato
    if (statusFilter) {
      result = result.filter(appointment => appointment.status === statusFilter);
    }
    
    // Filtra appuntamenti passati se non attivato il filtro per mostrarli
    if (!showPastAppointments) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      result = result.filter(appointment => {
        const appointmentDate = parseISO(appointment.date);
        return isToday(appointmentDate) || isAfter(appointmentDate, today);
      });
    }
    
    // Ordina per data, il più recente prima
    return result.sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      
      const timeCompare = compareAsc(dateA, dateB);
      
      // Se le date sono uguali, ordina per ora
      if (timeCompare === 0) {
        const [hoursA, minutesA] = a.time.split(':').map(Number);
        const [hoursB, minutesB] = b.time.split(':').map(Number);
        
        if (hoursA !== hoursB) {
          return hoursA - hoursB;
        }
        return minutesA - minutesB;
      }
      
      return timeCompare;
    });
  }, [appointments, searchTerm, statusFilter, showPastAppointments]);
  
  // Visualizzazione per il componente filtri
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
        <div className="space-y-2 md:space-y-0 md:space-x-2 flex flex-col md:flex-row">
          <div className="relative w-full md:w-auto">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca cliente, targa o veicolo..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-9 w-full md:w-[250px] h-9"
            />
          </div>
          <Select value={statusFilter || ""} onValueChange={(val: string) => setStatusFilter(val || null)}>
            <SelectTrigger className="w-full md:w-[180px] h-9">
              <SelectValue placeholder="Filtra per stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tutti gli stati</SelectItem>
              <SelectItem value="programmato">Programmato</SelectItem>
              <SelectItem value="confermato">Confermato</SelectItem>
              <SelectItem value="in-corso">In corso</SelectItem>
              <SelectItem value="completato">Completato</SelectItem>
              <SelectItem value="annullato">Annullato</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="show-past" className="text-sm font-normal cursor-pointer">
            Mostra appuntamenti passati
          </Label>
          <Switch 
            id="show-past" 
            checked={showPastAppointments} 
            onCheckedChange={setShowPastAppointments} 
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-md bg-muted"></div>
              <div className="space-y-2">
                <div className="h-4 w-[250px] rounded bg-muted"></div>
                <div className="h-4 w-[200px] rounded bg-muted"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Nessun appuntamento trovato.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <div 
              key={appointment.id} 
              className="flex items-center justify-between p-4 rounded-lg border hover:shadow-sm transition-shadow"
            >
              <div className="space-y-1">
                <div className="font-medium">{appointment.clientName}</div>
                <div className="text-sm text-muted-foreground">
                  {appointment.date} - {appointment.time} | {appointment.plate} | {appointment.model}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEditAppointment(appointment)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  Modifica
                </button>
                <button
                  onClick={() => onDeleteAppointment(appointment.id)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-destructive hover:text-destructive-foreground h-9 px-3"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 