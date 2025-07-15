import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { clientService } from "../services/clientService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Car, User, Phone, Mail, Calendar, CreditCard, FileText, MessageCircle, Eye, X, Building2, UserCheck } from "lucide-react";
import { Vehicle } from "@shared/types";

export default function ProfiloClientePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientData, setClientData] = useState<{
    name: string;
    surname: string;
    email: string;
    phone: string;
    birthDate: string;
    plate: string;
    vin: string;
    vehicles: Vehicle[];
    // Dati fiscali
    tipo_cliente: "privato" | "azienda";
    cf: string;
    piva: string;
    sdi: string;
    pec: string;
  }>({
    name: "",
    surname: "",
    email: "",
    phone: "",
    birthDate: "",
    plate: "",
    vin: "",
    vehicles: [],
    // Dati fiscali
    tipo_cliente: "privato",
    cf: "",
    piva: "",
    sdi: "",
    pec: ""
  });
  const [loadingData, setLoadingData] = useState(true);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.clientId) return;
      setLoadingData(true);
      try {
        const client = await clientService.getById(user.clientId);
        if (client) {
          setClientData({
            name: client.name || "",
            surname: client.surname || "",
            email: client.email || "",
            phone: client.phone || "",
            birthDate: client.birthDate || "",
            plate: client.plate || "",
            vin: client.vin || "",
            vehicles: client.vehicles || [],
            // Dati fiscali
            tipo_cliente: client.tipo_cliente || "privato",
            cf: client.cf || "",
            piva: client.piva || "",
            sdi: client.sdi || "",
            pec: client.pec || ""
          });
        }
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user?.clientId]);

  // Funzione per ottenere tutti i veicoli (nuovo sistema + legacy)
  const getAllVehicles = (): Vehicle[] => {
    if (clientData.vehicles && clientData.vehicles.length > 0) {
      return clientData.vehicles;
    }
    // Fallback al sistema legacy
    if (clientData.plate) {
      return [{
        id: 'legacy',
        plate: clientData.plate,
        vin: clientData.vin,
        registrationPhotos: []
      }];
    }
    return [];
  };

  const viewPhoto = (photoUrl: string) => {
    if (!photoUrl) {
      toast({
        title: "Errore",
        description: "URL della foto non valido",
        variant: "destructive",
      });
      return;
    }
    setViewingPhoto(photoUrl);
  };

  const closePhotoViewer = () => {
    setViewingPhoto(null);
  };

  // Gestione ESC per il modal foto
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && viewingPhoto) {
        closePhotoViewer();
      }
    };

    if (viewingPhoto) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [viewingPhoto]);

  if (!(user?.clientId)) {
    return <div className="p-8 text-center">Accesso non autorizzato.</div>;
  }

  if (loadingData) {
    return <div className="flex items-center justify-center h-96 text-lg">Caricamento dati profilo...</div>;
  }

  // Formatta la data di nascita se presente
  const formattedBirthDate = clientData.birthDate ? 
    new Date(clientData.birthDate).toLocaleDateString('it-IT') : 
    "Non specificata";
    
  // Ottieni le iniziali per l'avatar
  const getInitials = () => {
    const nameInitial = clientData.name ? clientData.name[0].toUpperCase() : '';
    const surnameInitial = clientData.surname ? clientData.surname[0].toUpperCase() : '';
    return nameInitial + surnameInitial;
  };
  
  // Apri WhatsApp per contattare l'officina
  const openWhatsapp = () => {
    // Numero di telefono dell'officina (sostituire con quello effettivo)
    const officinaTel = "+393293888702";
    
    // Crea il messaggio precompilato
    const message = `Ciao, sono ${clientData.name} ${clientData.surname} (ID cliente: ${user?.clientId}), desidero modificare i miei dati con i seguenti dati: .`;
    
    // Crea l'URL di WhatsApp
    const whatsappUrl = `https://wa.me/${officinaTel}?text=${encodeURIComponent(message)}`;
    
    // Apri in una nuova finestra
    window.open(whatsappUrl, '_blank');
  };

  const vehicles = getAllVehicles();

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="flex flex-col md:flex-row md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-orange-500">
            <AvatarFallback className="bg-orange-500/20 text-orange-500 text-xl font-bold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h2 className="text-2xl font-bold text-white">{clientData.name} {clientData.surname}</h2>
            <p className="text-gray-400 text-sm">Cliente dal {new Date().getFullYear()}</p>
          </div>
        </div>
        
        <Button 
          className="md:ml-auto bg-green-600 hover:bg-green-700 text-white gap-2"
          onClick={openWhatsapp}
        >
          <MessageCircle className="h-4 w-4" />
          Contatta su WhatsApp
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        <Card className="border-0 bg-zinc-900 overflow-hidden">
          <div className="bg-zinc-800 py-3 px-4 border-l-4 border-orange-500">
            <h3 className="flex items-center gap-2 text-white font-medium">
              <User className="h-5 w-5 text-orange-500" />
              Informazioni Personali
            </h3>
          </div>
          <CardContent className="p-5">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white text-base">{clientData.email || "Non specificata"}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Telefono</p>
                  <p className="text-white text-base">{clientData.phone || "Non specificato"}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Data di nascita</p>
                  <p className="text-white text-base">{formattedBirthDate}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sezione Dati Fiscali */}
        <Card className="border-0 bg-zinc-900 overflow-hidden">
          <div className="bg-zinc-800 py-3 px-4 border-l-4 border-blue-500">
            <h3 className="flex items-center gap-2 text-white font-medium">
              {clientData.tipo_cliente === "privato" ? (
                <>
                  <UserCheck className="h-5 w-5 text-blue-500" />
                  Dati Fiscali - Cliente Privato
                </>
              ) : (
                <>
                  <Building2 className="h-5 w-5 text-blue-500" />
                  Dati Fiscali - Azienda
                </>
              )}
            </h3>
          </div>
          <CardContent className="p-5">
            {clientData.tipo_cliente === "privato" ? (
              // VISUALIZZAZIONE PER PRIVATI - Solo Codice Fiscale
              !clientData.cf ? (
                <div className="text-center py-6">
                  <UserCheck className="h-8 w-8 mx-auto mb-3 text-gray-500" />
                  <p className="text-gray-400">Codice Fiscale non registrato</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-6 flex justify-center">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Codice Fiscale</p>
                      <p className="text-white text-base font-mono">{clientData.cf}</p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              // VISUALIZZAZIONE PER AZIENDE - Tutti i dati aziendali
              (!clientData.cf && !clientData.piva && !clientData.sdi && !clientData.pec) ? (
                <div className="text-center py-6">
                  <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-500" />
                  <p className="text-gray-400">Dati fiscali aziendali non registrati</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {clientData.cf && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-6 flex justify-center">
                        <CreditCard className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Codice Fiscale</p>
                        <p className="text-white text-base font-mono">{clientData.cf}</p>
                      </div>
                    </div>
                  )}
                  
                  {clientData.piva && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-6 flex justify-center">
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Partita IVA</p>
                        <p className="text-white text-base font-mono">{clientData.piva}</p>
                      </div>
                    </div>
                  )}
                  
                  {clientData.sdi && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-6 flex justify-center">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Codice SDI</p>
                        <p className="text-white text-base font-mono">{clientData.sdi}</p>
                      </div>
                    </div>
                  )}
                  
                  {clientData.pec && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-6 flex justify-center">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">PEC</p>
                        <p className="text-white text-base break-all">{clientData.pec}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Sezione Garage rivisitata */}
        <Card className="border-0 bg-zinc-900 overflow-hidden">
          <div className="bg-zinc-800 py-3 px-4 border-l-4 border-orange-500">
            <h3 className="flex items-center gap-2 text-white font-medium">
              <Car className="h-5 w-5 text-orange-500" />
              Il mio Garage ({vehicles.length} veicolo{vehicles.length !== 1 ? 'i' : ''})
            </h3>
          </div>
          <CardContent className="p-5">
            {vehicles.length === 0 ? (
              <div className="text-center py-6">
                <Car className="h-8 w-8 mx-auto mb-3 text-gray-500" />
                <p className="text-gray-400">Nessun veicolo registrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                {vehicles.map((vehicle, index) => (
                  <div key={vehicle.id || index} className="border border-zinc-700 rounded-lg p-4 bg-zinc-800/50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-white font-medium">Veicolo {index + 1}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-gray-400" />
                            <span className="text-white font-mono">{vehicle.plate}</span>
                          </div>
                          {vehicle.vin && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-300 text-sm">VIN: {vehicle.vin}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Foto del libretto */}
                      {vehicle.registrationPhotos && vehicle.registrationPhotos.length > 0 && (
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-gray-400">Libretto</span>
                          <div className="relative group">
                            <img 
                              src={vehicle.registrationPhotos[0]}
                              alt="Foto libretto"
                              className="w-16 h-16 object-cover rounded border border-zinc-600 cursor-pointer hover:border-orange-500 transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                viewPhoto(vehicle.registrationPhotos?.[0] || '');
                              }}
                              onError={(e) => {
                                // Gestione errore silenziosa
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 rounded pointer-events-none">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {(!vehicle.registrationPhotos || vehicle.registrationPhotos.length === 0) && (
                      <div className="text-center py-2">
                        <p className="text-gray-500 text-sm">Nessuna foto del libretto disponibile</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8 p-4 bg-zinc-800/50 border border-zinc-700 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <p className="text-gray-300 text-sm">
              I tuoi dati sono visibili solo a te e all'amministratore dell'officina.
            </p>
          </div>
        </div>
      </div>
      
      {/* Modal per visualizzare la foto del libretto */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9998]"
          onClick={closePhotoViewer}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizzazione foto libretto"
          style={{ zIndex: 9998 }}
        >
          <div className="relative max-w-4xl max-h-4xl w-full h-full flex items-center justify-center p-4">
            <img 
              src={viewingPhoto}
              alt="Foto libretto ingrandita"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                toast({
                  title: "Errore",
                  description: "Impossibile caricare la foto del libretto",
                  variant: "destructive",
                });
                closePhotoViewer();
              }}
            />
            <button
              onClick={closePhotoViewer}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white text-black p-3 rounded-full transition-colors shadow-lg"
              title="Chiudi"
              aria-label="Chiudi visualizzazione foto"
              autoFocus
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 