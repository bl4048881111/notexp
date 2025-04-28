// Funzione per raggruppare i ricambi per tipo, usata in più pagine
export function raggruppaPerTipoRicambio(orders: any[], search: string, appointments: any[]) {
  const testo = search.trim().toLowerCase();
  const result: Record<string, any[]> = {};
  // Mappa rapida degli appuntamenti per clientId
  const appointmentsByClientId: Record<string, any> = {};
  appointments.forEach(app => {
    if (app.clientId) appointmentsByClientId[app.clientId] = app;
  });
  orders.forEach(order => {
    order.items?.forEach((item: any) => {
      item.parts?.forEach((part: any) => {
        const tipoRicambio = part.name || "Senza tipo";
        if (
          testo &&
          !(
            (order.clientName && order.clientName.toLowerCase().includes(testo)) ||
            (order.clientId && order.clientId.toLowerCase().includes(testo))
          )
        )
          return;
        if (!result[tipoRicambio]) result[tipoRicambio] = [];
        // Stato partsOrdered preso dall'appuntamento corrispondente
        const stato = appointmentsByClientId[order.clientId]?.partsOrdered;
        result[tipoRicambio].push({
          code: part.code,
          quantity: part.quantity || 0,
          clientId: order.clientId,
          clientName: order.clientName,
          plate: order.plate,
          partsOrdered: stato,
        });
      });
    });
  });
  return result;
} 