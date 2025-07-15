/**
 * SISTEMA DI REMINDER INTELLIGENTE
 * 
 * Questo servizio gestisce l'invio automatico di messaggi WhatsApp personalizzati
 * basandosi sui cambiamenti di stato dei preventivi e degli appuntamenti.
 * 
 * TRIGGER AUTOMATICI SUPPORTATI:
 * 
 * 1. PREVENTIVO ELABORATO
 *    - Trigger: Preventivo passa da "inviato" ad "accettato" 
 *    - Messaggio: Conferma elaborazione preventivo
 * 
 * 2. CONFERMA APPUNTAMENTO CHECKUP
 *    - Trigger: Preventivo passa da "accettato" a "programmato"
 *    - Messaggio: Conferma appuntamento per checkup
 * 
 * 3. REMINDER APPUNTAMENTO DOMANI
 *    - Trigger: Giorno -1 dall'appuntamento (ore 18:00)
 *    - Messaggio: Promemoria appuntamento il giorno successivo
 * 
 * 4. REMINDER APPUNTAMENTO OGGI
 *    - Trigger: Giorno dell'appuntamento (ore 9:00)
 *    - Messaggio: Promemoria appuntamento nella giornata
 * 
 * 5. CHIUSURA LAVORO + FEEDBACK
 *    - Trigger: Preventivo passa a "completato"
 *    - Messaggio: Lavoro completato + richiesta feedback
 * 
 * 6. CREDENZIALI NUOVO CLIENTE
 *    - Trigger: Creazione nuovo cliente nel sistema
 *    - Messaggio: Benvenuto + credenziali accesso portale
 * 
 * 7. COMPLEANNO
 *    - Trigger: Giorno del compleanno del cliente
 *    - Messaggio: Auguri personalizzati
 */

import { 
  getAllWhatsappTemplates, 
  getAllQuotes, 
  getAllAppointments, 
  getAllClients,
  getAppointmentById,
  getQuoteById,
  getClientById
} from '../../../shared/supabase';

/**
 * Tipi di reminder supportati dal sistema
 */
export enum ReminderType {
  PREVENTIVO_ELABORATO = 'preventivo_elaborato',
  CONFERMA_APPUNTAMENTO = 'conferma_appuntamento', 
  REMINDER_DOMANI = 'reminder_domani',
  REMINDER_OGGI = 'reminder_oggi',
  CHIUSURA_LAVORO = 'chiusura_lavoro',
  CREDENZIALI_CLIENTE = 'credenziali_cliente',
  COMPLEANNO = 'compleanno'
}

/**
 * Interfaccia per i dati del reminder
 */
interface ReminderData {
  type: ReminderType;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  appointmentId?: string;
  quoteId?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  birthDate?: string;
  additionalData?: any;
}

/**
 * Interfaccia per i template con variabili sostituite
 */
interface ProcessedTemplate {
  title: string;
  content: string;
  variables: { [key: string]: string };
}

/**
 * CLASSE PRINCIPALE PER IL SISTEMA DI REMINDER INTELLIGENTE
 */
export class SmartReminderService {
  private templates: any[] = [];
  private clients: any[] = [];
  private quotes: any[] = [];
  private appointments: any[] = [];

  /**
   * Inizializza il servizio caricando tutti i dati necessari
   */
  async initialize(): Promise<void> {
    try {
      
      
      // Carica tutti i dati dal database
      [this.templates, this.clients, this.quotes, this.appointments] = await Promise.all([
        getAllWhatsappTemplates(),
        getAllClients(),
        getAllQuotes(),
        getAllAppointments()
      ]);

    } catch (error) {
      throw error;
    }
  }

  /**
   * METODO PRINCIPALE - Elabora un evento e invia il reminder appropriato
   */
  async processEvent(eventType: string, eventData: any): Promise<boolean> {
    try {
      console.log(`🔔 Elaborazione evento: ${eventType}`, eventData);

      // Determina il tipo di reminder basandosi sull'evento
      const reminderType = this.mapEventToReminderType(eventType, eventData);
      
      if (!reminderType) {
        console.log(`ℹ️ Nessun reminder configurato per l'evento: ${eventType}`);
        return false;
      }

      // Ottieni i dati del reminder
      const reminderData = await this.buildReminderData(reminderType, eventData);
      
      if (!reminderData) {
        console.log(`⚠️ Impossibile costruire i dati del reminder per: ${reminderType}`);
        return false;
      }

      // Trova e processa il template appropriato
      const processedTemplate = await this.findAndProcessTemplate(reminderType, reminderData);
      
      if (!processedTemplate) {
        console.log(`⚠️ Nessun template trovato per: ${reminderType}`);
        return false;
      }

      // Invia il messaggio
      const success = await this.sendReminder(reminderData, processedTemplate);
      
      if (success) {
        console.log(`✅ Reminder inviato con successo: ${reminderType} per ${reminderData.clientName}`);
        // Qui potresti loggare l'invio nel database per tracking
        await this.logReminderSent(reminderData, processedTemplate);
      }

      return success;

    } catch (error) {
      console.error('❌ Errore nell\'elaborazione evento:', error);
      return false;
    }
  }

  /**
   * Mappa gli eventi del sistema ai tipi di reminder
   */
  private mapEventToReminderType(eventType: string, eventData: any): ReminderType | null {
    switch (eventType) {
      case 'quote_status_changed':
        if (eventData.previousStatus === 'inviato' && eventData.newStatus === 'accettato') {
          return ReminderType.PREVENTIVO_ELABORATO;
        }
        if (eventData.previousStatus === 'accettato' && eventData.newStatus === 'programmato') {
          return ReminderType.CONFERMA_APPUNTAMENTO;
        }
        if (eventData.newStatus === 'completato') {
          return ReminderType.CHIUSURA_LAVORO;
        }
        break;

      case 'appointment_reminder_tomorrow':
        return ReminderType.REMINDER_DOMANI;

      case 'appointment_reminder_today':
        return ReminderType.REMINDER_OGGI;

      case 'client_created':
        return ReminderType.CREDENZIALI_CLIENTE;

      case 'client_birthday':
        return ReminderType.COMPLEANNO;

      default:
        return null;
    }

    return null;
  }

  /**
   * Costruisce i dati del reminder basandosi sul tipo e sui dati dell'evento
   */
  private async buildReminderData(reminderType: ReminderType, eventData: any): Promise<ReminderData | null> {
    try {
      let clientId: string;
      let appointmentId: string | undefined;
      let quoteId: string | undefined;

      // Determina gli ID necessari basandosi sul tipo di evento
      switch (reminderType) {
        case ReminderType.PREVENTIVO_ELABORATO:
        case ReminderType.CONFERMA_APPUNTAMENTO:
        case ReminderType.CHIUSURA_LAVORO:
          quoteId = eventData.quoteId;
          if (!quoteId) return null;
          const quote = await getQuoteById(quoteId);
          if (!quote) return null;
          clientId = quote.clientId;
          // Cerca appuntamento associato
          appointmentId = this.appointments.find(app => app.quoteId === quoteId)?.id;
          break;

        case ReminderType.REMINDER_DOMANI:
        case ReminderType.REMINDER_OGGI:
          appointmentId = eventData.appointmentId;
          if (!appointmentId) return null;
          const appointment = await getAppointmentById(appointmentId);
          if (!appointment) return null;
          clientId = appointment.clientId;
          quoteId = appointment.quoteId;
          break;

        case ReminderType.CREDENZIALI_CLIENTE:
        case ReminderType.COMPLEANNO:
          clientId = eventData.clientId;
          break;

        default:
          return null;
      }

      // Ottieni i dati del cliente
      const client = await getClientById(clientId);
      if (!client) {
        console.log(`⚠️ Cliente non trovato: ${clientId}`);
        return null;
      }

      // Costruisci l'oggetto ReminderData
      const reminderData: ReminderData = {
        type: reminderType,
        clientId: clientId,
        clientName: `${client.name} ${client.surname}`.trim(),
        clientPhone: client.phone,
        clientEmail: client.email,
        appointmentId,
        quoteId,
        birthDate: client.birthDate,
        additionalData: eventData
      };

      // Aggiungi dati specifici dell'appuntamento se disponibili
      if (appointmentId) {
        const appointment = await getAppointmentById(appointmentId);
        if (appointment) {
          reminderData.appointmentDate = appointment.date;
          reminderData.appointmentTime = appointment.time;
          // Usa 'plate' invece di 'vehiclePlate' e per ora lasciamo vehicleModel vuoto
          reminderData.vehiclePlate = appointment.plate;
          reminderData.vehicleModel = ''; // Campo non disponibile nell'interfaccia Appointment attuale
        }
      }

      return reminderData;

    } catch (error) {
      console.error('❌ Errore nella costruzione dati reminder:', error);
      return null;
    }
  }

  /**
   * Trova il template appropriato e sostituisce le variabili
   */
  private async findAndProcessTemplate(reminderType: ReminderType, reminderData: ReminderData): Promise<ProcessedTemplate | null> {
    try {
      // Mappa i tipi di reminder alle categorie dei template
      const categoryMap: { [key in ReminderType]: string } = {
        [ReminderType.PREVENTIVO_ELABORATO]: 'preventivi',
        [ReminderType.CONFERMA_APPUNTAMENTO]: 'appuntamenti',
        [ReminderType.REMINDER_DOMANI]: 'promemoria',
        [ReminderType.REMINDER_OGGI]: 'promemoria',
        [ReminderType.CHIUSURA_LAVORO]: 'completato',
        [ReminderType.CREDENZIALI_CLIENTE]: 'generale',
        [ReminderType.COMPLEANNO]: 'cortesia'
      };

      const category = categoryMap[reminderType];
      
      // Trova template specifici per il tipo di reminder
      const candidateTemplates = this.templates.filter(template => {
        if (template.category !== category) return false;
        
        // Logica specifica per trovare il template giusto
        const titleLower = template.title.toLowerCase();
        
        switch (reminderType) {
          case ReminderType.PREVENTIVO_ELABORATO:
            return titleLower.includes('preventivo') && titleLower.includes('elaborato');
            
          case ReminderType.CONFERMA_APPUNTAMENTO:
            return titleLower.includes('conferma') && titleLower.includes('appuntamento');
            
          case ReminderType.REMINDER_DOMANI:
            return titleLower.includes('reminder') && titleLower.includes('domani');
            
          case ReminderType.REMINDER_OGGI:
            return titleLower.includes('reminder') && titleLower.includes('oggi');
            
          case ReminderType.CHIUSURA_LAVORO:
            return titleLower.includes('chiusura') || titleLower.includes('completato');
            
          case ReminderType.CREDENZIALI_CLIENTE:
            return titleLower.includes('credenziali') || titleLower.includes('benvenuto');
            
          case ReminderType.COMPLEANNO:
            return titleLower.includes('compleanno') || titleLower.includes('auguri');
            
          default:
            return false;
        }
      });

      if (candidateTemplates.length === 0) {
        console.log(`⚠️ Nessun template trovato per categoria: ${category}, tipo: ${reminderType}`);
        return null;
      }

      // Prendi il primo template trovato (ordinati per idgil)
      const template = candidateTemplates[0];

      // Sostituisci le variabili nel contenuto
      const processedContent = this.replaceVariables(template.content, reminderData);

      return {
        title: template.title,
        content: processedContent,
        variables: this.extractVariables(reminderData)
      };

    } catch (error) {
      console.error('❌ Errore nella ricerca/elaborazione template:', error);
      return null;
    }
  }

  /**
   * Sostituisce le variabili nel testo del template
   */
  private replaceVariables(content: string, reminderData: ReminderData): string {
    let processedContent = content;

    // Variabili standard disponibili per tutti i template
    const variables: { [key: string]: string } = {
      '{{nome}}': reminderData.clientName.split(' ')[0] || '',
      '{{nome_completo}}': reminderData.clientName,
      '{{cognome}}': reminderData.clientName.split(' ').slice(1).join(' ') || '',
      '{{data_appuntamento}}': reminderData.appointmentDate ? this.formatDate(reminderData.appointmentDate) : '',
      '{{ora_appuntamento}}': reminderData.appointmentTime || '',
      '{{modello_veicolo}}': reminderData.vehicleModel || '',
      '{{targa}}': reminderData.vehiclePlate || '',
      '{{email}}': reminderData.clientEmail || '',
      '{{telefono}}': reminderData.clientPhone || '',
      '{{data_oggi}}': this.formatDate(new Date().toISOString()),
      '{{data_domani}}': this.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    };

    // Sostituisci tutte le variabili trovate
    for (const [variable, value] of Object.entries(variables)) {
      processedContent = processedContent.replace(new RegExp(variable, 'g'), value);
    }

    return processedContent;
  }

  /**
   * Estrae le variabili utilizzate per logging
   */
  private extractVariables(reminderData: ReminderData): { [key: string]: string } {
    return {
      clientName: reminderData.clientName,
      appointmentDate: reminderData.appointmentDate || '',
      appointmentTime: reminderData.appointmentTime || '',
      vehicleModel: reminderData.vehicleModel || '',
      vehiclePlate: reminderData.vehiclePlate || ''
    };
  }

  /**
   * Formatta una data in formato italiano
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Simula l'invio del reminder (qui integreresti con WhatsApp API)
   */
  private async sendReminder(reminderData: ReminderData, template: ProcessedTemplate): Promise<boolean> {
    try {
      console.log('📱 INVIO REMINDER SIMULATO:');
      console.log(`📞 Destinatario: ${reminderData.clientName} (${reminderData.clientPhone})`);
      console.log(`📝 Template: ${template.title}`);
      console.log(`💬 Messaggio: ${template.content}`);
      
      // Qui implementeresti l'integrazione reale con WhatsApp Business API
      // Per ora simuliamo un invio con successo
      
      // Simula delay di invio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'invio del reminder:', error);
      return false;
    }
  }

  /**
   * Registra l'invio del reminder nel database per tracking
   */
  private async logReminderSent(reminderData: ReminderData, template: ProcessedTemplate): Promise<void> {
    try {
      // Qui implementeresti il logging nel database
      console.log('📊 LOGGING REMINDER INVIATO:', {
        type: reminderData.type,
        clientId: reminderData.clientId,
        clientName: reminderData.clientName,
        templateTitle: template.title,
        sentAt: new Date().toISOString(),
        appointmentId: reminderData.appointmentId,
        quoteId: reminderData.quoteId
      });
    } catch (error) {
      console.error('❌ Errore nel logging del reminder:', error);
    }
  }

  /**
   * METODI PUBBLICI PER L'INVIO MANUALE DI REMINDER
   */

  /**
   * Invia reminder manuale per preventivo elaborato
   */
  async sendPreventivoElaboratoReminder(quoteId: string): Promise<boolean> {
    return this.processEvent('quote_status_changed', {
      quoteId,
      previousStatus: 'inviato',
      newStatus: 'accettato'
    });
  }

  /**
   * Invia reminder manuale per conferma appuntamento
   */
  async sendConfermaAppuntamentoReminder(quoteId: string): Promise<boolean> {
    return this.processEvent('quote_status_changed', {
      quoteId,
      previousStatus: 'draft',
      newStatus: 'inviato'
    });
  }

  /**
   * Invia reminder manuale per appuntamento domani
   */
  async sendReminderDomani(appointmentId: string): Promise<boolean> {
    return this.processEvent('appointment_reminder_tomorrow', {
      appointmentId
    });
  }

  /**
   * Invia reminder manuale per appuntamento oggi
   */
  async sendReminderOggi(appointmentId: string): Promise<boolean> {
    return this.processEvent('appointment_reminder_today', {
      appointmentId
    });
  }

  /**
   * Invia reminder manuale per lavoro completato
   */
  async sendChiusuraLavoroReminder(quoteId: string): Promise<boolean> {
    return this.processEvent('quote_status_changed', {
      quoteId,
      newStatus: 'completato'
    });
  }

  /**
   * Invia reminder manuale per nuovo cliente
   */
  async sendCredenzialiClienteReminder(clientId: string): Promise<boolean> {
    return this.processEvent('client_created', {
      clientId
    });
  }

  /**
   * Invia reminder manuale per compleanno
   */
  async sendCompleanneoReminder(clientId: string): Promise<boolean> {
    return this.processEvent('client_birthday', {
      clientId
    });
  }

  /**
   * SISTEMA DI SCHEDULING AUTOMATICO
   * Questi metodi verrebbero chiamati da un cron job o task scheduler
   */

  /**
   * Controlla e invia reminder per appuntamenti di domani
   */
  async checkAndSendTomorrowReminders(): Promise<number> {
    let sentCount = 0;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    for (const appointment of this.appointments) {
      if (appointment.date === tomorrowString && appointment.status !== 'completato') {
        const success = await this.sendReminderDomani(appointment.id);
        if (success) sentCount++;
      }
    }

    console.log(`📅 Inviati ${sentCount} reminder per appuntamenti di domani`);
    return sentCount;
  }

  /**
   * Controlla e invia reminder per appuntamenti di oggi
   */
  async checkAndSendTodayReminders(): Promise<number> {
    let sentCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const appointment of this.appointments) {
      if (appointment.date === today && appointment.status !== 'completato') {
        const success = await this.sendReminderOggi(appointment.id);
        if (success) sentCount++;
      }
    }

    console.log(`📅 Inviati ${sentCount} reminder per appuntamenti di oggi`);
    return sentCount;
  }

  /**
   * Controlla e invia auguri di compleanno
   */
  async checkAndSendBirthdayReminders(): Promise<number> {
    let sentCount = 0;
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    for (const client of this.clients) {
      if (client.birthDate) {
        const birthDate = new Date(client.birthDate);
        if (birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDay) {
          const success = await this.sendCompleanneoReminder(client.id);
          if (success) sentCount++;
        }
      }
    }

    console.log(`🎂 Inviati ${sentCount} auguri di compleanno`);
    return sentCount;
  }
}

/**
 * ISTANZA SINGLETON DEL SERVIZIO
 */
export const smartReminderService = new SmartReminderService(); 