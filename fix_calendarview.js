// Script per correggere il problema della navigazione del mese nel calendario

/**
 * Correzione del problema di navigazione dei mesi nel calendario
 * 
 * Il problema è che quando si preme sulle frecce per cambiare il mese nella vista mensile,
 * sebbene lo stato 'currentMonth' venga aggiornato, il componente non reagisce correttamente 
 * e la vista non cambia.
 * 
 * Istruzioni per l'implementazione:
 * 
 * 1. Nel file CalendarView.tsx, assicurarsi che le funzioni handlePreviousMonth e handleNextMonth
 *    aggiornino sia currentMonth che selectedDate.
 * 
 * 2. Aggiungere un log visibile per verificare che gli stati vengano aggiornati correttamente.
 * 
 * 3. Assicurarsi che i pulsanti di navigazione nella vista mensile utilizzino le funzioni corrette:
 *    - handlePreviousMonth per il pulsante con la freccia sinistra
 *    - handleNextMonth per il pulsante con la freccia destra
 * 
 * 4. Assicurarsi che nella visualizzazione della vista mensile l'aggiornamento di currentMonth
 *    venga considerato nella generazione dei giorni del calendario.
 * 
 * 5. Impostare correttamente le dipendenze nell'useEffect che genera i giorni del calendario
 *    perché reagisca ai cambiamenti di currentMonth.
 */

/**
 * Esempio di codice corretto per le funzioni di navigazione:
 */
const handlePreviousMonth = () => {
  const prevMonth = subMonths(currentMonth, 1);
  setCurrentMonth(prevMonth);
  console.log("Mese cambiato a:", format(prevMonth, 'MMMM yyyy'));
  
  // Aggiorna anche selectedDate mantenendo lo stesso giorno del mese se possibile
  if (selectedDate) {
    const newSelectedDate = new Date(selectedDate);
    newSelectedDate.setFullYear(prevMonth.getFullYear());
    newSelectedDate.setMonth(prevMonth.getMonth());
    setSelectedDate(newSelectedDate);
  }
};

const handleNextMonth = () => {
  const nextMonth = addMonths(currentMonth, 1);
  setCurrentMonth(nextMonth);
  console.log("Mese cambiato a:", format(nextMonth, 'MMMM yyyy'));
  
  // Aggiorna anche selectedDate mantenendo lo stesso giorno del mese se possibile
  if (selectedDate) {
    const newSelectedDate = new Date(selectedDate);
    newSelectedDate.setFullYear(nextMonth.getFullYear());
    newSelectedDate.setMonth(nextMonth.getMonth());
    setSelectedDate(newSelectedDate);
  }
};

// Assicurarsi che calendarDays venga rigenerato quando cambia currentMonth
useEffect(() => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calcola i giorni precedenti per riempire la prima settimana
  const dayOfWeek = monthStart.getDay() || 7;
  const prevMonthDays = Array.from({ length: dayOfWeek - 1 }, (_, i) => {
    return new Date(monthStart.getFullYear(), monthStart.getMonth(), -i);
  }).reverse();

  // Calcola i giorni successivi per completare la griglia
  const nextMonthDays = [];
  const totalDaysNeeded = 42;
  const daysToAdd = totalDaysNeeded - (prevMonthDays.length + daysInMonth.length);
  for (let i = 1; i <= daysToAdd; i++) {
    nextMonthDays.push(new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + i));
  }

  // Imposta l'array completo dei giorni del calendario
  setCalendarDays([...prevMonthDays, ...daysInMonth, ...nextMonthDays]);
  
  console.log("Giorni del calendario rigenerati per:", format(currentMonth, 'MMMM yyyy'));
}, [currentMonth]);



