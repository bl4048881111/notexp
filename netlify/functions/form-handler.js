// Usiamo l'approccio REST API di Firebase invece di Admin SDK per semplicità
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createRequest(request) {
  // Recupera il prossimo ID
  const { data: counterData, error: counterError } = await supabase
    .from('counters')
    .select('value')
    .eq('name', 'requestId')
    .single();
  if (counterError) throw counterError;
  const nextId = (counterData?.value || 0) + 1;
  const requestId = `RQ${nextId.toString().padStart(3, '0')}`;
  // Mappa i campi camelCase ai campi snake_case del database
  const requestForDb = {
    id: requestId,
    nome: request.nome,
    cognome: request.cognome,
    email: request.email,
    telefono: request.telefono,
    targa: request.targa,
    data_nascita: request.dataNascita,
    note: request.note,
    coupon: request.coupon,
    tipo_richiesta: request.tipoRichiesta,
    data_appuntamento: request.dataAppuntamento,
    ora_appuntamento: request.oraAppuntamento,
    preferenza_orario: request.preferenzaOrario,
    status: request.status || 'ricevuta',
    ip_address: request.ipAddress,
    user_agent: request.userAgent
  };
  const { data, error } = await supabase
    .from('requests')
    .insert([requestForDb])
    .select()
    .single();
  if (error) throw error;
  await supabase
    .from('counters')
    .update({ value: nextId })
    .eq('name', 'requestId');
  return {
    id: data.id,
    nome: data.nome,
    cognome: data.cognome,
    email: data.email,
    telefono: data.telefono,
    targa: data.targa,
    dataNascita: data.data_nascita,
    note: data.note,
    coupon: data.coupon,
    tipoRichiesta: data.tipo_richiesta,
    dataAppuntamento: data.data_appuntamento,
    oraAppuntamento: data.ora_appuntamento,
    preferenzaOrario: data.preferenza_orario,
    status: data.status,
    createdAt: new Date(data.created_at).getTime(),
    ipAddress: data.ip_address,
    userAgent: data.user_agent
  };
}

exports.handler = async (event, context) => {
  // Gestisci richieste OPTIONS per CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  try {
    console.log("=== FORM-HANDLER CHIAMATO ===");
    console.log("Method:", event.httpMethod);
    console.log("Body:", event.body);
    
    // Verifica che il body non sia vuoto
    if (!event.body) {
      throw new Error("Body della richiesta vuoto");
    }
    
    // Parse form data
    const formData = new URLSearchParams(event.body);
    const data = Object.fromEntries(formData);
    
    console.log("Dati parsati:", data);
    
    // Verifica che almeno nome ed email siano presenti
    if (!data.nome && !data.cognome && !data.email) {
      throw new Error("Dati essenziali mancanti (nome, cognome, email)");
    }
    
    // Estrai i dati dal form
    const {
      nome,
      cognome,
      email,
      telefono,
      targa,
      'data-nascita': dataNascita,
      note,
      'tipo-richiesta': tipoRichiesta,
      'captcha-challenge': captchaChallenge,
      'captcha-result': captchaResult,
      'privacy-policy': privacyPolicy,
      coupon
    } = data;
    
    // Ottieni l'IP dell'utente (solo il primo IP, massimo 45 caratteri)
    const userIP = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
                   event.headers['x-real-ip'] ||
                   event.headers['client-ip'] ||
                   context.clientContext?.ip ||
                   'IP non disponibile';

    // Determina il tipo di richiesta
    const formName = data["form-name"];
    
    // Prepara i dati formattati per il salvataggio
    const formattedData = {
      nome: data.nome || '',
      cognome: data.cognome || '',
      email: data.email || '',
      telefono: data.telefono || '',
      targa: data.targa || '',
      dataNascita: dataNascita || '',
      note: data.note || '',
      coupon: data.coupon || '',
      tipoRichiesta: tipoRichiesta || 'preventivo',
      status: 'ricevuta',
      createdAt: Date.now(),
      ipAddress: userIP,
      userAgent: event.headers['user-agent'] || 'Unknown',
      dataAppuntamento: data["data-appuntamento"] || undefined,
      oraAppuntamento: data["ora-appuntamento"] || undefined,
      preferenzaOrario: data["preferenza-orario"] || undefined
    };
    
    // Aggiungi dettagli appuntamento se è un checkup
    if (formName === "richiesta-checkup") {
      formattedData.dataAppuntamento = data["data-appuntamento"] || "Non specificata";
      formattedData.oraAppuntamento = data["ora-appuntamento"] || "Non specificata";
      formattedData.preferenzaOrario = data["preferenza-orario"] === "mattina" ? "Mattina (9:00-13:00)" : 
                                       data["preferenza-orario"] === "pomeriggio" ? "Pomeriggio (14:00-18:00)" : 
                                       "Non specificata";
    }
    
    console.log("Dati formattati:", formattedData);
    
    // Salva usando Supabase
    try {
      const savedRequest = await createRequest(formattedData);
      console.log("Salvataggio completato con successo, ID:", savedRequest.id);
      formattedData.id = savedRequest.id;
    } catch (saveError) {
      console.error("Errore nel salvataggio:", saveError);
      throw saveError;
    }

    // Invia email di notifica (non bloccare se fallisce)
    try {
      await sendEmailNotification(formattedData);
      console.log("Email di notifica inviata con successo");
    } catch (emailError) {
      console.error("Errore nell'invio email (non bloccante):", emailError);
      // Non lanciare l'errore, continua comunque
    }

    // Log dettagliato per le notifiche Netlify
    const tipoRichiestaLog = formattedData.tipoRichiesta === 'checkup' ? 'Checkup' : 'Preventivo';
    console.log(`🚗 NUOVA RICHIESTA ${tipoRichiestaLog.toUpperCase()}: ${formattedData.nome} ${formattedData.cognome} (${formattedData.email}) - ID: ${formattedData.id}`);
    
    if (formattedData.telefono) {
      console.log(`📞 Telefono: ${formattedData.telefono}`);
    }
    
    if (formattedData.targa) {
      console.log(`🚗 Targa: ${formattedData.targa}`);
    }
    
    if (formattedData.dataAppuntamento) {
      console.log(`📅 Appuntamento richiesto: ${formattedData.dataAppuntamento} ${formattedData.oraAppuntamento} (${formattedData.preferenzaOrario})`);
    }
    
    if (formattedData.note) {
      console.log(`📝 Note: ${formattedData.note}`);
    }

    const response = {
      success: true, 
      message: "Richiesta ricevuta e salvata correttamente",
      data: formattedData
    };

    console.log("Risposta:", response);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error("Errore nel webhook:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

async function sendEmailNotification(requestData) {
  console.log("=== INIZIO INVIO EMAIL ===");
  
  // Configurazione SMTP usando variabili d'ambiente
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtps.register.it',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true, // true per 465 (SSL), false per 587 (TLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Verifica configurazione SMTP
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Configurazione SMTP mancante (SMTP_USER o SMTP_PASS)");
  }

  const tipoRichiesta = requestData.tipoRichiesta === 'checkup' ? 'Checkup' : 'Preventivo';
  const nomeCompleto = `${requestData.nome} ${requestData.cognome}`.trim();
  
  // Crea contenuto email HTML
  let emailHTML = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        🚗 Nuova Richiesta ${tipoRichiesta}
      </h2>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #1e40af; margin-top: 0;">Informazioni Cliente</h3>
        <p><strong>Nome:</strong> ${nomeCompleto || 'Non specificato'}</p>
        <p><strong>Email:</strong> ${requestData.email || 'Non specificata'}</p>
        <p><strong>Telefono:</strong> ${requestData.telefono || 'Non specificato'}</p>
        <p><strong>Targa:</strong> ${requestData.targa || 'Non specificata'}</p>
        ${requestData.dataNascita ? `<p><strong>Data di Nascita:</strong> ${requestData.dataNascita}</p>` : ''}
      </div>
  `;

  // Aggiungi dettagli specifici per checkup
  if (requestData.tipoRichiesta === 'checkup' && requestData.dataAppuntamento && requestData.dataAppuntamento !== 'Non specificata') {
    emailHTML += `
      <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
        <h3 style="color: #047857; margin-top: 0;">📅 Dettagli Appuntamento</h3>
        <p><strong>Data richiesta:</strong> ${requestData.dataAppuntamento}</p>
        ${requestData.oraAppuntamento && requestData.oraAppuntamento !== 'Non specificata' ? 
          `<p><strong>Ora:</strong> ${requestData.oraAppuntamento}</p>` : ''}
        ${requestData.preferenzaOrario && requestData.preferenzaOrario !== 'Non specificata' ? 
          `<p><strong>Preferenza orario:</strong> ${requestData.preferenzaOrario}</p>` : ''}
      </div>
    `;
  }

  // Aggiungi note se presenti
  if (requestData.note && requestData.note.trim()) {
    emailHTML += `
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #92400e; margin-top: 0;">📝 Note</h3>
        <p style="white-space: pre-wrap;">${requestData.note}</p>
      </div>
    `;
  }

  // Aggiungi informazioni tecniche
  emailHTML += `
    <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 12px; color: #64748b;">
      <h4 style="margin-top: 0; color: #475569;">Informazioni Tecniche</h4>
      <p><strong>ID Richiesta:</strong> ${requestData.id}</p>
      <p><strong>Data/Ora:</strong> ${new Date(requestData.createdAt).toLocaleString('it-IT')}</p>
      <p><strong>IP Address:</strong> ${requestData.ipAddress}</p>
      <p><strong>User Agent:</strong> ${requestData.userAgent}</p>
    </div>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 12px;">
        Questa email è stata generata automaticamente dal sistema AutoExpress
      </p>
    </div>
  </div>
  `;

  const mailOptions = {
    from: `"AutoExpress Sistema" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER, // Invia a te stesso
    subject: `🚗 Nuova Richiesta ${tipoRichiesta} - ${nomeCompleto}`,
    html: emailHTML,
    text: `
Nuova richiesta ${tipoRichiesta} ricevuta:

Cliente: ${nomeCompleto}
Email: ${requestData.email}
Telefono: ${requestData.telefono}
Targa: ${requestData.targa}
${requestData.dataNascita ? `Data di Nascita: ${requestData.dataNascita}` : ''}

${requestData.tipoRichiesta === 'checkup' && requestData.dataAppuntamento !== 'Non specificata' ? 
  `Appuntamento: ${requestData.dataAppuntamento} ${requestData.oraAppuntamento} (${requestData.preferenzaOrario})` : ''}

${requestData.note ? `Note: ${requestData.note}` : ''}

ID: ${requestData.id}
Data: ${new Date(requestData.createdAt).toLocaleString('it-IT')}
IP: ${requestData.ipAddress}
    `.trim()
  };

  console.log("Invio email a:", process.env.SMTP_USER);
  await transporter.sendMail(mailOptions);
  console.log("=== EMAIL INVIATA CON SUCCESSO ===");
}