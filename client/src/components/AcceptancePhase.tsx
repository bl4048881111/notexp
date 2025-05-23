import React, { useState, useEffect } from "react";
import { ref, set, get, child, update } from "firebase/database";
import { rtdb } from "@/firebase";
import { Eye, X, Upload } from "lucide-react";

interface AcceptancePhaseProps {
  vehicleId: string;
  onComplete: () => void;
  clientName?: string;
}

const AcceptancePhase: React.FC<AcceptancePhaseProps> = ({ vehicleId, onComplete, clientName }) => {
  const [photoUrls, setPhotoUrls] = useState<string[]>(["", "", "", ""]);
  const [mileage, setMileage] = useState<string>("");
  const [fuelLevel, setFuelLevel] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Carica i dati se già esistenti
  useEffect(() => {
    const loadAcceptanceData = async () => {
      try {
        const vehicleRef = ref(rtdb, `vehicles/${vehicleId}/controlli`);
        const snapshot = await get(vehicleRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.mileage) setMileage(data.mileage.toString());
          if (data.fuelLevel) setFuelLevel(data.fuelLevel);
          if (data.photos && Array.isArray(data.photos)) {
            // Assicura che ci siano sempre 4 slot per le foto
            const existingPhotos = [...data.photos];
            while (existingPhotos.length < 4) existingPhotos.push("");
            setPhotoUrls(existingPhotos.slice(0, 4));
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento dei dati di accettazione:', error);
      }
    };

    loadAcceptanceData();
  }, [vehicleId]);

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
        
        // Salvataggio URL in Firebase Realtime Database
        const vehicleRef = ref(rtdb, `vehicles/${vehicleId}/controlli`);
        const snapshot = await get(vehicleRef);
        let controlliData = {};
        
        if (snapshot.exists()) {
          controlliData = snapshot.val();
        }
        
        // Aggiorniamo il nodo controlli
        await update(vehicleRef, {
          ...controlliData,
          photos: newPhotoUrls
        });
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
      // Riferimento al nodo 'controlli' del veicolo
      const controlliRef = ref(rtdb, `vehicles/${vehicleId}/controlli`);
      
      // Leggiamo prima i dati esistenti
      const snapshot = await get(controlliRef);
      let controlliData = {};
      
      if (snapshot.exists()) {
        controlliData = snapshot.val();
      }
      
      // Aggiorniamo solo il nodo 'controlli'
      await update(controlliRef, {
        ...controlliData,
        mileage: mileage,
        fuelLevel,
        photos: photoUrls.filter(url => url.trim() !== ''),
        acceptanceDate: new Date().toISOString(),
        acceptanceCompleted: true,
      });
      
      // Aggiorniamo anche mileage e fuelLevel nel nodo principale del veicolo
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      await update(vehicleRef, {
        mileage: mileage,
        fuelLevel
      });
      
      onComplete();
    } catch (error) {
      console.error('Errore durante il salvataggio dei dati:', error);
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

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <h2 className="text-2xl font-bold mb-4">Fase di Accettazione</h2>
      
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photoUrls.map((url, index) => (
            <div key={index} className="border border-border rounded p-3 bg-card">
              <label className="block mb-2 font-semibold">{photoLabels[index]}</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e, index)}
                className="block w-full text-sm text-foreground bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                disabled={isLoading}
              />
              {url && (
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Foto caricata</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewPhoto(url)}
                      className="p-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      title="Visualizza anteprima"
                      type="button"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        const newPhotoUrls = [...photoUrls];
                        newPhotoUrls[index] = "";
                        setPhotoUrls(newPhotoUrls);
                      }}
                      className="p-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
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