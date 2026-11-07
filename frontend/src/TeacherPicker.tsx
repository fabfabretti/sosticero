import { useState } from 'react';
import { norm, teacherSearchText } from './timetables';

type Teacher = { id: string; name: string; code?: string; importedName?: string };

// Same explicit selection, six suggestions and keyboard behavior as the daily teacher search.
export function TeacherPicker({ id, label, teachers, value, onChange }: {
  id: string; label: string; teachers: Teacher[]; value: string; onChange: (value: string) => void;
}) {
  const selected = teachers.find(t => t.id === value);
  const [query, setQuery] = useState(selected?.name || '');
  const [highlighted, setHighlighted] = useState(0);
  const suggestions = query && !selected ? teachers.filter(t => norm(teacherSearchText(t)).includes(norm(query)))
    .sort((a,b) => Number(!norm(a.name).startsWith(norm(query))) - Number(!norm(b.name).startsWith(norm(query))) || a.name.localeCompare(b.name,'it')).slice(0,6) : [];
  const choose = (t: Teacher) => { setQuery(t.name); onChange(t.id); };
  return <div className="staffing-picker"><label htmlFor={id}>{label}</label><div className="sw">
    <input id={id} role="combobox" autoComplete="off" value={selected?.name || query} placeholder="Cerca per nome o cognome"
      aria-autocomplete="list" aria-expanded={!!suggestions.length} aria-controls={`${id}-suggestions`}
      aria-activedescendant={suggestions.length ? `${id}-option-${highlighted}` : undefined}
      onChange={e => { setQuery(e.target.value); onChange(''); setHighlighted(0); }}
      onKeyDown={e => {
        if (e.nativeEvent?.isComposing) { if(e.key==='Enter') e.preventDefault(); return; }
        if(e.key==='ArrowDown' || e.key==='ArrowUp') { e.preventDefault(); setHighlighted((highlighted+(e.key==='ArrowDown'?1:suggestions.length-1))%Math.max(1,suggestions.length)); }
        if(e.key==='Enter' && !selected) { e.preventDefault(); if(suggestions[highlighted]) choose(suggestions[highlighted]); }
        if(e.key==='Escape') { setQuery(''); setHighlighted(0); }
      }} />
    {!!suggestions.length && <div className="sug" id={`${id}-suggestions`} role="listbox" aria-label="Docenti suggeriti">{suggestions.map((t,i) => <button type="button" role="option" key={t.id} id={`${id}-option-${i}`} className={highlighted===i?'on':''} aria-selected={highlighted===i} onClick={() => choose(t)}>{t.name}<small>{t.code || 'docente'}</small></button>)}</div>}
    {query && !selected && !suggestions.length && <p className="sub" role="status">Nessun docente trovato.</p>}
  </div></div>;
}
