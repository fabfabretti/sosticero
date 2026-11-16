const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function compile(path, require) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,URLSearchParams,crypto:requireCrypto,structuredClone,window:{confirm:()=>true}});
  return exports;
}
const requireCrypto = require('node:crypto').webcrypto;
const jsx = (type, props) => ({type, props});
const timetable = compile('src/timetables.ts');
const document = JSON.parse(readFileSync('../openspec/changes/add-student-group-hours/entries.json','utf8'));
const teachers = Object.fromEntries(document.records.map(r=>[r.teacher,{name:r.teacher}]));
const classes = [...new Set(document.records.flatMap(r=>r.sources.map(s=>s.class)))];
function harness() {
  const slots=[];let cursor=0;const saves=[];let fail=false;let dirty=false;let refreshed=0;
  const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];}};
  const screen=compile('src/TeacherTimetables.tsx',id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='./timetables'?timetable:{});
  const api=async(url,body)=>{if(body){saves.push(body);if(fail)throw Error('Gruppi modificati da un altro utente');return {ok:true};}return {generation:9,revision:'revision',document,teachers,classes,conflicts:[{id:document.records[0].id,messages:['Sovrapposizione con ricevimento']}]};};
  const nodes=()=>{cursor=0;const result=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;result.push(n);walk(n.props?.children);}walk(screen.StudentGroupEditor({api,day:'2026-11-16',onDirty:value=>dirty=value,onSaved:async()=>refreshed++}));return result;};
  const button=label=>nodes().find(n=>n.type==='button'&&n.props.children===label);
  return {nodes,button,saves,fail:()=>fail=true,dirty:()=>dirty,refreshed:()=>refreshed};
}
test('group office editor preserves dates, unknown counts and stale drafts',async()=>{
  const h=harness();await h.button('Carica gruppi').props.onClick();
  await new Promise(setImmediate);
  assert.equal(h.nodes().filter(n=>n.type==='li').length,15);
  const edit=h.nodes().find(n=>n.props?.['aria-label']==='Modifica gruppo d038 lun 2');
  edit.props.onClick();assert.ok(h.dirty());
  let fields=h.nodes().filter(n=>n.type==='input');
  assert.equal(fields.find(n=>n.props.type==='number').props.value,'');
  assert.equal(fields.find(n=>n.props.type==='date').props.value,'2026-11-16');
  h.fail();h.nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate);
  assert.ok(h.nodes().some(n=>n.props?.role==='alert'));
  assert.ok(h.dirty());assert.ok(h.nodes().some(n=>n.type==='form'));
  assert.equal(h.saves[0]._generation,9);assert.equal(h.saves[0].revision,'revision');
  assert.equal(h.saves[0].document.records.length,15);
  h.button('Annulla').props.onClick();assert.equal(h.dirty(),false);
});
test('group-only teachers and PDF preserve all supplied groups without compresence',()=>{
  const dataset={teachers,lessons:{},studentGroups:document.records};
  const grids=timetable.buildTeacherTimetables(dataset);
  assert.equal(grids.length,5);
  assert.ok(grids.every(g=>g.cells.flat().every(c=>c===null)));
  const pdf=compile('src/timetablePdf.ts',id=>id==='./timetables'?timetable:id==='jspdf'?require('jspdf'):{});
  const reception={teacher:'d080',day:'ven',hour:2,time:'09:00',location:'centrale',site:'centrale'};
  const projected=pdf.projectTimetableExport({...dataset,receptions:[reception]});
  assert.equal(projected.flatMap(t=>t.cells.flat()).filter(c=>c.includes('Gruppo')).length,15);
  assert.ok(projected.find(t=>t.name==='d080').cells[2][2].includes('1EST (5)'));
  assert.ok(!projected.find(t=>t.name==='d080').cells[2][2].includes('sovrapposizione'));
  assert.ok(projected.find(t=>t.name==='d080').cells[4][1].includes('sovrapposizione'));
  assert.ok(!projected.find(t=>t.name==='d038').cells[0][1].includes('(0)'));
  assert.ok(pdf.generateTimetablePdf(projected,'2026-11-16',null).getNumberOfPages()>0);
});
