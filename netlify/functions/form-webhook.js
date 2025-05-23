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
    
    // Prepara oggetto email
    let emailSubject = "Nuova richiesta dal sito AutoExpress";
    if (formName === "richiesta-preventivo") {
      emailSubject = "🚗 Nuova richiesta preventivo gratuito";
    } else if (formName === "richiesta-checkup") {
      emailSubject = "🔧 Nuova richiesta checkup veicolo";
    }

    // Costruisci il messaggio HTML
    const tipoRichiesta = formName === "richiesta-preventivo" ? "PREVENTIVO GRATUITO" : "CHECKUP VEICOLO";
    const iconaTipo = formName === "richiesta-preventivo" ? "📋" : "🔧";
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; }
        .section { background: white; margin: 15px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #f97316; }
        .section h3 { margin: 0 0 10px 0; color: #f97316; font-size: 16px; }
        .field { margin: 8px 0; }
        .label { font-weight: bold; color: #666; display: inline-block; width: 120px; }
        .value { color: #333; }
        .footer { background: #333; color: white; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; }
        .highlight { background: #fff3cd; padding: 10px; border-radius: 4px; border-left: 4px solid #ffc107; }
        .security { background: #e3f2fd; padding: 10px; border-radius: 4px; border-left: 4px solid #2196f3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${iconaTipo} ${tipoRichiesta}</h1>
            <p>Nuova richiesta dal sito AutoExpress</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h3>👤 Dati Cliente</h3>
                <div class="field">
                    <span class="label">Nome:</span>
                    <span class="value">${formData.nome || "Non specificato"} ${formData.cognome || ""}</span>
                </div>
                <div class="field">
                    <span class="label">Email:</span>
                    <span class="value"><a href="mailto:${formData.email}">${formData.email || "Non specificata"}</a></span>
                </div>
                <div class="field">
                    <span class="label">Telefono:</span>
                    <span class="value"><a href="tel:${formData.telefono}">${formData.telefono || "Non specificato"}</a></span>
                </div>
                <div class="field">
                    <span class="label">Data nascita:</span>
                    <span class="value">${formData["data-nascita"] || "Non specificata"}</span>
                </div>
            </div>

            <div class="section">
                <h3>🚗 Dati Veicolo</h3>
                <div class="field">
                    <span class="label">Targa:</span>
                    <span class="value"><strong>${formData.targa || "Non specificata"}</strong></span>
                </div>
            </div>

            ${formName === "richiesta-checkup" ? `
            <div class="section">
                <h3>📅 Dettagli Appuntamento</h3>
                <div class="field">
                    <span class="label">Data preferita:</span>
                    <span class="value">${formData["data-appuntamento"] || "Non specificata"}</span>
                </div>
                <div class="field">
                    <span class="label">Fascia oraria:</span>
                    <span class="value">${formData["preferenza-orario"] === "mattina" ? "🌅 Mattina (9:00-13:00)" : "🌆 Pomeriggio (14:00-18:00)"}</span>
                </div>
            </div>
            ` : ""}

            ${formData.note ? `
            <div class="section">
                <h3>📝 Note del Cliente</h3>
                <div class="highlight">
                    ${formData.note}
                </div>
            </div>
            ` : ""}

            <div class="section">
                <h3>🔒 Informazioni Sicurezza</h3>
                <div class="security">
                    <div class="field">
                        <span class="label">Indirizzo IP:</span>
                        <span class="value"><strong>${clientIP}</strong></span>
                    </div>
                    <div class="field">
                        <span class="label">User Agent:</span>
                        <span class="value">${event.headers['user-agent'] || 'Non disponibile'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Referrer:</span>
                        <span class="value">${event.headers['referer'] || 'Accesso diretto'}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>✅ Verifica</h3>
                <div class="field">
                    <span class="label">CAPTCHA:</span>
                    <span class="value">${formData["captcha-challenge"]} = ${formData["captcha-result"]}</span>
                </div>
                <div class="field">
                    <span class="label">Privacy:</span>
                    <span class="value">${formData["privacy-policy"] === "accettata" ? "✅ Accettata" : "❌ Non accettata"}</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>📧 Richiesta ricevuta il ${new Date().toLocaleString('it-IT')}</p>
            <p>🌐 Inviata da: ${data.site_url}</p>
            <p>🔍 IP: ${clientIP}</p>
        </div>
    </div>
</body>
</html>`;

    // Versione testo semplificata
    const emailText = `
NUOVA RICHIESTA: ${tipoRichiesta}

CLIENTE: ${formData.nome} ${formData.cognome}
EMAIL: ${formData.email}
TELEFONO: ${formData.telefono}
TARGA: ${formData.targa}

${formName === "richiesta-checkup" ? `APPUNTAMENTO: ${formData["data-appuntamento"]} - ${formData["preferenza-orario"]}` : ""}

${formData.note ? `NOTE: ${formData.note}` : ""}

SICUREZZA:
IP: ${clientIP}
User Agent: ${event.headers['user-agent'] || 'Non disponibile'}

Ricevuta il: ${new Date().toLocaleString('it-IT')}
`;

    const mailOptions = {
      from: `AutoExpress Sito <${process.env.SMTP_USER}>`,
      to: "a.ferrante@autodiscida.com",
      subject: emailSubject,
      text: emailText,
      html: emailHtml
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