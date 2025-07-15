import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getAppointmentById, getWorkSessionByAppointmentId } from "@shared/supabase";
import { Appointment, WorkSession } from "@shared/schema";
import ServiceProcess from "@/components/ServiceProcess";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";

export default function TagliandoDettaglioPage() {
  const params = useParams();
  const appointmentId = params.id;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionValidation, setSessionValidation] = useState<{
    isValid: boolean;
    hasCompletedSession: boolean;
    completedSession?: WorkSession;
    errorMessage?: string;
    completedTimeAgo?: string;
    canReopen?: boolean;
  }>({ isValid: true, hasCompletedSession: false });

  useEffect(() => {
    async function fetchAppointmentAndValidateSession() {
      setLoading(true);
      
      if (!appointmentId) {
        setAppointment(null);
        setSessionValidation({ 
          isValid: false, 
          hasCompletedSession: false,
          errorMessage: "ID appuntamento non specificato" 
        });
        setLoading(false);
        return;
      }

      try {
        console.log(`🔍 Controllo validazione sessione per appointmentId: ${appointmentId}`);
        
        // 1. Carica l'appuntamento
        const appointmentData = await getAppointmentById(appointmentId);
        if (!appointmentData) {
          setAppointment(null);
          setSessionValidation({ 
            isValid: false, 
            hasCompletedSession: false,
            errorMessage: "Appuntamento non trovato" 
          });
          setLoading(false);
          return;
        }
        
        setAppointment(appointmentData);
        
        // 2. Verifica se esiste già una sessione completata per questo appointmentId
        const existingSession = await getWorkSessionByAppointmentId(appointmentId);
        
        if (existingSession && existingSession.completed) {
          console.log(`⚠️ TROVATA SESSIONE COMPLETATA per appointmentId ${appointmentId}:`, existingSession);
          
          // Calcoliamo quando è stata completata
          const completedAtString = existingSession.completedAt || existingSession.created_at;
          const completedAt = completedAtString ? new Date(completedAtString) : new Date();
          const now = new Date();
          const hoursAgo = Math.round((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60));
          const minutesAgo = Math.round((now.getTime() - completedAt.getTime()) / (1000 * 60));
          
          let timeAgoText = '';
          if (hoursAgo >= 1) {
            timeAgoText = `${hoursAgo} ora${hoursAgo > 1 ? 'e' : ''} fa`;
          } else {
            timeAgoText = `${minutesAgo} minuto${minutesAgo > 1 ? 'i' : ''} fa`;
          }
          
          setSessionValidation({
            isValid: false,
            hasCompletedSession: true,
            completedSession: existingSession,
            completedTimeAgo: timeAgoText,
            canReopen: hoursAgo < 24, // Permetti riapertura solo se completata nelle ultime 24 ore
            errorMessage: `Esiste già una sessione completata per questo appuntamento (${appointmentData.clientName} - ${appointmentData.plate}). 
Sessione completata ${timeAgoText} in data: ${completedAt.toLocaleString('it-IT')}.

${hoursAgo < 24 ? 'Puoi riaprire questa sessione se è stata completata per errore.' : 'Non è possibile iniziare una nuova lavorazione.'}`
          });
        } else {
          console.log(`✅ Nessuna sessione completata trovata per appointmentId ${appointmentId} - OK per procedere`);
          setSessionValidation({
            isValid: true,
            hasCompletedSession: false
          });
        }
        
      } catch (error) {
        console.error(`❌ Errore durante il controllo della sessione per appointmentId ${appointmentId}:`, error);
        setSessionValidation({ 
          isValid: false, 
          hasCompletedSession: false,
          errorMessage: "Errore nel controllo della sessione" 
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAppointmentAndValidateSession();
  }, [appointmentId]);

  // Funzione per riaprire una sessione completata
  const handleReopenSession = async () => {
    if (!sessionValidation.completedSession) return;
    
    const isConfirmed = window.confirm(
      `⚠️ ATTENZIONE: Stai per riaprire una sessione di lavorazione già completata.

Questo dovrebbe essere fatto SOLO se la sessione è stata completata per errore.

Appuntamento: ${appointment?.clientName} - ${appointment?.plate}
Completata: ${sessionValidation.completedTimeAgo}

Sei sicuro di voler procedere?`
    );
    
    if (!isConfirmed) return;
    
    try {
      setLoading(true);
      
      // Riapri la sessione marcandola come non completata
      const { updateWorkSession } = await import("@shared/supabase");
      await updateWorkSession(sessionValidation.completedSession.id, {
        completed: false,
        completedAt: undefined,
        currentStep: 2 // Riporta alla fase di lavorazione
      });
      
      // Log dell'operazione per audit
      console.log(`🔄 SESSIONE RIAPERTA: ${sessionValidation.completedSession.id} per appointmentId: ${appointmentId}`);
      console.log(`👤 Riaperta dall'utente: ${new Date().toISOString()}`);
      
      // Ricarica la validazione
      setSessionValidation({
        isValid: true,
        hasCompletedSession: false
      });
      
      alert("✅ Sessione riaperta con successo! Puoi continuare la lavorazione.");
      
    } catch (error) {
      console.error("❌ Errore nella riapertura della sessione:", error);
      alert("Errore nella riapertura della sessione. Riprova o contatta l'amministratore.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-primary"></div>
      </div>
    );
  }
  
  if (!appointment) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl md:text-2xl font-bold">Lavorazione</h2>
        <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border p-6 text-center">
          Appuntamento non trovato
        </div>
      </div>
    );
  }

  // Se la validazione fallisce, mostra errore
  if (!sessionValidation.isValid) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h2 className="text-lg font-bold text-red-800 mb-2">
                  Impossibile procedere con la lavorazione
                </h2>
                <div className="text-red-700 whitespace-pre-line text-sm mb-4">
                  {sessionValidation.errorMessage}
                </div>
                
                {sessionValidation.hasCompletedSession && sessionValidation.completedSession && (
                  <div className="bg-white p-4 rounded border-l-2 border-red-300 mb-4">
                    <h3 className="font-semibold text-red-800 mb-2">Dettagli Sessione Completata:</h3>
                    <div className="text-sm text-red-700 space-y-1">
                      <p><strong>ID Sessione:</strong> {sessionValidation.completedSession.id}</p>
                      <p><strong>Completata:</strong> {sessionValidation.completedTimeAgo}</p>
                      <p><strong>Data/Ora:</strong> {(() => {
                        const dateString = sessionValidation.completedSession.completedAt || sessionValidation.completedSession.created_at;
                        return dateString ? new Date(dateString).toLocaleString('it-IT') : 'Data non disponibile';
                      })()}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => window.history.back()}
                    className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Indietro
                  </button>
                  
                  {sessionValidation.canReopen && (
                    <button
                      onClick={handleReopenSession}
                      className="flex items-center justify-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Riapri Sessione
                    </button>
                  )}
                  
                  <a
                    href="/storico-lavori"
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Storico Lavori
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se tutto è OK, procedi con il ServiceProcess
  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">Lavorazione</h2>
      <div className="bg-card rounded-lg shadow-md overflow-hidden border border-border p-4">
        <div className="mb-4 font-semibold">
          {appointment.clientName} - {appointment.plate}
          {appointment.quoteId && (
            <span className="ml-2 text-sm text-muted-foreground">
              Preventivo: {appointment.quoteId}
            </span>
          )}
        </div>
        

        
        <ServiceProcess 
          vehicleId={appointment.plate}
          customerPhone={appointment.phone}
          appointmentId={appointmentId}
        />
      </div>
    </div>
  );
} 