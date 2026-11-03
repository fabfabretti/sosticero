import { useEffect, useRef, useState } from "react";
import { norm } from "./timetables";
import type { Candidate } from "./types";

export function ManualAssignmentDialog({ teachers, hour, current, currentNote, onClose, onAssign }: {
  teachers: Candidate[]; hour: number; current?: string; currentNote?: string;
  onClose: () => void; onAssign: (id: string, exceptional: boolean, category: string, note: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [teacher, setTeacher] = useState(current || "");
  const [query, setQuery] = useState(teachers.find(t => t.id === current)?.name || "");
  const [highlighted, setHighlighted] = useState(0);
  const [note, setNote] = useState(currentNote || "");
  const selected = teachers.find(t => t.id === teacher);
  const suggestions = query && !selected
    ? teachers.filter(t => norm(t.name).includes(norm(query)))
        .sort((a, b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name, "it"))
        .slice(0, 6)
    : [];
  const choose = (t: Candidate) => { setTeacher(t.id); setQuery(t.name); };
  useEffect(() => { dialog.current?.showModal(); dialog.current?.querySelector("input")?.focus(); }, []);
  return <dialog ref={dialog} className="entry-dialog supplenze ui-page ui-surface manual-assignment" aria-labelledby="manual-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="entry-heading"><div><h2 id="manual-title">Assegna manualmente</h2><p>{hour}ª ora</p></div><button className="ui-button" aria-label="Chiudi assegnazione manuale" onClick={onClose}>×</button></div>
    <form className="entry-form ui-form" onSubmit={e => { e.preventDefault(); if (selected) onAssign(selected.id, true, "MANUAL", note); }}>
      <label htmlFor="manual-teacher">Cerca docente</label>
      <div className="entry-search"><div className="sw">
        <input id="manual-teacher" autoFocus value={query} placeholder="Docente, es. ros"
          aria-describedby="manual-warning" role="combobox" aria-autocomplete="list"
          aria-expanded={!!suggestions.length} aria-controls="manual-suggestions"
          aria-activedescendant={suggestions.length ? `manual-suggestion-${highlighted}` : undefined}
          onChange={e => { setQuery(e.target.value); setTeacher(""); setHighlighted(0); }}
          onKeyDown={e => {
            if (e.nativeEvent?.isComposing) { if (e.key === "Enter") e.preventDefault(); return; }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((highlighted + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % Math.max(1, suggestions.length));
            }
            if (e.key === "Enter" && !selected) { e.preventDefault(); if (suggestions[highlighted]) choose(suggestions[highlighted]); }
          }} />
        {!!suggestions.length && <div className="sug" id="manual-suggestions" role="listbox" aria-label="Docenti">{suggestions.map((t, i) =>
          <button id={`manual-suggestion-${i}`} key={t.id} className={highlighted === i ? "on" : ""} type="button" role="option" aria-selected={highlighted === i} onClick={() => choose(t)}>
            {t.name}<small>docente</small>
          </button>
        )}</div>}
      </div></div>
      {query && !selected && !suggestions.length && <p className="sub" role="status">Nessun docente trovato.</p>}
      <div id="manual-warning" aria-live="polite">{selected?.tag && <p className="ui-notice" role="alert">Attenzione: {selected.tag}. Puoi assegnare comunque il docente.</p>}</div>
      <label>Nota (facoltativa)<textarea value={note} maxLength={2000} rows={3} onChange={e => setNote(e.target.value)} /></label>
      <div className="ui-actions"><button type="button" className="ui-button" onClick={onClose}>Annulla</button><button className="ui-button ui-button-primary" disabled={!selected}>{selected?.tag ? "Assegna comunque" : "Assegna"}</button></div>
    </form>
  </dialog>;
}
