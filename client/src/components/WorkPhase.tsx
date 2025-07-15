import React, { useState, useEffect, useRef } from "react";
import { Upload, X, Check, Eye, FileText, Clipboard, Camera, Image, Plus, Trash2, ArrowLeft } from "lucide-react";
import SchedaIspezioneVeicolo from "./checklist/checklist";
import { 
  getWorkPhaseByAppointmentId, 
  getWorkPhaseByVehicleId, 
  createWorkPhase, 
  updateWorkPhase,
  getQuoteById,
  updateAppointment
} from "@shared/supabase";
import { useSmartReminder } from "../hooks/useSmartReminder";
import { WorkSession, SparePart } from "@shared/schema";

interface WorkPhaseProps {
  vehicleId: string;
  appointmentId?: string;
  onComplete: () => void;
}

// Tipo per compatibilità con le funzioni esistenti
type WorkPhaseType = WorkSession & {
  clientId?: string;
  quoteId?: string;
  status?: 'in_progress' | 'completed';
  sparePartPhotos?: string[]; // CORREZIONE: sparePartPhotos (senza 's') come nel database
  spareParts?: SparePart[];
  descpart?: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  // Note per ogni foto ricambio
  p1note?: string;
  p2note?: string;
  p3note?: string;
  p4note?: string;
  p5note?: string;
  p6note?: string;
};

// Funzioni di utilità per localStorage
function getWorkPhaseStorageKey(vehicleId?: string, appointmentId?: string) {
  return `workphase_${vehicleId || ''}_${appointmentId || ''}`;
}

function saveWorkPhaseToStorage(vehicleId: string, appointmentId: string | undefined, photos: string[], notes: string) {
  const key = getWorkPhaseStorageKey(vehicleId, appointmentId);
  localStorage.setItem(key, JSON.stringify({ photos, notes }));
}

function loadWorkPhaseFromStorage(vehicleId: string, appointmentId: string | undefined): { photos: string[]; notes: string } | null {
  const key = getWorkPhaseStorageKey(vehicleId, appointmentId);
  const data = localStorage.getItem(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

const WorkPhase: React.FC<WorkPhaseProps> = ({ vehicleId, appointmentId, onComplete }) => {
  // DEBUGGING: Verifica sempre che l'appointmentId sia quello corretto
  useEffect(() => {
    console.log(`🎯 DEBUG WorkPhase - Props ricevute:`, {
      vehicleId,
      appointmentId,
      timestamp: new Date().toISOString()
    });
    
    if (!appointmentId) {
      console.error("❌ CRITICO: WorkPhase ricevuto senza appointmentId!");
    } else {
      console.log(`✅ WorkPhase inizializzato con appointmentId: ${appointmentId}`);
    }
  }, [vehicleId, appointmentId]);

  const [workPhase, setWorkPhase] = useState<WorkPhaseType | null>(null);
  const [sparePartsPhotos, setSparePartsPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [descpart, setDescpart] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Stati per le note delle foto
  const [photoNotes, setPhotoNotes] = useState<{[key: string]: string}>({
    p1note: '',
    p2note: '',
    p3note: '',
    p4note: '',
    p5note: '',
    p6note: ''
  });
  const [showPhotoSummary, setShowPhotoSummary] = useState<boolean>(false);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [notesReloadTrigger, setNotesReloadTrigger] = useState<number>(0);

  // Funzione per ricaricare le note delle foto dal database
  const reloadPhotoNotes = async () => {
    // console.log("🔄 RELOAD - Inizio funzione reloadPhotoNotes");
    setLoadingNotes(true);
    // console.log("🔄 RELOAD - Loading impostato a true");
    // console.log("🔄 RELOAD - Ricaricamento note delle foto...");
    // console.log("🔄 RELOAD - Parametri: appointmentId =", appointmentId);
    
    try {
      // CORREZIONE: Usa SOLO appointmentId per ricaricare le note
      if (!appointmentId) {
        console.error("❌ RELOAD - Nessun appointmentId disponibile per ricaricare le note");
        return {};
      }

      console.log("🔄 RELOAD - Tentativo getWorkPhaseByAppointmentId con:", appointmentId);
      const session = await getWorkPhaseByAppointmentId(appointmentId);
      console.log("🔄 RELOAD - Risultato getWorkPhaseByAppointmentId:", session);
      
      if (session) {
        // console.log("🔄 RELOAD - Sessione trovata:", session);
        
        // Estrai le note dalle foto dei ricambi
        const freshNotes: Record<string, string> = {};
        if (session.sparePartPhotos && Array.isArray(session.sparePartPhotos)) { // CORREZIONE: sparePartPhotos dal database
          session.sparePartPhotos.forEach((photo: any) => {
            if (photo.code && photo.note) {
              freshNotes[photo.code] = photo.note;
            }
          });
        }
        
        // console.log("✅ RELOAD - Note delle foto ricaricate:", freshNotes);
        
        const hasNotes = Object.keys(freshNotes).length > 0;
        // console.log("📝 RELOAD - Note trovate:", hasNotes ? "Sì" : "No");
        
        // Aggiorna lo stato
        // console.log("🔄 RELOAD - Aggiornamento stato photoNotes...");
        setPhotoNotes(freshNotes);
        // console.log("🔄 RELOAD - Impostazione trigger...");
        setNotesReloadTrigger(Date.now());
        // console.log("🔄 RELOAD - Trigger impostato");
        
        return freshNotes;
      } else {
        console.log("⚠️ RELOAD - Nessuna sessione di lavoro trovata per appointmentId:", appointmentId);
        return {};
      }
    } catch (error) {
      console.error("❌ RELOAD - Errore nel ricaricamento note:", error);
      return {};
    } finally {
      // console.log("🔄 RELOAD - Loading impostato a false");
      setLoadingNotes(false);
    }
  };

  // Effect per aprire il modal dopo che le note sono state ricaricate
  useEffect(() => {
    if (notesReloadTrigger > 0) {
      // console.log("🚀 Apertura modal con note aggiornate");
      setShowPhotoSummary(true);
      setNotesReloadTrigger(0); // Reset del trigger
    }
  }, [notesReloadTrigger]);

  // Hook per Smart Reminder
  const { triggerQuoteStatusChanged } = useSmartReminder({
    enableAutoReminders: true,
    enableNotifications: true,
    enableLogging: true
  });

  // Carica i dati esistenti della fase di lavorazione
  useEffect(() => {
    const caricaDati = async () => {
      try {
        setIsLoading(true);
        console.log(`🔧 Inizializzazione fase di lavorazione - appointmentId ATTUALE: ${appointmentId || 'non specificato'}`);
        
        // Reset di tutti gli stati per garantire dati puliti
        setWorkPhase(null);
        setSparePartsPhotos([]);
        setSpareParts([]);
        setDescpart('');
        setQuoteId(null);
        setShowChecklist(false);
        setPreviewPhoto(null);

        // --- CHECK WORKSESSION ESISTENTE ---
        let session = null;
        if (appointmentId) {
          session = await getWorkPhaseByAppointmentId(appointmentId);
          console.log(`📋 Sessione trovata per appointmentId ${appointmentId}:`, session);
          
          // CORREZIONE CRITICA: Se la sessione è già completata, non la aggiorniamo
          if (session && session.completed) {
            console.log(`🚫 Sessione COMPLETATA trovata per appointmentId ${appointmentId}, la ignoro e ne creo una nuova`);
            session = null; // Ignora la sessione completata
          }
        }
        
        // Usa la sessione solo se non è completata e corrisponde all'appointmentId attuale
        if (session && !session.completed && session.appointmentId === appointmentId) {
          console.log(`📋 Riutilizzo sessione NON completata per appointmentId ${appointmentId}`);
          setWorkPhase(session);
          setSparePartsPhotos(session.sparePartPhotos || []); // CORREZIONE: sparePartPhotos dal database
          setDescpart(session.descpart || '');
          setSpareParts(session.spareParts || []);
          // Carica le note delle foto se esistenti
          setPhotoNotes({
            p1note: session.p1note || '',
            p2note: session.p2note || '',
            p3note: session.p3note || '',
            p4note: session.p4note || '',
            p5note: session.p5note || '',
            p6note: session.p6note || ''
          });
        } else {
          console.log(`🔄 Nessuna sessione valida trovata per appointmentId ${appointmentId}, partirò con dati puliti`);
          // Non creare una nuova sessione qui, verrà creata al primo salvataggio
        }
        // --- FINE CHECK WORKSESSION ---

        // Se abbiamo un appointmentId, recupera il quoteId dall'appuntamento
        if (appointmentId) {
          try {
            const { getAppointmentById } = await import("@shared/supabase");
            const appointment = await getAppointmentById(appointmentId);
            console.log(`📋 Appuntamento trovato per appointmentId ${appointmentId}:`, appointment);
            
            // VERIFICA CRITICA: Controlla se l'appuntamento è già completato
            if (appointment && appointment.status === 'completato') {
              console.warn(`⚠️ ATTENZIONE: L'appuntamento ${appointmentId} è già COMPLETATO! Status: ${appointment.status}`);
              // Potremmo voler bloccare l'interfaccia o mostrare un avviso
            } else if (appointment) {
              console.log(`✅ Appuntamento ${appointmentId} in stato: ${appointment.status} - OK per lavorazione`);
            }
            
            if (appointment?.quoteId) {
              setQuoteId(appointment.quoteId);
              await fetchSparePartData(appointment.quoteId);
            }
          } catch (error) {
            console.warn('⚠️ Errore nel recupero dell\'appuntamento:', error);
          }
        }
      } catch (error) {
        console.error('❌ Errore nell\'inizializzazione della fase di lavorazione:', error);
      } finally {
        setIsLoading(false);
      }
    };
    caricaDati();
  }, [vehicleId, appointmentId]);

  // Recupera dati da localStorage all'avvio
  useEffect(() => {
    const local = loadWorkPhaseFromStorage(vehicleId, appointmentId);
    if (local) {
      setSparePartsPhotos(local.photos || []);
      setDescpart(local.notes || '');
    }
  }, [vehicleId, appointmentId]);

  // Salva su localStorage ogni volta che cambia
  useEffect(() => {
    saveWorkPhaseToStorage(vehicleId, appointmentId, sparePartsPhotos, descpart);
  }, [sparePartsPhotos, descpart, vehicleId, appointmentId]);

  // Funzione per recuperare i ricambi da un preventivo
  const fetchSparePartData = async (quoteId: string) => {
    try {
      // console.log(`💰 Recupero ricambi dal preventivo ${quoteId}`);
      
      const quoteData = await getQuoteById(quoteId);
      
      if (quoteData) {
        // console.log(`📊 Dati preventivo trovati:`, quoteData);
        
        const partsFromQuote: SparePart[] = [];
        
        // Estrai i ricambi da items se disponibile
        if (quoteData.items && Array.isArray(quoteData.items)) {
          quoteData.items.forEach(item => {
            if (item.parts && Array.isArray(item.parts)) {
              partsFromQuote.push(...item.parts);
            }
          });
        } else if (quoteData.items && typeof quoteData.items === 'object') {
          // Se items è un oggetto invece di un array
          Object.values(quoteData.items).forEach((item: any) => {
            if (item.parts && Array.isArray(item.parts)) {
              partsFromQuote.push(...item.parts);
            }
          });
        }
        
        // Estrai i ricambi da parts se disponibile e se non abbiamo già trovato ricambi
        if (partsFromQuote.length === 0 && quoteData.parts) {
          if (Array.isArray(quoteData.parts)) {
            partsFromQuote.push(...quoteData.parts.map(part => ({
              id: part.code || Math.random().toString(),
              code: part.code,
              name: part.description,
              description: part.description,
              quantity: part.quantity,
              unitPrice: part.price,
              finalPrice: part.price * part.quantity,
              category: "altro",
              brand: undefined,
              netPrice: undefined,
              markup: undefined,
              margin: undefined
            })));
          }
        }
        
        // Aggiorna lo stato con i ricambi trovati
        setSpareParts(partsFromQuote);
        // console.log(`🔧 Ricambi trovati nel preventivo: ${partsFromQuote.length}`);
      } else {
        // console.log(`❌ Preventivo ${quoteId} non trovato`);
      }
    } catch (error) {
      console.error('❌ Errore nel recupero dei ricambi dal preventivo:', error);
    }
  };

  // Funzione per upload multiplo di foto
  const handleMultiplePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingPhotos(true);
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('key', import.meta.env.VITE_IMGBB_API_KEY || '');

        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        // console.log('Risposta ImgBB:', data); // LOG DEBUG
        if (data.success) {
          return data.data.url;
        } else {
          throw new Error(data.error?.message || 'Errore nel caricamento di ' + file.name + ': ' + JSON.stringify(data));
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const updatedPhotos = [...sparePartsPhotos, ...uploadedUrls];
      setSparePartsPhotos(updatedPhotos);
      
      // CORREZIONE BUG #3: SEMPRE salva su Supabase dopo il caricamento
      await salvaOAggiornaDatiLavorazione(updatedPhotos);
      console.log(`📸 ${uploadedUrls.length} foto aggiunte e salvate su Supabase`);
    } catch (error: any) {
      console.error('❌ Errore durante il caricamento delle foto:', error);
      alert('Errore durante il caricamento di alcune foto.\n' + (error?.message || error));
    } finally {
      setUploadingPhotos(false);
      // Reset input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Funzione per scattare foto dalla camera (simile a AcceptancePhase)
  const handleCameraCapture = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Il tuo browser non supporta l\'accesso alla camera');
        return;
      }
      setUploadingPhotos(true);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      }
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      const captureDialog = document.createElement('div');
      captureDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        z-index: 9999;
        display: flex;
        flex-direction: column;
      `;
      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = `
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.cssText = `
        position: absolute;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        justify-content: center;
        gap: 25px;
        z-index: 10;
      `;
      const captureBtn = document.createElement('button');
      captureBtn.innerHTML = '📸 Scatta';
      captureBtn.style.cssText = `
        background: #f97316;
        color: white;
        border: none;
        padding: 18px 30px;
        border-radius: 50px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        min-width: 140px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255,255,255,0.2);
      `;
      const cancelBtn = document.createElement('button');
      cancelBtn.innerHTML = '❌ Annulla';
      cancelBtn.style.cssText = `
        background: rgba(107, 114, 128, 0.95);
        color: white;
        border: none;
        padding: 18px 30px;
        border-radius: 50px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        min-width: 140px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255,255,255,0.2);
      `;
      const cleanup = () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (document.body.contains(captureDialog)) {
          document.body.removeChild(captureDialog);
        }
        setUploadingPhotos(false);
      };
      const captureImage = () => {
        try {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            alert('Video non ancora pronto. Riprova tra un momento.');
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context!.drawImage(video, 0, 0);
          canvas.toBlob(async (blob) => {
            if (!blob) {
              alert('Errore nella creazione dell\'immagine');
              cleanup();
              return;
            }
            cleanup();
            try {
              const formData = new FormData();
              formData.append('image', blob, `camera-photo-${Date.now()}.jpg`);
              formData.append('key', import.meta.env.VITE_IMGBB_API_KEY || '');
              const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData,
              });
              const data = await response.json();
              // console.log('Risposta ImgBB:', data); // LOG DEBUG
              if (data.success) {
                const imgUrl = data.data.url;
                const newPhotos = [...sparePartsPhotos, imgUrl];
                setSparePartsPhotos(newPhotos);
                
                // CORREZIONE BUG #3: SEMPRE salva su Supabase dopo la cattura
                await salvaOAggiornaDatiLavorazione(newPhotos);
                console.log(`📸 Foto ricambio scattata e salvata su Supabase`);
              } else {
                throw new Error(data.error?.message || 'Errore nel caricamento della foto: ' + JSON.stringify(data));
              }
            } catch (error: any) {
              console.error('❌ Errore durante il caricamento della foto:', error);
              alert('Errore durante il caricamento della foto.\n' + (error?.message || error));
            }
          }, 'image/jpeg', 0.85);
        } catch (error) {
          console.error('❌ Errore nella cattura:', error);
          alert('Errore nella cattura dell\'immagine. Riprova.');
          cleanup();
        }
      };
      captureBtn.onclick = captureImage;
      cancelBtn.onclick = cleanup;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', handleKeyDown);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      videoContainer.appendChild(video);
      buttonsContainer.appendChild(captureBtn);
      buttonsContainer.appendChild(cancelBtn);
      videoContainer.appendChild(buttonsContainer);
      captureDialog.appendChild(videoContainer);
      document.body.appendChild(captureDialog);
      video.onloadedmetadata = () => {
        video.play().catch(err => {
          console.error('Errore nella riproduzione video:', err);
          alert('Errore nell\'avvio della camera. Riprova.');
          cleanup();
        });
      };
      video.onerror = () => {
        alert('Errore nel caricamento del video dalla camera.');
        cleanup();
      };
    } catch (error) {
      console.error('❌ Errore nell\'accesso alla camera:', error);
      let errorMessage = 'Impossibile accedere alla camera.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permesso camera negato. Abilita l\'accesso alla camera nelle impostazioni del browser.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Nessuna camera trovata sul dispositivo.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera occupata da un\'altra applicazione.';
        }
      }
      alert(errorMessage);
      setUploadingPhotos(false);
    }
  };

  const handleRimuoviFoto = async (index: number) => {
    try {
      const updatedPhotos = [...sparePartsPhotos];
      updatedPhotos.splice(index, 1);
      setSparePartsPhotos(updatedPhotos);
      
      // CORREZIONE BUG #3: SEMPRE comunica con Supabase quando si elimina una foto
      await salvaOAggiornaDatiLavorazione(updatedPhotos);
      console.log(`🗑️ Foto ${index + 1} rimossa e aggiornato Supabase`);
    } catch (error) {
      console.error('❌ Errore nella rimozione della foto:', error);
      alert('Errore nella rimozione della foto. Riprova.');
    }
  };

  const salvaOAggiornaDatiLavorazione = async (photos: string[], notesFoto?: {[key: string]: string}) => {
    try {
      // Usa le note passate come parametro o quelle dello stato
      const notesToUse = notesFoto || photoNotes;
      // console.log("💾 Note che verranno salvate:", notesToUse);
      
      // CORREZIONE: Usa SOLO appointmentId per trovare la sessione esistente
      let existingWorkSession = null;
      if (appointmentId) {
        const foundSession = await getWorkPhaseByAppointmentId(appointmentId);
        console.log("🔍 Ricerca WorkSession basata SOLO su appointmentId:", appointmentId, "Trovata:", foundSession);
        
        // CORREZIONE CRITICA: Non aggiornare MAI una sessione completata
        if (foundSession && foundSession.completed) {
          console.log("🚫 Sessione COMPLETATA trovata, non la aggiornerò - creerò una nuova sessione");
          existingWorkSession = null; // Ignora la sessione completata
        } else if (foundSession && foundSession.appointmentId === appointmentId && !foundSession.completed) {
          console.log("✅ Sessione NON completata trovata per appointmentId", appointmentId, "- la aggiornerò");
          existingWorkSession = foundSession;
        } else {
          console.log("🔄 Nessuna sessione valida trovata per appointmentId", appointmentId, "- ne creerò una nuova");
          existingWorkSession = null;
        }
      } else {
        console.error("❌ Nessun appointmentId disponibile per il salvataggio");
        throw new Error("appointmentId è richiesto per salvare i dati di lavorazione");
      }

      // CORREZIONE BUG #2: Mappatura corretta dei campi per Supabase
      const workPhaseUpdateData = {
        sparePartPhotos: photos, // CORREZIONE: sparePartPhotos (senza 's') come nel database
        spareParts: spareParts,
        descpart: descpart,
        p1note: notesToUse.p1note || '',
        p2note: notesToUse.p2note || '',
        p3note: notesToUse.p3note || '',
        p4note: notesToUse.p4note || '',
        p5note: notesToUse.p5note || '',
        p6note: notesToUse.p6note || ''
      };

      const workPhaseCreateData = {
        appointmentId: appointmentId, // PARAMETRO PRINCIPALE
        vehicleId: vehicleId, // Manteniamo per compatibilità
        clientId: existingWorkSession?.clientId || workPhase?.clientId || 'unknown',
        quoteId: quoteId || undefined,
        status: 'in_progress' as const,
        sparePartPhotos: photos, // CORREZIONE: sparePartPhotos (senza 's') come nel database
        spareParts: spareParts,
        descpart: descpart,
        p1note: notesToUse.p1note || '',
        p2note: notesToUse.p2note || '',
        p3note: notesToUse.p3note || '',
        p4note: notesToUse.p4note || '',
        p5note: notesToUse.p5note || '',
        p6note: notesToUse.p6note || '',
        startedAt: existingWorkSession?.startedAt || workPhase?.startedAt || new Date().toISOString(),
        completedAt: null, // Assicurati che non sia completata
        completedBy: null // Assicurati che non sia completata
      };

      if (existingWorkSession?.id) {
        // Aggiorna fase esistente NON completata - SEMPRE aggiorna su Supabase
        console.log("🔄 Aggiornamento WorkPhase NON completata su Supabase:", existingWorkSession.id);
        const updatedWorkPhase = await updateWorkPhase(existingWorkSession.id, workPhaseUpdateData);
        setWorkPhase(updatedWorkPhase);
        console.log("✅ WorkPhase aggiornata su Supabase con", photos.length, "foto e note");
      } else {
        // Crea nuova fase di lavorazione - SEMPRE salva su Supabase
        console.log("🔄 Creazione NUOVA WorkPhase su Supabase per appointmentId:", appointmentId);
        const newWorkPhase = await createWorkPhase(workPhaseCreateData);
        setWorkPhase(newWorkPhase);
        console.log("✅ NUOVA WorkPhase creata su Supabase con", photos.length, "foto e note");
      }
      
      // VERIFICAZIONE POST-SALVATAGGIO: Controlla che i dati siano stati salvati
      // CORREZIONE: Verifica basata SOLO su appointmentId
      const verification = await getWorkPhaseByAppointmentId(appointmentId);
      
      if (verification && verification.sparePartPhotos) {
        console.log("✅ VERIFICA: WorkPhase salvata correttamente con", verification.sparePartPhotos.length, "foto per appointmentId:", appointmentId);
      } else {
        console.warn("⚠️ VERIFICA: Problema nel salvataggio delle foto su Supabase per appointmentId:", appointmentId);
        console.log("🔍 VERIFICA DETTAGLIATA: Oggetto verification:", verification);
      }
      
    } catch (error) {
      console.error('❌ Errore nel salvataggio dei dati di lavorazione:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      const completedAt = new Date().toISOString();
      
      console.log(`🔄 INIZIO COMPLETAMENTO: ${completedAt} per appointmentId: ${appointmentId}`);
      
      // CORREZIONE: Usa SOLO appointmentId per trovare la sessione esistente
      let existingWorkSession = null;
      if (appointmentId) {
        const foundSession = await getWorkPhaseByAppointmentId(appointmentId);
        console.log("🔍 Completamento WorkSession basato SOLO su appointmentId:", appointmentId, "Trovata:", foundSession);
        
        // CORREZIONE CRITICA: Se la sessione è già completata, non la aggiorniamo
        if (foundSession && foundSession.completed) {
          console.log("⚠️ Sessione GIÀ COMPLETATA trovata per appointmentId", appointmentId, "- non la aggiornerò");
          return;
        } else if (foundSession && foundSession.appointmentId === appointmentId && !foundSession.completed) {
          console.log("✅ Sessione NON completata trovata per appointmentId", appointmentId, "- la completerò");
          existingWorkSession = foundSession;
        }
      } else {
        console.error("❌ Nessun appointmentId disponibile per il completamento");
        throw new Error("appointmentId è richiesto per completare la lavorazione");
      }
      
      if (existingWorkSession?.id) {
        // Completa la sessione esistente NON completata
        await updateWorkPhase(existingWorkSession.id, {
          status: 'completed',
          completedAt: completedAt,
          completedBy: 'web-app',
          sparePartPhotos: sparePartsPhotos, // CORREZIONE: sparePartPhotos (senza 's')
          spareParts: spareParts,
          descpart: descpart,
          p1note: photoNotes.p1note || '',
          p2note: photoNotes.p2note || '',
          p3note: photoNotes.p3note || '',
          p4note: photoNotes.p4note || '',
          p5note: photoNotes.p5note || '',
          p6note: photoNotes.p6note || ''
        });
        console.log("✅ WorkPhase esistente completata per appointmentId:", appointmentId);
      } else {
        // Crea e completa immediatamente una nuova sessione
        await createWorkPhase({
          appointmentId: appointmentId, // PARAMETRO PRINCIPALE
          vehicleId: vehicleId, // Manteniamo per compatibilità
          clientId: workPhase?.clientId || 'unknown',
          quoteId: quoteId || undefined,
          status: 'completed',
          sparePartPhotos: sparePartsPhotos, // CORREZIONE: sparePartPhotos (senza 's')
          spareParts: spareParts,
          descpart: descpart,
          p1note: photoNotes.p1note || '',
          p2note: photoNotes.p2note || '',
          p3note: photoNotes.p3note || '',
          p4note: photoNotes.p4note || '',
          p5note: photoNotes.p5note || '',
          p6note: photoNotes.p6note || '',
          startedAt: new Date().toISOString(),
          completedAt: completedAt,
          completedBy: 'web-app'
        });
        console.log("✅ NUOVA WorkPhase completata creata per appointmentId:", appointmentId);
      }
      
      // Aggiorna sempre lo stato dell'appuntamento
      if (appointmentId) {
        await updateAppointment(appointmentId, {
          status: "completato"
        });
        console.log("✅ Appuntamento aggiornato a completato per appointmentId:", appointmentId);
        
        // 🔔 TRIGGER SMART REMINDER - Lavoro completato tramite appuntamento
        try {
          const { getAppointmentById } = await import("@shared/supabase");
          const appointment = await getAppointmentById(appointmentId);
          if (appointment?.quoteId) {
            // console.log("🔔 Trigger Smart Reminder per lavoro completato da WorkPhase:", appointment.quoteId);
            triggerQuoteStatusChanged(appointment.quoteId, "accettato", "completato");
          }
        } catch (reminderError) {
          console.error("❌ Errore nel trigger Smart Reminder:", reminderError);
        }
      }
      
      const key = getWorkPhaseStorageKey(vehicleId, appointmentId);
      localStorage.removeItem(key);
      console.log(`✅ Fase di lavorazione completata con successo per appointmentId: ${appointmentId}`);
      onComplete();
    } catch (error) {
      console.error("❌ Errore nel completamento della lavorazione:", error);
      alert("Errore nel salvataggio delle informazioni. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotesChange = async (newNotes: string) => {
    setDescpart(newNotes);
    
    // CORREZIONE BUG #3: Salva automaticamente su Supabase dopo ogni modifica delle note
    if (workPhase?.id) {
      try {
        await updateWorkPhase(workPhase.id, {
          descpart: newNotes
        });
        console.log('📝 Note salvate automaticamente su Supabase per appointmentId:', appointmentId);
      } catch (error) {
        console.error('❌ Errore nel salvataggio automatico delle note:', error);
      }
    } else if (appointmentId) {
      // Se non esiste ancora una WorkPhase, salva tutto (solo se abbiamo appointmentId)
      try {
        await salvaOAggiornaDatiLavorazione(sparePartsPhotos);
        console.log('📝 WorkPhase creata con note salvate su Supabase per appointmentId:', appointmentId);
      } catch (error) {
        console.error('❌ Errore nella creazione WorkPhase con note:', error);
      }
    } else {
      console.warn('⚠️ Nessun appointmentId disponibile per salvare le note');
    }
  };

  // Funzione per salvataggio manuale
  const handleManualSave = async () => {
    try {
      // CORREZIONE BUG #3: Usa la funzione di salvataggio principale per garantire coerenza
      await salvaOAggiornaDatiLavorazione(sparePartsPhotos, photoNotes);
      setSaveFeedback("Dati salvati su Supabase!");
      console.log("💾 Salvataggio manuale completato su Supabase");
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (error) {
      console.error("❌ Errore nel salvataggio manuale:", error);
      setSaveFeedback("Errore nel salvataggio!");
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Fase di Lavorazione</h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleManualSave}
            className="bg-gray-500 text-white px-4 py-2 rounded font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Salva Dati
          </button>
          <button
            onClick={handleSubmit}
            className="bg-orange-500 text-white px-4 py-2 rounded font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? "Salvataggio..." : "Conferma Lavorazione"}
          </button>
        </div>
      </div>
      {saveFeedback && (
        <div className="mb-2 text-green-400 font-semibold">{saveFeedback}</div>
      )}
      
      {/* Sezione foto ricambi */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-3">Foto Ricambi Sostituiti</h3>
        
        {/* Area upload compatta */}
        <div className="border-2 border-dashed border-border rounded-lg p-4 mb-4 bg-background hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600 transition-colors">
              <Upload size={18} />
              <span>{uploadingPhotos ? "Caricamento..." : "Seleziona Foto"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleMultiplePhotoUpload}
                className="hidden"
                disabled={uploadingPhotos}
              />
            </label>
            <button
              type="button"
              onClick={handleCameraCapture}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploadingPhotos}
            >
              <Camera size={18} />
              <span>Scatta</span>
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Foto {sparePartsPhotos.length} caricate
          </p>
        </div>

        {/* Griglia foto compatta */}
        {sparePartsPhotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sparePartsPhotos.map((photo, index) => (
              <div key={index} className="relative group border border-border rounded overflow-hidden bg-background">
                <div className="aspect-square">
                  <img 
                    src={photo} 
                    alt={`Ricambio ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPreviewPhoto(photo)}
                      className="bg-white/90 hover:bg-white text-black p-1.5 rounded-full transition-colors"
                      title="Visualizza"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => handleRimuoviFoto(index)}
                      className="bg-red-500/90 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors"
                      title="Rimuovi"
                      disabled={isLoading}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottone Riepilogo Foto */}
        {sparePartsPhotos.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                // console.log("🔄 CLICK - Inizio ricaricamento note...");
                // console.log("🔄 CLICK - vehicleId:", vehicleId);
                // console.log("🔄 CLICK - appointmentId:", appointmentId);
                // console.log("🔄 CLICK - Stato attuale photoNotes:", photoNotes);
                
                try {
                  const freshNotes = await reloadPhotoNotes();
                  // console.log("🔄 CLICK - Risultato reloadPhotoNotes:", freshNotes);
                  if (!freshNotes) {
                    // console.log("⚠️ CLICK - Problema nel ricaricamento, apertura modal con note vuote...");
                    setShowPhotoSummary(true);
                  }
                  // Il modal si aprirà automaticamente tramite useEffect quando le note sono pronte
                } catch (error) {
                  console.error("❌ CLICK - Errore durante il ricaricamento:", error);
                  setShowPhotoSummary(true);
                }
              }}
              disabled={loadingNotes}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded font-medium hover:bg-green-600 transition-colors mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={16} />
              {loadingNotes ? "Caricamento..." : `Riepilogo Foto (${sparePartsPhotos.length})`}
            </button>
          </div>
        )}
      </div>
      
      {/* Sezione Note Lavorazione */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-3 text-orange-400">Note Libere</h3>
        <div className="border border-border rounded-lg p-4 bg-background">
          <textarea
            value={descpart}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Inserisci qui le note relative alla sostituzione dei ricambi"
            className="w-full h-32 p-3 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            disabled={isLoading}
          />
        </div>
      </div>
      
      {/* Pulsante checklist */}
      <div className="mb-4">
        <button
          onClick={() => setShowChecklist(true)}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600 transition-colors"
        >
          <Clipboard size={16} />
          Apri Checklist Controlli
        </button>
      </div>
      
      {/* Modal anteprima foto */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-3xl max-h-[80vh] bg-background border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Anteprima Ricambio</h3>
              <button 
                className="hover:bg-muted p-1 rounded transition-colors"
                onClick={() => setPreviewPhoto(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <img 
                src={previewPhoto} 
                alt="Anteprima ricambio" 
                className="max-w-full max-h-[70vh] mx-auto rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklist && (
        <SchedaIspezioneVeicolo 
          vehicleId={vehicleId} 
          appointmentId={appointmentId}
          onClose={() => {
            // console.log('🔄 WorkPhase: onClose chiamato, chiusura checklist...');
            setShowChecklist(false);
            // console.log('✅ WorkPhase: showChecklist impostato a false');
          }}
        />
      )}

      {/* Modal Riepilogo Foto e Note */}
      {showPhotoSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-6xl h-[95vh] bg-background border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-lg">Riepilogo Foto</h3>
              <button 
                className="hover:bg-muted p-2 rounded transition-colors"
                onClick={() => setShowPhotoSummary(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div 
              className="p-4 overflow-y-scroll h-[calc(95vh-80px)] [&::-webkit-scrollbar]:hidden" 
              style={{
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none'
              }}
            >
              <div className="flex flex-col gap-8">
                {sparePartsPhotos.slice(0, 6).map((photo: string, index: number) => {
                  const noteKey = `p${index + 1}note` as keyof typeof photoNotes;
                  const noteValue = photoNotes[noteKey] || '';
                  
                  return (
                    <div key={index} className="border border-border rounded-lg p-6 bg-muted/20">
                      <div className="flex gap-6 items-start">
                        {/* Foto a sinistra */}
                        <div className="flex-shrink-0">
                          <img 
                            src={photo} 
                            alt={`Ricambio ${index + 1}`}
                            className="w-64 h-48 object-cover rounded border"
                          />
                          <p className="text-sm text-center mt-2 font-medium text-orange-500">Foto {index + 1}</p>
                        </div>
                        
                        {/* Note a destra */}
                        <div className="flex-1">
                          <label className="block text-lg font-medium mb-3 text-orange-400">
                            Descrizione e Note:
                          </label>
                          <textarea
                            value={noteValue}
                            onChange={(e) => {
                              const newNotes = { ...photoNotes, [noteKey]: e.target.value };
                              setPhotoNotes(newNotes);
                            }}
                            placeholder={`Inserisci la descrizione del ricambio e le note per la foto ${index + 1}...`}
                            className="w-full h-32 p-4 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Aggiungi dettagli sul ricambio sostituito, problemi riscontrati, particolarità, etc.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => setShowPhotoSummary(false)}
                  className="px-6 py-3 border border-border rounded hover:bg-muted transition-colors font-medium"
                >
                  Chiudi
                </button>
                <button
                  onClick={async () => {
                    // CORREZIONE BUG #3: Salvataggio consistente delle note dal modal
                    console.log("💾 Salvataggio note dal modal:", photoNotes);
                    try {
                      await salvaOAggiornaDatiLavorazione(sparePartsPhotos, photoNotes);
                      setShowPhotoSummary(false);
                      console.log("✅ Note salvate dal modal su Supabase");
                    } catch (error) {
                      console.error("❌ Errore nel salvataggio note dal modal:", error);
                      alert("Errore nel salvataggio delle note. Riprova.");
                    }
                  }}
                  className="px-6 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors font-medium"
                >
                  Salva Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkPhase; 