const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Solo metodo GET per test
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Metodo non consentito' })
    };
  }

  try {
    console.log("=== TEST EMAIL CONFIGURAZIONE ===");
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_PASS presente:", !!process.env.SMTP_PASS);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Configurazione SMTP mancante",
          details: {
            SMTP_HOST: !!process.env.SMTP_HOST,
            SMTP_PORT: !!process.env.SMTP_PORT,
            SMTP_USER: !!process.env.SMTP_USER,
            SMTP_PASS: !!process.env.SMTP_PASS
          }
        })
      };
    }

    // Configurazioni da testare
    const smtpConfigs = [
      {
        name: "Register.it SSL (465)",
        host: 'smtps.register.it',
        port: 465,
        secure: true
      },
      {
        name: "Register.it TLS (587)",
        host: 'smtp.register.it',
        port: 587,
        secure: false
      },
      {
        name: "Register.it alternativo (25)",
        host: 'mail.register.it',
        port: 25,
        secure: false
      }
    ];

    const results = [];

    for (const config of smtpConfigs) {
      console.log(`\n--- Testando ${config.name} ---`);
      
      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          connectionTimeout: 10000,
          greetingTimeout: 5000,
          socketTimeout: 10000
        });

        console.log(`Testando connessione a ${config.host}:${config.port}...`);
        await transporter.verify();
        
        console.log(`✅ ${config.name} - Connessione riuscita`);
        results.push({
          config: config.name,
          status: 'success',
          message: 'Connessione SMTP riuscita'
        });

        // Se la connessione riesce, prova a inviare un'email di test
        try {
          const testEmail = {
            from: `"AutoExpress Test" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: '🧪 Test Email AutoExpress',
            html: `
              <h2>Test Email Configurazione</h2>
              <p>Questa è un'email di test per verificare la configurazione SMTP.</p>
              <p><strong>Configurazione:</strong> ${config.name}</p>
              <p><strong>Host:</strong> ${config.host}</p>
              <p><strong>Port:</strong> ${config.port}</p>
              <p><strong>Secure:</strong> ${config.secure}</p>
              <p><strong>Data/Ora:</strong> ${new Date().toLocaleString('it-IT')}</p>
            `,
            text: `Test Email - ${config.name} - ${new Date().toLocaleString('it-IT')}`
          };

          const result = await transporter.sendMail(testEmail);
          console.log(`📧 Email di test inviata con successo - Message ID: ${result.messageId}`);
          
          results[results.length - 1].emailSent = true;
          results[results.length - 1].messageId = result.messageId;
          
        } catch (emailError) {
          console.error(`❌ Errore invio email di test:`, emailError.message);
          results[results.length - 1].emailSent = false;
          results[results.length - 1].emailError = emailError.message;
        }

        // Se la prima configurazione funziona, non testare le altre
        break;

      } catch (error) {
        console.error(`❌ ${config.name} - Errore:`, error.message);
        results.push({
          config: config.name,
          status: 'error',
          message: error.message,
          code: error.code
        });
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: "Test configurazione email completato",
        results: results,
        environment: {
          SMTP_HOST: process.env.SMTP_HOST || 'non configurato',
          SMTP_PORT: process.env.SMTP_PORT || 'non configurato',
          SMTP_USER: process.env.SMTP_USER || 'non configurato',
          SMTP_PASS: process.env.SMTP_PASS ? 'configurato' : 'non configurato'
        }
      })
    };

  } catch (error) {
    console.error("Errore nel test email:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
}; 