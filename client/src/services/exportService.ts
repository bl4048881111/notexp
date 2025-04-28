import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Appointment, Quote } from '@shared/schema';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { text } from 'body-parser';

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

// Export quotes to Excel
export const exportQuotesToExcel = async (quotes: Quote[]): Promise<void> => {
  // Format the quotes data for Excel
  const data = quotes.map(quote => ({
    'ID': quote.id,
    'Cliente': quote.clientName,
    'Telefono': quote.phone,
    'Veicolo': quote.model,
    'Targa': quote.plate,
    'Data': format(new Date(quote.date), 'dd/MM/yyyy', { locale: it }),
    'Subtotale': `€${quote.subtotal.toFixed(2)}`,
    'IVA': `€${quote.taxAmount.toFixed(2)}`,
    'Totale': `€${quote.total.toFixed(2)}`,
    'Stato': quote.status,
  }));
  
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
  // Create new PDF document
  const doc = new jsPDF();
  
  // Add company name
  doc.setFontSize(22);
  doc.setTextColor(236, 107, 0); // Orange
  doc.text('Auto eXpress', 14, 22);
  
  // Add company info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Gray
  doc.text('AutoExpress Monopoli', 14, 30);
  doc.text('Via Eugenio Montale 4', 14, 36);
  doc.text('Tel: 329 9605884', 14, 42);
  doc.text('70043 Monopoli BA', 14, 48);
  
  // Add quote title and info
  doc.setFontSize(18);
  doc.setTextColor(236, 107, 0);
  doc.text('Preventivo', 14, 64);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`ID: ${quote.id}`, 14, 72);
  doc.text(`Data: ${format(new Date(quote.date), 'dd/MM/yyyy', { locale: it })}`, 14, 78);
  doc.text(`Stato: ${quote.status.toUpperCase()}`, 14, 84);
  
  // Add client info
  doc.setFontSize(18);
  doc.setTextColor(236, 107, 0);
  doc.text('Dati Cliente', 120, 64);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Cliente: ${quote.clientName}`, 120, 72);
  doc.text(`Telefono: ${quote.phone}`, 120, 78);
  doc.text(`Targa: ${quote.plate}`, 120, 84);
  
  // Aggiungi VIN solo se realmente presente
  if (quote.vin && quote.vin.trim() !== '') {
    doc.text(`VIN: ${quote.vin}`, 120, 90);
  }
  
  // Aggiungi sezione manodopera se presente
  if (quote.laborHours && quote.laborHours > 0 && quote.laborPrice && quote.laborPrice > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Manodopera', 14, 104);
    doc.setFont('helvetica', 'normal');
    
    autoTable(doc, {
      head: [['Descrizione', 'Ore', 'Prezzo Orario', 'Totale']],
      body: [['Manodopera', 
              quote.laborHours.toString(), 
              `€${quote.laborPrice.toFixed(2)}`, 
              `€${(quote.laborHours * quote.laborPrice).toFixed(2)}`]],
      startY: 108,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [236, 107, 0] }, // Orange header
    });
  }
  
  // Add spare parts table
  let hasAnyParts = false;
  let lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 108;
  
  // Raccolgo tutti i ricambi in un'unica tabella
  const allParts: any[] = [];
  
  // Raccogliamo i ricambi da tutti i servizi
  quote.items.forEach((item) => {
    if (Array.isArray(item.parts) && item.parts.length > 0) {
      hasAnyParts = true;
      
      // Aggiungo ogni ricambio con riferimento al servizio
      item.parts
        .filter(part => part && part.code)
        .forEach(part => {
          allParts.push([
            part.brand || 'N/D',
            part.name || 'Ricambio',
            item.serviceType.name,
            part.quantity || 1,
            `€${(part.unitPrice || 0).toFixed(2)}`,
            `€${(part.finalPrice || 0).toFixed(2)}`,
          ]);
        });
    }
  });
  
  // Se ci sono ricambi, mostriamo l'intestazione e la tabella
  if (hasAnyParts) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Ricambi', 14, lastY);
    doc.setFont('helvetica', 'normal');
    
    try {
      // Creiamo un'unica tabella con tutti i ricambi
      autoTable(doc, {
        head: [['Brand', 'Descrizione', 'Servizio', 'Quantità', 'Prezzo Unitario', 'Prezzo Finale']],
        body: allParts,
        startY: lastY + 4,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [236, 107, 0] },
      });
    } catch (error) {
      console.error('Errore nella generazione della tabella ricambi:', error);
      doc.setFontSize(8);
      doc.setTextColor(255, 0, 0);
      doc.text('Errore nella visualizzazione dei ricambi', 14, lastY + 4);
      doc.setTextColor(0, 0, 0);
    }
  } else {
    // Se non ci sono ricambi, mostra un messaggio
    doc.setFontSize(10);
    doc.text('Nessun ricambio incluso nel preventivo', 14, lastY);
  }
  
  // Add totals
  const totalsY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(10);
  doc.text('Subtotale:', 140, totalsY);
  doc.text(`€${quote.subtotal.toFixed(2)}`, 180, totalsY, { align: 'right' });
  
  doc.text(`IVA (${quote.taxRate}%):`, 140, totalsY + 6);
  doc.text(`€${quote.taxAmount.toFixed(2)}`, 180, totalsY + 6, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTALE:', 140, totalsY + 14);
  doc.text(`€${quote.total.toFixed(2)}`, 180, totalsY + 14, { align: 'right' });
  
  // Add notes if any
  if (quote.notes) {
    const notesY = totalsY + 25;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Note:', 14, notesY);
    doc.text(quote.notes, 14, notesY + 6);
  }
  
  // Add footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100); // Gray
  doc.text('I prezzi indicati sono IVA esclusa.', 14, pageHeight - 6);
  doc.text('Il presente preventivo è stato redatto sulla base di banche dati disponibili e potrebbe contenere inesattezze.', 12, pageHeight - 15);
  doc.text(' La validazione definitiva avverrà esclusivamente al momento dell\'installazione dei ricambi.', 12, pageHeight - 12);
  // Save the PDF
  doc.save(`Preventivo_${quote.id}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};