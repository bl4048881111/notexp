// Export types from schema.ts to avoid circular imports
import { 
  Client, 
  Appointment, 
  CreateClientInput, 
  CreateAppointmentInput,
  Vehicle,
  CreateVehicleInput,
  SparePart,
  CreateSparePartInput 
} from './schema';

export type { 
  Client, 
  Appointment, 
  CreateClientInput, 
  CreateAppointmentInput,
  Vehicle,
  CreateVehicleInput,
  SparePart,
  CreateSparePartInput 
};