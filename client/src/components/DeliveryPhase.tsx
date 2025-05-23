import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ref,
  get,
  update,
  query as rtdbQuery,
  orderByChild,
  equalTo,
} from "firebase/database";
import { rtdb, getVehicleSpareParts, storage } from "@/firebase";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import toast from "react-hot-toast";
import { updateAppointment } from "@shared/firebase";
import {
  ref as storageRef,
  getDownloadURL,
  listAll,
  getBlob,
} from "firebase/storage";
import "jspdf-autotable";

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
  acceptanceDate?: any; // Firebase timestamp
  sparePartPhotos?: string[];
  sparePartPhoto?: string; // Campo duplicato
  controlliServizio?: Array<{
    nome: string;
    stato: string;
    note: string;
  }>;
  checklist?: any;
  workCompletionDate?: any; // Firebase timestamp
  workCompleted?: boolean; // Possibile campo duplicato
  commenti?: string; // Aggiungo la proprietà commenti per le note generali
}

// Definisco interfaccia per gli elementi di ricambio
interface SparePart {
  code?: string;
  name?: string;
  description?: string;
  price?: number;
  finalPrice?: number; // Aggiungiamo il campo finalPrice all'interfaccia
  quantity?: number;
  type?: string;
  photo?: string;
}

// Definisco interfaccia per i dati del preventivo
interface QuoteData {
  id?: string;
  items?: Array<SparePart | { parts?: SparePart[] }>;
  parts?: Array<SparePart>;
  clientName?: string;
  clientPhone?: string;
  phone?: string; // Aggiungo il campo phone come alternativa a clientPhone
  [key: string]: any; // Permette campi aggiuntivi come 'ricambi', 'componenti', ecc.
}

// Cambio radicalmente la struttura della mappa e implemento una versione completamente diversa
// Definisco una mappa direttamente all'inizio del file con tutti i componenti possibili
const CHECKLIST_COMPONENTS: { [key: string]: string } = {
  "12": "Livello olio motore",
  "13": "Livello refrigerante",
  "14": "Olio motore",
  "15": "Filtro olio",
  "16": "Filtro aria",
  "17": "Cinghia servizi",
  "18": "Cinghia distribuzione",
  "19": "Pastiglie freni",
  "20": "Dischi freni",
  "21": "Ammortizzatori",
  "22": "Freni",
  "23": "Sterzo",
  "24": "Sospensione",
  "25": "Pneumatici",
  "26": "Batteria",
  "27": "Luci",
  "28": "Tergicristalli",
  "29": "Climatizzatore",
  "30": "Sistema di scarico",
  "31": "Cintura di sicurezza",
  "32": "Carburatore",
  "33": "Sistema di accensione",
  "34": "Sistema di raffreddamento",
  "35": "Radiatore",
  "36": "Alternatore",
  "37": "Motorino d'avviamento",
  "38": "Impianto elettrico",
  "39": "Candele",
  "40": "Iniettori",
  livelloOlioFreni: "Livello olio freni",
  livelloOlioMotore: "Livello olio motore",
  livelloRefrigerante: "Livello refrigerante",
  mollaElicoidaleAntDx: "Molla elicoidale ant. dx",
  mollaElicoidaleAntSx: "Molla elicoidale ant. sx",
  olioMotore: "Olio motore",
  paraPolvere: "Para polvere",
  pastiglieAntDx: "Pastiglie ant. dx",
  pastiglieAntSx: "Pastiglie ant. sx",
  pastigliePostDx: "Pastiglie post. dx",
  pastigliePostSx: "Pastiglie post. sx",
  provaSuStrada: "Prova su strada",
  sistemaVacuum: "Sistema vacuum",
  testinaDx: "Testina dx",
  testinaSx: "Testina sx",
  tiranteAmmSospDx: "Tirante amm. sosp. dx",
  tiranteAmmSospSx: "Tirante amm. sosp. sx",
};

// Funzione per recuperare tutti i parametri della checklist, inclusi quelli personalizzati
const loadChecklistParameters = async () => {
  console.log(
    "Caricamento di tutti i parametri della checklist, inclusi quelli personalizzati...",
  );

  try {
    // Carica i parametri personalizzati dal database
    const parametersRef = ref(rtdb, "parameters");
    const parametersSnapshot = await get(parametersRef);

    if (!parametersSnapshot.exists()) {
      console.log("Nessun parametro personalizzato trovato nel database.");
      return null;
    }

    const parametersData = parametersSnapshot.val();

    // Creazione di una struttura per le sezioni
    const sections: Record<string, any[]> = {
      Motore: [],
      "Sistema Sterzo": [],
      "Sistema Freni": [],
      "Sospensione Anteriore": [],
      Pneumatici: [],
    };

    // Aggiungiamo i parametri personalizzati alle rispettive sezioni
    for (const [parameterId, paramData] of Object.entries(parametersData)) {
      if (typeof paramData === "object" && paramData !== null) {
        const param = paramData as any;
        const sectionName = param.section || "Altro";

        // Se la sezione non esiste, la creiamo
        if (!sections[sectionName]) {
          sections[sectionName] = [];
        }

        // Aggiungiamo il parametro alla sezione
        sections[sectionName].push({
          id: parameterId,
          name: param.name || parameterId,
          defaultState: param.defaultState || "NON CONTROLLATO",
        });
      }
    }

    console.log("Parametri caricati e organizzati per sezioni:", sections);
    return sections;
  } catch (error) {
    console.error(
      "Errore nel caricamento dei parametri personalizzati:",
      error,
    );
    return null;
  }
};

const DeliveryPhase: React.FC<DeliveryPhaseProps> = ({
  vehicleId,
  customerPhone,
  onComplete,
}) => {
  // Riferimento per il link di download
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  // Stati esistenti
  const [isLoading, setIsLoading] = useState(false);
  const [clienteNotificato, setClienteNotificato] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData>({});
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);

  // Rimuovo useSearchParams e ottengo i parametri dell'URL direttamente
  const getURLParameters = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      get: (name: string) => params.get(name),
    };
  };

  // Funzione per ottenere l'appuntamento associato a una targa
  const getAppointmentByPlate = async (plate: string) => {
    try {
      // Prima proviamo con l'indice, ma gestiamo l'errore di indice mancante
      try {
        // Utilizza Realtime Database per cercare l'appuntamento per targa
        const appointmentsRef = ref(rtdb, "appointments");
        const plateQuery = rtdbQuery(
          appointmentsRef,
          orderByChild("plate"),
          equalTo(plate),
        );
        const snapshot = await get(plateQuery);

        if (snapshot.exists()) {
          // Ottiene i dati dal snapshot
          const appointments = snapshot.val();
          // Prende il primo appuntamento trovato
          const appId = Object.keys(appointments)[0];
          return {
            id: appId,
            ...appointments[appId],
          };
        }
      } catch (indexError) {
        console.warn(
          "Errore di indice nel database, eseguo ricerca manuale:",
          indexError,
        );

        // Fallback: carica tutti gli appuntamenti e filtra manualmente
        const appointmentsRef = ref(rtdb, "appointments");
        const snapshot = await get(appointmentsRef);

        if (snapshot.exists()) {
          const appointments = snapshot.val();
          // Cerca manualmente l'appuntamento con la targa corrispondente
          for (const appId in appointments) {
            if (appointments[appId].plate === plate) {
              return {
                id: appId,
                ...appointments[appId],
              };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Errore nel recupero dell'appuntamento:", error);
      toast.error(
        "Errore nel caricamento dell'appuntamento. Verifica le regole del database.",
      );
      return null;
    }
  };

  // Funzione per recuperare i ricambi da un preventivo
  const fetchSparePartData = async (
    appointmentId: string,
    quoteId?: string,
  ) => {
    try {
      console.log(
        `Recupero ricambi per appuntamento ${appointmentId}, preventivo ${quoteId || "da cercare"}`,
      );

      // Controlliamo direttamente il veicolo per ricambi in workSpareParts
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const vehicleSnap = await get(vehicleRef);

      if (vehicleSnap.exists()) {
        const vehicleData = vehicleSnap.val();
        console.log("Dati veicolo per ricambi:", vehicleData);

        // ESTRAZIONE DIRETTA - Verifichiamo se abbiamo workSpareParts[0] come visto nei log
        if (vehicleData.workSpareParts && vehicleData.workSpareParts[0]) {
          console.log(
            "Ricambio trovato in workSpareParts[0]:",
            vehicleData.workSpareParts[0],
          );

          // Creiamo l'oggetto ricambio dalla struttura esatta
          const ricambioATE = {
            brand: vehicleData.workSpareParts[0].brand || "",
            category: vehicleData.workSpareParts[0].category || "",
            code: vehicleData.workSpareParts[0].code || "",
            finalPrice: vehicleData.workSpareParts[0].finalPrice || 0,
            id: vehicleData.workSpareParts[0].id || "",
            name: vehicleData.workSpareParts[0].name || "",
            quantity: vehicleData.workSpareParts[0].quantity || 1,
            unitPrice: vehicleData.workSpareParts[0].unitPrice || 0,
          };

          console.log("Ricambio ATE estratto:", ricambioATE);
          setSpareParts([ricambioATE]);
          return;
        }

        console.log(
          "Nessun ricambio trovato in workSpareParts[0], cerchiamo in altre posizioni...",
        );

        // Se non troviamo in workSpareParts[0], controlliamo altre posizioni
        let preventivoDaUsare = quoteId;

        // Priorità 1: Preventivo specificato esplicitamente dalla fase di lavorazione
        if (
          !preventivoDaUsare &&
          vehicleData.workPhase &&
          vehicleData.workPhase.quoteId
        ) {
          preventivoDaUsare = vehicleData.workPhase.quoteId;
          console.log(
            `Trovato ID preventivo nel workPhase del veicolo: ${preventivoDaUsare}`,
          );
        }

        // Priorità 2: Preventivo salvato direttamente nel veicolo
        if (!preventivoDaUsare && vehicleData.quoteId) {
          preventivoDaUsare = vehicleData.quoteId;
          console.log(
            `Trovato ID preventivo nel nodo principale del veicolo: ${preventivoDaUsare}`,
          );
        }

        // Se abbiamo un ID preventivo, proviamo a recuperare i ricambi da lì
        if (preventivoDaUsare) {
          console.log(
            `Provando a recuperare ricambi dal preventivo: ${preventivoDaUsare}`,
          );
          const quoteRef = ref(rtdb, `quotes/${preventivoDaUsare}`);
          const quoteSnapshot = await get(quoteRef);

          if (quoteSnapshot.exists()) {
            const quoteData = quoteSnapshot.val();
            console.log(`Preventivo ${preventivoDaUsare} trovato:`, quoteData);

            // Estrai i ricambi dal preventivo
            const partsFromQuote: SparePart[] = [];

            // Estrai i ricambi da varie posizioni possibili nel preventivo
            if (quoteData.items && Array.isArray(quoteData.items)) {
              quoteData.items.forEach((item: any) => {
                if (
                  "parts" in item &&
                  item.parts &&
                  Array.isArray(item.parts)
                ) {
                  partsFromQuote.push(...item.parts);
                }
              });
            }

            if (partsFromQuote.length > 0) {
              console.log(
                `Ricambi trovati nel preventivo: ${partsFromQuote.length}`,
                partsFromQuote,
              );
              setSpareParts(partsFromQuote);
              return;
            }

            console.log("Nessun ricambio trovato nel preventivo");
          }
        }
      }

      console.log("Nessun ricambio trovato in nessuna posizione");
      // Non impostiamo nessun ricambio di fallback, lasciamo l'array vuoto
      setSpareParts([]);
    } catch (error) {
      console.error("Errore nel recupero dei ricambi:", error);
      toast.error("Errore nel recupero dei ricambi");
    }
  };

  // Ora cerca ricambi anche nel veicolo se non ne ha trovati dall'appuntamento
  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        setIsLoading(true);

        // Cerca l'appuntamento associato a questa targa
        const appointment = await getAppointmentByPlate(vehicleId);
        if (appointment) {
          setAppointmentId(appointment.id);

          // Prima di tutto verifichiamo se ci sono ricambi salvati direttamente nel veicolo dalla fase di lavorazione
          const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
          const vehicleSnapshot = await get(vehicleRef);

          if (vehicleSnapshot.exists()) {
            const vehicleData = vehicleSnapshot.val();

            // Recuperiamo direttamente le foto dal database
            // Verifica se esistono foto in controlli.photos (come mostrato nel database)
            const acceptancePhotos = vehicleData.controlli?.photos || [];

            // Per le foto dei ricambi, controlliamo sia sparePartPhotos che sparePartPhoto
            const sparePartPhotos = vehicleData.sparePartPhotos || [];
            // Aggiungi il singolo sparePartPhoto all'array se esiste
            if (
              vehicleData.sparePartPhoto &&
              !sparePartPhotos.includes(vehicleData.sparePartPhoto)
            ) {
              sparePartPhotos.push(vehicleData.sparePartPhoto);
            }

            console.log("Foto di accettazione trovate:", acceptancePhotos);
            console.log("Foto ricambi trovate:", sparePartPhotos);

            // Controllo dettagliato per la checklist
            console.log("Dati veicolo completi:", vehicleData);

            // Cerchiamo la checklist in varie posizioni nel veicolo (con priorità per lavorazione.checklist)
            let vehicleChecklist = null;

            // 1. Verifico se esiste in lavorazione -> checklist
            if (vehicleData.lavorazione && vehicleData.lavorazione.checklist) {
              console.log(
                "Checklist trovata in lavorazione.checklist:",
                vehicleData.lavorazione.checklist,
              );
              vehicleChecklist = vehicleData.lavorazione.checklist;
            }
            // 2. Verifico se esiste nella root
            else if (vehicleData.checklist) {
              console.log(
                "Checklist trovata nella root del veicolo:",
                vehicleData.checklist,
              );
              vehicleChecklist = vehicleData.checklist;
            }
            // 3. Verifico se esiste in checklistLavorazione
            else if (vehicleData.checklistLavorazione) {
              console.log(
                "Checklist trovata in checklistLavorazione:",
                vehicleData.checklistLavorazione,
              );
              vehicleChecklist = vehicleData.checklistLavorazione;
            }
            // 4. Verifico se esiste in fase2
            else if (vehicleData.fase2 && vehicleData.fase2.checklist) {
              console.log(
                "Checklist trovata in fase2:",
                vehicleData.fase2.checklist,
              );
              vehicleChecklist = vehicleData.fase2.checklist;
            }

            // Normalizza i dati per risolvere la ridondanza
            const normalizedData: VehicleData = {
              // Recupera i dati da controlli se presenti
              mileage: vehicleData.controlli?.mileage || vehicleData.mileage,
              fuelLevel:
                vehicleData.controlli?.fuelLevel || vehicleData.fuelLevel,
              acceptanceDate:
                vehicleData.controlli?.acceptanceDate ||
                vehicleData.acceptanceDate,

              // Usa direttamente le foto dalla sezione controlli
              acceptancePhotos: acceptancePhotos,
              sparePartPhotos: sparePartPhotos,

              // Elementi rimanenti
              controlliServizio: vehicleData.controlliServizio,
              // Aggiungo supporto esplicito per la checklist trovata
              checklist: vehicleChecklist,
              workCompletionDate: vehicleData.workCompletionDate,

              // Aggiungo commenti e note generali se presenti
              commenti:
                vehicleData.commenti ||
                vehicleData.note ||
                vehicleData.noteGenerali ||
                vehicleData.deliveryNotes,
            };

            console.log("Dati normalizzati per il componente:", normalizedData);

            // Imposta il flag cliente notificato se presente
            if (vehicleData.clienteNotificato) {
              setClienteNotificato(true);
            }

            setVehicleData(normalizedData);

            // Se non abbiamo trovato una checklist, cerchiamo esplicitamente in percorsi alternativi
            if (!vehicleChecklist) {
              console.log(
                "Nessuna checklist trovata nei dati primari, cerco in percorsi alternativi...",
              );
              // Definiamo la funzione all'interno per evitare problemi di scope
              const fetchChecklistLavorazioneAlternative = async () => {
                try {
                  console.log(
                    "Cerco dati checklist alternativi per il veicolo:",
                    vehicleId,
                  );

                  // Prova il percorso principale della fase 2
                  const workingPhaseRef = ref(
                    rtdb,
                    `vehicles/${vehicleId}/lavorazione`,
                  );
                  const workingPhaseSnap = await get(workingPhaseRef);

                  if (workingPhaseSnap.exists()) {
                    const data = workingPhaseSnap.val();
                    console.log("Dati trovati in lavorazione:", data);

                    // Aggiorna i dati del veicolo con la checklist di lavorazione
                    setVehicleData((prevData) => {
                      if (!prevData) return prevData;

                      return {
                        ...prevData,
                        checklist:
                          data.checklist ||
                          data.checklistLavorazione ||
                          data.checks ||
                          data.items ||
                          data,
                      };
                    });
                  } else {
                    // Prova percorsi alternativi
                    const paths = [
                      `vehicles/${vehicleId}/workingPhase`,
                      `vehicles/${vehicleId}/fase2`,
                      `workingPhase/${vehicleId}`,
                      `lavorazione/${vehicleId}`,
                    ];

                    for (const path of paths) {
                      console.log(`Cerco in percorso alternativo: ${path}`);
                      const altRef = ref(rtdb, path);
                      const altSnap = await get(altRef);

                      if (altSnap.exists()) {
                        const data = altSnap.val();
                        console.log(`Dati trovati in ${path}:`, data);

                        // Aggiorna i dati del veicolo con la checklist trovata
                        setVehicleData((prevData) => {
                          if (!prevData) return prevData;

                          return {
                            ...prevData,
                            checklist:
                              data.checklist ||
                              data.checklistLavorazione ||
                              data.checks ||
                              data.items ||
                              data,
                          };
                        });

                        break;
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    "Errore nel recupero della checklist di lavorazione:",
                    error,
                  );
                }
              };

              // Chiamiamo la funzione definita localmente
              fetchChecklistLavorazioneAlternative();
            }

            // Ora tentiamo di recuperare i ricambi dopo aver impostato i dati del veicolo
            if (appointment.id) {
              // Passa eventuali preventivi trovati nei dati del veicolo
              let quoteIdToUse = vehicleData.quoteId;
              if (vehicleData.workPhase && vehicleData.workPhase.quoteId) {
                quoteIdToUse = vehicleData.workPhase.quoteId;
              }

              await fetchSparePartData(appointment.id, quoteIdToUse);
            }
          }
        }
        // ... existing code ...
      } catch (error) {
        console.error("Errore durante il caricamento dei dati:", error);
        toast.error("Errore durante il caricamento dei dati del veicolo");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicleData();
  }, [vehicleId]);

  useEffect(() => {
    const fetchChecklistLavorazione = async () => {
      if (!vehicleId) return;

      try {
        console.log("Cerco dati checklist per il veicolo:", vehicleId);

        // Prova il percorso principale della fase 2
        const workingPhaseRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione`);
        const workingPhaseSnap = await get(workingPhaseRef);

        if (workingPhaseSnap.exists()) {
          const data = workingPhaseSnap.val();
          console.log("Dati trovati in lavorazione:", data);

          // Aggiorna i dati del veicolo con la checklist di lavorazione
          setVehicleData((prevData) => {
            if (!prevData) return prevData;

            return {
              ...prevData,
              checklist:
                data.checklist ||
                data.checklistLavorazione ||
                data.checks ||
                data.items ||
                data,
            };
          });
        } else {
          // Prova percorsi alternativi
          const paths = [
            `vehicles/${vehicleId}/workingPhase`,
            `vehicles/${vehicleId}/fase2`,
            `workingPhase/${vehicleId}`,
            `lavorazione/${vehicleId}`,
          ];

          for (const path of paths) {
            console.log(`Cerco in percorso alternativo: ${path}`);
            const altRef = ref(rtdb, path);
            const altSnap = await get(altRef);

            if (altSnap.exists()) {
              const data = altSnap.val();
              console.log(`Dati trovati in ${path}:`, data);

              // Aggiorna i dati del veicolo con la checklist trovata
              setVehicleData((prevData) => {
                if (!prevData) return prevData;

                return {
                  ...prevData,
                  checklist:
                    data.checklist ||
                    data.checklistLavorazione ||
                    data.checks ||
                    data.items ||
                    data,
                };
              });

              break;
            }
          }
        }
      } catch (error) {
        console.error(
          "Errore nel recupero della checklist di lavorazione:",
          error,
        );
      }
    };

    // Se abbiamo già vehicleData ma non la checklist, prova a cercarla
    if (vehicleData && !vehicleData.checklist) {
      fetchChecklistLavorazione();
    }
  }, [vehicleId, vehicleData]);

  // Verifica se è richiesta la generazione automatica del PDF attraverso l'URL
  useEffect(() => {
    // Se il parametro generatePdf=true è presente nell'URL e abbiamo i dati del veicolo
    const searchParams = getURLParameters();
    const shouldGeneratePdf = searchParams.get("generatePdf") === "true";

    // Aggiungo un controllo per evitare il loop infinito
    const isAutoGenerationCompleted = sessionStorage.getItem(
      `pdf_generated_${vehicleId}`,
    );

    // Se richiesto, il veicolo è pronto e non è già stato generato, avvia la generazione del PDF
    if (
      shouldGeneratePdf &&
      vehicleData &&
      !isLoading &&
      !isAutoGenerationCompleted
    ) {
      // Segna che abbiamo già generato il PDF per questo veicolo in questa sessione
      sessionStorage.setItem(`pdf_generated_${vehicleId}`, "true");

      // Usa setTimeout per dare il tempo di renderizzare il componente
      const timer = setTimeout(() => {
        generatePDF();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [vehicleData, isLoading, vehicleId]);

  const generatePDF = async () => {
    if (!vehicleData) return;

    try {
      setIsLoading(true);

      // Log della checklist prima della generazione del PDF
      console.log("Generazione PDF con dati veicolo:", vehicleData);
      console.log("Checklist disponibile per il PDF:", vehicleData.checklist);

      // Creiamo l'istanza di jsPDF con orientation landscape per maggiore spazio
      const pdfDoc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // PRIMA PAGINA: Dati principali e foto di accettazione

      // Aggiungi il logo aziendale in alto a sinistra - con gestione errori migliorata
      try {
        // Verifichiamo che il logo sia una stringa URL valida
        if (COMPANY_LOGO && typeof COMPANY_LOGO === "string") {
          pdfDoc.addImage(
            COMPANY_LOGO,
            "PNG", // Specifico formato
            10,
            10,
            50,
            50, // Posizione e dimensioni
          );
        } else {
          throw new Error("Logo non valido");
        }
      } catch (logoError) {
        console.error("Errore nel caricamento del logo:", logoError);

        // Fallback testuale
        pdfDoc.setFontSize(22);
        pdfDoc.setTextColor(0, 0, 0); // Nero
        pdfDoc.text("Auto", 14, 30);

        pdfDoc.setTextColor(236, 107, 0); // Arancione
        pdfDoc.text("e", 38, 30);

        pdfDoc.setTextColor(128, 128, 128); // Grigio
        pdfDoc.text("Xpress", 45, 30);
      }

      // Dati aziendali a destra - spostati più in alto
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(100, 100, 100); // Grigio
      pdfDoc.text("AutoExpress Monopoli", 140, 25);
      pdfDoc.text("Via Eugenio Montale 4", 140, 30);
      pdfDoc.text("Tel: 3293888702", 140, 35);
      pdfDoc.text("70043 Monopoli BA", 140, 40);

      // Titolo principale con sfondo arancione leggero - spostato più in basso
      pdfDoc.setFillColor(252, 235, 218); // Arancione chiaro
      pdfDoc.rect(14, 50, pdfDoc.internal.pageSize.width - 28, 14, "F");

      pdfDoc.setFontSize(20);
      pdfDoc.setTextColor(236, 107, 0); // Arancione
      pdfDoc.text(
        "Tagliando Completato",
        pdfDoc.internal.pageSize.width / 2,
        60,
        { align: "center" },
      );

      // Box per ID e date con bordo più visibile - spostato più in basso
      pdfDoc.setFillColor(248, 248, 248); // Grigio molto chiaro
      pdfDoc.rect(14, 70, 100, 40, "F");
      pdfDoc.setDrawColor(200, 200, 200); // Bordo più scuro per maggiore visibilità
      pdfDoc.rect(14, 70, 100, 40, "S"); // Aggiunge il bordo

      // Dettagli veicolo e intervento
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(70, 70, 70); // Testo più scuro per migliore contrasto
      pdfDoc.text(`ID: ${appointmentId || "N/D"}`, 20, 80);

      // Gestione sicura della data di accettazione
      const accettazioneData = vehicleData.acceptanceDate
        ? typeof vehicleData.acceptanceDate === "object" &&
          vehicleData.acceptanceDate.toDate
          ? vehicleData.acceptanceDate.toDate()
          : new Date(vehicleData.acceptanceDate)
        : new Date();

      // Verifica che la data sia valida
      const dataAccettazioneValida = !isNaN(accettazioneData.getTime())
        ? format(accettazioneData, "dd/MM/yyyy HH:mm", { locale: it })
        : "Data non disponibile";

      pdfDoc.text(`Inizio: ${dataAccettazioneValida}`, 20, 90);
      pdfDoc.text(
        `Completato: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`,
        20,
        100,
      );

      // Box dati cliente con bordo più visibile - separazione aumentata
      pdfDoc.setFillColor(248, 248, 248); // Grigio molto chiaro
      pdfDoc.rect(125, 70, 70, 40, "F");
      pdfDoc.setDrawColor(180, 180, 180); // Bordo più scuro per maggiore visibilità
      pdfDoc.rect(125, 70, 70, 40, "S"); // Aggiunge il bordo

      // Dati cliente a destra - migliorato posizionamento
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(236, 107, 0);
      pdfDoc.text("Dati Cliente", 130, 80);

      pdfDoc.setTextColor(60, 60, 60); // Testo più scuro per massimo contrasto
      pdfDoc.setFontSize(10);

      // Otteniamo i dati cliente da tutte le fonti possibili
      let clienteNome = "N/D";
      let clienteTelefono = customerPhone || "N/D";

      // Verifica su tutte le possibili fonti di dati cliente
      if (appointmentId) {
        try {
          // 1. Prova a ottenere i dati dall'appuntamento
          const appRef = ref(rtdb, `appointments/${appointmentId}`);
          const appSnapshot = await get(appRef);
          if (appSnapshot.exists()) {
            const appData = appSnapshot.val();

            // Verifica tutti i possibili campi per il nome cliente
            if (appData.customerName) {
              clienteNome = appData.customerName;
            } else if (appData.client) {
              clienteNome = appData.client;
            } else if (appData.clientName) {
              clienteNome = appData.clientName;
            } else if (appData.cliente) {
              clienteNome = appData.cliente;
            }

            // Verifica tutti i possibili campi per il telefono cliente
            if (appData.customerPhone && !clienteTelefono) {
              clienteTelefono = appData.customerPhone;
            } else if (appData.clientPhone && !clienteTelefono) {
              clienteTelefono = appData.clientPhone;
            } else if (appData.phone && !clienteTelefono) {
              clienteTelefono = appData.phone;
            }
          }
        } catch (error) {
          console.error(
            "Errore nel recupero dei dati cliente dall'appuntamento:",
            error,
          );
        }

        try {
          // 2. Prova a ottenere i dati dal preventivo associato
          const appRef = ref(rtdb, `appointments/${appointmentId}`);
          const appSnapshot = await get(appRef);
          if (appSnapshot.exists() && appSnapshot.val().quoteId) {
            const quoteRef = ref(rtdb, `quotes/${appSnapshot.val().quoteId}`);
            const quoteSnapshot = await get(quoteRef);

            if (quoteSnapshot.exists()) {
              const quoteData = quoteSnapshot.val();

              // Verifica tutti i possibili campi per il nome cliente
              if (quoteData.clientName && clienteNome === "N/D") {
                clienteNome = quoteData.clientName;
              } else if (quoteData.client && clienteNome === "N/D") {
                clienteNome = quoteData.client;
              } else if (quoteData.customerName && clienteNome === "N/D") {
                clienteNome = quoteData.customerName;
              }

              // Verifica tutti i possibili campi per il telefono cliente
              if (quoteData.clientPhone && clienteTelefono === "N/D") {
                clienteTelefono = quoteData.clientPhone;
              } else if (quoteData.phone && clienteTelefono === "N/D") {
                clienteTelefono = quoteData.phone;
              } else if (quoteData.customerPhone && clienteTelefono === "N/D") {
                clienteTelefono = quoteData.customerPhone;
              }
            }
          }
        } catch (error) {
          console.error(
            "Errore nel recupero dei dati cliente dal preventivo:",
            error,
          );
        }
      }

      // 3. Prova a cercare il cliente nella directory clienti con il numero di telefono
      try {
        if (clienteTelefono !== "N/D") {
          const clientiRef = ref(rtdb, "clients");
          const clientiQuery = rtdbQuery(
            clientiRef,
            orderByChild("phone"),
            equalTo(clienteTelefono),
          );
          const clientiSnapshot = await get(clientiQuery);

          if (clientiSnapshot.exists() && clienteNome === "N/D") {
            const clienti = clientiSnapshot.val();
            const clientKey = Object.keys(clienti)[0];
            if (clienti[clientKey].name) {
              clienteNome = clienti[clientKey].name;
            } else if (clienti[clientKey].fullName) {
              clienteNome = clienti[clientKey].fullName;
            }
          }
        }
      } catch (error) {
        console.error(
          "Errore nel recupero del cliente dalla directory clienti:",
          error,
        );
      }

      // Formatta i dati cliente
      let clienteInfo =
        clienteNome !== "N/D"
          ? `${clienteNome}\n${clienteTelefono}`
          : clienteTelefono;

      // Visualizza i dati del cliente - migliorato posizionamento
      pdfDoc.setFontSize(10); // Carattere adeguato
      const clienteTextLines = pdfDoc.splitTextToSize(clienteInfo, 60);
      pdfDoc.text(clienteTextLines, 130, 90);

      // Targa veicolo con separazione adeguata
      const targaYPos = 90 + clienteTextLines.length * 5.5;
      pdfDoc.setFontSize(10);
      pdfDoc.text(`Targa: ${vehicleId}`, 130, targaYPos);

      // Box dati veicolo con bordo - aumentato margine dal box precedente
      pdfDoc.setFillColor(248, 248, 248); // Grigio molto chiaro
      pdfDoc.rect(14, 120, 180, 25, "F");
      pdfDoc.setDrawColor(200, 200, 200); // Bordo per maggiore visibilità
      pdfDoc.rect(14, 120, 180, 25, "S"); // Aggiunge il bordo

      // Chilometraggio e carburante - posizionamento migliorato
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(236, 107, 0);
      pdfDoc.text("Dati Veicolo", 20, 130);

      pdfDoc.setTextColor(100, 100, 100);
      pdfDoc.setFontSize(10);

      let infoVeicolo = "";
      if (vehicleData.mileage) {
        infoVeicolo += `Chilometraggio: ${vehicleData.mileage} km   `;
      }

      if (vehicleData.fuelLevel) {
        // Converti il livello carburante in numero
        let fuelLevelText = vehicleData.fuelLevel;
        let fuelLevelNumeric = "";

        // Mappatura dei valori testuali a numeri
        if (fuelLevelText === "empty" || fuelLevelText === "vuoto") {
          fuelLevelNumeric = "vuoto";
        } else if (
          fuelLevelText === "one-quarter" ||
          fuelLevelText === "quarter" ||
          fuelLevelText === "un quarto"
        ) {
          fuelLevelNumeric = "1/4";
        } else if (fuelLevelText === "half" || fuelLevelText === "metà") {
          fuelLevelNumeric = "2/4";
        } else if (
          fuelLevelText === "three-quarters" ||
          fuelLevelText === "three quarters"
        ) {
          fuelLevelNumeric = "3/4";
        } else if (fuelLevelText === "full" || fuelLevelText === "pieno") {
          fuelLevelNumeric = "4/4";
        } else {
          // Se già numerico o altro formato, lascialo com'è
          fuelLevelNumeric = fuelLevelText;
        }

        infoVeicolo += `Livello carburante: ${fuelLevelNumeric}`;
      }

      pdfDoc.text(infoVeicolo, 20, 140);

      // Foto di accettazione con posizionamento ottimizzato per evitare sovrapposizioni
      let yPos = 155;

      if (
        vehicleData.acceptancePhotos &&
        vehicleData.acceptancePhotos.length > 0
      ) {
        // Box per le foto di accettazione con intestazione arancione
        pdfDoc.setFillColor(236, 107, 0); // Arancione
        pdfDoc.rect(14, yPos, 180, 10, "F");

        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(255, 255, 255); // Bianco
        pdfDoc.text("Foto Accettazione", 20, yPos + 7);

        yPos += 15;

        // Area per le foto - ridotto per evitare debordamenti
        pdfDoc.setFillColor(252, 252, 252);
        pdfDoc.rect(14, yPos, 180, 80, "F");

        // Aggiungo fino a 4 foto in formato più compatto
        const maxPhotos = Math.min(vehicleData.acceptancePhotos.length, 4);

        try {
          // Dimensioni ridotte e layout più compatto
          const photoWidth = 75;
          const photoHeight = 55;
          const spacing = 8;
          const startX = 24;
          const startY = yPos + 10;

          for (let i = 0; i < maxPhotos; i++) {
            try {
              const row = Math.floor(i / 2); // 0 per prima riga, 1 per seconda
              const col = i % 2; // 0 per prima colonna, 1 per seconda

              const x = startX + col * (photoWidth + spacing);
              const y = startY + row * (photoHeight + spacing);

              // @ts-ignore
              pdfDoc.addImage(
                vehicleData.acceptancePhotos[i],
                "JPEG",
                x,
                y,
                photoWidth,
                photoHeight,
              );
            } catch (error) {
              console.error(
                `Errore nel caricamento della foto di accettazione ${i + 1}:`,
                error,
              );
            }
          }
        } catch (error) {
          console.error(
            "Errore nel rendering delle foto di accettazione:",
            error,
          );
        }
      }

      // SECONDA PAGINA per tabella ricambi e foto ricambi
      pdfDoc.addPage();
      yPos = 20;

      // Tabella ricambi sostituiti in SECONDA pagina
      if (spareParts && spareParts.length > 0) {
        pdfDoc.setFillColor(236, 107, 0);
        pdfDoc.rect(14, yPos, 180, 10, "F");

        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.text("Ricambi Sostituiti", 20, yPos + 7);

        yPos += 15;

        // Intestazione tabella
        pdfDoc.setFillColor(240, 240, 240);
        pdfDoc.rect(14, yPos, 180, 8, "F");
        pdfDoc.setDrawColor(220, 220, 220); // Colore del bordo
        pdfDoc.rect(14, yPos, 180, 8, "S"); // Aggiunge il bordo

        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(80, 80, 80);
        pdfDoc.text("Codice", 18, yPos + 5);
        pdfDoc.text("Descrizione", 50, yPos + 5);
        pdfDoc.text("Qtà", 140, yPos + 5);
        pdfDoc.text("Prezzo", 160, yPos + 5);

        yPos += 10;

        // Righe tabella ricambi
        for (let i = 0; i < spareParts.length; i++) {
          const part = spareParts[i];

          // Alterna colori di sfondo
          pdfDoc.setFillColor(
            i % 2 === 0 ? 252 : 248,
            i % 2 === 0 ? 252 : 248,
            i % 2 === 0 ? 252 : 248,
          );
          pdfDoc.rect(14, yPos, 180, 8, "F");
          pdfDoc.setDrawColor(235, 235, 235); // Bordo più leggero
          pdfDoc.rect(14, yPos, 180, 8, "S"); // Aggiunge il bordo

          pdfDoc.setFontSize(8);
          pdfDoc.setTextColor(80, 80, 80);
          pdfDoc.text(part.code || "Ricambio", 18, yPos + 5);

          // Tronca descrizione se troppo lunga
          const description = part.name || part.description || "Ricambio";
          const truncatedDesc =
            description.length > 45
              ? description.substring(0, 42) + "..."
              : description;
          pdfDoc.text(truncatedDesc, 50, yPos + 5);

          pdfDoc.text(String(part.quantity || 1), 140, yPos + 5);

          // Utilizziamo finalPrice come prima scelta, poi price come fallback
          const unitPrice =
            part.finalPrice !== undefined ? part.finalPrice : part.price || 0;
          pdfDoc.text(`€ ${unitPrice.toFixed(2)}`, 160, yPos + 5);

          yPos += 8;
        }

        // Aggiungiamo la riga del totale
        pdfDoc.setFillColor(240, 240, 240);
        pdfDoc.rect(14, yPos, 180, 10, "F");
        pdfDoc.setDrawColor(220, 220, 220);
        pdfDoc.rect(14, yPos, 180, 10, "S");

        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(80, 80, 80);
        pdfDoc.text("Totale:", 125, yPos + 7);

        // Calcolo il totale considerando finalPrice come prioritario
        const totale = spareParts.reduce((acc, part) => {
          const prezzo =
            part.finalPrice !== undefined ? part.finalPrice : part.price || 0;
          const quantita = part.quantity || 1;
          return acc + prezzo * quantita;
        }, 0);

        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(236, 107, 0);
        pdfDoc.text(`€ ${totale.toFixed(2)}`, 160, yPos + 7);

        // Lasciamo spazio dopo la tabella ricambi
        yPos += 15;
      } else {
        // Se non ci sono ricambi, mostra un messaggio
        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(100, 100, 100);
        pdfDoc.text(
          "Nessun ricambio registrato",
          pdfDoc.internal.pageSize.width / 2,
          yPos + 10,
          { align: "center" },
        );
        yPos += 25;
      }

      // Foto dei ricambi, sempre nella seconda pagina dopo la tabella
      if (
        vehicleData.sparePartPhotos &&
        vehicleData.sparePartPhotos.length > 0
      ) {
        // Box per le foto di ricambi con intestazione arancione
        pdfDoc.setFillColor(236, 107, 0); // Arancione
        pdfDoc.rect(14, yPos, 180, 10, "F");

        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(255, 255, 255); // Bianco
        pdfDoc.text("Foto Ricambi", 20, yPos + 7);

        yPos += 15;

        // Area per le foto
        pdfDoc.setFillColor(252, 252, 252);
        pdfDoc.rect(14, yPos, 180, 60, "F");

        // Aggiungo fino a 4 foto in formato piccolo, in una riga
        const maxPhotos = Math.min(vehicleData.sparePartPhotos.length, 4);

        try {
          // Calcolo la larghezza e spazio tra le foto in base al numero di foto
          const photoWidth = 80; // Larghezza ridotta per foto piccole
          const photoHeight = 80; // Altezza ridotta
          const spacing = 4; // Spazio tra le foto
          const totalWidth = photoWidth * maxPhotos + spacing * (maxPhotos - 1);
          const startX = (pdfDoc.internal.pageSize.width - totalWidth) / 2; // Centro le foto

          for (let i = 0; i < maxPhotos; i++) {
            try {
              // @ts-ignore
              pdfDoc.addImage(
                vehicleData.sparePartPhotos[i],
                "JPEG",
                startX + i * (photoWidth + spacing), // Disponi le foto una accanto all'altra
                yPos + 10, // Aggiungi margine dall'intestazione
                photoWidth,
                photoHeight,
              );
            } catch (error) {
              console.error(
                `Errore nel caricamento della foto di ricambio ${i + 1}:`,
                error,
              );
            }
          }
        } catch (error) {
          console.error("Errore nel rendering delle foto di ricambi:", error);
        }
      }

      // PAGINA CHECKLIST SEGUENDO L'ORDINE DELLA FASE 2
      pdfDoc.addPage();

      // Intestazione pagina checklist
      pdfDoc.setFillColor(252, 235, 218); // Arancione chiaro
      pdfDoc.rect(14, 20, pdfDoc.internal.pageSize.width - 28, 16, "F");

      pdfDoc.setFontSize(18);
      pdfDoc.setTextColor(236, 107, 0); // Arancione
      pdfDoc.text(
        "Scheda Ispezione Veicolo",
        pdfDoc.internal.pageSize.width / 2,
        32,
        { align: "center" },
      );

      let checklistYPosition = 45;

      // Carica dinamicamente tutti i parametri, inclusi quelli personalizzati
      const customParameters = await loadChecklistParameters();

      // Definiamo le sezioni nello stesso ordine della fase 2
      const orderedSections = [
        {
          title: "Motore",
          components: [
            "livelloOlioMotore",
            "livelloRefrigerante",
            "olioMotore",
            "filtroOlio",
            "filtroAria",
            "filtroAbitacolo",
            "cinghiaServizi",
            "cinghiaDistribuzione",
          ],
        },
        {
          title: "Sistema Sterzo",
          components: [
            "tiranteDx",
            "tiranteSx",
            "testinaDx",
            "testinaSx",
            "cuffiaTiranteDx",
            "cuffiaTiranteSx",
          ],
        },
        {
          title: "Sistema Freni",
          components: [
            "livelloOlioFreni",
            "discoAntSx",
            "discoAntDx",
            "discoPostSx",
            "discoPostDx",
            "pastiglieAntSx",
            "pastiglieAntDx",
            "pastigliePostSx",
            "pastigliePostDx",
            "tubiFrenoAnt",
            "tubiFrenoPost",
            "sistemaVacuum",
          ],
        },
        {
          title: "Sospensione Anteriore",
          components: [
            "ammortizzatoreAntDx",
            "ammortizzatoreAntSx",
            "paraPolvere",
            "cuffiaStelo",
            "mollaElicoidaleAntDx",
            "mollaElicoidaleAntSx",
            "tiranteAmmSospDx",
            "tiranteAmmSospSx",
            "braccioInferioreS",
            "braccioInferioreD",
            "barraStabilizzatriceAnte",
            "gomminiBarraStabilizzatrice",
          ],
        },
        {
          title: "Pneumatici",
          components: [
            "battistradaAnt",
            "battistradaPost",
            "controlloPressione",
          ],
        },
      ];

      // Aggiungiamo i parametri personalizzati alle sezioni
      if (customParameters) {
        // Per ogni sezione nei parametri personalizzati
        for (const [sectionName, parameters] of Object.entries(
          customParameters,
        )) {
          // Cerca se la sezione esiste già
          const existingSection = orderedSections.find(
            (section) => section.title === sectionName,
          );

          if (existingSection) {
            // Aggiungi i parametri personalizzati alla sezione esistente
            for (const param of parameters) {
              if (!existingSection.components.includes(param.id)) {
                existingSection.components.push(param.id);
              }
            }
          } else if (parameters && parameters.length > 0) {
            // Crea una nuova sezione se contiene parametri
            orderedSections.push({
              title: sectionName,
              components: parameters.map((param) => param.id),
            });
          }
        }
      }

      // Estrai i dati della checklist
      const checklistData = vehicleData.checklist || {};

      // Assicuriamoci che i dati della checklist siano disponibili
      console.log("Dati checklist per PDF:", checklistData);

      // Elabora ogni sezione
      for (const section of orderedSections) {
        // Intestazione della sezione
        pdfDoc.setFillColor(236, 107, 0);
        pdfDoc.rect(14, checklistYPosition, 180, 10, "F");

        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.text(section.title, 20, checklistYPosition + 7);

        checklistYPosition += 15;

        // Header della tabella per questa sezione
        pdfDoc.setFillColor(240, 240, 240);
        pdfDoc.rect(14, checklistYPosition, 180, 8, "F");
        pdfDoc.setDrawColor(220, 220, 220); // Colore del bordo
        pdfDoc.rect(14, checklistYPosition, 180, 8, "S"); // Aggiunge il bordo

        pdfDoc.setTextColor(80, 80, 80);
        pdfDoc.setFontSize(9);
        pdfDoc.text("Componente", 20, checklistYPosition + 5);
        pdfDoc.text("Stato", 120, checklistYPosition + 5);
        pdfDoc.text("Note", 160, checklistYPosition + 5);

        checklistYPosition += 10;

        // Componenti di questa sezione
        let componentFound = false;

        // Mostra tutti i componenti della sezione, indipendentemente dalla presenza di dati
        for (const componentKey of section.components) {
          componentFound = true;

          // Gestione speciale per i pneumatici che hanno chiavi diverse
          let componentData = checklistData[componentKey];

          // Se è la sezione pneumatici e non troviamo dati, proviamo altre chiavi possibili
          if (section.title === "Pneumatici" && !componentData) {
            if (
              componentKey === "battistradaAnt" &&
              checklistData["battistradaAnteriore"]
            ) {
              componentData = checklistData["battistradaAnteriore"];
            } else if (
              componentKey === "battistradaPost" &&
              checklistData["battistradaPosteriore"]
            ) {
              componentData = checklistData["battistradaPosteriore"];
            } else if (
              componentKey === "controlloPressione" &&
              checklistData["pressione"]
            ) {
              componentData = checklistData["pressione"];
            }
          }

          // Ottieni il nome leggibile del componente
          let componentName =
            CHECKLIST_COMPONENTS[componentKey] || componentKey;

          // Se abbiamo parametri personalizzati, cerchiamo il nome del componente
          if (customParameters) {
            for (const [sectionName, parameters] of Object.entries(
              customParameters,
            )) {
              const matchingParam = parameters.find(
                (param) => param.id === componentKey,
              );
              if (matchingParam) {
                componentName = matchingParam.name;
                break;
              }
            }
          }

          // Gestione speciale per i pneumatici
          if (componentKey === "battistradaAnt") {
            componentName = "Battistrada Anteriore";
          } else if (componentKey === "battistradaPost") {
            componentName = "Battistrada Posteriore";
          } else if (componentKey === "controlloPressione") {
            componentName = "Controllo Pressione";
          }

          // Determina lo stato - default "NON CONTROLLATO" se non ci sono dati
          let stato = "NON CONTROLLATO";
          let isCompletato = false;
          let isNonControllato = true;

          if (
            componentData &&
            typeof componentData === "object" &&
            componentData !== null
          ) {
            if (componentData.stato) {
              stato = componentData.stato;
              isCompletato = stato === "CONTROLLATO";
              isNonControllato = stato === "NON CONTROLLATO";
            }
          }

          // Ottieni le note
          let note = "";
          if (
            componentData &&
            typeof componentData === "object" &&
            componentData !== null &&
            componentData.note
          ) {
            note = componentData.note;
          }

          // Alterna colori di sfondo
          pdfDoc.setFillColor(248, 248, 248);
          pdfDoc.rect(14, checklistYPosition, 180, 8, "F");
          pdfDoc.setDrawColor(235, 235, 235); // Bordo più leggero
          pdfDoc.rect(14, checklistYPosition, 180, 8, "S"); // Aggiunge il bordo

          // Nome componente - aumentato lo spazio e il font
          pdfDoc.setTextColor(80, 80, 80);
          pdfDoc.setFontSize(8.5);
          pdfDoc.setFont("helvetica", "bold");

          // Aggiungi spazio tra le parole se il nome è lungo e non ha spazi
          if (componentName.length > 12 && !componentName.includes(" ")) {
            // Inserisci spazi tra le parole in camelCase o PascalCase
            componentName = componentName.replace(/([a-z])([A-Z])/g, "$1 $2");
            // Inserisci spazi tra le parole con la prima lettera maiuscola
            componentName = componentName.replace(
              /([A-Z])([A-Z][a-z])/g,
              "$1 $2",
            );
          }

          pdfDoc.text(componentName, 20, checklistYPosition + 5);
          pdfDoc.setFont("helvetica", "normal");

          // Stato con tre possibili colori e icone
          let statoIcon = "";
          if (isCompletato) {
            pdfDoc.setTextColor(0, 128, 0); // Verde per CONTROLLATO
            statoIcon = "• ";
          } else if (isNonControllato) {
            pdfDoc.setTextColor(128, 128, 128); // Grigio per NON CONTROLLATO
            statoIcon = "? ";
          } else {
            pdfDoc.setTextColor(200, 0, 0); // Rosso per DA FARE
            statoIcon = "! ";
          }

          // Aggiungi icona prima del testo dello stato
          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.text(statoIcon + stato, 120, checklistYPosition + 5);
          pdfDoc.setFont("helvetica", "normal");

          // Note
          pdfDoc.setTextColor(80, 80, 80);
          if (note) {
            // Tronca le note troppo lunghe
            const truncatedNote =
              note.length > 20 ? note.substring(0, 17) + "..." : note;
            pdfDoc.text(truncatedNote, 160, checklistYPosition + 5);
          }

          checklistYPosition += 8;

          // Verifica se è necessaria una nuova pagina
          if (checklistYPosition > pdfDoc.internal.pageSize.height - 30) {
            pdfDoc.addPage();

            // Intestazione della nuova pagina
            pdfDoc.setFillColor(252, 235, 218);
            pdfDoc.rect(14, 20, pdfDoc.internal.pageSize.width - 28, 16, "F");

            pdfDoc.setFontSize(18);
            pdfDoc.setTextColor(236, 107, 0);
            pdfDoc.text(
              "Scheda Ispezione Veicolo (continua)",
              pdfDoc.internal.pageSize.width / 2,
              32,
              { align: "center" },
            );

            checklistYPosition = 45;
          }
        }

        // Se non sono stati trovati componenti in questa sezione, mostra un messaggio
        if (!componentFound) {
          pdfDoc.setTextColor(100, 100, 100);
          pdfDoc.setFontSize(9);
          pdfDoc.text(
            "Nessun dato disponibile per questa sezione",
            20,
            checklistYPosition + 5,
          );

          checklistYPosition += 10;
        }

        // Spazio tra le sezioni
        checklistYPosition += 10;
      }

      // Crea una nuova pagina per "Prova su Strada" e "Note e Commenti"
      pdfDoc.addPage();
      let finalPageYPos = 30;

      // Intestazione della pagina finale
      pdfDoc.setFillColor(252, 235, 218);
      pdfDoc.rect(
        14,
        finalPageYPos,
        pdfDoc.internal.pageSize.width - 28,
        14,
        "F",
      );

      pdfDoc.setFontSize(20);
      pdfDoc.setTextColor(236, 107, 0);
      pdfDoc.text(
        "Riepilogo Finale",
        pdfDoc.internal.pageSize.width / 2,
        finalPageYPos + 10,
        { align: "center" },
      );

      finalPageYPos += 24;

      // Aggiungi la sezione "Prova su Strada" sempre sull'ultima pagina
      pdfDoc.setFillColor(236, 107, 0);
      pdfDoc.rect(14, finalPageYPos, 180, 10, "F");

      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(255, 255, 255);
      pdfDoc.text("Prova su Strada", 20, finalPageYPos + 7);

      finalPageYPos += 15;

      // Dati prova su strada
      if (checklistData.provaSuStrada) {
        pdfDoc.setFillColor(248, 248, 248);
        pdfDoc.rect(14, finalPageYPos, 180, 30, "F");

        pdfDoc.setTextColor(80, 80, 80);
        pdfDoc.setFontSize(10);
        pdfDoc.text("Controllo effettuato:", 20, finalPageYPos + 12);

        if (checklistData.provaSuStrada.stato === "CONTROLLATO") {
          pdfDoc.setTextColor(0, 128, 0); // Verde per CONTROLLATO
          pdfDoc.text("COMPLETATO", 120, finalPageYPos + 12);
        } else if (checklistData.provaSuStrada.stato === "NON CONTROLLATO") {
          pdfDoc.setTextColor(128, 128, 128); // Grigio per NON CONTROLLATO
          pdfDoc.text("NON CONTROLLATO", 120, finalPageYPos + 12);
        } else {
          pdfDoc.setTextColor(200, 0, 0); // Rosso per DA FARE
          pdfDoc.text("DA FARE", 120, finalPageYPos + 12);
        }

        pdfDoc.setTextColor(80, 80, 80);
        if (checklistData.provaSuStrada.note) {
          pdfDoc.text("Note:", 20, finalPageYPos + 22);
          const maxWidth = 120;
          const lines = pdfDoc.splitTextToSize(
            checklistData.provaSuStrada.note,
            maxWidth,
          );
          pdfDoc.text(lines, 60, finalPageYPos + 22);
        }
      } else {
        pdfDoc.setFillColor(248, 248, 248);
        pdfDoc.rect(14, finalPageYPos, 180, 20, "F");

        pdfDoc.setTextColor(100, 100, 100);
        pdfDoc.setFontSize(10);
        pdfDoc.text(
          "Dati prova su strada non disponibili",
          20,
          finalPageYPos + 12,
        );
      }

      finalPageYPos += 40;

      // Sezione commenti/note generali sull'ultima pagina
      pdfDoc.setFillColor(236, 107, 0);
      pdfDoc.rect(14, finalPageYPos, 180, 10, "F");

      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(255, 255, 255);
      pdfDoc.text("Note e Commenti", 20, finalPageYPos + 7);

      finalPageYPos += 15;

      // Area per i commenti
      pdfDoc.setFillColor(248, 248, 248);
      pdfDoc.rect(14, finalPageYPos, 180, 120, "F");

      // Se ci sono commenti, li visualizza
      if (vehicleData.commenti) {
        pdfDoc.setTextColor(80, 80, 80);
        pdfDoc.setFontSize(10);

        // Suddividi i commenti in righe per adattarli alla larghezza
        const maxWidth = 170;
        const lines = pdfDoc.splitTextToSize(vehicleData.commenti, maxWidth);

        pdfDoc.text(lines, 20, finalPageYPos + 10);
      } else {
        pdfDoc.setTextColor(100, 100, 100);
        pdfDoc.setFontSize(10);
        pdfDoc.text("Nessun commento o nota", 20, finalPageYPos + 10);
      }

      // Genera il nome del file
      const fileName = `Tagliando_${vehicleId}_${format(new Date(), "yyyyMMdd")}.pdf`;

      // Salva direttamente il PDF invece di aprirlo in una nuova finestra
      try {
        // Prima genera un blob del PDF
        const pdfBlob = pdfDoc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        setPdfData(pdfUrl);

        // Metodo 1: Tenta il salvataggio diretto
        pdfDoc.save(fileName);
        console.log("PDF salvato con il metodo save()");

        // Metodo 2: Prova anche con il link di download esplicito
        const downloadLink = document.createElement("a");
        downloadLink.href = pdfUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          document.body.removeChild(downloadLink);
        }, 100);
        console.log("PDF scaricato anche con il metodo del link manuale");

        toast.success("PDF generato con successo");
      } catch (error) {
        console.error("Errore nel salvataggio del PDF:", error);

        // Fallback: usa un altro metodo
        try {
          // Se jsPDF.save() fallisce, prova con window.open
          const dataUri = pdfDoc.output("datauristring");
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head>
                  <title>${fileName}</title>
                </head>
                <body style="margin:0">
                  <embed width="100%" height="100%" src="${dataUri}" type="application/pdf">
                </body>
              </html>
            `);
            toast.success("PDF aperto in una nuova finestra");
          } else {
            toast.error(
              "Il browser ha bloccato l'apertura di una nuova finestra. Usa il pulsante di Download PDF sotto.",
            );
          }
        } catch (fallbackError) {
          console.error("Anche il fallback è fallito:", fallbackError);
          toast.error(
            "Errore nel salvataggio del PDF, usa il pulsante 'Download PDF'",
          );
        }
      }

      // Aggiorna i dati per indicare che la consegna è completata
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const deliveryCompletionData = {
        deliveryCompleted: true,
        deliveryDate: new Date().toISOString(),
        deliveryNotes: deliveryNotes,
        clienteNotificato: clienteNotificato,
      };

      await update(vehicleRef, deliveryCompletionData);

      // Segna l'appuntamento come completato
      if (appointmentId) {
        await updateAppointment(appointmentId, {
          status: "completato",
        });

        // Forza l'aggiornamento della vista calendario se disponibile
        try {
          // Notifica il calendario che ci sono stati cambiamenti
          const event = new Event("calendar:update");
          window.dispatchEvent(event);

          // Richiama le funzioni globali di refresh se disponibili
          if (window && (window as any).forceCalendarRefresh) {
            console.log(
              "Forzo il refresh del calendario tramite forceCalendarRefresh",
            );
            (window as any).forceCalendarRefresh();
          } else if (
            window &&
            window.parent &&
            (window.parent as any).reloadAppointments
          ) {
            console.log(
              "Forzo la ricarica degli appuntamenti tramite reloadAppointments",
            );
            (window.parent as any).reloadAppointments();
          }
        } catch (eventError) {
          console.error(
            "Errore nell'invio dell'evento di aggiornamento:",
            eventError,
          );
        }
      }

      // Chiamiamo onComplete() per notificare il completamento dell'operazione
      onComplete();
    } catch (error) {
      console.error("Errore nella generazione del PDF:", error);
      toast.error("Errore nell'esportazione del PDF");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificaCliente = async () => {
    try {
      setIsLoading(true);
      // Aggiorniamo lo stato di notifica
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      await update(vehicleRef, {
        clienteNotificato: true,
      });

      setClienteNotificato(true);
      toast.success(`Notifica inviata al cliente: ${customerPhone}`);
    } catch (error) {
      console.error("Errore durante la notifica al cliente:", error);
      toast.error("Errore durante la notifica al cliente. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    try {
      setIsLoading(true);
      // Recuperiamo prima i dati esistenti
      const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      let vehicleRawData: Record<string, any> = {};

      if (snapshot.exists()) {
        vehicleRawData = snapshot.val();
      }

      // Prepariamo i dati di completamento
      const completionData: Record<string, any> = {
        deliveryCompleted: true,
        deliveryDate: new Date().toISOString(),
        deliveryNotes: deliveryNotes,
      };

      // Se abbiamo dati della checklist, sincronizziamo gli stati tra tutti i punti di salvataggio possibili
      if (vehicleData?.checklist) {
        const updatedChecklist = { ...vehicleData.checklist };

        // Aggiorna vehicleRawData con la checklist aggiornata in tutte le posizioni possibili
        if (vehicleRawData.checklist) {
          completionData.checklist = updatedChecklist;
        }

        if (vehicleRawData.checklistLavorazione) {
          completionData.checklistLavorazione = updatedChecklist;
        }

        // Aggiorna anche nella sezione lavorazione se esiste
        try {
          const lavorazioneRef = ref(rtdb, `vehicles/${vehicleId}/lavorazione`);
          const lavorazioneSnapshot = await get(lavorazioneRef);

          if (lavorazioneSnapshot.exists()) {
            await update(lavorazioneRef, {
              checklist: updatedChecklist,
              checklistLavorazione: updatedChecklist,
              // Salva anche note e commenti
              commenti: vehicleData.commenti,
              note: vehicleData.commenti,
              noteGenerali: vehicleData.commenti,
            });
          }
        } catch (error) {
          console.error("Errore nell'aggiornamento della lavorazione:", error);
        }

        // Aggiorna nei percorsi alternativi
        const alternativePaths = [
          `vehicles/${vehicleId}/workingPhase`,
          `vehicles/${vehicleId}/fase2`,
          `workingPhase/${vehicleId}`,
          `lavorazione/${vehicleId}`,
        ];

        for (const path of alternativePaths) {
          try {
            const altRef = ref(rtdb, path);
            const altSnapshot = await get(altRef);

            if (altSnapshot.exists()) {
              await update(altRef, {
                checklist: updatedChecklist,
                checklistLavorazione: updatedChecklist,
                // Salva anche note e commenti
                commenti: vehicleData.commenti,
                note: vehicleData.commenti,
                noteGenerali: vehicleData.commenti,
              });
            }
          } catch (error) {
            console.error(
              `Errore nell'aggiornamento del percorso ${path}:`,
              error,
            );
          }
        }
      }

      // Aggiorniamo i dati di completamento
      await update(vehicleRef, {
        ...vehicleRawData,
        ...completionData,
      });

      // Se abbiamo un ID dell'appuntamento, aggiorniamolo
      if (appointmentId) {
        await updateAppointment(appointmentId, {
          status: "completato",
        });

        // Aggiorna anche lo stato del preventivo associato a completato
        try {
          const appointmentRef = ref(rtdb, `appointments/${appointmentId}`);
          const appointmentSnapshot = await get(appointmentRef);

          if (appointmentSnapshot.exists()) {
            const appointmentData = appointmentSnapshot.val();
            const quoteId = appointmentData.quoteId;

            // Se c'è un preventivo, aggiorna il suo stato
            if (quoteId) {
              console.log(
                `Aggiornamento stato preventivo ${quoteId} a completato`,
              );
              const quoteRef = ref(rtdb, `quotes/${quoteId}`);
              await update(quoteRef, {
                status: "completato",
              });
            } else {
              console.log("Nessun preventivo associato all'appuntamento");
            }
          }
        } catch (error) {
          console.error(
            "Errore nell'aggiornamento dello stato del preventivo:",
            error,
          );
        }
      }

      // Notifica completamento
      toast.success("Consegna completata con successo!");

      // Reindirizza alla dashboard dopo la conferma
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);

      onComplete();
    } catch (error) {
      console.error("Errore durante il completamento della consegna:", error);
      toast.error("Errore durante il completamento della consegna");
    } finally {
      setIsLoading(false);
    }
  };

  // Log per debug dei ricambi
  useEffect(() => {
    console.log("Stato spareParts aggiornato:", spareParts);

    // Debug di workSpareParts nella struttura del veicolo
    const debugVehicleStructure = async () => {
      try {
        const vehicleRef = ref(rtdb, `vehicles/${vehicleId}`);
        const vehicleSnap = await get(vehicleRef);

        if (vehicleSnap.exists()) {
          const vehicleData = vehicleSnap.val();
          console.log("DEBUG COMPLETO STRUTTURA VEICOLO:", vehicleData);

          if (vehicleData.workSpareParts) {
            console.log("DEBUG workSpareParts:", vehicleData.workSpareParts);
            console.log(
              "DEBUG è array?",
              Array.isArray(vehicleData.workSpareParts),
            );
            console.log("DEBUG keys:", Object.keys(vehicleData.workSpareParts));

            // Ispeziona l'interno della struttura
            if (vehicleData.workSpareParts[0]) {
              console.log(
                "DEBUG workSpareParts[0]:",
                vehicleData.workSpareParts[0],
              );
            }
          } else {
            console.log("DEBUG: workSpareParts non trovato");
          }
        }
      } catch (error) {
        console.error("Errore debug:", error);
      }
    };

    // Esegui il debug solo se non ci sono ricambi
    if (spareParts.length === 0) {
      debugVehicleStructure();
    }
  }, [spareParts, vehicleId]);

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <h2 className="text-2xl font-bold mb-4">Fase di Consegna</h2>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Mostro le foto dei ricambi se disponibili */}
          <div className="hidden">
            {vehicleData?.sparePartPhotos &&
              vehicleData.sparePartPhotos.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Foto Ricambi</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {vehicleData.sparePartPhotos.map((photo, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-md overflow-hidden"
                      >
                        <img
                          src={photo}
                          alt={`Ricambio ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Aggiungiamo la sezione Ricambi Sostituiti da preventivo */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Ricambi Sostituiti</h3>
            <div className="border border-border rounded-lg p-4 bg-background">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="pb-2">Codice</th>
                    <th className="pb-2">Descrizione</th>
                    <th className="pb-2">Qtà</th>
                    <th className="pb-2 text-right">Prezzo</th>
                  </tr>
                </thead>
                <tbody>
                  {spareParts && spareParts.length > 0 ? (
                    spareParts.map((part, index) => {
                      // Utilizziamo finalPrice come prima scelta, poi price come fallback
                      const prezzo =
                        part.finalPrice !== undefined
                          ? part.finalPrice
                          : part.price;
                      console.log(`Rendering ricambio ${index}:`, part);
                      return (
                        <tr
                          key={index}
                          className={
                            index % 2 === 0 ? "bg-transparent" : "bg-muted/30"
                          }
                        >
                          <td className="py-2">{part.code || "N/D"}</td>
                          <td className="py-2">
                            {part.name || part.description || "Ricambio"}
                          </td>
                          <td className="py-2">{part.quantity || 1}</td>
                          <td className="py-2 text-right">
                            {prezzo !== undefined
                              ? `€ ${Number(prezzo).toFixed(2)}`
                              : "N/D"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-3 text-center text-muted-foreground"
                      >
                        Nessun ricambio disponibile
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note di consegna */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Note di Consegna</h3>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="w-full p-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[100px]"
              placeholder="Inserisci note aggiuntive per la consegna..."
            ></textarea>
          </div>

          {/* Link di download nascosto che verrà attivato quando il PDF è pronto */}
          {pdfData && (
            <a
              ref={downloadLinkRef}
              href={pdfData}
              download={`Tagliando_${vehicleId}_${format(new Date(), "yyyyMMdd")}.pdf`}
              className="hidden"
            >
              Download PDF
            </a>
          )}

          {/* Azioni */}
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
            <button
              onClick={generatePDF}
              className="bg-background hover:bg-accent/80 text-foreground px-4 py-2 rounded font-bold transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Scarica PDF
            </button>
            
            {/* Rimuovo il pulsante Download PDF */}
            
            {/* Rimuovo il pulsante Notifica Cliente */}
            
            <button
              onClick={handleCompleteDelivery}
              className="bg-primary text-primary-foreground px-4 py-2 rounded font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Conferma
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export { DeliveryPhase };
export default DeliveryPhase;
