# Sistema di Gestione Appuntamenti Auto Express

Sistema per la gestione delle prenotazioni di appuntamenti per Auto Express.

## Funzionalità

- Integrazione con Firebase Realtime Database per gestire gli appuntamenti
- Funzione Netlify per recuperare gli slot occupati in base alla data
- Form di richiesta appuntamenti con selezione di data e orario
- Supporto per diverse preferenze di orario (specifico, mattina, pomeriggio, sera)

## Installazione

1. Clona il repository
2. Installa le dipendenze:

```bash
npm install
```

3. Crea un file `.env` basato su `.env.example` e configura le variabili d'ambiente:

```bash
cp .env.example .env
```

4. Modifica il file `.env` con i tuoi dati di configurazione per Firebase e SMTP.

## Configurazione Firebase

Per configurare l'integrazione con Firebase:

1. Crea un progetto su [Firebase Console](https://console.firebase.google.com/)
2. Genera un account di servizio con permessi di scrittura/lettura sul database
3. Copia il contenuto del file JSON dell'account di servizio nella variabile `FIREBASE_SERVICE_ACCOUNT` del file `.env`
4. Specifica l'URL del database Realtime in `FIREBASE_DATABASE_URL`

## Struttura del Database

Il database Firebase dovrebbe avere la seguente struttura:

```
/appointments
  /appointment_id_1
    date: "YYYY-MM-DD"
    time: "HH:MM"
    duration: 60 (minuti)
    status: "active"
    ...altri campi...
  /appointment_id_2
    ...
```

## Sviluppo locale

Per eseguire l'applicazione in locale:

```bash
npm start
```

## Deployment su Netlify

1. Collega il repository a Netlify
2. Configura le variabili d'ambiente in Netlify
3. Deploy automatico ad ogni push sul branch principale

## Funzioni Netlify

- `getBookedSlots.js`: Recupera gli slot occupati per una data specifica
- `sendQuoteRequest.js`: Invia email con richiesta di preventivo/appuntamento 