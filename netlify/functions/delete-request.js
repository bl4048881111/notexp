// Usiamo l'approccio REST API di Firebase invece di Admin SDK per semplicità
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Solo metodo DELETE consentito
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS"
      },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    // Estrai l'ID della richiesta dai query parameters
    const requestId = event.queryStringParameters?.id;
    
    if (!requestId) {
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

    // Elimina la richiesta da Supabase
    const { error, count } = await supabase
      .from('requests')
      .delete({ count: 'exact' })
      .eq('id', requestId);
    if (error) throw error;
    if (count === 0) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ 
          success: false, 
          error: "Richiesta non trovata" 
        })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        success: true, 
        message: "Richiesta eliminata con successo",
        deletedId: requestId
      })
    };

  } catch (error) {
    console.error("Errore nell'eliminazione della richiesta:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message
      })
    };
  }
}; 