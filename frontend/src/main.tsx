import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import type { Row, Candidate, Data } from "./types";
import { HourTypes } from "./HourTypes";
import { CandidateDrawer } from "./CandidateDrawer";
import { HashRouter, Link, useLocation } from "react-router";
const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f.\s]/g, "");
const hours = [1, 2, 3, 4, 5, 6, 7];
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  { path: "/banca-ore", label: "Banca ore" },
  { path: "/stats", label: "Stats" },
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
function TopBar({ current }: { current: string }) {
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
            {t.label}
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
function HourHelp({ text, children }: { text: string; children: React.ReactNode }) {
  return <span className="hour-help" tabIndex={0} aria-label={text}>
    {children}<span role="tooltip">{text}</span>
  </span>;
}
function Permessi() {
  const [sort, setSort] = useState<{ field: "date" | "requested"; ascending: boolean }>({ field: "date", ascending: false });
  const [data, setData] = useState<{ dataset: Data["dataset"]; permessi: Record<string, Record<string, number[]>>; permitRequests?: Record<string, Record<string, string>> }>();
  const [day, setDay] = useState(localDate(new Date()));
  const [requestedOn, setRequestedOn] = useState("");
  const [teacher, setTeacher] = useState("");
  const [query, setQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [original, setOriginal] = useState<{ day: string; id: string }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => setData(await api("permessi"));
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, []);
  const scheduled = (id: string, date: string, h: number) => {
    const weekday = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"][new Date(date + "T12:00").getDay()];
    return !!data?.dataset.lessons[`${id}|${weekday}|${h}`];
  };
  const maximum = Math.floor(hours.filter(h => scheduled(teacher, day, h)).length / 2);
  const overLimit = !!teacher && selected.length > maximum;
  const suggestions = query && !teacher
    ? Object.values(data?.dataset.teachers || {})
        .filter(t => (!t.retired || t.id === original?.id) && norm(t.name + " " + (t.code || "")).includes(norm(query)))
        .sort((a, b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name))
        .slice(0, 6)
    : [];
  const selectTeacher = (id: string) => {
    setTeacher(id);
    setQuery(data?.dataset.teachers[id]?.name || id);
  };
  const reset = () => {
    setRequestedOn("");
    setOriginal(undefined);
    setTeacher("");
    setQuery("");
    setSelected([]);
  };
  const save = async (body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await api("permessi", body);
      await refresh();
      reset();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const records = Object.entries(data?.permessi || {}).flatMap(([date, teachers]) =>
    Object.entries(teachers).map(([id, periods]) => ({ date, id, periods, requested: data?.permitRequests?.[date]?.[id] || "" })),
  ).sort((a, b) => {
    const left = a[sort.field], right = b[sort.field];
    return Number(!left) - Number(!right) || (sort.ascending ? 1 : -1) * left.localeCompare(right) || b.date.localeCompare(a.date) || (data?.dataset.teachers[a.id]?.name || a.id).localeCompare(data?.dataset.teachers[b.id]?.name || b.id);
  });
  const warning = (text: string) => <HourHelp text={text}>
    <svg className="warning-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
  </HourHelp>;
  return <div className="app permessi">
    <aside>
    <form className="permit-form" onSubmit={e => { e.preventDefault(); if (overLimit || !teacher) return; void save({ day, id: teacher, requested_on: requestedOn || null, hours: selected, ...(original ? { original_day: original.day, original_id: original.id } : {}) }); }}>
      <h2>{original ? "Modifica permesso" : "Aggiungi permesso"}</h2>
      <fieldset disabled={busy || !data}>
        <div className="permit-teacher">
          <label htmlFor="permit-teacher">Docente</label>
          <div className="sw">
            <input id="permit-teacher" aria-label="Cerca docente" placeholder="Docente, es. ros" autoComplete="off" value={query}
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
        <label>Data permesso<input required aria-label="Data permesso" type="date" value={day} onChange={e => setDay(e.target.value)} /></label>
        <label>Data richiesta (facoltativa)<input aria-label="Data richiesta" type="date" value={requestedOn} onChange={e => setRequestedOn(e.target.value)} /></label>
        <div><span>Ore di permesso</span><div className="hrs permit-hours">{hours.map(h => <span className="permit-hour" key={h}>
          <button type="button" aria-label={`Permesso ${h}ª ora`} aria-pressed={selected.includes(h)} className={selected.includes(h) ? "on" : ""} onClick={() => setSelected(selected.includes(h) ? selected.filter(v => v !== h) : [...selected, h])}>{h}</button>
          {teacher && selected.includes(h) && (overLimit || !scheduled(teacher, day, h)) && warning([overLimit ? `Massimo giornaliero: ${maximum} ore di permesso; selezionate ${selected.length}.` : "", !scheduled(teacher, day, h) ? `${h}ª ora: nessuna attività prevista nell’orario per questa ora.` : ""].filter(Boolean).join(" "))}
        </span>)}</div></div>

        <p className="sub">Massimo giornaliero: {maximum} ore · Selezionate: {selected.length}. Sono comprese tutte le attività in orario, inclusi POT e DIS.</p>
        <button className="permit-save" type="submit" disabled={!teacher || !day || !selected.length || overLimit}>{busy ? "Salvataggio…" : "Salva permesso"}</button>
        {original && <button type="button" onClick={reset}>Annulla modifica</button>}
      </fieldset>
      <div className="permit-feedback" aria-live="polite">{(error || overLimit) && <p role="alert">{error || `Superato il massimo giornaliero di ${maximum} ore di permesso.`}</p>}</div>
    </form>
    </aside>
    <main>
    <h1>Permessi</h1>
    <p className="sub">Registra le ore di permesso e consulta le ore da recuperare.</p>
    {!data && !error && <p role="status">Caricamento…</p>}
    <div className="permit-table"><table><thead><tr><th>Docente</th>{([ ["date", "Data permesso"], ["requested", "Data richiesta"] ] as const).map(([field, title]) => <th key={field} aria-sort={sort.field === field ? (sort.ascending ? "ascending" : "descending") : "none"}><button className="lk" onClick={() => setSort({ field, ascending: sort.field === field ? !sort.ascending : false })}>{title}{sort.field === field ? (sort.ascending ? " ↑" : " ↓") : " ↕"}</button></th>)}{["Ore di permesso", "Ore da recuperare", "Azioni"].map(title => <th key={title}>{title}</th>)}</tr></thead>
      <tbody>{records.map(r => <tr key={r.date + r.id}>
        <td>{data?.dataset.teachers[r.id]?.name || r.id}</td><td>{r.date.split("-").reverse().join("/")}</td>
        <td>{data?.permitRequests?.[r.date]?.[r.id]?.split("-").reverse().join("/") || "—"}</td>
        <td>{r.periods.map(h => <span className="permit-period" key={h}>{h}ª{!scheduled(r.id, r.date, h) && warning(`${h}ª ora: nessuna attività prevista nell’orario per questa ora`)}</span>)}</td><td>{r.periods.length}</td>
        <td className="permit-actions"><button className="lk" aria-label={`Modifica permesso di ${data?.dataset.teachers[r.id]?.name || r.id}`} title="Modifica permesso" disabled={busy} onClick={() => { setDay(r.date); setRequestedOn(data?.permitRequests?.[r.date]?.[r.id] || ""); selectTeacher(r.id); setSelected(r.periods); setOriginal({ day: r.date, id: r.id }); setError(""); }}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button>
        <button className="x" aria-label={`Rimuovi permesso di ${data?.dataset.teachers[r.id]?.name || r.id}`} title="Rimuovi permesso" disabled={busy} onClick={() => void save({ day: r.date, id: r.id, hours: null })}>×</button></td>
      </tr>)}</tbody></table></div>
    {data && !records.length && <p className="none">Nessun permesso registrato.</p>}
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
      await api(target, JSON.parse(await file.text()));
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
        <label className="upload-btn">
          Carica database JSON
          <input
            type="file"
            hidden
            accept=".json"
            onChange={(e) => void upload(e.target.files?.[0], "timetable")}
          />
        </label>
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
      <BackupSection />
    </section>
  );
}
function Shell() {
  const { pathname } = useLocation();
  const tab = screenFor(pathname);
  return (
    <div className="shell">
      <TopBar current={tab.path} />
      {tab.path === "/" ? (
        <Supplenze />
      ) : tab.path === "/permessi" ? (
        <Permessi />
      ) : tab.path === "/settings" ? (
        <Settings />
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
  return (
    <HashRouter>
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
    [some, setSome] = useState(false),
    [multi, setMulti] = useState(false),
    [until, setUntil] = useState(""),
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
  const request = useRef(0);
  const candidateRequest = useRef(0);
  useEffect(() => {
    try { localStorage.setItem("supplenze-campus", filter); } catch { /* Browser storage may be unavailable. */ }
  }, [filter]);
  const refresh = async () => {
    const n = ++request.current;
    try {
      const d = await api<Data>("day/" + day);
      if (n === request.current) setData(d);
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    ++candidateRequest.current;
    setOpen(undefined);
    void refresh();
  }, [day]);
  const mutate = async (url: string, body: unknown) => {
    ++candidateRequest.current;
    setOpen(undefined);
    setBusy(true);
    setError("");
    try {
      await api(url, body);
      await refresh();
    } catch (e) {
      setError(String(e));
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
    { DIR: "Dirigente", ENTRA: "Entra dopo", ESCE: "Esce prima" }[id] ||
    id;
  const entries = (g: "abs" | "cf" | "dis") => data?.state[g][day] || {};
  const suggestions =
    query && data
      ? [
          ...Object.values(data.dataset.teachers)
            .filter(
              (t) =>
                !t.retired &&
                !entries(kind)[t.id] &&
                norm(t.name + " " + t.code).includes(norm(query)),
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
  const add = (s: (typeof suggestions)[number]) => {
    void mutate("entries", {
      day,
      until: multi && until ? until : null,
      group: s.group,
      id: s.id,
      hours: some ? [] : hours,
      site,
      defaults: !some,
    });
    setQuery("");
    setUntil("");
    setMulti(false);
    setSelected(0);
    document.getElementById("q")?.focus();
  };
  const renderEntries = (g: "abs" | "cf" | "dis") =>
    Object.keys({ ...entries(g), ...(g === "abs" ? data?.state.permessi?.[day] : {}) }).map((id) => {
      const hs = entries(g)[id] || [];
      const permit = g === "abs" ? data?.state.permessi?.[day]?.[id] || [] : [];
      return (
        <div className="rw" key={g + id}>
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
          <div className="hrs">
            {hours.map((h) => (
              <span key={h} className={permit.includes(h) ? "hour-help" : undefined} tabIndex={permit.includes(h) ? 0 : undefined} aria-label={permit.includes(h) ? `${name(id)}, ${h}ª ora: Permesso` : undefined}>
              <button
                key={h}
                aria-label={`${name(id)}, ${h}ª ora`}
                aria-pressed={hs.includes(h) || permit.includes(h)}
                className={(hs.includes(h) || permit.includes(h) ? "on " : "") + (permit.includes(h) ? "auto" : "")}
                disabled={permit.includes(h)}
                title={permit.includes(h) ? "Permesso: modifica dalla pagina Permessi" : undefined}
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
              {permit.includes(h) && <span role="tooltip">Permesso: modifica dalla pagina Permessi</span>}
              </span>
            ))}
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
          <button
            className="x"
            aria-label={"Rimuovi " + name(id)}
            disabled={g === "abs" && !Object.hasOwn(entries(g), id)}
            onClick={() => void mutate("entries", { day, group: g, id })}
          >
            ×
          </button>
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
      const toggled = (h: number) =>
        hs.includes(h) ? hs.filter((x) => x !== h) : [...hs, h];
      return (
        <div className="rw" key={"dis" + id}>
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
              <i className="auto-dot" title="Disponibilità automatica" />
            )}
            {name(id)}
          </button>
          <div className="hrs">
            {hours.map((h) => {
              const locked = reasons[h] !== undefined;
              return (
                <button
                  key={h}
                  aria-label={`${name(id)}, ${h}ª ora`}
                  aria-pressed={hs.includes(h)}
                  className={
                    (hs.includes(h) ? "on " : "") + (locked ? "auto" : "")
                  }
                  disabled={locked}
                  title={
                    locked
                      ? "Automatico: " + reasons[h].join(", ")
                      : undefined
                  }
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
      );
    });
  };
  const offset = (month.getDay() + 6) % 7,
    n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rs =
      data?.rows.filter((r) => filter === "all" || r.sede === filter) || [],
    assigned = data?.state.asg[day] || {};
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
          <section>
            <h2>Aggiungi assenti o a disposizione</h2>
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
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
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
                  if (e.key === "Enter" && suggestions[selected])
                    add(suggestions[selected]);
                }}
              />
              {!!suggestions.length && (
                <div className="sug">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.group + s.id}
                      className={selected === i ? "on" : ""}
                      onClick={() => add(s)}
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
            <div className="opt">
              <button
                className={some ? "on" : ""}
                aria-pressed={some}
                onClick={() => setSome(!some)}
              >
                Alcune ore
              </button>
              <button
                className={kind === "dis" ? "on" : ""}
                aria-pressed={kind === "dis"}
                onClick={() => setKind(kind === "abs" ? "dis" : "abs")}
              >
                A disposizione
              </button>
              <button
                className={multi ? "on" : ""}
                aria-pressed={multi}
                onClick={() => setMulti(!multi)}
              >
                Più giorni
              </button>
            </div>
            {kind === "dis" && (
              <label className="dis-location">
                Sede della disposizione
                <select value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value="centrale">Centrale</option>
                  <option value="succursale">Succursale</option>
                </select>
              </label>
            )}
            {multi && (
              <label className="until">
                Fino al
                <input
                  type="date"
                  min={day}
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
            )}
          </section>
          <div className="lists">
            <h2>Assenti</h2>
            {renderEntries("abs")}
            {renderEntries("cf")}
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
          {data?.issues.map((i) => (
            <p role="alert" key={i.key}>
              Assegnazione da verificare ({i.key}): {i.message}{" "}
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
                            className={"fill " + (!assigned[r.k] ? "ph" : "")}
                            onClick={() => void choose(r)}
                          >
                            {assigned[r.k]
                              ? name(assigned[r.k].v)
                              : "Scegli il supplente"}
                            <small>{assigned[r.k]?.t}</small>
                          </button>
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
            Caselle vuote nell’orario non sono automaticamente disponibilità.
            Priorità: compresenza, POT/disposizione stessa sede, UTC/UTS/DI.S
            stessa sede, rottura compresenza, dirigente, ingresso/uscita,
            opzioni fuori sede. Le opzioni manuali e gli spostamenti richiedono
            verifica.
          </p>
        </main>
      </div>
      {open && (
        <CandidateDrawer
          open={open}
          cands={cands}
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
