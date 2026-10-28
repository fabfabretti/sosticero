import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { packRows, romeDay, rotatePages, startDisplay, type DisplayState, type DisplayTeacher } from './display';
import { entryExitLabel } from './timetables';
import './display.css';

const hours = [1, 2, 3, 4, 5, 6, 7];
const noTeachers: DisplayTeacher[] = [];
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('it-IT', {
  timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function TeacherTable({ teachers, indices }: { teachers: DisplayTeacher[]; indices: number[] }) {
  return <table className="display-table">
    <colgroup><col className="display-name-column" />{hours.map(h => <col key={h} />)}</colgroup>
    <thead><tr><th scope="col">Docente</th>{hours.map(h => <th scope="col" key={h}>{h}<span>ª ora</span></th>)}</tr></thead>
    <tbody>{indices.filter(index => index < teachers.length).map(index => {
      const teacher = teachers[index];
      return <tr key={index}><th scope="row">{teacher.name}</th>{hours.map(h => {
        const slots = teacher.slots.filter(s => s.period === h);
        return <td key={h} className={slots.length ? 'display-assigned' : ''}>{slots.map((slot, i) =>
          <div className="display-lesson" key={i}><strong>{slot.classe}</strong><span>{slot.room}</span><small className="display-replaced">per {slot.replaced.join(' / ')}</small></div>)}</td>;
      })}</tr>;
    })}</tbody>
  </table>;
}

export function Display() {
  const campus = new URLSearchParams(window.location.search).get('campus');
  const valid = campus === 'centrale' || campus === 'succursale';
  const [state, setState] = useState<DisplayState>({ day: romeDay(), error: false });
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<{ columns: number; pages: number[][][]; fits: boolean }>({ columns: 1, pages: [], fits: true });
  const [controls, setControls] = useState(false);
  const [paused, setPaused] = useState(false), [focused, setFocused] = useState(false);
  const hideControls = useRef<ReturnType<typeof setTimeout>>(undefined);
  const area = useRef<HTMLDivElement>(null), single = useRef<HTMLDivElement>(null), double = useRef<HTMLDivElement>(null);
  const teachers = state.data?.teachers || noTeachers;
  const content = JSON.stringify(teachers);

  useEffect(() => valid ? startDisplay(campus, setState) : undefined, [campus, valid]);
  useEffect(() => () => clearTimeout(hideControls.current), []);
  useLayoutEffect(() => {
    if (!area.current || !single.current || !double.current) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const available = area.current!.clientHeight;
      const heights = (element: HTMLDivElement) => Array.from(element.querySelectorAll('tbody tr'), row => Math.ceil(row.getBoundingClientRect().height));
      const header = (element: HTMLDivElement) => Math.ceil(element.querySelector('thead')!.getBoundingClientRect().height) + 2;
      const full = heights(single.current!), half = heights(double.current!);
      const columns = full.reduce((sum, h) => sum + h, 0) <= available - header(single.current!) ||
        half.some(h => h > available - header(double.current!)) ? 1 : 2;
      const pages = packRows(columns === 1 ? full : half, available - header(columns === 1 ? single.current! : double.current!), columns);
      const next = { columns, pages: pages || [], fits: !!pages };
      setLayout(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area.current);
    void document.fonts.ready.then(measure);
    return () => { alive = false; observer.disconnect(); };
  }, [content, valid, state.error, state.data?.incomplete]);

  const pageCount = layout.pages.length;
  useEffect(() => { setPage(old => Math.min(old, Math.max(0, pageCount - 1))); }, [pageCount]);
  useEffect(() => {
    if (paused || focused) return;
    return rotatePages(pageCount, setPage);
  }, [pageCount, paused, focused]);

  const showControls = () => {
    setControls(true);
    clearTimeout(hideControls.current);
    hideControls.current = setTimeout(() => setControls(false), 4000);
  };
  const date = new Date(state.day + 'T12:00:00Z').toLocaleDateString('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return <main className="display-board" onPointerMove={showControls} onPointerDown={showControls} onKeyDown={showControls}
    onFocus={() => setFocused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <header className="display-header"><div><p className="display-eyebrow">Sosticero · Supplenze</p>
      <h1>{valid ? campus === 'centrale' ? 'Centrale' : 'Succursale' : 'Display supplenze'}</h1></div>
      <div className="display-context"><p>{date}</p>{state.data && <p className="display-updated">Aggiornato alle {timeLabel(state.data.updated)}</p>}</div>
    </header>
    {!valid ? <div className="display-message"><h2>Scegli la sede del monitor</h2><p>Apri uno di questi collegamenti:</p>
      <a href="/display?campus=centrale">Centrale</a><a href="/display?campus=succursale">Succursale</a></div> : <>
      {(state.error || state.data?.incomplete) && <div className="display-warning" role="status">
        {state.error ? state.data ? 'Aggiornamento non riuscito · dati non aggiornati. Nuovo tentativo automatico.' : 'Display non disponibile. Nuovo tentativo automatico.' : 'Alcune assegnazioni sono da verificare in segreteria.'}
      </div>}
      <div className="display-area" ref={area}>
        <div className="display-measure" ref={single} aria-hidden="true"><TeacherTable teachers={teachers} indices={teachers.map((_, i) => i)} /></div>
        <div className="display-measure display-measure-double" ref={double} aria-hidden="true"><TeacherTable teachers={teachers} indices={teachers.map((_, i) => i)} /></div>
        {!state.data ? <p className="display-message" role="status">{state.error ? 'Impossibile caricare le supplenze.' : 'Caricamento supplenze…'}</p> :
          !teachers.length ? <p className="display-message">Nessuna supplenza assegnata oggi per questa sede.</p> :
          !layout.fits ? <p className="display-message" role="alert">Il contenuto non entra nello schermo. Aumenta la risoluzione o riduci lo zoom del browser.</p> :
          <div className="display-tables" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
            {layout.pages[Math.min(page, pageCount - 1)]?.map((indices, i) => <TeacherTable key={i} teachers={teachers} indices={indices} />)}
          </div>}
      </div>
      {!!state.data?.changes.length && <section className="display-changes" aria-label="Variazioni di orario delle classi">
        <strong>Variazioni di orario</strong>{state.data.changes.map(change =>
          <span key={change.classe + change.action}><b>{change.classe}</b> {(entryExitLabel(change.action, change.period) ||
            `${change.action === 'ENTRA' ? 'Entra dopo' : 'Esce prima'} (${change.period}ª ora)`).toLowerCase()}</span>)}
      </section>}
      {pageCount > 1 && <footer className="display-footer">Pagina {Math.min(page + 1, pageCount)} di {pageCount}{(paused || focused) && ' · Pausa'}</footer>}
    </>}
    {pageCount > 1 && <div className={'display-controls' + (controls ? ' is-visible' : '')}>
      <button onFocus={showControls} aria-pressed={paused} onClick={() => setPaused(old => !old)}>{paused ? 'Riprendi pagine' : 'Pausa pagine'}</button>
    </div>}
  </main>;
}
