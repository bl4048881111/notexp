import { useState, useEffect, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { useLocation } from "wouter";
import { 
  Bell, 
  MessageSquare, 
  Calendar,
  Car,
  Clock, 
  Gift,
  User,
  FileText,
  ChevronRight,
  BellRing
} from "lucide-react";

import { 
  getAppointmentsByDate,
  getAllQuotes,
  getAllClients,
  getAllSentMessages,
  getAllWhatsappTemplates
} from "@shared/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReminderItem {
  id: string;
  type: 'reminder_oggi' | 'reminder_domani' | 'preventivo_elaborato' | 'feedback' | 'compleanno';
  clientName: string;
  clientPhone: string;
  targetInfo: string;
  priority: 'alta' | 'media' | 'bassa';
  urgency: string;
  createdAt: Date;
}

export default function RemindersWidget() {
  const [, setLocation] = useLocation();

  // Carica tutti i dati necessari per compilare i reminder
  const { data: todayAppointments = [], isLoading: isLoadingTodayAppts } = useQuery({
    queryKey: ['appointments/today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return await getAppointmentsByDate(today);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: tomorrowAppointments = [], isLoading: isLoadingTomorrowAppts } = useQuery({
    queryKey: ['appointments/tomorrow'], 
    queryFn: async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      return await getAppointmentsByDate(tomorrow);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allQuotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['quotes/all'],
    queryFn: getAllQuotes,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allClients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients/all'],
    queryFn: getAllClients,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sentMessagesArray = [], isLoading: isLoadingSentMessages } = useQuery({
    queryKey: ['sent-messages'],
    queryFn: getAllSentMessages,
    staleTime: 5 * 60 * 1000,
  });

  // Stabilizza il Set dei messaggi inviati usando useMemo
  const sentMessages = useMemo(() => {
    return new Set(sentMessagesArray);
  }, [sentMessagesArray]);

  // Compila la lista dei reminder usando useMemo per evitare re-calcoli inutili
  const reminders = useMemo(() => {
    if (isLoadingTodayAppts || isLoadingTomorrowAppts || isLoadingQuotes || isLoadingClients || isLoadingSentMessages) {
      return [];
    }

    const compiledReminders: ReminderItem[] = [];

    // 1. REMINDER APPUNTAMENTI OGGI
    todayAppointments.forEach(appointment => {
      const reminderKey = `reminder_oggi_${appointment.id}`;
      const shouldAddReminder = appointment.status !== 'completato' && !sentMessages.has(reminderKey);
      
      if (shouldAddReminder) {
        compiledReminders.push({
          id: reminderKey,
          type: 'reminder_oggi',
          clientName: appointment.clientName,
          clientPhone: appointment.phone || '',
          targetInfo: `${appointment.plate} - Appuntamento Oggi`,
          priority: 'alta',
          urgency: 'OGGI',
          createdAt: new Date()
        });
      }
    });

    // 2. REMINDER APPUNTAMENTI DOMANI
    tomorrowAppointments.forEach(appointment => {
      const reminderKey = `reminder_domani_${appointment.id}`;
      const shouldAddReminder = appointment.status !== 'completato' && !sentMessages.has(reminderKey);
      
      if (shouldAddReminder) {
        compiledReminders.push({
          id: reminderKey,
          type: 'reminder_domani',
          clientName: appointment.clientName,
          clientPhone: appointment.phone || '',
          targetInfo: `${appointment.plate} - Appuntamento Domani`,
          priority: 'alta',
          urgency: 'DOMANI',
          createdAt: new Date()
        });
      }
    });

    // 3. PREVENTIVI ELABORATI (inviati nelle ultime 48 ore)
    const sentQuotes = allQuotes.filter(quote => {
      if (quote.status !== 'inviato') return false;
      
      const updatedAt = new Date((quote as any).updatedAt || quote.createdAt || Date.now());
      const now = new Date();
      const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      
      return hoursDiff <= 48 && !sentMessages.has(`preventivo_elaborato_${quote.id}`);
    });

    sentQuotes.forEach(quote => {
      compiledReminders.push({
        id: `preventivo_elaborato_${quote.id}`,
        type: 'preventivo_elaborato',
        clientName: quote.clientName,
        clientPhone: quote.phone || '',
        targetInfo: `${quote.plate} - Preventivo Inviato`,
        priority: 'media',
        urgency: 'PREVENTIVO',
        createdAt: new Date((quote as any).updatedAt || quote.createdAt || Date.now())
      });
    });

    // 4. FEEDBACK (preventivi completati da 2-3 giorni)
    const quotesForFeedback = allQuotes.filter(quote => {
      if (quote.status !== 'completato') return false;
      
      const updatedAt = new Date((quote as any).updatedAt || quote.createdAt || Date.now());
      const now = new Date();
      const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      
      return hoursDiff >= 48 && hoursDiff <= 72 && !sentMessages.has(`feedback_${quote.id}`);
    });

    quotesForFeedback.forEach(quote => {
      compiledReminders.push({
        id: `feedback_${quote.id}`,
        type: 'feedback',
        clientName: quote.clientName,
        clientPhone: quote.phone || '',
        targetInfo: `${quote.plate} - Richiesta Feedback`,
        priority: 'media',
        urgency: 'FEEDBACK',
        createdAt: new Date((quote as any).updatedAt || quote.createdAt || Date.now())
      });
    });

    // 5. COMPLEANNI OGGI
    const today = format(new Date(), 'MM-dd');
    const todayBirthdays = allClients.filter(client => {
      if (!client.birthDate) return false;
      try {
        const birthDate = format(new Date(client.birthDate), 'MM-dd');
        const isToday = birthDate === today;
        const alreadySent = sentMessages.has(`compleanno_${client.id}`);
        return isToday && !alreadySent;
      } catch (error) {
        console.error('Errore nel parsing della data di nascita:', error);
        return false;
      }
    });

    todayBirthdays.forEach(client => {
      compiledReminders.push({
        id: `compleanno_${client.id}`,
        type: 'compleanno',
        clientName: `${client.name} ${client.surname}`,
        clientPhone: client.phone || '',
        targetInfo: 'Compleanno Oggi',
        priority: 'media',
        urgency: 'COMPLEANNO',
        createdAt: new Date()
      });
    });

    // Ordina per priorità e urgenza
    compiledReminders.sort((a, b) => {
      const priorityOrder = { 'alta': 3, 'media': 2, 'bassa': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return compiledReminders;
  }, [
    todayAppointments, 
    tomorrowAppointments, 
    allQuotes, 
    allClients, 
    sentMessages,
    isLoadingTodayAppts,
    isLoadingTomorrowAppts,
    isLoadingQuotes,
    isLoadingClients,
    isLoadingSentMessages
  ]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reminder_oggi':
      case 'reminder_domani':
        return Calendar;
      case 'preventivo_elaborato':
        return FileText;
      case 'feedback':
        return MessageSquare;
      case 'compleanno':
        return Gift;
      default:
        return Bell;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reminder_oggi':
        return 'bg-red-500';
      case 'reminder_domani':
        return 'bg-orange-500';
      case 'preventivo_elaborato':
        return 'bg-blue-500';
      case 'feedback':
        return 'bg-green-500';
      case 'compleanno':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'OGGI':
        return 'bg-red-600 text-white';
      case 'DOMANI':
        return 'bg-orange-600 text-white';
      case 'PREVENTIVO':
        return 'bg-blue-600 text-white';
      case 'FEEDBACK':
        return 'bg-green-600 text-white';
      case 'COMPLEANNO':
        return 'bg-purple-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const isLoading = isLoadingTodayAppts || isLoadingTomorrowAppts || isLoadingQuotes || isLoadingClients || isLoadingSentMessages;

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 px-4 md:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Reminder da Inviare
          </CardTitle>
          {reminders.length > 0 && (
            <Badge variant="destructive">
              {reminders.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-300 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded animate-pulse" />
                  <div className="h-3 bg-gray-300 rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : reminders.length > 0 ? (
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-3">
              {reminders.slice(0, 5).map((reminder) => {
                const IconComponent = getTypeIcon(reminder.type);
                return (
                  <div 
                    key={reminder.id} 
                    className="flex p-3 border rounded-md bg-card hover:bg-accent/20 transition-colors cursor-pointer"
                    onClick={() => setLocation('/smart-reminders')}
                  >
                    <div className={`mr-3 flex items-center justify-center ${getTypeColor(reminder.type)} h-10 w-10 rounded-full shrink-0`}>
                      <IconComponent className="h-4 w-4 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium truncate">{reminder.clientName}</h4>
                        <Badge className={`${getUrgencyColor(reminder.urgency)} text-xs`}>
                          {reminder.urgency}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center mt-1">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                        <p className="text-xs text-muted-foreground truncate">{reminder.targetInfo}</p>
                      </div>
                      
                      {reminder.clientPhone && (
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-muted-foreground">📞 {reminder.clientPhone}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center ml-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
              
              {reminders.length > 5 && (
                <div className="pt-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLocation('/smart-reminders')}
                    className="w-full"
                  >
                    Visualizza tutti i {reminders.length} reminder
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-[100px]">
            <div className="text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Nessun reminder pendente</p>
            </div>
          </div>
        )}
        
        {reminders.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <Button 
              onClick={() => setLocation('/smart-reminders')}
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Gestisci Reminder
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 