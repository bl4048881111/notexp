import { useMemo, useState } from "react";
import { format, addDays, isWithinInterval, setYear, parseISO, formatDistance } from "date-fns";
import { it } from "date-fns/locale";
import { Phone, Mail, CalendarRange, Search } from "lucide-react";
import { getAllClients } from "@shared/supabase";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BirthdaysPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("7"); // default: prossimi 7 giorni

  // Carica tutti i clienti
  const { data: clients = [], isLoading } = useQuery({ 
    queryKey: ['/api/clients/all-birthdays'],
    queryFn: getAllClients,
    staleTime: 1000 * 60 * 5, // Cache per 5 minuti
  });

  // Filtra i clienti che compiranno gli anni nel periodo selezionato
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const daysAhead = parseInt(timeRange);
    const endDate = addDays(today, daysAhead);
    const currentYear = today.getFullYear();
    
    return clients
      .filter(client => {
        // Controlla che il client abbia una data di nascita
        if (!client.birthDate) return false;
        
        try {
          // Controlla se il cliente corrisponde alla ricerca
          const fullName = `${client.name} ${client.surname}`.toLowerCase();
          if (searchQuery && !fullName.includes(searchQuery.toLowerCase()) && 
              !client.phone?.includes(searchQuery) && 
              !client.email?.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
          }
          
          // Converte la data di nascita al formato corretto
          const birthDate = parseISO(client.birthDate);
          
          // Imposta l'anno corrente per la data di nascita
          const birthDateThisYear = setYear(birthDate, currentYear);
          
          // Se il compleanno è già passato quest'anno, controlla l'anno prossimo
          if (birthDateThisYear < today) {
            const birthDateNextYear = setYear(birthDate, currentYear + 1);
            return isWithinInterval(birthDateNextYear, { start: today, end: endDate });
          }
          
          // Controlla se il compleanno cade nel periodo selezionato
          return isWithinInterval(birthDateThisYear, { start: today, end: endDate });
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
  }, [clients, searchQuery, timeRange]);

  // Compleanni di oggi
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
        return false;
      }
    });
  }, [clients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1.5">
        <h2 className="text-2xl font-bold">Gestione Compleanni</h2>
        <p className="text-muted-foreground">
          Monitoraggio dei compleanni dei clienti per inviare auguri e promozioni
        </p>
      </div>
      
      {/* Compleanni di oggi (se presenti) */}
      {todayBirthdays.length > 0 && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Compleanni di Oggi</CardTitle>
            <CardDescription>
              {format(new Date(), 'd MMMM yyyy', { locale: it })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayBirthdays.map((client) => (
                <div 
                  key={client.id} 
                  className="flex p-3 border border-primary rounded-md bg-primary/5"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{client.name} {client.surname}</h4>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {client.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          <span>{client.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controlli di ricerca e filtro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, telefono o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select 
          value={timeRange} 
          onValueChange={(value) => setTimeRange(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Prossimi 7 giorni</SelectItem>
            <SelectItem value="14">Prossimi 14 giorni</SelectItem>
            <SelectItem value="30">Prossimi 30 giorni</SelectItem>
            <SelectItem value="90">Prossimi 3 mesi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabella compleanni in arrivo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            <span>Compleanni in arrivo</span>
          </CardTitle>
          <CardDescription>
            {timeRange === "7" && "Prossimi 7 giorni"}
            {timeRange === "14" && "Prossimi 14 giorni"}
            {timeRange === "30" && "Prossimi 30 giorni"}
            {timeRange === "90" && "Prossimi 3 mesi"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : upcomingBirthdays.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome e Cognome</TableHead>
                    <TableHead>Data di nascita</TableHead>
                    <TableHead>Quando</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingBirthdays.map((client) => {
                    // Calcola la data del compleanno e i giorni rimanenti
                    const birthDate = parseISO(client.birthDate || "");
                    const today = new Date();
                    const currentYear = today.getFullYear();
                    
                    // Formatta la data di nascita originale
                    const originalBirthDate = format(birthDate, "dd/MM/yyyy");
                    
                    // Converti la data del compleanno al formato italiano
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
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.name} {client.surname}
                        </TableCell>
                        <TableCell title={`Anno di nascita: ${birthDate.getFullYear()}`}>
                          {originalBirthDate}
                        </TableCell>
                        <TableCell className="text-primary font-medium">
                          {formattedBirthDate} (tra {timeUntilBirthday})
                        </TableCell>
                        <TableCell>
                          {client.phone || "—"}
                        </TableCell>
                        <TableCell>
                          {client.email || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                Nessun compleanno trovato nel periodo selezionato
                {searchQuery && " con i criteri di ricerca specificati"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 