import express from 'express';
import serverless from 'serverless-http';

// Crea l'app Express
const app = express();

// Abilita il parsing del JSON
app.use(express.json());

// Controllo dello stato dell'API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is working!' });
});

// Endpoint per verificare lo stato dell'autenticazione
app.get('/api/auth/check', (req, res) => {
  // Recupera l'header di autorizzazione
  const authHeader = req.headers.authorization || '';
  
  // Verifica la presenza di un token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In una situazione reale, qui verificheresti il token
    // Per ora restituiamo solo che è valido se presente
    res.json({ 
      authenticated: true, 
      timestamp: new Date().toISOString(),
      message: 'Token di autenticazione valido'
    });
  } else {
    res.status(401).json({ 
      authenticated: false, 
      timestamp: new Date().toISOString(),
      message: 'Token di autenticazione mancante o non valido'
    });
  }
});

// Puoi importare le tue route dal server originale qui
// e usarle con app.use()
// esempio: app.use('/api/appointments', appointmentsRouter);

// Gestisci gli errori
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Esporta la funzione handler per Netlify
export const handler = serverless(app); 