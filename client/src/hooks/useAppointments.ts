import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Appointment, CreateAppointmentInput } from "@shared/types";
import { appointmentService } from "../services/appointmentService";
import { useToast } from "@/hooks/use-toast";

export const useAppointments = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get all appointments
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: appointmentService.getAll,
  });
  
  // Get today's appointments
  const { data: todayAppointments = [], isLoading: isLoadingTodayAppointments } = useQuery({
    queryKey: ['/api/appointments/today'],
    queryFn: appointmentService.getTodayAppointments,
  });
  
  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: (appointment: CreateAppointmentInput) => appointmentService.create(appointment),
    onSuccess: () => {
      toast({
        title: "Appuntamento aggiunto",
        description: "L'appuntamento è stato aggiunto con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/today'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio dell'appuntamento",
        variant: "destructive",
      });
    },
  });
  
  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Appointment> }) => 
      appointmentService.update(id, data),
    onSuccess: () => {
      toast({
        title: "Appuntamento aggiornato",
        description: "L'appuntamento è stato aggiornato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/today'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dell'appuntamento",
        variant: "destructive",
      });
    },
  });
  
  // Delete appointment mutation
  const deleteAppointmentMutation = useMutation({
    mutationFn: (id: string) => appointmentService.delete(id),
    onSuccess: () => {
      toast({
        title: "Appuntamento eliminato",
        description: "L'appuntamento è stato eliminato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/today'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione dell'appuntamento",
        variant: "destructive",
      });
    },
  });
  
  // Mark as completed mutation
  const markAsCompletedMutation = useMutation({
    mutationFn: (id: string) => appointmentService.markAsCompleted(id),
    onSuccess: () => {
      toast({
        title: "Appuntamento completato",
        description: "Lo stato dell'appuntamento è stato aggiornato",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/today'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dello stato",
        variant: "destructive",
      });
    },
  });
  
  return {
    appointments,
    todayAppointments,
    isLoadingAppointments,
    isLoadingTodayAppointments,
    createAppointment: createAppointmentMutation.mutate,
    updateAppointment: updateAppointmentMutation.mutate,
    deleteAppointment: deleteAppointmentMutation.mutate,
    markAsCompleted: markAsCompletedMutation.mutate,
    isCreatingAppointment: createAppointmentMutation.isPending,
    isUpdatingAppointment: updateAppointmentMutation.isPending,
    isDeletingAppointment: deleteAppointmentMutation.isPending,
    isMarkingAsCompleted: markAsCompletedMutation.isPending,
  };
};
