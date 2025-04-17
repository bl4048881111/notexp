import { z } from "zod";

// Client schema
export const clientSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome è obbligatorio"),
  surname: z.string().min(1, "Cognome è obbligatorio"),
  phone: z.string().min(1, "Numero di telefono è obbligatorio"),
  email: z.string().email("Email non valida").or(z.string().length(0)),
  plate: z.string().min(1, "Targa è obbligatoria"),
  model: z.string().min(1, "Modello è obbligatorio"),
  createdAt: z.number()
});

export const createClientSchema = clientSchema.omit({ id: true });
export type Client = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;

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
  notes: z.string().optional(),
  status: z.enum(["programmato", "completato", "annullato"])
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
