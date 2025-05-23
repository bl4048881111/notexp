export async function handler(event, context) {
  // Estrai i cookie dalla richiesta
  const cookies = parseCookies(event.headers.cookie || '');
  
  // Verifica se il cookie di autenticazione esiste
  const authToken = cookies.auth_token || null;
  
  // Informazioni di diagnostica
  const diagnosticInfo = {
    timestamp: new Date().toISOString(),
    path: event.path,
    method: event.httpMethod,
    hasToken: !!authToken,
    headers: sanitizeHeaders(event.headers),
    cookies: Object.keys(cookies),
    netlifyDev: process.env.NETLIFY_DEV === 'true'
  };
  
  // Restituisci informazioni sulla sessione
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, must-revalidate'
    },
    body: JSON.stringify({
      isAuthenticated: !!authToken,
      sessionInfo: diagnosticInfo
    })
  };
}

// Funzione per analizzare i cookie
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) cookies[name] = value;
  });
  
  return cookies;
}

// Funzione per sanitizzare gli header prima di mostrarli (per sicurezza)
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  
  // Rimuovi informazioni sensibili
  const sensitiveHeaders = ['authorization', 'cookie'];
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[FILTERED]';
    }
  });
  
  return sanitized;
} 