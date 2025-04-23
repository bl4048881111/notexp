// Servizio per la ricerca di informazioni sui veicoli tramite targa
const API_TOKEN = "cec4d64fe1564b9ea9c98ab4b0bc914c";
const API_BASE_URL = "https://api.sagcloud.net";

interface VehicleLookupResponse {
  vehicleNumber?: string;
  error?: string;
}

interface VehicleDetails {
  make?: {
    name: string;
  };
  model?: {
    descriptions: {
      value: string;
    }[];
  };
  power_hp?: number;
  power_kw?: number;
  built_year_from?: number;
  vehicle_type?: string;
  vin?: string;
  error?: string;
}

/**
 * Cerca un veicolo tramite la targa
 * @param plate Targa del veicolo
 * @param country Codice paese (default: 'it')
 * @returns Dettagli del veicolo o errore
 */
export async function lookupVehicleByPlate(plate: string, country: string = 'it'): Promise<VehicleDetails | null> {
  try {
    // Prima chiamata: Ottieni il vehicleNumber dalla targa
    const lookupResponse = await fetch(`${API_BASE_URL}/vrmlookupservice?identifier=${encodeURIComponent(plate)}&country=${encodeURIComponent(country)}`, {
      method: 'GET',
      headers: {
        'Token': API_TOKEN,
        'User-Agent': 'VehicleLookupSystem/1.0'
      }
    });
    
    if (!lookupResponse.ok) {
      console.error('Errore nella ricerca della targa:', await lookupResponse.text());
      return null;
    }
    
    const lookupData = await lookupResponse.json() as VehicleLookupResponse;
    
    if (lookupData.error || !lookupData.vehicleNumber) {
      console.error('Errore nella risposta:', lookupData.error || 'Vehicle number non trovato');
      return null;
    }
    
    // Seconda chiamata: Ottieni i dettagli del veicolo dal vehicleNumber
    const vehicleNumber = lookupData.vehicleNumber;
    const detailsResponse = await fetch(`${API_BASE_URL}/vehicleservice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': API_TOKEN,
        'User-Agent': 'VehicleLookupSystem/1.0'
      },
      body: JSON.stringify({
        "operationName": "GetVehicleByVehicleNumber",
        "variables": {
          "vehicleNumber": vehicleNumber,
          "language": country.toUpperCase()
        },
        "query": `
          query GetVehicleByVehicleNumber($language: String, $vehicleNumber: String!) {
            getVehicleByVehicleNumber(language: $language, vehicle_number: $vehicleNumber) {
              id_vehicle
              make_id
              model_id
              make {
                name
                __typename
              }
              model {
                descriptions {
                  value
                  __typename
                }
                __typename
              }
              vehicle_type
              vehicle_number
              names {
                country
                value
                __typename
              }
              built_year_from
              built_year_till
              power_kw
              power_hp
              vin
              __typename
            }
          }
        `
      })
    });
    
    if (!detailsResponse.ok) {
      console.error('Errore nel recupero dei dettagli del veicolo:', await detailsResponse.text());
      return null;
    }
    
    const responseData = await detailsResponse.json();
    const vehicleDetails = responseData.data?.getVehicleByVehicleNumber;
    
    if (!vehicleDetails) {
      console.error('Dettagli veicolo non trovati');
      return null;
    }
    
    return vehicleDetails;
  } catch (error) {
    console.error('Errore durante la ricerca del veicolo:', error);
    return null;
  }
}

/**
 * Formatta i dettagli del veicolo in un formato leggibile
 * @param vehicleDetails Dettagli del veicolo
 * @returns Oggetto con i dettagli formattati
 */
export function formatVehicleDetails(vehicleDetails: VehicleDetails | null): { 
  make: string; 
  model: string;
  fullModel: string;
  year: string;
  power: string;
} {
  if (!vehicleDetails) {
    return {
      make: '',
      model: '',
      fullModel: '',
      year: '',
      power: ''
    };
  }
  
  const make = vehicleDetails.make?.name || '';
  const modelDescription = vehicleDetails.model?.descriptions?.[0]?.value || '';
  const year = vehicleDetails.built_year_from ? `${vehicleDetails.built_year_from}` : '';
  const powerHP = vehicleDetails.power_hp ? `${vehicleDetails.power_hp} CV` : '';
  const powerKW = vehicleDetails.power_kw ? `${vehicleDetails.power_kw} kW` : '';
  const power = powerHP && powerKW ? `${powerHP} (${powerKW})` : powerHP || powerKW;
  
  // Estrai il modello dalla descrizione completa (solitamente è la prima parola)
  let modelName = '';
  if (modelDescription) {
    const parts = modelDescription.split(' ');
    if (parts.length > 0) {
      modelName = parts[0];
    }
  }
  
  return {
    make,
    model: modelName,
    fullModel: modelDescription,
    year,
    power
  };
}