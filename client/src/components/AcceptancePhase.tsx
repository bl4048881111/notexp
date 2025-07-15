import React, { useState, useEffect } from "react";
import { Eye, X, Upload, FileText, Camera } from "lucide-react";
import { 
  getAcceptancePhaseByVehicleId, 
  createAcceptancePhase, 
  updateAcceptancePhase,
  getAppointmentById,
  getQuoteById,
  getWorkPhaseByAppointmentId,
  createWorkPhase
} from "@shared/supabase";

interface AcceptancePhaseProps {
  vehicleId: string;
  onComplete: () => void;
  clientName?: string;
  appointmentId?: string;
}

const AcceptancePhase: React.FC<AcceptancePhaseProps> = ({ vehicleId, onComplete, clientName, appointmentId }) => {
  const [acceptancePhase, setAcceptancePhase] = useState<any | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>(["", "", "", ""]);
  const [mileage, setMileage] = useState<string>("");
  const [fuelLevel, setFuelLevel] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [quote, setQuote] = useState<any | null>(null);
  const [showQuoteSummary, setShowQuoteSummary] = useState<boolean>(false);

  // Carica i dati se già esistenti
  useEffect(() => {
    const loadAcceptanceData = async () => {
      try {
        console.log(`🚗 Caricamento dati accettazione - appointmentId: ${appointmentId}, vehicleId: ${vehicleId}`);
        
        let existingAcceptance = null;
        
        // Cerca per vehicleId ma SOLO se l'appointmentId corrisponde
        if (vehicleId) {
          try {
            const foundAcceptance = await getAcceptancePhaseByVehicleId(vehicleId);
            if (foundAcceptance) {
              console.log(`📋 Trovata fase accettazione per vehicleId ${vehicleId} con appointmentId: ${foundAcceptance.appointmentId}`);
              console.log(`🔍 Appuntamento corrente: ${appointmentId}, Trovato: ${foundAcceptance.appointmentId}`);
              
              // ISOLAMENTO: USA I DATI SOLO SE L'APPOINTMENTID CORRISPONDE
              if (appointmentId && foundAcceptance.appointmentId === appointmentId) {
                console.log(`✅ MATCH: appointmentId corrisponde - carico dati esistenti`);
                existingAcceptance = foundAcceptance;
              } else {
                console.log(`❌ ISOLAMENTO: appointmentId diverso (${foundAcceptance.appointmentId} vs ${appointmentId}) - IGNORO dati vecchi`);
                console.log(`🆕 Creo sessione di accettazione PULITA per appointmentId: ${appointmentId}`);
                existingAcceptance = null;
              }
            } else {
              console.log(`📝 Nessuna fase accettazione trovata per vehicleId: ${vehicleId}`);
            }
          } catch (error) {
            console.warn(`⚠️ Errore nella ricerca per vehicleId ${vehicleId}:`, error);
          }
        }
        
        if (existingAcceptance) {
          console.log(`📋 Fase di accettazione caricata per appointmentId ${appointmentId}:`, existingAcceptance);
          setAcceptancePhase(existingAcceptance);
          setMileage(existingAcceptance.mileage || "");
          setFuelLevel(existingAcceptance.fuelLevel || "");
          
          // Assicura che ci siano sempre 4 slot per le foto
          const existingPhotos = [...(existingAcceptance.photos || [])];
          while (existingPhotos.length < 4) existingPhotos.push("");
          setPhotoUrls(existingPhotos.slice(0, 4));
        } else {
          console.log(`🆕 Inizializzazione PULITA per appointmentId: ${appointmentId} - nessun dato precedente`);
          // Reset completo per assicurare dati puliti
          setAcceptancePhase(null);
          setMileage("");
          setFuelLevel("");
          setPhotoUrls(["", "", "", ""]);
        }

        // Carica il preventivo se disponibile un appointmentId
        if (appointmentId) {
          try {
            const appointment = await getAppointmentById(appointmentId);
            if (appointment?.quoteId) {
              const quoteData = await getQuoteById(appointment.quoteId);
              setQuote(quoteData);
              console.log(`📄 Preventivo caricato: ${appointment.quoteId}`, quoteData);
            }
          } catch (error) {
            console.warn('⚠️ Errore nel caricamento del preventivo:', error);
          }
        }
      } catch (error) {
        console.error('❌ Errore nel caricamento dei dati di accettazione:', error);
      }
    };

    loadAcceptanceData();
  }, [vehicleId, appointmentId]);

  // Funzione per scattare foto dalla camera
  const handleCameraCapture = async (index: number) => {
    try {
      // Controlla se il browser supporta la camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Il tuo browser non supporta l\'accesso alla camera');
        return;
      }

      setIsLoading(true);
      
      // Richiedi accesso alla camera con fallback
      let stream;
      try {
        // Prova prima con la camera posteriore
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (err) {
        // Fallback alla camera frontale o qualsiasi camera disponibile
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      }
      
      // Crea elementi DOM
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Configura video
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true; // Importante per iOS
      
      // Crea il dialog di cattura
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
      
      // Funzione per ripulire tutto
      const cleanup = () => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (document.body.contains(captureDialog)) {
          document.body.removeChild(captureDialog);
        }
        setIsLoading(false);
      };
      
      // Funzione per catturare l'immagine
      const captureImage = () => {
        try {
          // Assicurati che il video sia pronto
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            alert('Video non ancora pronto. Riprova tra un momento.');
            return;
          }
          
          // Imposta le dimensioni del canvas
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Disegna il frame corrente sul canvas
          context!.drawImage(video, 0, 0);
          
          // Converti in blob
          canvas.toBlob(async (blob) => {
            if (!blob) {
              alert('Errore nella creazione dell\'immagine');
              cleanup();
              return;
            }
            
            cleanup();
            
            // Upload dell'immagine
            try {
              const formData = new FormData();
              formData.append('image', blob, `camera-photo-${Date.now()}.jpg`);
              formData.append('key', import.meta.env.VITE_IMGBB_API_KEY || '');

              const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData,
              });

              const data = await response.json();
              if (data.success) {
                const imgUrl = data.data.url;
                
                // Aggiorna l'array di URL delle foto
                const newPhotoUrls = [...photoUrls];
                newPhotoUrls[index] = imgUrl;
                setPhotoUrls(newPhotoUrls);
                
                // Salva in Supabase
                await salvaOAggiornaDatiAccettazione(newPhotoUrls);
                
                console.log(`📸 Foto ${index + 1} scattata e caricata con successo`);
              } else {
                throw new Error(data.error?.message || 'Errore nel caricamento della foto');
              }
            } catch (error) {
              console.error('❌ Errore durante il caricamento della foto:', error);
              alert('Errore durante il caricamento della foto. Riprova.');
            }
          }, 'image/jpeg', 0.85);
          
        } catch (error) {
          console.error('❌ Errore nella cattura:', error);
          alert('Errore nella cattura dell\'immagine. Riprova.');
          cleanup();
        }
      };
      
      // Event listeners
      captureBtn.onclick = captureImage;
      cancelBtn.onclick = cleanup;
      
      // Aggiungi evento per chiudere premendo ESC
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', handleKeyDown);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      
      // Costruisci il dialog
      videoContainer.appendChild(video);
      buttonsContainer.appendChild(captureBtn);
      buttonsContainer.appendChild(cancelBtn);
      videoContainer.appendChild(buttonsContainer);
      captureDialog.appendChild(videoContainer);
      document.body.appendChild(captureDialog);
      
      // Attendi che il video sia pronto
      video.onloadedmetadata = () => {
        video.play().catch(err => {
          console.error('Errore nella riproduzione video:', err);
          alert('Errore nell\'avvio della camera. Riprova.');
          cleanup();
        });
      };
      
      // Gestione errori video
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
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      // Upload su ImgBB
      const formData = new FormData();
      formData.append('image', file);
      formData.append('key', import.meta.env.VITE_IMGBB_API_KEY || '');

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        const imgUrl = data.data.url;
        
        // Aggiorna l'array di URL delle foto
        const newPhotoUrls = [...photoUrls];
        newPhotoUrls[index] = imgUrl;
        setPhotoUrls(newPhotoUrls);
        
        // Salva in Supabase
        await salvaOAggiornaDatiAccettazione(newPhotoUrls);
        
        console.log(`📸 Foto ${index + 1} caricata con successo`);
      } else {
        throw new Error('Errore nel caricamento della foto');
      }
    } catch (error) {
      console.error('❌ Errore durante il caricamento della foto:', error);
      alert('Errore durante il caricamento della foto. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const salvaOAggiornaDatiAccettazione = async (photos: string[]) => {
    try {
      // Recupera il clientId dall'appuntamento se disponibile
      let clientId = 'unknown';
      if (appointmentId) {
        try {
          const appointment = await getAppointmentById(appointmentId);
          if (appointment) {
            clientId = appointment.clientId;
          }
        } catch (error) {
          console.warn('⚠️ Errore nel recupero dell\'appuntamento:', error);
        }
      }

      const acceptanceData = {
        appointmentId: appointmentId,
        vehicleId: vehicleId,
        clientId: clientId,
        mileage: mileage,
        fuelLevel: fuelLevel,
        photos: photos.filter(url => url.trim() !== ''),
        acceptanceDate: acceptancePhase?.acceptanceDate || new Date().toISOString(),
        acceptanceCompleted: false,
        notes: acceptancePhase?.notes
      };

      if (acceptancePhase?.id) {
        // Aggiorna fase esistente
        const updatedAcceptance = await updateAcceptancePhase(acceptancePhase.id, {
          photos: photos.filter(url => url.trim() !== ''),
          mileage: mileage,
          fuelLevel: fuelLevel
        });
        setAcceptancePhase(updatedAcceptance);
      } else {
        // Crea nuova fase di accettazione
        const newAcceptance = await createAcceptancePhase(acceptanceData);
        setAcceptancePhase(newAcceptance);
      }
    } catch (error) {
      console.error('❌ Errore nel salvataggio dei dati di accettazione:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mileage || !fuelLevel) {
      alert('Inserisci chilometraggio e livello carburante prima di confermare');
      return;
    }
    
    const hasAtLeastOnePhoto = photoUrls.some(url => url.trim() !== '');
    if (!hasAtLeastOnePhoto) {
      alert('Carica almeno una foto del veicolo prima di confermare');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Recupera il clientId dall'appuntamento se disponibile
      let clientId = 'unknown';
      if (appointmentId) {
        try {
          const appointment = await getAppointmentById(appointmentId);
          if (appointment) {
            clientId = appointment.clientId;
          }
        } catch (error) {
          console.warn('⚠️ Errore nel recupero dell\'appuntamento:', error);
        }
      }

      const acceptanceData = {
        appointmentId: appointmentId,
        vehicleId: vehicleId,
        clientId: clientId,
        mileage: mileage,
        fuelLevel: fuelLevel,
        photos: photoUrls.filter(url => url.trim() !== ''),
        acceptanceDate: new Date().toISOString(),
        acceptanceCompleted: true,
        notes: acceptancePhase?.notes
      };

      if (acceptancePhase?.id) {
        // Aggiorna fase esistente come completata
        await updateAcceptancePhase(acceptancePhase.id, {
          mileage: mileage,
          fuelLevel: fuelLevel,
          photos: photoUrls.filter(url => url.trim() !== ''),
          acceptanceCompleted: true,
          acceptanceDate: new Date().toISOString()
        });
      } else {
        // Crea nuova fase di accettazione già completata
        await createAcceptancePhase(acceptanceData);
      }

      // --- CREAZIONE WORKSESSION SE NON ESISTE GIÀ ---
      if (appointmentId) {
        const existingWorkSession = await getWorkPhaseByAppointmentId(appointmentId);
        if (!existingWorkSession) {
          await createWorkPhase({
            appointmentId: appointmentId,
            vehicleId: vehicleId,
            clientId: clientId,
            status: 'in_progress',
            startedAt: new Date().toISOString()
          });
        }
      }
      // --- FINE CREAZIONE WORKSESSION ---

      console.log(`✅ Fase di accettazione completata con successo`);
      onComplete();
    } catch (error) {
      console.error('❌ Errore durante il salvataggio dei dati:', error);
      alert('Errore durante il salvataggio dei dati. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const photoLabels = [
    "Foto 1",
    "Foto 2",
    "Foto 3", 
    "Foto 4"
  ];

  const QuoteSummaryModal = () => {
    if (!quote || !showQuoteSummary) return null;

    const calculateTotals = () => {
      let partsTotal = 0;
      let laborTotal = 0;

      // Calcola il totale dei ricambi
      if (quote.items && Array.isArray(quote.items)) {
        quote.items.forEach((item: any) => {
          if (item.parts && Array.isArray(item.parts)) {
            item.parts.forEach((part: any) => {
              partsTotal += (part.finalPrice || part.unitPrice || 0) * (part.quantity || 1);
            });
          }
        });
      }

      // Calcola il totale manodopera
      laborTotal = (quote.laborPrice || 0) * (quote.laborHours || 0);

      const subtotal = partsTotal + laborTotal;
      const taxAmount = (subtotal * (quote.taxRate || 22)) / 100;
      const total = subtotal + taxAmount;

      return { partsTotal, laborTotal, subtotal, taxAmount, total };
    };

    const { partsTotal, laborTotal, subtotal, taxAmount, total } = calculateTotals();

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowQuoteSummary(false)}>
        <div className="bg-card rounded-lg border border-border max-w-2xl max-h-[80vh] overflow-auto m-4" onClick={e => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Riepilogo Preventivo {quote.id}</h3>
              <button 
                className="p-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                onClick={() => setShowQuoteSummary(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Cliente:</strong> {quote.clientName}</div>
                {/*<div><strong>Data:</strong> {quote.date}</div>*/}
                <div><strong>Targa:</strong> {quote.plate}</div>
                {/*<div><strong>Stato:</strong> {quote.status}</div>*/}
              </div>

              {quote.items && quote.items.length > 0 && (
                <div>
                  {/*<h4 className="font-semibold mb-2">Servizi:</h4>*/}
                  <div className="space-y-2">
                    {quote.items.map((item: any, index: number) => (
                      <div key={index} className="border border-border rounded p-3">
                        <div className="font-medium">{item.serviceType?.name || 'Servizio'}</div>
                        {item.parts && item.parts.length > 0 && (
                          <div className="mt-2">
                            {/*<div className="text-sm font-medium mb-1">Ricambi:</div>*/}
                            {item.parts.map((part: any, partIndex: number) => (
                              <div key={partIndex} className="text-sm text-muted-foreground flex justify-between text-orange-500">
                                <span>{part.name || part.description} (x{part.quantity || 1})</span>
                                {/*<span>€{((part.finalPrice || part.unitPrice || 0) * (part.quantity || 1)).toFixed(2)}</span>*/}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/*<div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-2">Totali:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Ricambi:</span>
                    <span>€{partsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manodopera ({quote.laborHours || 0}h a €{quote.laborPrice || 0}/h):</span>
                    <span>€{laborTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotale:</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA ({quote.taxRate || 22}%):</span>
                    <span>€{taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                    <span>Totale:</span>
                    <span>€{total.toFixed(2)}</span>
                  </div>
                </div>
              </div> */}

              {quote.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Note:</h4>
                  <p className="text-sm text-muted-foreground">{quote.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Fase di Accettazione</h2>
        {quote && (
          <button
            onClick={() => setShowQuoteSummary(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
            title="Visualizza riepilogo preventivo"
          >
            <FileText size={16} />
            <span className="font-medium">Preventivo {quote.id}</span>
          </button>
        )}
      </div>
      
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photoUrls.map((url, index) => (
            <div key={index} className="border border-border rounded-lg p-3 bg-card">
              <h3 className="text-sm font-semibold mb-3 text-center">{photoLabels[index]}</h3>
              
              {/* Stato foto - Mostra preview se presente */}
              {url ? (
                <div className="mb-3">
                  <div className="relative group">
                    <img 
                      src={url} 
                      alt={`${photoLabels[index]} preview`}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                        <button
                          onClick={() => setPreviewPhoto(url)}
                          className="bg-white/90 hover:bg-white text-gray-800 p-1 rounded-full shadow-lg transition-all"
                          title="Visualizza anteprima"
                          type="button"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            const newPhotoUrls = [...photoUrls];
                            newPhotoUrls[index] = "";
                            setPhotoUrls(newPhotoUrls);
                          }}
                          className="bg-red-500/90 hover:bg-red-500 text-white p-1 rounded-full shadow-lg transition-all"
                          title="Rimuovi foto"
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-1">
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Caricata
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-3">
                  <div className="w-full h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-50">
                    <div className="text-center text-gray-400">
                      <Camera size={20} className="mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Nessuna foto</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Pulsanti di azione compatti */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleCameraCapture(index)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  <Camera size={14} />
                  <span>Scatta</span>
                </button>
                
                <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium cursor-pointer transition-colors">
                  <Upload size={14} />
                  <span>Galleria</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, index)}
                    className="hidden"
                    disabled={isLoading}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popup anteprima */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-3xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
              onClick={() => setPreviewPhoto(null)}
            >
              <X size={24} />
            </button>
            <img 
              src={previewPhoto} 
              alt="Anteprima foto" 
              className="max-w-full max-h-[80vh] object-contain border-2 border-white/10 rounded shadow-xl" 
            />
          </div>
        </div>
      )}

      <QuoteSummaryModal />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 font-semibold">Chilometraggio</label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="w-full p-2 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Inserisci il chilometraggio attuale"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold">Livello Carburante</label>
            <select
              value={fuelLevel}
              onChange={(e) => setFuelLevel(e.target.value)}
              className="w-full p-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
              disabled={isLoading}
            >
              <option value="" className="text-muted-foreground">Seleziona il livello carburante</option>
              <option value="empty">Vuoto</option>
              <option value="quarter">1/4</option>
              <option value="half">1/2</option>
              <option value="three-quarters">3/4</option>
              <option value="full">Pieno</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded font-bold hover:bg-primary/90 transition-colors w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Salvataggio in corso..." : "Conferma Accettazione"}
        </button>
      </form>
    </div>
  );
};

export default AcceptancePhase; 