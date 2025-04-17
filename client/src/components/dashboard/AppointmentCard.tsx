import { Appointment } from "@shared/types";
import { Badge } from "@/components/ui/badge";

interface AppointmentCardProps {
  appointment: Appointment;
}

export default function AppointmentCard({ appointment }: AppointmentCardProps) {
  return (
    <div className="mb-3 p-3 bg-background rounded-md hover:bg-accent/30 transition-colors duration-200">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium">{appointment.clientName}</h4>
          <p className="text-sm text-muted-foreground">{appointment.model} - {appointment.plate}</p>
        </div>
        <div className="text-right">
          <span className="text-primary font-medium">{appointment.time}</span>
          <p className="text-xs text-muted-foreground">{appointment.duration} min</p>
        </div>
      </div>
      <div className="mt-2 text-sm flex flex-wrap gap-1">
        {appointment.services && appointment.services.map((service, index) => (
          <Badge key={index} variant="outline" className="bg-accent/50 text-foreground text-xs">
            {service}
          </Badge>
        ))}
      </div>
    </div>
  );
}
