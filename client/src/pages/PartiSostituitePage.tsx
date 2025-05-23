import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "@/components/ui/table";
import { getAllAppointments, getQuoteById } from "@shared/firebase";
import { Appointment, SparePart } from "@shared/types";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ref, get } from "firebase/database";
import { rtdb } from "@/firebase";

interface Sostituzione {
  partCode: string;
  brand: string;
  description: string;
  quantity: number;
  clientId: string;
  clientName: string;
  plate: string;
  date: string;
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
      const appointments: Appointment[] = await getAllAppointments();
      const sostituzioni: Sostituzione[] = [];
      for (const app of appointments) {
        if (app.status !== "completato") continue;
        if (user?.clientId && app.clientId !== user.clientId) continue;
        // Ricambi da delivery phase
        try {
          const deliveryRef = ref(rtdb, `/deliveryPhases/${app.id}`);
          const snap = await get(deliveryRef);
          if (snap.exists()) {
            const deliveryData = snap.val();
            const items = deliveryData.items || [];
            if (Array.isArray(items)) {
              items.forEach((item: any) => {
                if (Array.isArray(item.parts)) {
                  item.parts.forEach((part: any) => {
                    sostituzioni.push({
                      partCode: part.code || "-",
                      brand: part.brand || part.description || part.name || "-",
                      description: part.description || part.name || "-",
                      quantity: part.quantity || 1,
                      clientId: app.clientId || "-",
                      clientName: app.clientName || "-",
                      plate: app.plate || "-",
                      date: app.date ? format(new Date(app.date), "dd/MM/yyyy", { locale: it }) : "-"
                    });
                  });
                }
              });
            }
          }
        } catch (e) { /* ignora errori singoli */ }
        // Ricambi dal preventivo associato
        if (app.quoteId) {
          try {
            const quote = await getQuoteById(app.quoteId);
            if (quote) {
              const items = quote.items || [];
              if (Array.isArray(items)) {
                items.forEach((item: any) => {
                  if (Array.isArray(item.parts)) {
                    item.parts.forEach((part: any) => {
                      sostituzioni.push({
                        partCode: part.code || "-",
                        brand: part.brand || part.description || part.name || "-",
                        description: part.description || part.name || "-",
                        quantity: part.quantity || 1,
                        clientId: app.clientId || "-",
                        clientName: app.clientName || "-",
                        plate: app.plate || "-",
                        date: app.date ? format(new Date(app.date), "dd/MM/yyyy", { locale: it }) : "-"
                      });
                    });
                  }
                });
              }
            }
          } catch (e) { /* ignora errori singoli */ }
        }
      }
      setData(sostituzioni);
      setLoading(false);
    }
    fetchData();
  }, []);

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
      <Input
        placeholder="Cerca per codice, brand, cliente, targa, data..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4"
      />
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
                {!isClient && (
                  <TableHead>Codice cliente</TableHead>
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
                  {!isClient && (
                    <TableCell>{row.clientId}</TableCell>
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