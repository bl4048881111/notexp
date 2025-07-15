/**
 * PAGINA SMART REMINDER - VERSIONE COMPLETA
 * 
 * Gestisce tutti i tipi di reminder automatici:
 * 1. Preventivo Elaborato (preventivi → accettato)
 * 2. Conferma Appuntamento CheckUp (preventivi → programmato)  
 * 3. Reminder Domani (giorno -1)
 * 4. Reminder Oggi (giorno stesso)
 * 5. Chiusura Lavoro + Feedback (preventivi → completato)
 * 6. Credenziali Nuovo Cliente
 * dopo 15 giorni
 * 7. Compleanno
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  Copy, 
  Calendar,
  MessageSquare,
  User,
  Phone,
  Car,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle,
  FileText,
  Gift,
  UserPlus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  getAppointmentsByDate, 
  getAllWhatsappTemplates,
  getAllQuotes,
  getAllClients,
  getAllSentMessages,
  getAllSentMessagesWithDetails,
  markMessageAsSent,
  unmarkMessageAsSent,
  getAllWorkSessions,
  getAllAppointments
} from '../../../shared/supabase';
import { useLocation } from 'wouter';

/**
 * Interfaccia per un messaggio compilato
 */
interface CompiledMessage {
  id: string;
  type: 'preventivo_elaborato' | 'conferma_appuntamento' | 'reminder_oggi' | 'reminder_domani' | 'chiusura_lavoro' | 'feedback' | 'credenziali_cliente' | 'compleanno' | 'reminder_15giorni';
  clientName: string;
  clientPhone: string;
  targetInfo: string; // Targa, data appuntamento, etc.
  templateTitle: string;
  compiledMessage: string;
  priority: 'alta' | 'media' | 'bassa';
  urgency: string;
  sent: boolean; // Nuovo campo per tracciare se è stato inviato
  sentAt?: Date; // Data di invio del messaggio
  sentBy?: string; // Utente che ha inviato il messaggio
}

export default function SmartReminderPage() {
  // Stati per la gestione della pagina
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [tomorrowAppointments, setTomorrowAppointments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [compiledMessages, setCompiledMessages] = useState<CompiledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Stato per tracciare i messaggi inviati - ora casiato da Supabase
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());
  
  // Stato per i dettagli dei messaggi inviati (ID + data invio)
  const [sentMessagesDetails, setSentMessagesDetails] = useState<Map<string, Date>>(new Map());
  
  // Stato per il collasso del menu messaggi completati
  const [showCompletedMessages, setShowCompletedMessages] = useState(false);

  const { toast } = useToast();
  const [location] = useLocation();

  /**
   * Formatta una data in formato italiano
   */
  const formatDate = (dateString: string): string => {
    if (!dateString || dateString === 'Da definire') return 'Da definire';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn(`Data non valida: ${dateString}`);
        return 'Da definire';
      }
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.warn(`Errore nella formattazione della data: ${dateString}`, error);
      return 'Da definire';
    }
  };

  /**
   * SISTEMA DI COMPILAZIONE TEMPLATE WHATSAPP
   */
  const compileTemplate = (templateContent: string, data: any): string => {
    let compiled = templateContent;

    // Estrai nome e cognome
    const nameParts = data.clientName ? data.clientName.split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Mappa delle variabili disponibili
    const variables: { [key: string]: string } = {
      // Formato con parentesi graffe
      '{{nome}}': firstName,
      '{{nome_completo}}': data.clientName || '',
      '{{cognome}}': lastName,
      '{{data_appuntamento}}': data.appointmentDate ? formatDate(data.appointmentDate) : '',
      '{{ora_appuntamento}}': data.appointmentTime || '',
      '{{targa}}': data.plate || '',
      '{{modello_veicolo}}': data.model || '',
      '{{telefono}}': data.phone || '',
      '{{email}}': data.email || '',
      '{{password}}': data.password || '',
      '{{data_oggi}}': formatDate(new Date().toISOString()),
      '{{data_domani}}': formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
      '{{indirizzo}}': data.address || '',
      '{{ora}}': data.appointmentTime || '',
      '{{eta}}': data.eta || '',
      '{{anni}}': data.anni || '',
      
      // Formato con asterischi
      '*Nome*': firstName,
      '*nome*': firstName,
      '*nome_completo*': data.clientName || '',
      '*cognome*': lastName,
      '*data_appuntamento*': data.appointmentDate ? formatDate(data.appointmentDate) : '',
      '*ora_appuntamento*': data.appointmentTime || '',
      '*ora*': data.appointmentTime || '',
      '*targa*': data.plate || '',
      '*modello_veicolo*': data.model || '',
      '*telefono*': data.phone || '',
      '*email*': data.email || '',
      '*password*': data.password || '',
      '*data_oggi*': formatDate(new Date().toISOString()),
      '*data_domani*': formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
      '*indirizzo*': data.address || '',
      '*eta*': data.eta || '',
      '*anni*': data.anni || ''
    };

    // Sostituisci tutte le variabili
    for (const [variable, value] of Object.entries(variables)) {
      compiled = compiled.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return compiled;
  };

  /**
   * Trova il template appropriato per categoria e tipo
   */
  const findTemplate = (category: string, keywords: string[], fallbackKeywords: string[] = []): any | null => {
      // console.log(`🔍 Cerco template per categoria: ${category}, keywords: ${keywords.join(', ')}`);
      
      // Cerca template specifici per la categoria
      const categoryTemplates = templates.filter(t => t.category === category);
      // console.log(`📂 Template trovati per categoria "${category}": ${categoryTemplates.length}`);
      
      if (categoryTemplates.length === 0) {
        // console.log(`⚠️ Nessun template trovato per categoria "${category}"`);
        return null;
      }

    // Prima cerca con le keywords principali
    for (const template of categoryTemplates) {
      const titleLower = (template.title || '').toLowerCase();
      const contentLower = (template.content || '').toLowerCase();
      
      const hasKeyword = keywords.some(keyword => 
        titleLower.includes(keyword.toLowerCase()) || 
        contentLower.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        // console.log(`✅ Template trovato: "${template.title}" per keywords: ${keywords.join(', ')}`);
        return template;
      }
    }

    // Se non trova nulla, prova con le fallback keywords
    if (fallbackKeywords.length > 0) {
      for (const template of categoryTemplates) {
        const titleLower = (template.title || '').toLowerCase();
        const contentLower = (template.content || '').toLowerCase();
        
        const hasFallbackKeyword = fallbackKeywords.some(keyword => 
          titleLower.includes(keyword.toLowerCase()) || 
          contentLower.includes(keyword.toLowerCase())
        );
        
        if (hasFallbackKeyword) {
          // console.log(`✅ Template trovato con fallback: "${template.title}" per keywords: ${fallbackKeywords.join(', ')}`);
          return template;
        }
      }
    }
    
    // Se non trova nulla, prende il primo della categoria
    const fallbackTemplate = categoryTemplates[0];
    // console.log(`⚡ Uso template di fallback: "${fallbackTemplate?.title}" per categoria "${category}"`);
    return fallbackTemplate;
  };

  /**
   * Carica i messaggi inviati da Supabase con tutti i dettagli
   */
  const loadSentMessagesFromDB = async (): Promise<{sentSet: Set<string>, detailsMap: Map<string, Date>}> => {
    try {
      // console.log('📧 Caricamento messaggi inviati dal database...');
      const sentMessagesWithDetails = await getAllSentMessagesWithDetails();
      // console.log(`📧 Caricati ${sentMessagesWithDetails.length} messaggi inviati dal database:`);
      
      // Log dettagliato per il debug
      sentMessagesWithDetails.forEach(msg => {
        // console.log(`  - ${msg.message_id} inviato il ${msg.sent_at}`);
      });
      
      const sentSet = new Set(sentMessagesWithDetails.map(msg => msg.message_id));
      const detailsMap = new Map(
        sentMessagesWithDetails.map(msg => [msg.message_id, new Date(msg.sent_at)])
      );
      
      setSentMessages(sentSet);
      setSentMessagesDetails(detailsMap);
      
      return { sentSet, detailsMap };
    } catch (error) {
      console.error('❌ Errore caricamento messaggi inviati:', error);
      return { sentSet: new Set(), detailsMap: new Map() };
    }
  };

  /**
   * Carica e compila tutti i messaggi - VERSIONE ROBUSTA
   */
  const loadAndCompileMessages = async (): Promise<number> => {
    try {
      setIsLoading(true);
      // console.log('🚀 Inizio caricamento SmartReminder...');
      
      // Ottieni date di oggi e domani
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // console.log('📅 Date di ricerca:', { today, tomorrow });

      // Carica tutti i dati in parallelo con gestione errori
      const results = await Promise.all([
        getAppointmentsByDate(today).catch(() => []),
        getAppointmentsByDate(tomorrow).catch(() => []),
        getAllQuotes().catch(() => []),
        getAllClients().catch(() => []),
        getAllWhatsappTemplates().catch(() => []),
        getAllWorkSessions().catch(() => []),
        loadSentMessagesFromDB().catch(() => ({ sentSet: new Set(), detailsMap: new Map() })),
        getAllAppointments().catch(() => []),
      ]);
      const todayAppts = results[0];
      const tomorrowAppts = results[1];
      const allQuotes = results[2];
      const allClients = results[3];
      const allTemplates = results[4];
      const allWorkSessions = results[5];
      const sentMessagesData = results[6];
      const allAppointments = results[7];

      const sentMessagesSet = sentMessagesData.sentSet;
      const sentMessagesDetailsMap = sentMessagesData.detailsMap;

      // Filtra solo appuntamenti futuri (incluso oggi)
      const nowDate = new Date(today);
      const futureAppointments = allAppointments.filter(app => {
        try {
          const appDate = new Date(app.date);
          return appDate >= nowDate;
        } catch {
          return false;
        }
      });
      // console.log('📊 Appuntamenti futuri trovati:', futureAppointments.length);

      // console.log('📊 Dati caricati:', {
      //   todayAppts: todayAppts.length,
      //   tomorrowAppts: tomorrowAppts.length,
      //   quotes: allQuotes.length,
      //   clients: allClients.length,
      //   templates: allTemplates.length,
      //   workSessions: allWorkSessions.length,
      //   sentMessages: sentMessagesSet.size
      // });

      setTodayAppointments(todayAppts || []);
      setTomorrowAppointments(tomorrowAppts || []);
      setQuotes(allQuotes || []);
      setClients(allClients || []);
      setTemplates(allTemplates || []);

      // Compila tutti i messaggi
      const messages: CompiledMessage[] = [];

      // 1. PREVENTIVO ELABORATO (quando preventivo passa da "bozza" a "inviato")
      const sentQuotes = allQuotes.filter(quote => {
        if (quote.status !== 'inviato') return false;
        
        const updatedAt = new Date((quote as any).updatedAt || quote.createdAt || Date.now());
        const now = new Date();
        const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
        
        return hoursDiff <= 48;
      });

      for (const quote of sentQuotes) {
        let template = allTemplates.find(t => 
          t.title?.toLowerCase().includes('preventivo') && 
          (t.title?.toLowerCase().includes('elaborato') || t.title?.toLowerCase().includes('inviato'))
        );
        
        if (!template) {
          template = findTemplate('preventivi', ['elaborato', 'inviato', 'preventivo elaborato'], ['preventivo', 'inviato']);
        }
        
        if (template) {
          const compiledMessage = compileTemplate(template.content, {
            clientName: quote.clientName,
            plate: quote.plate,
            model: quote.model || '',
            phone: quote.phone
          });
          
          messages.push({
            id: `preventivo_elaborato_${quote.id}`,
            type: 'preventivo_elaborato',
            clientName: quote.clientName,
            clientPhone: quote.phone,
            targetInfo: `${quote.plate} - Preventivo Elaborato`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'alta',
            urgency: 'PREVENTIVO ELABORATO',
            sent: sentMessagesSet.has(`preventivo_elaborato_${quote.id}`),
            sentAt: sentMessagesDetailsMap.get(`preventivo_elaborato_${quote.id}`)
          });
        }
      }

      // 1B. PREVENTIVO INVIATO DA 15 GIORNI (Reminder)
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      
      const oldSentQuotes = allQuotes.filter(quote => {
        if (quote.status !== 'inviato') return false;
        const updatedAt = new Date((quote as any).updatedAt || quote.createdAt || Date.now());
        return updatedAt <= fifteenDaysAgo;
      });

      for (const quote of oldSentQuotes) {
        // Usa il template specifico per il reminder 15 giorni, oppure uno generico
        let template = allTemplates.find(t =>
          t.title?.toLowerCase().includes('preventivi') &&
          t.title?.toLowerCase().includes('15')
        );
        if (!template) {
          template = findTemplate('preventivi', ['reminder15giorni', '15', 'giorni'], ['reminder', 'preventivo']);
        }
        if (template) {
          const compiledMessage = compileTemplate(template.content, {
            clientName: quote.clientName,
            plate: quote.plate,
            model: quote.model || '',
            phone: quote.phone
          });

          messages.push({
            id: `reminder_15giorni_${quote.id}`,
            type: 'reminder_15giorni',
            clientName: quote.clientName,
            clientPhone: quote.phone,
            targetInfo: `${quote.plate} - Reminder 15 Giorni`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'media',
            urgency: 'REMINDER 15 GIORNI',
            sent: sentMessagesSet.has(`reminder_15giorni_${quote.id}`),
            sentAt: sentMessagesDetailsMap.get(`reminder_15giorni_${quote.id}`)
          });
        }
      }

      // 2. CONFERMA APPUNTAMENTO CHECKUP (preventivi accettati di recente)
      const allAcceptedQuotes = allQuotes.filter(quote => {
        if (quote.status !== 'accettato') return false;
        
        const updatedAt = (quote as any).updatedAt;
        if (!updatedAt) return false;
        
        const updatedDate = new Date(updatedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60);
        
        return hoursDiff <= 48;
      });

      // 3. NUOVI CLIENTI (creati nelle ultime 48 ore)
      // console.log('🔍 Analisi nuovi clienti...');
      // console.log('📊 Totale clienti:', allClients.length);

      // 4. REMINDER APPUNTAMENTI OGGI
      // console.log('📅 Analisi appuntamenti di oggi...');
      // console.log('📊 Totale appuntamenti oggi:', todayAppts.length);

      for (const appointment of todayAppts) {
        const template = findTemplate('oggi', ['Reminder Appuntamento Oggi (OK)']);
        
        if (template) {
          const compiledMessage = compileTemplate(template.content, {
            clientName: appointment.clientName,
            plate: appointment.plate,
            model: appointment.model || '',
            phone: appointment.phone,
            appointmentDate: appointment.date,
            appointmentTime: appointment.time
          });
          
          messages.push({
            id: `reminder_oggi_${appointment.id}`,
            type: 'reminder_oggi',
            clientName: appointment.clientName,
            clientPhone: appointment.phone,
            targetInfo: `${appointment.plate} - Appuntamento Oggi`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'alta',
            urgency: 'APPUNTAMENTO OGGI',
            sent: sentMessagesSet.has(`reminder_oggi_${appointment.id}`),
            sentAt: sentMessagesDetailsMap.get(`reminder_oggi_${appointment.id}`)
          });
        }
      }

      // 5. REMINDER APPUNTAMENTI DOMANI
      // console.log('📅 Analisi appuntamenti di domani...');
      // console.log('📊 Totale appuntamenti domani:', tomorrowAppts.length);

      for (const appointment of tomorrowAppts) {
        const template = findTemplate('domani', ['Reminder Appuntamento Domani (OK)']);
        
        if (template) {
          const compiledMessage = compileTemplate(template.content, {
            clientName: appointment.clientName,
            plate: appointment.plate,
            model: appointment.model || '',
            phone: appointment.phone,
            appointmentDate: appointment.date,
            appointmentTime: appointment.time
          });
          
          messages.push({
            id: `reminder_domani_${appointment.id}`,
            type: 'reminder_domani',
            clientName: appointment.clientName,
            clientPhone: appointment.phone,
            targetInfo: `${appointment.plate} - Appuntamento Domani`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'media',
            urgency: 'APPUNTAMENTO DOMANI',
            sent: sentMessagesSet.has(`reminder_domani_${appointment.id}`),
            sentAt: sentMessagesDetailsMap.get(`reminder_domani_${appointment.id}`)
          });
        }
      }

      // 6. NUOVI CLIENTI (creati nelle ultime 48 ore)
      // console.log('🔍 Analisi nuovi clienti...');
      // console.log('📊 Totale clienti:', allClients.length);
      
      const newClients = allClients.filter(client => {
        // Log dettagliato per ogni cliente
        // console.log('👤 Cliente:', {
        //   id: client.id,
        //   name: client.name,
        //   surname: client.surname,
        //   created_at: client.created_at,
        //   createdAt: client.createdAt,
        //   updated_at: client.updated_at,
        //   updatedAt: client.updatedAt
        // });

        // Gestione dei campi created_at e updated_at
        const createdAt = new Date(client.created_at || client.createdAt || Date.now());
        const updatedAt = new Date(client.updated_at || client.updatedAt || Date.now());
        const now = new Date();
        
        // Calcola la differenza in ore sia per created_at che updated_at
        const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
        
        // console.log('⏰ Ore dalla creazione:', hoursSinceCreation);
        // console.log('⏰ Ore dall\'ultimo aggiornamento:', hoursSinceUpdate);
        
        // Considera nuovo cliente se creato o aggiornato nelle ultime 48 ore
        const isNew = hoursSinceCreation <= 48 || hoursSinceUpdate <= 48;
        // console.log('🆕 È un nuovo cliente?', isNew);
        
        return isNew;
      });

      // console.log('✅ Nuovi clienti trovati:', newClients.length);
      // console.log('📝 Dettagli nuovi clienti:', newClients.map(c => ({
      //   id: c.id,
      //   name: c.name,
      //   surname: c.surname,
      //   created_at: c.created_at,
      //   updated_at: c.updated_at
      // })));

      for (const newClient of newClients) {
        // Cerca il template specifico per le credenziali
        const templateNewClient = allTemplates.find(t => 
          (t.category?.toLowerCase() === 'generale' || 
           t.category?.toLowerCase() === 'clienti' || 
           t.category?.toLowerCase() === 'credenziali') &&
          (t.title?.toLowerCase().includes('credenziali') || 
           t.title?.toLowerCase().includes('benvenuto') ||
           t.title?.toLowerCase().includes('accesso'))
        );
        
        if (templateNewClient) {
          // console.log('📝 Template trovato per credenziali:', templateNewClient.title);
          
          // Prepara i dati per la compilazione
          const templateData = {
            clientName: `${newClient.name} ${newClient.surname}`,
            phone: newClient.phone,
            email: newClient.email || '',
            password: newClient.password || '',
            nome: newClient.name || '',
            cognome: newClient.surname || ''
          };
          
          // console.log('📋 Dati per compilazione:', templateData);
          
          const compiledMessage = compileTemplate(templateNewClient.content, templateData);
          
          // console.log('✅ Messaggio compilato:', compiledMessage);
          
          messages.push({
            id: `credenziali_cliente_${newClient.id}`,
            type: 'credenziali_cliente',
            clientName: `${newClient.name} ${newClient.surname}`,
            clientPhone: newClient.phone,
            targetInfo: 'Credenziali',
            templateTitle: templateNewClient.title,
            compiledMessage,
            priority: 'alta',
            urgency: 'CREDENZIALI',
            sent: sentMessagesSet.has(`credenziali_cliente_${newClient.id}`),
            sentAt: sentMessagesDetailsMap.get(`credenziali_cliente_${newClient.id}`)
          });
        } else {
          // console.warn('⚠️ Nessun template trovato per le credenziali del cliente:', newClient.id);
        }
      }

      // 5. CHIUSURA LAVORO (preventivi appena completati)
      // console.log('🔍 Analisi preventivi completati per chiusura lavoro...');
      const justCompletedQuotes = allQuotes.filter(quote => {
        if (quote.status !== 'completato') return false;
        
        const updatedAt = new Date((quote as any).updatedAt || quote.createdAt || Date.now());
        const now = new Date();
        const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
        
        return hoursDiff <= 48; // Mostra solo i completati nelle ultime 48 ore
      });

      // console.log('📊 Preventivi appena completati trovati:', justCompletedQuotes.length);

      for (const completedQuote of justCompletedQuotes) {
        // Cerca il template per la chiusura lavoro
        const template = findTemplate('completato', ['chiusura', 'lavoro', 'completato'], ['feedback']);
        
        if (template) {
          const compiledMessage = compileTemplate(template.content, {
            clientName: completedQuote.clientName,
            plate: completedQuote.plate,
            model: completedQuote.model || '',
            phone: completedQuote.phone
          });
          
          messages.push({
            id: `chiusura_lavoro_${completedQuote.id}`,
            type: 'chiusura_lavoro',
            clientName: completedQuote.clientName,
            clientPhone: completedQuote.phone,
            targetInfo: `${completedQuote.plate} - Chiusura Lavoro`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'alta',
            urgency: 'CHIUSURA LAVORO',
            sent: sentMessagesSet.has(`chiusura_lavoro_${completedQuote.id}`),
            sentAt: sentMessagesDetailsMap.get(`chiusura_lavoro_${completedQuote.id}`)
          });
        }
      }

      // 6. FEEDBACK (preventivi completati da 2 giorni)
      // console.log('🔍 Analisi preventivi completati per feedback...');
      const quotesForFeedback = allQuotes.filter(quote => {
        if (quote.status !== 'completato') return false;
        
        const updatedAt = new Date((quote as any).updatedAt || quote.createdAt || Date.now());
        const now = new Date();
        const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
        
        return hoursDiff >= 48 && hoursDiff <= 72; // Mostra solo i completati tra 2 e 3 giorni fa
      });

      // console.log('📊 Preventivi pronti per feedback trovati:', quotesForFeedback.length);

      for (const quoteForFeedback of quotesForFeedback) {
        // Cerca il template per il feedback
        const templateFeedback = findTemplate('feedback', ['feedback', 'recensione'], ['valutazione']);
        
        if (templateFeedback) {
          const compiledMessage = compileTemplate(templateFeedback.content, {
            clientName: quoteForFeedback.clientName,
            plate: quoteForFeedback.plate,
            model: quoteForFeedback.model || '',
            phone: quoteForFeedback.phone
          });
          
          messages.push({
            id: `feedback_${quoteForFeedback.id}`,
            type: 'feedback',
            clientName: quoteForFeedback.clientName,
            clientPhone: quoteForFeedback.phone,
            targetInfo: `${quoteForFeedback.plate} - Richiesta Feedback`,
            templateTitle: templateFeedback.title,
            compiledMessage,
            priority: 'media',
            urgency: 'FEEDBACK',
            sent: sentMessagesSet.has(`feedback_${quoteForFeedback.id}`),
            sentAt: sentMessagesDetailsMap.get(`feedback_${quoteForFeedback.id}`)
          });
        }
      }

      // Per ogni preventivo accettato, crea un messaggio di conferma
      for (const acceptedQuote of allAcceptedQuotes) {
        const template = findTemplate('promemoria', ['conferma', 'appuntamento', 'checkup'], ['conferma', 'appuntamento']);
        
        if (template) {
          // Cerca l'appuntamento associato al preventivo tra tutti gli appuntamenti futuri
          let appointment = futureAppointments.find(app => app.quoteId === acceptedQuote.id);
          // Se non trova per quoteId, cerca per targa e nome cliente
          if (!appointment) {
            appointment = futureAppointments.find(app => 
              app.plate === acceptedQuote.plate && 
              app.clientName === acceptedQuote.clientName
            );
          }
          
          // console.log('📅 Appuntamento trovato:', appointment);
          
          // Imposta indirizzo di default se non presente
          const defaultAddress = 'Via Eugenio Montale, 4\n70043 Monopoli (BA), Italia';
          const address = (appointment && (appointment as any).address) || acceptedQuote.address || defaultAddress;

          const compiledMessage = compileTemplate(template.content, {
            clientName: acceptedQuote.clientName,
            plate: acceptedQuote.plate,
            model: acceptedQuote.model || '',
            phone: acceptedQuote.phone,
            appointmentDate: appointment?.date || acceptedQuote.appointmentDate || 'Da definire',
            appointmentTime: appointment?.time || acceptedQuote.appointmentTime || 'Da definire',
            address: address
          });
          
          // console.log('📝 Messaggio compilato:', {
          //   template: template.title,
          //   appointmentDate: appointment?.date || acceptedQuote.appointmentDate,
          //   appointmentTime: appointment?.time || acceptedQuote.appointmentTime,
          //   compiledMessage
          // });
          
          messages.push({
            id: `conferma_appuntamento_${acceptedQuote.id}`,
            type: 'conferma_appuntamento',
            clientName: acceptedQuote.clientName,
            clientPhone: acceptedQuote.phone,
            targetInfo: `${acceptedQuote.plate} - Conferma Appuntamento`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'alta',
            urgency: 'CONFERMA APPUNTAMENTO',
            sent: sentMessagesSet.has(`conferma_appuntamento_${acceptedQuote.id}`),
            sentAt: sentMessagesDetailsMap.get(`conferma_appuntamento_${acceptedQuote.id}`)
          });
        }
      }

      // 7. COMPLEANNO (clienti che compiono gli anni oggi)
      // console.log('🔍 Analisi compleanni di oggi...');
      const todayBirthdays = allClients.filter(client => {
        if (!client.birth_date && !client.birthDate) return false;
        
        const birthDateStr = client.birth_date || client.birthDate;
        if (!birthDateStr) return false;
        
        try {
          const birthDate = new Date(birthDateStr);
          const today = new Date();
          
          // Controlla se oggi è il compleanno (stesso giorno e mese)
          return birthDate.getDate() === today.getDate() && 
                 birthDate.getMonth() === today.getMonth();
        } catch (error) {
          console.warn(`⚠️ Data di nascita non valida per cliente ${client.id}:`, birthDateStr);
          return false;
        }
      });

      // console.log('📊 Clienti che compiono gli anni oggi:', todayBirthdays.length);

      for (const birthdayClient of todayBirthdays) {
        // Cerca il template per il compleanno
        let template = allTemplates.find(t => 
          (t.category?.toLowerCase() === 'compleanno' || 
           t.category?.toLowerCase() === 'generale' ||
           t.category?.toLowerCase() === 'auguri') &&
          (t.title?.toLowerCase().includes('compleanno') || 
           t.title?.toLowerCase().includes('auguri') ||
           t.title?.toLowerCase().includes('buon compleanno'))
        );
        
        if (!template) {
          template = findTemplate('Cortesia', ['compleanno', 'auguri', 'buon compleanno'], ['auguri', 'festeggiamo']);
        }
        
        if (template) {
          const birthDateStr = birthdayClient.birth_date || birthdayClient.birthDate;
          if (!birthDateStr) continue; // Skip se non c'è data di nascita
          
          const birthDate = new Date(birthDateStr);
          const age = new Date().getFullYear() - birthDate.getFullYear();
          
          // console.log('🎂 Template trovato per compleanno:', template.title);
          
          const compiledMessage = compileTemplate(template.content, {
            clientName: `${birthdayClient.name} ${birthdayClient.surname}`,
            phone: birthdayClient.phone,
            nome: birthdayClient.name,
            cognome: birthdayClient.surname,
            eta: age.toString(),
            anni: age.toString()
          });
          
          // console.log('✅ Messaggio compleanno compilato:', compiledMessage);
          
          messages.push({
            id: `compleanno_${birthdayClient.id}`,
            type: 'compleanno',
            clientName: `${birthdayClient.name} ${birthdayClient.surname}`,
            clientPhone: birthdayClient.phone,
            targetInfo: `🎂 Compleanno (${age} anni)`,
            templateTitle: template.title,
            compiledMessage,
            priority: 'media',
            urgency: 'COMPLEANNO',
            sent: sentMessagesSet.has(`compleanno_${birthdayClient.id}`),
            sentAt: sentMessagesDetailsMap.get(`compleanno_${birthdayClient.id}`)
          });
        } else {
          // console.warn('⚠️ Nessun template trovato per il compleanno del cliente:', birthdayClient.id);
        }
      }

      // Ordina i messaggi per priorità
      const priorityOrder = { 'alta': 1, 'media': 2, 'bassa': 3 };
      messages.sort((a, b) => {
        if (a.sent !== b.sent) {
          return a.sent ? 1 : -1;
        }
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // console.log(`🎉 Messaggi compilati totali: ${messages.length}`);

      setCompiledMessages(messages);
      setLastUpdate(new Date());
      
      return messages.length;

    } catch (error) {
      console.error('❌ Errore nel caricamento:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
      return 0;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Segna un messaggio come inviato o non inviato
   */
  const toggleMessageSent = async (messageId: string) => {
    try {
      const isCurrentlySent = sentMessages.has(messageId);
      const now = new Date();
      
      if (isCurrentlySent) {
        await unmarkMessageAsSent(messageId);
        setSentMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });
      } else {
        await markMessageAsSent(messageId);
        setSentMessages(prev => new Set(Array.from(prev).concat([messageId])));
      }

      setCompiledMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                sent: !msg.sent,
                sentAt: !isCurrentlySent ? now : undefined,
                sentBy: !isCurrentlySent ? 'current_user' : undefined // TODO: Sostituire con l'utente reale
              }
            : msg
        )
      );

      // Mostra toast di conferma
      toast({
        title: isCurrentlySent ? "Messaggio ripristinato" : "Messaggio inviato",
        description: isCurrentlySent 
          ? "Il messaggio è stato ripristinato e può essere inviato di nuovo"
          : "Il messaggio è stato segnato come inviato",
        duration: 3000,
      });

    } catch (error) {
      console.error('❌ Errore nel toggle messaggio:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del messaggio",
        variant: "destructive",
      });
    }
  };

  /**
   * Copia un messaggio negli appunti SENZA segnarlo come inviato
   */
  const handleCopyMessage = async (message: string, clientName: string, messageId: string) => {
    try {
      // console.log(`📋 Copiando messaggio per ${clientName}, ID: ${messageId}`);
      
      // Copia solo il messaggio negli appunti
      await navigator.clipboard.writeText(message);
      
      toast({
        title: "Messaggio Copiato!",
        description: `Messaggio per ${clientName} copiato negli appunti`,
        duration: 3000,
      });
      
      // console.log(`✅ Messaggio copiato con successo (NON segnato come inviato)`);
      
    } catch (error) {
      console.error('❌ Errore nella copia del messaggio:', error);
      toast({
        title: "Errore",
        description: "Impossibile copiare il messaggio",
        variant: "destructive",
      });
    }
  };

  /**
   * Ottieni icona per tipo di messaggio
   */
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'preventivo_elaborato': return FileText;
      case 'conferma_appuntamento': return CheckCircle;
      case 'credenziali_cliente': return UserPlus;
      case 'reminder_oggi': return Calendar;
      case 'reminder_domani': return Calendar;
      case 'reminder_15giorni': return Clock;
      case 'compleanno': return Gift;
      default: return MessageSquare;
    }
  };

  /**
   * Ottieni etichetta leggibile per tipo di messaggio
   */
  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'preventivo_elaborato': return 'Preventivo elaborato';
      case 'conferma_appuntamento': return 'Conferma appuntamento';
      case 'chiusura_lavoro': return 'Chiusura lavoro';
      case 'feedback': return 'Richiesta feedback';
      case 'credenziali_cliente': return 'Nuovo cliente';
      case 'reminder_oggi': return 'Appuntamento oggi';
      case 'reminder_domani': return 'Appuntamento domani';
      case 'reminder_15giorni': return 'Reminder 15 Giorni';
      case 'compleanno': return 'Compleanno';
      default: return 'Messaggio';
    }
  };

  /**
   * Separa i messaggi tra da inviare e già inviati
   */
  const getMessagesByStatus = () => {
    const pending = compiledMessages.filter(msg => !msg.sent);
    const completed = compiledMessages
      .filter(msg => msg.sent)
      .sort((a, b) => {
        // Se non c'è data di invio, metti in fondo
        if (!a.sentAt) return 1;
        if (!b.sentAt) return -1;
        // Ordina per data decrescente (più recenti prima)
        return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
      });
    return { pending, completed };
  };

  // CARICAMENTO AUTOMATICO MIGLIORATO
  useEffect(() => {
    // console.log('🚀 SmartReminder montato, carico messaggi...');
    loadAndCompileMessages();
  }, [location]);

  // Apro la sezione completati ogni volta che la lista dei messaggi completati passa da 0 a >0
  useEffect(() => {
    const completedCount = getMessagesByStatus().completed.length;
    if (completedCount > 0 && !showCompletedMessages) {
      setShowCompletedMessages(true);
    }
  }, [compiledMessages]);

  // Ricarica quando si torna alla pagina
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isLoading) {
        // console.log('📱 Pagina tornata visibile, ricarico messaggi...');
        setTimeout(() => loadAndCompileMessages(), 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLoading]);

  useEffect(() => {
    if (getMessagesByStatus().completed.length > 0) {
      setShowCompletedMessages(true);
    }
  }, [location, compiledMessages]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Smart Reminder WhatsApp</h1>
            <p className="text-gray-400 text-sm">Messaggi automatici pronti da inviare</p>
          </div>
        </div>
        <Button 
          onClick={() => loadAndCompileMessages()}
          disabled={isLoading}
          variant="outline"
          className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Aggiorna
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Caricamento messaggi...</p>
        </div>
      )}

      {/* Messaggi da inviare */}
      {!isLoading && (
        <>
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Da Inviare ({getMessagesByStatus().pending.length})
                </h2>
                <div className="flex gap-2">
                  <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">
                    {getMessagesByStatus().pending.length} da fare
                  </span>
                </div>
              </div>
            </div>

            {getMessagesByStatus().pending.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-8 h-8 mx-auto text-green-400 mb-2" />
                <p className="text-gray-400">Tutti i messaggi sono stati inviati! 🎉</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {getMessagesByStatus().pending.map((message, index) => {
                  const IconComponent = getMessageIcon(message.type);
                  
                  return (
                    <div 
                      key={index} 
                      className="p-4 hover:bg-gray-800/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-orange-600">
                            <IconComponent className="w-4 h-4 text-white" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="text-white font-medium">
                                {message.clientName}
                              </span>
                              <span className="text-xs text-orange-500 bg-orange-900/30 px-2 py-1 rounded">
                                {getMessageTypeLabel(message.type)}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                              <span>📞 {message.clientPhone}</span>
                              <span>🚗 {message.targetInfo}</span>
                            </div>
                            
                            <div className="mt-2">
                              <span className="text-xs text-gray-400 bg-gray-900/20 px-2 py-1 rounded">
                                {message.urgency}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleCopyMessage(message.compiledMessage, message.clientName, message.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            onClick={() => toggleMessageSent(message.id)}
                            size="sm"
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Messaggi completati */}
          {getMessagesByStatus().completed.length > 0 && (
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
              <div 
                className="p-4 border-b border-gray-700 bg-green-900/20 cursor-pointer hover:bg-green-900/30 transition-colors"
                onClick={() => setShowCompletedMessages(!showCompletedMessages)}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Messaggi Completati ({getMessagesByStatus().completed.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                      {getMessagesByStatus().completed.length} completati
                    </span>
                    {showCompletedMessages ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {showCompletedMessages && (
                <div className="divide-y divide-gray-700">
                  {getMessagesByStatus().completed.map((message, index) => {
                    const IconComponent = getMessageIcon(message.type);
                    
                    return (
                      <div 
                        key={index} 
                        className="p-4 hover:bg-gray-800/30 transition-colors bg-green-900/10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-orange-600 opacity-60">
                              <IconComponent className="w-4 h-4 text-white" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-white font-medium line-through opacity-60">
                                  {message.clientName}
                                </span>
                                <span className="text-xs text-green-500 bg-green-900/30 px-2 py-1 rounded">
                                  {getMessageTypeLabel(message.type)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400 line-through opacity-60">
                                <span>📞 {message.clientPhone}</span>
                                <span>🚗 {message.targetInfo}</span>
                              </div>
                              {message.sentAt && (
                                <div className="mt-1 text-xs text-gray-500">
                                  ✅ Inviato il {new Date(message.sentAt).toLocaleDateString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => toggleMessageSent(message.id)}
                              size="sm"
                              variant="outline"
                              className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 