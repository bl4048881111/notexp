/**
 * HOOK PER L'INTEGRAZIONE AUTOMATICA DEL SISTEMA SMART REMINDER
 * 
 * Questo hook monitora gli eventi del sistema e attiva automaticamente
 * l'invio dei reminder appropriati quando necessario.
 * 
 * Utilizzo:
 * - Importa questo hook nelle pagine dove avvengono i cambi di stato
 * - Chiama il hook per attivare il monitoraggio automatico
 * - I reminder vengono inviati automaticamente in base agli eventi
 */

import { useEffect, useCallback } from 'react';
import { smartReminderService } from '../services/smartReminderService';
import { useToast } from './use-toast';

/**
 * Interfaccia per le opzioni del hook
 */
interface SmartReminderOptions {
  enableAutoReminders?: boolean;     // Abilita i reminder automatici
  enableNotifications?: boolean;     // Mostra notifiche per i reminder inviati
  enableLogging?: boolean;          // Abilita il logging degli eventi
}

/**
 * Hook principale per il sistema Smart Reminder
 */
export const useSmartReminder = (options: SmartReminderOptions = {}) => {
  const {
    enableAutoReminders = true,
    enableNotifications = true,
    enableLogging = true
  } = options;

  const { toast } = useToast();

  /**
   * Gestisce un evento e attiva il reminder appropriato
   */
  const handleEvent = useCallback(async (eventType: string, eventData: any) => {
    if (!enableAutoReminders) return;

    try {
      if (enableLogging) {
        console.log(`🔔 Smart Reminder - Evento ricevuto: ${eventType}`, eventData);
      }

      // Inizializza il servizio se non già fatto
      await smartReminderService.initialize();

      // Processa l'evento
      const success = await smartReminderService.processEvent(eventType, eventData);

      if (success && enableNotifications) {
        toast({
          title: "Reminder Inviato",
          description: `Reminder automatico inviato per: ${eventType}`,
          duration: 3000,
        });
      }

    } catch (error) {
      console.error('❌ Errore nel processamento evento Smart Reminder:', error);
      
      if (enableNotifications) {
        toast({
          title: "Errore Reminder",
          description: "Errore nell'invio del reminder automatico",
          variant: "destructive",
          duration: 3000,
        });
      }
    }
  }, [enableAutoReminders, enableNotifications, enableLogging, toast]);

  /**
   * Metodi specifici per i diversi tipi di eventi
   */
  const triggerQuoteStatusChanged = useCallback((quoteId: string, previousStatus: string, newStatus: string) => {
    handleEvent('quote_status_changed', {
      quoteId,
      previousStatus,
      newStatus
    });
  }, [handleEvent]);

  const triggerAppointmentReminderTomorrow = useCallback((appointmentId: string) => {
    handleEvent('appointment_reminder_tomorrow', {
      appointmentId
    });
  }, [handleEvent]);

  const triggerAppointmentReminderToday = useCallback((appointmentId: string) => {
    handleEvent('appointment_reminder_today', {
      appointmentId
    });
  }, [handleEvent]);

  const triggerClientCreated = useCallback((clientId: string) => {
    handleEvent('client_created', {
      clientId
    });
  }, [handleEvent]);

  const triggerClientBirthday = useCallback((clientId: string) => {
    handleEvent('client_birthday', {
      clientId
    });
  }, [handleEvent]);

  /**
   * Inizializzazione automatica del servizio
   */
  useEffect(() => {
    if (enableAutoReminders) {
      smartReminderService.initialize().catch(error => {
        console.error('❌ Errore inizializzazione Smart Reminder Service:', error);
      });
    }
  }, [enableAutoReminders]);

  /**
   * Listener per eventi personalizzati del sistema
   * Questi eventi possono essere emessi da altre parti dell'applicazione
   */
  useEffect(() => {
    if (!enableAutoReminders) return;

    const handleQuoteUpdated = (event: CustomEvent) => {
      const { quoteId, previousStatus, newStatus } = event.detail;
      if (previousStatus && newStatus && previousStatus !== newStatus) {
        triggerQuoteStatusChanged(quoteId, previousStatus, newStatus);
      }
    };

    const handleAppointmentCreated = (event: CustomEvent) => {
      const { appointmentId } = event.detail;
      // Potrebbe essere utile per reminder futuri
      if (enableLogging) {
        console.log('📅 Nuovo appuntamento creato:', appointmentId);
      }
    };

    const handleClientRegistered = (event: CustomEvent) => {
      const { clientId } = event.detail;
      triggerClientCreated(clientId);
    };

    // Registra i listener
    window.addEventListener('quoteUpdated', handleQuoteUpdated as EventListener);
    window.addEventListener('appointmentCreated', handleAppointmentCreated as EventListener);
    window.addEventListener('clientRegistered', handleClientRegistered as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('quoteUpdated', handleQuoteUpdated as EventListener);
      window.removeEventListener('appointmentCreated', handleAppointmentCreated as EventListener);
      window.removeEventListener('clientRegistered', handleClientRegistered as EventListener);
    };
  }, [enableAutoReminders, triggerQuoteStatusChanged, triggerClientCreated, enableLogging]);

  // Ritorna i metodi per l'uso manuale
  return {
    // Metodi per triggering manuale
    triggerQuoteStatusChanged,
    triggerAppointmentReminderTomorrow,
    triggerAppointmentReminderToday,
    triggerClientCreated,
    triggerClientBirthday,

    // Metodo generico per eventi custom
    handleEvent,

    // Metodi di utilità
    initializeService: () => smartReminderService.initialize(),
    runDailyChecks: async () => {
      const [tomorrowCount, todayCount, birthdayCount] = await Promise.all([
        smartReminderService.checkAndSendTomorrowReminders(),
        smartReminderService.checkAndSendTodayReminders(),
        smartReminderService.checkAndSendBirthdayReminders()
      ]);
      
      if (enableNotifications) {
        toast({
          title: "Controlli Giornalieri Completati",
          description: `Inviati: ${tomorrowCount} reminder domani, ${todayCount} reminder oggi, ${birthdayCount} auguri`,
        });
      }
      
      return { tomorrowCount, todayCount, birthdayCount };
    }
  };
};

/**
 * Hook semplificato per l'uso basic del sistema
 */
export const useSmartReminderBasic = () => {
  return useSmartReminder({
    enableAutoReminders: true,
    enableNotifications: false,
    enableLogging: false
  });
};

/**
 * Hook per debugging e sviluppo
 */
export const useSmartReminderDebug = () => {
  return useSmartReminder({
    enableAutoReminders: true,
    enableNotifications: true,
    enableLogging: true
  });
}; 