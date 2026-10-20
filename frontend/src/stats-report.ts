export type Counts = { teachers: number; teacherHours: number; demand: number; covered: number; uncovered: number; late: number; early: number; pending: number };
export type Metric = "teachers" | "teacherHours" | "demand";
export type StatReport = {
  campus: string; period: string; start: string; end: string; days: number;
  totals: Counts; averages: Record<keyof Counts, number | null>; coverage: number | null;
  daily: (Counts & { date: string })[];
  weekdays: (Record<keyof Counts, number | null> & { weekday: number; days: number })[];
  hours: { hour: number; teachers: number | null; teacherHours: number | null; demand: number | null }[];
  heatmap: { weekday: number; hour: number; days: number; teachers: number | null; teacherHours: number | null; demand: number | null; observations: { date: string; teachers: number; teacherHours: number; demand: number }[] }[];
  types: Record<string, number>; exceptional: number;
  classes: { name: string; demand: number }[]; worst: (Counts & { date: string })[];
  unknown: { teacherHours: number; demand: number }; provenance: Record<string, number>; issues: number;
};
export const metricNames: Record<Metric, string> = { demand: "Ore di classe scoperta", teacherHours: "Ore docenti assenti", teachers: "Docenti assenti" };
export const outcomes = { covered: "Coperte", uncovered: "Senza supplente", late: "Entrata posticipata", early: "Uscita anticipata", pending: "In attesa" };
export const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
export const campuses: Record<string, string> = { total: "Totale", centrale: "Centrale", succursale: "Succursale" };
export const periods: Record<string, string> = { all: "Tutto", week: "Questa settimana", month: "Questo mese", custom: "Personalizzato" };
export const typeNames: Record<string, string> = { CP: "Compresenza - POT", C: "Compresenza", TC: "Rottura compresenza", D: "A disposizione", DIS: "DI.S", DIR: "Dirigente" };
export const formatNumber = (n: number | null) => n === null ? "—" : n.toLocaleString("it-IT", { maximumFractionDigits: 2 });

export function reportCsv(data: StatReport): string {
  const rows: (string | number | null)[][] = [
    ["Sosticero — Statistiche"], ["Sede", campuses[data.campus]], ["Periodo", periods[data.period]], ["Dal", data.start, "Al", data.end],
    ["Giorni con assenze registrate", data.days], ["Denominatore", "Solo giorni con assenze registrate; stesse date per tutte le sedi"],
    ["Unità", "Ore = periodi dell’orario; docenti deduplicati per giorno"],
    ["Ore assenza ricostruite", data.provenance.reconstructed || 0], ["Ore assenza registrate", data.provenance.recorded || 0],
    ["Ore assenza senza sede (tutte le sedi)", data.unknown.teacherHours], ["Domanda senza sede (tutte le sedi)", data.unknown.demand],
    ["Assegnazioni da verificare (tutte le sedi)", data.issues], ["Copertura %", data.coverage], ["Coperture eccezionali (già incluse nelle coperte)", data.exceptional],
    [], ["Indicatore", "Totale", "Media per giorno registrato"],
    ...Object.entries({ ...metricNames, ...outcomes }).map(([k, name]) => [name, data.totals[k as keyof Counts], data.averages[k as keyof Counts]]),
    [], ["Data", ...Object.values(metricNames), ...Object.values(outcomes)],
    ...data.daily.map(d => [d.date, d.demand, d.teacherHours, d.teachers, d.covered, d.uncovered, d.late, d.early, d.pending]),
    [], ["Giorno", "Date incluse", ...Object.values(metricNames)],
    ...data.weekdays.map(d => [weekdays[d.weekday], d.days, d.demand, d.teacherHours, d.teachers]),
    [], ["Ora", ...Object.values(metricNames)], ...data.hours.map(d => [d.hour, d.demand, d.teacherHours, d.teachers]),
    [], ["Giorno", "Ora", "Date incluse", ...Object.values(metricNames)],
    ...data.heatmap.map(d => [weekdays[d.weekday], d.hour, d.days, d.demand, d.teacherHours, d.teachers]),
    [], ["Tipo copertura", "Ore"], ...Object.entries(data.types).map(([t, n]) => [typeNames[t] || t, n]),
    [], ["Classe", metricNames.demand], ...data.classes.map(d => [d.name, d.demand]),
  ];
  // Quoting alone does not stop spreadsheet formula execution in imported text.
  return "\uFEFF" + rows.map(row => row.map(value => {
    let cell = value === null ? "" : String(value);
    if (typeof value === "string" && /^[=+@\-\t\r]/.test(cell)) cell = "'" + cell;
    return '"' + cell.replaceAll('"', '""') + '"';
  }).join(";")).join("\r\n");
}
