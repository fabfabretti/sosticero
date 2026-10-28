import { useEffect, useState } from "react";
import { todayInRome } from "./StatsCalendar";
import { useQuietRefresh } from "./useQuietRefresh";
import type { Baseline } from "./concurrency";
import type { Teacher } from "./types";
import { norm, teacherSearchText } from "./timetables";
import "./paid.css";

type SlotTeacher = { id: string; name: string; sites: string[]; uncertain: boolean; why: string };
type Report = {
  dates: string[]; teachers: Record<string, Teacher>; declarations: Record<string, Record<string, number[]>>;
  cells: { weekday: number; hour: number; teachers: SlotTeacher[] }[];
  totals: Record<string, number>; concurrency: Baseline;
  records: { date: string; key: string; teacher: string; name: string; hour: number; c: string; assignedBy: string; notified: boolean; paidContext: { site: string; room: string | null } }[];
};
type Api = <T>(path: string, body?: unknown) => Promise<T>;
const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"];
const campus = (s: string) => s === "centrale" ? "Centrale" : "Succursale";
const dateLabel = (d: string) => d.split("-").reverse().join("/");

export function PaidHours({ api }: { api: Api }) {
  const [day, setDay] = useState(todayInRome()), [data, setData] = useState<Report>();
  const [editing, setEditing] = useState(false), [teacher, setTeacher] = useState(""), [weekday, setWeekday] = useState(0);
  const [hours, setHours] = useState<number[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestions = query && !teacher ? Object.values(data?.teachers || {})
    .filter(t => !t.retired && norm(teacherSearchText(t)).includes(norm(query)))
    .sort((a, b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name))
    .slice(0, 6) : [];
  const load = () => api<Report>("paid-availability?" + new URLSearchParams({ day }));
  const { refresh } = useQuietRefresh(load, setData, editing || busy, day, !day);
  useEffect(() => { if (day) void refresh().catch(e => setError(String(e))); }, [day]);
  function select(id: string, w: number) {
    setTeacher(id); setQuery(data?.teachers[id]?.name || ""); setSuggestionIndex(0); setWeekday(w); setHours(data?.declarations[String(w)]?.[id] || []); setError("");
  }
  async function save() {
    if (!data || !teacher) return;
    const ref = `paidAvailability|${weekday}|${teacher}`;
    const expected = { [ref]: data.concurrency.records[ref] || "absent", ...(data.concurrency.generation === undefined ? {} : { __generation__: String(data.concurrency.generation) }) };
    setBusy(true); setError("");
    try { await api("paid-availability", { weekday, id: teacher, hours, expected }); await refresh(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  return <main className="ui-page paid-page"><header className="paid-heading"><div><h1>Banca ore</h1><p>Disponibilità settimanali per supplenze a pagamento</p></div>
    <div className="ui-actions"><label>Settimana del <input type="date" value={day} disabled={editing || busy} onChange={e => setDay(e.target.value)} /></label>
      <button className="ui-button" aria-pressed={editing} disabled={busy || !data} onClick={() => { setEditing(!editing); setTeacher(""); setQuery(""); setError(""); }}>{editing ? "Fine modifica" : "Modifica disponibilità"}</button></div></header>
    {error && <p role="alert" className="ui-notice ui-notice-error">{error}</p>}
    {!data && !error && <p role="status">Caricamento…</p>}
    {data && <>
      {editing && <section className="paid-editor" aria-label="Modifica disponibilità a pagamento">
        <div className="ui-field paid-teacher-picker">
          <label htmlFor="paid-teacher">Docente</label>
          <div className="sw">
            <input id="paid-teacher" aria-label="Cerca docente" placeholder="Docente, es. ros" autoComplete="off" disabled={busy} value={query}
              onChange={e => { setQuery(e.target.value); setTeacher(""); setHours([]); setSuggestionIndex(0); }}
              onKeyDown={e => {
                if (e.key === "Escape") { setQuery(""); setTeacher(""); setHours([]); }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSuggestionIndex((suggestionIndex + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % Math.max(1, suggestions.length));
                }
                if (e.key === "Enter" && suggestions[suggestionIndex]) { e.preventDefault(); select(suggestions[suggestionIndex].id, weekday); }
              }} />
            {!!suggestions.length && <div className="sug">{suggestions.map((t, i) =>
              <button key={t.id} type="button" disabled={busy} className={suggestionIndex === i ? "on" : ""} onClick={() => select(t.id, weekday)}>{t.name}<small>docente</small></button>
            )}</div>}
          </div>
        </div>
        <label>Giorno <select value={weekday} disabled={busy} onChange={e => select(teacher, Number(e.target.value))}>{weekdays.map((w, i) => <option key={w} value={i}>{w}</option>)}</select></label>
        <fieldset className="paid-hours" disabled={busy || !teacher}><legend>Ore disponibili</legend><div className="hrs permit-hours">{[1, 2, 3, 4, 5, 6, 7].map(h =>
          <button key={h} type="button" aria-label={`Disponibilità a pagamento ${h}ª ora`} aria-pressed={hours.includes(h)} className={hours.includes(h) ? "on" : ""}
            onClick={() => setHours(hours.includes(h) ? hours.filter(n => n !== h) : [...hours, h].sort())}>{h}</button>
        )}</div></fieldset>
        <button className="ui-button" disabled={busy || !teacher} onClick={() => void save()}>{busy ? "Salvataggio…" : "Salva"}</button>
        <button className="ui-button" disabled={busy} onClick={() => void refresh().then(latest => { if (latest) { setHours(latest.declarations[String(weekday)]?.[teacher] || []); setError(""); } }).catch(e => setError(String(e)))}>Ricarica valori salvati</button>
      </section>}
      <div className="paid-scroll" role="region" tabIndex={0} aria-label="Disponibilità settimanali"><table className="paid-grid"><caption>Disponibilità ricorrenti · sedi calcolate per {dateLabel(data.dates[0])} — {dateLabel(data.dates[4])}</caption>
        <thead><tr><th scope="col">Ora</th>{data.dates.map((d, i) => <th scope="col" key={d}>{weekdays[i]}<small>{dateLabel(d)}</small></th>)}</tr></thead>
        <tbody>{[1, 2, 3, 4, 5, 6, 7].map(h => <tr key={h}><th scope="row">{h}ª</th>{weekdays.map((_, w) => <td key={w}>{data.cells.find(c => c.weekday === w && c.hour === h)?.teachers.map(t => <div key={t.id} className="paid-teacher">
          {editing ? <button className="paid-name" onClick={() => select(t.id, w)}>{t.name}</button> : <strong>{t.name}</strong>}
          <small>{t.why || (t.uncertain ? "Sede da verificare" : t.sites.length === 2 ? "Entrambe" : t.sites.map(campus).join(" / "))}</small>
        </div>) || "—"}{!data.cells.find(c => c.weekday === w && c.hour === h)?.teachers.length && "—"}</td>)}</tr>)}</tbody></table></div>
      <p className="paid-method">Sedi calcolate dall’orario, con cambio sede consentito negli intervalli 2–3 e 4–5. Le dichiarazioni sono ricorrenti; assenze e supplenze giornaliere vengono verificate al momento dell’assegnazione.</p>
      <section><h2>Ore assegnate a pagamento</h2><p>Ogni supplenza registrata conta subito, anche se futura. Avviso e richiesta email si gestiscono dalla tabella Supplenze.</p>
        <div className="paid-totals">{Object.entries(data.totals).sort((a, b) => (data.teachers[a[0]]?.name || a[0]).localeCompare(data.teachers[b[0]]?.name || b[0])).map(([id, count]) => <span key={id}>{data.teachers[id]?.name || id}: <strong>{count} ore</strong></span>)}</div>
        <div className="paid-scroll" role="region" tabIndex={0} aria-label="Registro ore a pagamento"><table><thead><tr>{["Docente", "Data", "Ora", "Classe", "Sede", "Assegnata da", "Avvisato"].map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{data.records.map(r => <tr key={r.date + r.key}><td>{r.name}</td><td>{dateLabel(r.date)}</td><td>{r.hour}ª</td><td>{r.c}</td><td>{campus(r.paidContext.site)}</td><td>{campus(r.assignedBy)}</td><td>{r.notified ? "Sì" : "No"}</td></tr>)}</tbody></table></div>
        {!data.records.length && <p>Nessuna supplenza a pagamento registrata.</p>}
      </section>
    </>}
  </main>;
}
