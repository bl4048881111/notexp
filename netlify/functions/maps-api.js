exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { center, zoom, size, markers } = event.queryStringParameters || {};
    
    // Parametri di default
    const mapCenter = center || '40.953056,17.308611';
    const mapZoom = zoom || '9';
    const mapSize = size || '600x600';
    const mapMarkers = markers || 'color:red%7Csize:large%7C40.953056,17.308611';
    
    // Chiave API nascosta nel backend
    const GOOGLE_MAPS_API_KEY = 'AIzaSyDKAmUTHlqpMC_v5ENQWwRsNGVMFf78zwI';
    
    // Costruzione URL per Google Static Maps API
    const mapsUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${mapCenter}&zoom=${mapZoom}&size=${mapSize}&markers=${mapMarkers}&key=${GOOGLE_MAPS_API_KEY}`;
    
    // Restituiamo l'URL della mappa senza esporre la chiave API
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        mapUrl: mapsUrl,
        message: 'URL mappa generato con successo'
      })
    };

  } catch (error) {
    console.error('Maps API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Errore interno del server',
        message: 'Impossibile generare la mappa'
      })
    };
  }
}; 