import { useQuietRefresh } from './useQuietRefresh';
import { useEffect, useState } from "react";
export type HourType = { label: string; available: boolean; visible: boolean; school: boolean | null; color: string };
type Inventory = { generation?: number; versions?: Record<string, string>; types: Record<string, HourType>; needsReimport: boolean };
export function HourTypes({ api, onSummary, revision }: { api: <T>(url: string, body?: unknown) => Promise<T>; onSummary?: (value: string) => void; revision?: string }) {
  const [data, setData] = useState<Inventory>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { refresh, invalidate } = useQuietRefresh(() => api<Inventory>("hour-types"), next => setData(old => JSON.stringify(old) === JSON.stringify(next) && old?.generation === next.generation ? old : next), pending, "hour-types");
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, [api, revision]);
  useEffect(() => { onSummary?.(error ? 'Regole non disponibili' : data ? `${Object.keys(data.types).length} tipi · ${Object.values(data.types).filter(type => type.available).length} disponibili` : 'Caricamento…'); }, [data, error, onSummary]);
  const save = async (id: string, value: HourType) => {
    invalidate();
    setPending(true); setError(""); setMessage("Salvataggio…");
    try {
      const types = await api<Record<string, HourType>>("hour-types", { id, expected: data?.versions?.[id], _generation: data?.generation, available: value.available, visible: value.visible, school: value.school });
      await refresh(); setMessage("Salvato");
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
