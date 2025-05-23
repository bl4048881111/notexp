import React, { useState, useEffect } from "react";
import { ref, get, update } from "firebase/database";
import { rtdb } from "@/firebase";
import { Upload, X, Check, Eye, FileText } from "lucide-react";
import SchedaIspezioneVeicolo from "./checklist/checklist";

interface SparePart {
  code?: string;
  name?: string;
  quantity?: number;
  price?: number;
  finalPrice?: number;
}

interface QuoteItem {
  id: string;
  name: string;
  parts?: SparePart[];
}

interface QuoteData {
  id: string;
  items?: QuoteItem[];
  parts?: SparePart[];
}

interface WorkPhaseProps {
  vehicleId: string;
  appointmentId?: string;
  onComplete: () => void;
}

const WorkPhase: React.FC<WorkPhaseProps> = ({ vehicleId, appointmentId, onComplete }) => {
  const [sparePartPhotos, setSparePartPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  // Carica i dati esistenti
  useEffect(() => {
    const caricaDati = async () => {
      try {
        console.log(`Caricamento dati con vehicleId: ${vehicleId} e appointmentId: ${appointmentId || 'non specificato'}`);
        
        // Priorità al percorso dell'appuntamento se disponibile
        if (appointmentId) {
          const appointmentRef = ref(rtdb, `appointments/${appointmentId}`);
          const appointmentSnapshot = await get(appointmentRef);
          
          if (appointmentSnapshot.exists()) {
            const appointmentData = appointmentSnapshot.val();
            console.log(`Dati appuntamento trovati:`, appointmentData);
            
            // Se l'appuntamento ha un preventivo associato, carica i ricambi
            if (appointmentData.quoteId) {
              setQuoteId(appointmentData.quoteId);
              await fetchSparePartData(appointmentId, appointmentData.quoteId);
            }
            
            if (appointmentData.sparePartPhotos && Array.isArray(appointmentData.sparePartPhotos)) {
              setSparePartPhotos(appointmentData.sparePartPhotos);
              console.log(`Foto ricambi caricate da appuntamento: ${appointmentData.sparePartPhotos.length}`);
              return; // Usiamo i dati dell'appuntamento e usciamo
            }
          }
        }
        
        // Fallback al percorso del veicolo se non troviamo dati nell'appuntamento
        const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
        const snapshot = await get(vehicleRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.sparePartPhotos && Array.isArray(data.sparePartPhotos)) {
            setSparePartPhotos(data.sparePartPhotos);
            console.log(`Foto ricambi caricate da veicolo: ${data.sparePartPhotos.length}`);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento dei dati di lavorazione:', error);
      }
    };
    
    caricaDati();
  }, [vehicleId, appointmentId]);

  // Funzione per recuperare i ricambi da un preventivo
  const fetchSparePartData = async (appointmentId: string, quoteId: string) => {
    try {
      console.log(`Recupero ricambi dal preventivo ${quoteId} per l'appuntamento ${appointmentId}`);
      
      const quoteRef = ref(rtdb, `quotes/${quoteId}`);
      const quoteSnapshot = await get(quoteRef);
      
      if (quoteSnapshot.exists()) {
        const quoteData: QuoteData = quoteSnapshot.val();
        console.log(`Dati preventivo trovati:`, quoteData);
        
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
            partsFromQuote.push(...quoteData.parts);
          } else if (typeof quoteData.parts === 'object') {
            partsFromQuote.push(...Object.values(quoteData.parts) as SparePart[]);
          }
        }
        
        // Aggiorna lo stato con i ricambi trovati
        setSpareParts(partsFromQuote);
        console.log(`Ricambi trovati nel preventivo: ${partsFromQuote.length}`);
      } else {
        console.log(`Preventivo ${quoteId} non trovato`);
      }
    } catch (error) {
      console.error('Errore nel recupero dei ricambi dal preventivo:', error);
    }
  };

  const handleSparePartPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
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
        aggiungiNuovaFoto(imgUrl);
      } else {
        throw new Error('Errore nel caricamento della foto');
      }
    } catch (error) {
      console.error('Errore durante il caricamento della foto:', error);
      alert('Errore durante il caricamento della foto. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const aggiungiNuovaFoto = async (imgUrl: string) => {
    if (!imgUrl) return;
    
    try {
      setIsLoading(true);
      const updatedPhotos = [...sparePartPhotos, imgUrl];
      setSparePartPhotos(updatedPhotos);
      
      // Salviamo le foto nell'appuntamento se disponibile
      if (appointmentId) {
        const appointmentRef = ref(rtdb, `appointments/${appointmentId}`);
        const snapshot = await get(appointmentRef);
        let appointmentData = {};
        
        if (snapshot.exists()) {
          appointmentData = snapshot.val();
        }
        
        // Aggiorniamo le foto nell'appuntamento
        await update(appointmentRef, {
          ...appointmentData,
          sparePartPhotos: updatedPhotos,
          sparePartPhoto: updatedPhotos[0]
        });
        
        console.log(`Foto salvate nell'appuntamento ${appointmentId}`);
      }
      
      // Salviamo anche nel percorso del veicolo per retrocompatibilità
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      let vehicleData = {};
      
      if (snapshot.exists()) {
        vehicleData = snapshot.val();
      }
      
      // Aggiorniamo solo la proprietà sparePartPhotos
      await update(vehicleRef, {
        ...vehicleData,
        sparePartPhotos: updatedPhotos,
        sparePartPhoto: updatedPhotos[0] // Manteniamo compatibilità con il formato esistente
      });
    } catch (error) {
      console.error('Errore durante il salvataggio della foto:', error);
      alert('Errore durante il salvataggio della foto. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRimuoviFoto = async (index: number) => {
    try {
      setIsLoading(true);
      const updatedPhotos = [...sparePartPhotos];
      updatedPhotos.splice(index, 1);
      setSparePartPhotos(updatedPhotos);
      
      // Aggiorniamo nell'appuntamento se disponibile
      if (appointmentId) {
        const appointmentRef = ref(rtdb, `appointments/${appointmentId}`);
        const snapshot = await get(appointmentRef);
        let appointmentData = {};
        
        if (snapshot.exists()) {
          appointmentData = snapshot.val();
        }
        
        // Aggiorniamo le foto nell'appuntamento
        await update(appointmentRef, {
          ...appointmentData,
          sparePartPhotos: updatedPhotos,
          sparePartPhoto: updatedPhotos.length > 0 ? updatedPhotos[0] : null
        });
        
        console.log(`Foto rimosse dall'appuntamento ${appointmentId}`);
      }
      
      // Aggiorniamo anche nel percorso del veicolo per retrocompatibilità
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      let vehicleData = {};
      
      if (snapshot.exists()) {
        vehicleData = snapshot.val();
      }
      
      // Aggiorniamo solo la proprietà sparePartPhotos
      await update(vehicleRef, {
        ...vehicleData,
        sparePartPhotos: updatedPhotos,
        sparePartPhoto: updatedPhotos.length > 0 ? updatedPhotos[0] : null // Manteniamo compatibilità con il formato esistente
      });
    } catch (error) {
      console.error('Errore durante la rimozione della foto:', error);
      alert('Errore durante la rimozione della foto. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);

      // Salviamo i dati di completamento, compresi i ricambi
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      let existingData = {};
      
      if (snapshot.exists()) {
        existingData = snapshot.val();
      }
      
      // Prepariamo i dati aggiornati
      const updatedData = {
        ...existingData,
        workCompleted: true,
        workCompletionDate: new Date().toISOString(),
        sparePartPhotos: sparePartPhotos,
        sparePartPhoto: sparePartPhotos.length > 0 ? sparePartPhotos[0] : null,
        workSpareParts: spareParts, // Salviamo anche i ricambi usati
        workPhase: {
          ...(existingData as any).workPhase || {},
          completed: true,
          completionDate: new Date().toISOString(),
          spareParts: spareParts,
          photos: sparePartPhotos,
          quoteId: quoteId // Salviamo esplicitamente l'ID del preventivo usato
        },
        // Salviamo il preventivo anche nel percorso principale per garantire coerenza
        quoteId: quoteId
      };
      
      // Aggiorniamo i dati del veicolo
      await update(vehicleRef, updatedData);
      
      // Se abbiamo un ID appuntamento, aggiorniamo anche l'appuntamento
      if (appointmentId) {
        const appointmentRef = ref(rtdb, `appointments/${appointmentId}`);
        const appSnapshot = await get(appointmentRef);
        let appointmentData = {};
        
        if (appSnapshot.exists()) {
          appointmentData = appSnapshot.val();
        }
        
        // Aggiorniamo l'appuntamento, incluso il preventivo utilizzato
        await update(appointmentRef, {
          ...appointmentData,
          status: "completato",
          workCompleted: true,
          completedAt: new Date().toISOString(),
          sparePartPhotos: sparePartPhotos,
          sparePartPhoto: sparePartPhotos.length > 0 ? sparePartPhotos[0] : null,
          completedBy: "web-app",
          spareParts: spareParts,
          quoteId: quoteId,// Salviamo l'ID del preventivo usato anche nell'appuntamento
        });
        
        console.log(`Appuntamento ${appointmentId} aggiornato con il preventivo ${quoteId || 'non specificato'}`);
      }
      
      // Tutto è andato a buon fine, richiamiamo la callback di completamento
      onComplete();
    } catch (error) {
      console.error("Errore nel salvataggio dei dati:", error);
      alert("Errore nel salvataggio delle informazioni. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold">Fase di Lavorazione</h2>
        <button
          onClick={handleSubmit}
          className="bg-orange-500 text-white px-4 py-2 rounded font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Salvataggio..." : "Conferma Lavorazione"}
        </button>
      </div>
      
      {/* Sezione foto ricambi in layout orizzontale */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Foto Ricambi Sostituiti</h3>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Pannello di caricamento */}
          <div className="border border-border rounded p-2 bg-background sm:w-1/3">
            <label className="flex items-center gap-1 cursor-pointer bg-orange-500 text-white px-3 py-1.5 rounded text-sm font-medium w-full justify-center">
              <Upload size={16} />
              <span>Scegli file</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleSparePartPhotoUpload}
                className="hidden"
                disabled={isLoading}
              />
            </label>
            <div className="text-center text-xs text-muted-foreground mt-1">
              {isLoading ? "Caricamento..." : "Foto: " + sparePartPhotos.length}
            </div>
          </div>
          
          {/* Lista foto caricate */}
          <div className="border border-border rounded overflow-hidden sm:flex-1">
            {sparePartPhotos.length > 0 ? (
              <div className="max-h-[120px] overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {sparePartPhotos.map((photo, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="p-1.5 pl-3">Foto ricambio {index + 1}</td>
                        <td className="p-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreviewPhoto(photo)}
                              className="p-1 hover:bg-muted rounded-full"
                              title="Visualizza"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleRimuoviFoto(index)}
                              className="p-1 hover:bg-muted rounded-full text-red-500"
                              title="Rimuovi"
                              disabled={isLoading}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 text-sm text-muted-foreground text-center">
                Nessuna foto caricata
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Popup anteprima foto */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-3xl max-h-[80vh]">
            <img src={previewPhoto} alt="Anteprima ricambio" className="max-w-full max-h-[80vh]" />
            <button 
              className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70"
              onClick={() => setPreviewPhoto(null)}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      
      {/* Scheda ispezione veicolo */}
      <SchedaIspezioneVeicolo 
        vehicleId={vehicleId} 
        appointmentId={appointmentId}
      />
    </div>
  );
};

export default WorkPhase; 