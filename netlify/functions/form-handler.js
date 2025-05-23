const nodemailer = require("nodemailer");

exports.handler = async (event, context) => {
  // Questa funzione viene chiamata automaticamente da Netlify Forms
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    // Parse dei dati del form
    const formData = JSON.parse(event.body);
    const payload = formData.payload;
    
    console.log("Form submission ricevuta:", payload);

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

    // Determina il tipo di richiesta
    const tipoRichiesta = payload.data["tipo-richiesta"] || "preventivo";
    const formName = payload.form_name;
    
    // Prepara oggetto email
    let emailSubject = "Nuova richiesta dal sito";
    if (formName === "richiesta-preventivo") {
      emailSubject = "Nuova richiesta preventivo gratuito dal sito";
    } else if (formName === "richiesta-checkup") {
      emailSubject = "Nuova richiesta checkup veicolo dal sito";
    }

    // Costruisci il messaggio email
    let emailText = `
Tipo Richiesta: ${tipoRichiesta === "preventivo" ? "Preventivo Gratuito" : "Checkup Completo"}
Nome: ${payload.data.nome || ""}
Cognome: ${payload.data.cognome || ""}
Email: ${payload.data.email || ""}
Telefono: ${payload.data.telefono || ""}
Targa: ${payload.data.targa || ""}
Data di Nascita: ${payload.data["data-nascita"] || "Non specificata"}`;

    // Aggiungi dettagli appuntamento se è un checkup
    if (formName === "richiesta-checkup") {
      emailText += `
Data Appuntamento: ${payload.data["data-appuntamento"] || "Non specificata"}
Preferenza Orario: ${payload.data["preferenza-orario"] || "Non specificata"}`;
    }

    // Aggiungi le note
    emailText += `
Note: ${payload.data.note || "Nessuna nota"}

CAPTCHA: ${payload.data["captcha-challenge"]} = ${payload.data["captcha-result"]}
Privacy Policy: ${payload.data["privacy-policy"]}
`;

    const mailOptions = {
      from: `AutoExpress <${process.env.SMTP_USER}>`,
      to: "a.ferrante@autodiscida.com",
      subject: emailSubject,
      text: emailText
    };

    console.log("Invio email in corso...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email inviata:", info);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Email inviata" })
    };

  } catch (error) {
    console.error("Errore nell'invio email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 