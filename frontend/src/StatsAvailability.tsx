import { useEffect, useState } from "react";
import { campuses, weekdays, formatNumber as fmt } from "./stats-report";
import { todayInRome } from "./StatsCalendar";

type Teacher = { id: string; name: string; activities: string[]; sites: string[] };
export type AvailabilityReport = {
  campus: string; start: string; end: string; dates: string[];
  cells: { date: string; weekday: number; hour: number; available: Teacher[]; recovery: Teacher[] }[];
  pot: { enabled: number; total: number; percentage: number | null; reference: number };
  unknown: { hours: number; pot: number };
};
const campusName = (campus: string) => campus === "total" ? "Entrambi" : campuses[campus];
const teacherLine = (t: Teacher) => `${t.name} - ${t.activities.map(a => a.replaceAll(".", "")).join("/")} - ${t.sites.length ? t.sites.map(s => s === "centrale" ? "C" : "S").join("/") : "?"}`;
const recoveryOnly = (cell: AvailabilityReport["cells"][number], recovery: boolean) =>
  recovery ? cell.recovery.filter(t => !cell.available.some(a => a.id === t.id)) : [];
export const absenceExplanation = "Le ore dei docenti assenti includono anche attività senza una classe da sostituire. Più docenti assenti nella stessa classe e ora contano separatamente, mentre l’ora di classe conta una volta.";

// Hover panels let the pointer reach underlying cells; click pins a panel for scrolling.
export function AvailabilityCell({ cell, recovery, max, activeCell, onActivate }: { cell: AvailabilityReport["cells"][number]; recovery: boolean; max: number; activeCell: string | null; onActivate: (id: string) => void }) {
  const [position, setPosition] = useState<{ left: number; top: number; pinned: boolean } | null>(null);
  const extra = recoveryOnly(cell, recovery);
  const count = cell.available.length + extra.length;
  const id = `availability-${cell.date}-${cell.hour}`;
  const show = (event: { currentTarget: HTMLTableCellElement }) => {
    if (!count) return;
    onActivate(id);
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), top: Math.max(8, Math.min(rect.bottom, window.innerHeight - 264)), pinned: false });
  };
  return <td tabIndex={count ? 0 : undefined}
    aria-label={`${weekdays[cell.weekday]} ${cell.date}, ${cell.hour}ª ora: ${count} ${recovery ? "reperibili" : "disponibili"}`}
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
      {cell.available.length > 0 && <><h3>Disponibili</h3><ul>
        {cell.available.map(t => <li key={t.id}>{teacherLine(t)}</li>)}
      </ul></>}
      {extra.length > 0 && <><h3>Reperibili (RP)</h3><ul>
        {extra.map(t => <li key={t.id}>{teacherLine(t)}</li>)}
      </ul></>}
    </div>}
  </td>;
}

export function AvailabilityTable({ data, recovery }: { data: AvailabilityReport; recovery: boolean }) {
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const title = recovery ? "Reperibili" : "Disponibili";
  const max = Math.max(1, ...data.cells.map(c => c.available.length + recoveryOnly(c, recovery).length));
  return <div className="stats-scroll" tabIndex={0} role="region" aria-label={title + " per giorno e ora"}>
    <table className="stats-heatmap">
      <caption>{title} · {campusName(data.campus)} · {data.start} — {data.end}</caption>
      <thead><tr><th scope="col">Ora</th>{data.dates.map((d, i) => <th scope="col" key={d}>{weekdays[i]} {d.slice(8)}/{d.slice(5, 7)}</th>)}</tr></thead>
      <tbody>{[1, 2, 3, 4, 5, 6, 7].map(h => <tr key={h}><th scope="row">{h}ª ora</th>{data.dates.map(d => {
        const cell = data.cells.find(c => c.date === d && c.hour === h);
        return cell ? <AvailabilityCell key={d} cell={cell} recovery={recovery} max={max} activeCell={activeCell} onActivate={setActiveCell} /> : <td key={d}>—</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}

export function StatsAvailability({ campus, preview, onReady }: { campus: string; preview: boolean; onReady: (ready: boolean) => void }) {
  const [date, setDate] = useState(todayInRome());
  const [recovery, setRecovery] = useState(false);
  const [data, setData] = useState<AvailabilityReport>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined); setError(""); onReady(false);
    if (!date) { setLoading(false); return; }
    setLoading(true);
    fetch("/api/stats/availability?" + new URLSearchParams({ date, campus })).then(async response => {
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
      <button className={!recovery ? "active" : ""} aria-pressed={!recovery} onClick={() => setRecovery(false)}>Disponibili</button>
      <button className={recovery ? "active" : ""} aria-pressed={recovery} onClick={() => setRecovery(true)}>Reperibili</button>
    </div>
    {!date && <p role="alert">Seleziona una data per vedere la settimana.</p>}
    {loading && <p role="status">Caricamento disponibilità…</p>}
    {error && <p role="alert" className="stats-warning">{error} <button onClick={() => setRetry(retry + 1)}>Riprova</button></p>}
    {data && <>
      <AvailabilityTable data={data} recovery={preview ? false : recovery} />
      {preview && <AvailabilityTable data={data} recovery />}
      <p className="availability-ratio"><strong>POT disponibili: {fmt(data.pot.enabled)} / {fmt(data.pot.total)} ore · {fmt(data.pot.percentage)}{data.pot.percentage === null ? "" : "%"}</strong><span>Riferimento atteso: {data.pot.reference}%</span></p>
      <p className="stats-method">POT + ALF + PE abilitati / totale in orario nella settimana {data.start} — {data.end}. Ore disabilitate incluse nel totale; DI.S e recuperi esclusi. {data.pot.total === 0 && "Nessuna ora POT/ALF/PE nella sede selezionata."}</p>
      {data.unknown.hours > 0 && <p className="stats-method">{fmt(data.unknown.hours)} ore senza sede verificabile, di cui {fmt(data.unknown.pot)} POT/ALF/PE: incluse solo in Entrambi.</p>}
    </>}
    <p className="stats-method">Disponibili: attività abilitate nell’orario. Reperibili: disponibili più recuperi permesso nelle ore favorevoli, con debito ancora recuperabile alla data. I recuperi sono opportunità alternative: la stessa ora da recuperare può apparire in più celle e non va sommata.</p>
  </section>;
}
