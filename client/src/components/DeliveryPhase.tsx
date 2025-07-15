import React, { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import toast from "react-hot-toast";
import { 
  updateAppointment, 
  getAcceptancePhaseByVehicleId, 
  getWorkPhaseByVehicleId,
  getWorkPhaseByAppointmentId,
  getAppointmentById,
  getQuoteById,
  updateQuote,
  getChecklistItemsByAppointmentId,
  getAllQuotes
} from "@shared/supabase";
import { useSmartReminder } from "../hooks/useSmartReminder";
import { exportWorkSessionToPDF } from "@/services/exportService";
import { X } from "lucide-react";

// Logo dell'azienda in base64
const COMPANY_LOGO = "https://i.ibb.co/C5B0NDZJ/autoexpress-logo.png";

interface DeliveryPhaseProps {
  vehicleId: string;
  customerPhone: string;
  onComplete: () => void;
}

interface VehicleData {
  acceptancePhotos?: string[];
  mileage?: string | number;
  fuelLevel?: string;
  acceptanceDate?: string;
  sparePartPhotos?: string[];
  spareParts?: SparePart[];
  checklist?: any;
  workCompletionDate?: string;
  workCompleted?: boolean;
  commenti?: string;
  clientData?: {
    name: string;
    phone: string;
    plate: string;
    clientId: string;
  };
  quoteData?: QuoteData;
  // Note per le foto ricambi
  photoNotes?: {
    p1note?: string;
    p2note?: string;
    p3note?: string;
    p4note?: string;
    p5note?: string;
    p6note?: string;
  };
}

interface QuoteData {
  laborPrice: number;
  laborHours: number;
  quoteId: string;
  items?: any[];
}

interface SparePart {
  code: string;
  name: string;
  description?: string;
  price: number;
  finalPrice: number;
  quantity: number;
  type?: string;
}

const DeliveryPhase: React.FC<DeliveryPhaseProps> = ({
  vehicleId,
  customerPhone,
  onComplete,
}) => {
  // Riferimento per il link di download
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  // Funzione per convertire il livello carburante in formato numerico
  const formatFuelLevel = (fuelLevel: string): string => {
    if (!fuelLevel || fuelLevel === "N/D") return "N/D";
    
    switch (fuelLevel.toLowerCase()) {
      case 'empty':
      case 'vuoto':
        return '0/4';
      case 'quarter':
      case 'one-quarter':
      case 'un quarto':
        return '1/4';
      case 'half':
      case 'metà':
      case 'mezzo':
        return '2/4';
      case 'three-quarters':
      case 'tre quarti':
        return '3/4';
      case 'full':
      case 'pieno':
        return '4/4';
      default:
        // Se è già in formato numerico o non riconosciuto, ritorna così com'è
        return fuelLevel;
    }
  };

  // Stati esistenti
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [clienteNotificato, setClienteNotificato] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [pdfGenerated, setPdfGenerated] = useState<boolean>(false);
  const [showQuoteSummary, setShowQuoteSummary] = useState(false);
  const [quote, setQuote] = useState<{
    id: string;
    clientName: string;
    plate: string;
    items: any[];
    notes: string;
    laborHours: number;
    laborPrice: number;
    taxRate: number;
  } | null>(null);

  // Hook per Smart Reminder
  const { triggerQuoteStatusChanged } = useSmartReminder({
    enableAutoReminders: true,
    enableNotifications: true,
    enableLogging: true
  });

  // Funzione per recuperare i dati da Supabase
  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        setIsLoading(true);
        // console.log("Caricamento dati per veicolo:", vehicleId);

        // 1. Recupera la fase di accettazione
        const acceptancePhase = await getAcceptancePhaseByVehicleId(vehicleId);
        // console.log("Fase di accettazione trovata:", acceptancePhase);

        // 2. Recupera la fase di lavorazione
        const workPhase = await getWorkPhaseByVehicleId(vehicleId);
        // console.log("Fase di lavorazione trovata:", workPhase);

        // 3. Se abbiamo un appointmentId dalla fase di accettazione o lavorazione, recupera l'appuntamento
        let appointment: any = null;
        let clientData = undefined;
        let quoteData = undefined;
        const appointmentIdFromPhases = acceptancePhase?.appointmentId || workPhase?.appointmentId;
        
        if (appointmentIdFromPhases) {
          appointment = await getAppointmentById(appointmentIdFromPhases);
          setAppointmentId(appointmentIdFromPhases);
          // console.log("Appuntamento trovato:", appointment);

          // 4. Se l'appuntamento ha un quoteId, recupera i dati cliente e preventivo AGGIORNATI
          if (appointment?.quoteId) {
            try {
              let quote = await getQuoteById(appointment.quoteId);
              // Se il preventivo è completato, cerca un preventivo attivo per lo stesso cliente/targa
              if (quote && quote.status === 'completato') {
                const allQuotes = await getAllQuotes();
                const activeQuote = allQuotes
                  .filter(q => q.clientId === appointment.clientId && q.plate === appointment.plate && q.status !== 'completato')
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                if (activeQuote) {
                  quote = activeQuote;
                }
              }
              if (quote) {
                clientData = {
                  name: quote.clientName,
                  phone: quote.phone,
                  plate: quote.plate,
                  clientId: quote.clientId
                };
                quoteData = {
                  laborPrice: quote.laborPrice || 0,
                  laborHours: quote.laborHours || 0,
                  quoteId: quote.id,
                  items: Array.isArray(quote.items) ? quote.items : [],
                };
                // console.log("Dati cliente recuperati dal preventivo ATTIVO:", clientData);
                // console.log("Dati mano d'opera recuperati dal preventivo ATTIVO:", quoteData);
              }
            } catch (error) {
              console.error("Errore nel recupero del preventivo:", error);
            }
          }
        }

        // 5. Costruisci i dati del veicolo dalle fasi
        const normalizedData: VehicleData = {
          // Dati dalla fase di accettazione
          mileage: acceptancePhase?.mileage || "N/D",
          fuelLevel: formatFuelLevel(acceptancePhase?.fuelLevel || "N/D"),
          acceptanceDate: acceptancePhase?.acceptanceDate || acceptancePhase?.created_at,
          acceptancePhotos: acceptancePhase?.photos || [],

          // Dati dalla fase di lavorazione
          sparePartPhotos: workPhase?.sparePartPhotos || [],
          spareParts: [], // Inizializziamo vuoto, verrà popolato dopo
          checklist: workPhase ? { workPhase: workPhase } : null,
          workCompletionDate: workPhase?.completedAt,
          workCompleted: workPhase?.status === "completed",
          commenti: workPhase?.workNotes || "",

          // Dati cliente dal preventivo
          clientData: clientData,
          quoteData: quoteData,
          // Note per le foto ricambi
          photoNotes: {
            p1note: workPhase?.p1note || '',
            p2note: workPhase?.p2note || '',
            p3note: workPhase?.p3note || '',
            p4note: workPhase?.p4note || '',
            p5note: workPhase?.p5note || '',
            p6note: workPhase?.p6note || '',
          }
        };

        // 6. Recupera la checklist se abbiamo un appointmentId
        let checklistData: any[] = [];
        if (appointmentIdFromPhases) {
          try {
            checklistData = await getChecklistItemsByAppointmentId(appointmentIdFromPhases);
            setChecklistItems(checklistData);
            // console.log("Checklist recuperata:", checklistData);
            
            // Debug specifico per le note
            const itemsWithNotes = checklistData.filter(item => item.notes && item.notes.trim().length > 0);
            // console.log("🔍 DEBUG - Elementi con note trovati:", itemsWithNotes.length);
            itemsWithNotes.forEach(item => {
              // console.log(`📝 DEBUG - ${item.itemName}: "${item.notes}"`);
            });
          } catch (error) {
            console.error("Errore nel recupero della checklist:", error);
          }
        }

        // console.log("Dati normalizzati per il componente:", normalizedData);
        setVehicleData(normalizedData);

        // 7. Imposta i ricambi dalla fase di lavorazione
        if (workPhase?.spareParts && workPhase.spareParts.length > 0) {
          // Mappa i ricambi dalla fase di lavorazione al formato SparePart
          const workPhaseParts: SparePart[] = workPhase.spareParts.map((part: any, index: number) => ({
            code: part.BRAND || `BRAND-${index}`,
            name: part.name || part.description || 'Ricambio',
            description: part.descpart || part.description || part.name,
            price: part.unitPrice || part.finalPrice || 0,
            finalPrice: part.finalPrice || part.unitPrice || 0,
            quantity: part.quantity || 1,
            type: part.type || 'ricambio'
          }));
          setSpareParts(workPhaseParts);
          console.log("Ricambi impostati dalla fase di lavorazione:", workPhaseParts);
        } else if (appointment?.quoteId) {
          // 8. Se non ci sono ricambi nella fase di lavorazione, prova a recuperarli dal preventivo
          try {
            const quote = await getQuoteById(appointment.quoteId);
            console.log("Preventivo recuperato:", quote);
            
            if (quote) {
              const quoteParts: SparePart[] = [];
              
              // I ricambi sono in quote.items[].parts, non in quote.parts
              if (quote.items && Array.isArray(quote.items)) {
                quote.items.forEach((item: any) => {
                  if (item.parts && Array.isArray(item.parts)) {
                    item.parts.forEach((part: any) => {
                      quoteParts.push({
                        code: part.brand || `PART-${quoteParts.length}`,
                        name: part.name || part.description || 'Ricambio',
                        description: part.descpart || part.description || part.name,
                        price: part.unitPrice || part.price || 0,
                        finalPrice: part.finalPrice || part.unitPrice || part.price || 0,
                        quantity: part.quantity || 1,
                        type: part.category || 'ricambio'
                      });
                    });
                  }
                });
              }
              
              // Fallback: controlla anche quote.parts se esiste
              if (quoteParts.length === 0 && quote.parts && Array.isArray(quote.parts)) {
                quote.parts.forEach((part: any) => {
                  quoteParts.push({
                    code: part.brand || `PART-${quoteParts.length}`,
                    name: part.name || part.description || 'Ricambio',
                    description: part.descpart || part.description || part.name,
                    price: part.price || part.unitPrice || 0,
                    finalPrice: part.finalPrice || part.price || part.unitPrice || 0,
                    quantity: part.quantity || 1,
                    type: part.category || 'ricambio'
                  });
                });
              }
              
              setSpareParts(quoteParts);
              console.log("Ricambi impostati dal preventivo:", quoteParts);
            }
          } catch (error) {
            console.error("Errore nel recupero del preventivo:", error);
          }
        }

      } catch (error) {
        console.error("Errore durante il caricamento dei dati:", error);
        toast.error("Errore durante il caricamento dei dati del veicolo");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicleData();
  }, [vehicleId]);

  // Effetto per generare automaticamente il PDF se richiesto dai parametri URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldGeneratePdf = urlParams.get('generatePdf') === 'true';
    const fromStorico = urlParams.get('fromStorico') === 'true';
    
    if (shouldGeneratePdf && fromStorico && vehicleData && !isLoading && !pdfGenerated) {
      console.log("🔄 Generazione automatica PDF richiesta dallo storico lavori");
      setPdfGenerated(true); // Imposta il flag per evitare generazioni multiple
      generatePDF();
    }
  }, [vehicleData, isLoading, pdfGenerated]);

  const generatePDF = async () => {
    if (!vehicleData) return;

    try {
      setIsLoading(true);
      console.log("🔄 Generazione PDF con exportWorkSessionToPDF (stesso dello storico lavori)");
      
      // USA appointmentId invece di vehicleId per l'isolamento corretto
      if (!appointmentId) {
        toast.error("AppointmentId non disponibile per la generazione PDF");
        return;
      }

      // Recupera i dati della WorkPhase usando appointmentId (corretto isolamento)
      const workPhase = await getWorkPhaseByAppointmentId(appointmentId);
      console.log("🔍 DEBUG: workPhase recuperato per appointmentId", appointmentId, ":", workPhase);
      
      if (!workPhase) {
        toast.error("Dati di lavorazione non trovati per questo appuntamento");
        return;
      }

      // RECUPERA ANCHE L'ACCEPTANCE PHASE per le foto di accettazione
      let acceptancePhase = null;
      try {
        // Prima cerca per appointmentId (corretto isolamento)
        acceptancePhase = await getAcceptancePhaseByVehicleId(vehicleId);
        
        // Verifica che sia per l'appointmentId corretto
        if (acceptancePhase && acceptancePhase.appointmentId !== appointmentId) {
          console.log("⚠️ AcceptancePhase trovata ma con appointmentId diverso - ignoro");
          acceptancePhase = null;
        }
        
        console.log("🔍 DEBUG: acceptancePhase recuperata:", acceptancePhase);
      } catch (error) {
        console.error("Errore nel recupero dell'AcceptancePhase:", error);
      }

      // Recupera la checklist se disponibile
      let checklistData: any[] = [];
      try {
        checklistData = await getChecklistItemsByAppointmentId(appointmentId);
        console.log("🔍 DEBUG: checklistData recuperata:", checklistData);
      } catch (error) {
        console.error("Errore nel recupero della checklist:", error);
      }

      // COMBINA I DATI: WorkPhase + AcceptancePhase
      const combinedWorkSession = {
        ...workPhase,
        // Aggiungi le foto di accettazione dalla AcceptancePhase
        acceptancePhotos: acceptancePhase?.photos || [],
        // Aggiungi altri dati di accettazione se necessari
        mileage: acceptancePhase?.mileage || workPhase.mileage,
        fuelLevel: acceptancePhase?.fuelLevel || workPhase.fuelLevel,
        // Assicurati che le foto ricambi siano correttamente mappate
        sparePartsPhotos: workPhase.sparePartPhotos || workPhase.sparePartsPhotos || []
      };

      // DEBUG: Verifica la struttura dei dati prima di passarli alla funzione PDF
      console.log("🔍 DEBUG: Dati combinati che passiamo alla funzione PDF:");
      console.log("- combinedWorkSession:", combinedWorkSession);
      console.log("- vehicleId:", vehicleId);
      console.log("- appointmentId:", appointmentId);
      console.log("- checklistData:", checklistData);
      console.log("- combinedWorkSession.acceptancePhotos:", combinedWorkSession.acceptancePhotos);
      console.log("- combinedWorkSession.sparePartsPhotos:", combinedWorkSession.sparePartsPhotos);

      // USA LA STESSA FUNZIONE DELLO STORICO LAVORI con dati COMBINATI
      await exportWorkSessionToPDF(combinedWorkSession, vehicleId, checklistData);
      
      console.log("✅ PDF generato con successo usando exportWorkSessionToPDF");

      // Aggiorna lo stato dell'appuntamento e del preventivo
      if (appointmentId) {
        console.log("📅 Aggiornamento appuntamento da generatePDF:", appointmentId);
        await updateAppointment(appointmentId, { status: "completato" });
        console.log("✅ Appuntamento aggiornato a completato da generatePDF");
        
        // Aggiorna anche il preventivo se presente
        const appointment = await getAppointmentById(appointmentId);
        if (appointment?.quoteId) {
          console.log("💰 Aggiornamento preventivo da generatePDF:", appointment.quoteId);
          try {
            await updateQuote(appointment.quoteId, { status: "completato" });
            console.log("✅ Preventivo aggiornato a completato da generatePDF");
            
            // 🔔 TRIGGER SMART REMINDER - Lavoro completato
            console.log("🔔 Trigger Smart Reminder per lavoro completato:", appointment.quoteId);
            triggerQuoteStatusChanged(appointment.quoteId, "accettato", "completato");
          } catch (quoteError) {
            console.error("❌ Errore aggiornamento preventivo da generatePDF:", quoteError);
          }
        }
      }

    } catch (error) {
      console.error("Errore nella generazione del PDF:", error);
      toast.error("Errore nell'esportazione del PDF");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    try {
      setIsLoading(true);
      console.log("🚀 Inizio completamento consegna per veicolo:", vehicleId);

      if (appointmentId) {
        console.log("📅 Aggiornamento appuntamento:", appointmentId);
        await updateAppointment(appointmentId, { status: "completato" });
        console.log("✅ Appuntamento aggiornato a completato");
        
        const appointment = await getAppointmentById(appointmentId);
        console.log("📋 Appuntamento recuperato:", appointment);
        
        if (appointment?.quoteId) {
          console.log("💰 Aggiornamento preventivo:", appointment.quoteId);
          try {
            await updateQuote(appointment.quoteId, { status: "completato" });
            console.log("✅ Preventivo aggiornato a completato");
            
            // 🔔 TRIGGER SMART REMINDER - Lavoro completato
            console.log("🔔 Trigger Smart Reminder per lavoro completato:", appointment.quoteId);
            triggerQuoteStatusChanged(appointment.quoteId, "accettato", "completato");
            
            // Verifica che l'aggiornamento sia avvenuto
            const updatedQuote = await getQuoteById(appointment.quoteId);
            console.log("🔍 Verifica stato preventivo aggiornato:", updatedQuote?.status);
            
            if (updatedQuote?.status !== "completato") {
              console.error("❌ ERRORE: Il preventivo non è stato aggiornato correttamente!");
              toast.error("Errore nell'aggiornamento dello stato del preventivo");
              return;
            }
          } catch (quoteError) {
            console.error("❌ Errore specifico aggiornamento preventivo:", quoteError);
            toast.error("Errore nell'aggiornamento del preventivo");
            return;
          }
        } else {
          console.log("⚠️ Nessun preventivo associato all'appuntamento");
        }
      } else {
        console.log("⚠️ Nessun appointmentId disponibile");
      }

      toast.success("Consegna completata con successo!");
      console.log("🎉 Completamento consegna terminato con successo");
      
      // REINDIRIZZA ALLO STORICO LAVORI INSTEAD OF DASHBOARD
      setTimeout(() => {
        window.location.href = "/storico-lavori";
      }, 1500);

      onComplete();
    } catch (error) {
      console.error("❌ Errore durante il completamento della consegna:", error);
      toast.error("Errore durante il completamento della consegna");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <h2 className="text-2xl font-bold mb-4">Fase di Consegna</h2>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Dati veicolo */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Dati Veicolo</h3>
            <div className="border border-border rounded-lg p-4 bg-background">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Targa:</span> {vehicleId}
                </div>
                <div>
                  <span className="font-medium">Chilometraggio:</span> {vehicleData?.mileage} km
                </div>
                <div>
                  <span className="font-medium">Livello carburante:</span> {formatFuelLevel(vehicleData?.fuelLevel || "N/D")}
                </div>
                <div>
                  <span className="font-medium">Data accettazione:</span>{" "}
                  {vehicleData?.acceptanceDate 
                    ? format(new Date(vehicleData.acceptanceDate), "dd/MM/yyyy HH:mm", { locale: it })
                    : "N/D"
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Note di Lavorazione */}
          {vehicleData?.commenti && vehicleData.commenti.trim().length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Note di Lavorazione</h3>
              <div className="border border-border rounded-lg p-4 bg-background">
                <div className="whitespace-pre-wrap text-sm text-foreground">
                  {vehicleData.commenti}
                </div>
              </div>
            </div>
          )}

          {/* Bottoni di azione semplificati */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={generatePDF}
              disabled={isLoading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1 text-lg font-medium"
            >
              {isLoading ? "Generazione..." : "Genera PDF"}
            </button>
            
            <button
              onClick={handleCompleteDelivery}
              disabled={isLoading}
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1 text-lg font-medium"
            >
              {isLoading ? "Completamento..." : "Completa Consegna"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DeliveryPhase; 