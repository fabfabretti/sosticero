import { useEffect, useState } from "react";
export type HourType = { label: string; available: boolean; visible: boolean; school: boolean | null; color: string };
type Inventory = { types: Record<string, HourType>; needsReimport: boolean };
export function HourTypes({ api }: { api: <T>(url: string, body?: unknown) => Promise<T> }) {
  const [data, setData] = useState<Inventory>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api<Inventory>("hour-types").then(d => { if (active) setData(d); }).catch(e => { if (active) setError(String(e)); }); return () => { active = false; }; }, [api]);
  const save = async (id: string, value: HourType) => {
    setPending(true); setError(""); setMessage("Salvataggio…");
    try {
      const types = await api<Record<string, HourType>>("hour-types", { id, available: value.available, visible: value.visible, school: value.school });
      setData(d => d && { ...d, types }); setMessage("Salvato");
    } catch (e) { setError(String(e)); setMessage(""); }
    finally { setPending(false); }
  };
  return <section className="hour-types" aria-labelledby="hour-types-title">
    <h2 id="hour-types-title">Tipi di ora</h2>
    <p className="sub">Le regole valgono per tutti i docenti e tutti i giorni. “Presso questa scuola” descrive l’attività e non cambia la disponibilità.</p>
    {data?.needsReimport && <p className="sub">Reimporta l’orario originale per recuperare tutte le sigle: il precedente import conservava solo POT, UTC, UTS e DIS.</p>}
    <p role="status">{message}</p>{error && <p role="alert">{error}</p>}
    {!data ? <p>Caricamento…</p> : <fieldset disabled={pending}>
      <legend className="sr-only">Regole per tipo di ora</legend>
      <div className="hour-type-head" aria-hidden="true"><span>Tipo</span><span>Disponibile per supplenze</span><span>Mostra tra i candidati</span><span>Presso questa scuola</span></div>
      {Object.entries(data.types).sort((a,b) => a[1].label.localeCompare(b[1].label)).map(([id, p]) => <div className="hour-type-row" key={id}>
        <div><span className={`type-chip palette-${p.color}`}>{p.label}</span><small>{id.startsWith("derived:") ? "Tipo di attività" : "Sigla importata"}</small></div>
        {([['available', 'Disponibile per supplenze'], ['visible', 'Mostra tra i candidati'], ['school', 'Presso questa scuola']] as const).map(([key, label]) => <label key={key}>
          <input type="checkbox" checked={p[key] === true} aria-label={`${p.label}: ${label}`} onChange={e => void save(id, { ...p, [key]: e.target.checked })}/>
          <span className="mobile-label">{label}</span>{key === 'school' && p.school === null && <small>Da verificare</small>}
        </label>)}
      </div>)}
    </fieldset>}
  </section>;
}
