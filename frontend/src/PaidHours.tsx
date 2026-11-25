import { PaidBudgetSummary } from './PaidBudgetSummary';
import { euro, type FinanceSummary } from './paid-finance';
import { authorLabel, type Author } from './attribution';
import { Loading, LoadingRegion } from './Loading';
import { useEffect, useRef, useState } from "react";
import { todayInRome } from "./StatsCalendar";
import { useQuietRefresh } from "./useQuietRefresh";
import type { Baseline } from "./concurrency";
import type { Teacher } from "./types";
import { norm, teacherSearchText } from "./timetables";
import "./paid.css";
import { generatePaidPdf } from "./paidPdf";

type SlotTeacher = { id: string; name: string; sites: string[]; uncertain: boolean; why: string; addedBy?: Author };
export type Report = {
  finance?: FinanceSummary;
  dates: string[]; teachers: Record<string, Teacher>; declarations: Record<string, Record<string, number[]>>;
  cells: { weekday: number; hour: number; teachers: SlotTeacher[] }[];
  totals: Record<string, number>; concurrency: Baseline;
  records: { paidPrice?: { cents: number; classification: string }; date: string; key: string; teacher: string; name: string; hour: number; c: string; assignedBy: Author; notified: boolean; paidContext: { site: string; room: string | null } }[];
};
type Api = <T>(path: string, body?: unknown) => Promise<T>;
const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"];
const campus = (s: string) => s === "centrale" ? "Centrale" : "Succursale";
const attribution = (author?: Author) => author ? <span className="author-name" title={`Inserito da ${authorLabel(author, true)}`}> {authorLabel(author)} · </span> : null;
const dateLabel = (d: string) => d.split("-").reverse().join("/");

export function PaidHours({ api }: { api: Api }) {
  const [day, setDay] = useState(todayInRome()), [data, setData] = useState<Report>();
  const [reportSite, setReportSite] = useState("both"), [preview, setPreview] = useState(false), [reportTime, setReportTime] = useState(new Date());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [suggestionIndex, setSuggestionIndex] = useState(0);
  const [slot, setSlot] = useState<{ weekday: number; hour: number }>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (slot) { dialog.current?.showModal(); dialog.current?.querySelector("input")?.focus(); } }, [slot]);
  const suggestions = query ? Object.values(data?.teachers || {})
    .filter(t => !t.retired && !t.unavailable && !data?.declarations[String(slot?.weekday)]?.[t.id]?.includes(slot?.hour || 0) && norm(teacherSearchText(t)).includes(norm(query)))
    .sort((a, b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name))
    .slice(0, 6) : [];
  const load = async () => { if (!day) throw Error("Seleziona una data valida."); return api<Report>("paid-availability?" + new URLSearchParams({ day })); };
  const { refresh, enter, loading, ready, loadError } = useQuietRefresh(load, setData, editing || busy, day, !day, "paid-availability?" + new URLSearchParams({ day }));
  useEffect(() => { void enter().catch(e => setError(String(e))); }, [day]);
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
  const assignedTeachers = new Map<string, Report["records"]>();
  for (const record of data?.records || []) {
    const records = assignedTeachers.get(record.teacher) || [];
    records.push(record); assignedTeachers.set(record.teacher, records);
  }
  const assignedGroups = [...assignedTeachers.values()].sort((a, b) => a[0].name.localeCompare(b[0].name, "it"));
  for (const records of assignedGroups) records.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.c.localeCompare(b.c, "it"));
  if (preview && data?.finance) {
    const records = assignedGroups.flatMap(group => group.filter(r => reportSite === "both" || r.paidContext.site === reportSite));
    return <main className="stats-page stats-print-preview paid-report">
      <div className="stats-preview-actions"><strong>Anteprima report</strong><button disabled={!ready || busy} onClick={() => window.print()}>Stampa / PDF</button><button onClick={() => setPreview(false)}>Torna a Banca ore</button></div>
      <header className="stats-report-header"><div className="stats-report-brand"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="14" r="3.3" /><circle cx="17" cy="14" r="3.3" /><path d="M10.3 13.5a2 2 0 0 1 3.4 0" /><path d="M3.7 12.6 5.2 9.2" /><path d="M20.3 12.6 18.8 9.2" /></g></svg><strong>Sosticero</strong></div><div className="stats-report-meta"><span>sviluppato da Agentic Fabs</span><time dateTime={reportTime.toISOString()}>Generato il {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(reportTime)}</time></div></header>
      <h1>Report Banca ore</h1><p><strong>{reportSite === "both" ? "Tutte le sedi" : campus(reportSite)}</strong></p>
      <PaidBudgetSummary finance={data.finance} site={reportSite} />
      <section><h2>Ore assegnate a pagamento</h2><p>Tutte le ore registrate, incluse quelle future e da verificare, indipendentemente dalla settimana visualizzata.</p>
      {records.length ? <table className="paid-report-table"><thead><tr>{["Docente", "Data", "Ora", "Classe", "Sede", "Assegnata da", "Tariffa / costo"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{records.map(r => <tr key={r.date + r.key}><td>{r.name}</td><td>{dateLabel(r.date)}</td><td>{r.hour}ª</td><td>{r.c}</td><td>{campus(r.paidContext.site)}</td><td>{authorLabel(r.assignedBy)}</td><td>{r.paidPrice ? `${euro(r.paidPrice.cents)} · ${r.paidPrice.classification}` : "Da valorizzare"}</td></tr>)}</tbody></table> : <p>Nessuna supplenza a pagamento registrata.</p>}</section>
    </main>;
  }
  return <main className="ui-page paid-page"><header className="paid-heading"><div><h1>Banca ore</h1><p>Disponibilità settimanali per supplenze a pagamento</p></div>
    <div className="ui-actions"><label>Settimana del <input type="date" value={day} disabled={editing || busy} onChange={e => setDay(e.target.value)} /></label>
      <button className="ui-button" disabled={busy || !data || !ready} onClick={() => {
        if (!data || !ready || busy) return;
        try { generatePaidPdf(data).save(`banca-ore-${data.dates[0]}.pdf`); }
        catch (e) { setError(`Impossibile generare il PDF: ${e instanceof Error ? e.message : String(e)}`); }
      }}>Stampa / PDF</button>
      <div className="paid-report-controls" role="group" aria-label="Sede del report">{[["both", "Tutte le sedi"], ["centrale", "Centrale"], ["succursale", "Succursale"]].map(([id, label]) => <button type="button" key={id} className="ui-button" aria-pressed={reportSite === id} onClick={() => setReportSite(id)}>{label}</button>)}</div>
      <button className="ui-button" disabled={busy || !ready || !data?.finance} onClick={() => { setReportTime(new Date()); setPreview(true); }}>Stampa report</button>
      <button className="ui-button" aria-pressed={editing} disabled={busy || !data || !ready} onClick={() => { setEditing(!editing); setQuery(""); setError(""); }}>{editing ? "Fine modifica" : "Modifica disponibilità"}</button></div></header>
    {error && <p role="alert" className="ui-notice ui-notice-error">{error}</p>}
    <LoadingRegion pending={loading || busy} label={busy ? "Salvataggio…" : undefined} blocked={!ready || busy} error={loadError} retry={() => void refresh().catch(() => {})}>
    {data && <>
      {data.finance && <PaidBudgetSummary finance={data.finance} />}
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
          {editing ? <button className="paid-name" onClick={() => openSlot(w, h)}>{t.name}</button> : <strong>{t.name}</strong>}
          <small>{t.why || (t.uncertain ? "Sede da verificare" : t.sites.length === 2 ? "Entrambe" : t.sites.map(campus).join(" / "))}</small>
        </div>) || "—"}{!data.cells.find(c => c.weekday === w && c.hour === h)?.teachers.length && !editing && "—"}{editing && <button className="paid-edit" aria-label={`Modifica docenti · ${weekdays[w]}, ${h}ª ora`} disabled={busy} onClick={() => openSlot(w, h)}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>}</td>)}</tr>)}</tbody></table></div>
      <p className="paid-method">Sedi calcolate dall’orario, con cambio sede consentito negli intervalli 2–3 e 4–5. Le dichiarazioni sono ricorrenti; assenze e supplenze giornaliere vengono verificate al momento dell’assegnazione.</p>
      <section><h2>Ore assegnate a pagamento</h2><p>Ogni supplenza registrata conta subito, anche se futura. Avviso e richiesta email si gestiscono dalla tabella Supplenze.</p>

        <div className="paid-scroll" role="region" tabIndex={0} aria-label="Registro ore a pagamento"><table className="paid-register"><thead><tr>{["Docente", "Data", "Ora", "Classe", "Sede", "Assegnata da", "Tariffa / costo"].map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead>
          {assignedGroups.map(records => <tbody key={records[0].teacher}>{records.map((r, i) => <tr key={r.date + r.key}>
            {i === 0 && <th scope="rowgroup" rowSpan={records.length} className="paid-register-teacher">{r.name}<small>{records.length} {records.length === 1 ? "ora" : "ore"}</small></th>}
            <td>{dateLabel(r.date)}</td><td>{r.hour}ª</td><td>{r.c}</td><td>{campus(r.paidContext.site)}</td><td><span title={authorLabel(r.assignedBy, true)}>{authorLabel(r.assignedBy)}</span></td><td>{r.paidPrice ? <>{euro(r.paidPrice.cents)}<small> · {r.paidPrice.classification}</small></> : "Da valorizzare"}</td>
          </tr>)}</tbody>)}
        </table></div>
        {!data.records.length && <p>Nessuna supplenza a pagamento registrata.</p>}
      </section>
    </>}
    </LoadingRegion>
  </main>;
}
