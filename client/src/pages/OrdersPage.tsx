import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllQuotes, getAllAppointments } from "@shared/firebase";
import { raggruppaPerTipoRicambio } from "@/utils/ricambi";

export default function OrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: getAllQuotes,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: getAllAppointments,
  });

  const [search, setSearch] = useState("");
  const [openTipo, setOpenTipo] = useState<string | null>(null);

  const ricambiPerTipo = raggruppaPerTipoRicambio(orders, search, appointments);
  const tipiRicambio = Object.keys(ricambiPerTipo)
    .filter(tipo => ricambiPerTipo[tipo].some(row => row.partsOrdered === false))
    .sort();

  // Calcola il numero totale di ricambi non ordinati
  const nonOrdinati = Object.values(ricambiPerTipo)
    .flat()
    .filter(row => row.partsOrdered === false).length;

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestione <span className="text-orange-500">Ordini</span></h1>
          <p className="text-gray-300">Gestisci i pezzi da ordinare</p>
        </div>
      </div>
      <div className="mb-6 flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="text"
          className="w-full sm:w-96 px-3 py-2 border border-orange-500 rounded bg-gray-900 text-orange-200 placeholder:text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
          placeholder="Cerca per nome cliente o codice cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-10 w-full mb-4 bg-gray-900" />
      ) : tipiRicambio.length === 0 ? (
        <div className="text-center p-4 text-orange-300 bg-gray-900 rounded">
          Nessun ricambio da ordinare
        </div>
      ) : (
        <div className="space-y-4">
          {tipiRicambio.map(tipo => {
            const totali = ricambiPerTipo[tipo].length;
            const ordinatiTipo = ricambiPerTipo[tipo].filter(row => row.partsOrdered === true).length;
            return (
              <div key={tipo} className="bg-gray-900/80 rounded-lg shadow border border-orange-700">
                <button
                  className={`w-full text-left px-4 py-3 font-bold text-lg text-orange-400 tracking-wide uppercase flex items-center justify-between focus:outline-none transition ${
                    openTipo === tipo ? 'bg-orange-950/80' : 'bg-orange-950/40'
                  }`}
                  onClick={() => setOpenTipo(openTipo === tipo ? null : tipo)}
                >
                  <span>{tipo}</span>
                  <span className="flex items-center gap-3">
                    <span className={`font-semibold text-base ${ordinatiTipo === totali ? "text-green-500" : "text-red-500"}`}>
                      {ordinatiTipo}/{totali}
                    </span>
                    <span className="text-orange-300 text-xl">{openTipo === tipo ? "−" : "+"}</span>
                  </span>
                </button>
                {openTipo === tipo && (
                  <div className="overflow-x-auto pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-orange-950/60">
                          <TableHead className="text-orange-300">Stato</TableHead>
                          <TableHead className="text-orange-300">Codice Articolo</TableHead>
                          <TableHead className="text-orange-300">Cognome</TableHead>
                          <TableHead className="text-orange-300">Nome</TableHead>
                          <TableHead className="text-orange-300">Codice Cliente</TableHead>
                          <TableHead className="text-orange-300">QTA Ricambio</TableHead>
                          <TableHead className="text-orange-300">Targa Veicolo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ricambiPerTipo[tipo]
                          .filter(row => row.partsOrdered === false)
                          .map((row, idx) => {
                            let nome = "-", cognome = "-";
                            if (row.clientName) {
                              const parts = row.clientName.trim().split(" ");
                              cognome = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
                              nome = parts[0];
                            }
                            return (
                              <TableRow
                                key={row.code + row.clientId + row.plate + idx}
                                className="hover:bg-orange-900/30 transition"
                              >
                                <TableCell>
                                  <span
                                    title={row.partsOrdered ? "Ordinato" : "Non ordinato"}
                                    className={`inline-block w-3 h-3 rounded-full mr-1 align-middle ${row.partsOrdered ? "bg-green-500" : "bg-red-600"}`}
                                    style={{ boxShadow: row.partsOrdered ? "0 0 6px #22c55e" : "0 0 6px #dc2626" }}
                                  ></span>
                                </TableCell>
                                <TableCell className="text-orange-100">{row.code}</TableCell>
                                <TableCell className="text-orange-100">{cognome}</TableCell>
                                <TableCell className="text-orange-100">{nome}</TableCell>
                                <TableCell className="text-orange-100">{row.clientId}</TableCell>
                                <TableCell className="text-orange-100">{row.quantity}</TableCell>
                                <TableCell className="text-orange-100">{row.plate}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 