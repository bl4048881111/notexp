import { useMemo } from "react";
import { format, setYear, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Phone, Mail, Cake } from "lucide-react";
import { getAllClients } from "@shared/firebase";
import { useQuery } from "@tanstack/react-query";
import { Client } from "@shared/types";
import { useLocation } from "wouter";

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function TodayBirthdaysWidget() {
  const [, setLocation] = useLocation();
  
  // Carica tutti i clienti
  const { data: clients = [], isLoading } = useQuery({ 
    queryKey: ['/api/clients/all-birthdays'],
    queryFn: getAllClients,
    staleTime: 1000 * 60 * 5, // Cache per 5 minuti
  });

  // Filtra i clienti che compiranno gli anni oggi
  const todayBirthdays = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    return clients.filter(client => {
      if (!client.birthDate) return false;
      
      try {
        const birthDate = parseISO(client.birthDate);
        const birthDateThisYear = setYear(birthDate, currentYear);
        
        return (
          birthDateThisYear.getDate() === today.getDate() &&
          birthDateThisYear.getMonth() === today.getMonth()
        );
      } catch (err) {
        console.error("Errore nel calcolo del compleanno", err);
        return false;
      }
    });
  }, [clients]);

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 px-4 md:px-6">
        <CardTitle className="text-lg md:text-xl flex items-center gap-2">
          <Cake className="h-5 w-5 text-primary" />
          <span>Compleanno</span>
        </CardTitle>
        <CardDescription>
          {format(new Date(), 'd MMMM yyyy', { locale: it })}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array(2).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : todayBirthdays.length > 0 ? (
          <div className="space-y-3">
            {todayBirthdays.map((client) => (
              <div 
                key={client.id} 
                className="flex p-3 border border-primary/40 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium">{client.name} {client.surname}</h4>
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
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[100px]">
            <p className="text-muted-foreground">Nessun compleanno oggi</p>
          </div>
        )}
      </CardContent>
      {todayBirthdays.length > 0 && (
        <CardFooter className="pt-0 px-4 md:px-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setLocation('/compleanni')}
          >
            Vedi tutti i compleanni
          </Button>
        </CardFooter>
      )}
    </Card>
  );
} 