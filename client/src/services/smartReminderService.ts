/**
 * SERVIZIO SMART REMINDER - ISTANZA SINGLETON
 * 
 * Questo file esporta un'istanza singleton del servizio Smart Reminder
 * per essere utilizzata in tutta l'applicazione.
 */

import { SmartReminderService } from '../pages/smartReminder';

// Crea un'istanza singleton del servizio
export const smartReminderService = new SmartReminderService();

// Inizializza automaticamente il servizio al primo import
smartReminderService.initialize().catch(error => {
  console.error('❌ Errore nell\'inizializzazione automatica Smart Reminder Service:', error);
});

export default smartReminderService; 