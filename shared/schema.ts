import { z } from "zod";

// Vehicle schema
export const vehicleSchema = z.object({
  id: z.string(),
  plate: z.string().min(1, "Targa è obbligatoria"),
  vin: z.string().min(1, "Telaio è obbligatorio"),
  registrationPhotos: z.array(z.string()).optional(), // URLs delle foto del libretto
  createdAt: z.number().optional() // Timestamp di creazione
});

export const createVehicleSchema = vehicleSchema.omit({ id: true });
export type Vehicle = z.infer<typeof vehicleSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

// Client schema
export const clientSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  surname: z.string().optional(),
  phone: z.string().min(1, "Recapito telefonico è obbligatorio"),
  email: z.string().email("Email non valida").optional(),
  plate: z.string().optional(), // Reso opzionale, ora gestito tramite vehicles
  vin: z.string().optional(),   // Reso opzionale, ora gestito tramite vehicles
  password: z.string().optional(),
  created_at: z.string().optional(), // Timestamp ISO string dal database
  updated_at: z.string().optional(), // Timestamp ISO string dal database
  birth_date: z.string().nullable().optional(), // Campo del database
  // Campi fiscali italiani
  tipo_cliente: z.enum(["privato", "azienda"]).default("privato"), // Tipo cliente - sempre presente
  cf: z.string().optional(), // Codice fiscale (sempre disponibile)
  piva: z.string().optional(), // Partita IVA (solo aziende)
  sdi: z.string().optional(), // Sistema di Interscambio (solo aziende)
  pec: z.string().optional(), // Posta Elettronica Certificata (solo aziende)
  // Campi legacy per compatibilità con il frontend
  birthDate: z.string().optional(), // Mantenuto per compatibilità frontend
  model: z.string().optional(), // Campo reso opzionale
  vehicles: z.array(vehicleSchema).optional(),
  createdAt: z.number().optional(), // Legacy timestamp
  updatedAt: z.number().optional() // Legacy timestamp
});

export const createClientSchema = clientSchema.omit({ id: true, model: true }).extend({
  vehicles: z.array(createVehicleSchema).optional()
});
export type Client = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;

// Spare Part schema
export const sparePartSchema = z.object({
  id: z.string(),
  code: z.string().min(1, "Codice articolo è obbligatorio"),
  name: z.string().min(1, "Nome articolo è obbligatorio"),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().min(1, "Categoria è obbligatoria").default("altro"),
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
  model: z.string().optional(),
  date: z.string().refine((date) => {
    // Valida che la data non sia nel passato (eccetto oggi)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0);
    return appointmentDate >= today;
  }, {
    message: "La data dell'appuntamento non può essere nel passato"
  }),
  time: z.string(),
  duration: z.number(),
  services: z.array(z.string()),
  spareParts: z.array(sparePartSchema).optional(),
  totalPartsPrice: z.number().optional(),
  notes: z.string().optional(),
  status: z.enum(["programmato", "in_lavorazione", "completato", "annullato"]),
  // ID del preventivo collegato
  quoteId: z.string().optional(),
  // Stato dell'ordine dei pezzi
  partsOrdered: z.boolean().optional(),
  // Ore di manodopera dal preventivo collegato
  quoteLaborHours: z.number().optional(),
  // Orari dettagliati per supportare le fasce orarie
  startHour: z.number().optional(),
  startMinute: z.number().optional(),
  endHour: z.number().optional(),
  endMinute: z.number().optional(),
  type: z.string().optional()
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
  laborPrice: z.number().default(0).optional()
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
  kilometrage: z.number(),
  date: z.string(),
  status: z.enum(["bozza", "inviato", "accettato", "scaduto", "completato", "archiviato"]),
  laborPrice: z.number(),
  // Array di parti semplice (per retrocompatibilità)
  parts: z.array(z.object({
    code: z.string(),
    description: z.string(),
    quantity: z.number(),
    price: z.number()
  })),
  // Nuovo campo per items strutturati
  items: z.array(quoteItemSchema).optional(),
  // Campi per i totali
  totalPrice: z.number(),
  subtotal: z.number().optional(),
  taxAmount: z.number().optional(),
  taxRate: z.number().optional(),
  // Campi per la manodopera
  laborHours: z.number().optional(),
  // Campi per dettagli e meta-informazioni
  notes: z.string().optional(),
  validUntil: z.string().optional(),
  partsOrdered: z.boolean().optional(),
  createdAt: z.number().optional(),
  // Campi aggiuntivi (per retrocompatibilità)
  code: z.string().optional(),
  quantity: z.number().optional(),
  model: z.string().optional(),
  vin: z.string().optional(),
  total: z.number().optional(),
  // Campi per l'appuntamento
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  address: z.string().optional(),
});

export const createQuoteSchema = quoteSchema.extend({
  id: z.string().optional(),
  vin: z.string().optional()
});
export type Quote = z.infer<typeof quoteSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username è obbligatorio"),
  password: z.string().min(1, "Password è obbligatoria")
});
export type LoginInput = z.infer<typeof loginSchema>;

// Request schema (per le richieste dal form pubblico)
export const requestSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cognome: z.string(),
  email: z.string(),
  telefono: z.string(),
  targa: z.string(),
  dataNascita: z.string().optional(),
  note: z.string().optional(),
  coupon: z.string().optional(),
  tipoRichiesta: z.enum(["preventivo", "checkup"]),
  dataAppuntamento: z.string().optional(),
  oraAppuntamento: z.string().optional(),
  preferenzaOrario: z.enum(["mattina", "pomeriggio"]).optional(),
  status: z.enum(["ricevuta", "in_lavorazione", "completata", "annullata"]).default("ricevuta"),
  createdAt: z.number(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

export const createRequestSchema = requestSchema.omit({ id: true });
export type Request = z.infer<typeof requestSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

// Checklist Item schema
export const checklistItemSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  vehicleId: z.string(),
  itemName: z.string(),
  itemCategory: z.string(),
  status: z.enum(["non_controllato", "ok", "da_sostituire", "attenzione", "sostituito"]).default("non_controllato"),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const createChecklistItemSchema = checklistItemSchema.omit({ id: true });
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;

// Work Session schema
export const workSessionSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
  vehicleId: z.string(),
  acceptancePhotos: z.array(z.string()).default([]),
  fuelLevel: z.string().optional(),
  mileage: z.string().optional(),
  sparePartsPhotos: z.array(z.string()).default([]),
  // Note per ogni foto ricambio (massimo 6 foto)
  p1note: z.string().optional(),
  p2note: z.string().optional(),
  p3note: z.string().optional(),
  p4note: z.string().optional(),
  p5note: z.string().optional(),
  p6note: z.string().optional(),
  currentStep: z.number().default(1),
  completed: z.boolean().default(false),
  completedAt: z.string().optional(),
  descpart: z.string().optional(), // Note di lavorazione
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const createWorkSessionSchema = workSessionSchema.omit({ id: true });
export type WorkSession = z.infer<typeof workSessionSchema>;
export type CreateWorkSessionInput = z.infer<typeof createWorkSessionSchema>;

// User schema (per l'autenticazione)
export const userSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
  clientId: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  surname: z.string().optional()
});

export type User = z.infer<typeof userSchema>;

// WhatsApp Template schema
export const whatsappTemplateSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Titolo è obbligatorio"),
  content: z.string().min(1, "Contenuto è obbligatorio"),
  category: z.enum([
    "generale",
    "appuntamenti", 
    "preventivi",
    "completato",
    "cortesia",
    "feedback",
    "oggi",
    "domani",
    //"urgenze",
    "promemoria"
  ]),
  idgil: z.number().min(1, "ID Ordinamento è obbligatorio").optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional() // Per tracciare chi ha creato il template
});

export const createWhatsappTemplateSchema = whatsappTemplateSchema.omit({ id: true });
export type WhatsappTemplate = z.infer<typeof whatsappTemplateSchema>;
export type CreateWhatsappTemplateInput = z.infer<typeof createWhatsappTemplateSchema>;

// Schema per i prodotti ordinati
export const orderedPartSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  appointmentId: z.string().optional(),
  code: z.string(),
  description: z.string().optional(),
  unitPrice: z.number().optional(),
  quantity: z.number(),
  received: z.boolean().default(false),
  receivedAt: z.string().nullable().optional(),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const createOrderedPartSchema = orderedPartSchema.omit({ id: true, created_at: true, updated_at: true });
export type OrderedPart = z.infer<typeof orderedPartSchema>;
export type CreateOrderedPartInput = z.infer<typeof createOrderedPartSchema>;
