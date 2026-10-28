import { sessionFetch } from './session';
import { useEffect, useState } from "react";
import { campuses, weekdays, formatNumber as fmt } from "./stats-report";
import { todayInRome } from "./StatsCalendar";

type Teacher = { id: string; name: string; activities: string[]; sites: string[]; uncertain?: boolean };
export type AvailabilityReport = {
  campus: string; start: string; end: string; dates: string[];
  cells: { date: string; weekday: number; hour: number; available: Teacher[]; recovery: Teacher[]; paid?: Teacher[] }[];
  pot: { enabled: number; total: number; percentage: number | null; reference: number };
  unknown: { hours: number; pot: number };
};
const campusName = (campus: string) => campus === "total" ? "Entrambi" : campuses[campus];
const teacherLine = (t: Teacher) => `${t.name} - ${t.activities.map(a => a.replaceAll(".", "")).join("/")} - ${t.sites.length ? t.sites.map(s => s === "centrale" ? "C" : "S").join("/") : "?"}${t.uncertain ? " · Sede da verificare" : ""}`;
const categories = { available: "Potenziamenti disponibili", recovery: "Recuperi permesso", paid: "A pagamento" };
type Category = keyof typeof categories;
const defaultSelection: Category[] = ["available"];
const people = (cell: AvailabilityReport["cells"][number], selected: Category[]) =>
  Array.from(new Map(selected.flatMap(category => cell[category] || []).map(t => [t.id, t])).values());
export const absenceExplanation = "Le ore dei docenti assenti includono anche attività senza una classe da sostituire. Più docenti assenti nella stessa classe e ora contano separatamente, mentre l’ora di classe conta una volta.";

// Hover panels let the pointer reach underlying cells; click pins a panel for scrolling.
export function AvailabilityCell({ cell, selected = defaultSelection, max, activeCell, onActivate }: { cell: AvailabilityReport["cells"][number]; selected?: Category[]; max: number; activeCell: string | null; onActivate: (id: string) => void }) {
  const [position, setPosition] = useState<{ left: number; top: number; pinned: boolean } | null>(null);
  const count = people(cell, selected).length;
  const id = `availability-${cell.date}-${cell.hour}`;
  const show = (event: { currentTarget: HTMLTableCellElement }) => {
    if (!count) return;
    onActivate(id);
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), top: Math.max(8, Math.min(rect.bottom, window.innerHeight - 264)), pinned: false });
  };
  return <td tabIndex={count ? 0 : undefined}
    aria-label={`${weekdays[cell.weekday]} ${cell.date}, ${cell.hour}ª ora: ${count} docenti`}
    aria-describedby={position && activeCell === id ? id : undefined}
    onMouseEnter={show} onMouseLeave={() => { if (!position?.pinned) setPosition(null); }} onFocus={e => { if (e.target === e.currentTarget) show(e); }}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPosition(null); }}
    onClick={e => { if ((e.target as HTMLElement).closest('[role="tooltip"]')) return; if (position) setPosition({ ...position, pinned: !position.pinned }); }}
    onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); setPosition(null); }
      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && position) {
        e.preventDefault(); setPosition({ ...position, pinned: !position.pinned });
      }
    }}
    style={{ background: `color-mix(in srgb, var(--acc) ${Math.round(count / max * 24)}%, var(--pan))` }}>
    {count}
    {position && activeCell === id && <div id={id} role="tooltip" className={"stats-cell-tooltip availability-tooltip" + (position.pinned ? " is-pinned" : "")} tabIndex={position.pinned ? 0 : undefined} style={{ left: position.left, top: position.top }}>
      <strong>{weekdays[cell.weekday]} {cell.date} · {cell.hour}ª ora</strong>
      <small>{position.pinned ? "Elenco fissato · Esc per chiudere" : "Clic sulla cella per scorrere l’elenco"}</small>
      {selected.map((category, index) => !!cell[category]?.length && <div key={category}><h3>{categories[category]}</h3><ul>
        {cell[category]!.filter(t => !selected.slice(0, index).some(previous => cell[previous]?.some(person => person.id === t.id))).map(t => <li key={t.id}>{teacherLine(t)}</li>)}
      </ul></div>)}
    </div>}
  </td>;
}

export function AvailabilityTable({ data, selected = defaultSelection }: { data: AvailabilityReport; selected?: Category[] }) {
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const title = selected.map(category => categories[category]).join(" + ") || "Nessuna categoria selezionata";
  const max = Math.max(1, ...data.cells.map(c => people(c, selected).length));
  return <div className="stats-scroll" tabIndex={0} role="region" aria-label={title + " per giorno e ora"}>
    <table className="stats-heatmap">
      <caption>{title} · {campusName(data.campus)} · {data.start} — {data.end}</caption>
      <thead><tr><th scope="col">Ora</th>{data.dates.map((d, i) => <th scope="col" key={d}>{weekdays[i]} {d.slice(8)}/{d.slice(5, 7)}</th>)}</tr></thead>
      <tbody>{[1, 2, 3, 4, 5, 6, 7].map(h => <tr key={h}><th scope="row">{h}ª ora</th>{data.dates.map(d => {
        const cell = data.cells.find(c => c.date === d && c.hour === h);
        return cell ? <AvailabilityCell key={d} cell={cell} selected={selected} max={max} activeCell={activeCell} onActivate={setActiveCell} /> : <td key={d}>—</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}

export function StatsAvailability({ campus, onReady }: { campus: string; preview: boolean; onReady: (ready: boolean) => void }) {
  const [date, setDate] = useState(todayInRome());
  const [selected, setSelected] = useState<Category[]>(defaultSelection);
  const [data, setData] = useState<AvailabilityReport>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined); setError(""); onReady(false);
    if (!date) { setLoading(false); return; }
    setLoading(true);
    sessionFetch("/api/stats/availability?" + new URLSearchParams({ date, campus })).then(async response => {
      const body = await response.json();
      if (!response.ok) throw Error(typeof body.detail === "string" ? body.detail : "Impossibile caricare le disponibilità.");
      if (active) { setData(body); onReady(true); }
    }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, campus, retry, onReady]);

  return <section className="stats-panel stats-availability">
    <div className="stats-panel-heading"><h2>A disposizione</h2>
      <label className="availability-date">Settimana del <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    </div>
    <p className="stats-method">Disponibilità sulla carta · {campusName(campus)}. Orario e modifiche di Orari, senza sottrarre assenze o supplenze giornaliere.</p>
    <div className="site-filter availability-switch" role="group" aria-label="Tipo di disponibilità">
      {(Object.keys(categories) as Category[]).map(category => <button key={category} className={selected.includes(category) ? "active" : ""} aria-pressed={selected.includes(category)} onClick={() => setSelected(selected.includes(category) ? selected.filter(value => value !== category) : [...selected, category])}>{categories[category]}</button>)}
    </div>
    {!date && <p role="alert">Seleziona una data per vedere la settimana.</p>}
    {loading && <p role="status">Caricamento disponibilità…</p>}
    {error && <p role="alert" className="stats-warning">{error} <button onClick={() => setRetry(retry + 1)}>Riprova</button></p>}
    {data && <>
      <AvailabilityTable data={data} selected={selected} />
      <p className="availability-ratio"><strong>POT disponibili: {fmt(data.pot.enabled)} / {fmt(data.pot.total)} ore · {fmt(data.pot.percentage)}{data.pot.percentage === null ? "" : "%"}</strong><span>Riferimento atteso: {data.pot.reference}%</span></p>
      <p className="stats-method">POT + ALF + PE abilitati / totale in orario nella settimana {data.start} — {data.end}. Ore disabilitate incluse nel totale; DI.S e recuperi esclusi. {data.pot.total === 0 && "Nessuna ora POT/ALF/PE nella sede selezionata."}</p>
      {data.unknown.hours > 0 && <p className="stats-method">{fmt(data.unknown.hours)} ore senza sede verificabile, di cui {fmt(data.unknown.pot)} POT/ALF/PE: incluse solo in Entrambi.</p>}
    </>}
    <p className="stats-method">Attiva o disattiva le categorie da includere nella tabella. Potenziamenti disponibili: attività abilitate nell’orario. Recuperi permesso: ore favorevoli con debito ancora recuperabile alla data. A pagamento: disponibilità a pagamento compatibili con la sede. Ogni docente conta una volta per cella, anche in più categorie. Le sedi incerte sono indicate come da verificare. I recuperi sono opportunità alternative: la stessa ora da recuperare può apparire in più celle e non va sommata.</p>
  </section>;
}
