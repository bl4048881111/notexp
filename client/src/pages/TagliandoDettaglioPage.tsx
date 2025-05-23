import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getAppointmentById } from "@shared/firebase";
import { Appointment } from "@shared/schema";
import ServiceProcess from "@/components/ServiceProcess";
import { Skeleton } from "@/components/ui/skeleton";

export default function TagliandoDettaglioPage() {
  const params = useParams();
  const appointmentId = params.id;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointment() {
      setLoading(true);
      if (!appointmentId) {
        setAppointment(null);
        setLoading(false);
        return;
      }
      const data = await getAppointmentById(appointmentId);
      setAppointment(data);
      setLoading(false);
    }
    fetchAppointment();
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border p-6">
          <Skeleton className="h-5 w-full mb-8" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }
  
  if (!appointment) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl md:text-2xl font-bold">Lavorazione</h2>
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border p-6 text-center">
          Appuntamento non trovato
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">Lavorazione</h2>
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border p-4">
        <div className="mb-4 font-semibold">
          {appointment.clientName} - {appointment.plate}
          {appointment.quoteId && (
            <span className="ml-2 text-sm text-muted-foreground">
              Preventivo: {appointment.quoteId}
            </span>
          )}
        </div>
        <ServiceProcess 
          vehicleId={appointment.plate}
          customerPhone={appointment.phone}
          appointmentId={appointmentId}
        />
      </div>
    </div>
  );
} 