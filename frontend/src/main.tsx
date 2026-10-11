import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import type { Row, Candidate, Data } from "./types";
import { CandidateDrawer } from "./CandidateDrawer";
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
function App() {
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
    [filter, setFilter] = useState("all"),
    [open, setOpen] = useState<Row>(),
    [cands, setCands] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(0);
  const request = useRef(0);
  const candidateRequest = useRef(0);
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
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f.\s]/g, "");
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
  const upload = async (file: File | undefined, target: string) => {
    if (!file) return;
    try {
      await mutate(target, JSON.parse(await file.text()));
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
  const renderEntries = (g: "abs" | "cf" | "dis") =>
    Object.entries(entries(g)).map(([id, hs]) => (
      <div className="rw" key={g + id}>
        <button
          className="n"
          title={name(id)}
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
            <button
              key={h}
              aria-label={`${name(id)}, ${h}ª ora`}
              aria-pressed={hs.includes(h)}
              className={hs.includes(h) ? "on" : ""}
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
        {Object.keys(data?.state[g] || {}).some(
          (d) => d > day && data?.state[g][d][id],
        ) && (
          <button
            className="x"
            aria-label="Togli anche dai giorni successivi"
            onClick={() =>
              void mutate("entries", { day, group: g, id, future: true })
            }
          >
            »
          </button>
        )}
        <button
          className="x"
          aria-label={"Rimuovi " + name(id)}
          onClick={() => void mutate("entries", { day, group: g, id })}
        >
          ×
        </button>
      </div>
    ));
  const offset = (month.getDay() + 6) % 7,
    n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rs =
      data?.rows.filter((r) => filter === "all" || r.sede === filter) || [],
    assigned = data?.state.asg[day] || {};
  return (
    <>
      <div className="app" aria-busy={busy} inert={busy || !!open}>
        <aside>
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
                <summary>
                  {data.dataset.warnings.length} anomalie da verificare
                </summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(data.dataset.warnings, null, 2)}
                </pre>
              </details>
            )}
            <div className="archive-actions">
              <button onClick={() => void exportData()}>
                Esporta supplenze
              </button>
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
                    {Object.keys(data?.state.abs[d] || {}).length +
                      Object.keys(data?.state.cf[d] || {}).length >
                      0 && <i />}
                  </button>
                );
              })}
            </div>
          </div>
          <section>
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
            {renderEntries("dis")}
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
                        <td>{name(r.id)}</td>
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
          onAssign={(value) =>
            void mutate("assignments", { day, key: open.k, value })
          }
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
