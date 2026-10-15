const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const ts = require('typescript');

function mount(api, confirm = () => true) {
  let slots = [], cursor = 0, imported = 0;
  const state = initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = v]; };
  const jsx = (type, props) => ({type, props});
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/TimetableImport.tsx','utf8'), {compilerOptions: {module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX}}).outputText, {
    exports, URLSearchParams, window: {confirm}, require(id) {
      if (id === 'react') return {useState:state, useRef: initial => {const [v] = state({current:initial}); return v;}};
      if (id === './StatsCalendar') return {todayInRome: () => '2026-10-15'};
      return {jsx, jsxs:jsx};
    },
  });
  const render = () => { cursor=0; const nodes=[]; function walk(n) { if(Array.isArray(n))return n.forEach(walk); if(!n || typeof n !== 'object')return; nodes.push(n);walk(n.props.children); } walk(exports.TimetableImport({api, onImported(){imported++;}}));return nodes; };
  const button = name => render().find(n => n.type === 'button' && n.props.children === name);
  const file = async (data='{}') => render().find(n=>n.props.type==='file').props.onChange({target:{files:[{name:'orario.json',text:async()=>data}]}});
  return {render,button,file,imported:()=>imported};
}
const impact = {token:'abc', effective:'2026-10-15',end:null,initial:false,changedLessons:2,added:[],removed:[],changedTeachers:[],teachers:{},days:[]};

test('date, preview, explicit confirmation and success use the reviewed JSON',async()=>{
 const calls=[]; const c=mount(async(url,data)=>{calls.push([url,data]);return url.startsWith('timetable/preview')?impact:{backup:{filename:'before.sqlite'}};});
 assert.equal(c.render().find(n=>n.props.type==='date').props.value,'2026-10-15');
 assert.ok(c.button('Mostra anteprima').props.disabled);
 await c.file('{"docenti":[],"orario":[]}');
 await c.button('Mostra anteprima').props.onClick();
 assert.equal(calls.length,1); assert.equal(c.imported(),0);
 await c.button('Conferma importazione').props.onClick();
 assert.match(calls[1][0],/effective=2026-10-15&token=abc&confirm=true/);
 assert.equal(JSON.stringify(calls[0][1]),JSON.stringify(calls[1][1]));
 assert.equal(c.imported(),1); assert.match(c.render().find(n=>n.props.role==='status').props.children,/before.sqlite/);
});

test('cancellation, changed date and stale previews never apply implicitly', async()=>{
 const calls=[];const c=mount(async url=>{calls.push(url); if(url.startsWith('timetable/preview'))return impact; throw Error('Anteprima scaduta');},()=>false);
 await c.file();await c.button('Mostra anteprima').props.onClick();await c.button('Conferma importazione').props.onClick();assert.equal(calls.length,1);
 c.render().find(n=>n.props.type==='date').props.onChange({target:{value:'2026-10-12'}});
 assert.equal(c.button('Conferma importazione'),undefined);
 await c.button('Mostra anteprima').props.onClick();c.button('Annulla').props.onClick();assert.equal(c.imported(),0);
 const failing=mount(async url=>{if(url.startsWith('timetable/preview'))return impact;throw Error('Anteprima scaduta');});
 await failing.file();await failing.button('Mostra anteprima').props.onClick();await failing.button('Conferma importazione').props.onClick();
 assert.equal(failing.button('Conferma importazione'),undefined);assert.match(failing.render().find(n=>n.props.role==='alert').props.children.join(''),/scaduta/);assert.equal(failing.imported(),0);
});

test('bad JSON and late preview after input change cannot enable confirmation',async()=>{
 let resolve;const c=mount(()=>new Promise(r=>resolve=r));
 await c.file('bad');assert.match(c.render().find(n=>n.props.role==='alert').props.children.join(''),/JSON/);
 await c.file(); const pending=c.button('Mostra anteprima').props.onClick();
 c.render().find(n=>n.props.type==='date').props.onChange({target:{value:'2026-10-12'}});resolve(impact);await pending;
 assert.equal(c.button('Conferma importazione'),undefined);
});
