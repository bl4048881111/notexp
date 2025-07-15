// Usiamo l'approccio REST API di Firebase invece di Admin SDK per semplicità
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Gestisci richieste OPTIONS per CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "PUT, OPTIONS"
      },
      body: ''
    };
  }

  // Solo metodo PUT consentito
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "PUT, OPTIONS"
      },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    console.log('Evento ricevuto:', JSON.stringify({
      httpMethod: event.httpMethod,
      queryStringParameters: event.queryStringParameters,
      body: event.body
    }));

    // Estrai l'ID della richiesta dai query parameters
    const requestId = event.queryStringParameters?.id;
    
    if (!requestId) {
      console.error('ID richiesta mancante');
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          success: false, 
          error: "ID richiesta mancante" 
        })
      };
    }

    // Parse del body per ottenere i dati da aggiornare
    let updateData;
    try {
      updateData = JSON.parse(event.body || '{}');
      console.log('Dati da aggiornare:', updateData);
    } catch (error) {
      console.error('Errore parsing body:', error);
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          success: false, 
          error: "Dati di aggiornamento non validi" 
        })
      };
    }

    // Mappa i campi camelCase in snake_case per Supabase
    const mapToSnakeCase = obj => {
      const map = {
        dataNascita: 'data_nascita',
        tipoRichiesta: 'tipo_richiesta',
        dataAppuntamento: 'data_appuntamento',
        oraAppuntamento: 'ora_appuntamento',
        preferenzaOrario: 'preferenza_orario',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      };
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [map[k] || k, v]));
    };
    const updateDataDb = mapToSnakeCase(updateData);
    console.log('Dati mappati per DB:', updateDataDb);

    // Aggiorna la richiesta su Supabase
    const { error, data } = await supabase
      .from('requests')
      .update(updateDataDb)
      .eq('id', requestId)
      .select()
      .single();
    
    if (error) {
      console.error('Errore Supabase:', error);
      throw error;
    }
    
    console.log('Aggiornamento riuscito:', data);
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        success: true, 
        message: "Richiesta aggiornata con successo",
        data
      })
    };

  } catch (error) {
    console.error("Errore nell'aggiornamento della richiesta:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || "Errore interno del server"
      })
    };
  }
}; 