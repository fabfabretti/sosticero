const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function flatten(tree) {
  const result = [];
  function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; result.push(n); walk(n.props?.children); }
  walk(tree); return result;
}
function load(file, imports, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: id => imports[id] || {}, URLSearchParams, ...globals });
  return exports;
}
const row = { h: 3, c: '1A', aula: '12', sede: 'centrale' };

test('paid request and Avvisato are independent, permission guarded and give clipboard feedback', async () => {
  let feedback = '', notified = 0; const copied = [];
  const mod = load('src/PaidActions.tsx', { react: { useState: () => [feedback, value => { feedback = value; }] }, 'react/jsx-runtime': { jsx, jsxs: jsx } }, { navigator: { clipboard: { writeText: async value => copied.push(value) } } });
  const props = { day: '2026-10-28', row, assignment: { v: 'rp', t: 'PAID' }, busy: false, canAssign: false, onNotify: () => notified++ };
  const nodes = () => flatten(mod.PaidActions(props));
  let buttons = nodes().filter(n => n.type === 'button');
  assert.equal(buttons[0].props.disabled, true); buttons[0].props.onClick(); assert.equal(notified, 0);
  buttons[1].props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(notified, 0); assert.equal(feedback, 'Copiato');
  assert.match(copied[0], /28\/10\/2026, 3ª ora, classe 1A, aula 12, sede centrale/);
  assert.match(copied[0], /supplenza a pagamento/); assert.match(copied[0], /Le è possibile/);
  props.canAssign = true; buttons = nodes().filter(n => n.type === 'button'); buttons[0].props.onClick(); assert.equal(notified, 1);
  assert.match(mod.paidMessage(props.day, { ...row, aula: null }), /aula da verificare/);
  const fail = load('src/PaidActions.tsx', { react: { useState: () => [feedback, value => { feedback = value; }] }, 'react/jsx-runtime': { jsx, jsxs: jsx } }, { navigator: {} });
  flatten(fail.PaidActions(props)).filter(n => n.type === 'button')[1].props.onClick();
  await new Promise(resolve => setImmediate(resolve)); assert.match(feedback, /Copia non riuscita/);
});

test('Banca ore edits recurring slots and keeps notification controls out of its register', async () => {
  let cursor = 0; const slots = [], calls = [];
  const report = { dates: ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'], teachers: { rp: { id:'rp', name:'Rossi', code:'DOC01', importedName:'Ròssi Mario' }, retired: {id:'retired',name:'Rossi retired',retired:true}, ...Object.fromEntries(Array.from({length:8},(_,i)=>['t'+i,{id:'t'+i,name:'Rossi '+i}])) }, declarations: {0:{rp:[1]}}, cells: [{ weekday:0,hour:1,teachers:[{id:'rp',name:'Rossi',sites:['centrale'],uncertain:false,why:''}]}], totals:{rp:1}, records:[{date:'2026-10-28',key:'a|1|1A',teacher:'rp',name:'Rossi',hour:1,c:'1A',assignedBy:'centrale',notified:true,paidContext:{site:'centrale',room:'12'}}], concurrency:{records:{'paidAvailability|0|rp':'token'},dates:{}} };
  const mod = load('src/PaidHours.tsx', {
    react: { useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i],value=>{ slots[i]=value; }]; }, useEffect() {} },
    'react/jsx-runtime':{jsx,jsxs:jsx}, './StatsCalendar':{todayInRome:()=> '2026-10-28'},
    './timetables':load('src/timetables.ts', {}),
    './useQuietRefresh':{useQuietRefresh(load,apply) { if (!slots[1]) slots[1]=report; return {refresh:async()=>{apply(report); return report;}}; }},
  });
  function render(){cursor=0; return flatten(mod.PaidHours({api:async(...args)=>{calls.push(args);return report;}}));}
  let nodes=render(); nodes=render();
  assert.ok(nodes.some(n=>n.type==='strong' && n.props.children==='Rossi'));
  assert.ok(!nodes.some(n=>n.type==='button' && /Avvisato|Copia/.test(String(n.props.children))));
  nodes.find(n=>n.type==='button' && n.props.children==='Modifica disponibilità').props.onClick(); nodes=render();
  const search = () => nodes.find(n=>n.type==='input' && n.props['aria-label']==='Cerca docente');
  assert.equal(nodes.filter(n=>n.type==='select').length,1,'only the weekday uses a native select');
  search().props.onChange({target:{value:'ross'}}); nodes=render();
  assert.equal(nodes.find(n=>n.props.className==='sug').props.children.length,6,'same six-result limit as Permessi');
  assert.ok(!JSON.stringify(nodes.find(n=>n.props.className==='sug')).includes('Rossi retired'));
  search().props.onChange({target:{value:'DOC01'}}); nodes=render();
  search().props.onKeyDown({key:'Enter',preventDefault(){}}); nodes=render();
  assert.equal(search().props.value,'Rossi');
  assert.ok(!nodes.some(n=>n.props.className==='sug'),'selecting a teacher closes suggestions');
  const hourButtons=()=>nodes.filter(n=>n.type==='button' && n.props['aria-label']?.startsWith('Disponibilità a pagamento '));
  assert.equal(hourButtons().length,7);
  assert.ok(nodes.some(n=>n.props.className==='hrs permit-hours'),'reuse the shared hour toggle styles');
  assert.equal(hourButtons()[0].props['aria-pressed'],true);
  assert.equal(hourButtons()[0].props.className,'on');
  hourButtons()[1].props.onClick(); nodes=render();
  assert.equal(hourButtons()[1].props['aria-pressed'],true);
  hourButtons()[0].props.onClick(); nodes=render();
  assert.equal(hourButtons()[0].props['aria-pressed'],false);
  hourButtons()[0].props.onClick(); nodes=render();
  nodes.find(n=>n.type==='button' && n.props.children==='Salva').props.onClick(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls[0][0],'paid-availability'); assert.deepEqual(Array.from(calls[0][1].hours),[1,2]);
  assert.equal(calls[0][1].expected['paidAvailability|0|rp'],'token');
  nodes=render(); search().props.onKeyDown({key:'Escape'}); nodes=render();
  assert.equal(search().props.value,'');
  assert.equal(nodes.find(n=>n.type==='button' && n.props.children==='Salva').props.disabled,true);
  search().props.onChange({target:{value:'rossi mario'}}); nodes=render();
  nodes.find(n=>n.props.className==='sug').props.children[0].props.onClick(); nodes=render();
  assert.equal(search().props.value,'Rossi','search matches imported teacher names');
});

test('paid grid preserves the last weekday header and scopes overflow to the table', () => {
  const css=readFileSync('src/paid.css','utf8');
  assert.match(css,/\.paid-page thead th:last-child\s*\{\s*display: table-cell/);
  assert.match(css,/\.paid-page\s*\{[^}]*width: 100%;[^}]*min-width: 0/);
  assert.ok(!css.includes('min-width: 650px'));
});
