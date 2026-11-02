import { Loading, LoadingRegion } from './Loading';
import { useEffect, useRef, useState } from "react";
import { todayInRome } from "./StatsCalendar";
import { useQuietRefresh } from "./useQuietRefresh";
import type { Baseline } from "./concurrency";
import type { Teacher } from "./types";
import { norm, teacherSearchText } from "./timetables";
import "./paid.css";

type SlotTeacher = { id: string; name: string; sites: string[]; uncertain: boolean; why: string; addedBy?: string };
type Report = {
  dates: string[]; teachers: Record<string, Teacher>; declarations: Record<string, Record<string, number[]>>;
  cells: { weekday: number; hour: number; teachers: SlotTeacher[] }[];
  totals: Record<string, number>; concurrency: Baseline;
  records: { date: string; key: string; teacher: string; name: string; hour: number; c: string; assignedBy: string; notified: boolean; paidContext: { site: string; room: string | null } }[];
};
type Api = <T>(path: string, body?: unknown) => Promise<T>;
const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"];
const campus = (s: string) => s === "centrale" ? "Centrale" : "Succursale";
const attribution = (site?: string) => site ? <span className={`paid-attribution campus-${site}`} title={`Inserito da ${campus(site)}`} aria-label={`Inserito da ${campus(site)}`}>{site === "centrale" ? "C" : "S"}</span> : null;
const dateLabel = (d: string) => d.split("-").reverse().join("/");

export function PaidHours({ api }: { api: Api }) {
  const [day, setDay] = useState(todayInRome()), [data, setData] = useState<Report>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [suggestionIndex, setSuggestionIndex] = useState(0);
  const [slot, setSlot] = useState<{ weekday: number; hour: number }>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (slot) { dialog.current?.showModal(); dialog.current?.querySelector("input")?.focus(); } }, [slot]);
  const suggestions = query ? Object.values(data?.teachers || {})
    .filter(t => !t.retired && !data?.declarations[String(slot?.weekday)]?.[t.id]?.includes(slot?.hour || 0) && norm(teacherSearchText(t)).includes(norm(query)))
    .sort((a, b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name))
    .slice(0, 6) : [];
  const load = async () => { if (!day) throw Error("Seleziona una data valida."); return api<Report>("paid-availability?" + new URLSearchParams({ day })); };
  const { refresh, loading, ready, loadError } = useQuietRefresh(load, setData, editing || busy, day, !day);
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, [day]);
  function openSlot(weekday: number, hour: number) {
    setSlot({ weekday, hour }); setQuery(""); setSuggestionIndex(0); setError("");
  }
  async function save(teacher: string, add: boolean) {
    if (!data || !slot || busy || !ready) return;
    const { weekday, hour } = slot;
    const current = data.declarations[String(weekday)]?.[teacher] || [];
    const hours = add ? Array.from(new Set([...current, hour])).sort() : current.filter(h => h !== hour);
    const ref = `paidAvailability|${weekday}|${teacher}`;
    const expected = { [ref]: data.concurrency.records[ref] || "absent", ...(data.concurrency.generation === undefined ? {} : { __generation__: String(data.concurrency.generation) }) };
    setBusy(true); setError("");
    try { await api("paid-availability", { weekday, id: teacher, hours, expected }); try { await refresh(); setQuery(""); setSuggestionIndex(0); } catch { setError("Salvato. Impossibile aggiornare i dati: ricarica i valori."); } }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  return <main className="ui-page paid-page"><header className="paid-heading"><div><h1>Banca ore</h1><p>Disponibilità settimanali per supplenze a pagamento</p></div>
    <div className="ui-actions"><label>Settimana del <input type="date" value={day} disabled={editing || busy} onChange={e => setDay(e.target.value)} /></label>
      <button className="ui-button" aria-pressed={editing} disabled={busy || !data || !ready} onClick={() => { setEditing(!editing); setQuery(""); setError(""); }}>{editing ? "Fine modifica" : "Modifica disponibilità"}</button></div></header>
    {error && <p role="alert" className="ui-notice ui-notice-error">{error}</p>}
    <LoadingRegion pending={loading || busy} label={busy ? "Salvataggio…" : undefined} blocked={!ready || busy} error={loadError} retry={() => void refresh().catch(() => {})}>
    {data && <>
      {editing && slot && <dialog ref={dialog} className="paid-dialog" aria-labelledby="paid-dialog-title" onCancel={e => { if (busy) e.preventDefault(); else setSlot(undefined); }} onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setSlot(undefined); } }}>
        <div className="paid-dialog-heading"><h2 id="paid-dialog-title">Disponibilità · {weekdays[slot.weekday]}, {slot.hour}ª ora</h2><button className="ui-button" aria-label="Chiudi disponibilità" disabled={busy} onClick={() => setSlot(undefined)}>×</button></div>
        {error && <p role="alert" className="ui-notice ui-notice-error">{error}</p>}
        <p className="paid-dialog-hint">Le modifiche vengono salvate automaticamente.</p>
        <section className="paid-editor" aria-label="Modifica disponibilità a pagamento">
        <div className="ui-field paid-teacher-picker">
          <label htmlFor="paid-teacher">Aggiungi docente</label>
          <div className="sw">
            <input id="paid-teacher" autoFocus aria-label="Cerca docente" placeholder="Docente, es. ros" autoComplete="off" disabled={busy} value={query}
              onChange={e => { setQuery(e.target.value); setSuggestionIndex(0); }}
              onKeyDown={e => {
                if (e.key === "Escape") { setQuery(""); }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSuggestionIndex((suggestionIndex + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % Math.max(1, suggestions.length));
                }
                if (e.key === "Enter" && suggestions[suggestionIndex]) { e.preventDefault(); void save(suggestions[suggestionIndex].id, true); }
              }} />
            {!!suggestions.length && <div className="sug">{suggestions.map((t, i) =>
              <button key={t.id} type="button" disabled={busy} className={suggestionIndex === i ? "on" : ""} onClick={() => void save(t.id, true)}>{t.name}<small>Aggiungi</small></button>
            )}</div>}
          </div>
        </div>
        {query && !suggestions.length && <p>Nessun docente da aggiungere.</p>}
        <div className="paid-slot-teachers" aria-label="Docenti disponibili in questa ora">
          {Object.entries(data.declarations[String(slot.weekday)] || {}).filter(([, hours]) => hours.includes(slot.hour)).map(([id]) => <div className="paid-slot-teacher" key={id}>
            <strong>{attribution(data.cells.find(c => c.weekday === slot.weekday && c.hour === slot.hour)?.teachers.find(t => t.id === id)?.addedBy)}{data.teachers[id]?.name || id}</strong>
            <button className="ui-button" aria-label={`Rimuovi ${data.teachers[id]?.name || id} da questa ora`} disabled={busy} onClick={() => void save(id, false)}>Rimuovi</button>
          </div>)}
          {!Object.values(data.declarations[String(slot.weekday)] || {}).some(hours => hours.includes(slot.hour)) && <p>Nessun docente in questa ora.</p>}
        </div>
        {error && <button className="ui-button" disabled={busy} onClick={() => void refresh().then(() => setError("")).catch(e => setError(String(e)))}>Ricarica valori salvati</button>}
        <div className="paid-dialog-footer"><button className="ui-button ui-button-primary" disabled={busy} onClick={() => setSlot(undefined)}>Fatto</button></div>
      </section></dialog>}
      <div className="paid-scroll" role="region" tabIndex={0} aria-label="Disponibilità settimanali"><table className="paid-grid"><caption>Disponibilità ricorrenti · sedi calcolate per {dateLabel(data.dates[0])} — {dateLabel(data.dates[4])}</caption>
        <thead><tr><th scope="col">Ora</th>{data.dates.map((d, i) => <th scope="col" key={d}>{weekdays[i]}<small>{dateLabel(d)}</small></th>)}</tr></thead>
        <tbody>{[1, 2, 3, 4, 5, 6, 7].map(h => <tr key={h}><th scope="row">{h}ª</th>{weekdays.map((_, w) => <td key={w}>{data.cells.find(c => c.weekday === w && c.hour === h)?.teachers.map(t => <div key={t.id} className="paid-teacher">
          {attribution(t.addedBy)}{editing ? <button className="paid-name" onClick={() => openSlot(w, h)}>{t.name}</button> : <strong>{t.name}</strong>}
          <small>{t.why || (t.uncertain ? "Sede da verificare" : t.sites.length === 2 ? "Entrambe" : t.sites.map(campus).join(" / "))}</small>
        </div>) || "—"}{!data.cells.find(c => c.weekday === w && c.hour === h)?.teachers.length && !editing && "—"}{editing && <button className="paid-edit" aria-label={`Modifica docenti · ${weekdays[w]}, ${h}ª ora`} disabled={busy} onClick={() => openSlot(w, h)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg></button>}</td>)}</tr>)}</tbody></table></div>
      <p className="paid-method">Sedi calcolate dall’orario, con cambio sede consentito negli intervalli 2–3 e 4–5. Le dichiarazioni sono ricorrenti; assenze e supplenze giornaliere vengono verificate al momento dell’assegnazione.</p>
      <section><h2>Ore assegnate a pagamento</h2><p>Ogni supplenza registrata conta subito, anche se futura. Avviso e richiesta email si gestiscono dalla tabella Supplenze.</p>
        <div className="paid-totals">{Object.entries(data.totals).sort((a, b) => (data.teachers[a[0]]?.name || a[0]).localeCompare(data.teachers[b[0]]?.name || b[0])).map(([id, count]) => <span key={id}>{data.teachers[id]?.name || id}: <strong>{count} ore</strong></span>)}</div>
        <div className="paid-scroll" role="region" tabIndex={0} aria-label="Registro ore a pagamento"><table><thead><tr>{["Docente", "Data", "Ora", "Classe", "Sede", "Assegnata da", "Avvisato"].map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{data.records.map(r => <tr key={r.date + r.key}><td>{r.name}</td><td>{dateLabel(r.date)}</td><td>{r.hour}ª</td><td>{r.c}</td><td>{campus(r.paidContext.site)}</td><td>{campus(r.assignedBy)}</td><td>{r.notified ? "Sì" : "No"}</td></tr>)}</tbody></table></div>
        {!data.records.length && <p>Nessuna supplenza a pagamento registrata.</p>}
      </section>
    </>}
    </LoadingRegion>
  </main>;
}
