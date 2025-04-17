import { Appointment, CreateAppointmentInput } from "@shared/types";
import { 
  getAllAppointments, 
  getAppointmentById, 
  createAppointment, 
  updateAppointment, 
  deleteAppointment, 
  getAppointmentsByDate 
} from "@shared/firebase";

// Appointment service
export const appointmentService = {
  // Get all appointments
  getAll: async (): Promise<Appointment[]> => {
    return await getAllAppointments();
  },
  
  // Get an appointment by ID
  getById: async (id: string): Promise<Appointment | null> => {
    return await getAppointmentById(id);
  },
  
  // Get appointments by date
  getByDate: async (date: string): Promise<Appointment[]> => {
    return await getAppointmentsByDate(date);
  },
  
  // Create a new appointment
  create: async (appointment: CreateAppointmentInput): Promise<Appointment> => {
    return await createAppointment(appointment);
  },
  
  // Update an appointment
  update: async (id: string, appointment: Partial<Appointment>): Promise<void> => {
    await updateAppointment(id, appointment);
  },
  
  // Delete an appointment
  delete: async (id: string): Promise<void> => {
    await deleteAppointment(id);
  },
  
  // Get today's appointments
  getTodayAppointments: async (): Promise<Appointment[]> => {
    const today = new Date().toISOString().split('T')[0];
    return await getAppointmentsByDate(today);
  },
  
  // Mark appointment as completed
  markAsCompleted: async (id: string): Promise<void> => {
    await updateAppointment(id, { status: "completato" });
  },
  
  // Filter appointments by status
  filterByStatus: async (status: string): Promise<Appointment[]> => {
    const appointments = await getAllAppointments();
    if (status === "all") return appointments;
    return appointments.filter(appointment => appointment.status === status);
  }
};
