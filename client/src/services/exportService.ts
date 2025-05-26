import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Appointment, Quote } from '@shared/schema';
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
    'Data Registrazione': format(new Date(client.createdAt), 'dd/MM/yyyy', { locale: it }),
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
                ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) 
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
            const name = part.name?.trim() || 'Ricambio';
            const brand = part.brand?.trim() || '';
            
            allParts.push([
              brand,
              name,
              item.serviceType.name,
              part.quantity || 1,
              `€${(part.unitPrice || 0).toFixed(2)}`,
              `€${(part.finalPrice || 0).toFixed(2)}`,
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
              ? item.parts.reduce((sum, part) => sum + (part.finalPrice || 0), 0) 
              : 0);
          }, 0)
        : (extendedQuote.subtotal || 0));
    
  const laborHours = extendedQuote.laborHours || 0;
  const laborPrice = extendedQuote.laborPrice || 0;
  
  // SOLO manodopera extra, NO manodopera servizi
  const laborTotal = laborHours * laborPrice;
    
  // Verifica che il subtotale combaci con i campi separati
  const subtotal = partsSubtotal + laborTotal;
  
  // Ricalcoliamo l'IVA sul subtotale verificato
  const taxRate = extendedQuote.taxRate || 22;
  const taxAmount = (subtotal * taxRate) / 100;
  
  // Formattazione come nell'immagine, con allineamento a destra per i valori
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
  doc.text('Totale(IVA incl):', 145, totalsY + 34);

  // Valore totale in arancione e allineato a destra - Migliorato
  doc.setFontSize(14); 
  doc.setTextColor(236, 107, 0);
  doc.setFont('helvetica', 'bold');
  
  // Rimuovo il rettangolo bianco dietro il totale che causa problemi di visualizzazione
  // e allargo lo spazio per il testo del totale
  
  const totalFormatted = new Intl.NumberFormat('it-IT', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  }).format(totalAmount);
  doc.text(totalFormatted, 190, totalsY + 35, { align: 'right' });

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
  
  // Linea di separazione
  doc.setDrawColor(236, 107, 0); // Arancione
  doc.setLineWidth(0.2);
  doc.line(20, pageHeight - 25, 190, pageHeight - 25);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100); // Gray
  
  // Footer con spaziatura migliorata e timestamp
  const footerY1 = pageHeight - 20;
  const footerY2 = pageHeight - 16;
  const footerY3 = pageHeight - 12; 
  const footerY4 = pageHeight - 8;
  const footerY5 = pageHeight - 4;
  
  doc.text('I prezzi indicati sono IVA esclusa.', 15, footerY1);
  doc.text('Il presente preventivo è stato redatto sulla base di banche dati disponibili', 15, footerY2);
  doc.text('e potrebbe contenere inesattezze.', 15, footerY3);
  doc.text('La validazione definitiva avverrà esclusivamente al momento dell\'installazione dei ricambi.', 15, footerY4);
  
  // Timestamp dell'ultima modifica
  const lastModified = extendedQuote.updatedAt || extendedQuote.lastModified || new Date().toISOString();
  const timestampText = `Ultima modifica: ${format(new Date(lastModified), 'dd/MM/yyyy HH:mm', { locale: it })}`;
  doc.setTextColor(150, 150, 150); // Grigio più chiaro per il timestamp
  doc.text(timestampText, 190, footerY5, { align: 'right' });
  
  // Save the PDF
  doc.save(`Preventivo_${extendedQuote.id}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};