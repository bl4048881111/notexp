import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "@/components/ui/table";
import { getAllAppointments, getQuoteById, getWorkPhaseByVehicleId, getAllQuotes } from "@shared/supabase";
import { Appointment, SparePart } from "@shared/types";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';

interface Sostituzione {
  partCode: string;
  brand: string;
  description: string;
  quantity: number;
  clientId: string;
  clientName: string;
  plate: string;
  date: string;
  unitPrice: number;
  unitPriceFormatted: string;
  quoteId: string;
  status: string;
}

export default function PartiSostituitePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Sostituzione[]>([]);
  const [filtered, setFiltered] = useState<Sostituzione[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const isClient = !!user?.clientId;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Prendi tutti i preventivi
      const quotes = await getAllQuotes();
      // Filtra solo quelli accettati o completati
      const completedQuotes = quotes.filter(q => q.status === "accettato" || q.status === "completato");
      const sostituzioni: Sostituzione[] = [];
      for (const quote of completedQuotes) {
        const items = quote.items || [];
        let hasItems = Array.isArray(items) && items.length > 0;
        if (hasItems) {
          items.forEach((item: any) => {
            if (Array.isArray(item.parts)) {
              item.parts.forEach((part: any) => {
                sostituzioni.push({
                  partCode: part.code || "-",
                  brand: part.brand || part.description || part.name || "-",
                  description: part.description || part.name || "-",
                  quantity: part.quantity || 1,
                  clientId: quote.clientId || "-",
                  clientName: quote.clientName || "-",
                  plate: quote.plate || "-",
                  date: quote.date ? format(new Date(quote.date), "dd/MM/yyyy", { locale: it }) : "-",
                  unitPrice: part.unitPrice || part.price || 0,
                  unitPriceFormatted: (part.unitPrice || part.price) ? (part.unitPrice || part.price).toLocaleString('it-IT') : "0,00",
                  status: quote.status || "-",
                  quoteId: quote.id || "-",
                });
              });
            }
          });
        } else if (Array.isArray(quote.parts)) {
          quote.parts.forEach((part: any) => {
            sostituzioni.push({
              partCode: part.code || "-",
              brand: part.brand || part.description || part.name || "-",
              description: part.description || part.name || "-",
              quantity: part.quantity || 1,
              clientId: quote.clientId || "-",
              clientName: quote.clientName || "-",
              plate: quote.plate || "-",
              date: quote.date ? format(new Date(quote.date), "dd/MM/yyyy", { locale: it }) : "-",
              unitPrice: part.unitPrice || part.price || 0,
              unitPriceFormatted: (part.unitPrice || part.price) ? (part.unitPrice || part.price).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : "0,00",
              quoteId: quote.id || "-",
              status: quote.status || "-",
            });
          });
        }
      }
      setData(sostituzioni);
      setLoading(false);
    }
    fetchData();
  }, [user?.clientId]);

  useEffect(() => {
    let rows = data;
    // Se cliente, filtra solo le sue parti
    if (user?.clientId) {
      rows = rows.filter(r => r.clientId === user.clientId);
    }
    // Ricerca full-text
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        Object.values(r).some(val => String(val).toLowerCase().includes(q))
      );
    }
    // Ordina dalla data più recente (dal più nuovo al più vecchio)
    rows = rows.sort((a, b) => {
      const da = a.date.split('/').reverse().join('-');
      const db = b.date.split('/').reverse().join('-');
      return new Date(db).getTime() - new Date(da).getTime();
    });
    setFiltered(rows);
    setPage(1); // Reset pagina quando cambia filtro
  }, [data, search, user]);

  // Paginazione
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="w-full px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Parti Sostituite</h1>
      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="Cerca per codice, brand, cliente, targa, data..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-0"
        />
        <Button
          variant="outline"
          className="flex items-center gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700 transition-colors"
          onClick={() => {
            // Esportazione Excel di tutti i dati
            const exportData = data.map(row => ({
              'Codice': row.partCode,
              'Brand': row.brand,
              'Descrizione': row.description,
              'Quantità': row.quantity,
              'Prezzo unità': row.unitPriceFormatted,
              'Stato': row.status,
              'Codice cliente': row.clientId,
              'Preventivo': row.quoteId,
              'Nome cliente': row.clientName,
              'Targa': row.plate,
              'Data': row.date
            }));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, "Parti Sostituite");
            XLSX.writeFile(wb, `parti_sostituite_${new Date().toISOString().split('T')[0]}.xlsx`);
          }}
        >
          <FileDown className="w-5 h-5" />
          Esporta Excel
        </Button>
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-12">Caricamento dati...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessuna parte sostituita trovata per appuntamenti completati.</div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[1400px]">
            <TableHeader>
              <TableRow>
                {!isClient && (
                  <TableHead className="text-orange-500">Codice ricambio</TableHead>
                )}
                <TableHead>Brand</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Quantità</TableHead>
                <TableHead>Prezzo unità</TableHead>
                {!isClient && (
                  <>
                    <TableHead>Codice cliente</TableHead>
                    <TableHead>Preventivo</TableHead>
                  </>
                )}
                <TableHead>Nome cliente</TableHead>
                <TableHead>Targa veicolo</TableHead>
                <TableHead>Data sostituzione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((row, idx) => (
                <TableRow key={idx}>
                  {!isClient && (
                    <TableCell className="text-orange-500">{row.partCode}</TableCell>
                  )}
                  <TableCell>{row.brand}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                  <TableCell>{row.unitPriceFormatted}</TableCell>
                  {!isClient && (
                    <>
                      <TableCell>{row.clientId}</TableCell>
                      <TableCell>{row.quoteId}</TableCell>
                    </>
                  )}
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>{row.plate}</TableCell>
                  <TableCell>{row.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Paginazione */}
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            className="px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-50"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`px-3 py-1 rounded ${page === i + 1 ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white'}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-50"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            &gt;
          </button>
        </div>
        </>
      )}
    </div>
  );
} 