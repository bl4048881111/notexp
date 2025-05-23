import { useMemo } from "react";
import { format, addDays, isWithinInterval, setYear, parseISO, formatDistance } from "date-fns";
import { it } from "date-fns/locale";
import { Phone, Mail } from "lucide-react";
import { getAllClients } from "@shared/firebase";
import { useQuery } from "@tanstack/react-query";
import { Client } from "@shared/types";

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function BirthdayWidget() {
  // Carica tutti i clienti
  const { data: clients = [], isLoading } = useQuery({ 
    queryKey: ['/api/clients/all-birthdays'],
    queryFn: getAllClients,
    staleTime: 1000 * 60 * 5, // Cache per 5 minuti
  });

  // Filtra i clienti che compiranno gli anni nella prossima settimana
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    const currentYear = today.getFullYear();
    
    return clients
      .filter(client => {
        // Controlla che il client abbia una data di nascita
        if (!client.birthDate) return false;
        
        try {
          // Converte la data di nascita al formato corretto
          const birthDate = parseISO(client.birthDate);
          
          // Imposta l'anno corrente per la data di nascita
          const birthDateThisYear = setYear(birthDate, currentYear);
          
          // Se il compleanno è già passato quest'anno, controlla l'anno prossimo
          if (birthDateThisYear < today) {
            const birthDateNextYear = setYear(birthDate, currentYear + 1);
            return isWithinInterval(birthDateNextYear, { start: today, end: nextWeek });
          }
          
          // Controlla se il compleanno cade nella prossima settimana
          return isWithinInterval(birthDateThisYear, { start: today, end: nextWeek });
        } catch (err) {
          console.error("Errore nel calcolo del compleanno", err);
          return false;
        }
      })
      .sort((a, b) => {
        // Ordina per data di compleanno imminente
        const dateA = parseISO(a.birthDate || "");
        const dateB = parseISO(b.birthDate || "");
        
        const dateAThisYear = setYear(dateA, currentYear);
        const dateBThisYear = setYear(dateB, currentYear);
        
        // Se è già passato quest'anno, usa l'anno prossimo
        const adjustedDateA = dateAThisYear < today 
          ? setYear(dateA, currentYear + 1) 
          : dateAThisYear;
        
        const adjustedDateB = dateBThisYear < today 
          ? setYear(dateB, currentYear + 1) 
          : dateBThisYear;
        
        return adjustedDateA.getTime() - adjustedDateB.getTime();
      });
  }, [clients]);

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 px-4 md:px-6">
        <CardTitle className="text-lg md:text-xl">Compleanni in arrivo</CardTitle>
        <CardDescription>Prossimi 7 giorni</CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : upcomingBirthdays.length > 0 ? (
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-3">
              {upcomingBirthdays.map((client) => {
                // Calcola la data del compleanno e i giorni rimanenti
                const birthDate = parseISO(client.birthDate || "");
                const today = new Date();
                const currentYear = today.getFullYear();
                
                // Converti la data al formato italiano
                const formattedBirthDate = format(birthDate, "d MMMM", { locale: it });
                
                // Calcola il compleanno di quest'anno
                let birthdayThisYear = setYear(birthDate, currentYear);
                
                // Se è già passato, usa l'anno prossimo
                if (birthdayThisYear < today) {
                  birthdayThisYear = setYear(birthDate, currentYear + 1);
                }
                
                // Calcola il tempo rimanente
                const timeUntilBirthday = formatDistance(birthdayThisYear, today, { 
                  addSuffix: false, 
                  locale: it 
                });

                return (
                  <div 
                    key={client.id} 
                    className="flex flex-col p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{client.name} {client.surname}</h4>
                        <p className="text-sm text-primary">
                          Compleanno: {formattedBirthDate} (tra {timeUntilBirthday})
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {client.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{client.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-[100px]">
            <p className="text-muted-foreground">Nessun compleanno nei prossimi 7 giorni</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 