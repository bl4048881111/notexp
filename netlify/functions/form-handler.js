const nodemailer = require('nodemailer');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get } = require('firebase/database');

// Configurazione Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBpnaDC7D95qeXHp2xh4z-8RRc8Tz4LpFM",
  authDomain: "autoexpress-142e1.firebaseapp.com",
  databaseURL: "https://autoexpress-142e1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "autoexpress-142e1",
  storageBucket: "autoexpress-142e1.appspot.com",
  messagingSenderId: "1086934965058",
  appId: "1:1086934965058:web:3e72fcce8b73ab40ae3c1f"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

exports.handler = async (event, context) => {
  console.log("Webhook Netlify Forms chiamato con metodo:", event.httpMethod);
  
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    console.log("Headers ricevuti:", event.headers);
    console.log("Body ricevuto:", event.body);
    
    // Parse dei dati del form da Netlify
    let formData;
    
    // Netlify invia i dati in formato URL-encoded
    if (event.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(event.body);
      formData = {};
      for (const [key, value] of params) {
        formData[key] = value;
      }
    } else {
      // Fallback per JSON
      formData = JSON.parse(event.body);
    }
    
    console.log("Form data parsato:", formData);
    
    // Ottieni l'IP dell'utente
    const userIP = event.headers['x-forwarded-for'] || 
                   event.headers['x-real-ip'] || 
                   event.headers['client-ip'] || 
                   context.clientContext?.ip || 
                   'IP non disponibile';
    
    console.log("IP utente:", userIP);

    // Determina il tipo di richiesta
    const tipoRichiesta = formData["tipo-richiesta"] || "preventivo";
    const formName = formData["form-name"];
    
    console.log("Tipo richiesta:", tipoRichiesta);
    console.log("Form name:", formName);
    
    // Prepara i dati formattati per il log
    const formattedData = {
      tipo_richiesta: tipoRichiesta === "preventivo" ? "PREVENTIVO GRATUITO" : "CHECKUP COMPLETO",
      nome_cognome: `${formData.nome || ""} ${formData.cognome || ""}`,
      email: formData.email || "Non specificata",
      telefono: formData.telefono || "Non specificato",
      targa: formData.targa || "Non specificata",
      data_nascita: formData["data-nascita"] || "Non specificata",
      note: formData.note || "Nessuna nota aggiuntiva",
      ip_address: userIP,
      captcha: `${formData["captcha-challenge"] || "N/A"} = ${formData["captcha-result"] || "N/A"}`,
      privacy_policy: formData["privacy-policy"] === "true" ? "Accettata" : "Non accettata",
      timestamp: new Date().toLocaleString('it-IT')
    };
    
    // Aggiungi dettagli appuntamento se è un checkup
    if (formName === "richiesta-checkup") {
      formattedData.data_appuntamento = formData["data-appuntamento"] || "Non specificata";
      formattedData.preferenza_orario = formData["preferenza-orario"] === "mattina" ? "Mattina (9:00-13:00)" : 
                                       formData["preferenza-orario"] === "pomeriggio" ? "Pomeriggio (14:00-18:00)" : 
                                       "Non specificata";
    }
    
    console.log("=== NUOVA RICHIESTA FORM ===");
    console.log("Dati formattati:", JSON.stringify(formattedData, null, 2));
    console.log("=== FINE RICHIESTA ===");

    // Invia email di notifica
    try {
      await sendEmailNotification(formattedData, tipoRichiesta);
      console.log("Email inviata con successo");
    } catch (emailError) {
      console.error("Errore nell'invio email:", emailError);
      // Non bloccare la risposta se l'email fallisce
    }

    // Salva la richiesta nel database Firebase
    try {
      await saveRequestToDatabase(formData, userIP, event.headers['user-agent']);
      console.log("Richiesta salvata nel database con successo");
    } catch (dbError) {
      console.error("Errore nel salvataggio database:", dbError);
      // Non bloccare la risposta se il database fallisce
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: "Webhook ricevuto correttamente",
        data: formattedData
      })
    };

  } catch (error) {
    console.error("Errore nel webhook:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

async function sendEmailNotification(data, tipoRichiesta) {
  // Configurazione SMTP Register.it
  const transporter = nodemailer.createTransporter({
    host: 'smtps.register.it',
    port: 465,
    secure: true, // true per 465, false per altri port
    auth: {
      user: 'web@autoexpressadservice.it',
      pass: '@utwe0Xprb3$$'
    }
  });

  const isCheckup = tipoRichiesta === "checkup";
  const subject = isCheckup ? 
    `🔧 Nuova Richiesta Checkup - ${data.nome_cognome}` : 
    `💰 Nuova Richiesta Preventivo - ${data.nome_cognome}`;

  // Template HTML migliorato
  let emailBodyHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
            ${isCheckup ? '🔧 NUOVA RICHIESTA CHECKUP' : '💰 NUOVA RICHIESTA PREVENTIVO'}
          </h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">
            Ricevuta il ${data.timestamp}
          </p>
        </div>
        
        <!-- Contenuto principale -->
        <div style="padding: 30px 20px;">
          
          <!-- Dati Cliente -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #ea580c; font-size: 18px; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #ea580c;">
              👤 DATI CLIENTE
            </h2>
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 35%;">Nome Completo:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${data.nome_cognome}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Email:</td>
                  <td style="padding: 8px 0; color: #111827;">
                    <a href="mailto:${data.email}" style="color: #ea580c; text-decoration: none;">${data.email}</a>
                  </td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Telefono:</td>
                  <td style="padding: 8px 0; color: #111827;">
                    <a href="tel:${data.telefono}" style="color: #ea580c; text-decoration: none;">${data.telefono}</a>
                  </td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Targa Veicolo:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: uppercase;">${data.targa}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Data di Nascita:</td>
                  <td style="padding: 8px 0; color: #111827;">${data.data_nascita}</td>
                </tr>
              </table>
            </div>
          </div>`;

  // Aggiungi sezione appuntamento per checkup
  if (isCheckup) {
    emailBodyHtml += `
          <!-- Dettagli Appuntamento -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #ea580c; font-size: 18px; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #ea580c;">
              📅 DETTAGLI APPUNTAMENTO
            </h2>
            <div style="background: #fef3c7; border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 35%;">Data Preferita:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${data.data_appuntamento}</td>
                </tr>
                <tr style="border-top: 1px solid #fbbf24;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Fascia Oraria:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${data.preferenza_orario}</td>
                </tr>
              </table>
            </div>
          </div>`;
  }

  emailBodyHtml += `
          <!-- Note -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #ea580c; font-size: 18px; margin: 0 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #ea580c;">
              📝 NOTE AGGIUNTIVE
            </h2>
            <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; border-left: 4px solid #0ea5e9; min-height: 60px;">
              <p style="margin: 0; color: #111827; line-height: 1.6; font-style: ${data.note === 'Nessuna nota aggiuntiva' ? 'italic' : 'normal'};">
                ${data.note}
              </p>
            </div>
          </div>
          
          <!-- Informazioni Tecniche -->
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
            <h3 style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
              Informazioni Tecniche
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 4px 0; color: #6b7280; width: 35%;">Privacy Policy:</td>
                <td style="padding: 4px 0; color: #111827;">${data.privacy_policy}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6b7280;">IP Address:</td>
                <td style="padding: 4px 0; color: #111827; font-family: monospace;">${data.ip_address}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6b7280;">Captcha:</td>
                <td style="padding: 4px 0; color: #111827; font-family: monospace;">${data.captcha}</td>
              </tr>
            </table>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div style="background: #111827; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px; opacity: 0.8;">
            AutoExpress Service - Sistema di Gestione Richieste
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.6;">
            Questa email è stata generata automaticamente
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;

  // Versione testo semplice come fallback
  let emailBodyText = `
═══════════════════════════════════════════════════════════════
${isCheckup ? '🔧 NUOVA RICHIESTA CHECKUP' : '💰 NUOVA RICHIESTA PREVENTIVO'}
═══════════════════════════════════════════════════════════════

📅 RICEVUTA IL: ${data.timestamp}

👤 DATI CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Nome Completo: ${data.nome_cognome}
• Email: ${data.email}
• Telefono: ${data.telefono}
• Targa Veicolo: ${data.targa}
• Data di Nascita: ${data.data_nascita}
`;

  if (isCheckup) {
    emailBodyText += `
📅 DETTAGLI APPUNTAMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Data Preferita: ${data.data_appuntamento}
• Fascia Oraria: ${data.preferenza_orario}
`;
  }

  emailBodyText += `
📝 NOTE AGGIUNTIVE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${data.note}

🔧 INFORMAZIONI TECNICHE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Privacy Policy: ${data.privacy_policy}
• IP Address: ${data.ip_address}
• Captcha: ${data.captcha}

═══════════════════════════════════════════════════════════════
AutoExpress Service - Sistema di Gestione Richieste
Questa email è stata generata automaticamente
═══════════════════════════════════════════════════════════════
  `;

  const mailOptions = {
    from: 'AutoExpress Service <web@autoexpressadservice.it>',
    to: 'autoexpressadservice@gmail.com',
    subject: subject,
    html: emailBodyHtml,
    text: emailBodyText // Fallback per client che non supportano HTML
  };

  await transporter.sendMail(mailOptions);
}

async function saveRequestToDatabase(formData, ipAddress, userAgent) {
  try {
    // Get next request ID
    const counterRef = ref(database, 'counters/requestId');
    const counterSnapshot = await get(counterRef);
    const nextId = (counterSnapshot.exists() ? counterSnapshot.val() : 0) + 1;
    
    // Format request ID with leading zeros
    const requestId = `RQ${nextId.toString().padStart(3, '0')}`;
    
    // Prepara i dati della richiesta
    const requestData = {
      id: requestId,
      nome: formData.nome || '',
      cognome: formData.cognome || '',
      email: formData.email || '',
      telefono: formData.telefono || '',
      targa: formData.targa || '',
      dataNascita: formData["data-nascita"] || '',
      note: formData.note || '',
      tipoRichiesta: formData["tipo-richiesta"] || 'preventivo',
      dataAppuntamento: formData["data-appuntamento"] || '',
      oraAppuntamento: formData["ora-appuntamento"] || '',
      preferenzaOrario: formData["preferenza-orario"] || '',
      status: 'ricevuta',
      createdAt: Date.now(),
      ipAddress: ipAddress,
      userAgent: userAgent || ''
    };
    
    // Salva la richiesta nel database
    const requestRef = ref(database, `requests/${requestId}`);
    await set(requestRef, requestData);
    
    // Aggiorna il contatore
    await set(counterRef, nextId);
    
    console.log(`Richiesta ${requestId} salvata nel database`);
    return requestId;
  } catch (error) {
    console.error('Errore nel salvataggio della richiesta:', error);
    throw error;
  }
}