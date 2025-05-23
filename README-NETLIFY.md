# Deployment su Netlify

Questo repository è configurato per essere deployato su Netlify. Segui le istruzioni per completare il deployment.

## Prerequisiti

- Un account Netlify
- Git installato sul tuo computer
- Node.js e NPM installati sul tuo computer
- Questo repository clonato sul tuo computer o un fork su GitHub

## Opzioni di Deployment

### Opzione 1: Deploy tramite interfaccia Netlify (più semplice)

1. Accedi al tuo account Netlify: https://app.netlify.com/
2. Clicca su "New site from Git"
3. Scegli il provider Git (GitHub, GitLab, BitBucket)
4. Autorizza Netlify ad accedere ai tuoi repository
5. Seleziona il repository da deployare
6. Configura le impostazioni di build:
   - Branch: `main` (o il branch che desideri deployare)
   - Build command: `npm run build:netlify`
   - Publish directory: `dist/public`
7. Clicca su "Advanced build settings" e aggiungi le variabili d'ambiente:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_IMGBB_API_KEY`
   - `VITE_API_URL`: imposta a `/.netlify/functions/api`
   - `VITE_ENV`: imposta a `production`
8. Clicca su "Deploy site"

### Opzione 2: Deploy tramite CLI di Netlify

1. Installa Netlify CLI globalmente (se non l'hai già fatto):
   ```
   npm install -g netlify-cli
   ```

2. Accedi al tuo account Netlify:
   ```
   netlify login
   ```

3. Inizializza il progetto Netlify nella root del repository:
   ```
   netlify init
   ```

4. Segui i passaggi guidati:
   - Seleziona "Create & configure a new site"
   - Seleziona il team Netlify
   - Scegli un nome per il sito o lascia il nome generato automaticamente
   - Per il build command, inserisci: `npm run build:netlify`
   - Per la directory di pubblicazione, inserisci: `dist/public`

5. Configura le variabili d'ambiente:
   ```
   netlify env:set VITE_FIREBASE_API_KEY "il-tuo-valore"
   netlify env:set VITE_FIREBASE_AUTH_DOMAIN "il-tuo-valore"
   netlify env:set VITE_FIREBASE_PROJECT_ID "il-tuo-valore"
   netlify env:set VITE_FIREBASE_STORAGE_BUCKET "il-tuo-valore"
   netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "il-tuo-valore"
   netlify env:set VITE_FIREBASE_APP_ID "il-tuo-valore"
   netlify env:set VITE_IMGBB_API_KEY "il-tuo-valore"
   netlify env:set VITE_API_URL "/.netlify/functions/api"
   netlify env:set VITE_ENV "production"
   ```

6. Deploy il sito:
   ```
   netlify deploy --prod
   ```

## Funzioni Serverless

Questo progetto utilizza funzioni serverless di Netlify per gestire le chiamate API. Le funzioni sono definite nella directory `netlify/functions`. La funzione principale è `api.js` che utilizza Express come framework.

Il file `netlify.toml` contiene le configurazioni per le redirects, in modo che le richieste a `/api/*` vengano instradate alle funzioni serverless appropriate.

## Sviluppo Locale

Per testare l'app in locale, incluse le funzioni serverless Netlify:

1. Installa le dipendenze:
   ```
   npm install
   ```

2. Avvia il server di sviluppo:
   ```
   npm run dev
   ```

3. Per testare le funzioni Netlify in locale:
   ```
   netlify dev
   ```

## Risoluzione dei Problemi

Se incontri problemi durante il deployment:

1. **Errori di Build**: Verifica i log di build su Netlify per capire l'errore.
2. **Problemi di Firebase**: Assicurati che le variabili d'ambiente di Firebase siano configurate correttamente.
3. **Problemi di Routing**: Verifica il file `netlify.toml` e il file `_redirects` nella directory `public`.
4. **Problemi nelle Funzioni**: Verifica i log delle funzioni su Netlify per capire gli errori.

## Ulteriori Risorse

- [Documentazione di Netlify](https://docs.netlify.com/)
- [Guida alle Funzioni Netlify](https://docs.netlify.com/functions/overview/)
- [Guida ai Redirects](https://docs.netlify.com/routing/redirects/) 