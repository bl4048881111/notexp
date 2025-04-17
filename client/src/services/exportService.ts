import { Client, Appointment } from "@shared/types";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';
import 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.7.0/+esm';

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
