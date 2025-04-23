import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, Calendar, List } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleDropdown, DropdownMenuItem } from "@/components/ui/CustomUIComponents";
import { useToast } from "@/hooks/use-toast";

import { getAllAppointments } from "@shared/firebase";
import { Appointment, Quote } from "@shared/schema";

import AppointmentForm from "../components/appointments/AppointmentForm";
import CalendarView from "../components/appointments/CalendarView";
import TableView from "../components/appointments/TableView";
import QuoteForm from "../components/quotes/QuoteForm";
import { exportAppointmentsToExcel, exportAppointmentsToPDF } from "../services/exportService";

export default function AppointmentsPage() {
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuoteFormOpen, setIsQuoteFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'));
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [clientIdForQuote, setClientIdForQuote] = useState<string | null>(null);
  const [initialViewDay, setInitialViewDay] = useState(true);
  
  const { toast } = useToast();
  
  // Fetch appointments
  const { 
    data: appointments = [], 
    isLoading,
    refetch
  } = useQuery({ 
    queryKey: ['/api/appointments'],
    queryFn: getAllAppointments,
  });
  
  // Filter appointments
  const filteredAppointments = appointments.filter((appointment: Appointment) => {
    const matchesSearch = 
      appointment.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      appointment.plate.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (appointment.services && appointment.services.some(service => 
        service.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    const matchesDate = !dateFilter || appointment.date === dateFilter;
    
    return matchesSearch && matchesStatus && matchesDate;
  });
  
  const handleExportAppointments = async () => {
    try {
      await exportAppointmentsToExcel(filteredAppointments);
      toast({
        title: "Esportazione completata",
        description: "Gli appuntamenti sono stati esportati con successo",
      });
    } catch (error) {
      toast({
        title: "Errore di esportazione",
        description: "Si è verificato un errore durante l'esportazione",
        variant: "destructive",
      });
    }
  };
  
  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };
  
  const handleAddAppointment = (date?: string) => {
    setSelectedDate(date || format(new Date(), 'yyyy-MM-dd'));
    setEditingAppointment(null);
    setIsFormOpen(true);
  };
  
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingAppointment(null);
    setSelectedDate(null);
  };
  
  const handleFormSubmit = async () => {
    await refetch();
    setIsFormOpen(false);
    setEditingAppointment(null);
    setSelectedDate(null);
  };

  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setIsQuoteFormOpen(true);
  };

  const handleCreateNewQuote = (clientId: string) => {
    setClientIdForQuote(clientId);
    setEditingQuote(null);
    setIsQuoteFormOpen(true);
  };

  const handleQuoteFormClose = () => {
    setIsQuoteFormOpen(false);
    setEditingQuote(null);
    setClientIdForQuote(null);
  };

  const handleQuoteFormSubmit = async () => {
    setIsQuoteFormOpen(false);
    setEditingQuote(null);
    setClientIdForQuote(null);
    // Riapriamo il form appuntamento dopo aver creato il preventivo
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-bold">Appuntamenti</h2>
        
        <div className="flex flex-wrap w-full sm:w-auto gap-2 sm:space-x-3">
          <Button className="w-full sm:w-auto" onClick={() => handleAddAppointment()}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="sm:inline">Nuovo Appuntamento</span>
            <span className="inline sm:hidden">Nuovo</span>
          </Button>
          
          <div className="flex w-full sm:w-auto border border-border rounded-md overflow-hidden">
            <Button 
              variant={view === "calendar" ? "default" : "ghost"}
              onClick={() => setView("calendar")}
              className="rounded-none flex-1"
            >
              <Calendar className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
              <span className="inline sm:hidden">Cal</span>
            </Button>
            
            <Button 
              variant={view === "table" ? "default" : "ghost"}
              onClick={() => setView("table")}
              className="rounded-none flex-1"
            >
              <List className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
              <span className="inline sm:hidden">Tab</span>
            </Button>
          </div>
          
          <div className="relative w-full sm:w-auto">
            <SimpleDropdown
              trigger={
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Esporta
                </Button>
              }
              content={
                <div>
                  <DropdownMenuItem onClick={handleExportAppointments}>
                    Esporta in Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    try {
                      exportAppointmentsToPDF(filteredAppointments);
                      toast({
                        title: "Esportazione completata",
                        description: "Gli appuntamenti sono stati esportati in PDF con successo",
                      });
                    } catch (error) {
                      toast({
                        title: "Errore di esportazione",
                        description: "Si è verificato un errore durante l'esportazione in PDF",
                        variant: "destructive",
                      });
                    }
                  }}>
                    Esporta in PDF
                  </DropdownMenuItem>
                </div>
              }
            />
          </div>
        </div>
      </div>
      
      {view === "table" && (
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Cerca appuntamento per cliente, targa o servizio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="flex space-x-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stato appuntamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="programmato">Programmato</SelectItem>
                  <SelectItem value="completato">Completato</SelectItem>
                  <SelectItem value="annullato">Annullato</SelectItem>
                </SelectContent>
              </Select>
              
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[180px]"
              />
            </div>
          </div>
          
          <TableView 
            appointments={filteredAppointments} 
            isLoading={isLoading} 
            onEdit={handleEditAppointment}
            onDeleteSuccess={refetch}
            onStatusChange={refetch}
          />
        </div>
      )}
      
      {view === "calendar" && (
        <CalendarView 
          appointments={appointments} 
          isLoading={isLoading}
          onSelectDate={handleAddAppointment}
          onSelectAppointment={handleEditAppointment}
        />
      )}
      
      {isFormOpen && (
        <AppointmentForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSubmit}
          appointment={editingAppointment}
          selectedDate={selectedDate}
          onEditQuote={handleEditQuote}
          onCreateQuote={handleCreateNewQuote}
        />
      )}
      
      {isQuoteFormOpen && (
        <QuoteForm 
          isOpen={isQuoteFormOpen}
          onClose={handleQuoteFormClose}
          onSuccess={handleQuoteFormSubmit}
          quote={editingQuote}
          defaultClientId={clientIdForQuote}
        />
      )}
    </div>
  );
}
