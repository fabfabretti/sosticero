import { useQuietRefresh } from './useQuietRefresh';
import { sessionFetch } from './session';
import { ClassificationChoices } from "./ClassificationChoices";
import { AttachmentField, type ImageDraft } from "./Attachments";
import type { AbsenceKind } from "./types";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

type Api = <T>(url: string, body?: unknown) => Promise<T>;
export type InboxStatus = { generation?: number; version?: string; pending: number; received?: number; configured: boolean; email?: string; spreadsheet?: string; worksheet?: string; lastSuccess?: string; error?: string };
type Item = { generation?: number; acceptedBy?: {id:string;username:string;name:string} | null; id: string; raw: string[]; status: string; processed?: string; submitted?: string; name?: string; case?: string; start?: string; end?: string; days?: string[]; hours?: number[]; teacher?: string; nameMatched?: boolean; teacherName?: string; teachers?: { id: string; name: string }[]; overlaps?: { day: string; hours: number[] }[]; error: string };
const date = (value?: string) => value ? value.split("-").reverse().join("/") : "—";
const timestamp = (value?: string) => value ? new Date(value).toLocaleString("it-IT") : "Mai";

export function useInboxStatus(api: Api, notify = false) {
  const [status, setStatus] = useState<InboxStatus>({ pending: 0, configured: false });
  useEffect(() => {
    let live = true, running = false, queued = false, revision = 0;
    let received: number | undefined;
    let audio: AudioContext | undefined;
    const unlock = () => {
      try { audio ??= new AudioContext(); if (audio.state === "suspended") void audio.resume().catch(() => {}); }
      catch { /* Notifications still work when browser audio is unavailable. */ }
    };
    const chime = () => {
      if (audio?.state !== "running") return;
      const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime;
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(.06, time + .015);
      gain.gain.linearRampToValueAtTime(0, time + .25);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(time); oscillator.stop(time + .25);
    };
    const refresh = async () => {
      if (document.documentElement?.dataset.auth === 'locked') return;
      if (running) { queued = true; return; }
      running = true;
      const n = ++revision;
      try {
        const next = await api<InboxStatus>("inbox/summary");
        if (live && n === revision) {
          const isNew = received !== undefined && next.received !== undefined && next.received > received;
          received = next.received;
          setStatus(next);
          if (notify && isNew) chime();
        }
      } catch { /* Keep the last known count while the local server is unavailable. */ }
      finally { running = false; if (live && queued) { queued = false; void refresh(); } }
    };
    const changed = (event: Event) => {
      const pending = (event as CustomEvent<{ pending?: number }>).detail?.pending;
      if (pending !== undefined) {
        ++revision;
        setStatus(previous => ({ ...previous, pending }));
      }
      void refresh();
    };
    if (notify) { window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock); }
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    window.addEventListener("inbox-changed", changed);
    return () => {
      live = false; clearInterval(timer); window.removeEventListener("inbox-changed", changed);
      if (notify) { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); }
      void audio?.close().catch(() => {});
    };
  }, [api, notify]);
  return status;
}

export function InboxNotice({ count }: { count: number }) {
  return <div className="inbox-notice" role="status" aria-atomic="true">{count > 0 && <><span>{count} comunicazioni da esaminare</span><Link to="/inbox">Apri Inbox →</Link></>}</div>;
}

export function SheetsSettings({ api, onSummary, revision }: { api: Api; onSummary?: (value: string) => void; revision?: number }) {
  const [status, setStatus] = useState<InboxStatus>();
  const liveStatus = useInboxStatus(api);
  const [spreadsheet, setSpreadsheet] = useState("1lgAmKTn4S5GfiOI6WPT4Onsesb4RsDiqhAGaDi6UBmA");
  const [worksheet, setWorksheet] = useState("Risposte del modulo 1");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { refresh, invalidate } = useQuietRefresh(
    () => api<InboxStatus>("inbox/connection"),
    value => { setStatus(value); setSpreadsheet(value.spreadsheet || ""); setWorksheet(value.worksheet || "Risposte del modulo 1"); },
    busy || !!file || (!!status && (spreadsheet !== (status.spreadsheet || "") || worksheet !== (status.worksheet || "Risposte del modulo 1"))),
    "inbox-connection",
  );
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, [api]);
  useEffect(() => { onSummary?.(error || liveStatus?.error ? 'Collegamento da verificare' : status ? `${status.configured ? 'Configurato' : 'Da configurare'} · ultima sincronizzazione: ${timestamp(liveStatus?.lastSuccess || status.lastSuccess)}` : 'Caricamento…'); }, [status, liveStatus, error, onSummary]);
  const run = async (test: boolean) => {
    invalidate(); setBusy(true); setError(""); setMessage("");
    try {
      if (test) {
        await api("inbox/test", { _generation: status?.generation });
        setMessage("Connessione riuscita. Il foglio è leggibile.");
      } else {
        let saved = status;
        if (file) {
          if (file.size > 32768) throw Error("File JSON troppo grande (massimo 32 KB).");
          // Credentials use a bounded raw upload, never a JSON body echoed by validation errors.
          const response = await sessionFetch("/api/inbox/credentials", { method: "POST", headers: { "Content-Type": "application/json", "X-Record-Version": status?.version || "" }, body: file }, status?.generation);
          const result = await response.json();
          if (!response.ok) throw Error(typeof result.detail === "string" ? result.detail : "Caricamento della chiave fallito.");
          saved = { ...result, generation: Number(response.headers.get("X-Data-Generation") || status?.generation || 0) };
          setStatus(saved);
          setFile(undefined); if (fileInput.current) fileInput.current.value = "";
        }
        setStatus(await api<InboxStatus>("inbox/connection", { spreadsheet, worksheet, expected: saved?.version, _generation: saved?.generation }));
        setMessage("Configurazione salvata. Tutte le risposte esistenti verranno caricate in Inbox.");
        window.dispatchEvent(new Event("inbox-changed"));
      }
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  return <section className="sheets-settings">
    <h2>Assenze da Google Forms</h2>
    <p className="sub">Controllo ogni 30 secondi. Le comunicazioni entrano in Inbox: il calendario cambia solo quando le accetti.</p>
    <form onSubmit={e => { e.preventDefault(); void run(false); }}>
      <label>URL o ID del foglio<input required value={spreadsheet} onChange={e => setSpreadsheet(e.target.value)} disabled={busy} /></label>
      <label>Nome della scheda<input required maxLength={100} value={worksheet} onChange={e => setWorksheet(e.target.value)} disabled={busy} /></label>
      <label>Chiave JSON account di servizio<input ref={fileInput} type="file" accept=".json,application/json" disabled={busy} onChange={e => setFile(e.target.files?.[0])} /></label>
      <p className="sub">{status?.email ? `Account installato: ${status.email}` : "Nessuna chiave installata."} Condividi il foglio con questo account come Visualizzatore.</p>
      <div className="inbox-actions"><button className="inbox-accept" disabled={busy} type="submit">{busy ? "Attendi…" : "Salva configurazione"}</button><button type="button" disabled={busy || !status?.configured} onClick={() => void run(true)}>Test connessione salvata</button></div>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <p className="sub">Ultima sincronizzazione: {timestamp(liveStatus?.lastSuccess || status?.lastSuccess)}{liveStatus?.error ? ` · ${liveStatus.error}` : ""}</p>
    <details><summary>Primo collegamento, righe di prova e backup</summary><p>Il primo collegamento carica tutte le risposte, anche passate. Ignora le righe di prova già caricate: eliminarle dal foglio non rimuove elementi da Inbox né assenze accettate. Correggi le assenze da Supplenze.</p><p>Usa il modulo per aggiungere risposte; non modificare le vecchie righe. La chiave resta sul server, esclusa da esportazioni e backup. Su un altro computer dovrai caricarla di nuovo. Ripristinare un backup può far tornare in Inbox comunicazioni successive al backup.</p></details>
  </section>;
}

export function AbsenceInbox({ api }: { api: Api }) {
  const [history, setHistory] = useState(false), [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, { classification?: AbsenceKind; note?: string; attachment?: ImageDraft }>>({});
  const status = useInboxStatus(api);
  const request = useRef(0);
  const overrides = useRef(new Map<string, Item>());
  const refresh = async () => {
    const n = ++request.current;
    try { const next = await api<Item[]>("inbox?history=" + history); if (n === request.current) { setItems(next.map(item => ({...item,generation:(next as Item[] & {generation?:number}).generation})).map(item => item.status === "pending" ? overrides.current.get(item.id) || item : item)); setError(""); if (!history) window.dispatchEvent(new CustomEvent("inbox-changed", { detail: { pending: next.length } })); } }
    catch (e) { if (n === request.current) setError(String(e)); }
    finally { if (n === request.current) setLoading(false); }
  };
  useEffect(() => {
    setItems([]); setLoading(true); void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => { ++request.current; clearInterval(timer); };
  }, [history]);
  const act = async (item: Item, action: string, teacher?: string) => {
    ++request.current; setBusy(item.id); setError("");
    try {
      const result = await api<Item & { alreadyProcessed?: boolean }>(`inbox/${item.id}/${action}`, { _generation: item.generation, teacher: teacher || item.teacher, ...(action === "accept" ? drafts[item.id] : {}) });
      if (action === "preview") { overrides.current.set(item.id, result); setItems(items.map(i => i.id === item.id ? result : i)); }
      else { overrides.current.delete(item.id); await refresh(); if (result.alreadyProcessed) setError(`Comunicazione già ${result.status === "accepted" ? "accettata" : "ignorata"}${result.acceptedBy ? ` da ${result.acceptedBy.name} (${result.acceptedBy.username})` : ""}. Le tue scelte non sono state applicate.`); if (history) window.dispatchEvent(new Event("inbox-changed")); }
    } catch (e) { await refresh(); setError(String(e)); }
    finally { setBusy(undefined); }
  };
  return <main className="inbox-page">
    <div className="inbox-heading"><div><h1>Inbox</h1><p className="sub">Comunicazioni di assenza da Google Forms</p></div><div className="inbox-actions"><button className={!history ? "on" : ""} aria-pressed={!history} onClick={() => setHistory(false)}>Da esaminare</button><button className={history ? "on" : ""} aria-pressed={history} onClick={() => setHistory(true)}>Cronologia</button></div></div>
    <p className="sub">Ultima sincronizzazione: {timestamp(status.lastSuccess)} · {!status.configured ? <Link to="/settings">Configura Google Sheets</Link> : "Controllo automatico ogni 30 secondi"}</p>
    {status.error && <p className="error" role="status">{status.error}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p role="status">Caricamento…</p> : !items.length ? <section className="inbox-empty"><h2>{history ? "Nessuna comunicazione elaborata" : "Nessuna comunicazione da esaminare"}</h2><p className="sub">Le nuove risposte compariranno qui automaticamente.</p></section> : items.map(item => <article className="inbox-item" key={item.id}>
      <div className="inbox-person"><span className="inbox-name">{item.teacherName || item.name || item.raw[2] || "Docente da verificare"}</span>
        {item.status === "pending" && !!item.teachers?.length && (item.nameMatched === undefined ? item.teachers.filter(t => t.name === (item.name || item.raw[2])).length !== 1 : !item.nameMatched) && <><span aria-hidden="true">→</span><select className="inbox-teacher" aria-label={`Docente associato: ${item.name || item.raw[2]}`} value={item.teacher || ""} disabled={!!busy} onChange={e => void act(item, "preview", e.target.value)}><option value="">Seleziona docente…</option>{item.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></>}
      </div>
      <div className="inbox-absence">
        <strong>Assenza {date(item.start)}{item.end !== item.start && ` – ${date(item.end)}`}</strong>
        {(item.case || item.raw[1] || "").includes("ALCUNE ORE") && item.hours && <><span aria-hidden="true">→</span><div className="hrs inbox-hours" role="img" aria-label={`Ore di assenza: ${item.hours.join(", ")}`}>{[1, 2, 3, 4, 5, 6, 7].map(h => <span key={h} className={item.hours!.includes(h) ? "on" : ""} aria-hidden="true">{h}</span>)}</div></>}
      </div>
      <time className="inbox-submitted" dateTime={item.submitted} title="Data e ora di invio del modulo">{item.raw[0] || timestamp(item.submitted)}</time>
      {item.status === "pending" && <details className="inbox-metadata">
        <summary>Tipo, note e allegato</summary>
        <fieldset disabled={!!busy}>
          <ClassificationChoices value={drafts[item.id]?.classification || null} onChange={classification => setDrafts(d => ({ ...d, [item.id]: { ...d[item.id], classification } }))} />
          <label>Note (facoltative)<textarea value={drafts[item.id]?.note || ""} onChange={e => setDrafts(d => ({ ...d, [item.id]: { ...d[item.id], note: e.target.value } }))} /></label>
          <AttachmentField value={drafts[item.id]?.attachment} onChange={attachment => setDrafts(d => ({ ...d, [item.id]: { ...d[item.id], attachment } }))} disabled={!!busy} />
          <p className="sub">Applicati a tutti i giorni della comunicazione. Le note si aggiungono a quelle già presenti.</p>
        </fieldset>
      </details>}
      {item.status === "pending" ? <div className="inbox-actions"><button className="inbox-accept" disabled={!!busy || !!item.error} onClick={() => void act(item, "accept")}>{busy === item.id ? "Attendi…" : "Accetta"}</button><button disabled={!!busy} onClick={() => void act(item, "ignore")}>Ignora</button></div> : <span className="inbox-result">{item.status === "accepted" ? item.acceptedBy ? `Accettata da ${item.acceptedBy.name} (${item.acceptedBy.username})` : "Accettata · autore non disponibile" : "Ignorata"}</span>}
      <details className="inbox-details"><summary aria-label={`Dettagli comunicazione di ${item.name || item.raw[2] || "docente"}`}>⋯</summary>
        <p className="sub">Inviata: {item.raw[0] || timestamp(item.submitted)}{item.processed ? ` · Elaborata: ${timestamp(item.processed)}` : ""}</p>
        {item.days && <ul>{item.days.map(day => <li key={day}>{date(day)} · Ore {item.hours?.join(", ")}{item.overlaps?.find(o => o.day === day)?.hours.length ? ` · Già presenti: ${item.overlaps.find(o => o.day === day)!.hours.join(", ")}` : ""}</li>)}</ul>}
        {item.error && <dl>{item.raw.map((v, i) => <div key={i}><dt>{["Invio", "Caso", "Docente", "Data giornaliera", "Inizio", "Fine", "Data oraria", "Ore"][i] || "Campo"}</dt><dd>{v || "—"}</dd></div>)}</dl>}
      </details>
      {item.error && <p className="error">{item.error}</p>}
    </article>)}
  </main>;
}
