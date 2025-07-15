# 🚗 AutoExpress - Guida per Replit

Sistema di gestione per officina auto ottimizzato per Replit.

## 🚀 Avvio Rapido

### 1. Configurazione Iniziale
```bash
# Il progetto è già configurato per Replit!
# Esegui semplicemente:
npm run setup
```

### 2. Configurazione Variabili d'Ambiente
Crea un file `.env` nella root del progetto copiando da `.env.example`:

```bash
cp .env.example .env
```

**IMPORTANTE**: Configura le seguenti variabili nel file `.env` o nel pannello "Secrets" di Replit:

#### Supabase (OBBLIGATORIE):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Email SMTP (OBBLIGATORIE):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### 3. Avvio del Progetto
```bash
npm run dev
```

Il progetto sarà disponibile su `https://your-repl-name.your-username.repl.co`

## 🏗️ Struttura del Progetto

```
autoexpress/
├── client/                 # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/    # Componenti React
│   │   ├── pages/         # Pagine dell'app
│   │   ├── services/      # Servizi (auth, API)
│   │   └── styles/        # Stili CSS
│   └── public/            # File statici
├── server/                # Backend Express
│   ├── index.ts          # Server principale
│   ├── routes.ts         # Route API
│   └── vite.ts           # Configurazione Vite
├── shared/               # Codice condiviso
│   ├── schema.ts         # Definizioni tipi
│   ├── supabase.ts       # Client Supabase
│   └── config.ts         # Configurazione app
├── netlify/              # Funzioni Netlify (compatibilità)
└── components/           # Componenti UI aggiuntivi
```

## ⚡ Funzionalità Principali

- **Gestione Clienti**: Registrazione e autenticazione clienti
- **Preventivi**: Creazione e gestione preventivi
- **Appuntamenti**: Sistema di prenotazione
- **Dashboard Admin**: Pannello di controllo per gestione
- **Notifiche Email**: Sistema automatico di notifiche
- **Responsive Design**: Interfaccia mobile-friendly

## 🛠️ Comandi Disponibili

```bash
# Sviluppo
npm run dev              # Avvia in modalità sviluppo

# Build
npm run build            # Build completo (client + server)
npm run build:client     # Build solo client
npm run build:server     # Build solo server

# Produzione
npm run start            # Avvia il server in produzione

# Utility
npm run setup            # Setup completo del progetto
npm run test:env         # Test configurazione ambiente
```

## 🔧 Configurazione Avanzata

### Database
Il progetto utilizza:
- **Supabase**: Database principale PostgreSQL

### Email
Configurato per funzionare con provider SMTP (es. Register.it):
- Host: `smtps.register.it`
- Porta: `465` (SSL) o `587` (TLS)

### Autenticazione
Sistema basato su Supabase Auth per admin e clienti.

## 🚨 Risoluzione Problemi

### Errore: "Supabase connection failed"
1. Controlla URL e chiavi Supabase
2. Verifica che il progetto Supabase sia attivo
3. Controlla le policy RLS (Row Level Security)

### Errore: "Email sending failed"
1. Verifica configurazione SMTP
2. Controlla credenziali email
3. Testa connessione con provider email

### Errore: "Port already in use"
1. Cambia la porta nel file `.env`: `PORT=3000`
2. Riavvia il progetto

## 📝 Note per Replit

1. **Secrets**: Usa il pannello "Secrets" di Replit per variabili sensibili
2. **Persistenza**: I file nella root sono persistenti tra i riavvii
3. **Database**: Usa sempre database esterni (Supabase) per la persistenza
4. **HTTPS**: Replit fornisce automaticamente HTTPS per tutti i progetti

## 🎯 Prossimi Passi

1. **Configura Supabase**:
   - Crea un progetto su [Supabase](https://supabase.com/)
   - Imposta le tabelle necessarie
   - Copia URL e chiavi API nel tuo `.env`

2. **Configura Email**:
   - Ottieni credenziali SMTP dal tuo provider
   - Aggiorna le variabili SMTP nel `.env`

3. **Personalizza**:
   - Modifica i colori e il branding nell'interfaccia
   - Aggiungi nuove funzionalità specifiche per la tua officina

## 🆘 Supporto

Per supporto tecnico:
- Controlla la console del browser per errori JavaScript
- Verifica i log del server nella console di Replit
- Consulta la documentazione di Supabase

---

**Fatto con ❤️ per AutoExpress** 