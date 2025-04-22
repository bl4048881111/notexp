import { Client, Appointment, Quote } from "@shared/schema";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Export clients to Excel
export const exportClientsToExcel = async (clients: Client[]): Promise<void> => {
  // Format clients data for export
  const formattedClients = clients.map(client => ({
    Codice: client.id,
    Nome: client.name,
    Cognome: client.surname,
    Telefono: client.phone,
    Email: client.email,
    Targa: client.plate,
    Modello: client.model,
    'Data Aggiunta': format(new Date(client.createdAt), 'dd/MM/yyyy', { locale: it })
  }));
  
  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(formattedClients);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clienti");
  
  // Generate file name
  const fileName = `Clienti_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  
  // Export to file
  XLSX.writeFile(workbook, fileName);
};

// Export appointments to Excel
export const exportAppointmentsToExcel = async (appointments: Appointment[]): Promise<void> => {
  // Format appointments data for export
  const formattedAppointments = appointments.map(appointment => ({
    Codice: appointment.id,
    Data: format(new Date(appointment.date), 'dd/MM/yyyy', { locale: it }),
    Ora: appointment.time,
    Durata: `${appointment.duration} min`,
    Cliente: appointment.clientName,
    Telefono: appointment.phone,
    Veicolo: appointment.model,
    Targa: appointment.plate,
    Servizi: appointment.services.join(", "),
    Note: appointment.notes || "",
    Stato: appointment.status
  }));
  
  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(formattedAppointments);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Appuntamenti");
  
  // Generate file name
  const fileName = `Appuntamenti_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  
  // Export to file
  XLSX.writeFile(workbook, fileName);
};

// Export appointments to PDF
export const exportAppointmentsToPDF = async (appointments: Appointment[]): Promise<void> => {
  // Create PDF document
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text("Elenco Appuntamenti", 14, 22);
  doc.setFontSize(11);
  doc.text(`Generato il ${format(new Date(), 'dd/MM/yyyy', { locale: it })}`, 14, 30);
  
  // Format data for table
  const tableRows = appointments.map(appointment => [
    appointment.id,
    format(new Date(appointment.date), 'dd/MM/yyyy', { locale: it }),
    appointment.time,
    appointment.clientName,
    appointment.plate,
    appointment.services.join(", "),
    appointment.status
  ]);
  
  // Add table
  (doc as any).autoTable({
    startY: 40,
    head: [["Codice", "Data", "Ora", "Cliente", "Targa", "Servizi", "Stato"]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [255, 87, 34], textColor: [255, 255, 255] }
  });
  
  // Generate file name
  const fileName = `Appuntamenti_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  // Export to file
  doc.save(fileName);
};

// Export quotes to Excel
export const exportQuotesToExcel = async (quotes: Quote[]): Promise<void> => {
  // Format quotes data for export
  const formattedQuotes = quotes.map(quote => ({
    Codice: quote.id,
    Data: format(new Date(quote.createdAt), 'dd/MM/yyyy', { locale: it }),
    'Valido Fino': quote.validUntil ? format(new Date(quote.validUntil), 'dd/MM/yyyy', { locale: it }) : 'N/A',
    Cliente: quote.clientName,
    Telefono: quote.phone,
    Veicolo: quote.model,
    Targa: quote.plate,
    'Numero Servizi': quote.items.length,
    Subtotale: quote.subtotal.toFixed(2) + ' €',
    'IVA (%)': quote.taxRate + '%',
    'Importo IVA': quote.taxAmount.toFixed(2) + ' €',
    Totale: quote.total.toFixed(2) + ' €',
    Stato: quote.status,
    Note: quote.notes || ""
  }));
  
  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(formattedQuotes);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Preventivi");
  
  // Generate file name
  const fileName = `Preventivi_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  
  // Export to file
  XLSX.writeFile(workbook, fileName);
};

// Export a single quote to PDF for client
export const exportQuoteToPDF = async (quote: Quote): Promise<void> => {
  // Create PDF document
  const doc = new jsPDF();
  
  // Add heading - Company name and logo
  doc.setFontSize(22);
  doc.setTextColor(255, 87, 34); // Orange color
  doc.text("Auto", 14, 22);
  doc.setTextColor(0, 0, 0);
  doc.text("eXpress", 33, 22);
  
  // Add subtitle
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("Preventivo", 14, 30);
  
  // Add quote info
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // Left side info - Quote details
  doc.text(`Preventivo n°: ${quote.id}`, 14, 45);
  doc.text(`Data: ${format(new Date(quote.createdAt), 'dd/MM/yyyy', { locale: it })}`, 14, 52);
  doc.text(`Valido fino al: ${quote.validUntil ? format(new Date(quote.validUntil), 'dd/MM/yyyy', { locale: it }) : 'N/A'}`, 14, 59);
  doc.text(`Stato: ${quote.status}`, 14, 66);
  
  // Right side info - Client details
  doc.text(`Cliente: ${quote.clientName}`, 120, 45);
  doc.text(`Telefono: ${quote.phone}`, 120, 52);
  doc.text(`Veicolo: ${quote.model}`, 120, 59);
  doc.text(`Targa: ${quote.plate}`, 120, 66);
  
  // Add items table
  const tableRows = quote.items.map(item => [
    item.serviceType.name,
    item.description || item.serviceType.description || "",
    `€${item.laborPrice.toFixed(2)}`,
    item.laborHours.toString(),
    `€${(item.laborPrice * item.laborHours).toFixed(2)}`,
    `€${item.parts.reduce((sum, part) => sum + part.finalPrice, 0).toFixed(2)}`,
    `€${item.totalPrice.toFixed(2)}`
  ]);
  
  // Add table
  (doc as any).autoTable({
    startY: 75,
    head: [["Servizio", "Descrizione", "Costo/ora", "Ore", "Manodopera", "Ricambi", "Totale"]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [255, 87, 34], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 50 },
    },
    foot: [
      [
        { content: "", colSpan: 5 },
        "Subtotale:",
        `€${quote.subtotal.toFixed(2)}`
      ],
      [
        { content: "", colSpan: 5 },
        `IVA (${quote.taxRate}%):`,
        `€${quote.taxAmount.toFixed(2)}`
      ],
      [
        { content: "", colSpan: 5 },
        { content: "TOTALE:", styles: { fontStyle: 'bold' } },
        { content: `€${quote.total.toFixed(2)}`, styles: { fontStyle: 'bold' } }
      ]
    ]
  });
  
  // Add notes if they exist
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  
  if (quote.notes) {
    doc.setFontSize(11);
    doc.text("Note:", 14, finalY + 10);
    doc.setFontSize(10);
    
    const splitNotes = doc.splitTextToSize(quote.notes, 180);
    doc.text(splitNotes, 14, finalY + 18);
  }
  
  // Add footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("AutoeXpress - Via Roma 123 - 00100 Roma - Tel: 06 12345678 - P.IVA: 12345678901", 14, pageHeight - 10);
  
  // Generate file name
  const fileName = `Preventivo_${quote.id}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  // Export to file
  doc.save(fileName);
};
