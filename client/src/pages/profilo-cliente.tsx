import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { clientService } from "../services/clientService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Car, User, Phone, Mail, Calendar, CreditCard, FileText, MessageCircle } from "lucide-react";

export default function ProfiloClientePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientData, setClientData] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    birthDate: "",
    plate: "",
    vin: ""
  });
  const [loadingData, setLoadingData] = useState(true);

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
            vin: client.vin || ""
          });
        }
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user?.clientId]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <Card className="border-0 bg-zinc-900 overflow-hidden">
          <div className="bg-zinc-800 py-3 px-4 border-l-4 border-orange-500">
            <h3 className="flex items-center gap-2 text-white font-medium">
              <Car className="h-5 w-5 text-orange-500" />
              Dati Veicolo
            </h3>
          </div>
          <CardContent className="p-5">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Targa</p>
                  <p className="text-white text-base">{clientData.plate || "Non specificata"}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Codice VIN</p>
                  <p className="text-white text-base break-all">{clientData.vin || "Non specificato"}</p>
                </div>
              </div>
            </div>
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
    </div>
  );
} 