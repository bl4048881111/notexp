const nodemailer = require("nodemailer");

exports.handler = async function(event, context) {
  console.log("Funzione sendQuoteRequest chiamata");
  if (event.httpMethod !== "POST") {
    console.log("Metodo non consentito:", event.httpMethod);
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const { nome, cognome, email, telefono, targa, dataNascita, note, tipoRichiesta, dataAppuntamento, preferenzaOrario } = JSON.parse(event.body || '{}');
  console.log("Dati ricevuti:", { nome, cognome, email, telefono, targa, dataNascita, note, tipoRichiesta, dataAppuntamento, preferenzaOrario });

  // Formatta la data di nascita
  const dataNascitaFormatted = dataNascita ? new Date(dataNascita).toLocaleDateString('it-IT') : 'Non specificata';
  
  // Formatta la data appuntamento
  const dataAppuntamentoFormatted = dataAppuntamento ? new Date(dataAppuntamento).toLocaleDateString('it-IT') : 'Non specificata';
  
  // Traduci la preferenza orario
  const prefOrarioText = {
    "mattina": "Mattina (9:00-13:00)",
    "pomeriggio": "Pomeriggio (14:00-18:00)"
  };

  // Prepara oggetto email in base al tipo di richiesta
  let emailSubject = "Nuova richiesta dal sito";
  if (tipoRichiesta === "preventivo") {
    emailSubject = "Nuova richiesta preventivo gratuito dal sito";
  } else if (tipoRichiesta === "checkup") {
    emailSubject = "Nuova richiesta checkup veicolo dal sito";
  }

  // Configura il trasport SMTP per register.it
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // es: 'smtp.register.it'
    port: 587,
    secure: false, // register.it usa STARTTLS su 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Costruisci il messaggio email
  let emailText = `
Tipo Richiesta: ${tipoRichiesta === "preventivo" ? "Preventivo Gratuito" : "Checkup Completo"}
Nome: ${nome}
Cognome: ${cognome}
Data di Nascita: ${dataNascitaFormatted}
Telefono: ${telefono}
Targa: ${targa}
Email: ${email}`;

  // Aggiungi dettagli appuntamento se è un checkup
  if (tipoRichiesta === "checkup") {
    emailText += `
Data Appuntamento: ${dataAppuntamentoFormatted}
Preferenza Orario: ${prefOrarioText[preferenzaOrario] || preferenzaOrario}`;
  }

  // Aggiungi le note alla fine
  emailText += `
Note: ${note || "Nessuna nota"}`;

  const mailOptions = {
    from: `AutoExpress richiesta <${process.env.SMTP_USER}>`,
    to: "a.ferrante@autodiscida.com",
    subject: emailSubject,
    text: emailText
  };

  try {
    console.log("Invio email in corso...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email inviata:", info);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error("Errore invio email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}; 