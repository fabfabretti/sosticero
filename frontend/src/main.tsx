import { Auth, useAccount } from "./Auth";
import { requestApi } from "./session";
import { preconditions, ApiError, type Baseline } from "./concurrency";
import { useQuietRefresh } from "./useQuietRefresh";
import { ClassificationChoices } from "./ClassificationChoices";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import './ui.css';
import './settings.css';
import './inbox.css';
import './permessi.css';
import './orari.css';
import './supplenze.css';
import { SettingsGroup } from './SettingsGroup';
import type { Row, Candidate, Data, AbsenceKind, Assignment } from "./types";
import { TimetableImport } from "./TimetableImport";
import { HourTypes } from "./HourTypes";
import { CandidateDrawer } from "./CandidateDrawer";
import { AttachmentField, RecordInfo, type ImageDraft, type AttachmentMap } from "./Attachments";
import { Stats } from "./Stats";
import { TeacherTimetables } from "./TeacherTimetables";
import { AbsenceInbox, SheetsSettings, InboxNotice, useInboxStatus } from "./Inbox";
import { ReceptionImport } from './Receptions';
import { norm, teacherSearchText } from "./timetables";
import { HourHelp } from "./Tooltip";
import { SubstitutionExport } from "./SubstitutionExportPanel";
import { RecoveryActions } from "./RecoveryActions";
import { HashRouter, Link, useLocation } from "react-router";
const hours = [1, 2, 3, 4, 5, 6, 7];
const campusTag = (site: string) => <span key={site} className={`permit-campus campus-${site}`} aria-label={site === 'centrale' ? 'Centrale' : 'Succursale'} title={site === 'centrale' ? 'Centrale' : 'Succursale'}>{site === 'centrale' ? 'C' : 'S'}</span>;
const entryExitLabel = (id: string, hour: number) => {
  const time = (id === "ENTRA"
    ? ["", "08:35", "09:40", "10:35", "11:40", "12:35", "12:35", "13:25"]
    : id === "ESCE"
      ? ["", "", "08:35", "09:30", "10:35", "11:30", "12:35", "13:25"]
      : [])[hour];
  return time ? `${id === "ENTRA" ? "Entra dopo" : "Esce prima"} alle ${time}` : undefined;
};
const entryExitBoundary = (key: string, assignments: Record<string, Assignment>) => {
  const a = assignments[key];
  if (!a || !["ENTRA", "ESCE"].includes(a.v)) return false;
  const same = Object.keys(assignments).filter(k => assignments[k].c === a.c && assignments[k].v === a.v);
  const boundary = (a.v === "ENTRA" ? Math.max : Math.min)(...same.map(k => Number(k.split("|")[1])));
  return Number(key.split("|")[1]) === boundary;
};
const entryExitCellLabel = (key: string, assignments: Record<string, Assignment>) => {
  const a = assignments[key];
  if (!a || !["ENTRA", "ESCE"].includes(a.v)) return undefined;
  if (!entryExitBoundary(key, assignments)) return a.v === "ENTRA" ? "Non entrata" : "Uscita";
  return entryExitLabel(a.v, Number(key.split("|")[1]))?.replace("Entra dopo alle ", "Entra h ") || (a.v === "ENTRA" ? "Entra dopo" : "Esce prima");
};
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const schoolDate = (date: Date, offset = 0) => {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return localDate(d);
};
const italianDate = (value: string) => value.split("-").reverse().join("/");
const parseItalianDate = (value: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "";
  const iso = value.split("/").reverse().join("-");
  const parsed = new Date(iso + "T12:00");
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === iso ? iso : "";
};
const api = requestApi;
const TABS = [
  { path: "/", label: "Supplenze" },
  { path: "/permessi", label: "Permessi" },
  { path: "/orari", label: "Orari" },
  { path: "/banca-ore", label: "Banca ore" },
  { path: "/stats", label: "Stats" },
  { path: "/inbox", label: "Inbox" },
  { path: "/settings", label: "Settings" },
];
// Unknown routes fall back to Supplenze (home).
const screenFor = (pathname: string) =>
  TABS.find((t) => t.path === pathname) || TABS[0];
function Glasses() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="7" cy="14" r="3.3" />
        <circle cx="17" cy="14" r="3.3" />
        <path d="M10.3 13.5a2 2 0 0 1 3.4 0" />
        <path d="M3.7 12.6 5.2 9.2" />
        <path d="M20.3 12.6 18.8 9.2" />
      </g>
    </svg>
  );
}
function TopBar({ current, pending = 0 }: { current: string; pending?: number }) {
  const account = useAccount();
  return (
    <header className="bar">
      <span className="brand">
        <Glasses /> Sosticero
      </span>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={t.path === current ? "on" : ""}
            aria-current={t.path === current ? "page" : undefined}
          >
            {t.label}{t.path === "/inbox" && pending > 0 && <span className="inbox-count">{pending}</span>}
          </Link>
        ))}
      </nav>
      {account && <div className="account-identity"><strong>{account.name}</strong><span>{account.campus === 'centrale' ? 'Centrale' : 'Succursale'}</span><button className="ui-button" onClick={() => window.dispatchEvent(new Event('session-logout'))}>Esci</button></div>}
    </header>
  );
}
function Stub({ label }: { label: string }) {
  return (
    <section className="stub">
      <h1>{label}</h1>
      <p className="sub">Pagina in preparazione.</p>
    </section>
  );
}
function Permessi() {
  const [manual, setManual] = useState(false);
  const [manualHours, setManualHours] = useState("");
  const [editingManual, setEditingManual] = useState(false);
  const [sort, setSort] = useState<{ field: "date" | "requested"; ascending: boolean }>({ field: "date", ascending: false });
  const [data, setData] = useState<{ generation?: number; concurrency: Baseline; timetableVersions?: { effective: string | null; dataset: Data["dataset"] }[]; dataset: Data["dataset"]; permitAttachments?: AttachmentMap; permessi: Record<string, Record<string, number[]>>; permitRequests?: Record<string, Record<string, string>>; permitNotes?: Record<string, Record<string, string>>; manualPermitNotes?: Record<string, string>; permitKinds?: Record<string, Record<string, AbsenceKind>>; permitCreators?: Record<string, Record<string, string>>; recoveries?: Record<string, Record<string, import("./types").PermitRecovery>>; balances?: Record<string, { remaining: number; expired: number; eligible: number }>; manualPermits?: Record<string, { id: string; hours: number; recovered: number; remaining: number; recoveries: { date: string; h: number; key: string }[] }> }>();
  const [dayInput, setDayInput] = useState(italianDate(localDate(new Date())));
  const [requestedInput, setRequestedInput] = useState(italianDate(localDate(new Date())));
  const day = parseItalianDate(dayInput);
  const requestedOn = parseItalianDate(requestedInput);
  const invalidDates = !day || (!!requestedInput && !requestedOn);
  const [attachment, setAttachment] = useState<ImageDraft>();
  const [note, setNote] = useState("");
  const [newClassification, setNewClassification] = useState<AbsenceKind>(null);
  const [editClassification, setEditClassification] = useState<AbsenceKind>(null);
  const [teacher, setTeacher] = useState("");
  const [query, setQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => { setAttachment(undefined); }, [teacher, dayInput, manual]);
  const [original, setOriginal] = useState<{ day: string; id: string }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editBaseline = useRef<Baseline | undefined>(undefined);
  const [conflict, setConflict] = useState(false);
  const { refresh, invalidate } = useQuietRefresh(
    () => api<NonNullable<typeof data>>("permessi"),
    next => setData(old => JSON.stringify(old) === JSON.stringify(next) ? old : next),
    busy || !!query || !!teacher || !!note || !!attachment || !!manualHours || !!original || selected.length > 0 || dayInput !== italianDate(localDate(new Date())) || requestedInput !== italianDate(localDate(new Date())), "permessi",
  );
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, []);
  useEffect(() => { editBaseline.current = data?.concurrency; }, [original, editingManual]);
  const permitDataset = (date: string) => data?.timetableVersions?.filter(v => !v.effective || v.effective <= date).at(-1)?.dataset || data?.dataset;
  const teachingSites = (id: string, date: string) => ['centrale', 'succursale'].filter(site =>
    Object.entries(permitDataset(date)?.lessons || {}).some(([key, lesson]) => key.split('|')[0] === id && lesson.site === site));
  const scheduled = (id: string, date: string, h: number) => {
    const weekday = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"][new Date(date + "T12:00").getDay()];
    return !!permitDataset(date)?.lessons[`${id}|${weekday}|${h}`];
  };
  const dailyMaximum = (id: string, date: string) => Math.floor(hours.filter(h => scheduled(id, date, h)).length / 2);
  const maximum = dailyMaximum(teacher, day);
  const overLimit = !!teacher && selected.length > maximum;
  const suggestions = query && !teacher
    ? Object.values((manual ? data?.dataset : permitDataset(day))?.teachers || {})
        .filter(t => (!t.retired || t.id === original?.id) && norm(teacherSearchText(t)).includes(norm(query)))
        .sort((a, b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name))
        .slice(0, 6)
    : [];
  const selectTeacher = (id: string) => {
    setTeacher(id);
    setQuery(data?.dataset.teachers[id]?.name || id);
  };
  const reset = () => {
    setAttachment(undefined);
    setNote("");
    setManualHours("");
    setEditingManual(false);
    setDayInput(italianDate(localDate(new Date())));
    setRequestedInput(italianDate(localDate(new Date())));
    setOriginal(undefined);
    setTeacher("");
    setQuery("");
    setSelected([]);
  };
  const save = async (body: Parameters<typeof preconditions>[2], endpoint = "permessi") => {
    if (conflict) return;
    invalidate();
    setBusy(true);
    setError("");
    try {
      await api(endpoint, { ...body, expected: preconditions((original || editingManual) ? editBaseline.current : data?.concurrency, endpoint, body) });
      await refresh();
      reset();
    } catch (e) {
      setError(String(e));
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        try { await refresh(); } catch { /* Keep entered values and the conflict until explicit reload. */ }
      }
    } finally {
      setBusy(false);
    }
  };
  const records = Object.entries(data?.permessi || {}).flatMap(([date, teachers]) =>
    Object.entries(teachers).map(([id, periods]) => ({ date, id, periods, recovery: data?.recoveries?.[date]?.[id], requested: data?.permitRequests?.[date]?.[id] || "" })),
  ).sort((a, b) => {
    const left = a[sort.field], right = b[sort.field];
    return Number(!left) - Number(!right) || (sort.ascending ? 1 : -1) * left.localeCompare(right) || b.date.localeCompare(a.date) || (data?.dataset.teachers[a.id]?.name || a.id).localeCompare(data?.dataset.teachers[b.id]?.name || b.id);
  });
  const warning = (text: string) => <HourHelp text={text}>
    <svg className="warning-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
  </HourHelp>;
  return <div className="app ui-page permessi">
    <aside>
    {conflict && <div role="alert"><p>Il record è cambiato. I valori inseriti sono rimasti nel modulo.</p><button className="ui-button" onClick={async () => { try { await refresh(); reset(); setConflict(false); setError(""); } catch (e) { setError(String(e)); } }}>Ricarica valori salvati</button></div>}
    <form className="permit-form" onSubmit={e => { e.preventDefault(); if (manual) { if (teacher && Number.isInteger(Number(manualHours)) && Number(manualHours) > 0) void save({ id: teacher, hours: Number(manualHours), note, editing: editingManual }, "manual-permits"); return; } if (invalidDates || !teacher || !selected.length) return; void save({ day, id: teacher, requested_on: requestedOn || null, note, attachment, classification: original ? editClassification : newClassification, hours: selected, ...(original ? { original_day: original.day, original_id: original.id } : {}) }); }}>
      <h2>{manual ? (editingManual ? "Modifica saldo manuale" : "Aggiungi saldo manuale") : original ? "Modifica permesso" : "Aggiungi permesso"}</h2>
      <label className="manual-permit-toggle"><input type="checkbox" checked={manual} disabled={busy} onChange={e => { reset(); setManual(e.target.checked); setError(""); }} />Saldo manuale senza data</label>
      <fieldset disabled={busy || !data}>
        <div className="ui-field permit-teacher">
          <label htmlFor="permit-teacher">Docente</label>
          <div className="sw">
            <input id="permit-teacher" disabled={editingManual} aria-label="Cerca docente" placeholder="Docente, es. ros" autoComplete="off" value={query}
              onChange={e => { setQuery(e.target.value); setTeacher(""); setSuggestionIndex(0); }}
              onKeyDown={e => {
                if (e.key === "Escape") { setQuery(""); setTeacher(""); }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSuggestionIndex((suggestionIndex + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % Math.max(1, suggestions.length));
                }
                if (e.key === "Enter" && suggestions[suggestionIndex]) { e.preventDefault(); selectTeacher(suggestions[suggestionIndex].id); }
              }} />
            {!!suggestions.length && <div className="sug">{suggestions.map((t, i) =>
              <button key={t.id} type="button" className={suggestionIndex === i ? "on" : ""} onClick={() => selectTeacher(t.id)}>{t.name}<small>docente</small></button>
            )}</div>}
          </div>
        </div>
        <label>Note (facoltative)<textarea aria-label="Note permesso" value={note} onChange={e => setNote(e.target.value)} /></label>
        {manual ? <>
          <label>Ore totali da recuperare<input aria-label="Ore totali da recuperare" type="number" min="1" step="1" required value={manualHours} onChange={e => setManualHours(e.target.value)} /></label>
          <p className="sub">Per ore pregresse senza registrazione giornaliera. Nessuna assenza in Supplenze e nessuna scadenza automatica. I recuperi RP scalano questo saldo.</p>
          {editingManual && <p className="sub">Il totale include le ore già recuperate: {data?.manualPermits?.[teacher]?.recovered ?? 0}.</p>}
        </> : <>
        <AttachmentField key={`${teacher}|${dayInput}|${manual}`} value={attachment} saved={original ? data?.permitAttachments?.[original.day]?.[original.id] : undefined} onChange={setAttachment} disabled={busy} />
        <ClassificationChoices value={original ? editClassification : newClassification} onChange={original ? setEditClassification : setNewClassification} />
        <label>Data permesso<input required aria-label="Data permesso" type="text" inputMode="numeric" placeholder="gg/mm/aaaa" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" value={dayInput} aria-invalid={!!dayInput && !day} onChange={e => setDayInput(e.target.value)} /></label>
        <label>Data richiesta (facoltativa)<input aria-label="Data richiesta" type="text" inputMode="numeric" placeholder="gg/mm/aaaa" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" value={requestedInput} aria-invalid={!!requestedInput && !requestedOn} onChange={e => setRequestedInput(e.target.value)} /></label>
        <div className="ui-field"><span>Ore di permesso</span><div className="hrs permit-hours">{hours.map(h => <span className="permit-hour" key={h}>
          <button type="button" aria-label={`Permesso ${h}ª ora`} aria-pressed={selected.includes(h)} className={selected.includes(h) ? "on" : ""} onClick={() => setSelected(selected.includes(h) ? selected.filter(v => v !== h) : [...selected, h])}>{h}</button>
          {teacher && selected.includes(h) && (overLimit || !scheduled(teacher, day, h)) && warning([overLimit ? `Massimo giornaliero: ${maximum} ore di permesso; selezionate ${selected.length}.` : "", !scheduled(teacher, day, h) ? `${h}ª ora: nessuna attività prevista nell’orario per questa ora.` : ""].filter(Boolean).join(" "))}
        </span>)}</div></div>

        <p className="sub">Massimo giornaliero: {maximum} ore · Selezionate: {selected.length}. Sono comprese tutte le attività in orario, inclusi POT e DIS.</p>
        </>}
        <button className="ui-button ui-button-primary permit-save" type="submit" disabled={conflict || !teacher || (manual ? !Number.isInteger(Number(manualHours)) || Number(manualHours) < 1 : invalidDates || !selected.length)}>{busy ? "Salvataggio…" : manual ? "Salva saldo manuale" : "Salva permesso"}</button>
        {(original || editingManual) && <button className="ui-button" type="button" onClick={reset}>Annulla modifica</button>}
      </fieldset>
      <div className="permit-feedback" aria-live="polite">{!manual && invalidDates && <p role="alert">Inserisci date valide nel formato gg/mm/aaaa.</p>}{(error || (!manual && overLimit)) && <p role="alert">{error || `Superato il massimo giornaliero di ${maximum} ore di permesso.`}</p>}</div>
    </form>
    </aside>
    <main>
    <h1>Permessi</h1>
    <p className="sub">Per i permessi con data, recupero entro un mese dal permesso, scadenza inclusa. Le assegnazioni RP future riservano già le ore e sono elencate per data.</p>
    {!data && !error && <p role="status">Caricamento…</p>}
    <div className="ui-surface permit-table"><table className="ui-table"><thead><tr><th>Docente</th><th>Sede lezioni</th><th>Inserito da</th>{([ ["date", "Data permesso"], ["requested", "Data richiesta"] ] as const).map(([field, title]) => <th key={field} aria-sort={sort.field === field ? (sort.ascending ? "ascending" : "descending") : "none"}><button className="lk" onClick={() => setSort({ field, ascending: sort.field === field ? !sort.ascending : false })}>{title}{sort.field === field ? (sort.ascending ? " ↑" : " ↓") : " ↕"}</button></th>)}{["Ore di permesso", "Dettaglio recuperi", "Ore da recuperare", "Azioni"].map(title => <th key={title}>{title}</th>)}</tr></thead>
      <tbody>{records.map(r => <tr key={r.date + r.id} className={(r.recovery?.remaining ?? r.periods.length) === 0 ? "permit-complete" : "permit-outstanding"}>
        <td><span className="permit-name">{data?.dataset.teachers[r.id]?.name || r.id}</span><RecordInfo text={data?.permitNotes?.[r.date]?.[r.id]} links={[{ label: "Apri allegato permesso", id: data?.permitAttachments?.[r.date]?.[r.id] }]} /></td>
        <td>{teachingSites(r.id, r.date).length ? teachingSites(r.id, r.date).map(campusTag) : '—'}</td>
        <td>{data?.permitCreators?.[r.date]?.[r.id] ? campusTag(data.permitCreators[r.date][r.id]) : '—'}</td><td>{r.date.split("-").reverse().join("/")}</td>
        <td>{data?.permitRequests?.[r.date]?.[r.id]?.split("-").reverse().join("/") || "—"}</td>
        <td>{r.periods.map(h => <span className="permit-period" key={h}>{h}ª{(r.periods.length > dailyMaximum(r.id, r.date) || !scheduled(r.id, r.date, h)) && warning([r.periods.length > dailyMaximum(r.id, r.date) ? "Superato il massimo giornaliero di ore di permesso." : "", !scheduled(r.id, r.date, h) ? `${h}ª ora: nessuna attività prevista nell’orario per questa ora` : ""].filter(Boolean).join(" "))}</span>)}</td>
        <td>{r.recovery?.recoveries.length ? <ul className="recovery-details">{r.recovery.recoveries.map(item => <li key={item.date + item.key}>{item.date.split("-").reverse().join("/")} · {item.h}ª ora</li>)}</ul> : "—"}</td>
        <td><span className="permit-remaining">{r.recovery?.remaining ?? r.periods.length}</span>{r.recovery?.expired && <strong className="permit-expired">Scadute</strong>}</td>
        <td className="permit-actions"><button className="lk" aria-label={`Modifica permesso di ${data?.dataset.teachers[r.id]?.name || r.id}`} title="Modifica permesso" disabled={busy} onClick={() => { setAttachment(undefined); setManual(false); setEditingManual(false); setDayInput(italianDate(r.date)); setRequestedInput(italianDate(data?.permitRequests?.[r.date]?.[r.id] || "")); selectTeacher(r.id); setSelected(r.periods); setNote(data?.permitNotes?.[r.date]?.[r.id] || ""); setEditClassification(data?.permitKinds?.[r.date]?.[r.id] || null); setOriginal({ day: r.date, id: r.id }); setError(""); }}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
        <button className="x" aria-label={`Rimuovi permesso di ${data?.dataset.teachers[r.id]?.name || r.id}`} title="Rimuovi permesso" disabled={busy} onClick={() => { if (window.confirm(`Eliminare il permesso di ${data?.dataset.teachers[r.id]?.name || r.id} del ${italianDate(r.date)}?`)) void save({ day: r.date, id: r.id, hours: null }); }}>×</button></td>
      </tr>)}</tbody></table></div>
    {!!Object.keys(data?.manualPermits || {}).length && <section className="manual-permits">
      <h2>Saldi manuali</h2>
      <p className="sub">Ore pregresse senza data e senza scadenza automatica.</p>
      <div className="ui-surface permit-table"><table className="ui-table"><thead><tr>{["Docente", "Ore totali", "Ore recuperate", "Dettaglio recuperi", "Ore da recuperare", "Azioni"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
      {Object.entries(data?.manualPermits || {}).sort(([a], [b]) => (data?.dataset.teachers[a]?.name || a).localeCompare(data?.dataset.teachers[b]?.name || b)).map(([id, p]) => <tr key={id} className={p.remaining > 0 ? "permit-outstanding" : undefined}>
        <td><span className="permit-name">{data?.dataset.teachers[id]?.name || id}</span><RecordInfo text={data?.manualPermitNotes?.[id]} /></td><td>{p.hours}</td><td>{p.recovered}</td>
        <td>{p.recoveries.length ? <ul className="recovery-details">{p.recoveries.map(item => <li key={item.date + item.key}>{italianDate(item.date)} · {item.h}ª ora</li>)}</ul> : "—"}</td>
        <td><span className="permit-remaining">{p.remaining}</span></td>
        <td className="permit-actions"><button className="lk" disabled={busy} aria-label={`Modifica saldo manuale di ${data?.dataset.teachers[id]?.name || id}`} onClick={() => { reset(); setManual(true); selectTeacher(id); setManualHours(String(p.hours)); setNote(data?.manualPermitNotes?.[id] || ""); setEditingManual(true); setError(""); }}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
        <button className="x" disabled={busy} aria-label={`Rimuovi saldo manuale di ${data?.dataset.teachers[id]?.name || id}`} onClick={() => { if (window.confirm(`Eliminare il saldo manuale di ${data?.dataset.teachers[id]?.name || id}?`)) void save({ id, hours: null }, "manual-permits"); }}>×</button></td>
      </tr>)}</tbody></table></div>
    </section>}
    {data && !records.length && !Object.keys(data.manualPermits || {}).length && <p className="none">Nessun permesso registrato.</p>}
    </main>
  </div>;
}

function Settings() {
  const account = useAccount();
  const readOnly = account?.campus !== "centrale";
  const [hourSummary, setHourSummary] = useState('Caricamento…');
  const [receptionSummary, setReceptionSummary] = useState('Ricevimenti: caricamento…');
  const [connectionSummary, setConnectionSummary] = useState('Caricamento…');
  const [backupSummary, setBackupSummary] = useState('Caricamento…');
  const [backupRevision, setBackupRevision] = useState(0);
  const [archiveError, setArchiveError] = useState('');
  const [archiveMessage, setArchiveMessage] = useState('');
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [data, setData] = useState<Data>(),
    [error, setError] = useState("");
  const request = useRef(0);
  const refresh = async () => {
    const n = ++request.current;
    try {
      const d = await api<Data>("day/" + localDate(new Date()));
      if (n === request.current) { setData(d); setError(''); }
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const upload = async (file: File | undefined, target: string) => {
    if (!file) return;
    setArchiveError(''); setArchiveMessage('');
    try {
      let content = JSON.parse(await file.text());
      if (target === 'import') {
        const preview = await api<{ generation: number; overrides: { teacher: string; review: boolean }[] }>('import/preview', content);
        content = { ...content, _generation: preview.generation };
        const review = preview.overrides.filter(r => r.review);
        if (!window.confirm(`Ripristinare l’archivio ${file.name}? I dati attuali verranno sostituiti. ${review.length} modifiche manuali richiedono verifica${review.length ? ': ' + [...new Set(review.map(r => r.teacher))].join(', ') : ''}. Le modifiche incompatibili useranno le ore importate fino alla verifica.`)) return;
      }
      await api(target, content);
      await refresh();
      setBackupRevision(value => value + 1); setArchiveMessage('Archivio ripristinato.');
    } catch (e) {
      setArchiveError(String(e));
    }
  };
  const exportData = async () => {
    setArchiveError(''); setArchiveMessage('');
    try {
      const b = await api("export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "supplenze-salvate.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setArchiveError(String(e));
    }
  };
  return <section className="ui-page settings">
    <h1>Settings</h1>
    <p className="settings-intro settings-muted">Configurazione, collegamenti e gestione dei dati.</p>
    {readOnly && <p className="ui-notice" role="status">Configurazione condivisa: modifiche riservate alla sede Centrale.</p>}
    <fieldset className="settings-permissions" disabled={readOnly}>
    <SettingsGroup title="Orari e ricevimenti" description="Importa e verifica gli impegni settimanali." status={[data ? `${Object.keys(data.dataset.teachers).length} docenti · ${data.dataset.classes.length} classi` : error ? 'Orario non disponibile' : 'Caricamento…', receptionSummary].join(' · ')}>
      <TimetableImport api={api} onImported={() => { void refresh(); setBackupRevision(value => value + 1); }} />
      {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
      {!!data?.dataset.warnings.length && <details className="settings-disclosure"><summary>{data.dataset.warnings.length} anomalie da verificare</summary><pre className="settings-pre">{JSON.stringify(data.dataset.warnings, null, 2)}</pre></details>}
      <ReceptionImport api={api} onSummary={setReceptionSummary} revision={backupRevision} onImported={() => setBackupRevision(value => value + 1)} />
    </SettingsGroup>
    <SettingsGroup title="Regole supplenze" description="Disponibilità e visibilità dei tipi di ora." status={hourSummary}>
      <HourTypes api={api} onSummary={setHourSummary} revision={`${backupRevision}:${JSON.stringify(data?.dataset)}`} />
    </SettingsGroup>
    <SettingsGroup title="Collegamenti" description="Importazione delle assenze da Google Forms." status={connectionSummary}>
      <SheetsSettings api={api} onSummary={setConnectionSummary} revision={backupRevision} />
    </SettingsGroup>
    <SettingsGroup title="Dati e backup" description="Esporta i dati o ripristina un archivio salvato." status={backupSummary}>
      <section className="settings-subsection" aria-label="Archivio JSON">
        <h2>Archivio JSON</h2>
        <p className="settings-muted">Esporta i dati portabili oppure sostituiscili con un archivio JSON. I backup del database sono elencati sotto.</p>
        <div className="ui-actions"><button className="ui-button" onClick={() => void exportData()}>Esporta supplenze</button>
          <label className="ui-field">Archivio da ripristinare<input type="file" accept=".json,application/json" onChange={e => void upload(e.target.files?.[0], "import")} /></label>
        </div>
        {archiveMessage && <p className="ui-notice" role="status">{archiveMessage}</p>}
        {archiveError && <p className="ui-notice ui-notice-error" role="alert">{archiveError}</p>}
      </section>
      <BackupSection onSummary={setBackupSummary} revision={backupRevision} onRestored={() => { void refresh(); setBackupRevision(value => value + 1); }} />
    </SettingsGroup>
    </fieldset>
    <SettingsGroup title="Aspetto" description="Scegli il tema dell’interfaccia." status={theme === 'dark' ? 'Scuro' : 'Chiaro'}>
      <div className="ui-actions"><button className="ui-button" aria-pressed={theme === 'dark'} onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; setTheme(next); }}>Chiaro / scuro</button></div>
    </SettingsGroup>
  </section>;
}
function Shell() {
  const { pathname } = useLocation();
  const tab = screenFor(pathname);
  const inboxStatus = useInboxStatus(api, true);
  return (
    <div className="shell">
      <TopBar current={tab.path} pending={inboxStatus.pending} />
      <InboxNotice count={inboxStatus.pending} />
      {tab.path === "/" ? (
        <Supplenze />
      ) : tab.path === "/permessi" ? (
        <Permessi />
      ) : tab.path === "/orari" ? (
        <TeacherTimetables api={api} />
      ) : tab.path === "/inbox" ? (
        <AbsenceInbox api={api} />
      ) : tab.path === "/settings" ? (
        <Settings />
      ) : tab.path === "/stats" ? (
        <Stats />
      ) : (
        <Stub label={tab.label} />
      )}
      {tab.path === "/settings" && (
        <footer className="credits">by Fabs 🤝🏻 Big Pickle, 2026</footer>
      )}
    </div>
  );
}
function App() {
  const [testing, setTesting] = useState(true);
  useEffect(() => {
    const refresh = () => {
      void api<{ testing: boolean }>('environment')
        .then(data => setTesting(data.testing !== false))
        .catch(() => setTesting(true));
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <HashRouter>
      {testing && <div className="testing-ribbon" role="status">TESTING</div>}
      <Auth><Shell /></Auth>
    </HashRouter>
  );
}
function Supplenze() {
  const account = useAccount();
  const canAssign = (site: string | null | undefined) => !!account && site === account.campus;
  const [day, setDay] = useState(() => schoolDate(new Date())),
    [month, setMonth] = useState(
      () => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, 1),
    );
  const [data, setData] = useState<Data>(),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState<"abs" | "dis">("abs"),
    [wholeDay, setWholeDay] = useState(true),
    [entryHours, setEntryHours] = useState<number[]>([]),
    [classification, setClassification] = useState<AbsenceKind>(null),
    [chosen, setChosen] = useState<{ id: string; label: string; group: "abs" | "dis" | "cf" }>(),
    [editingKind, setEditingKind] = useState<string>(),
    [absenceNote, setAbsenceNote] = useState(""),
    [entryNote, setEntryNote] = useState(""),
    [site, setSite] = useState<string>(account?.campus || "centrale"),
    [filter, setFilter] = useState(() => {
      try {
        const saved = localStorage.getItem("supplenze-campus");
        return saved === "centrale" || saved === "succursale" ? saved : "all";
      } catch { return "all"; }
    }),
    [open, setOpen] = useState<Row>(),
    [cands, setCands] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(0);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entrySuccess, setEntrySuccess] = useState("");
  const entryTrigger = useRef<HTMLButtonElement>(null);
  const entryDialog = useRef<HTMLDivElement>(null);
  const clearEntry = () => { setQuery(""); setChosen(undefined); setSelected(0); setEntryNote(""); setEntryAttachment(undefined); setEntrySuccess(""); };
  const closeEntry = () => { setEntryOpen(false); clearEntry(); };
  useEffect(() => {
    if (!entryOpen) return;
    document.getElementById("q")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeEntry(); }
      if (e.key === "Tab") {
        const nodes = Array.from(entryDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); entryTrigger.current?.focus(); };
  }, [entryOpen]);
  const [entryAttachment, setEntryAttachment] = useState<ImageDraft>();
  const [editAttachment, setEditAttachment] = useState<ImageDraft>();
  const [editingDis, setEditingDis] = useState<string>();
  const [disTeacher, setDisTeacher] = useState<string>();
  useEffect(() => {
    if (disTeacher && data && !Object.hasOwn(data.state.dis[day] || {}, disTeacher) && !Object.hasOwn(data.autoDis?.[day] || {}, disTeacher)) {
      setDisTeacher(undefined);
      setEditingDis(undefined);
      setEditAttachment(undefined);
    }
  }, [data, day, disTeacher]);
  const adding = useRef(false);
  const focusAfterAdd = useRef(false);
  useEffect(() => {
    if (!busy && !chosen && focusAfterAdd.current) {
      document.getElementById("q")?.focus();
      focusAfterAdd.current = false;
    }
  }, [busy, chosen]);
  const [loadedDay, setLoadedDay] = useState("");
  const candidateRequest = useRef(0);
  const candidateBaseline = useRef<Baseline | undefined>(undefined);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [consultation, setConsultation] = useState<{ h: number; sede: string | null }>();
  const consultationTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    ++candidateRequest.current;
    setConsultation(undefined);
    setOpen(undefined);
    setLoadingCandidates(false);
  }, [day, filter]);
  useEffect(() => {
    try { localStorage.setItem("supplenze-campus", filter); } catch { /* Browser storage may be unavailable. */ }
  }, [filter]);
  const editBaseline = useRef<Baseline | undefined>(undefined);
  useEffect(() => { editBaseline.current = data?.concurrency; }, [editingKind, editingDis]);
  const [conflict, setConflict] = useState(false);
  const [conflictSummary, setConflictSummary] = useState("");
  const { refresh, invalidate } = useQuietRefresh(
    () => api<Data>("day/" + day),
    next => { setData(old => JSON.stringify(old) === JSON.stringify(next) ? old : next); setLoadedDay(day); },
    entryOpen || busy || loadingCandidates || !!open || !!consultation || !!editingKind || !!editingDis || !!disTeacher || !!query || !!chosen || !!entryNote || !!entryAttachment,
    day,
    entryOpen,
  );
  useEffect(() => {
    ++candidateRequest.current;
    setOpen(undefined);
    setEntryOpen(false);
    clearEntry();
    void refresh().catch(e => setError(String(e)));
    setConflict(false);
    setLoadingCandidates(false);
    setEditingKind(undefined);
    setEditingDis(undefined);
    setDisTeacher(undefined);
    setEditAttachment(undefined);
    setEntryAttachment(undefined);
    setAbsenceNote("");
    setEntryNote("");
  }, [day]);
  const mutate = async (url: string, body: Parameters<typeof preconditions>[2]) => {
    if (conflict) return false;
    invalidate();
    ++candidateRequest.current;
    setLoadingCandidates(false);
    setOpen(undefined);
    setConsultation(undefined);
    setBusy(true);
    setError("");
    try {
      const editing = url === "entries" && (body.id === editingKind || body.id === editingDis);
      const saved = await api<{ concurrency: Baseline }>(url, { ...body, expected: preconditions(editing ? editBaseline.current : data?.concurrency, url, body) });
      if (editing) editBaseline.current = saved.concurrency;
      await refresh();
      return true;
    } catch (e) {
      setError(String(e));
      if (e instanceof ApiError && e.status === 409) {
        if (editingKind || editingDis || query || chosen) {
          setConflict(true);
          setConflictSummary("");
          try {
            const latest = await api<Data>("day/" + day);
            const group = body.group;
            if (group === "abs" || group === "cf" || group === "dis") {
              const id = body.id!, d = body.day!;
              const hours = latest.state[group][d]?.[id];
              const note = group === "abs" ? latest.state.absenceNotes?.[d]?.[id] : undefined;
              const kind = group === "abs" ? latest.state.absenceKinds?.[d]?.[id] : undefined;
              const label = kind && { planned: "Programmata", last_minute: "Last minute", trip: "In gita", strike: "In sciopero" }[kind];
              const site = group === "dis" ? latest.state.disSites[d]?.[id] : undefined;
              const attachment = group === "abs" ? latest.state.absenceAttachments?.[d]?.[id] : latest.state.disAttachments?.[d]?.[id];
              setConflictSummary(hours ? [`Ore salvate: ${hours.join(", ") || "nessuna"}`, note && `Nota: ${note}`, label, site && `Sede: ${site}`, attachment && "Allegato presente"].filter(Boolean).join(" · ") : "Registrazione non più presente.");
            }
          } catch { /* Explicit reload remains available when the server cannot be reached. */ }
        }
        else { try { await refresh(); } catch { /* Keep the original conflict visible. */ } }
      }
      return false;
    } finally {
      setBusy(false);
    }
  };
  const choose = async (r: Row) => {
    if (busy) return;
    setConsultation(undefined);
    closeEntry();
    const n = ++candidateRequest.current;
    invalidate();
    candidateBaseline.current = data?.concurrency;
    setLoadingCandidates(true);
    setError("");
    try {
      const c = await api<Candidate[]>(
        "candidates?" + new URLSearchParams({ day, key: r.k }),
      );
      if (n === candidateRequest.current) {
        setCands(c);
        setOpen(r);
      }
    } catch (e) {
      if (n === candidateRequest.current) setError(String(e));
    } finally { if (n === candidateRequest.current) setLoadingCandidates(false); }
  };
  const consult = async (h: number, trigger: HTMLButtonElement) => {
    if (busy || loadingCandidates) return;
    consultationTrigger.current = trigger;
    closeEntry();
    setOpen(undefined);
    const n = ++candidateRequest.current;
    invalidate();
    setLoadingCandidates(true);
    setError("");
    try {
      const c = await api<Candidate[]>("availability?" + new URLSearchParams({ day, hour: String(h), campus: filter }));
      if (n === candidateRequest.current) {
        setCands(c);
        setConsultation({ h, sede: filter === "all" ? null : filter });
      }
    } catch (e) {
      if (n === candidateRequest.current) setError(String(e));
    } finally { if (n === candidateRequest.current) setLoadingCandidates(false); }
  };
  const name = (id: string) =>
    data?.dataset.teachers[id]?.name ||
    { DIR: "Dirigente", ENTRA: "Entra dopo", ESCE: "Esce prima", UNCOVERED: "Scoperta" }[id] ||
    id;
  const entries = (g: "abs" | "cf" | "dis") => data?.state[g][day] || {};
  const suggestions =
    query && !chosen && data
      ? [
          ...Object.values(data.dataset.teachers)
            .filter(
              (t) =>
                !t.retired &&
                norm(teacherSearchText(t)).includes(norm(query)),
            )
            .map((t) => ({ id: t.id, label: t.name, group: kind })),
          ...(kind === "abs"
            ? data.dataset.classes
                .filter((c) => norm(c).includes(norm(query)))
                .map((c) => ({ id: c, label: c, group: "cf" as const }))
            : []),
        ]
          .sort(
            (a, b) =>
              Number(!norm(a.label).startsWith(norm(query))) -
              Number(!norm(b.label).startsWith(norm(query))),
          )
          .slice(0, 6)
      : [];
  const target = chosen || suggestions[selected];
  const duplicate = !!target && Object.hasOwn(entries(target.group === "cf" ? "cf" : kind), target.id);
  useEffect(() => { if (kind !== "abs" || target?.group === "cf") setEntryNote(""); }, [kind, target?.group]);
  useEffect(() => { setEntryAttachment(undefined); }, [day, kind, target?.id, target?.group]);
  const add = async () => {
    if (busy || conflict || duplicate || adding.current || !target || (!wholeDay && !entryHours.length)) return;
    const group = target.group === "cf" ? "cf" : kind;
    if (entries(group)[target.id] || (group === "cf" && kind !== "abs")) return;
    adding.current = true;
    try {
      const saved = await mutate("entries", {
        day, group, id: target.id,
        hours: wholeDay ? hours : entryHours,
        site, defaults: wholeDay,
        ...(group !== "cf" ? { attachment: entryAttachment } : {}),
        ...(group === "abs" ? { classification, note: entryNote } : {}),
      });
      if (saved) {
        setEntrySuccess(`${target.label}: registrazione aggiunta.`);
        setEntryAttachment(undefined);
        setEntryNote("");
        focusAfterAdd.current = true;
        setQuery("");
        setChosen(undefined);
        setSelected(0);
      }
    } finally {
      adding.current = false;
    }
  };
  const absenceKind = (id: string): AbsenceKind => {
    const kinds = [data?.state.absenceKinds?.[day]?.[id], data?.state.permitKinds?.[day]?.[id]];
    return kinds.includes("last_minute") ? "last_minute" : kinds.includes("strike") ? "strike" : kinds.includes("trip") ? "trip" : kinds.includes("planned") ? "planned" : null;
  };
  const absentIds = Object.keys({ ...entries("abs"), ...data?.state.permessi?.[day] });
  const renderEntries = (g: "abs" | "cf" | "dis", ids = Object.keys(entries(g))) =>
    ids.map((id) => {
      const hs = entries(g)[id] || [];
      const permit = g === "abs" ? data?.state.permessi?.[day]?.[id] || [] : [];
      const requested = g === "abs" ? data?.state.permitRequests?.[day]?.[id] : "";
      const manualNote = g === "abs" ? data?.state.absenceNotes?.[day]?.[id] : "";
      const savedPermitNote = g === "abs" ? data?.state.permitNotes?.[day]?.[id] : "";
      const permitNote = requested ? `Permesso concesso il ${requested.split("-").reverse().join("/")}` : "Permesso";
      const info = [permit.length ? permitNote : "", manualNote ? `Assenza: ${manualNote}` : "", savedPermitNote ? `Permesso: ${savedPermitNote}` : ""].filter(Boolean).join("\n\n");
      return (
        <div className="entry-row" key={g + id}>
        <div className="rw">
          <button
            className="n"
            title={name(id)}
            disabled={g === "abs" && !Object.hasOwn(entries(g), id)}
            onClick={() =>
              void mutate("entries", {
                day,
                group: g,
                id,
                hours: hs.length === 7 ? [] : hours,
                site: data?.state.disSites[day]?.[id],
              })
            }
          >
            {g === "cf" ? "Classe " + id : name(id)}
          </button>
          {g === "abs" && (
            <RecordInfo text={info} links={[{ label: "Apri allegato assenza", id: data?.state.absenceAttachments?.[day]?.[id] }, { label: "Apri allegato permesso", id: data?.state.permitAttachments?.[day]?.[id] }]} />
          )}
          <div className="hrs">
            {hours.map((h) => {
              const locked = permit.includes(h);
              const btn = (
                <button
                  aria-label={`${name(id)}, ${h}ª ora`}
                  aria-pressed={hs.includes(h) || locked}
                  className={(hs.includes(h) || locked ? "on " : "") + (locked ? "auto" : "")}
                  disabled={locked}
                  onClick={() =>
                    void mutate("entries", {
                      day,
                      group: g,
                      id,
                      hours: hs.includes(h)
                        ? hs.filter((x) => x !== h)
                        : [...hs, h],
                      site: data?.state.disSites[day]?.[id],
                    })
                  }
                >
                  {h}
                </button>
              );
              return locked
                ? <HourHelp key={h} text="Modifica dalla pagina permessi">{btn}</HourHelp>
                : <React.Fragment key={h}>{btn}</React.Fragment>;
            })}
          </div>
          {g === "dis" && (
            <select
              data-dis-site={id}
              aria-label={"Sede di " + name(id)}
              value={data?.state.disSites[day]?.[id] || ""}
              onChange={(e) =>
                void mutate("entries", {
                  day,
                  group: g,
                  id,
                  hours: hs,
                  site: e.target.value,
                })
              }
            >
              <option value="">?</option>
              <option value="centrale">C</option>
              <option value="succursale">S</option>
            </select>
          )}
          {g === "abs" && Object.hasOwn(entries(g), id) && <button className="edit-kind" aria-label={"Modifica assenza di " + name(id)} aria-expanded={editingKind === id} onClick={() => { setEditAttachment(undefined); setEditingDis(undefined); setEditingKind(editingKind === id ? undefined : id); setAbsenceNote(data?.state.absenceNotes?.[day]?.[id] || ""); }}>⋯</button>}
          <button
            className="x"
            aria-label={"Rimuovi " + name(id)}
            disabled={g === "abs" && !Object.hasOwn(entries(g), id)}
            onClick={() => void mutate("entries", { day, group: g, id })}
          >
            ×
          </button>
        </div>
        {g === "abs" && editingKind === id && Object.hasOwn(entries(g), id) && <div className="absence-editor">
          <ClassificationChoices value={data?.state.absenceKinds?.[day]?.[id] || null} onChange={value => void mutate("entries", { day, group: "abs", id, hours: hs, classification: value })} />
          <label>Note (facoltative)<textarea aria-label={"Note assenza di " + name(id)} value={absenceNote} disabled={busy} onChange={e => setAbsenceNote(e.target.value)} /></label>
          <AttachmentField key={`abs|${day}|${id}`} value={editAttachment} saved={data?.state.absenceAttachments?.[day]?.[id]} onChange={setEditAttachment} disabled={busy} />
          <button className="ui-button" disabled={busy} onClick={async () => { if (await mutate("entries", { day, group: "abs", id, hours: hs, note: absenceNote, attachment: editAttachment })) { setEditAttachment(undefined); setEditingKind(undefined); } }}>Salva nota e allegato</button>
          <button className="ui-button" onClick={() => { setEditingKind(undefined); setEditAttachment(undefined); }}>Annulla</button>
        </div>}
        </div>
      );
    });
  const renderDis = () => {
    const manual = entries("dis");
    const auto = data?.autoDis?.[day] || {};
    const ids = [...new Set([...Object.keys(manual), ...Object.keys(auto)])]
      .sort((a, b) => name(a).localeCompare(name(b), "it"));
    const weekday = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"][new Date(day + "T12:00").getDay()];
    const rows = hours.map(h => ({ h, teachers: ids.filter(id => manual[id]?.includes(h) || auto[id]?.[h] !== undefined).map(id => {
      const site = (manual[id]?.includes(h) && data?.state.disSites[day]?.[id]) || data?.dataset.lessons?.[`${id}|${weekday}|${h}`]?.site;
      const assignments = Object.entries(data?.state.asg[day] || {}).filter(([key, a]) => a.v === id && Number(key.split("|")[1]) === h);
      const help = [auto[id]?.[h] ? "Automatico: " + auto[id][h].join(", ") : "", assignments.length ? "Assegnato: " + assignments.map(([, a]) => a.c).join(", ") : ""].filter(Boolean).join(" · ");
      return { id, site: site === "centrale" || site === "succursale" ? site : "sconosciuto", assigned: assignments.length > 0, help };
    }) }));
    const sites = ["centrale", "succursale", ...(rows.some(row => row.teachers.some(t => t.site === "sconosciuto")) ? ["sconosciuto"] : [])];
    return <>
      <table className="dis-table" aria-label="A disposizione per ora e sede">
        <thead><tr><th scope="col">Ora</th>{sites.map(site => <th scope="col" key={site}>{site === "centrale" ? "Centrale" : site === "succursale" ? "Succursale" : "Sconosciuto"}</th>)}</tr></thead>
        <tbody>{rows.map(({ h, teachers }) => <tr key={h}><th scope="row">{h}</th>{sites.map(site => {
          const cell = teachers.filter(t => t.site === site);
          return <td key={site}>{cell.length ? cell.map((t, index) => <React.Fragment key={t.id}>
            {index > 0 && ", "}<span className="dis-person"><button type="button" className="dis-name" aria-label={`Modifica disposizione di ${name(t.id)}, ${h}ª ora`} aria-expanded={disTeacher === t.id}
              aria-description={t.help || undefined} onClick={() => { setDisTeacher(disTeacher === t.id ? undefined : t.id); setEditingKind(undefined); setEditingDis(undefined); setEditAttachment(undefined); }}>
              <span className={t.assigned ? "assigned-name" : undefined}>{name(t.id)}</span>
            </button><RecordInfo text={t.help} links={[{ label: "Apri allegato disposizione", id: data?.state.disAttachments?.[day]?.[t.id] }]} /></span>
          </React.Fragment>) : "—"}</td>;
        })}</tr>)}</tbody>
      </table>
      {ids.filter(id => id === disTeacher).map((id) => {
      const hs = manual[id] || [];
      const reasons = auto[id] || {};
      const hasManual = hs.length > 0;
      const why = Array.from(new Set(Object.values(reasons).flat())).join(", ");
      const toggled = (h: number) =>
        hs.includes(h) ? hs.filter((x) => x !== h) : [...hs, h];
      return (
        <div className="entry-row" key={"dis" + id}><div className="rw">
          <button
            className="n"
            title={name(id)}
            disabled={!hasManual}
            onClick={() =>
              void mutate("entries", {
                day,
                group: "dis",
                id,
                hours: hs.length === 7 ? [] : hours,
                site: data?.state.disSites[day]?.[id],
              })
            }
          >
            {Object.keys(reasons).length > 0 && (
              <i className="auto-dot" />
            )}
            {name(id)}
          </button>
          <RecordInfo text={why} links={[{ label: "Apri allegato disposizione", id: data?.state.disAttachments?.[day]?.[id] }]} />
          <div className="hrs">
            {hours.map((h) => {
              const locked = reasons[h] !== undefined;
              const assignments = Object.entries(data?.state.asg[day] || {}).filter(([key, a]) => a.v === id && Number(key.split("|")[1]) === h);
              const assigned = assignments.length > 0 && (locked || hs.includes(h));
              const help = [locked ? "Automatico: " + reasons[h].join(", ") : "", assigned ? "Assegnato: " + assignments.map(([, a]) => a.c).join(", ") : ""].filter(Boolean).join(" · ");
              const btn = (
                <button
                  aria-label={`${name(id)}, ${h}ª ora`}
                  aria-description={assigned ? help : undefined}
                  aria-pressed={hs.includes(h)}
                  className={
                    (hs.includes(h) ? "on " : "") + (locked ? "auto " : "") + (assigned ? "assigned" : "")
                  }
                  disabled={locked}
                  onClick={() =>
                    void mutate("entries", {
                      day,
                      group: "dis",
                      id,
                      hours: toggled(h),
                      site: data?.state.disSites[day]?.[id],
                    })
                  }
                >
                  {h}
                </button>
              );
              return help
                ? <HourHelp key={h} text={help}>{btn}</HourHelp>
                : <React.Fragment key={h}>{btn}</React.Fragment>;
            })}
          </div>
          {hasManual && (
            <select
              data-dis-site={id}
              aria-label={"Sede di " + name(id)}
              value={data?.state.disSites[day]?.[id] || ""}
              onChange={(e) =>
                void mutate("entries", {
                  day,
                  group: "dis",
                  id,
                  hours: hs,
                  site: e.target.value,
                })
              }
            >
              <option value="">?</option>
              <option value="centrale">C</option>
              <option value="succursale">S</option>
            </select>
          )}
          {Object.hasOwn(manual, id) && <button className="edit-kind" aria-label={"Modifica allegato disposizione di " + name(id)} aria-expanded={editingDis === id} onClick={() => { setEditingKind(undefined); setEditAttachment(undefined); setEditingDis(editingDis === id ? undefined : id); }}>⋯</button>}
          {hasManual && (
            <button
              className="x"
              aria-label={"Rimuovi " + name(id)}
              onClick={() => void mutate("entries", { day, group: "dis", id })}
            >
              ×
            </button>
          )}
        </div>
        {editingDis === id && Object.hasOwn(manual, id) && <div className="absence-editor">
          <AttachmentField key={`dis|${day}|${id}`} value={editAttachment} saved={data?.state.disAttachments?.[day]?.[id]} onChange={setEditAttachment} disabled={busy} />
          <button className="ui-button" disabled={busy} onClick={async () => { if (await mutate("entries", { day, group: "dis", id, hours: hs, site: data?.state.disSites[day]?.[id], attachment: editAttachment })) { setEditAttachment(undefined); setEditingDis(undefined); } }}>Salva allegato</button>
          <button className="ui-button" onClick={() => { setEditingDis(undefined); setEditAttachment(undefined); }}>Annulla</button>
        </div>}</div>
      );
    })}
    </>;
  };
  const offset = (month.getDay() + 6) % 7,
    n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rs =
      data?.rows.filter((r) => filter === "all" || r.sede === filter) || [],
    assigned = data?.state.asg[day] || {};
  const nextDay = schoolDate(new Date(day + "T12:00"), 1);
  const pendingReminders = Object.entries(assigned)
    .filter(([key, a]) => !a.communicated && entryExitBoundary(key, assigned))
    .map(([key, a]) => `${a.c} ${(entryExitLabel(a.v, Number(key.split("|")[1])) || name(a.v)).toLowerCase()}`);
  const reminders = Object.entries(data?.state.asg[nextDay] || {})
    .map(([key, a]) => a.v === "ENTRA" || a.v === "ESCE" ? `${a.c} ${(entryExitLabel(a.v, Number(key.split("|")[1])) || name(a.v)).toLowerCase()}` : "")
    .filter(Boolean);
  return (
    <>
      <div className="app ui-scope supplenze" aria-busy={busy} inert={busy || !!open || entryOpen}>
        <aside>
          <div>
            <div className="cal-h">
              <button
                aria-label="Mese precedente"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                ‹
              </button>
              <b>
                {month.toLocaleDateString("it-IT", {
                  month: "long",
                  year: "numeric",
                })}
              </b>
              <button
                aria-label="Mese successivo"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                ›
              </button>
            </div>
            <div className="g">
              {["L", "M", "M", "G", "V", "S", "D"].map((w, i) => (
                <div className="w" key={i}>
                  {w}
                </div>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={"blank" + i} />
              ))}
              {Array.from({ length: n }, (_, i) => {
                const d = localDate(
                  new Date(month.getFullYear(), month.getMonth(), i + 1),
                );
                return (
                  <button
                    key={d}
                    disabled={(offset + i) % 7 > 4}
                    className={"d" + (d === day ? " sel" : "")}
                    onClick={() => setDay(d)}
                  >
                    {i + 1}
                    {Object.keys({ ...data?.state.abs[d], ...data?.state.permessi?.[d] }).length +
                      Object.keys(data?.state.cf[d] || {}).length >
                      0 && <i />}
                  </button>
                );
              })}
            </div>
          </div>
          <button ref={entryTrigger} className="ui-button entry-trigger" onClick={() => { ++candidateRequest.current; setLoadingCandidates(false); setOpen(undefined); clearEntry(); setEntryOpen(true); }}>+ Aggiungi</button>
          <div className="lists">
            {([["planned", "Assenze programmate"], ["trip", "In gita"], ["strike", "In sciopero"], [null, "Assenze non classificate"], ["last_minute", "Assenze last minute"]] as const).map(([value, label]) => {
              const ids = absentIds.filter(id => absenceKind(id) === value);
              return ids.length > 0 && <section key={label}><h2>{label}</h2>{renderEntries("abs", ids)}</section>;
            })}
            {Object.keys(entries("cf")).length > 0 && <section><h2>Classi assenti</h2>{renderEntries("cf")}</section>}
            <h2>A disposizione</h2>
            {renderDis()}
          </div>
        </aside>
        <main>
          {!entryOpen && <>
          {error && (
            <p className="ui-notice ui-notice-error" role="alert">
              {error}
            </p>
          )}
          {conflict && conflictSummary && <p className="ui-notice" role="status">{conflictSummary}</p>}
          {conflict && <button className="ui-button" onClick={async () => { try { await refresh(); setEditingKind(undefined); setEditingDis(undefined); setDisTeacher(undefined); setEditAttachment(undefined); setQuery(""); setChosen(undefined); setEntryNote(""); setEntryAttachment(undefined); setConflict(false); setError(""); } catch (e) { setError(String(e)); } }}>Ricarica valori salvati</button>}
          </>}
          {!!pendingReminders.length && (
            <p className="reminder" role="status">
              {day === localDate(new Date()) ? "Oggi" : italianDate(day)}: {pendingReminders.join(", ")}. Da comunicare alle classi.
            </p>
          )}
          {!!reminders.length && (
            <p className="reminder" role="status">
              <svg className="warning-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
              Prossimo giorno di scuola ({nextDay.split("-").reverse().join("/")}): {reminders.join(", ")}. Avvisa le classi.
            </p>
          )}
          <h1>
            {new Date(day + "T12:00").toLocaleDateString("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h1>
          <p className="sub">
            {rs.length} ore da coprire, {rs.filter((r) => assigned[r.k]).length}{" "}
            assegnate
          </p>
          {data?.timetable && <p className="sub">Orario: {data.timetable.effective ? `dal ${italianDate(data.timetable.effective)}` : 'versione iniziale'}</p>}
          {data?.references?.map((r, n) => <p role="alert" key={`reference-${n}`}>{r.id}: {r.message}</p>)}
          {data?.issues.map((i) => (
            <p role="alert" key={i.key}>
              Assegnazione da verificare: {i.context ? `${i.context.teacherName}, ${i.context.h}ª, ${i.context.c}, ${i.context.site || 'sede ignota'} → ${i.context.substituteName}` : i.key}: {i.message}{" "}
              <label>Sposta su una riga attuale <select aria-label="Riga per risolvere il conflitto" disabled={!canAssign(i.context?.site)} defaultValue="" onChange={e => {
                const key = e.target.value;
                if (key && window.confirm('Spostare questa assegnazione sulla riga selezionata? Sarà verificata prima del salvataggio.')) void mutate('assignments', {day, key, value: assigned[i.key]?.v, replace_key: i.key});
                e.target.value = '';
              }}><option value="">Seleziona…</option>{data?.rows.filter(r => r.k !== i.key && !assigned[r.k] && canAssign(r.sede)).map(r => <option key={r.k} value={r.k}>{r.h}ª · {r.c}</option>)}</select></label>{" "}
              <button
                className="lk"
                disabled={!canAssign(i.context?.site)} title={!canAssign(i.context?.site) ? "Modifica riservata alla sede della riga" : undefined}
                onClick={() => void mutate("assignments", { day, key: i.key })}
              >
                Rimuovi
              </button>
            </p>
          ))}
          <div className="site-filter">
            {[
              ["all", "Entrambe"],
              ["centrale", "Centrale"],
              ["succursale", "Succursale"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                {[
                  "Docente assente",
                  "Classe",
                  "Aula / sede",
                  "Supplente",
                  "Firma",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <React.Fragment key={h}>
                  <tr className="h">
                    <th colSpan={5}>{h}ª ora</th>
                  </tr>
                  {!rs.some((r) => r.h === h) && (
                    <tr>
                      <td colSpan={5} className="none">
                        Nessuna supplenza da coprire
                        {" "}<button className="lk" disabled={busy || loadingCandidates} onClick={e => void consult(h, e.currentTarget)} aria-label={`Consulta disponibilità ${h}ª ora`}>Consulta disponibilità</button>
                      </td>
                    </tr>
                  )}
                  {rs
                    .filter((r) => r.h === h)
                    .map((r) => (
                      <tr key={r.k}>
                        <td>{r.ids.map(name).join(" / ")}</td>
                        <td className="c">{r.c}</td>
                        <td className="room-cell">
                          <b>{r.aula}</b>
                          <br />
                          <span className={"site-chip " + r.sede}>
                            {r.sede || "Sede non indicata"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={"fill " + (!assigned[r.k] ? "ph" : assigned[r.k].v === "UNCOVERED" ? "uncovered" : "")}
                            onClick={() => void choose(r)}
                          >
                            {assigned[r.k]
                              ? entryExitCellLabel(r.k, assigned) || name(assigned[r.k].v)
                              : "Scegli il supplente"}
                            <small>{assigned[r.k]?.v === "UNCOVERED" ? "Nessun supplente trovato" : (assigned[r.k]?.t === "SPECIAL" ? "" : (assigned[r.k]?.t === "CP" ? "Compresenza - POT" : assigned[r.k]?.t === "CA" ? "Compresenza - ALF" : assigned[r.k]?.t))}</small>
                          </button>
                          {assigned[r.k]?.t === "RP" && <RecoveryActions key={`${day}|${r.k}|${assigned[r.k].v}|${assigned[r.k].permitId}`} day={day} row={r}
                            assignment={assigned[r.k]} permit={data?.recoveryRequests?.[r.k]} busy={busy} canAssign={canAssign(r.sede)}
                            onAccept={() => void mutate("assignments", { day, key: r.k, accepted: !assigned[r.k].accepted })} />}
                          {entryExitBoundary(r.k, assigned) && <span className="opt communicated">
                            <button type="button" className={assigned[r.k].communicated ? "on" : ""}
                              aria-pressed={assigned[r.k].communicated === true} disabled={busy || !canAssign(r.sede)}
                              title={!canAssign(r.sede) ? `Assegnazione riservata alla sede ${r.sede || "non indicata"}` : undefined}
                              aria-label={`Comunicato ${r.c}: ${entryExitCellLabel(r.k, assigned)}`}
                              onClick={() => void mutate("assignments", { day, key: r.k, communicated: !assigned[r.k].communicated })}>
                              {assigned[r.k].communicated && <span aria-hidden="true">✓ </span>}Comunicato
                            </button>
                          </span>}
                          {assigned[r.k] && (
                            <button
                              className="clr"
                              aria-label="Svuota"
                              disabled={!canAssign(r.sede)} title={!canAssign(r.sede) ? `Assegnazione riservata alla sede ${r.sede || "non indicata"}` : undefined}
                              onClick={() =>
                                void mutate("assignments", { day, key: r.k })
                              }
                            >
                              ×
                            </button>
                          )}
                        </td>
                        <td className="f">
                          <span />
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <p className="note">
            Ore libere utilizzabili come RP solo con permessi da recuperare entro scadenza.
            A disposizione ha priorità su POT anche da altra sede.
            Priorità: compresenze nella classe; ingresso/uscita; disponibilità e DI.S;
            POT e altri tipi disponibili nella stessa sede; dirigente e UTC/UTS nella stessa sede;
            tipi disponibili in altra sede; sede da verificare; recuperi permesso (prima le ore favorevoli);
            impegni presso questa scuola utilizzabili solo in caso di necessità; scoperta.
            A parità di priorità: insegna nella classe o la stessa CDC, meno ore oggi, meno ore totali.
            Le opzioni manuali e gli spostamenti richiedono verifica.
          </p>
          <SubstitutionExport key={`${day}-${filter}`} initialChoice={filter === "centrale" || filter === "succursale" ? filter : "both"} data={data} day={day} disabled={busy || loadedDay !== day} specialLabel={key => entryExitCellLabel(key, data?.state.asg[day] || {})} />
        </main>
      </div>
      {entryOpen && <div className="entry-backdrop" onClick={e => { if (e.target === e.currentTarget) closeEntry(); }}>
        <div ref={entryDialog} className="entry-dialog supplenze ui-page ui-surface" role="dialog" aria-modal="true" aria-labelledby="entry-title" aria-busy={busy}>
          <div className="entry-heading"><div><h2 id="entry-title">Aggiungi assenti o a disposizione</h2><p>{italianDate(day)}</p></div>
            <button className="ui-button" aria-label="Chiudi inserimento" onClick={closeEntry}>×</button>
          </div>
          {error && (
            <p className="ui-notice ui-notice-error" role="alert">
              {error}
            </p>
          )}
          {conflict && conflictSummary && <p className="ui-notice" role="status">{conflictSummary}</p>}
          {conflict && <button className="ui-button" onClick={async () => { try { await refresh(); setEditingKind(undefined); setEditingDis(undefined); setDisTeacher(undefined); setEditAttachment(undefined); setQuery(""); setChosen(undefined); setEntryNote(""); setEntryAttachment(undefined); setConflict(false); setError(""); } catch (e) { setError(String(e)); } }}>Ricarica valori salvati</button>}
          <form className="entry-form ui-form" onSubmit={e => { e.preventDefault(); void add(); }}>
            <label htmlFor="q">Cerca docente o classe</label>
            <div className="entry-search">
            <div className="sw">
              <input
                id="q"
                aria-label="Cerca docente o classe"
                placeholder={
                  kind === "abs"
                    ? "Docente o classe, es. ros, 3a"
                    : "Docente a disposizione"
                }
                value={query}
                onChange={(e) => {
                  setEntrySuccess("");
                  if (chosen) setEntryNote("");
                  setQuery(e.target.value);
                  setChosen(undefined);
                  setSelected(0);
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent?.isComposing) { if (e.key === "Enter") e.preventDefault(); return; }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelected(
                      (selected + 1) % Math.max(1, suggestions.length),
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelected(
                      (selected + suggestions.length - 1) %
                        Math.max(1, suggestions.length),
                    );
                  }
                  if (e.key === "Enter") { e.preventDefault(); void add(); }
                }}
              />
              {!!suggestions.length && (
                <div className="sug">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.group + s.id}
                      className={selected === i ? "on" : ""}
                      type="button"
                      onClick={() => { if (chosen && chosen.id !== s.id) setEntryNote(""); setChosen(s); setQuery(s.label); }}
                    >
                      {s.label}
                      <small>
                        {s.group === "cf" ? "classe assente" : "docente"}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="ui-button ui-button-primary entry-submit" type="submit" disabled={busy || conflict || duplicate || !target || (!wholeDay && !entryHours.length)}>{busy ? "…" : "Aggiungi"}</button>
            </div>
            {duplicate && <p className="ui-notice" role="status">{target?.label}: già registrato per questa data.</p>}
            {entrySuccess && <p className="ui-notice" role="status">{entrySuccess}</p>}
            <div className="opt">
              <button type="button"
                className={wholeDay ? "on" : ""}
                aria-pressed={wholeDay}
                onClick={() => setWholeDay(!wholeDay)}
              >
                Tutto il giorno
              </button>
              <button type="button"
                className={kind === "dis" ? "on" : ""}
                aria-pressed={kind === "dis"}
                onClick={() => { setKind(kind === "abs" ? "dis" : "abs"); setChosen(undefined); setSelected(0); }}
              >
                A disposizione
              </button>
            </div>
            {!wholeDay && <div className="hrs entry-hours" role="group" aria-label="Ore da aggiungere">{hours.map(h => <button key={h} type="button" aria-label={`Aggiungi ${h}ª ora`} aria-pressed={entryHours.includes(h)} className={entryHours.includes(h) ? "on" : ""} onClick={() => setEntryHours(entryHours.includes(h) ? entryHours.filter(v => v !== h) : [...entryHours, h])}>{h}</button>)}</div>}
            {kind === "abs" && target?.group !== "cf" && <>
              <ClassificationChoices value={classification} onChange={setClassification} />
              <label className="entry-note">Note (facoltative)<textarea aria-label="Note nuova assenza" value={entryNote} disabled={busy} onChange={e => setEntryNote(e.target.value)} /></label>
            </>}
            {target?.group !== "cf" && <AttachmentField key={`${day}|${kind}|${target?.id}`} value={entryAttachment} onChange={setEntryAttachment} disabled={busy} />}
            {kind === "dis" && (
              <label className="dis-location">
                Sede della disposizione
                <select value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value="centrale">Centrale</option>
                  <option value="succursale">Succursale</option>
                </select>
              </label>
            )}
          </form>
        </div>
      </div>}
      {loadingCandidates && <p role="status">Caricamento disponibilità…</p>}
      {consultation && <CandidateDrawer open={consultation} cands={cands} busy={busy} name={name} readOnlyReason="Solo consultazione" returnFocus={consultationTrigger.current} onAssign={() => {}} onClose={() => { ++candidateRequest.current; setConsultation(undefined); setLoadingCandidates(false); }} />}
      {open && (
        <CandidateDrawer
          open={open}
          cands={cands.map(c => ({ ...c, name: entryExitLabel(c.id, open.h) || c.name }))}
          current={assigned[open.k]?.v}
          busy={busy}
          readOnlyReason={!canAssign(open.sede) ? `Assegnazione riservata alla sede ${open.sede || "non indicata"}` : undefined}
          name={name}
          onClose={() => {
            ++candidateRequest.current;
            setLoadingCandidates(false);
            setOpen(undefined);
          }}
          onAssign={async (value, exceptional) => {
            if (!canAssign(open.sede)) return;
            const selectedRow = open;
            invalidate();
            ++candidateRequest.current; setLoadingCandidates(false); setOpen(undefined);
            setBusy(true); setError("");
            try {
              await api("assignments", { day, key: selectedRow.k, value, exceptional, expected: preconditions(candidateBaseline.current, "assignments", { day, key: selectedRow.k }) });
              ++candidateRequest.current; setLoadingCandidates(false); setOpen(undefined); await refresh();
            } catch (e) {
              setError(String(e));
              try {
                const latest = await refresh();
                candidateBaseline.current = latest?.concurrency;
                setCands(await api<Candidate[]>("candidates?" + new URLSearchParams({ day, key: selectedRow.k }))); setOpen(selectedRow); }
              catch { setOpen(undefined); }
            } finally { setBusy(false); }
          }}
        />
      )}
    </>
  );
}

function BackupSection({ onSummary, revision, onRestored }: { onSummary: (value: string) => void; revision: number; onRestored: () => void }) {
  const backupGeneration = useRef<number | undefined>(undefined);
  const [backups, setBackups] = useState<{ filename: string; created_at: string; size: number }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const loadBackups = async () => {
    try { const values = await api<typeof backups & {generation:number}>('backups'); backupGeneration.current = values.generation; setBackups(values); setError(''); setLoaded(true); }
    catch (e) { setError(String(e)); }
  };
  useQuietRefresh(() => api<typeof backups & {generation:number}>('backups'), values => { backupGeneration.current = values.generation; setBackups(values); setLoaded(true); }, loading, 'settings-backups');
  useEffect(() => { void loadBackups(); }, [revision]);
  useEffect(() => {
    onSummary(error ? 'Backup non disponibili' : !loaded ? 'Caricamento…' : backups.length ? `${backups.length} backup · ultimo ${new Date(backups[0].created_at).toLocaleDateString('it-IT')}` : 'Nessun backup');
  }, [backups, error, loaded, onSummary]);
  const run = async (filename?: string) => {
    if (filename && !window.confirm(`Ripristinare il backup ${filename}? I dati attuali verranno sovrascritti. Questa operazione non è annullabile.`)) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      await api(filename ? 'backups/restore' : 'backups', filename ? { filename, confirm: true, _generation: backupGeneration.current } : {});
      setSuccess(filename ? 'Backup ripristinato con successo.' : 'Backup creato con successo.');
      await loadBackups();
      if (filename) onRestored();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };
  const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
  return <section className="settings-subsection" aria-label="Backup del database">
    <h2>Backup del database</h2>
    <p className="settings-muted">Copie complete del database. Il ripristino sostituisce i dati attuali.</p>
    <div className="ui-actions"><button className="ui-button ui-button-primary" onClick={() => void run()} disabled={loading}>Crea backup manuale</button></div>
    {loading && <p className="ui-notice" role="status">Operazione in corso…</p>}
    {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
    {success && <p className="ui-notice" role="status">{success}</p>}
    {!loaded && !error ? <p className="settings-muted">Caricamento…</p> : !backups.length ? <p className="settings-muted">Nessun backup disponibile</p> : <ul className="settings-list">
      {backups.map(backup => <li key={backup.filename}>
        <div><strong>{backup.filename}</strong><small className="settings-muted">{new Date(backup.created_at).toLocaleString('it-IT')} · {formatSize(backup.size)}</small></div>
        <button className="ui-button ui-button-danger" disabled={loading} onClick={() => void run(backup.filename)}>Ripristina</button>
      </li>)}
    </ul>}
  </section>;
}
createRoot(document.getElementById("root")!).render(<App />);
