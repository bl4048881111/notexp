import React, { useState, useEffect } from 'react';
import { Camera, Upload, CheckCircle, ArrowLeft, ArrowRight, FileText, AlertCircle } from 'lucide-react';
import { 
  getWorkSessionByAppointmentId, 
  createWorkSession, 
  updateWorkSession,
  getChecklistItemsByAppointmentId,
  createChecklistItemsFromTemplate,
  updateChecklistItem
} from '../shared/supabase';
import { exportWorkSessionToPDF } from '../client/src/services/exportService';
import { WorkSession, ChecklistItem } from '../shared/schema';

interface WorkPhaseProps {
  appointmentId: string;
  vehicleId: string;
  onComplete: () => void;
  onBack: () => void;
}

// Funzione per ordinare le categorie secondo la priorità desiderata
const getCategoryOrder = (category: string): number => {
  const orderMap: { [key: string]: number } = {
    'CONTROLLO MOTORE': 1,
    'STERZO AUTO': 2,
    'ILLUMINAZIONE': 3,
    'CLIMATIZZAZIONE': 4,
    'IMPIANTO FRENANTE': 5,
    'SOSPENSIONE ANTERIORE': 6,
    'SOSPENSIONE POSTERIORE': 7,
    'TRASMISSIONE ANT/POST': 8,
    'IMPIANTO DI SCARICO': 9,
    'PNEUMATICI': 10,
    'IMPIANTO ELETTRICO': 11,
    'ALTRO': 12,
  };
  
  return orderMap[category] || 999; // Le categorie non mappate vanno alla fine
};

const WorkPhase: React.FC<WorkPhaseProps> = ({ appointmentId, vehicleId, onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [workSession, setWorkSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stato per Schermata 1 - Dati veicolo
  const [acceptancePhotos, setAcceptancePhotos] = useState<string[]>([]);
  const [fuelLevel, setFuelLevel] = useState('');
  const [mileage, setMileage] = useState('');
  
  // Stato per Schermata 2 - Foto ricambi e checklist
  const [sparePartsPhotos, setSparePartsPhotos] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  useEffect(() => {
    loadWorkSession();
    loadChecklist();
  }, [appointmentId]);

  const loadWorkSession = async () => {
    try {
      setLoading(true);
      console.log(`🔍 Caricamento WorkSession per appointmentId ATTUALE: ${appointmentId}`);
      
      // CORREZIONE: Usa SOLO appointmentId, non vehicleId come fallback
      const session = await getWorkSessionByAppointmentId(appointmentId);
      console.log(`📋 Sessione trovata per appointmentId ${appointmentId}:`, session);
      
      // CORREZIONE CRITICA: Se la sessione è completata, SEMPRE crea una nuova
      if (session && session.completed) {
        console.log(`🚫 Sessione COMPLETATA trovata per appointmentId ${appointmentId}, creo NUOVA sessione`);
        // Non utilizzare MAI una sessione completata, anche se è per lo stesso appointmentId
        const newSession = await createWorkSession({
          appointmentId: appointmentId, // NUOVO appointmentId
          vehicleId,
          acceptancePhotos: [], // SEMPRE foto vuote per nuovo appuntamento
          sparePartsPhotos: [], // SEMPRE foto vuote per nuovo appuntamento
          currentStep: 2, // Inizia dalla fase 2 (lavorazione)
          completed: false,
          fuelLevel: '', // Dati puliti
          mileage: '' // Dati puliti
        });
        
        setWorkSession(newSession);
        setCurrentStep(2);
        setAcceptancePhotos([]);
        setFuelLevel('');
        setMileage('');
        setSparePartsPhotos([]);
        console.log(`✅ NUOVA sessione creata per NUOVO appointmentId ${appointmentId}:`, newSession.id);
        
      } else if (session && session.appointmentId === appointmentId && !session.completed) {
        // Solo se la sessione è ESATTAMENTE per questo appointmentId E non è completata
        setWorkSession(session);
        setCurrentStep(session.currentStep);
        setAcceptancePhotos(session.acceptancePhotos || []);
        setFuelLevel(session.fuelLevel || '');
        setMileage(session.mileage || '');
        setSparePartsPhotos(session.sparePartsPhotos || []);
        console.log(`📋 Riutilizzo sessione NON completata per appointmentId ${appointmentId}:`, session.id);
        
      } else {
        // Nessuna sessione trovata o sessione per appointmentId diverso
        console.log(`🔄 Creazione NUOVA sessione per appointmentId: ${appointmentId} (nessuna sessione valida trovata)`);
        
        const newSession = await createWorkSession({
          appointmentId: appointmentId, // PARAMETRO PRINCIPALE
          vehicleId, // Manteniamo per compatibilità ma non lo usiamo per la logica di controllo
          acceptancePhotos: [], // SEMPRE foto vuote per nuovo appuntamento
          sparePartsPhotos: [], // SEMPRE foto vuote per nuovo appuntamento
          currentStep: 2, // Inizia dalla fase 2 (lavorazione)
          completed: false,
          fuelLevel: '', // Dati puliti
          mileage: '' // Dati puliti
        });
        
        setWorkSession(newSession);
        setCurrentStep(2);
        setAcceptancePhotos([]); // GARANTISCE foto di accettazione vuote
        setFuelLevel('');
        setMileage('');
        setSparePartsPhotos([]); // GARANTISCE foto ricambi vuote
        console.log(`✅ Nuova sessione creata SOLO per appointmentId ${appointmentId}:`, newSession.id);
      }
    } catch (error) {
      console.error('Errore nel caricamento della sessione:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChecklist = async () => {
    try {
      setChecklistLoading(true);
      console.log(`🔍 Caricamento checklist per appointmentId: ${appointmentId}`);
      
      // Prova a caricare la checklist esistente per QUESTO SPECIFICO appuntamento
      let checklistItems = await getChecklistItemsByAppointmentId(appointmentId);
      
      // Filtra per assicurarsi che sia davvero per questo appuntamento
      checklistItems = checklistItems.filter(item => item.appointmentId === appointmentId);
      
      if (checklistItems.length === 0) {
        console.log(`📋 Nessuna checklist trovata per appointmentId ${appointmentId}, creazione da template...`);
        checklistItems = await createChecklistItemsFromTemplate(appointmentId, vehicleId, true); // Forza sempre nuova checklist
      } else {
        // Controlla se tutti gli elementi sono stati controllati (status != 'non_controllato')
        const activeItems = checklistItems.filter(item => item.status === 'non_controllato');
        if (activeItems.length === 0) {
          console.log(`📋 Tutti gli elementi checklist sono stati controllati per appointmentId ${appointmentId}, creazione nuova checklist...`);
          checklistItems = await createChecklistItemsFromTemplate(appointmentId, vehicleId, true); // forceNew = true
        } else {
          console.log(`📋 Checklist attiva trovata per appointmentId ${appointmentId} con ${activeItems.length} elementi non controllati`);
        }
      }
      
      setChecklist(checklistItems);
      console.log(`📋 Checklist caricata per appointmentId ${appointmentId}: ${checklistItems.length} elementi`);
      
    } catch (error) {
      console.error('Errore nel caricamento della checklist:', error);
      // Fallback alla checklist di esempio in caso di errore
      setChecklist([
        { id: '1', itemName: 'Olio motore', itemCategory: 'Motore', status: 'non_controllato', appointmentId, vehicleId },
        { id: '2', itemName: 'Filtro aria', itemCategory: 'Motore', status: 'non_controllato', appointmentId, vehicleId },
        { id: '3', itemName: 'Pastiglie freni', itemCategory: 'Freni', status: 'non_controllato', appointmentId, vehicleId },
      ] as ChecklistItem[]);
    } finally {
      setChecklistLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!workSession) return;
    
    try {
      await updateWorkSession(workSession.id, {
        acceptancePhotos,
        fuelLevel,
        mileage,
        sparePartsPhotos,
        currentStep
      });
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
    }
  };

  const handlePhotoUpload = (file: File, type: 'acceptance' | 'spare_parts') => {
    // Simula upload foto - da implementare con storage reale
    const photoUrl = URL.createObjectURL(file);
    
    if (type === 'acceptance') {
      setAcceptancePhotos(prev => [...prev, photoUrl]);
    } else {
      setSparePartsPhotos(prev => [...prev, photoUrl]);
    }
  };

  const updateChecklistItemLocal = async (id: string, updates: Partial<ChecklistItem>) => {
    try {
      // Aggiorna nel database
      await updateChecklistItem(id, updates);
      
      // Aggiorna lo stato locale
      setChecklist(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ));
    } catch (error) {
      console.error('Errore nell\'aggiornamento checklist:', error);
    }
  };

  const nextStep = async () => {
    await saveProgress();
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = async () => {
    await saveProgress();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeWork = async () => {
    if (!workSession) return;
    
    try {
      await updateWorkSession(workSession.id, {
        acceptancePhotos,
        fuelLevel,
        mileage,
        sparePartsPhotos,
        currentStep: 3,
        completed: true,
        completedAt: new Date().toISOString()
      });
      onComplete();
    } catch (error) {
      console.error('Errore nel completamento:', error);
    }
  };

  const handleGeneratePDF = async () => {
    if (!workSession) {
      console.error('Nessuna sessione di lavoro disponibile');
      return;
    }
    
    try {
      console.log('🔄 Generazione PDF sessione di lavoro:', workSession.id);
      
      // CORREZIONE BUG #4: Utilizzo della stessa funzione PDF di StoricoLavoriPage
      // Recupera la checklist per l'appuntamento
      let checklistItems: ChecklistItem[] = [];
      try {
        if (appointmentId) {
          checklistItems = await getChecklistItemsByAppointmentId(appointmentId);
          console.log('📋 Checklist trovata per PDF:', checklistItems.length, 'elementi');
        }
      } catch (checklistError) {
        console.warn('⚠️ Checklist non disponibile per PDF:', checklistError);
        // Usa checklist di fallback
        checklistItems = checklist || [];
      }
      
      // Usa la stessa funzione di esportazione utilizzata in StoricoLavoriPage
      console.log('[DEBUG PDF] workSession che passo:', workSession);
      await exportWorkSessionToPDF(workSession, vehicleId, checklistItems);
      console.log('✅ PDF generato con successo utilizzando la funzione di StoricoLavoriPage');
    } catch (error) {
      console.error('❌ Errore nella generazione del PDF:', error);
      alert('Errore nella generazione del PDF. Riprova.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {step}
          </div>
          {step < 3 && (
            <div className={`w-16 h-1 mx-2 ${
              step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Schermata 1: Dati Veicolo e Foto Accettazione
      </h2>
      
      {/* Foto di accettazione */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Foto di Accettazione (4 foto)</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {acceptancePhotos.map((photo, index) => (
            <div key={index} className="relative">
              <img src={photo} alt={`Accettazione ${index + 1}`} className="w-full h-32 object-cover rounded" />
              <button
                onClick={() => setAcceptancePhotos(prev => prev.filter((_, i) => i !== index))}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
          {acceptancePhotos.length < 4 && (
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
              <Camera className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">Aggiungi foto</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file, 'acceptance');
                }}
              />
            </label>
          )}
        </div>
      </div>

      {/* Dati veicolo */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Dati Veicolo</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Livello Carburante
            </label>
            <select
              value={fuelLevel}
              onChange={(e) => setFuelLevel(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleziona livello</option>
              <option value="vuoto">Vuoto (0-10%)</option>
              <option value="basso">Basso (10-25%)</option>
              <option value="medio">Medio (25-75%)</option>
              <option value="alto">Alto (75-100%)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chilometraggio
            </label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Inserisci km"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    // Raggruppa checklist per categoria
    const checklistByCategory = checklist.reduce((acc, item) => {
      const category = item.itemCategory || 'Generale';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ChecklistItem[]>);

    // Ordina le categorie secondo la priorità desiderata
    const sortedCategories = Object.keys(checklistByCategory).sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Schermata 2: Foto Ricambi e Checklist
        </h2>
        
        {/* Foto ricambi */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Foto Pezzi Ricambiati</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {sparePartsPhotos.map((photo, index) => (
              <div key={index} className="relative">
                <img src={photo} alt={`Ricambio ${index + 1}`} className="w-full h-24 object-cover rounded" />
                <button
                  onClick={() => setSparePartsPhotos(prev => prev.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
              <Camera className="mx-auto h-6 w-6 text-gray-400 mb-1" />
              <span className="text-xs text-gray-600">Aggiungi</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file, 'spare_parts');
                }}
              />
            </label>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Checklist Controlli</h3>
            {checklistLoading && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Caricamento...
              </div>
            )}
          </div>
          
          {Object.keys(checklistByCategory).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="mx-auto h-8 w-8 mb-2" />
              <p>Nessun elemento della checklist trovato</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedCategories.map((category) => (
                <div key={category} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mr-2">
                      {category}
                    </span>
                    <span className="text-sm text-gray-500">({checklistByCategory[category].length} elementi)</span>
                  </h4>
                  <div className="space-y-2">
                    {checklistByCategory[category].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.itemName}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <select
                            value={item.status}
                            onChange={(e) => updateChecklistItemLocal(item.id, { status: e.target.value as any })}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="non_controllato">Non controllato</option>
                            <option value="ok">OK</option>
                            <option value="da_sostituire">Da sostituire</option>
                            <option value="sostituito">Sostituito</option>
                            <option value="attenzione">Attenzione</option>
                          </select>
                          {item.status === 'ok' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {item.status === 'da_sostituire' && <AlertCircle className="h-4 w-4 text-red-500" />}
                          {item.status === 'sostituito' && <CheckCircle className="h-4 w-4 text-blue-500" />}
                          {item.status === 'attenzione' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Schermata 3: Riepilogo e Completamento
      </h2>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Riepilogo Lavorazione</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Dati Veicolo</h4>
            <p className="text-sm text-gray-600">Carburante: {fuelLevel || 'Non specificato'}</p>
            <p className="text-sm text-gray-600">Chilometraggio: {mileage || 'Non specificato'} km</p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Foto</h4>
            <p className="text-sm text-gray-600">Foto accettazione: {acceptancePhotos.length}/4</p>
            <p className="text-sm text-gray-600">Foto ricambi: {sparePartsPhotos.length}</p>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-2">Stato Checklist ({checklist.length} elementi)</h4>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              OK: {checklist.filter(item => item.status === 'ok').length}
            </div>
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
              Da sostituire: {checklist.filter(item => item.status === 'da_sostituire').length}
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-blue-500 mr-1" />
              Sostituito: {checklist.filter(item => item.status === 'sostituito').length}
            </div>
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-yellow-500 mr-1" />
              Attenzione: {checklist.filter(item => item.status === 'attenzione').length}
            </div>
            <div className="flex items-center">
              <div className="h-4 w-4 bg-gray-300 rounded mr-1"></div>
              Non controllato: {checklist.filter(item => item.status === 'non_controllato').length}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-green-50 p-6 rounded-lg border border-green-200">
        <div className="flex items-center">
          <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-green-900">Pronto per il completamento</h3>
            <p className="text-green-700">La fase di lavorazione è completa. Clicca su "Completa Lavorazione" per procedere alla fase di consegna.</p>
          </div>
        </div>
      </div>

      {/* Pulsante PDF */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Genera PDF Lavorazione</h3>
              <p className="text-blue-700">Scarica il report completo con tutti i dati della lavorazione (stesso formato dello storico lavori)</p>
            </div>
          </div>
          <button
            onClick={handleGeneratePDF}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            Genera PDF
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {renderStepIndicator()}
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      
      {/* Pulsanti navigazione */}
      <div className="flex justify-between mt-8">
        <button
          onClick={currentStep === 1 ? onBack : prevStep}
          className="flex items-center px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Indietro' : 'Precedente'}
        </button>
        
        {currentStep < 3 ? (
          <button
            onClick={nextStep}
            disabled={currentStep === 1 && (acceptancePhotos.length < 4 || !fuelLevel || !mileage)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Successivo
            <ArrowRight className="h-4 w-4 ml-2" />
          </button>
        ) : (
          <button
            onClick={completeWork}
            className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Completa Lavorazione
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkPhase; 