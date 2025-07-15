import { WorkPhase, CreateWorkPhaseInput } from "@shared/schema";
import { 
  getAllWorkPhases, 
  getWorkPhaseById, 
  getWorkPhaseByAppointmentId,
  getWorkPhaseByVehicleId,
  createWorkPhase, 
  updateWorkPhase, 
  deleteWorkPhase 
} from "@shared/supabase";

// Work Phase service
export const workPhaseService = {
  // Get all work phases
  getAll: async (): Promise<WorkPhase[]> => {
    return await getAllWorkPhases();
  },
  
  // Get a work phase by ID
  getById: async (id: string): Promise<WorkPhase | null> => {
    return await getWorkPhaseById(id);
  },
  
  // Get work phase by appointment ID
  getByAppointmentId: async (appointmentId: string): Promise<WorkPhase | null> => {
    return await getWorkPhaseByAppointmentId(appointmentId);
  },
  
  // Get work phase by vehicle ID
  getByVehicleId: async (vehicleId: string): Promise<WorkPhase | null> => {
    return await getWorkPhaseByVehicleId(vehicleId);
  },
  
  // Create a new work phase
  create: async (workPhase: CreateWorkPhaseInput): Promise<WorkPhase> => {
    return await createWorkPhase(workPhase);
  },
  
  // Update a work phase
  update: async (id: string, workPhase: Partial<WorkPhase>): Promise<WorkPhase> => {
    return await updateWorkPhase(id, workPhase);
  },
  
  // Delete a work phase
  delete: async (id: string): Promise<void> => {
    await deleteWorkPhase(id);
  },
  
  // Complete a work phase
  complete: async (id: string, completedBy: string = 'web-app'): Promise<WorkPhase> => {
    return await updateWorkPhase(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy: completedBy
    });
  },
  
  // Add photo to work phase
  addPhoto: async (id: string, photoUrl: string): Promise<WorkPhase> => {
    const workPhase = await getWorkPhaseById(id);
    if (!workPhase) {
      throw new Error('Work phase not found');
    }
    
    const updatedPhotos = [...(workPhase.sparePartPhotos || []), photoUrl];
    return await updateWorkPhase(id, {
      sparePartPhotos: updatedPhotos
    });
  },
  
  // Remove photo from work phase
  removePhoto: async (id: string, photoIndex: number): Promise<WorkPhase> => {
    const workPhase = await getWorkPhaseById(id);
    if (!workPhase) {
      throw new Error('Work phase not found');
    }
    
    const updatedPhotos = [...(workPhase.sparePartPhotos || [])];
    updatedPhotos.splice(photoIndex, 1);
    
    return await updateWorkPhase(id, {
      sparePartPhotos: updatedPhotos
    });
  }
}; 