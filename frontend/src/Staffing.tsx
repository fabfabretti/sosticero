import { useEffect, useRef, useState } from 'react';
import { TeacherAccess } from './TeacherAccess';
import { AdministrationLayout } from './Administration';
import { requestApi } from './session';
import { Loading } from './Loading';
import { TeacherPicker } from './TeacherPicker';
import { DAYS, HOURS, norm } from './timetables';

type Person = { id: string; name: string; code: string; role: string; classe_concorso: string };
type Period = { id: string; person: string; start: string; end: string | null; source?: string };
type Document = { schema: number; people: Record<string, Person>; sources: Record<string, string>; absences: Period[]; appointments: Period[] };
type Dataset = { teachers: Record<string, Person>; lessons: Record<string, { classes: string[]; activities?: string[]; special?: string; room?: string | null; site?: string | null }>; excludedPOT?: Record<string, unknown> };
type View = { revision: string; document: Document; people: Record<string, Person>; sources: Record<string, Person>; classCodes: Record<string,string> };
type Preview = { token: string; ready: boolean; dataset: Dataset; records: { day: string | null; group: string; person: string; substitute?: string; hours: number[] | number }[]; issues: { day: string; key: string; message: string }[] };
type Editor = { kind: 'absence' | 'appointment' | 'person'; record?: string; original?: string; source?: string; person: string; start: string; end: string; name: string; role: string; cdc: string; newPerson: boolean };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const active = (p: Period, day: string) => p.start <= day && (!p.end || p.end >= day);
const dateLabel = (day: string) => day.split('-').reverse().join('/');
const periodLabel = (p: Period) => `Dal ${dateLabel(p.start)}${p.end ? ` al ${dateLabel(p.end)}` : ' · senza data di fine'}`;
const groupLabel: Record<string,string> = { abs:'Assenza', permessi:'Permesso', dis:'Disponibilità', asg:'Supplenza giornaliera', manualPermits:'Saldo ore' };

export function Staffing() {
  const running = useRef(false), form = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>();
  const [accessDirty, setAccessDirty] = useState(false);
  const [section, setSection] = useState<'absences'|'people'>('absences');
  const [editor, setEditor] = useState<Editor>();
  const [pending, setPending] = useState<{ document: Document; day: string; result: Preview }>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [cdcQuery, setCdcQuery] = useState(''), [cdcIndex, setCdcIndex] = useState(0);
  const refresh = async () => { setBusy(true); setError(''); try { setView(await requestApi<View>('staffing')); setPending(undefined); setEditor(undefined); } catch(e) { setError(String(e)); } finally { setBusy(false); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if(editor) { form.current?.scrollIntoView({ block:'nearest' }); form.current?.querySelector<HTMLInputElement>('input')?.focus(); } }, [editor?.kind, editor?.record, editor?.original]);
  const people = Object.values(view?.people || {}).sort((a,b) => a.name.localeCompare(b.name,'it'));
  const label = (id: string) => view?.people[id]?.name || 'Docente';
  const doc = view?.document;
  const sourceFor = (person: string) => Object.keys(view?.sources || {}).find(i => (doc?.sources[i] || i) === person);
  const originalOf = (p: Period) => doc?.sources[p.source!] || p.source!;
  const open = (kind: Editor['kind'], original?: string, record?: Period) => {
    setError(''); setMessage(''); setPending(undefined); setCdcQuery('');
    setEditor({ kind, original, record:record?.id, source:record?.source || (original ? sourceFor(original) : undefined), person:record?.person || '', start:record?.start || today(), end:record?.end || '', name:'', role:'curricolare', cdc:'', newPerson:kind==='person' });
  };
  const change = (patch: Partial<Editor>) => { setEditor(e => e ? { ...e, ...patch } : e); setPending(undefined); };
  const cdcOptions = cdcQuery && !editor?.cdc ? Object.entries(view?.classCodes || {}).filter(([code,name]) => norm(`${code} ${name}`).includes(norm(cdcQuery))).slice(0,6) : [];
  const chooseCdc = (code: string) => { change({ cdc:code }); setCdcQuery(`${code} — ${view?.classCodes[code]}`); };
  const inspect = async () => {
    if (!doc || !editor || running.current) return;
    running.current=true; setBusy(true); setError(''); setPending(undefined);
    try {
      const next=structuredClone(doc);
      let person=editor.person;
      if(editor.newPerson) { person=crypto.randomUUID(); next.people[person]={ id:person, name:editor.name.trim(), code:'', role:editor.role, classe_concorso:editor.cdc }; }
      if(editor.kind!=='person') {
        const group=editor.kind==='absence'?'absences':'appointments';
        const record: Period={ id:editor.record || crypto.randomUUID(), person, start:editor.start, end:editor.end || null, ...(group==='appointments'?{source:editor.source}:{}) };
        next[group]=[...next[group].filter(p => p.id!==record.id),record];
      }
      const day=editor.kind==='person'?today():editor.start;
      const result=await requestApi<Preview>('staffing/preview',{ document:next, day, revision:view?.revision });
      setPending({ document:next,day,result });
    } catch(e) { setError(String(e)); } finally { running.current=false; setBusy(false); }
  };
  const save = async () => {
    if(!pending || !pending.result.ready || running.current) return;
    running.current=true; setBusy(true); setError('');
    try { await requestApi('staffing/apply',{ document:pending.document, day:pending.day, revision:view?.revision, token:pending.result.token }); await refresh(); setMessage('Modifica salvata. Orari e Supplenze aggiornati.'); }
    catch(e) { setError(String(e)); setPending(undefined); }
    finally { running.current=false; setBusy(false); }
  };
  const valid=!!editor && (editor.newPerson ? !!editor.name.trim() && (!cdcQuery || !!editor.cdc) : !!editor.person) && (editor.kind!=='appointment' || !!editor.source) && (editor.kind==='person' || !!editor.start && (!editor.end || editor.end>=editor.start));
  const title=editor?.kind==='person'?'Nuovo docente':editor?.kind==='absence'?(editor.record?'Modifica assenza prolungata':'Nuova assenza prolungata'):(editor?.record?'Modifica supplenza':'Assegna supplente');
  const profiles = <div className="staffing-fields">
    <label className="ui-field">Nome e cognome<input required maxLength={200} value={editor?.name || ''} onChange={e => change({name:e.target.value})} /></label>
    <label className="ui-field">Ruolo<select value={editor?.role} onChange={e => change({role:e.target.value})}><option value="curricolare">Curricolare</option><option value="ITP">ITP</option><option value="sostegno">Sostegno</option></select></label>
    <div className="staffing-picker"><label htmlFor="staffing-cdc">Classe di concorso (facoltativa)</label><div className="sw"><input id="staffing-cdc" role="combobox" autoComplete="off" placeholder="Cerca codice o disciplina" value={cdcQuery} aria-autocomplete="list" aria-expanded={!!cdcOptions.length} aria-controls="staffing-cdc-options" aria-activedescendant={cdcOptions.length?`staffing-cdc-${cdcIndex}`:undefined}
      onChange={e => { setCdcQuery(e.target.value); setCdcIndex(0); change({cdc:''}); }} onKeyDown={e => { if(e.nativeEvent?.isComposing) return; if(e.key==='ArrowDown'||e.key==='ArrowUp') { e.preventDefault(); setCdcIndex((cdcIndex+(e.key==='ArrowDown'?1:cdcOptions.length-1))%Math.max(1,cdcOptions.length)); } if(e.key==='Enter' && !editor?.cdc) { e.preventDefault(); if(cdcOptions[cdcIndex]) chooseCdc(cdcOptions[cdcIndex][0]); } }} />
      {!!cdcOptions.length && <div className="sug" role="listbox" id="staffing-cdc-options" aria-label="Classi di concorso">{cdcOptions.map(([code,name],i) => <button type="button" role="option" id={`staffing-cdc-${i}`} key={code} aria-selected={i===cdcIndex} className={i===cdcIndex?'on':''} onClick={() => chooseCdc(code)}>{code}<small>{name}</small></button>)}</div>}
      {cdcQuery && !editor?.cdc && !cdcOptions.length && <p className="sub" role="status">Classe di concorso non trovata.</p>}
    </div></div>
  </div>;
  const renderAbsence = (absence: Period) => {
    const assignments=doc!.appointments.filter(p => originalOf(p)===absence.person).sort((a,b) => a.start.localeCompare(b.start));
    const current=assignments.find(p => active(p,today()));
    return <li className="staffing-absence" key={absence.id}><div className="staffing-absence-heading"><div><h3>{label(absence.person)}</h3><p>{periodLabel(absence)}</p><p className={current?'':'settings-muted'}>{current?`Supplente: ${label(current.person)}`:'Senza supplente'}</p></div><div className="ui-actions">
      <button className="ui-button" onClick={() => open('absence',undefined,absence)}>Modifica periodo</button>
      {current ? <button className="ui-button" onClick={() => open('appointment',absence.person,current)}>Modifica supplenza</button> : <button className="ui-button ui-button-primary" disabled={!sourceFor(absence.person)} onClick={() => open('appointment',absence.person)}>Assegna supplente</button>}
    </div></div>
    {!sourceFor(absence.person) && <p className="settings-muted">Nessuna cattedra importata per questo docente.</p>}
    {assignments.length>0 && <details><summary>Periodi di supplenza ({assignments.length})</summary><ul>{assignments.map(p => <li key={p.id}>{label(p.person)} · {periodLabel(p)} <button className="ui-button" onClick={() => open('appointment',absence.person,p)}>Modifica</button></li>)}</ul>{current && <button className="ui-button" onClick={() => open('appointment',absence.person)}>Programma nuovo supplente</button>}</details>}
    </li>;
  };
  const currentAbsences=doc?.absences.filter(p => active(p,today())) || [];
  const otherAbsences=doc?.absences.filter(p => !active(p,today())) || [];
  return <AdministrationLayout staffing><main className="ui-page administration-page staffing-page">
    <h1>Gestione docenti</h1>
    <nav className="ui-actions staffing-tabs" aria-label="Gestione docenti"><button className={'ui-button'+(section==='absences'?' on':'')} aria-pressed={section==='absences'} disabled={busy || !!editor} onClick={() => { if (!accessDirty || window.confirm('Scartare le modifiche agli accessi non salvate?')) setSection('absences'); }}>Assenze prolungate</button><button className={'ui-button'+(section==='people'?' on':'')} aria-pressed={section==='people'} disabled={busy || !!editor} onClick={() => setSection('people')}>Docenti</button></nav>
    {error && <p role="alert" className="ui-notice ui-notice-error">{error} <button className="ui-button" disabled={busy} onClick={() => void refresh()}>Scarta e ricarica</button></p>}{message && <p role="status" className="ui-notice">{message}</p>}
    {!view ? <><Loading label="Caricamento docenti…" />{error && <button className="ui-button" onClick={() => void refresh()}>Riprova</button>}</> : <>
    {!editor && (section==='absences' ? <section><div className="administration-heading"><div><h2>Assenze prolungate</h2><p className="settings-muted">Docenti assenti per un periodo lungo, ad esempio per maternità o cessazione del servizio. Le assenze giornaliere si inseriscono in Supplenze.</p></div><button className="ui-button ui-button-primary" onClick={() => open('absence')}>Nuova assenza prolungata</button></div>
      {!currentAbsences.length && <p className="ui-surface staffing-section">Nessuna assenza prolungata in corso.</p>}<ul className="staffing-absence-list">{currentAbsences.map(renderAbsence)}</ul>
      {otherAbsences.length>0 && <details className="staffing-section"><summary>Assenze programmate e concluse ({otherAbsences.length})</summary><ul className="staffing-absence-list">{otherAbsences.map(renderAbsence)}</ul></details>}
    </section> : <TeacherAccess onCreate={() => open('person')} onDirtyChange={setAccessDirty} />)}
    {editor && <div ref={form} className="ui-surface staffing-section staffing-editor"><h2>{title}</h2>{editor.original && <p>Cattedra di <strong>{label(editor.original)}</strong></p>}
      <form onSubmit={e => {e.preventDefault(); if(valid) void inspect();}}><fieldset disabled={busy} className="staffing-workspace">
        {editor.kind==='absence' && <TeacherPicker key={editor.record || 'absence'} id="staffing-absent" label="Docente assente" teachers={people} value={editor.person} onChange={person => change({person})} />}
        {editor.kind==='appointment' && <><p className="settings-muted">Il supplente eredita l’orario del docente assente, escluse le ore POT.</p><div className="ui-actions"><button type="button" className={'ui-button'+(!editor.newPerson?' on':'')} aria-pressed={!editor.newPerson} onClick={() => change({newPerson:false})}>Scegli docente</button><button type="button" className={'ui-button'+(editor.newPerson?' on':'')} aria-pressed={editor.newPerson} onClick={() => change({newPerson:true,person:''})}>Nuovo docente</button></div>
          {!editor.newPerson && <TeacherPicker key={editor.record || editor.original} id="staffing-replacement" label="Cerca supplente" teachers={people.filter(p => p.id!==editor.original)} value={editor.person} onChange={person => change({person})} />}</>}
        {editor.newPerson && profiles}
        {editor.kind!=='person' && <div className="staffing-fields"><label className="ui-field">Dal<input type="date" required value={editor.start} onChange={e => change({start:e.target.value})} /></label><label className="ui-field">Fino al (facoltativo, incluso)<input type="date" min={editor.start} value={editor.end} onChange={e => change({end:e.target.value})} /></label></div>}
        <div className="ui-actions"><button type="button" className="ui-button" onClick={() => {setEditor(undefined);setPending(undefined);setError('');}}>Annulla</button><button className="ui-button ui-button-primary" disabled={!valid}>Verifica modifica</button></div>
      </fieldset></form>
      {pending && <section className="staffing-preview" aria-label="Anteprima modifica"><h3>Riepilogo modifica</h3><p>{editor.kind==='person'?`Nuovo docente: ${editor.name}`:editor.kind==='absence'?`Assenza prolungata: ${label(editor.person)}`:`${editor.newPerson?editor.name:label(editor.person)} sostituisce ${label(editor.original!)}`}</p>
        {pending.result.issues.map((v,n) => <p className="ui-notice ui-notice-error" key={n}>{dateLabel(v.day)} · {v.message}</p>)}
        {editor.kind==='absence' && <p className="settings-muted">Le assenze e le supplenze già registrate saranno mantenute. I saldi permessi restano personali.</p>}
        {!!pending.result.records.length && <details><summary>Registrazioni esistenti mantenute ({pending.result.records.length})</summary><ul>{pending.result.records.map((r,n) => <li key={n}>{r.day?dateLabel(r.day):'Saldo iniziale'} · {label(r.person)} · {r.group==='asg' && r.substitute ? `Copertura: ${view?.people[r.substitute]?.name || r.substitute}` : groupLabel[r.group] || r.group} · ore {Array.isArray(r.hours)?r.hours.join(', '):r.hours}</li>)}</ul></details>}
        {editor.kind==='appointment' && <div className="staffing-week"><table><caption>Orario ereditato · POT escluso</caption><thead><tr><th>Ora</th>{DAYS.map(d => <th key={d}>{d}</th>)}</tr></thead><tbody>{HOURS.map(h => <tr key={h}><th>{h}</th>{DAYS.map(d => { const person=pending.document.appointments.find(p => p.id===(editor.record || pending.document.appointments.at(-1)?.id))?.person; const key=`${person}|${d}|${h}`, l=pending.result.dataset.lessons[key]; return <td key={d}>{l?[...l.classes,...(l.activities || (l.special?[l.special]:[])),l.room,l.site].filter(Boolean).join(' · '):'—'}{!!pending.result.dataset.excludedPOT?.[key] && <span className="staffing-excluded"><del>POT</del> · non ereditato</span>}</td>; })}</tr>)}</tbody></table></div>}
        <button className="ui-button ui-button-primary" disabled={busy || !pending.result.ready} onClick={() => void save()}>{editor.kind==='person'?'Salva docente':editor.kind==='absence'?'Conferma assenza prolungata':'Conferma supplenza'}</button>
      </section>}
      {busy && <Loading label="Elaborazione…" />}
    </div>}
    </>}
  </main></AdministrationLayout>;
}
