import { useQuietRefresh } from './useQuietRefresh';
import { LoadingRegion } from './Loading';
import { sessionFetch } from './session';
import { useEffect, useState, type ReactNode } from "react";
import { CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import { campuses, periods, metricNames, outcomes, weekdays, typeNames, absenceKindNames, formatNumber as fmt, reportCsv } from "./stats-report";
import { CompositionPie, DemandCalendar } from './StatsCharts';
import { StatsCalendar, presetRange, todayInRome } from "./StatsCalendar";
import { HeatCell } from "./HeatCell";
import { StatsAvailability, absenceExplanation } from "./StatsAvailability";
import { RecordInfo } from "./Attachments";
import type { Metric, StatReport } from "./stats-report";

const tabs = { trends: "Andamento", availability: "A disposizione", people: "Classi e docenti" };
type StatsTab = keyof typeof tabs;
const metricHelp: Record<Metric, string> = {
  demand: "Ore di classe che richiedono una sostituzione, anche se già assegnata. Ogni classe e ora conta una volta. Gli esiti registrati possono essere incompleti. Ore = periodi dell’orario.",
  teacherHours: absenceExplanation + " Ore = periodi dell’orario. Assenza e permesso sovrapposti contano una volta.",
  teachers: "Ogni docente assente conta una volta al giorno, anche se attivo in entrambe le sedi. Il totale nel periodo è espresso in giorni-docente, non in persone distinte.",
};
const averageHelp = " Media sui soli giorni con assenze registrate; giorni senza assenze registrate esclusi. Stesse date per tutte le sedi.";
const pieColors = Array.from({ length: 16 }, (_, i) => `var(--chart-${i + 1})`);
const metrics: Metric[] = ["demand", "teacherHours", "teachers"];
const heatMetrics: Metric[] = ["demand", "teachers"];
const strokes = ["var(--accent)", "var(--info)", "var(--warn)"];
const dashes = [undefined, "7 3", "2 3"];
type ChartPoint = { label: string; demand: number | null; teacherHours: number | null; teachers: number | null };

function Trend({ series, bars = false }: { series: ChartPoint[]; bars?: boolean }) {
  const Chart = bars ? BarChart : LineChart;
  return <div className="stats-chart">
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={series} margin={{ right: 16, left: 0, top: 12, bottom: 8 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="var(--mute)" tick={{ fontSize: 12 }} tickFormatter={v => /^\d{4}-/.test(v) ? `${v.slice(8)}/${v.slice(5, 7)}` : v} />
        <YAxis stroke="var(--mute)" tickFormatter={v => fmt(Number(v))} width={44} />
        <Tooltip cursor={{ fill: "var(--surface-3)", stroke: "var(--border)" }} formatter={value => fmt(Number(value))} contentStyle={{ background: "var(--pan)", color: "var(--ink)", borderColor: "var(--line)" }} />
        <Legend />
        {(bars ? ["demand" as Metric] : metrics).map((key, i) => bars
          ? <Bar key={key} dataKey={key} name={metricNames[key]} fill={strokes[i]} maxBarSize={24} isAnimationActive={false} />
          : <Line key={key} type="linear" dataKey={key} name={metricNames[key]} stroke={strokes[i]} strokeDasharray={dashes[i]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />)}
      </Chart>
    </ResponsiveContainer>
  </div>;
}

export function Values({ headings, rows, caption, preview = false }: { headings: string[]; rows: ReactNode[][]; caption: string; preview?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const limited = rows.length > 10;
  return <div><div className="stats-scroll" tabIndex={0} role="region" aria-label={caption}><table>
    <caption>{caption}</caption><thead><tr>{headings.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.slice(0, preview || !expanded ? 10 : undefined).map((row, i) => <tr key={i}>{row.map((v, j) => j === 0 ? <th scope="row" key={j}>{typeof v === "number" ? fmt(v) : v}</th> : <td key={j}>{typeof v === "number" || v === null ? fmt(v) : v}</td>)}</tr>)}</tbody>
  </table></div>{limited && <p className="stats-table-limit">{preview ? `${rows.length - 10} righe non mostrate` : <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Mostra meno" : `Mostra tutte (${rows.length})`}</button>}</p>}</div>;
}

export function Stats() {
  const today = todayInRome();
  const [campus, setCampus] = useState(() => {
    try {
      const saved = localStorage.getItem("stats-campus");
      return saved === "centrale" || saved === "succursale" ? saved : "total";
    } catch { return "total"; }
  });
  useEffect(() => {
    try { localStorage.setItem("stats-campus", campus); } catch { /* Browser storage may be unavailable. */ }
  }, [campus]);
  const [activeTab, setActiveTab] = useState<StatsTab>(() => {
    try {
      const saved = localStorage.getItem("stats-tab");
      return saved === "availability" || saved === "people" ? saved : "trends";
    } catch { return "trends"; }
  });
  useEffect(() => {
    try { localStorage.setItem("stats-tab", activeTab); } catch { /* Browser storage may be unavailable. */ }
  }, [activeTab]);
  const [period, setPeriod] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [first, setFirst] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [metric, setMetric] = useState<Metric>("demand");
  const [data, setData] = useState<StatReport>();

  const [preview, setPreview] = useState(false);
  const [reportTime, setReportTime] = useState(() => new Date());
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const range = period === "custom" ? { start, end } : presetRange(period, today, first);

  const query = new URLSearchParams({ campus, period, ...(period === "custom" ? { start, end } : {}) });
  const scope = JSON.stringify([today, query.toString()]);
  const invalidRange = period === "custom" && (!start || !end || start > end);
  const { refresh, enter, loading, ready, loadError } = useQuietRefresh(async () => {
    if (invalidRange) throw Error("Seleziona un intervallo di date valido.");
    const response = await sessionFetch("/api/stats?" + query);
    const body = await response.json();
    if (!response.ok) throw Error(typeof body.detail === "string" ? body.detail : "Impossibile caricare le statistiche.");
    return body as StatReport;
  }, body => { setData(body); if (period === 'all') setFirst(body.start); }, false, scope, !!invalidRange, 'stats/' + scope);
  useEffect(() => { void enter().catch(() => {}); }, [scope]);

  const selectPreset = (id: string) => {
    setSelectingEnd(false);
    if (id === "custom") { setStart(range.start); setEnd(range.end); }
    else setMonth(today.slice(0, 7) + "-01");
    setPeriod(id);
  };
  const selectDate = (date: string) => {
    if (!selectingEnd) {
      setStart(date); setEnd(date); setSelectingEnd(true);
    } else {
      setStart(date < start ? date : start); setEnd(date < start ? start : date); setSelectingEnd(false);
    }
    setPeriod("custom");
  };
  const download = () => {
    if (!data || !ready) return;
    const url = URL.createObjectURL(new Blob([reportCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `sosticero-stats-${data.campus}-${data.start}-${data.end}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const weekData = data?.weekdays.filter(w => w.weekday < 5 || w.days > 0).map(w => ({ ...w, name: weekdays[w.weekday] })) || [];
  const maxHeat = Math.max(1, ...data?.heatmap.map(c => c[metric] || 0) || []);

  return <div className={"app stats-layout" + (preview ? " stats-preview-layout" : "")}>
    <aside className="stats-controls">
      <section><h2>Sede</h2><div className="site-filter" role="group" aria-label="Sede">
        {Object.entries(campuses).map(([id, title]) => <button key={id} className={campus === id ? "active" : ""} aria-pressed={campus === id} onClick={() => setCampus(id)}>{title}</button>)}
      </div></section>
      <section><h2>Periodo</h2><div className="site-filter" role="group" aria-label="Periodo">
        {Object.entries(periods).map(([id, title]) => <button key={id} className={period === id ? "active" : ""} aria-pressed={period === id} onClick={() => selectPreset(id)}>{title}</button>)}
      </div>
        <StatsCalendar start={range.start} end={range.end} today={today} month={month} onMonth={setMonth} onSelect={selectDate} />
        <p className="stats-range" aria-live="polite">{range.start} — {range.end}</p>
        <p className="stats-calendar-help">{selectingEnd ? "Seleziona l’ultimo giorno, anche in un altro mese." : "Seleziona il primo e l’ultimo giorno per un periodo personalizzato."}</p>
      </section>
    </aside>
    <main className={"stats-page" + (preview ? " stats-print-preview" : "")}>
      {preview && <div className="stats-preview-actions"><strong>Anteprima report</strong><button disabled={!(ready && data?.days) && !availabilityReady} onClick={() => { if ((ready && data?.days) || availabilityReady) window.print(); }}>Stampa</button><button onClick={() => setPreview(false)}>Torna alle statistiche</button></div>}
      <header className="stats-report-header"><div className="stats-report-brand"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="14" r="3.3" /><circle cx="17" cy="14" r="3.3" /><path d="M10.3 13.5a2 2 0 0 1 3.4 0" /><path d="M3.7 12.6 5.2 9.2" /><path d="M20.3 12.6 18.8 9.2" /></g></svg><strong>Sosticero</strong></div><div className="stats-report-meta"><span>sviluppato da Agentic Fabs</span><time dateTime={reportTime.toISOString()}>Generato il {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(reportTime)}</time></div></header>
      <div className="stats-heading"><h1>Statistiche</h1><div className="stats-actions"><button onClick={download} disabled={!ready || !data?.days}>Esporta CSV</button><button onClick={() => { if ((ready && data?.days) || availabilityReady) { setReportTime(new Date()); setPreview(true); } }} disabled={!(ready && data?.days) && !availabilityReady}>Stampa report</button></div></div>

      <LoadingRegion pending={loading} blocked={!ready} error={loadError} retry={() => void refresh().catch(() => {})}>
      {data && <>
        {data.end > today && <p className="stats-warning" role="status">Il periodo include date future: i dati sono una stima e possono cambiare.</p>}
        <p className="stats-scope"><strong>{campuses[data.campus]}</strong> · {data.start} — {data.end} · {data.days} {data.days === 1 ? "giorno registrato" : "giorni registrati"}</p>
        {!data.days ? <section className="stats-panel"><h2>Nessun giorno con assenze registrate</h2><p>Seleziona un altro periodo.</p></section> : <>
          <div className="stats-cards" aria-label="Medie giornaliere">
            {metrics.map(k => <section className="stats-card" key={k}><h2>{metricNames[k]}<RecordInfo text={metricHelp[k] + averageHelp} label={"Informazioni: " + metricNames[k]} hover /></h2><div><strong>{fmt(data.averages[k])}</strong><span> / giorno</span></div><p>{fmt(data.totals[k])} {k === "teachers" ? "giorni-docente" : "ore"} nel periodo</p></section>)}
          </div>
          <div className="stats-outcomes" aria-label="Esito delle ore da coprire">{Object.entries(outcomes).map(([k, title]) => <div key={k} className={"outcome-" + k}><span>{title}</span><strong>{fmt(data.totals[k as keyof typeof outcomes])}</strong></div>)}</div>
        </>}
        {(data.issues > 0 || data.unknown.teacherHours > 0 || data.unknown.demand > 0) && <p className="stats-warning" role="status">
          {data.issues > 0 && <span>{fmt(data.issues)} assegnazioni da verificare, escluse dalle coperture valide. </span>}
          {(data.unknown.teacherHours > 0 || data.unknown.demand > 0) && <span>Tutte le sedi: {fmt(data.unknown.teacherHours)} ore di assenza e {fmt(data.unknown.demand)} ore da coprire senza sede, incluse solo nel Totale.</span>}
        </p>}
        <details className="stats-notes" open={preview}>
          <summary>Metodo e qualità dei dati{!!data.provenance.reconstructed && " · dati storici ricostruiti"}{data.issues > 0 && ` · ${data.issues} assegnazioni da verificare`}</summary>
          <p className="stats-method">Medie sui soli giorni con assenze registrate; giorni vuoti esclusi. Stesse date per tutte le sedi. Ore = periodi dell’orario. I docenti sono contati una volta al giorno; un docente attivo in entrambe le sedi conta una sola volta nel Totale.</p>
          {!!data.provenance.reconstructed && <p className="stats-method">{fmt(data.provenance.reconstructed)} ore di assenza ricostruite dall’orario disponibile al momento della migrazione: il contesto storico non è verificabile.</p>}
          {(data.unknown.teacherHours > 0 || data.unknown.demand > 0 || data.issues > 0) && <p className="stats-method">Tutte le sedi: {fmt(data.unknown.teacherHours)} ore di assenza e {fmt(data.unknown.demand)} ore da coprire senza sede (incluse solo nel Totale). {fmt(data.issues)} assegnazioni da verificare, escluse dalle coperture valide.</p>}
          <p className="stats-method">Assenze sovrapposte: priorità a Last minute, sciopero, assemblea, gita, programmata. Il grafico esclude le ore non classificate.</p>
          <p className="stats-method">Senza supplente = nessun supplente trovato, dichiarato esplicitamente. In attesa = nessun esito registrato. Entrata e uscita sono conteggiate separatamente.</p>
        </details>

      </>}
      </LoadingRegion>
      <div className="stats-tabs" role="tablist" aria-label="Viste statistiche" hidden={preview}>
        {(Object.entries(tabs) as [StatsTab, string][]).map(([id, label], index) => <button key={id} type="button" role="tab" id={"stats-tab-" + id} aria-controls={"stats-panel-" + id} aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1}
          onClick={() => setActiveTab(id)} onKeyDown={e => {
            const keys = Object.keys(tabs) as StatsTab[];
            const next = e.key === "ArrowRight" ? (index + 1) % keys.length : e.key === "ArrowLeft" ? (index + keys.length - 1) % keys.length : e.key === "Home" ? 0 : e.key === "End" ? keys.length - 1 : null;
            if (next !== null) { e.preventDefault(); setActiveTab(keys[next]); document.getElementById("stats-tab-" + keys[next])?.focus(); }
          }}>{label}</button>)}
      </div>
      <div role="tabpanel" id="stats-panel-trends" aria-labelledby="stats-tab-trends" hidden={!preview && activeTab !== "trends"} tabIndex={0} inert={!ready} className={!ready ? "ui-loading-content" : undefined}>
        {!!data?.days && <>
          <section className="stats-panel"><h2>Andamento giornaliero</h2><Trend series={data.daily.map(d => ({ ...d, label: d.date }))} />
            <details className="stats-values stats-daily-values" open={preview}><summary>Valori giornalieri e risultati</summary><Values preview={preview} caption="Valori giornalieri" headings={["Data", ...Object.values(metricNames), ...Object.values(outcomes)]} rows={data.daily.map(d => [d.date, d.demand, d.teacherHours, d.teachers, d.covered, d.uncovered, d.late, d.early, d.pending])} /></details>
          </section>
          <div className="stats-grid">{[
            { title: "Media per giorno della settimana", series: weekData.map(d => ({ label: d.name, teachers: d.teachers, teacherHours: d.teacherHours, demand: d.demand })), label: "Giorno" },
            { title: "Media per ora", series: data.hours.map(d => ({ label: `${d.hour}ª`, teachers: d.teachers, teacherHours: d.teacherHours, demand: d.demand })), label: "Ora" },
          ].map(chart => <section className="stats-panel" key={chart.label}><h2>{chart.title}</h2><Trend series={chart.series} bars />
            <details className="stats-values" open={preview}><summary>Valori delle medie</summary><Values preview={preview} caption={chart.title} headings={[chart.label, metricNames.demand]} rows={chart.series.map(d => [d.label, d.demand])} /></details>
          </section>)}</div>
          <section className="stats-panel"><div className="stats-panel-heading"><h2>Giorno × ora</h2><div className="site-filter" role="group" aria-label="Indicatore della mappa">{heatMetrics.map(k => <button key={k} className={metric === k ? "active" : ""} aria-pressed={metric === k} onClick={() => setMetric(k)}>{metricNames[k]}</button>)}</div></div>
            <p className="stats-method">Media per ciascuna occorrenza registrata del giorno. — = nessuna data registrata.</p>
            <div className="stats-scroll" tabIndex={0} role="region" aria-label="Mappa giorno per ora"><table className="stats-heatmap"><caption>{metricNames[metric]} · medie per giorno e ora</caption><thead><tr><th scope="col">Ora</th>{weekData.map(w => <th scope="col" key={w.weekday}>{w.name} ({w.days})</th>)}</tr></thead><tbody>{[1, 2, 3, 4, 5, 6, 7].map(h => <tr key={h}><th scope="row">{h}ª ora</th>{weekData.map(w => {
              const cell = data.heatmap.find(c => c.weekday === w.weekday && c.hour === h);
              return cell ? <HeatCell key={w.weekday} cell={cell} metric={metric} max={maxHeat} /> : <td key={w.weekday}>—</td>;
            })}</tr>)}</tbody></table></div>
          </section>
        </>}
        {!!data?.days && <>
          <div className="stats-grid stats-compositions">
            <section className="stats-panel"><h2>Come abbiamo coperto</h2>
              {data.totals.covered > 0 ? <><p className="stats-method">Percentuali sulle ore coperte.</p><CompositionPie slices={Object.entries(data.types).map(([t, hours], i) => ({ name: typeNames[t] || t, hours, color: pieColors[i % pieColors.length] }))} /></> : <p>Nessuna ora coperta nel periodo.</p>}
            </section>
            <section className="stats-panel"><h2>Tipi di assenza</h2>
              {data.totals.teacherHours > 0 ? <>
                {data.absenceTypes.some(d => d.kind !== "unclassified" && d.hours > 0) ? <><p className="stats-method">Percentuali sulle ore classificate.</p><CompositionPie slices={data.absenceTypes.filter(d => d.kind !== "unclassified").map(d => ({ name: absenceKindNames[d.kind] || d.kind, hours: d.hours, color: pieColors[data.absenceTypes.indexOf(d) % pieColors.length] }))} /></> : <p>Nessuna ora classificata.</p>}
                <details className="stats-values" open={preview}><summary>Tutti i tipi di assenza</summary><Values preview={preview} caption="Percentuali su tutte le ore dei docenti assenti" headings={["Tipo di assenza", "Ore", "%"]} rows={data.absenceTypes.map(d => [absenceKindNames[d.kind] || d.kind, d.hours, d.percentage])} /></details>
              </> : <p>Nessuna ora di assenza nella sede e nel periodo selezionati.</p>}
            </section>
          </div>
          <section className="stats-panel stats-demand"><h2>Giorni con maggiore domanda</h2><div className="stats-grid"><Values preview={preview} caption="Dieci giorni con più ore da coprire" headings={["Data", metricNames.demand, outcomes.uncovered, "Entrata / uscita"]} rows={data.worst.map(d => [d.date, d.demand, d.uncovered, d.late + d.early])} /><DemandCalendar start={data.start} end={data.end} daily={data.daily} /></div></section>
        </>}
      </div>
      <div role="tabpanel" id="stats-panel-availability" aria-labelledby="stats-tab-availability" hidden={!preview && activeTab !== "availability"} tabIndex={0}>
        <StatsAvailability campus={campus} preview={preview} onReady={setAvailabilityReady} />
      </div>
      <div role="tabpanel" id="stats-panel-people" aria-labelledby="stats-tab-people" hidden={!preview && activeTab !== "people"} tabIndex={0} inert={!ready} className={!ready ? "ui-loading-content" : undefined}>
        {!!data?.days && <div className="stats-grid">
          <section className="stats-panel"><h2>Classi interessate</h2><Values preview={preview} caption={preview && data.classes.length > 10 ? "Prime 10 classi per ore da coprire" : "Domanda per classe"} headings={["Classe", metricNames.demand]} rows={data.classes.map(c => [c.name, c.demand])} /></section>
          <section className="stats-panel"><h2>Assenze per docente</h2><Values preview={preview} caption={preview && data.teacherAbsences.length > 10 ? "Primi 10 docenti per ore di assenza" : "Ore dell’orario e giorni con assenza · ordine per ore decrescenti"} headings={["Docente", "Ore di assenza", "Giorni con assenza"]} rows={data.teacherAbsences.map((t, i) => [preview ? `Docente ${i + 1}` : <><span className="stats-teacher-name">{t.name}</span><span className="stats-teacher-anonymous">Docente {i + 1}</span></>, t.hours, t.days])} /></section>
        </div>}
      </div>
    </main>
  </div>;
}
