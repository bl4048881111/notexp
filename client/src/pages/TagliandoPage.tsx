import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllAppointments } from "@shared/supabase";
import { Appointment } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { useLocation } from "wouter";

export default function TagliandoPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  // Query per ottenere tutti gli appuntamenti
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['/appointments'],
    queryFn: getAllAppointments,
  });

  // Filtra solo gli appuntamenti in lavorazione
  const inProgressAppointments = appointments.filter(
    (appointment) => appointment.status === "in_lavorazione"
  );

  // Filtra ulteriormente in base alla ricerca
  const filteredAppointments = inProgressAppointments.filter((appointment) => {
    const query = searchQuery.toLowerCase();
    return (
      appointment.clientName.toLowerCase().includes(query) ||
      appointment.plate.toLowerCase().includes(query) ||
      (appointment.model?.toLowerCase() || "").includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-bold">Lavorazione</h2>
      </div>
      
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border">
        <div className="p-3 md:p-4 border-b border-border">
          <div className="relative w-full">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-full border-2 border-orange-500/30 focus:border-orange-500"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-orange-500" />
          </div>
        </div>
        
        <ScrollArea className="h-[calc(100vh-250px)]">
          {filteredAppointments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {isLoading ? "Caricamento..." : "Nessun appuntamento in lavorazione"}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => navigate(`/tagliando/${appointment.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{appointment.clientName}</div>
                      <div className="text-sm text-muted-foreground">
                        {appointment.plate}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-primary border-primary">
                      In Lavorazione
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 md:px-6 md:py-3 flex items-center justify-between border-t border-border text-xs text-muted-foreground">
          Mostrando <span className="font-medium">{filteredAppointments.length}</span> appuntamenti in lavorazione
        </div>
      </div>
    </div>
  );
} 