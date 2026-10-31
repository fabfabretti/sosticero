import { Loading } from './Loading';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
          <div className="display-lesson" key={i}><div className="display-slot-heading"><strong>{slot.classe}</strong>{slot.kind && <span className="display-kind" aria-label={`Tipo di supplenza: ${slot.kind}`}>{slot.kind}</span>}</div><span>{slot.room}</span><small className="display-replaced"><span className="display-replaced-label">per</span><span className="display-replaced-names">{slot.replaced.join(' / ')}</span></small></div>)}</td>;
      })}</tr>;
    })}</tbody>
  </table>;
}

export function Display({ published = false }: { published?: boolean } = {}) {
  const campus = new URLSearchParams(window.location.search).get('campus');
  const valid = campus === 'centrale' || campus === 'succursale';
  const [state, setState] = useState<DisplayState>({ day: romeDay(), error: false });
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<{ columns: number; pages: number[][][]; fits: boolean; rowHeight?: number }>({ columns: 1, pages: [], fits: true });
  const [controls, setControls] = useState(false);
  const rotation = useRef({ remaining: 15000 });
  const [ring, setRing] = useState({ remaining: 15000, cycle: 0 });
  const [paused, setPaused] = useState(false), [focused, setFocused] = useState(false);
  const hideControls = useRef<ReturnType<typeof setTimeout>>(undefined);
  const area = useRef<HTMLDivElement>(null), single = useRef<HTMLDivElement>(null), double = useRef<HTMLDivElement>(null);
  const teachers = state.data?.teachers || noTeachers;
  const content = JSON.stringify(teachers);

  useEffect(() => valid ? startDisplay(campus, setState, published) : undefined, [campus, valid, published]);
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
      const columns = Math.max(0, ...full) * full.length <= available - header(single.current!) ||
        half.some(h => h > available - header(double.current!)) ? 1 : 2;
      const measured = columns === 1 ? full : half;
      const rowHeight = Math.max(0, ...measured);
      const pages = packRows(measured.map(() => rowHeight), available - header(columns === 1 ? single.current! : double.current!), columns);
      const next = { columns, pages: pages || [], fits: !!pages, rowHeight };
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
    if (paused || focused) {
      setRing(old => ({ remaining: rotation.current.remaining, cycle: old.cycle + 1 }));
      return;
    }
    return rotatePages(pageCount, setPage, rotation.current,
      remaining => setRing(old => ({ remaining, cycle: old.cycle + 1 })));
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
        {!state.data ? <p className="display-message" role="status">{state.error ? 'Impossibile caricare le supplenze.' : <Loading label="Caricamento supplenze…" />}</p> :
          !teachers.length ? <p className="display-message">Nessuna supplenza assegnata oggi per questa sede.</p> :
          !layout.fits ? <p className="display-message" role="alert">Il contenuto non entra nello schermo. Aumenta la risoluzione o riduci lo zoom del browser.</p> :
          <div key={page} className="display-tables display-page-enter" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, '--display-row-height': `${layout.rowHeight || 0}px` } as CSSProperties}>
            {layout.pages[Math.min(page, pageCount - 1)]?.map((indices, i) => <TeacherTable key={i} teachers={teachers} indices={indices} />)}
          </div>}
      </div>
      <div className="display-bottom">
      {!!state.data?.changes.length && <section className="display-changes" aria-label="Variazioni di orario delle classi">
        <strong>Variazioni di orario</strong>{state.data.changes.map(change =>
          <span key={change.classe + change.action}><b>{change.classe}</b> {(entryExitLabel(change.action, change.period) ||
            `${change.action === 'ENTRA' ? 'Entra dopo' : 'Esce prima'} (${change.period}ª ora)`).toLowerCase()}</span>)}
      </section>}
      {pageCount > 1 && <footer className="display-footer" aria-label={`Pagina ${Math.min(page + 1, pageCount)} di ${pageCount}`}>
        <svg className="display-countdown" viewBox="0 0 40 40" aria-hidden="true">
          <circle className="display-countdown-track" cx="20" cy="20" r="16" />
          <circle key={ring.cycle} className="display-countdown-fill" cx="20" cy="20" r="16" pathLength="100"
            style={{ strokeDashoffset: ring.remaining / 150, animationDuration: `${ring.remaining}ms`, animationPlayState: paused || focused ? 'paused' : 'running' }} />
        </svg>
        <span>Pagina <strong>{Math.min(page + 1, pageCount)}</strong> di <strong>{pageCount}</strong>{(paused || focused) && <small>In pausa</small>}</span>
      </footer>}
      </div>
      <div className="display-signature-reminder" role="note">Si ricorda di firmare le supplenze svolte sul tabellone cartaceo.</div>
    </>}
    {pageCount > 1 && <div className={'display-controls' + (controls ? ' is-visible' : '')}>
      <button onFocus={showControls} aria-pressed={paused} onClick={() => setPaused(old => !old)}>{paused ? 'Riprendi pagine' : 'Pausa pagine'}</button>
    </div>}
  </main>;
}
