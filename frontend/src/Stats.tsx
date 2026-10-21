import { useEffect, useState } from "react";
import { CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import { campuses, periods, metricNames, outcomes, weekdays, typeNames, formatNumber as fmt, reportCsv } from "./stats-report";
import { StatsCalendar, presetRange, todayInRome } from "./StatsCalendar";
import { HeatCell } from "./HeatCell";
import { StatsAvailability, absenceExplanation } from "./StatsAvailability";
import type { Metric, StatReport } from "./stats-report";

const metrics: Metric[] = ["demand", "teacherHours", "teachers"];
const heatMetrics: Metric[] = ["demand", "teachers"];
const strokes = ["var(--acc)", "var(--stats-absence)", "var(--stats-teachers)"];
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
        <Tooltip formatter={value => fmt(Number(value))} contentStyle={{ background: "var(--pan)", color: "var(--ink)", borderColor: "var(--line)" }} />
        <Legend />
        {(bars ? ["demand" as Metric] : metrics).map((key, i) => bars
          ? <Bar key={key} dataKey={key} name={metricNames[key]} fill={strokes[i]} maxBarSize={24} isAnimationActive={false} />
          : <Line key={key} type="linear" dataKey={key} name={metricNames[key]} stroke={strokes[i]} strokeDasharray={dashes[i]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />)}
      </Chart>
    </ResponsiveContainer>
  </div>;
}

function Values({ headings, rows, caption }: { headings: string[]; rows: (string | number | null)[][]; caption: string }) {
  return <div className="stats-scroll" tabIndex={0} role="region" aria-label={caption}><table>
    <caption>{caption}</caption><thead><tr>{headings.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{row.map((v, j) => j === 0 ? <th scope="row" key={j}>{typeof v === "number" ? fmt(v) : v}</th> : <td key={j}>{typeof v === "number" || v === null ? fmt(v) : v}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function Stats() {
  const today = todayInRome();
  const [campus, setCampus] = useState("total");
  const [period, setPeriod] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [first, setFirst] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [metric, setMetric] = useState<Metric>("demand");
  const [data, setData] = useState<StatReport>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState(false);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const range = period === "custom" ? { start, end } : presetRange(period, today, first);

  useEffect(() => {
    let active = true;
    setData(undefined); setError("");
    if (period === "custom" && (!start || !end || start > end)) {
      setError("Seleziona un intervallo di date valido."); setLoading(false); return;
    }
    setLoading(true);
    const query = new URLSearchParams({ campus, period, ...(period === "custom" ? { start, end } : {}) });
    fetch("/api/stats?" + query).then(async response => {
      const body = await response.json();
      if (!response.ok) throw Error(typeof body.detail === "string" ? body.detail : "Impossibile caricare le statistiche.");
      if (active) {
        setData(body);
        if (period === "all") setFirst(body.start);
      }
    }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campus, period, start, end, retry]);

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
    if (!data) return;
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
      {preview && <div className="stats-preview-actions"><strong>Anteprima report</strong><button onClick={() => window.print()}>Stampa</button><button onClick={() => setPreview(false)}>Torna alle statistiche</button></div>}
      <div className="stats-heading"><h1>Statistiche</h1><div className="stats-actions"><button onClick={download} disabled={!data?.days}>Esporta CSV</button><button onClick={() => setPreview(true)} disabled={!data?.days && !availabilityReady}>Stampa report</button></div></div>
      {loading && <p role="status">Caricamento statistiche…</p>}
      {error && <div role="alert" className="stats-warning">{error} <button onClick={() => setRetry(retry + 1)}>Riprova</button></div>}
      {data && <>
        <p className="stats-scope"><strong>{campuses[data.campus]}</strong> · {data.start} — {data.end} · {data.days} {data.days === 1 ? "giorno registrato" : "giorni registrati"}</p>
        {!data.days ? <section className="stats-panel"><h2>Nessun giorno con assenze registrate</h2><p>Seleziona un altro periodo. Le date future sono escluse dalle statistiche.</p></section> : <>
          <div className="stats-cards" aria-label="Medie giornaliere">
            {metrics.map(k => <section className="stats-card" key={k}><h2>{metricNames[k]}</h2><div><strong>{fmt(data.averages[k])}</strong><span> / giorno</span></div><p>{fmt(data.totals[k])} {k === "teachers" ? "giorni-docente" : "ore"} nel periodo</p></section>)}
          </div>
          <p className="stats-method">{absenceExplanation}</p>
          <p className="stats-method">Ore da coprire: ore di classe che richiedono una sostituzione, anche se già assegnata. Ogni classe e ora conta una volta. Gli esiti registrati in questa istanza possono essere incompleti.</p>
          <div className="stats-outcomes" aria-label="Esito delle ore da coprire">{Object.entries(outcomes).map(([k, title]) => <div key={k} className={"outcome-" + k}><span>{title}</span><strong>{fmt(data.totals[k as keyof typeof outcomes])}</strong></div>)}</div>
        </>}
        <details className="stats-notes" open={preview}>
          <summary>Metodo e qualità dei dati{!!data.provenance.reconstructed && " · dati storici ricostruiti"}{data.issues > 0 && ` · ${data.issues} assegnazioni da verificare`}</summary>
          <p className="stats-method">Medie sui soli giorni con assenze registrate; giorni vuoti esclusi. Stesse date per tutte le sedi. Ore = periodi dell’orario. I docenti sono contati una volta al giorno; un docente attivo in entrambe le sedi conta una sola volta nel Totale.</p>
          {!!data.provenance.reconstructed && <p className="stats-method">{fmt(data.provenance.reconstructed)} ore di assenza ricostruite dall’orario disponibile al momento della migrazione: il contesto storico non è verificabile.</p>}
          {(data.unknown.teacherHours > 0 || data.unknown.demand > 0 || data.issues > 0) && <p className="stats-method">Tutte le sedi: {fmt(data.unknown.teacherHours)} ore di assenza e {fmt(data.unknown.demand)} ore da coprire senza sede (incluse solo nel Totale). {fmt(data.issues)} assegnazioni da verificare, escluse dalle coperture valide.</p>}
          <p className="stats-method">Senza supplente = nessun supplente trovato, dichiarato esplicitamente. In attesa = nessun esito registrato. Entrata e uscita sono conteggiate separatamente.</p>
        </details>
        {!!data.days && <>
          <section className="stats-panel"><h2>Andamento giornaliero</h2><Trend series={data.daily.map(d => ({ ...d, label: d.date }))} />
            <details className="stats-values" open={preview}><summary>Valori giornalieri e risultati</summary><Values caption="Valori giornalieri" headings={["Data", ...Object.values(metricNames), ...Object.values(outcomes)]} rows={data.daily.map(d => [d.date, d.demand, d.teacherHours, d.teachers, d.covered, d.uncovered, d.late, d.early, d.pending])} /></details>
          </section>
          <div className="stats-grid">{[
            { title: "Media per giorno della settimana", series: weekData.map(d => ({ label: d.name, teachers: d.teachers, teacherHours: d.teacherHours, demand: d.demand })), label: "Giorno" },
            { title: "Media per ora", series: data.hours.map(d => ({ label: `${d.hour}ª`, teachers: d.teachers, teacherHours: d.teacherHours, demand: d.demand })), label: "Ora" },
          ].map(chart => <section className="stats-panel" key={chart.label}><h2>{chart.title}</h2><Trend series={chart.series} bars />
            <details className="stats-values" open={preview}><summary>Valori delle medie</summary><Values caption={chart.title} headings={[chart.label, metricNames.demand]} rows={chart.series.map(d => [d.label, d.demand])} /></details>
          </section>)}</div>
          <section className="stats-panel"><div className="stats-panel-heading"><h2>Giorno × ora</h2><div className="site-filter" role="group" aria-label="Indicatore della mappa">{heatMetrics.map(k => <button key={k} className={metric === k ? "active" : ""} aria-pressed={metric === k} onClick={() => setMetric(k)}>{metricNames[k]}</button>)}</div></div>
            <p className="stats-method">Media per ciascuna occorrenza registrata del giorno. — = nessuna data registrata.</p>
            <div className="stats-scroll" tabIndex={0} role="region" aria-label="Mappa giorno per ora"><table className="stats-heatmap"><caption>{metricNames[metric]} · medie per giorno e ora</caption><thead><tr><th scope="col">Ora</th>{weekData.map(w => <th scope="col" key={w.weekday}>{w.name} ({w.days})</th>)}</tr></thead><tbody>{[1, 2, 3, 4, 5, 6, 7].map(h => <tr key={h}><th scope="row">{h}ª ora</th>{weekData.map(w => {
              const cell = data.heatmap.find(c => c.weekday === w.weekday && c.hour === h);
              return cell ? <HeatCell key={w.weekday} cell={cell} metric={metric} max={maxHeat} /> : <td key={w.weekday}>—</td>;
            })}</tr>)}</tbody></table></div>
          </section>
        </>}
      </>}
      <StatsAvailability campus={campus} preview={preview} onReady={setAvailabilityReady} />
      {!!data?.days && <>
          <div className="stats-grid"><section className="stats-panel"><h2>Come abbiamo coperto</h2><Values caption="Coperture per tipo" headings={["Tipo", "Ore"]} rows={Object.entries(data.types).map(([t, n]) => [typeNames[t] || t, n])} /><p>{fmt(data.exceptional)} coperture eccezionali, già incluse nei tipi sopra.</p></section>
            <section className="stats-panel"><h2>Giorni con maggiore domanda</h2><Values caption="Dieci giorni con più ore da coprire" headings={["Data", metricNames.demand, outcomes.uncovered, "Entrata / uscita"]} rows={data.worst.map(d => [d.date, d.demand, d.uncovered, d.late + d.early])} /></section></div>
          <section className="stats-panel"><h2>Classi interessate</h2><Values caption="Domanda per classe" headings={["Classe", metricNames.demand]} rows={data.classes.map(c => [c.name, c.demand])} /></section>
      </>}
    </main>
  </div>;
}
