import { ClassificationChoices } from "./ClassificationChoices";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import type { Row, Candidate, Data, AbsenceKind, Assignment } from "./types";
import { TimetableImport } from "./TimetableImport";
import { HourTypes } from "./HourTypes";
import { CandidateDrawer } from "./CandidateDrawer";
import { AttachmentField, RecordInfo, type ImageDraft, type AttachmentMap } from "./Attachments";
import { Stats } from "./Stats";
import { TeacherTimetables } from "./TeacherTimetables";
import { AbsenceInbox, SheetsSettings, InboxNotice, useInboxStatus } from "./Inbox";
import { norm, teacherSearchText } from "./timetables";
import { HourHelp } from "./Tooltip";
import { SubstitutionExport } from "./SubstitutionExportPanel";
import { HashRouter, Link, useLocation } from "react-router";
const hours = [1, 2, 3, 4, 5, 6, 7];
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
const italianDate = (value: string) => value.split("-").reverse().join("/");
const parseItalianDate = (value: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "";
  const iso = value.split("/").reverse().join("-");
  const parsed = new Date(iso + "T12:00");
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === iso ? iso : "";
};
async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    "/api/" + url,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok)
    throw Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  return data;
}
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
  const [data, setData] = useState<{ timetableVersions?: { effective: string | null; dataset: Data["dataset"] }[]; dataset: Data["dataset"]; permitAttachments?: AttachmentMap; permessi: Record<string, Record<string, number[]>>; permitRequests?: Record<string, Record<string, string>>; permitNotes?: Record<string, Record<string, string>>; manualPermitNotes?: Record<string, string>; permitKinds?: Record<string, Record<string, AbsenceKind>>; recoveries?: Record<string, Record<string, import("./types").PermitRecovery>>; balances?: Record<string, { remaining: number; expired: number; eligible: number }>; manualPermits?: Record<string, { id: string; hours: number; recovered: number; remaining: number; recoveries: { date: string; h: number; key: string }[] }> }>();
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
  const refresh = async () => setData(await api("permessi"));
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, []);
  const permitDataset = (date: string) => data?.timetableVersions?.filter(v => !v.effective || v.effective <= date).at(-1)?.dataset || data?.dataset;
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
  const save = async (body: unknown, endpoint = "permessi") => {
    setBusy(true);
    setError("");
    try {
      await api(endpoint, body);
      await refresh();
      reset();
    } catch (e) {
      setError(String(e));
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
  return <div className="app permessi">
    <aside>
    <form className="permit-form" onSubmit={e => { e.preventDefault(); if (manual) { if (teacher && Number.isInteger(Number(manualHours)) && Number(manualHours) > 0) void save({ id: teacher, hours: Number(manualHours), note, editing: editingManual }, "manual-permits"); return; } if (invalidDates || !teacher || !selected.length) return; void save({ day, id: teacher, requested_on: requestedOn || null, note, attachment, classification: original ? editClassification : newClassification, hours: selected, ...(original ? { original_day: original.day, original_id: original.id } : {}) }); }}>
      <h2>{manual ? (editingManual ? "Modifica saldo manuale" : "Aggiungi saldo manuale") : original ? "Modifica permesso" : "Aggiungi permesso"}</h2>
      <label className="manual-permit-toggle"><input type="checkbox" checked={manual} disabled={busy} onChange={e => { reset(); setManual(e.target.checked); setError(""); }} />Saldo manuale senza data</label>
      <fieldset disabled={busy || !data}>
        <div className="permit-teacher">
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
        <div><span>Ore di permesso</span><div className="hrs permit-hours">{hours.map(h => <span className="permit-hour" key={h}>
          <button type="button" aria-label={`Permesso ${h}ª ora`} aria-pressed={selected.includes(h)} className={selected.includes(h) ? "on" : ""} onClick={() => setSelected(selected.includes(h) ? selected.filter(v => v !== h) : [...selected, h])}>{h}</button>
          {teacher && selected.includes(h) && (overLimit || !scheduled(teacher, day, h)) && warning([overLimit ? `Massimo giornaliero: ${maximum} ore di permesso; selezionate ${selected.length}.` : "", !scheduled(teacher, day, h) ? `${h}ª ora: nessuna attività prevista nell’orario per questa ora.` : ""].filter(Boolean).join(" "))}
        </span>)}</div></div>

        <p className="sub">Massimo giornaliero: {maximum} ore · Selezionate: {selected.length}. Sono comprese tutte le attività in orario, inclusi POT e DIS.</p>
        </>}
        <button className="permit-save" type="submit" disabled={!teacher || (manual ? !Number.isInteger(Number(manualHours)) || Number(manualHours) < 1 : invalidDates || !selected.length)}>{busy ? "Salvataggio…" : manual ? "Salva saldo manuale" : "Salva permesso"}</button>
        {(original || editingManual) && <button type="button" onClick={reset}>Annulla modifica</button>}
      </fieldset>
      <div className="permit-feedback" aria-live="polite">{!manual && invalidDates && <p role="alert">Inserisci date valide nel formato gg/mm/aaaa.</p>}{(error || (!manual && overLimit)) && <p role="alert">{error || `Superato il massimo giornaliero di ${maximum} ore di permesso.`}</p>}</div>
    </form>
    </aside>
    <main>
    <h1>Permessi</h1>
    <p className="sub">Per i permessi con data, recupero entro un mese dal permesso, scadenza inclusa. Le assegnazioni RP future riservano già le ore e sono elencate per data.</p>
    {!data && !error && <p role="status">Caricamento…</p>}
    <div className="permit-table"><table><thead><tr><th>Docente</th>{([ ["date", "Data permesso"], ["requested", "Data richiesta"] ] as const).map(([field, title]) => <th key={field} aria-sort={sort.field === field ? (sort.ascending ? "ascending" : "descending") : "none"}><button className="lk" onClick={() => setSort({ field, ascending: sort.field === field ? !sort.ascending : false })}>{title}{sort.field === field ? (sort.ascending ? " ↑" : " ↓") : " ↕"}</button></th>)}{["Ore di permesso", "Scadenza recupero", "Ore recuperate", "Dettaglio recuperi", "Ore da recuperare", "Azioni"].map(title => <th key={title}>{title}</th>)}</tr></thead>
      <tbody>{records.map(r => <tr key={r.date + r.id} className={(data?.balances?.[r.id]?.remaining ?? r.periods.length) > 0 ? "permit-outstanding" : undefined}>
        <td><span className="permit-name">{data?.dataset.teachers[r.id]?.name || r.id}</span><RecordInfo text={data?.permitNotes?.[r.date]?.[r.id]} links={[{ label: "Apri allegato permesso", id: data?.permitAttachments?.[r.date]?.[r.id] }]} /></td><td>{r.date.split("-").reverse().join("/")}</td>
        <td>{data?.permitRequests?.[r.date]?.[r.id]?.split("-").reverse().join("/") || "—"}</td>
        <td>{r.periods.map(h => <span className="permit-period" key={h}>{h}ª{(r.periods.length > dailyMaximum(r.id, r.date) || !scheduled(r.id, r.date, h)) && warning([r.periods.length > dailyMaximum(r.id, r.date) ? "Superato il massimo giornaliero di ore di permesso." : "", !scheduled(r.id, r.date, h) ? `${h}ª ora: nessuna attività prevista nell’orario per questa ora` : ""].filter(Boolean).join(" "))}</span>)}</td>
        <td>{r.recovery?.deadline.split("-").reverse().join("/") || "—"}</td>
        <td>{r.recovery?.recovered ?? 0}</td>
        <td>{r.recovery?.recoveries.length ? <ul className="recovery-details">{r.recovery.recoveries.map(item => <li key={item.date + item.key}>{item.date.split("-").reverse().join("/")} · {item.h}ª ora</li>)}</ul> : "—"}</td>
        <td><span className="permit-remaining">{r.recovery?.remaining ?? r.periods.length}</span>{r.recovery?.expired && <strong className="permit-expired">Scadute</strong>}</td>
        <td className="permit-actions"><button className="lk" aria-label={`Modifica permesso di ${data?.dataset.teachers[r.id]?.name || r.id}`} title="Modifica permesso" disabled={busy} onClick={() => { setAttachment(undefined); setManual(false); setEditingManual(false); setDayInput(italianDate(r.date)); setRequestedInput(italianDate(data?.permitRequests?.[r.date]?.[r.id] || "")); selectTeacher(r.id); setSelected(r.periods); setNote(data?.permitNotes?.[r.date]?.[r.id] || ""); setEditClassification(data?.permitKinds?.[r.date]?.[r.id] || null); setOriginal({ day: r.date, id: r.id }); setError(""); }}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
        <button className="x" aria-label={`Rimuovi permesso di ${data?.dataset.teachers[r.id]?.name || r.id}`} title="Rimuovi permesso" disabled={busy} onClick={() => { if (window.confirm(`Eliminare il permesso di ${data?.dataset.teachers[r.id]?.name || r.id} del ${italianDate(r.date)}?`)) void save({ day: r.date, id: r.id, hours: null }); }}>×</button></td>
      </tr>)}</tbody></table></div>
    {!!Object.keys(data?.manualPermits || {}).length && <section className="manual-permits">
      <h2>Saldi manuali</h2>
      <p className="sub">Ore pregresse senza data e senza scadenza automatica.</p>
      <div className="permit-table"><table><thead><tr>{["Docente", "Ore totali", "Ore recuperate", "Dettaglio recuperi", "Ore da recuperare", "Azioni"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
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
  const [data, setData] = useState<Data>(),
    [error, setError] = useState("");
  const request = useRef(0);
  const refresh = async () => {
    const n = ++request.current;
    try {
      const d = await api<Data>("day/" + localDate(new Date()));
      if (n === request.current) setData(d);
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const upload = async (file: File | undefined, target: string) => {
    if (!file) return;
    try {
      const content = JSON.parse(await file.text());
      if (target === 'import') {
        const preview = await api<{ overrides: { teacher: string; review: boolean }[] }>('import/preview', content);
        const review = preview.overrides.filter(r => r.review);
        if (!window.confirm(`Ripristinare l’archivio? ${review.length} modifiche manuali richiedono verifica${review.length ? ': ' + [...new Set(review.map(r => r.teacher))].join(', ') : ''}. Le modifiche incompatibili useranno le ore importate fino alla verifica.`)) return;
      }
      await api(target, content);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };
  const exportData = async () => {
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
      setError(String(e));
    }
  };
  return (
    <section className="settings">
      <h1>Settings</h1>
      {error && (
        <p role="alert" style={{ color: "#c34242" }}>
          {error}
        </p>
      )}
      <section className="dataset">
        <TimetableImport api={api} onImported={() => void refresh()} />
        <div className="db-status">
          {data
            ? `${Object.keys(data.dataset.teachers).length} docenti · ${data.dataset.classes.length} classi`
            : "Caricamento…"}
        </div>
        {!!data?.dataset.warnings.length && (
          <details className="db-status">
            <summary>{data.dataset.warnings.length} anomalie da verificare</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(data.dataset.warnings, null, 2)}
            </pre>
          </details>
        )}
        <div className="archive-actions">
          <button onClick={() => void exportData()}>Esporta supplenze</button>
          <label>
            Importa supplenze
            <input
              hidden
              type="file"
              accept=".json"
              onChange={(e) => void upload(e.target.files?.[0], "import")}
            />
          </label>
          <button
            onClick={() => {
              document.documentElement.dataset.theme =
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark";
            }}
          >
            Chiaro / scuro
          </button>
        </div>
        <div className="db-status">Dati salvati nel database SQLite.</div>
      </section>
      <HourTypes key={JSON.stringify(data?.dataset)} api={api} />
      <SheetsSettings api={api} />
      <BackupSection />
    </section>
  );
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
      <Shell />
    </HashRouter>
  );
}
function Supplenze() {
  const [day, setDay] = useState(localDate(new Date())),
    [month, setMonth] = useState(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
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
    [site, setSite] = useState("centrale"),
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
  const [entryAttachment, setEntryAttachment] = useState<ImageDraft>();
  const [editAttachment, setEditAttachment] = useState<ImageDraft>();
  const [editingDis, setEditingDis] = useState<string>();
  const adding = useRef(false);
  const focusAfterAdd = useRef(false);
  useEffect(() => {
    if (!busy && !chosen && focusAfterAdd.current) {
      document.getElementById("q")?.focus();
      focusAfterAdd.current = false;
    }
  }, [busy, chosen]);
  const [loadedDay, setLoadedDay] = useState("");
  const request = useRef(0);
  const candidateRequest = useRef(0);
  useEffect(() => {
    try { localStorage.setItem("supplenze-campus", filter); } catch { /* Browser storage may be unavailable. */ }
  }, [filter]);
  const refresh = async () => {
    const n = ++request.current;
    try {
      const d = await api<Data>("day/" + day);
      if (n === request.current) { setData(d); setLoadedDay(day); }
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    ++candidateRequest.current;
    setOpen(undefined);
    void refresh();
    setEditingKind(undefined);
    setEditingDis(undefined);
    setEditAttachment(undefined);
    setEntryAttachment(undefined);
    setAbsenceNote("");
    setEntryNote("");
  }, [day]);
  const mutate = async (url: string, body: unknown) => {
    ++candidateRequest.current;
    setOpen(undefined);
    setBusy(true);
    setError("");
    try {
      await api(url, body);
      await refresh();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const choose = async (r: Row) => {
    if (busy) return;
    const n = ++candidateRequest.current;
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
    }
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
                !entries(kind)[t.id] &&
                norm(teacherSearchText(t)).includes(norm(query)),
            )
            .map((t) => ({ id: t.id, label: t.name, group: kind })),
          ...(kind === "abs"
            ? data.dataset.classes
                .filter(
                  (c) => !entries("cf")[c] && norm(c).includes(norm(query)),
                )
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
  useEffect(() => { if (kind !== "abs" || target?.group === "cf") setEntryNote(""); }, [kind, target?.group]);
  useEffect(() => { setEntryAttachment(undefined); }, [day, kind, target?.id, target?.group]);
  const add = async () => {
    if (busy || adding.current || !target || (!wholeDay && !entryHours.length)) return;
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
          <button disabled={busy} onClick={async () => { if (await mutate("entries", { day, group: "abs", id, hours: hs, note: absenceNote, attachment: editAttachment })) { setEditAttachment(undefined); setEditingKind(undefined); } }}>Salva nota e allegato</button>
          <button onClick={() => { setEditingKind(undefined); setEditAttachment(undefined); }}>Annulla</button>
        </div>}
        </div>
      );
    });
  const renderDis = () => {
    const manual = entries("dis");
    const auto = data?.autoDis?.[day] || {};
    return [
      ...Object.keys(manual),
      ...Object.keys(auto),
    ]
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((id) => {
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
          <button disabled={busy} onClick={async () => { if (await mutate("entries", { day, group: "dis", id, hours: hs, site: data?.state.disSites[day]?.[id], attachment: editAttachment })) { setEditAttachment(undefined); setEditingDis(undefined); } }}>Salva allegato</button>
          <button onClick={() => { setEditingDis(undefined); setEditAttachment(undefined); }}>Annulla</button>
        </div>}</div>
      );
    });
  };
  const offset = (month.getDay() + 6) % 7,
    n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rs =
      data?.rows.filter((r) => filter === "all" || r.sede === filter) || [],
    assigned = data?.state.asg[day] || {};
  const nextDay = localDate(new Date(new Date(day + "T12:00").getTime() + 864e5));
  const reminders = Object.entries(data?.state.asg[nextDay] || {})
    .map(([key, a]) => a.v === "ENTRA" || a.v === "ESCE" ? `${a.c} ${(entryExitLabel(a.v, Number(key.split("|")[1])) || name(a.v)).toLowerCase()}` : "")
    .filter(Boolean);
  return (
    <>
      <div className="app" aria-busy={busy} inert={busy || !!open}>
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
          <form className="daily-entry" onSubmit={e => { e.preventDefault(); void add(); }}>
            <h2><label htmlFor="q">Aggiungi assenti o a disposizione</label></h2>
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
                  if (chosen) setEntryNote("");
                  setQuery(e.target.value);
                  setChosen(undefined);
                  setSelected(0);
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent?.isComposing) { if (e.key === "Enter") e.preventDefault(); return; }
                  if (e.key === "Escape") { setQuery(""); setChosen(undefined); }
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
            <button className="entry-submit" type="submit" disabled={busy || !target || (!wholeDay && !entryHours.length)}>{busy ? "…" : "Aggiungi"}</button>
            </div>
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
          {error && (
            <p role="alert" style={{ color: "#c34242" }}>
              {error}
            </p>
          )}
          {!!reminders.length && (
            <p className="reminder" role="status">
              <svg className="warning-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
              Domani ({nextDay.split("-").reverse().join("/")}): {reminders.join(", ")}. Avvisa le classi.
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
              <label>Sposta su una riga attuale <select aria-label="Riga per risolvere il conflitto" defaultValue="" onChange={e => {
                const key = e.target.value;
                if (key && window.confirm('Spostare questa assegnazione sulla riga selezionata? Sarà verificata prima del salvataggio.')) void mutate('assignments', {day, key, value: assigned[i.key]?.v, replace_key: i.key});
                e.target.value = '';
              }}><option value="">Seleziona…</option>{data?.rows.filter(r => r.k !== i.key && !assigned[r.k]).map(r => <option key={r.k} value={r.k}>{r.h}ª · {r.c}</option>)}</select></label>{" "}
              <button
                className="lk"
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
                          {entryExitBoundary(r.k, assigned) && <span className="opt communicated">
                            <button type="button" className={assigned[r.k].communicated ? "on" : ""}
                              aria-pressed={assigned[r.k].communicated === true} disabled={busy}
                              aria-label={`Comunicato ${r.c}: ${entryExitCellLabel(r.k, assigned)}`}
                              onClick={() => void mutate("assignments", { day, key: r.k, communicated: !assigned[r.k].communicated })}>
                              {assigned[r.k].communicated && <span aria-hidden="true">✓ </span>}Comunicato
                            </button>
                          </span>}
                          {assigned[r.k] && (
                            <button
                              className="clr"
                              aria-label="Svuota"
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
      {open && (
        <CandidateDrawer
          open={open}
          cands={cands.map(c => ({ ...c, name: entryExitLabel(c.id, open.h) || c.name }))}
          current={assigned[open.k]?.v}
          busy={busy}
          name={name}
          onClose={() => {
            ++candidateRequest.current;
            setOpen(undefined);
          }}
          onAssign={async (value, exceptional) => {
            const selectedRow = open;
            ++candidateRequest.current; setOpen(undefined);
            setBusy(true); setError("");
            try {
              await api("assignments", { day, key: selectedRow.k, value, exceptional });
              ++candidateRequest.current; setOpen(undefined); await refresh();
            } catch (e) {
              setError(String(e));
              try { setCands(await api<Candidate[]>("candidates?" + new URLSearchParams({ day, key: selectedRow.k }))); setOpen(selectedRow); }
              catch { setOpen(undefined); }
            } finally { setBusy(false); }
          }}
        />
      )}
    </>
  );
}

function BackupSection() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState<any | null>(null);

  const loadBackups = async () => {
    setError("");
    try {
      const res = await fetch("/api/backups");
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || "Errore caricamento backup");
      }
      setBackups(await res.json());
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const createBackup = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/backups", { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || "Errore creazione backup");
      }
      setSuccess("Backup creato con successo");
      await loadBackups();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (filename: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, confirm: true }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || "Errore ripristino backup");
      }
      setSuccess("Backup ripristinato con successo");
      setConfirming(null);
      await loadBackups();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    const mb = kb / 1024;
    return mb.toFixed(2) + " MB";
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("it-IT");
    } catch {
      return iso;
    }
  };

  return (
    <section className="backup-section" style={{ marginTop: "2rem" }}>
      <h2>Backup e ripristino</h2>
      {error && (
        <p role="alert" style={{ color: "#c34242" }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ color: "#4a9" }}>
          {success}
        </p>
      )}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => void createBackup()} disabled={loading}>
          Crea backup manuale
        </button>
      </div>
      <div>
        <h3>Backups disponibili</h3>
        {backups.length === 0 ? (
          <p>Nessun backup disponibile</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {backups.map((b) => (
              <li
                key={b.filename}
                style={{
                  border: "1px solid var(--border, #ddd)",
                  padding: "0.5rem 1rem",
                  marginBottom: "0.5rem",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold" }}>{b.filename}</div>
                  <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
                    {formatDate(b.created_at)} · {formatSize(b.size)}
                  </div>
                </div>
                <button
                  onClick={() => setConfirming(b)}
                  disabled={loading}
                  style={{ background: "#c34242", color: "#fff" }}
                >
                  Ripristina
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirming && (
        <div
          className="confirm-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="confirm-dialog"
            style={{
              background: "var(--bg, #fff)",
              padding: "2rem",
              borderRadius: "8px",
              maxWidth: "600px",
              margin: "1rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <h3 style={{ color: "#c34242" }}>Attenzione: ripristino backup</h3>
            <p>
              Ripristinare il backup <strong>{confirming.filename}</strong>?
            </p>
            <p>
              <strong>I dati attuali verranno sovrascritti.</strong> Questa
              operazione non è annullabile.
            </p>
            <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
              <button
                onClick={() => restoreBackup(confirming.filename)}
                disabled={loading}
                style={{ background: "#c34242", color: "#fff" }}
              >
                {loading ? "Ripristinando..." : "Conferma ripristino"}
              </button>
              <button onClick={() => setConfirming(null)} disabled={loading}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
