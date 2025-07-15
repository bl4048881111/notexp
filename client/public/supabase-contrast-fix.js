// Script per migliorare i contrasti dell'interfaccia di Supabase
// Può essere usato come bookmarklet o iniettato tramite estensione del browser

(function() {
    'use strict';
    
    // Verifica se siamo su Supabase
    if (!window.location.hostname.includes('supabase.co') && !window.location.hostname.includes('supabase.com')) {
        console.log('Questo script funziona solo su Supabase');
        return;
    }
    
    // Rimuovi eventuali stili precedenti
    const existingStyle = document.getElementById('supabase-contrast-fix');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // CSS per migliorare i contrasti
    const css = `
        /* Miglioramenti generali per Supabase */
        body, html {
            background-color: #0f0f0f !important;
            color: #ffffff !important;
        }
        
        /* Contenitori principali */
        [class*="grid"], [class*="table"], [class*="container"] {
            background-color: #1a1a1a !important;
            color: #ffffff !important;
        }
        
        /* Celle e righe delle tabelle */
        td, th, tr {
            background-color: #2a2a2a !important;
            color: #ffffff !important;
            border-color: #404040 !important;
        }
        
        /* Righe alternate */
        tr:nth-child(even) td {
            background-color: #252525 !important;
        }
        
        /* Header delle tabelle */
        th {
            background-color: #333333 !important;
            color: #ffffff !important;
            font-weight: 600 !important;
        }
        
        /* Hover sulle righe */
        tr:hover td {
            background-color: #3a3a3a !important;
        }
        
        /* Input fields */
        input, textarea, select {
            background-color: #2a2a2a !important;
            color: #ffffff !important;
            border: 1px solid #404040 !important;
        }
        
        input:focus, textarea:focus, select:focus {
            background-color: #333333 !important;
            border-color: #ff6b35 !important;
            box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.2) !important;
        }
        
        /* Bottoni */
        button {
            background-color: #ff6b35 !important;
            color: #ffffff !important;
            border: none !important;
            font-weight: 500 !important;
        }
        
        button:hover {
            background-color: #e55a2b !important;
        }
        
        /* Bottoni secondari */
        button[class*="secondary"], button[variant="secondary"] {
            background-color: #404040 !important;
            color: #ffffff !important;
        }
        
        button[class*="secondary"]:hover, button[variant="secondary"]:hover {
            background-color: #505050 !important;
        }
        
        /* Sidebar e navigazione */
        nav, aside, [class*="sidebar"] {
            background-color: #1a1a1a !important;
            border-color: #404040 !important;
        }
        
        /* Link */
        a {
            color: #ff6b35 !important;
        }
        
        a:hover {
            color: #e55a2b !important;
        }
        
        /* Pannelli e card */
        [class*="panel"], [class*="card"], [class*="modal"] {
            background-color: #2a2a2a !important;
            border-color: #404040 !important;
            color: #ffffff !important;
        }
        
        /* Header dei pannelli */
        [class*="header"] {
            background-color: #333333 !important;
            color: #ffffff !important;
            border-color: #404040 !important;
        }
        
        /* Dropdown */
        [class*="dropdown"], [class*="menu"] {
            background-color: #2a2a2a !important;
            border-color: #404040 !important;
        }
        
        /* Elementi del dropdown */
        [class*="dropdown"] > *, [class*="menu"] > * {
            color: #ffffff !important;
        }
        
        [class*="dropdown"] > *:hover, [class*="menu"] > *:hover {
            background-color: #3a3a3a !important;
        }
        
        /* Badge e tag */
        [class*="badge"], [class*="tag"] {
            background-color: #ff6b35 !important;
            color: #ffffff !important;
        }
        
        /* Messaggi di stato */
        [class*="error"] {
            background-color: #4a1a1a !important;
            color: #ff6b6b !important;
            border-color: #8b0000 !important;
        }
        
        [class*="success"] {
            background-color: #1a4a1a !important;
            color: #6bff6b !important;
            border-color: #008b00 !important;
        }
        
        [class*="warning"] {
            background-color: #4a4a1a !important;
            color: #ffff6b !important;
            border-color: #8b8b00 !important;
        }
        
        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 8px !important;
            height: 8px !important;
        }
        
        ::-webkit-scrollbar-track {
            background: #1a1a1a !important;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #404040 !important;
            border-radius: 4px !important;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #505050 !important;
        }
        
        /* Forza il contrasto per tutti gli elementi */
        * {
            text-shadow: none !important;
        }
        
        /* Selettori specifici per Supabase */
        [data-testid*="grid"], [data-testid*="table"] {
            background-color: #1a1a1a !important;
        }
        
        [data-testid*="cell"], [data-testid*="row"] {
            background-color: #2a2a2a !important;
            color: #ffffff !important;
        }
        
        /* Miglioramenti per il testo poco visibile */
        span, p, div, label {
            color: #ffffff !important;
        }
        
        /* Testo secondario */
        [class*="muted"], [class*="secondary"] {
            color: #cccccc !important;
        }
        
        /* Assicura che tutti i contenuti siano visibili */
        .opacity-50, .opacity-60, .opacity-70 {
            opacity: 1 !important;
        }
        
        /* Miglioramenti specifici per i metadati */
        [class*="metadata"] {
            background-color: #2a2a2a !important;
            border: 1px solid #404040 !important;
            color: #ffffff !important;
            padding: 16px !important;
            border-radius: 6px !important;
        }
        
        /* Forza la visibilità di tutti gli elementi di testo */
        [style*="color"] {
            color: #ffffff !important;
        }
    `;
    
    // Crea e inserisci il tag style
    const style = document.createElement('style');
    style.id = 'supabase-contrast-fix';
    style.textContent = css;
    document.head.appendChild(style);
    
    console.log('✅ Miglioramenti contrasti Supabase applicati!');
    
    // Applica gli stili anche agli elementi che vengono caricati dinamicamente
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                // Riapplica gli stili agli elementi appena aggiunti
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // Forza il colore del testo per i nuovi elementi
                        if (node.style) {
                            node.style.color = '#ffffff';
                        }
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Mostra un messaggio di conferma
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b35;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = '✅ Contrasti Supabase migliorati!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
    
})(); 