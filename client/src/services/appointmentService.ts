import { Appointment, CreateAppointmentInput } from "@shared/types";
import { 
  getAllAppointments, 
  getAppointmentById, 
  createAppointment, 
  updateAppointment, 
  deleteAppointment, 
  getAppointmentsByDate 
} from "@shared/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

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
  update: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    // Normalizziamo i valori di duration e quoteLaborHours per garantire coerenza
    let updatedData = { ...data };
    
    // Se è stato specificato solo uno dei due valori, sincronizziamo l'altro
    if (data.duration !== undefined && data.quoteLaborHours === undefined) {
      const duration = Number(data.duration);
      updatedData.quoteLaborHours = isNaN(duration) ? 1 : Math.max(duration, 0.5);
    } 
    else if (data.quoteLaborHours !== undefined && data.duration === undefined) {
      const quoteLaborHours = Number(data.quoteLaborHours);
      updatedData.duration = isNaN(quoteLaborHours) ? 1 : Math.max(quoteLaborHours, 0.5);
    }
    // Se entrambi sono specificati, assicuriamoci che siano uguali usando il valore maggiore
    else if (data.duration !== undefined && data.quoteLaborHours !== undefined) {
      const duration = Number(data.duration);
      const quoteLaborHours = Number(data.quoteLaborHours);
      
      // Usa il valore maggiore tra i due per entrambi i campi
      if (!isNaN(duration) && !isNaN(quoteLaborHours)) {
        const finalValue = Math.max(duration, quoteLaborHours, 0.5);
        updatedData.duration = finalValue;
        updatedData.quoteLaborHours = finalValue;
      }
    }
    
    console.log(`Aggiornamento appuntamento ${id} - Dati sincronizzati:`, {
      originali: {
        duration: data.duration,
        quoteLaborHours: data.quoteLaborHours
      },
      sincronizzati: {
        duration: updatedData.duration,
        quoteLaborHours: updatedData.quoteLaborHours
      }
    });
    
    // Utilizziamo la funzione esistente updateAppointment
    const result = await updateAppointment(id, updatedData);
    
    // Recupera l'appuntamento aggiornato
    const updatedAppointment = await getAppointmentById(id);
    if (!updatedAppointment) {
      throw new Error(`Appuntamento con ID ${id} non trovato`);
    }
    
    return updatedAppointment as Appointment;
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
