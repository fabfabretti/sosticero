export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayInRome = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());

export function presetRange(period: string, today: string, first: string) {
  const d = new Date(today + "T12:00:00");
  if (period === "week") d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  if (period === "month") d.setDate(1);
  return { start: period === "all" ? first : isoDate(d), end: today };
}

export function StatsCalendar({ start, end, today, month, onMonth, onSelect }: {
  start: string; end: string; today: string; month: string;
  onMonth: (month: string) => void; onSelect: (date: string) => void;
}) {
  const d = new Date(month + "T12:00:00");
  const offset = (d.getDay() + 6) % 7;
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const move = (delta: number) => onMonth(isoDate(new Date(d.getFullYear(), d.getMonth() + delta, 1)));
  return <div className="stats-calendar">
    <div className="cal-h">
      <button aria-label="Mese precedente" onClick={() => move(-1)}>‹</button>
      <b aria-live="polite">{d.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</b>
      <button aria-label="Mese successivo" onClick={() => move(1)}>›</button>
    </div>
    <div className="g" role="group" aria-label="Seleziona il periodo sul calendario">
      {["L", "M", "M", "G", "V", "S", "D"].map((w, i) => <div className="w" key={i} aria-hidden="true">{w}</div>)}
      {Array.from({ length: offset }, (_, i) => <span key={"blank" + i} />)}
      {Array.from({ length: count }, (_, i) => {
        const date = isoDate(new Date(d.getFullYear(), d.getMonth(), i + 1));
        const selected = !!start && date >= start && date <= end;
        const boundary = date === start || date === end;
        return <button key={date} className={"d" + (selected ? boundary ? " sel" : " in-range" : "")}
          aria-label={date} aria-pressed={selected} aria-current={date === today ? "date" : undefined}
          disabled={date > today} onClick={() => onSelect(date)}>{i + 1}</button>;
      })}
    </div>
  </div>;
}
