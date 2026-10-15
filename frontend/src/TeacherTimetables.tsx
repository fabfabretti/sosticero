import { useEffect, useMemo, useState } from "react";
import { buildTeacherTimetables, norm, DAYS, HOURS } from "./timetables";
import type { HourType } from "./HourTypes";

type Dataset = {
  teachers: Record<string, { id: string; name: string; code?: string; retired?: boolean }>;
  lessons: Record<string, { classes?: string[]; activities?: string[]; special?: string }>;
};
type Orari = { effective: string | null; dataset: Dataset };
type Inventory = { types: Record<string, HourType> };

const DAY_LABELS: Record<string, string> = { lun: "Lun", mar: "Mar", mer: "Mer", gio: "Gio", ven: "Ven" };

export function TeacherTimetables({ api }: { api: <T>(url: string, body?: unknown) => Promise<T> }) {
  const [data, setData] = useState<Orari>();
  const [types, setTypes] = useState<Record<string, HourType>>({});
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api<Orari>("orari"), api<Inventory>("hour-types")])
      .then(([orari, hours]) => { if (active) { setData(orari); setTypes(hours.types || {}); } })
      .catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [api]);
  const grids = useMemo(() => (data ? buildTeacherTimetables(data.dataset) : []), [data]);
  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? grids.filter(g => norm(g.name + " " + g.code).includes(q)) : grids;
  }, [grids, query]);
  const name = (id: string) => data?.dataset.teachers[id]?.name || id;
  return <section className="orari" aria-labelledby="orari-title">
    <h2 id="orari-title">Orari</h2>
    <p className="sub">{data
      ? data.effective ? `Orario dal ${data.effective.split("-").reverse().join("/")}` : "Orario attuale"
      : "Caricamento…"}</p>
    <label className="orari-filter">Cerca docente
      <input type="search" aria-label="Cerca docente" value={query} onChange={e => setQuery(e.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
    {data && !filtered.length && <p>Nessun docente trovato.</p>}
    <div className="orari-grids">
      {filtered.map(g => <div className="orari-card" key={g.id}>
        <h3>{g.name} <small>{g.code}</small></h3>
        {g.cdcName && <p className="orari-cdc" title={`${g.cdc ? g.cdc + " · " : ""}${g.cdcName}`}>{g.cdc ? `${g.cdc} · ` : ""}{g.cdcName}</p>}
        <table className="orari-grid" aria-label={`Orario di ${g.name}`}>
          <thead>
            <tr><th scope="col">Ora</th>{DAYS.map(d => <th key={d} scope="col">{DAY_LABELS[d]}</th>)}</tr>
          </thead>
          <tbody>
            {HOURS.map((h, hi) => <tr key={h}>
              <th scope="row">{`${h}ª`}</th>
              {DAYS.map((d, di) => {
                const cell = g.cells[di][hi];
                return <td key={d}>
                  {cell && (cell.classes.length
                    ? cell.classes.join(", ")
                    : cell.codes.map(code => <span key={code} className={`type-chip palette-${types[`code:${code}`]?.color || "blue"}`}>{code}</span>))}
                  {cell && cell.partners.length > 0 && <span className="orari-partners" title={cell.partners.map(name).join(", ")}>Compresenza<span className="sr-only"> con {cell.partners.map(name).join(", ")}</span></span>}
                </td>;
              })}
            </tr>)}
          </tbody>
        </table>
      </div>)}
    </div>
  </section>;
}
