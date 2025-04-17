import { z } from "zod";

// Vehicle schema
export const vehicleSchema = z.object({
  id: z.string(),
  plate: z.string().min(1, "Targa è obbligatoria"),
  model: z.string().min(1, "Modello è obbligatorio"),
  year: z.string().optional(),
  color: z.string().optional(),
  vin: z.string().optional()
});

export const createVehicleSchema = vehicleSchema.omit({ id: true });
export type Vehicle = z.infer<typeof vehicleSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

// Client schema
export const clientSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome è obbligatorio"),
  surname: z.string().min(1, "Cognome è obbligatorio"),
  phone: z.string().min(1, "Numero di telefono è obbligatorio"),
  email: z.string().email("Email non valida").or(z.string().length(0)),
  plate: z.string().min(1, "Targa è obbligatoria"),  // Teniamo per retrocompatibilità
  model: z.string().min(1, "Modello è obbligatorio"), // Teniamo per retrocompatibilità
  vehicles: z.array(vehicleSchema).optional(),
  createdAt: z.number()
});

export const createClientSchema = clientSchema.omit({ id: true });
export type Client = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;

// Spare Part schema
export const sparePartSchema = z.object({
  id: z.string(),
  code: z.string().min(1, "Codice articolo è obbligatorio"),
  description: z.string().optional(),
  netPrice: z.number().min(0, "Il prezzo deve essere maggiore o uguale a 0"),
  markupPercentage: z.number().min(0, "La percentuale deve essere maggiore o uguale a 0"),
  finalPrice: z.number().min(0, "Il prezzo finale deve essere maggiore o uguale a 0")
});

export const createSparePartSchema = sparePartSchema.omit({ id: true });
export type SparePart = z.infer<typeof sparePartSchema>;
export type CreateSparePartInput = z.infer<typeof createSparePartSchema>;

// Appointment schema
export const appointmentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  phone: z.string(),
  plate: z.string(),
  model: z.string(),
  date: z.string(),
  time: z.string(),
  duration: z.number(),
  services: z.array(z.string()),
  spareParts: z.array(sparePartSchema).optional(),
  totalPartsPrice: z.number().optional(),
  notes: z.string().optional(),
  status: z.enum(["programmato", "completato", "annullato"]),
  // Orari dettagliati per supportare le fasce orarie
  startHour: z.number().optional(),
  startMinute: z.number().optional(),
  endHour: z.number().optional(),
  endMinute: z.number().optional()
});

export const createAppointmentSchema = appointmentSchema.omit({ id: true });
export type Appointment = z.infer<typeof appointmentSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username è obbligatorio"),
  password: z.string().min(1, "Password è obbligatoria")
});
export type LoginInput = z.infer<typeof loginSchema>;
