import { useEffect, useRef, useState } from 'react';
import { TeacherAccess } from './TeacherAccess';
import { useAccount } from './Auth';
import { AdministrationLayout } from './Administration';
import { requestApi } from './session';
import { Loading } from './Loading';
import { TeacherPicker } from './TeacherPicker';
import { DAYS, HOURS, norm } from './timetables';

type Person = { id: string; name: string; code: string; role: string; classe_concorso: string };
type Period = { id: string; person: string; start: string; end: string | null; source?: string; activityHours?: Record<string, boolean> };
type Document = { schema: number; people: Record<string, Person>; sources: Record<string, string>; absences: Period[]; appointments: Period[] };
type Dataset = { teachers: Record<string, Person>; lessons: Record<string, { classes: string[]; activities?: string[]; special?: string; room?: string | null; site?: string | null; disabled?: boolean }>; excludedPOT?: Record<string, unknown> };
type View = { revision: string; document: Document; people: Record<string, Person>; sources: Record<string, Person>; classCodes: Record<string,string> };
type Preview = { activityHours?: Record<string, { slot: string; codes: string[]; disabled: boolean }[]>; removals: { day: string; key: string; person: string; substitute: string; hours: number[]; reason?: string; category?: string; communicated?: boolean; accepted?: boolean; campusNotice?: { communicated?: boolean; accepted?: boolean } }[]; token: string; ready: boolean; dataset: Dataset; records: { day: string | null; group: string; person: string; substitute?: string; hours: number[] | number }[]; issues: { day: string; key: string; message: string }[] };
type Editor = { kind: 'absence' | 'appointment' | 'person'; record?: string; original?: string; source?: string; person: string; start: string; end: string; name: string; role: string; cdc: string; newPerson: boolean };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const active = (p: Period, day: string) => p.start <= day && (!p.end || p.end >= day);
const dateLabel = (day: string) => day.split('-').reverse().join('/');
const periodLabel = (p: Period) => `Dal ${dateLabel(p.start)}${p.end ? ` al ${dateLabel(p.end)}` : ' · senza data di fine'}`;

export function Staffing() {
  const running = useRef(false), form = useRef<HTMLDivElement>(null);
  const account = useAccount();
  const [copyFeedback, setCopyFeedback] = useState('');
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
        const record: Period={ id:editor.record || crypto.randomUUID(), person, start:editor.start, end:editor.end || null, ...(group==='appointments'?{source:editor.source, activityHours: doc.appointments.find(p => p.id === editor.record)?.activityHours || {}}:{}) };
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
  const setActivity = async (slot: string, disabled: boolean) => {
    if (!pending || !editor || running.current) return;
    const next = structuredClone(pending.document);
    const record = next.appointments.find(p => p.id === (editor.record || next.appointments.at(-1)?.id));
    if (!record) return;
    record.activityHours = { ...record.activityHours, [slot]: disabled };
    running.current = true; setBusy(true); setError('');
    try { const result = await requestApi<Preview>('staffing/preview', {document:next, day:pending.day, revision:view?.revision}); setPending({document:next, day:pending.day, result}); }
    catch(e) { setError(String(e)); }
    finally { running.current = false; setBusy(false); }
  };
  const copyNotice = async (r: Preview['removals'][number]) => {
    const name = view?.people[r.substitute]?.name || r.substitute;
    const cls = r.key.split('|')[2];
    const date = dateLabel(r.day), hour = r.hours.join(', ');
    const text = `[Variazione supplenza] ${date} · ${hour}ª ora · ${cls}\n\nGentile Professore/Professoressa ${name},\n\n${r.reason === 'unavailable' ? 'A seguito della sua assenza prolungata' : 'Vista la nomina di nuovo personale supplente'}, la sua sostituzione precedentemente richiesta per il ${date}, ${hour}ª ora, classe ${cls}, non è più necessaria.\n\nCordiali saluti,\n${account?.name || ''}`;
    try { await navigator.clipboard.writeText(text); setCopyFeedback(`Avviso per ${name} copiato.`); }
    catch { setCopyFeedback('Copia non riuscita: accesso agli appunti non disponibile o negato.'); }
  };
  const notices = pending?.result.removals.filter(r => r.communicated || r.accepted || r.campusNotice?.communicated || r.campusNotice?.accepted) || [];
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
        {editor.kind==='appointment' && <><p className="settings-muted">Verifica le attività non di lezione nell’anteprima e scegli quali mantenere attive.</p><div className="ui-actions"><button type="button" className={'ui-button'+(!editor.newPerson?' on':'')} aria-pressed={!editor.newPerson} onClick={() => change({newPerson:false})}>Scegli docente</button><button type="button" className={'ui-button'+(editor.newPerson?' on':'')} aria-pressed={editor.newPerson} onClick={() => change({newPerson:true,person:''})}>Nuovo docente</button></div>
          {!editor.newPerson && <TeacherPicker key={editor.record || editor.original} id="staffing-replacement" label="Cerca supplente" teachers={people.filter(p => p.id!==editor.original)} value={editor.person} onChange={person => change({person})} />}</>}
        {editor.newPerson && profiles}
        {editor.kind!=='person' && <div className="staffing-fields"><label className="ui-field">Dal<input type="date" required value={editor.start} onChange={e => change({start:e.target.value})} /></label><label className="ui-field">Fino al (facoltativo, incluso)<input type="date" min={editor.start} value={editor.end} onChange={e => change({end:e.target.value})} /></label></div>}
        <div className="ui-actions"><button type="button" className="ui-button" onClick={() => {setEditor(undefined);setPending(undefined);setError('');}}>Annulla</button><button className="ui-button ui-button-primary" disabled={!valid}>Verifica modifica</button></div>
      </fieldset></form>
      {pending && <section className="staffing-preview" aria-label="Anteprima modifica"><h3>Riepilogo modifica</h3><p>{editor.kind==='person'?`Nuovo docente: ${editor.name}`:editor.kind==='absence'?`Assenza prolungata: ${label(editor.person)}`:`${editor.newPerson?editor.name:label(editor.person)} sostituisce ${label(editor.original!)}`}</p>
        {pending.result.issues.map((v,n) => <p className="ui-notice ui-notice-error" key={n}>{dateLabel(v.day)} · {v.message}</p>)}
        {editor.kind==='absence' && <ul className="settings-muted"><li>Le coperture già assegnate restano invariate</li><li>Le ore a pagamento saranno disabilitate nei giorni di assenza</li><li>I saldi permessi restano personali</li></ul>}
        {!!pending.result.removals.length && <section className="staffing-removals"><p>Confermando saranno rimosse {pending.result.removals.length} coperture giornaliere.</p>{!!notices.length && <><h4>Variazioni da comunicare</h4><p className="settings-muted">Queste variazioni erano già state comunicate o accettate.</p><div className="ui-table-scroll"><table className="ui-table"><thead><tr><th>Data e ora</th><th>Classe</th><th>Docente</th><th>Stato</th><th><span className="sr-only">Copia avviso</span></th></tr></thead><tbody>{notices.map(r => { const special = ['ENTRA','ESCE','UNCOVERED'].includes(r.substitute); return <tr key={`${r.day}|${r.key}`}><td>{dateLabel(r.day)} · {r.hours.join(', ')}ª</td><td>{r.key.split('|')[2]}</td><td>{special ? `${label(r.person)} · ${r.substitute}` : view?.people[r.substitute]?.name || r.substitute}</td><td>{r.category==='PAID' ? 'A pagamento · ' : r.category==='RP' ? 'Recupero permesso · ' : ''}{[r.communicated && 'Comunicato', r.accepted && 'Accettata', r.campusNotice?.communicated && 'Cambio sede comunicato', r.campusNotice?.accepted && 'Cambio sede accettato'].filter(Boolean).join(' · ')}</td><td>{!special && <span className="opt communicated"><button type="button" title="Copia avviso di variazione" aria-label={`Copia avviso per ${label(r.substitute)}, ${dateLabel(r.day)}, ora ${r.hours.join(', ')}, classe ${r.key.split('|')[2]}`} onClick={() => void copyNotice(r)}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></button></span>}</td></tr>; })}</tbody></table></div><p className="settings-muted" role="status">{copyFeedback}</p></>}</section>}
        {editor.kind==='appointment' && (() => { const id = editor.record || pending.document.appointments.at(-1)?.id; const activities = id ? pending.result.activityHours?.[id] || [] : []; return !!activities.length && <section className="staffing-activities"><h4>Attività non di lezione</h4><p className="settings-muted">Scegli se mantenere attiva o disabilitare ogni ora nell’orario del supplente.</p><div className="ui-table-scroll"><table className="ui-table"><thead><tr><th>Giorno e ora</th><th>Attività</th><th>Stato per il supplente</th></tr></thead><tbody>{activities.map(a => { const [day,hour] = a.slot.split('|'); return <tr key={a.slot}><td>{({lun:'Lunedì',mar:'Martedì',mer:'Mercoledì',gio:'Giovedì',ven:'Venerdì'} as Record<string,string>)[day]} · {hour}ª</td><td>{a.codes.join(' · ')}</td><td><span>{a.disabled ? 'Disabilitata' : 'Attiva'}</span> <button type="button" className="ui-button" disabled={busy} aria-pressed={a.disabled} aria-label={`${a.disabled ? 'Riattiva' : 'Disabilita'} ${a.codes.join(' ')} ${day} ${hour}ª`} onClick={() => void setActivity(a.slot, !a.disabled)}>{a.disabled ? 'Riattiva' : 'Disabilita'}</button></td></tr>; })}</tbody></table></div></section>; })()}
        {editor.kind==='appointment' && <div className="staffing-week"><table><caption>Orario ereditato</caption><thead><tr><th>Ora</th>{DAYS.map(d => <th key={d}>{d}</th>)}</tr></thead><tbody>{HOURS.map(h => <tr key={h}><th>{h}</th>{DAYS.map(d => { const person=pending.document.appointments.find(p => p.id===(editor.record || pending.document.appointments.at(-1)?.id))?.person; const key=`${person}|${d}|${h}`, l=pending.result.dataset.lessons[key]; return <td key={d}>{l?[...l.classes,...(l.activities || (l.special?[l.special]:[])),l.room,l.site].filter(Boolean).join(' · '):'—'}{l?.disabled && <span className="staffing-excluded"> · disabilitata</span>}{!!pending.result.dataset.excludedPOT?.[key] && <span className="staffing-excluded"><del>POT</del> · non ereditato</span>}</td>; })}</tr>)}</tbody></table></div>}
        <button className="ui-button ui-button-primary" disabled={busy || !pending.result.ready} onClick={() => void save()}>{editor.kind==='person'?'Salva docente':editor.kind==='absence'?'Conferma assenza prolungata':'Conferma supplenza'}</button>
      </section>}
      {busy && <Loading label="Elaborazione…" />}
    </div>}
    </>}
  </main></AdministrationLayout>;
}
