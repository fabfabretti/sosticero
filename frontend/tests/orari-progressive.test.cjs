const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function compile(file, globals) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, ...globals });
  return exports;
}
const timetables = compile('src/timetables.ts', {});
function screen() {
  const stores = [[], []], effects = [], timers = new Map(), exports = [], prepared = new Set();
  let slots = stores[0], cursor = 0, timerId = 0, changed = false, accept, refresh, pending;
  const react = {
    useState(value) { const i=cursor++, store=slots; if (!(i in store)) store[i]=typeof value==='function'?value():value; return [store[i], v=>{store[i]=typeof v==='function'?v(store[i]):v;changed=true;}]; },
    useRef(value) { const i=cursor++; return slots[i] ||= {current:value}; },
    useMemo(fn) { return fn(); },
    useLayoutEffect() {},
    useEffect(fn, deps) {
      const i=cursor++, store=slots, old=store[i];
      if (!old || deps.some((d,j)=>d!==old.deps[j])) effects.push(()=>{ old?.cleanup?.(); store[i]={deps,cleanup:fn()}; });
    },
  };
  const dataset = { teachers: {}, lessons: {} };
  for(let i=0;i<30;i++) {const id=String(i).padStart(2,'0');dataset.teachers[id]={id,name:'Teacher '+id};dataset.lessons[id+'|lun|1']={classes:['1A']};}
  const api = async url => {
    if (pending) return pending;
    return {day:new URLSearchParams(url.split('?')[1]).get('day'),basis:'basis',effective:null,overrides:[],dataset,imported:dataset};
  };
  const component = compile('src/TeacherTimetables.tsx', {
    require: id => {
      if(id==='react')return react;
      if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
      if(id==='./timetables')return {...timetables,buildTeacherTimetables:ds=>timetables.buildTeacherTimetables(ds).map(g=>({...g,get cells(){prepared.add(g.id);return g.cells;}}))};
      if(id==='./Tooltip')return {HourHelp:'tooltip'};
      if(id==='./Loading')return {Loading:'loading',LoadingRegion:'region',paintLoading:async()=>{}};
      if(id==='./timetablePdf')return {projectTimetableExport:d=>{exports.push(d);return d;},generateTimetablePdf:()=>({save(){}})};
      if(id==='./useQuietRefresh')return {useQuietRefresh:(load,apply)=>{accept=apply;refresh=async()=>apply(await load());return {ready:true,loading:false,enter:refresh,refresh,invalidate(){}};}};
      throw Error(id);
    }, URLSearchParams, setTimeout:fn=>{timers.set(++timerId,fn);return timerId;}, clearTimeout:id=>timers.delete(id),
    window:{confirm:()=>true,addEventListener(){},removeEventListener(){}}, document:{addEventListener(){},removeEventListener(){}},
  });
  const nodes=()=>{let result;do{changed=false;cursor=0;result=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;if(n.type===component.StudentGroupEditor)return;if(typeof n.type==='function'){const previous=slots,index=cursor;slots=stores[1];cursor=0;walk(n.type(n.props));slots=previous;cursor=index;return;}result.push(n);walk(n.props?.children);}walk(component.TeacherTimetables({api}));effects.splice(0).forEach(fn=>fn());}while(changed);return result;};
  return {nodes,timers,exports,dataset,prepared,refresh:()=>refresh(),accept:v=>accept(v),defer:()=>{pending=new Promise(()=>{});},tick:()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},unmount:()=>stores.flat().forEach(s=>s?.cleanup?.())};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));
const tables = s=>s.nodes().filter(n=>n.type==='table');
const loader = s=>s.nodes().some(n=>n.type==='loading'&&n.props.label==='Caricamento altri orari…');
const search = (s,q)=>s.nodes().find(n=>n.props?.['aria-label']==='Cerca docente').props.onChange({target:{value:q}});

test('first grids are usable, complete search and PDF work before all batches mount',async()=>{
  const s=screen();s.nodes();await settle();
  assert.equal(tables(s).length,6);assert.ok(loader(s));assert.equal(s.timers.size,1);
  assert.equal(s.prepared.size,6,'only visible teachers have their card contents prepared');
  assert.equal(s.prepared.has('29'),false);
  await s.nodes().find(n=>n.type==='button'&&n.props.children==='Scarica PDF completo').props.onClick();
  assert.equal(Object.keys(s.exports[0].teachers).length,30);
  search(s,'Teacher 29');assert.equal(tables(s).length,1);assert.equal(tables(s)[0].props['aria-label'],'Orario di Teacher 29');assert.equal(s.timers.size,0);
  assert.equal(s.prepared.has('29'),true);
  search(s,'');assert.equal(tables(s).length,6);
  while(s.timers.size){s.tick();s.nodes();}
  assert.equal(tables(s).length,30);assert.equal(loader(s),false);
  await s.refresh();assert.equal(tables(s).length,30,'same-date refresh preserves visible prefix');
  search(s,'Teacher 29');assert.equal(tables(s).length,1);
  search(s,'');assert.equal(tables(s).length,6,'clearing search after completion starts a fresh progressive list');
});

test('drafts survive appends and obsolete date/filter/unmount work is cancelled',async()=>{
  const s=screen();s.nodes();await settle();s.nodes();
  s.nodes().find(n=>n.props?.['aria-label']==='Modifica nome di Teacher 00').props.onClick();
  const editor=s.nodes().find(n=>n.type==='form'&&n.props['aria-label']==='Modifica nome di Teacher 00');
  assert.ok(editor);
  const inputs=s.nodes().filter(n=>n.type==='input'&&n.props.value==='');
  inputs.at(-2).props.onChange({target:{value:'Draft name'}});
  const input=()=>s.nodes().find(n=>n.type==='input'&&n.props.value==='Draft name');
  assert.ok(input());s.tick();assert.equal(tables(s).length,12);assert.ok(input());
  assert.equal(s.nodes().find(n=>n.type==='button'&&n.props.children==='Scarica PDF completo').props.disabled,true);
  search(s,'Teacher 00');assert.equal(tables(s).length,1);assert.equal(s.timers.size,0);
  search(s,'');s.nodes();assert.equal(s.timers.size,1);
  s.defer();s.nodes().find(n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value:'2027-01-04'}});
  s.nodes();assert.equal(s.timers.size,0,'old-date batch cancelled while new data is pending');
  const region=s.nodes().find(n=>n.type==='region');
  // Actual useQuietRefresh supplies the date's readiness; no old batch is scheduled even with this test stub ready.
  assert.ok(region);
  s.accept({day:'2027-01-04',basis:'next',overrides:[],dataset:s.dataset,imported:s.dataset});
  assert.equal(tables(s).length,6);assert.equal(s.timers.size,1);
  s.unmount();assert.equal(s.timers.size,0);
});

test('class view groups teachers by class and supports class search', async () => {
  const s = screen(); s.nodes(); await settle();
  s.dataset.lessons['00|mar|2'] = { classes: ['2B', '1A'], room: '12', site: 'centrale' };
  await s.refresh();
  s.nodes().find(n => n.type === 'button' && n.props.children === 'Classi').props.onClick();
  assert.deepEqual(tables(s).map(n => n.props['aria-label']), ['Orario della classe 1A', 'Orario della classe 2B']);
  s.nodes().find(n => n.props?.['aria-label'] === 'Cerca classe').props.onChange({target:{value:'2b'}});
  assert.deepEqual(tables(s).map(n => n.props['aria-label']), ['Orario della classe 2B']);
});
