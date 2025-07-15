// Usiamo l'approccio REST API di Firebase invece di Admin SDK per semplicità
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  console.log("=== GET-REQUESTS CHIAMATO ===");
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };
  
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    // Recupera tutte le richieste da Supabase
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Mappa i dati in camelCase per il frontend
    const requests = (data || []).map(r => ({
      id: r.id,
      nome: r.nome,
      cognome: r.cognome,
      email: r.email,
      telefono: r.telefono,
      targa: r.targa,
      dataNascita: r.data_nascita,
      note: r.note,
      coupon: r.coupon,
      tipoRichiesta: r.tipo_richiesta,
      dataAppuntamento: r.data_appuntamento,
      oraAppuntamento: r.ora_appuntamento,
      preferenzaOrario: r.preferenza_orario,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
      ipAddress: r.ip_address,
      userAgent: r.user_agent
    }));
    
    console.log(`Trovate ${requests.length} richieste in Supabase`);
    
    // Ordina per data di creazione (più recenti prima)
    requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(requests)
    };

  } catch (error) {
    console.error("Errore nel recupero delle richieste:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message
      })
    };
  }
}; 