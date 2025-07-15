import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Appointment, Quote, WorkSession, ChecklistItem } from '@shared/schema';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { text } from 'body-parser';

// Interfaccia estesa che include le proprietà aggiuntive che sappiamo esistere
interface ExtendedQuote extends Quote {
  partsSubtotal?: number;
  laborTotal?: number;
  updatedAt?: string;
  lastModified?: string;
}

// Funzione helper per convertire il livello carburante in formato numerico
const formatFuelLevel = (fuelLevel: string): string => {
  if (!fuelLevel) return 'N/D';
  
  const level = fuelLevel.toLowerCase().trim();
  
  switch (level) {
    case 'vuoto':
    case 'empty':
    case '0':
      return '0/4 (0%)';
    case 'basso':
    case 'low':
    case '1':
    case 'quarter':
    case 'one-quarter':
    case 'un quarto':
      return '1/4 (25%)';
    case 'medio':
    case 'half':
    case 'medium':
    case '2':
    case 'metà':
    case 'mezzo':
      return '2/4 (50%)';
    case 'three-quarters':
    case 'tre quarti':
      return '3/4 (75%)';
    case 'alto':
    case 'high':
    case 'full':
    case '3':
    case '4':
    case 'pieno':
      return '4/4 (100%)';
    default:
      // Se è già in formato numerico/percentuale, mantienilo
      if (level.includes('%') || level.includes('/')) {
        return fuelLevel;
      }
      return `${fuelLevel} (livello)`;
  }
};

// Export clients to Excel
export const exportClientsToExcel = async (clients: Client[]): Promise<void> => {
  // Format the clients data for Excel
  const data = clients.map(client => ({
    'ID': client.id,
    'Nome': client.name,
    'Cognome': client.surname,
    'Telefono': client.phone,
    'Email': client.email || '',
    'Targa Principale': client.plate,
    'Veicolo': client.model,
    'Data Registrazione': format(new Date(client.createdAt || Date.now()), 'dd/MM/yyyy', { locale: it }),
  }));
  
  // Create workbook and worksheet
  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(data);
  
  // Add worksheet to workbook
  utils.book_append_sheet(workbook, worksheet, 'Clienti');
  
  // Generate Excel file
  writeFile(workbook, `Clienti_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};

// Export appointments to Excel
export const exportAppointmentsToExcel = async (appointments: Appointment[]): Promise<void> => {
  // Format the appointments data for Excel
  const data = appointments.map(appointment => ({
    'ID': appointment.id,
    'Cliente': appointment.clientName,
    'Telefono': appointment.phone,
    'Veicolo': appointment.model,
    'Targa': appointment.plate,
    'Data': format(new Date(appointment.date), 'dd/MM/yyyy', { locale: it }),
    'Ora': appointment.time,
    'Stato': appointment.status,
    'Note': appointment.notes || '',
  }));
  
  // Create workbook and worksheet
  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(data);
  
  // Add worksheet to workbook
  utils.book_append_sheet(workbook, worksheet, 'Appuntamenti');
  
  // Generate Excel file
  writeFile(workbook, `Appuntamenti_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};

// Export appointments to PDF
export const exportAppointmentsToPDF = async (appointments: Appointment[]): Promise<void> => {
  // Create new PDF document
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text('Elenco Appuntamenti', 14, 22);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generato il: ${format(new Date(), 'dd/MM/yyyy', { locale: it })}`, 14, 30);
  
  // Format the appointments data for PDF table
  const data = appointments.map(appointment => [
    appointment.id,
    appointment.clientName,
    appointment.phone,
    `(${appointment.plate})`,
    format(new Date(appointment.date), 'dd/MM/yyyy', { locale: it }),
    appointment.time,
    appointment.status,
  ]);
  
  // Add table to PDF
  autoTable(doc, {
    head: [['ID', 'Cliente', 'Telefono', 'Targa', 'Data', 'Ora', 'Stato']],
    body: data,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [236, 107, 0] }, // Orange header
  });
  
  // Save the PDF
  doc.save(`Appuntamenti_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

// Funzione helper per correggere il totale per Ignazio Benedetto
const getCorrectedTotal = (quote: Quote): number => {
  // Usiamo principalmente totalPrice, con total come fallback solo se necessario
  if ((quote as any).totalPrice !== undefined) {
    return (quote as any).totalPrice;
  } else if ((quote as any).total !== undefined) {
    return (quote as any).total;
  }
  
  // Se né totalPrice né total sono definiti, calcola un totale base
  const partsSubtotal = (quote as any).partsSubtotal || 0;
  const laborHours = (quote as any).laborHours || 0;
  const laborPrice = (quote as any).laborPrice || 0;
  const laborTotal = laborHours * laborPrice;
  const subtotal = partsSubtotal + laborTotal;
  
  const taxRate = quote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  return subtotal + taxAmount;
};

// Export quotes to Excel
export const exportQuotesToExcel = async (quotes: Quote[]): Promise<void> => {
  // Format the quotes data for Excel
  const data = quotes.map(quote => {
    // Convertiamo in ExtendedQuote per accedere ai subtotali separati
    const extendedQuote = quote as ExtendedQuote;
    
    // Calcoliamo in modo robusto i totali, verificando tutti i campi disponibili
    const partsSubtotal = extendedQuote.partsSubtotal !== undefined 
      ? extendedQuote.partsSubtotal
      : (extendedQuote.items && Array.isArray(extendedQuote.items)
          ? extendedQuote.items.reduce((sum, item) => {
              return sum + (Array.isArray(item.parts) 
                ? item.parts.reduce((sum, part) => {
                    // CORREZIONE: Verifica e corregge il finalPrice anche nel calcolo del subtotale
                    const unitPrice = part.unitPrice || 0;
                    const quantity = part.quantity || 1;
                    const expectedFinalPrice = unitPrice * quantity;
                    
                    // Se il finalPrice non corrisponde al calcolo atteso, usa il calcolo corretto
                    const correctFinalPrice = (part.finalPrice && Math.abs(part.finalPrice - expectedFinalPrice) < 0.01) 
                      ? part.finalPrice 
                      : expectedFinalPrice;
                    
                    return sum + correctFinalPrice;
                  }, 0)
                : 0);
            }, 0)
          : 0);
      
    const laborHours = extendedQuote.laborHours || 0;
    const laborPrice = extendedQuote.laborPrice || 0;
    
    // Manodopera SOLO extra
    const laborTotal = laborHours * laborPrice;
      
    // Verifica che il subtotale combaci con i campi separati
    const subtotal = partsSubtotal + laborTotal;
    
    // Ricalcoliamo l'IVA sul subtotale verificato
    const taxRate = extendedQuote.taxRate || 22;
    const taxAmount = (subtotal * taxRate) / 100;
    
    // Ottieni il totale corretto con la funzione helper
    const totalAmount = getCorrectedTotal(quote);
    
    return {
      'ID': quote.id,
      'Cliente': quote.clientName,
      'Telefono': quote.phone,
      'Veicolo': quote.model,
      'Targa': quote.plate,
      'Data': format(new Date(quote.date), 'dd/MM/yyyy', { locale: it }),
      //'Subtotale': `€ ${subtotal.toFixed(2)}`,
      'IVA': `€ ${taxAmount.toFixed(2)}`,
      'Totale': `€ ${totalAmount.toFixed(2)}`,
      'Stato': quote.status,
    };
  });
  
  // Create workbook and worksheet
  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(data);
  
  // Add worksheet to workbook
  utils.book_append_sheet(workbook, worksheet, 'Preventivi');
  
  // Generate Excel file
  writeFile(workbook, `Preventivi_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};

// Export single quote to PDF
export const exportQuoteToPDF = async (quote: Quote): Promise<void> => {
  // Convertiamo il preventivo al tipo esteso per evitare errori del linter
  const extendedQuote = quote as ExtendedQuote;
  
  // Ottieni il totale corretto con la funzione helper
  const totalAmount = getCorrectedTotal(quote);
  const isIgnazioBenedetto = quote.clientId === "3476727022" && quote.clientName.includes("Ignazio Benedetto");
  
  // Create new PDF document
  const doc = new jsPDF();
  
  // Add company info - a sinistra, come nell'immagine
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Gray
  
  // Allineamento uniforme per le righe dell'intestazione
  const headerY1 = 35;
  const headerY2 = 41;
  const headerY3 = 47;
  const headerY4 = 53;
  
  doc.text('AutoExpress Monopoli', 20, headerY1);
  doc.text('Via Eugenio Montale 4', 20, headerY2);
  doc.text('Tel: 3293888702', 20, headerY3);
  doc.text('70043 Monopoli BA', 20, headerY4);
  
  // Logo X a destra - migliorato posizionamento
  try {
    // @ts-ignore - Usiamo @ts-ignore per evitare l'errore TypeScript
    doc.addImage(
      'https://i.ibb.co/C5B0NDZJ/autoexpress-logo.png',
      130, 10, 60, 70 // Ridimensionato e riposizionato per allinearlo meglio
    );
  } catch (error) {
    console.error('Errore nel caricamento del logo grande:', error);
    
    // Fallback logo testuale - riposizionato
    doc.setFontSize(22);
    doc.setTextColor(236, 107, 0); // Arancione
    doc.text('X', 170, 25);
    doc.setFontSize(14);
    doc.text('AUTOEXPRESS', 155, 35);
  }
  
  // Add quote title and info - a sinistra
  doc.setFontSize(18);
  doc.setTextColor(236, 107, 0);
  doc.text('Preventivo', 20, 70);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`ID: ${extendedQuote.id}`, 20, 78);
  doc.text(`Data: ${format(new Date(extendedQuote.date), 'dd/MM/yyyy', { locale: it })}`, 20, 84);
  doc.text(`Stato: ${extendedQuote.status.toUpperCase()}`, 20, 90);
  
  // Aggiungi linea separatrice orizzontale
  doc.setDrawColor(236, 107, 0); // Arancione
  doc.setLineWidth(0.5);
  doc.line(20, 100, 190, 100);
  
  // Aggiungi dati cliente (spostati a sinistra, senza bordo)
  doc.setFontSize(14);
  doc.setTextColor(236, 107, 0);
  doc.text('Dati Cliente', 140, 70);
  
  // Aggiungi i dati cliente
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Cliente: ${extendedQuote.clientName}`, 140, 80);
  doc.text(`Telefono: ${extendedQuote.phone}`, 140, 88);
  doc.text(`Targa: ${extendedQuote.plate}`, 140, 96);
  
  // Aggiungi VIN solo se presente
  if (extendedQuote.vin && extendedQuote.vin.trim() !== '') {
    doc.text(`VIN: ${extendedQuote.vin}`, 140, 104);
  }
  
  let lastY = 120;
  
  // Add spare parts table - PRIMA
  let hasAnyParts = false;
  
  // Raccolgo tutti i ricambi in un'unica tabella
  const allParts: any[] = [];
  
  // Raccogliamo i ricambi da tutti i servizi
  if (extendedQuote.items && Array.isArray(extendedQuote.items)) {
    extendedQuote.items.forEach((item) => {
      if (Array.isArray(item.parts) && item.parts.length > 0) {
        hasAnyParts = true;
        
        // Aggiungo ogni ricambio con riferimento al servizio
        item.parts
          .filter(part => part && part.code)
          .forEach(part => {
            // Rimuovo gli spazi iniziali e finali dai campi code e name
            const code = part.code?.trim() || '';
            const name = (part as any).descpart || part.description || part.name?.trim() || 'Ricambio';
            const brand = part.brand?.trim() || '';
            
            // CORREZIONE: Verifica e corregge il finalPrice per evitare moltiplicazioni indesiderate
            const unitPrice = part.unitPrice || 0;
            const quantity = part.quantity || 1;
            const expectedFinalPrice = unitPrice * quantity;
            
            // Se il finalPrice non corrisponde al calcolo atteso, usa il calcolo corretto
            const correctFinalPrice = (part.finalPrice && Math.abs(part.finalPrice - expectedFinalPrice) < 0.01) 
              ? part.finalPrice 
              : expectedFinalPrice;
            
            allParts.push([
              brand,
              name,
              item.serviceType.name,
              quantity,
              `€${unitPrice.toFixed(2)}`,
              `€${correctFinalPrice.toFixed(2)}`,
            ]);
          });
      }
    });
  }
  
  // Se ci sono ricambi, mostriamo l'intestazione e la tabella
  if (hasAnyParts) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Ricambi', 20, lastY);
    doc.setFont('helvetica', 'normal');
    
    try {
      // Creiamo un'unica tabella con tutti i ricambi
      autoTable(doc, {
        head: [['Brand', 'Descrizione', 'Servizio', 'Quantità', 'Prezzo Unitario', 'Prezzo Finale']],
        body: allParts,
        startY: lastY + 4,
        margin: { left: 20 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [236, 107, 0] },
        tableWidth: 'auto',
      });
    } catch (error) {
      console.error('Errore nella generazione della tabella ricambi:', error);
      doc.setFontSize(8);
      doc.setTextColor(255, 0, 0);
      doc.text('Errore nella visualizzazione dei ricambi', 20, lastY + 4);
      doc.setTextColor(0, 0, 0);
    }
  } else {
    // Se non ci sono ricambi, mostra un messaggio
    doc.setFontSize(10);
    doc.text('Nessun ricambio incluso nel preventivo', 20, lastY);
  }
  
  // Aggiorna lastY dopo la tabella dei ricambi
  lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : lastY + 10;
  
  // Aggiungi sezione manodopera DOPO i ricambi se presente
  if (extendedQuote.laborHours && extendedQuote.laborPrice && 
      extendedQuote.laborHours > 0 && extendedQuote.laborPrice > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Manodopera', 20, lastY);
    doc.setFont('helvetica', 'normal');
    
    autoTable(doc, {
      head: [['Descrizione', 'Ore', 'Prezzo Orario', 'Totale']],
      body: [['Manodopera', 
              extendedQuote.laborHours.toString(), 
              `€${extendedQuote.laborPrice.toFixed(2)}`, 
              `€${(extendedQuote.laborHours * extendedQuote.laborPrice).toFixed(2)}`]],
      startY: lastY + 4,
      margin: { left: 20 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [236, 107, 0] }, // Orange header
      tableWidth: 'auto',
    });
  }
  
  // Aggiorna lastY dopo la manodopera
  lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : lastY + 25;
  
  // Add totals in box arancione chiaro allineato a destra
  const totalsY = lastY;
  
  // Riquadro per i totali - posizionato a destra con dimensioni e stile come nell'immagine

  
  // Utilizziamo i subtotali corretti dai campi separati, oppure calcoliamo da zero
  const partsSubtotal = extendedQuote.partsSubtotal !== undefined 
    ? extendedQuote.partsSubtotal
    : (extendedQuote.items && Array.isArray(extendedQuote.items)
        ? extendedQuote.items.reduce((sum, item) => {
            return sum + (Array.isArray(item.parts) 
              ? item.parts.reduce((sum, part) => {
                  // CORREZIONE: Verifica e corregge il finalPrice anche nel calcolo del subtotale
                  const unitPrice = part.unitPrice || 0;
                  const quantity = part.quantity || 1;
                  const expectedFinalPrice = unitPrice * quantity;
                  
                  // Se il finalPrice non corrisponde al calcolo atteso, usa il calcolo corretto
                  const correctFinalPrice = (part.finalPrice && Math.abs(part.finalPrice - expectedFinalPrice) < 0.01) 
                    ? part.finalPrice 
                    : expectedFinalPrice;
                  
                  return sum + correctFinalPrice;
                }, 0)
              : 0);
          }, 0)
        : (extendedQuote.subtotal || 0));
    
  const laborHours = extendedQuote.laborHours || 0;
  const laborPrice = extendedQuote.laborPrice || 0;
  
  // SOLO manodopera extra, NO manodopera servizi
  const laborTotal = laborHours * laborPrice;
    
  // Verifica che il subtotale combaci con i campi separati
  const subtotal = partsSubtotal;
  
  // Ricalcoliamo l'IVA sul subtotale verificato
  const taxRate = extendedQuote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  
  // Formattazione come nell'immagine, con allineamento a destra per i valori
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // Subtotale
  doc.text("Subtotale:", 145, totalsY + 0);
  const subtotalFormatted = new Intl.NumberFormat('it-IT', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  }).format(subtotal);
  doc.text(subtotalFormatted, 190, totalsY + 0, { align: 'right' });

  // IVA
  doc.text(`IVA (${taxRate}%):`, 145, totalsY + 5);
  const taxFormatted = new Intl.NumberFormat('it-IT', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  }).format(taxAmount);
  doc.text(taxFormatted, 190, totalsY + 5, { align: 'right' });

  // Linea separatrice
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(145, totalsY + 22, 190, totalsY + 22);

  // Totale finale
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Totale(IVA incl):', 145, totalsY + 15);

  // Valore totale in arancione e allineato a destra - Migliorato
  doc.setFontSize(12); 
  doc.setTextColor(236, 107, 0);
  doc.setFont('helvetica', 'bold');
  
  // Rimuovo il rettangolo bianco dietro il totale che causa problemi di visualizzazione
  // e allargo lo spazio per il testo del totale
  
  const totalFormatted = new Intl.NumberFormat('it-IT', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  }).format(totalAmount);
  doc.text(totalFormatted, 190, totalsY + 17, { align: 'right' });

  // Add notes if any con bordo grigio e sfondo chiaro
  if (extendedQuote.notes) {
    const notesY = totalsY + 60; 
    
    // Riquadro per le note
    doc.setDrawColor(200, 200, 200); // Grigio
    doc.setLineWidth(0.2);
    doc.setFillColor(250, 250, 250); // Grigio molto chiaro
    doc.roundedRect(20, notesY - 5, 180, 30, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(236, 107, 0);
    doc.text('Note:', 25, notesY + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Gestione del testo lungo con wrap
    const splitNotes = doc.splitTextToSize(extendedQuote.notes, 170);
    doc.text(splitNotes, 25, notesY + 10);
  }
  
  // Add footer con linea di separazione
  const pageHeight = doc.internal.pageSize.height;
  
  /* Linea di separazione
  doc.setDrawColor(236, 107, 0); // Arancione
  doc.setLineWidth(0.2);
  doc.line(10, pageHeight - 25, 200, pageHeight - 25);
  */
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100); // Gray
  
  // Footer con spaziatura migliorata e timestamp
  const footerY1 = pageHeight - 20;
  const footerY2 = pageHeight - 16;
  const footerY3 = pageHeight - 12; 
  const footerY4 = pageHeight - 8;
  const footerY5 = pageHeight - 4;
  
  doc.text('I prezzi indicati sono IVA esclusa.', 10, footerY1);
  doc.text('Il presente preventivo è stato redatto sulla base di banche dati disponibili', 10, footerY2);
  doc.text('e potrebbe contenere inesattezze.', 10, footerY3);
  doc.text('La validazione definitiva avverrà esclusivamente al momento dell\'installazione dei ricambi.', 10, footerY4);
  
  // Timestamp dell'ultima modifica
  const lastModified = extendedQuote.updatedAt || extendedQuote.lastModified || new Date().toISOString();
  const timestampText = `Ultima modifica: ${format(new Date(lastModified), 'dd/MM/yyyy HH:mm', { locale: it })}`;
  doc.setTextColor(150, 150, 150); // Grigio più chiaro per il timestamp
  doc.text(timestampText, 190, footerY5, { align: 'right' });
  
  // Save the PDF
  doc.save(`Preventivo_${extendedQuote.id}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

// Export work session to PDF
export const exportWorkSessionToPDF = async (workSession: WorkSession, vehicleId: string, checklist: ChecklistItem[]): Promise<void> => {
  console.log('[DEBUG PDF] workSession:', workSession);
  console.log('[DEBUG PDF] vehicleId:', vehicleId);
  console.log('[DEBUG PDF] checklist:', checklist);
  // Create new PDF document
  const doc = new jsPDF();
  
  // Add company info - header
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Gray
  
  const headerY1 = 35;
  const headerY2 = 41;
  const headerY3 = 47;
  const headerY4 = 53;
  
  doc.text('AutoExpress Monopoli', 20, headerY1);
  doc.text('Via Eugenio Montale 4', 20, headerY2);
  doc.text('Tel: 3293888702', 20, headerY3);
  doc.text('70043 Monopoli BA', 20, headerY4);
  
  // Logo
  try {
    // @ts-ignore
    doc.addImage(
      'https://i.ibb.co/C5B0NDZJ/autoexpress-logo.png',
      130, 10, 60, 70
    );
  } catch (error) {
    console.error('Errore nel caricamento del logo:', error);
    doc.setFontSize(22);
    doc.setTextColor(236, 107, 0);
    doc.text('X', 170, 25);
    doc.setFontSize(14);
    doc.text('AUTOEXPRESS', 155, 35);
  }
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(236, 107, 0);
  doc.text('Report Lavorazione', 20, 70);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`ID Sessione: ${workSession.id}`, 20, 78);
  doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy', { locale: it })}`, 20, 84);
  doc.text(`Targa: ${vehicleId}`, 20, 90);
  
  // Separator line
  doc.setDrawColor(236, 107, 0);
  doc.setLineWidth(0.5);
  doc.line(20, 100, 190, 100);
  
  // Vehicle data section
  doc.setFontSize(14);
  doc.setTextColor(236, 107, 0);
  doc.text('Dati Veicolo', 140, 70);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Chilometraggio: ${workSession.mileage || 'N/D'} km`, 140, 80);
  doc.text(`Carburante: ${formatFuelLevel(workSession.fuelLevel || '')}`, 140, 88);
  doc.text(`Stato: ${workSession.completed ? 'Completato' : 'In corso'}`, 140, 96);
  
  let currentY = 120;
  
  // Acceptance photos section - SEMPRE MOSTRATA ANCHE SE VUOTA
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Foto di Accettazione', 20, currentY);
  doc.setFont('helvetica', 'normal');
  
  currentY += 10;
  
  if (workSession.acceptancePhotos && workSession.acceptancePhotos.length > 0) {
    // Display photos (max 4)
    const maxPhotos = Math.min(4, workSession.acceptancePhotos.length);
    for (let i = 0; i < maxPhotos; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * 90;
      const y = currentY + row * 75;
      
      try {
        // Carica l'immagine reale
        const imgData = await fetch(workSession.acceptancePhotos[i])
          .then(response => response.blob())
          .then(blob => new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }));

        // Crea un'immagine temporanea per ottenere le dimensioni originali
        const tempImg = new Image();
        await new Promise<void>((resolve) => {
          tempImg.onload = () => resolve();
          tempImg.src = imgData;
        });

        // Calcola le dimensioni mantenendo le proporzioni
        const maxWidth = 85;
        const maxHeight = 65;
        
        const aspectRatio = tempImg.width / tempImg.height;
        let imgWidth = maxWidth;
        let imgHeight = maxWidth / aspectRatio;
        
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = maxHeight * aspectRatio;
        }

        // Centra l'immagine nel suo spazio
        const imgX = x + (85 - imgWidth) / 2;
        const imgY = y + (65 - imgHeight) / 2;

        // Aggiungi l'immagine
        doc.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
        
        // Didascalia
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Foto ${i + 1}`, x + 42.5, y + 70, { align: 'center' });
        
      } catch (error) {
        console.error(`Errore foto ${i + 1}:`, error);
        // Fallback a placeholder se l'immagine non si carica
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, 85, 65, 'FD');
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Foto ${i + 1} (errore)`, x + 42.5, y + 35, { align: 'center' });
      }
    }
    
    currentY += Math.ceil(maxPhotos / 2) * 75 + 20;
  } else {
    // Mostra messaggio quando non ci sono foto
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.rect(20, currentY, 170, 30, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Nessuna foto di accettazione disponibile', doc.internal.pageSize.width / 2, currentY + 20, { align: 'center' });
    
    currentY += 40;
  }

  // Spare parts photos section - SEMPRE MOSTRATA ANCHE SE VUOTA
  if (currentY > 200) {
    doc.addPage();
    currentY = 20;
  }
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Foto Ricambi', 20, currentY);
  doc.setFont('helvetica', 'normal');
  
  currentY += 10;
  
  if (workSession.sparePartsPhotos && workSession.sparePartsPhotos.length > 0) {
    // Display photos (max 6, layout verticale: 1 foto per riga, 3 foto per pagina)
    const maxSparePhotos = Math.min(6, workSession.sparePartsPhotos.length);
    
    for (let i = 0; i < maxSparePhotos; i++) {
      // Layout verticale: 1 foto per riga, 3 foto per pagina con più spazio per le note
      const photoOnPage = i % 3; // Posizione sulla pagina corrente (0, 1, 2)
      let x = 50; // Centrato orizzontalmente
      let y = currentY + photoOnPage * 95; // Aumentata spaziatura verticale per le note lunghe
      
      // Nuova pagina ogni 3 foto
      if (i > 0 && i % 3 === 0) {
        doc.addPage();
        currentY = 20;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Foto Ricambi (continua)', 20, currentY);
        doc.setFont('helvetica', 'normal');
        currentY += 10;
        
        // Aggiorna posizione per la nuova pagina
        y = currentY + (photoOnPage * 95); // Stessa spaziatura aumentata
      }
      
      try {
        // Carica l'immagine reale
        const imgData = await fetch(workSession.sparePartsPhotos[i])
          .then(response => response.blob())
          .then(blob => new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }));

        // Crea un'immagine temporanea per ottenere le dimensioni originali
        const tempImg = new Image();
        await new Promise<void>((resolve) => {
          tempImg.onload = () => resolve();
          tempImg.src = imgData;
        });

        // Calcola le dimensioni mantenendo le proporzioni - dimensioni più grandi per layout verticale
        const maxWidth = 110; // Aumentato per il layout verticale
        const maxHeight = 60; // Altezza fissa per mantenere uniformità
        
        const aspectRatio = tempImg.width / tempImg.height;
        let imgWidth = maxWidth;
        let imgHeight = maxWidth / aspectRatio;
        
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = maxHeight * aspectRatio;
        }

        // Centra l'immagine orizzontalmente
        const imgX = x + (110 - imgWidth) / 2;
        const imgY = y;

        // Aggiungi l'immagine
        doc.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
        
        // Didascalia con note a lato dell'immagine con word wrap migliorato
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        
        // Usa la nota corrispondente se disponibile
        const noteKey = `p${i + 1}note` as keyof typeof workSession;
        const photoNote = workSession[noteKey] as string;
        let caption = `Ricambio ${i + 1}`;
        
        if (photoNote && photoNote.trim().length > 0) {
          caption = photoNote.trim();
        }
        
        // Posiziona la didascalia a lato dell'immagine con molto più spazio
        const textX = x + 110; // Spostato ancora più a sinistra da 115 a 110
        const textY = y + 10;
        const maxTextWidth = 80; // Aumentato da 65 a 80 per molto più spazio
        
        // Titolo della foto
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(236, 107, 0);
        doc.text(`Foto ${i + 1}:`, textX, textY);
        
        // Descrizione/note con word wrap migliorato
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        // Gestisci interruzioni di riga intelligenti ogni 25 caratteri circa
        let wrappedLines: string[] = [];
        const words = caption.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          if (testLine.length > 25) {
            // Se la riga corrente non è vuota, la aggiungiamo
            if (currentLine) {
              wrappedLines.push(currentLine);
            }
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        // Aggiungi l'ultima riga se non è vuota
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        
        let lineHeight = 6;
        
        wrappedLines.forEach((line: string, lineIndex: number) => {
          const yPosition = textY + 8 + (lineIndex * lineHeight);
          // Assicurati che il testo non esca troppo dall'area disponibile
          if (yPosition < y + 75) { // Aumentato il limite verticale
            doc.text(line, textX, yPosition);
          }
        });
        
      } catch (error) {
        console.error(`Errore foto ricambio ${i + 1}:`, error);
        // Fallback a placeholder se l'immagine non si carica
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, 110, 60, 'FD');
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        
        // Usa la nota anche per il fallback
        const noteKey = `p${i + 1}note` as keyof typeof workSession;
        const photoNote = workSession[noteKey] as string;
        let caption = `Ricambio ${i + 1}`;
        
        if (photoNote && photoNote.trim().length > 0) {
          caption = photoNote.trim();
        }
        
        // Centra il testo nel placeholder
        doc.text('Errore caricamento immagine', x + 55, y + 30, { align: 'center' });
        
        // Descrizione a lato anche per il fallback con word wrap migliorato
        const textX = x + 110; // Stesso posizionamento della versione normale
        const textY = y + 10;
        const maxTextWidth = 80; // Stesso spazio della versione normale
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(236, 107, 0);
        doc.text(`Foto ${i + 1}:`, textX, textY);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        // Gestisci interruzioni di riga per il fallback
        let wrappedLinesFallback: string[] = [];
        const wordsFallback = caption.split(' ');
        let currentLineFallback = '';
        
        for (const word of wordsFallback) {
          const testLine = currentLineFallback + (currentLineFallback ? ' ' : '') + word;
          if (testLine.length > 25) {
            // Se la riga corrente non è vuota, la aggiungiamo
            if (currentLineFallback) {
              wrappedLinesFallback.push(currentLineFallback);
            }
            currentLineFallback = word;
          } else {
            currentLineFallback = testLine;
          }
        }
        // Aggiungi l'ultima riga se non è vuota
        if (currentLineFallback) {
          wrappedLinesFallback.push(currentLineFallback);
        }
        
        let lineHeight = 6;
        
        wrappedLinesFallback.forEach((line: string, lineIndex: number) => {
          const yPosition = textY + 8 + (lineIndex * lineHeight);
          if (yPosition < y + 75) { // Stesso limite verticale
            doc.text(line, textX, yPosition);
          }
        });
      }
    }
    
    // Aggiorna currentY dopo tutte le foto (3 foto per pagina max)
    const photosOnLastPage = maxSparePhotos % 3 || 3;
    currentY += photosOnLastPage * 95 + 20; // Aggiornato per la nuova spaziatura
  } else {
    // Mostra messaggio quando non ci sono foto ricambi
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.rect(20, currentY, 170, 30, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Nessuna foto ricambi disponibile', doc.internal.pageSize.width / 2, currentY + 20, { align: 'center' });
    
    currentY += 40;
  }

  // ==================== NUOVA PAGINA PER RIEPILOGO COSTI (SPOSTATO QUI DOPO LE FOTO) ====================
  
  doc.addPage();
  let costsPageY = 20;

  // ==================== SEZIONE NOTE WORK SESSION (SPOSTATA QUI PER VISIBILITÀ) ====================
  
  // Se ci sono note della work session, mostrare in una sezione dedicata prominente
  if (workSession.descpart && workSession.descpart !== 'EMPTY' && workSession.descpart !== 'NULL' && workSession.descpart.trim() !== '') {
    // Titolo sezione note
    doc.setFillColor(52, 73, 94);
    doc.rect(14, costsPageY, 180, 8, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("NOTE DI LAVORAZIONE", 18, costsPageY + 5);
    
    costsPageY += 12;
    
    // Calcola l'altezza necessaria per le note
    const noteLines = doc.splitTextToSize(workSession.descpart, 170);
    const noteBoxHeight = Math.max(20, 10 + (noteLines.length * 4));

    // Box principale per le note con bordo arancione più spesso
    doc.setDrawColor(236, 107, 0);
    doc.setLineWidth(1);
    doc.setFillColor(255, 255, 255);
    doc.rect(14, costsPageY, 180, noteBoxHeight, 'FD');

    // Testo della nota più grande e più leggibile
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.text(noteLines, 18, costsPageY + 8);
    
    costsPageY += noteBoxHeight + 15;
  }

  // Titolo pagina costi
  doc.setFillColor(236, 107, 0);
  doc.rect(14, costsPageY, 180, 12, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("RIEPILOGO COSTI E SERVIZI", doc.internal.pageSize.width / 2, costsPageY + 8, { align: "center" });
  costsPageY += 20;

  // ==================== SEZIONE RICAMBI DAL PREVENTIVO ====================
  
  let quoteParts: any[] = [];
  let subtotalParts = 0;
  let laborHours = 0;
  let laborPrice = 0;
  
  try {
    // Recupera il preventivo tramite appointmentId
    const { getAppointmentById, getQuoteById } = await import('@shared/supabase');
    const appointment = await getAppointmentById(workSession.appointmentId);
    
    if (appointment?.quoteId) {
      const quote = await getQuoteById(appointment.quoteId);
      
      if (quote?.items && Array.isArray(quote.items)) {
        // Estrai tutti i ricambi dal preventivo (come in exportQuoteToPDF)
        quote.items.forEach((item) => {
          if (Array.isArray(item.parts) && item.parts.length > 0) {
            item.parts
              .filter(part => part && part.code)
              .forEach(part => {
                const unitPrice = part.unitPrice || 0;
                const quantity = part.quantity || 1;
                const expectedFinalPrice = unitPrice * quantity;
                
                // Correzione finalPrice
                const correctFinalPrice = (part.finalPrice && Math.abs(part.finalPrice - expectedFinalPrice) < 0.01) 
                  ? part.finalPrice 
                  : expectedFinalPrice;
                
                quoteParts.push({
                  brand: part.brand?.trim() || 'AutoExpress',
                  name: (part as any).descpart || part.description || part.name?.trim() || 'Ricambio',
                  service: item.serviceType.name,
                  quantity: quantity,
                  unitPrice: unitPrice,
                  finalPrice: correctFinalPrice
                });
                
                subtotalParts += correctFinalPrice;
              });
          }
        });
      }
      
      // Recupera anche mano d'opera extra dal preventivo
      if (quote) {
        laborHours = quote.laborHours || 0;
        laborPrice = quote.laborPrice || 0;
      }
    }
  } catch (error) {
    console.error('Errore nel recupero del preventivo:', error);
  }

  if (quoteParts.length > 0) {
    doc.setFillColor(52, 73, 94);
    doc.rect(14, costsPageY, 180, 8, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("RICAMBI SOSTITUITI", 18, costsPageY + 5);
    
    costsPageY += 10;
    
    try {
      // Prepara i dati per la tabella (come in exportQuoteToPDF)
      const sparePartsData = quoteParts.map(part => [
        part.brand,
        part.name,
        part.service,
        part.quantity.toString(),
        `€${part.unitPrice.toFixed(2)}`,
        `€${part.finalPrice.toFixed(2)}`
      ]);

      // Crea la tabella dei ricambi
      autoTable(doc, {
        head: [['Brand', 'Descrizione', 'Servizio', 'Quantità', 'Prezzo Unitario', 'Prezzo Finale']],
        body: sparePartsData,
        startY: costsPageY,
        margin: { left: 14 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [236, 107, 0] },
        tableWidth: 'auto',
      });
      
      costsPageY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : costsPageY + 50;
      
      // Subtotale ricambi
      doc.setFillColor(52, 73, 94);
      doc.rect(14, costsPageY, 180, 7, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("SUBTOTALE RICAMBI:", 18, costsPageY + 5);
      doc.setFontSize(10);
      doc.text(`€ ${subtotalParts.toFixed(2)}`, 165, costsPageY + 5);
      
      costsPageY += 12;
    } catch (error) {
      console.error('Errore nella generazione della tabella ricambi:', error);
      costsPageY += 20;
    }
  }

  // ==================== SEZIONE MANO D'OPERA ====================
  
  if (laborHours > 0 && laborPrice > 0) {
    doc.setFillColor(52, 73, 94);
    doc.rect(14, costsPageY, 180, 8, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("MANO DOPERA", 18, costsPageY + 5);

    costsPageY += 10;

    // Intestazione tabella mano d'opera
    doc.setFillColor(236, 240, 241);
    doc.rect(14, costsPageY, 180, 6, "F");
    doc.setDrawColor(189, 195, 199);
    doc.setLineWidth(0.3);
    doc.rect(14, costsPageY, 180, 6);
    
    doc.setFontSize(8);
    doc.setTextColor(44, 62, 80);
    const laborTotal = laborHours * laborPrice;
    doc.text("SERVIZIO", 18, costsPageY + 4);
    doc.text("ORE LAVORO", 110, costsPageY + 4);
    doc.text("COSTO ORARIO", 140, costsPageY + 4);
    doc.text("TOTALE", 170, costsPageY + 4);

    costsPageY += 6;

    // Riga mano d'opera
    doc.setFillColor(255, 255, 255);
    doc.rect(14, costsPageY, 180, 6, "F");
    doc.setDrawColor(220, 221, 225);
    doc.setLineWidth(0.1);
    doc.rect(14, costsPageY, 180, 6);
    
    doc.setFontSize(8);
    doc.setTextColor(52, 58, 64);
    const laborTotalAmount = laborHours * laborPrice;
    doc.text("Manodopera", 18, costsPageY + 4);
    doc.text(`${laborHours.toFixed(1)} h`, 115, costsPageY + 4);
    doc.text(`€ ${laborPrice.toFixed(2)}`, 145, costsPageY + 4);
    doc.text(`€ ${laborTotalAmount.toFixed(2)}`, 175, costsPageY + 4);

    costsPageY += 8;

    // Subtotale mano d'opera
    doc.setFillColor(52, 73, 94);
    doc.rect(14, costsPageY, 180, 7, "F");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("SUBTOTALE MANO DOPERA:", 18, costsPageY + 5);
    doc.setFontSize(10);
    doc.text(`€ ${laborTotalAmount.toFixed(2)}`, 165, costsPageY + 5);
    
    costsPageY += 12;
  }

  // ==================== SEZIONE TOTALI ====================
  
  if (quoteParts.length > 0 || (laborHours > 0 && laborPrice > 0)) {
    // Box per i totali (come nel preventivo)
    const totalsY = costsPageY + 10;
    
    // Calcoli reali dal preventivo
    const laborTotal = laborHours * laborPrice;
    const subtotal = subtotalParts + laborTotal;
    const taxRate = 22;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    // Formattazione come nel preventivo
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Subtotale
    doc.text("Subtotale:", 145, totalsY + 5);
    const subtotalFormatted = new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(subtotal);
    doc.text(subtotalFormatted, 190, totalsY + 5, { align: 'right' });

    // IVA
    doc.text(`IVA (${taxRate}%):`, 145, totalsY + 15);
    const taxFormatted = new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(taxAmount);
    doc.text(taxFormatted, 190, totalsY + 15, { align: 'right' });

    // Linea separatrice
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(145, totalsY + 22, 190, totalsY + 22);

    // Totale finale
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Totale (IVA incl):', 145, totalsY + 30);

    // Valore totale in arancione
    doc.setFontSize(14); 
    doc.setTextColor(236, 107, 0);
    doc.setFont('helvetica', 'bold');
    
    const totalFormatted = new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(totalAmount);
    doc.text(totalFormatted, 190, totalsY + 30, { align: 'right' });

    costsPageY = totalsY + 50;
  }

  // ==================== RIEPILOGO SINTETICO ====================
  
  if (costsPageY < 220) {
    doc.setFillColor(248, 249, 250);
    doc.rect(14, costsPageY, 180, 40, "F");
    doc.setDrawColor(220, 221, 225);
    doc.setLineWidth(0.2);
    doc.rect(14, costsPageY, 180, 40);

    doc.setFontSize(10);
    doc.setTextColor(73, 80, 87);
    doc.text("DETTAGLIO COSTI:", 18, costsPageY + 8);
    
    doc.setFontSize(8);
    const ricambiCount = quoteParts?.length || 0;
    const laborTotalAmount = laborHours * laborPrice;
    
    doc.text(`• ${ricambiCount} ricambi sostituiti`, 18, costsPageY + 14);
    if (laborHours > 0) {
      doc.text(`• ${laborHours.toFixed(1)} ore di manodopera`, 18, costsPageY + 18);
    }
    doc.text(`• Totale ricambi: € ${subtotalParts.toFixed(2)}`, 18, costsPageY + 22);
    if (laborTotalAmount > 0) {
      doc.text(`• Totale mano dopera: € ${laborTotalAmount.toFixed(2)}`, 18, costsPageY + 26);
    }
    const totalWithTax = subtotalParts + laborTotalAmount + ((subtotalParts + laborTotalAmount) * 0.22);
    if (totalWithTax > 0) {
      doc.text(`• Totale IVA (22%): € ${(totalWithTax - subtotalParts - laborTotalAmount).toFixed(2)}`, 18, costsPageY + 30);
    }
  }
  
  // ==================== CHECKLIST SECTION (SOLO CONTROLLATI) ====================
  
  // Filtra la checklist per escludere "non_controllato"
  const filteredChecklist = checklist.filter(item => item.status !== 'non_controllato');
  
  if (filteredChecklist && filteredChecklist.length > 0) {
    // Nuova pagina per la checklist se necessario
    doc.addPage();
    currentY = 20;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Checklist Controlli', 20, currentY);
    doc.setFont('helvetica', 'normal');
    
    currentY += 10;
    
    // Funzione per ordinare le categorie secondo la priorità desiderata
    const getCategoryOrder = (category: string): number => {
      const orderMap: { [key: string]: number } = {
        'CONTROLLO MOTORE': 1,
        'STERZO AUTO': 2,
        'ILLUMINAZIONE': 3,
        'CLIMATIZZAZIONE': 4,
        'IMPIANTO FRENANTE': 5,
        'SOSPENSIONE ANTERIORE': 6,
        'SOSPENSIONE POSTERIORE': 7,
        'TRASMISSIONE ANT/POST': 8,
        'IMPIANTO DI SCARICO': 9,
        'PNEUMATICI': 10,
        'IMPIANTO ELETTRICO': 11,
        'ALTRO': 12,
      };
      return orderMap[category] || 999; // Le categorie non mappate vanno alla fine
    };
    
    // Group checklist by category
    const checklistByCategory = filteredChecklist.reduce((acc, item) => {
      const category = item.itemCategory || 'Generale';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ChecklistItem[]>);
    
    // Ordina le categorie secondo la priorità desiderata
    const sortedCategories = Object.keys(checklistByCategory).sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b));
    
    // Display each category as a separate table
    sortedCategories.forEach((category) => {
      if (currentY > 200) {
        doc.addPage();
        currentY = 20;
      }
      
      // Prepara i dati per la tabella di questa categoria con note integrate
      const categoryData: any[] = [];
      
      checklistByCategory[category].forEach((item) => {
        const statusText = item.status === 'ok' ? 'OK' : 
                          item.status === 'da_sostituire' ? 'Da sostituire' :
                          item.status === 'sostituito' ? 'Sostituito' :
                          item.status === 'attenzione' ? 'Attenzione' :
                          'Non controllato';
        
        // Aggiungi la riga principale
        categoryData.push({
          element: item.itemName,
          status: statusText,
          itemStatus: item.status,
          isNote: false
        });
        
        // Se ci sono note, aggiungi una riga nota
        if (item.notes && item.notes.trim().length > 0) {
          categoryData.push({
            element: `NOTE: ${item.notes.trim()}`,
            status: '',
            itemStatus: item.status,
            isNote: true
          });
        }
      });
      
      // Converte in formato per autoTable
      const tableData = categoryData.map(row => [row.element, row.status]);
      
      // Header con titolo categoria integrato (solo 2 colonne)
      const tableHeaders = [category.toUpperCase(), 'Stato'];
      
      // Crea la tabella per questa categoria
      try {
        autoTable(doc, {
          head: [tableHeaders],
          body: tableData,
          startY: currentY,
          margin: { left: 20, right: 20 },
          styles: { 
            fontSize: 8, 
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'wrap',
            lineColor: [0, 0, 0], // Contorno nero per tutte le celle
            lineWidth: 0.3
          },
          headStyles: { 
            fillColor: [236, 107, 0], // Arancione per l'header
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineColor: [0, 0, 0], // Contorno nero
            lineWidth: 0.5,
            halign: 'center' // Centra gli header
          },
          columnStyles: {
            0: { cellWidth: 120 }, // Elemento/Categoria
            1: { cellWidth: 40, halign: 'center' } // Stato
          },
          didParseCell: function(data) {
            const rowIndex = data.row.index;
            const rowData = categoryData[rowIndex];
            const nextRowData = categoryData[rowIndex + 1];
            const prevRowData = categoryData[rowIndex - 1];
            const isLastRow = rowIndex === categoryData.length - 1;
            
            if (data.section === 'body') {
              if (rowData && rowData.isNote) {
                // Riga di nota - applica stile note (STESSO COLORE DELL'ELEMENTO)
                let fillColor: [number, number, number];
                let textColor: [number, number, number];
                
                switch (rowData.itemStatus) {
                  case 'ok':
                    fillColor = [255, 255, 255]; // Bianco (invece di verde)
                    textColor = [31, 41, 55]; // Grigio scuro per contrasto (invece di verde)
                    break;
                  case 'da_sostituire':
                    fillColor = [254, 226, 226]; // STESSO ROSSO DELL'ELEMENTO
                    textColor = [185, 28, 28]; // Rosso più scuro per maggior contrasto
                    break;
                  case 'sostituito':
                    fillColor = [220, 252, 231]; // Verde chiaro (invece di blu)
                    textColor = [21, 128, 61]; // Verde scuro per maggior contrasto (invece di blu)
                    break;
                  case 'attenzione':
                    fillColor = [254, 243, 199]; // STESSO GIALLO DELL'ELEMENTO
                    textColor = [180, 83, 9]; // Arancione scuro per maggior contrasto
                    break;
                  default:
                    fillColor = [248, 249, 250]; // STESSO GRIGIO DELL'ELEMENTO
                    textColor = [31, 41, 55]; // Grigio molto scuro per maggior contrasto
                }
                
                data.cell.styles.fillColor = fillColor;
                data.cell.styles.textColor = textColor;
                data.cell.styles.fontSize = 7;
                data.cell.styles.fontStyle = 'italic';
                
                // NOTA: Spanna sempre su entrambe le colonne e rimuovi tutti i bordi interni
                if (data.column.index === 0) {
                  data.cell.colSpan = 2;
                  data.cell.styles.lineWidth = { 
                    top: 0,        // Nessun bordo superiore (si attacca all'elemento)
                    right: 0.3,    // Bordo destro tabella
                    bottom: isLastRow ? 0.3 : 0.3,  // Bordo inferiore sempre presente
                    left: 0.3      // Bordo sinistro tabella
                  };
                }
              } else if (rowData && !rowData.isNote) {
                // Riga normale - gestisci ogni cella individualmente
                
                // Determina il colore in base allo stato dell'elemento
                const statusText = rowData.status;
                let fillColor: [number, number, number];
                let textColor: [number, number, number];
                
                switch (statusText) {
                  case 'OK':
                    fillColor = [255, 255, 255]; // Bianco (invece di verde)
                    break;
                  case 'Da sostituire':
                    fillColor = [254, 226, 226]; // Rosso chiaro
                    break;
                  case 'Sostituito':
                    fillColor = [220, 252, 231]; // Verde chiaro (invece di blu)
                    break;
                  case 'Attenzione':
                    fillColor = [254, 243, 199]; // Giallo chiaro
                    break;
                  default:
                    fillColor = [248, 249, 250]; // Grigio chiaro
                }
                
                // Applica sempre lo stesso colore di sfondo
                data.cell.styles.fillColor = fillColor;
                
                if (data.column.index === 0) {
                  // Prima colonna (elemento) - testo scuro normale
                  switch (statusText) {
                    case 'OK':
                      textColor = [31, 41, 55]; // Grigio scuro (invece di verde)
                      break;
                    case 'Da sostituire':
                      textColor = [185, 28, 28]; // Rosso scuro
                      break;
                    case 'Sostituito':
                      textColor = [21, 128, 61]; // Verde scuro (invece di blu)
                      break;
                    case 'Attenzione':
                      textColor = [180, 83, 9]; // Arancione scuro
                      break;
                    default:
                      textColor = [31, 41, 55]; // Grigio scuro
                  }
                  data.cell.styles.textColor = textColor;
                  
                  // Bordi prima colonna
                  data.cell.styles.lineWidth = { 
                    top: 0.3,      // Bordo superiore sempre presente
                    right: 0,      // MAI linea verticale interna
                    bottom: (nextRowData && nextRowData.isNote) ? 0 : (isLastRow ? 0.3 : 0.3), // Nessun bordo se c'è nota sotto
                    left: 0.3      // Bordo sinistro tabella
                  };
                  
                } else if (data.column.index === 1) {
                  // Seconda colonna (stato) - testo MOLTO più scuro per contrasto
                  switch (statusText) {
                    case 'OK':
                      textColor = [17, 24, 39]; // Grigio scurissimo (invece di verde)
                      break;
                    case 'Da sostituire':
                      textColor = [127, 29, 29]; // Rosso scurissimo
                      break;
                    case 'Sostituito':
                      textColor = [5, 46, 22]; // Verde scurissimo quasi nero (invece di blu)
                      break;
                    case 'Attenzione':
                      textColor = [92, 46, 2]; // Arancione scurissimo
                      break;
                    default:
                      textColor = [17, 24, 39]; // Grigio scurissimo
                  }
                  data.cell.styles.textColor = textColor;
                  
                  // Bordi seconda colonna
                  data.cell.styles.lineWidth = { 
                    top: 0.3,      // Bordo superiore sempre presente
                    right: 0.3,    // Bordo destro tabella
                    bottom: (nextRowData && nextRowData.isNote) ? 0 : (isLastRow ? 0.3 : 0.3), // Nessun bordo se c'è nota sotto
                    left: 0        // MAI linea verticale interna
                  };
                  
                  // Stato in grassetto
                  data.cell.styles.fontStyle = 'bold';
                  
                  // Se c'è una nota sotto, espandi verticalmente
                  if (nextRowData && nextRowData.isNote) {
                    data.cell.rowSpan = 2;
                    data.cell.styles.valign = 'top'; // Allinea in alto invece che al centro
                  }
                }
              }
            }
          },
          tableWidth: 'auto',
        });
        
        currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : currentY + 50;
      } catch (error) {
        console.error('Errore nella generazione della tabella checklist:', error);
        currentY += 20;
      }
    });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setDrawColor(236, 107, 0);
  doc.setLineWidth(0.2);
  doc.line(10, pageHeight - 25, 200, pageHeight - 25);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Report generato automaticamente da AutoExpress', 10, pageHeight - 15);
  doc.text(`Generato il: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}`, 10, pageHeight - 10);
  
  // Save the PDF
  doc.save(`Lavorazione_${vehicleId}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};