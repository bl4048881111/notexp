const nodemailer = require("nodemailer");

exports.handler = async (event, context) => {
  console.log("Webhook chiamato:", event.httpMethod);
  
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    // Parse dei dati del webhook
    const data = JSON.parse(event.body);
    console.log("Dati ricevuti:", data);

    // Estrai l'IP del mittente
    const clientIP = event.headers['x-forwarded-for'] || 
                     event.headers['x-real-ip'] || 
                     event.headers['client-ip'] || 
                     context.clientContext?.ip || 
                     'IP non disponibile';
    
    console.log("IP del mittente:", clientIP);

    // Configura il trasport SMTP
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Estrai i dati del form
    const formName = data.form_name;
    const formData = data.data;
    
    // Determina il tipo di richiesta
    const isCheckup = formName === "richiesta-checkup";
    const tipoRichiesta = isCheckup ? "CHECKUP COMPLETO" : "PREVENTIVO GRATUITO";
    
    // Prepara oggetto email
    const emailSubject = isCheckup ? 
      `🔧 Nuova Richiesta Checkup - ${formData.nome || ""} ${formData.cognome || ""}` : 
      `💰 Nuova Richiesta Preventivo - ${formData.nome || ""} ${formData.cognome || ""}`;

    // Prepara i dati formattati
    const formattedData = {
      tipo_richiesta: tipoRichiesta,
      nome_cognome: `${formData.nome || ""} ${formData.cognome || ""}`,
      email: formData.email || "Non specificata",
      telefono: formData.telefono || "Non specificato",
      targa: formData.targa || "Non specificata",
      data_nascita: formData["data-nascita"] || "Non specificata",
      note: formData.note || "Nessuna nota aggiuntiva",
      ip_address: clientIP,
      captcha: `${formData["captcha-challenge"] || "N/A"} = ${formData["captcha-result"] || "N/A"}`,
      privacy_policy: formData["privacy-policy"] === "accettata" ? "Accettata" : "Non accettata",
      timestamp: new Date().toLocaleString('it-IT')
    };
    
    // Aggiungi dettagli appuntamento se è un checkup
    if (isCheckup) {
      formattedData.data_appuntamento = formData["data-appuntamento"] || "Non specificata";
      formattedData.preferenza_orario = formData["preferenza-orario"] === "mattina" ? "Mattina (9:00-13:00)" : 
                                       formData["preferenza-orario"] === "pomeriggio" ? "Pomeriggio (14:00-18:00)" : 
                                       "Non specificata";
    }

    // Template HTML migliorato
    let emailBodyHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailSubject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
            ${isCheckup ? '🔧 NUOVA RICHIESTA CHECKUP' : '💰 NUOVA RICHIESTA PREVENTIVO'}
          </h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">
            Ricevuta il ${formattedData.timestamp}
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
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${formattedData.nome_cognome}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Email:</td>
                  <td style="padding: 8px 0; color: #111827;">
                    <a href="mailto:${formattedData.email}" style="color: #ea580c; text-decoration: none;">${formattedData.email}</a>
                  </td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Telefono:</td>
                  <td style="padding: 8px 0; color: #111827;">
                    <a href="tel:${formattedData.telefono}" style="color: #ea580c; text-decoration: none;">${formattedData.telefono}</a>
                  </td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Targa Veicolo:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: uppercase;">${formattedData.targa}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Data di Nascita:</td>
                  <td style="padding: 8px 0; color: #111827;">${formattedData.data_nascita}</td>
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
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${formattedData.data_appuntamento}</td>
                </tr>
                <tr style="border-top: 1px solid #fbbf24;">
                  <td style="padding: 8px 0; font-weight: 600; color: #374151;">Fascia Oraria:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${formattedData.preferenza_orario}</td>
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
              <p style="margin: 0; color: #111827; line-height: 1.6; font-style: ${formattedData.note === 'Nessuna nota aggiuntiva' ? 'italic' : 'normal'};">
                ${formattedData.note}
              </p>
            </div>
          </div>
          
          <!-- Informazioni Tecniche -->
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
            <h3 style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
              🔧 Informazioni Tecniche
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 4px 0; color: #6b7280; width: 35%;">Privacy Policy:</td>
                <td style="padding: 4px 0; color: #111827;">${formattedData.privacy_policy}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6b7280;">IP Address:</td>
                <td style="padding: 4px 0; color: #111827; font-family: monospace;">${formattedData.ip_address}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6b7280;">Captcha:</td>
                <td style="padding: 4px 0; color: #111827; font-family: monospace;">${formattedData.captcha}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6b7280;">User Agent:</td>
                <td style="padding: 4px 0; color: #111827; font-family: monospace; font-size: 10px;">${event.headers['user-agent'] || 'Non disponibile'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6b7280;">Sito:</td>
                <td style="padding: 4px 0; color: #111827;">${data.site_url || 'Non disponibile'}</td>
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
            Questa email è stata generata automaticamente da Netlify Forms
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

📅 RICEVUTA IL: ${formattedData.timestamp}

👤 DATI CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Nome Completo: ${formattedData.nome_cognome}
• Email: ${formattedData.email}
• Telefono: ${formattedData.telefono}
• Targa Veicolo: ${formattedData.targa}
• Data di Nascita: ${formattedData.data_nascita}
`;

    if (isCheckup) {
      emailBodyText += `
📅 DETTAGLI APPUNTAMENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Data Preferita: ${formattedData.data_appuntamento}
• Fascia Oraria: ${formattedData.preferenza_orario}
`;
    }

    emailBodyText += `
📝 NOTE AGGIUNTIVE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formattedData.note}

🔧 INFORMAZIONI TECNICHE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Privacy Policy: ${formattedData.privacy_policy}
• IP Address: ${formattedData.ip_address}
• Captcha: ${formattedData.captcha}
• User Agent: ${event.headers['user-agent'] || 'Non disponibile'}
• Sito: ${data.site_url || 'Non disponibile'}

═══════════════════════════════════════════════════════════════
AutoExpress Service - Sistema di Gestione Richieste
Questa email è stata generata automaticamente da Netlify Forms
═══════════════════════════════════════════════════════════════
    `;

    const mailOptions = {
      from: `AutoExpress Sito <${process.env.SMTP_USER}>`,
      to: "autoexpressadservice@gmail.com",
      subject: emailSubject,
      html: emailBodyHtml,
      text: emailBodyText // Fallback per client che non supportano HTML
    };

    console.log("Invio email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email inviata con successo:", info.messageId);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: "Email inviata",
        messageId: info.messageId,
        clientIP: clientIP
      })
    };

  } catch (error) {
    console.error("Errore:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
}; 