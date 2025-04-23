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
  vin: z.string().optional(), // Codice VIN facoltativo
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
  name: z.string().min(1, "Nome articolo è obbligatorio"),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().default("altro"),
  quantity: z.number().min(1, "La quantità deve essere almeno 1").default(1),
  unitPrice: z.number().min(0, "Il prezzo unitario deve essere maggiore o uguale a 0"),
  finalPrice: z.number().min(0, "Il prezzo finale deve essere maggiore o uguale a 0"),
  netPrice: z.number().min(0, "Il prezzo deve essere maggiore o uguale a 0").optional(),
  markup: z.number().min(0, "La percentuale deve essere maggiore o uguale a 0").optional(),
  margin: z.number().min(0, "Il margine deve essere maggiore o uguale a 0").optional()
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
  // ID del preventivo collegato
  quoteId: z.string().optional(),
  // Orari dettagliati per supportare le fasce orarie
  startHour: z.number().optional(),
  startMinute: z.number().optional(),
  endHour: z.number().optional(),
  endMinute: z.number().optional()
});

export const createAppointmentSchema = appointmentSchema.omit({ id: true });
export type Appointment = z.infer<typeof appointmentSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// Service Category schema
export const serviceCategories = [
  "Tagliando",
  "Frenante",
  "Sospensioni",
  "Accessori",
  "Manutenzione",
  "Riparazione",
  "Carrozzeria",
  "Motore",
  "Elettronica",
  "Altro",
  "Personalizzato"
] as const;

export const serviceTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome servizio è obbligatorio"),
  category: z.enum(serviceCategories),
  description: z.string().optional(),
  laborPrice: z.number().default(0)
});

export const createServiceTypeSchema = serviceTypeSchema.omit({ id: true });
export type ServiceType = z.infer<typeof serviceTypeSchema>;
export type CreateServiceTypeInput = z.infer<typeof createServiceTypeSchema>;

// Quote Item schema (for components in a quote)
export const quoteItemSchema = z.object({
  id: z.string(),
  serviceType: serviceTypeSchema,
  description: z.string().optional(),
  parts: z.array(sparePartSchema).default([]),
  laborPrice: z.number().default(0),
  laborHours: z.number().default(1),
  notes: z.string().optional(),
  totalPrice: z.number().default(0)
});

export const createQuoteItemSchema = quoteItemSchema.omit({ id: true });
export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type CreateQuoteItemInput = z.infer<typeof createQuoteItemSchema>;

// Quote schema
export const quoteSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  phone: z.string(),
  plate: z.string(),
  model: z.string(),
  kilometrage: z.number().default(0),
  date: z.string(),
  items: z.array(quoteItemSchema).default([]),
  subtotal: z.number().default(0),
  taxRate: z.number().default(22), // IVA 22%
  taxAmount: z.number().default(0),
  total: z.number().default(0),
  notes: z.string().optional(),
  laborPrice: z.number().default(45), // Tariffa oraria di manodopera extra
  laborHours: z.number().default(0), // Ore di manodopera extra
  status: z.enum(["bozza", "inviato", "accettato", "rifiutato", "scaduto"]).default("bozza"),
  validUntil: z.string().optional(), // Data di scadenza del preventivo
  createdAt: z.number()
});

export const createQuoteSchema = quoteSchema.omit({ id: true });
export type Quote = z.infer<typeof quoteSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username è obbligatorio"),
  password: z.string().min(1, "Password è obbligatoria")
});
export type LoginInput = z.infer<typeof loginSchema>;
