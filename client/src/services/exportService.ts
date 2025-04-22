import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Appointment, Quote } from '@shared/schema';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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
    `${appointment.model} (${appointment.plate})`,
    format(new Date(appointment.date), 'dd/MM/yyyy', { locale: it }),
    appointment.time,
    appointment.status,
  ]);
  
  // Add table to PDF
  autoTable(doc, {
    head: [['ID', 'Cliente', 'Telefono', 'Veicolo', 'Data', 'Ora', 'Stato']],
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
  doc.text('AutoeXpress', 14, 22);
  
  // Add company info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Gray
  doc.text('Officina Meccanica', 14, 30);
  doc.text('Via Roma 123, 00100 Roma', 14, 36);
  doc.text('Tel: 06 123456789', 14, 42);
  doc.text('P.IVA: 1234567890', 14, 48);
  
  // Add quote title and info
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0); // Black
  doc.text('PREVENTIVO', 14, 64);
  
  doc.setFontSize(10);
  doc.text(`ID: ${quote.id}`, 14, 72);
  doc.text(`Data: ${format(new Date(quote.date), 'dd/MM/yyyy', { locale: it })}`, 14, 78);
  doc.text(`Stato: ${quote.status.toUpperCase()}`, 14, 84);
  
  // Add client info
  doc.setFontSize(12);
  doc.text('Dati Cliente', 120, 64);
  
  doc.setFontSize(10);
  doc.text(`Cliente: ${quote.clientName}`, 120, 72);
  doc.text(`Telefono: ${quote.phone}`, 120, 78);
  doc.text(`Veicolo: ${quote.model}`, 120, 84);
  doc.text(`Targa: ${quote.plate}`, 120, 90);
  
  // Add services table
  doc.setFontSize(12);
  doc.text('Servizi', 14, 104);
  
  // Format the services data for PDF table
  const servicesData = quote.items.map((item, index) => [
    index + 1,
    item.serviceType.name,
    item.serviceType.category,
    `€${item.serviceType.laborPrice.toFixed(2)}`,
    `${item.laborHours}h × €${item.laborPrice.toFixed(2)}`,
    `€${item.totalPrice.toFixed(2)}`,
  ]);
  
  autoTable(doc, {
    head: [['#', 'Servizio', 'Categoria', 'Prezzo', 'Manodopera', 'Totale']],
    body: servicesData,
    startY: 108,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [236, 107, 0] }, // Orange header
  });
  
  // Add spare parts table if there are any
  const allParts = quote.items.flatMap(item => item.parts);
  if (allParts.length > 0) {
    // Get the y position after the services table
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.text('Ricambi', 14, finalY);
    
    // Format the parts data for PDF table
    const partsData = allParts.filter(part => part && part.code).map(part => [
      part.code || 'N/D',
      part.name || 'Ricambio',
      part.quantity || 1,
      `€${(part.unitPrice || 0).toFixed(2)}`,
      part.brand || '',
      `€${(part.finalPrice || 0).toFixed(2)}`,
    ]);
    
    autoTable(doc, {
      head: [['Codice', 'Descrizione', 'Quantità', 'Prezzo Unitario', 'Brand', 'Prezzo Finale']],
      body: partsData,
      startY: finalY + 4,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [236, 107, 0] }, // Orange header
    });
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
  doc.text('Questo preventivo è valido per 30 giorni dalla data di emissione.', 14, pageHeight - 20);
  doc.text('I prezzi indicati sono IVA inclusa.', 14, pageHeight - 15);
  
  // Save the PDF
  doc.save(`Preventivo_${quote.id}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};