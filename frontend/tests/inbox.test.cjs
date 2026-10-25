const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const settle = () => new Promise(resolve => setImmediate(resolve));

let chimes = 0;
class FakeAudioContext {
  state = 'running'; currentTime = 0; destination = {};
  createOscillator() { return { frequency: {}, connect() {}, disconnect() {}, start() { chimes++; }, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  close() { return Promise.resolve(); }
}

function harness(component, responses = {}, notify = false) {
  const slots = [], effects = [], timers = [], calls = [], listeners = new Map();
  let index = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = index++; if (!(i in slots) || deps.some((d, j) => d !== slots[i][j])) effects.push(fn); slots[i] = deps; },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const api = async (url, body) => { calls.push({ url, body }); const value = responses[url]; if (value instanceof Error) throw value; return typeof value === 'function' ? value(body) : value; };
  const window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), dispatchEvent: event => listeners.get(event.type)?.() };
  runInNewContext(ts.transpileModule(readFileSync('src/Inbox.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Map, Date, Event, CustomEvent, AudioContext: FakeAudioContext, window, document:{documentElement:{dataset:{}}},
    setInterval: fn => timers.push(fn), clearInterval() {},
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({}) }; },
    require: id => id === './useQuietRefresh' ? {useQuietRefresh:(load,apply)=>({refresh:async()=>apply(await load()),invalidate(){}})} : id === './session' ? {sessionFetch:async (url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=>'7'},json:async()=>({version:'uploaded-version'})};}} : id === 'react' ? react : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : { Link: 'a' },
  });
  const render = () => {
    index = 0;
    const nodes = [];
    function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; nodes.push(node); walk(node.props?.children); }
    walk(exports[component](component === 'useInboxStatus' ? api : { api }, notify)); effects.splice(0).forEach(fn => fn()); return nodes;
  };
  return { render, calls, timers, exports, responses, listeners, status: () => slots[0] };
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node ? text(node.props?.children) : '';
const button = (h, label) => h.render().find(n => n.type === 'button' && text(n) === label);

test('Settings uploads raw key, saves source and reports connection failures without echoing secrets', async () => {
  const h = harness('SheetsSettings', { 'inbox/connection': { configured: true, email: 'reader@project.iam.gserviceaccount.com' }, 'inbox/test': new Error('Accesso negato') });
  h.render(); await settle();
  const file = { size: 100, name: 'private.json' };
  h.render().find(n => n.props?.type === 'file').props.onChange({ target: { files: [file] } });
  await h.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await settle();
  const upload = h.calls.find(c => c.url === '/api/inbox/credentials');
  assert.equal(upload.options.body, file);
  assert.ok(h.calls.some(c => c.url === 'inbox/connection' && c.body?.worksheet === 'Risposte del modulo 1'));
  assert.equal(h.calls.find(c => c.url === 'inbox/connection' && c.body)?.body.expected, 'uploaded-version');
  assert.ok(!text(h.render()).includes('private_key'));
  button(h, 'Test connessione salvata').props.onClick(); await settle();
  assert.ok(h.render().some(n => n.props?.role === 'alert' && text(n).includes('Accesso negato')));
});

test('Inbox blocks invalid acceptance, resolves teacher, accepts and exposes history', async () => {
  const item = { id: 'one', raw: ['16/10/2026', 'daily', 'Unknown'], status: 'pending', name: 'Unknown', error: 'Seleziona docente', teachers: [{ id: 'a', name: 'Anna' }], days: ['2026-10-19'], hours: [1] };
  const h = harness('AbsenceInbox', {
    'inbox/summary': { pending: 1, configured: true }, 'inbox?history=false': [item], 'inbox?history=true': [],
    'inbox/one/preview': { ...item, teacher: 'a', error: '' }, 'inbox/one/accept': { ok: true },
  });
  h.render(); await settle();
  assert.equal(button(h, 'Accetta').props.disabled, true);
  h.render().find(n => n.type === 'select').props.onChange({ target: { value: 'a' } }); await settle();
  assert.equal(button(h, 'Accetta').props.disabled, false);
  h.responses['inbox?history=false'] = [];
  button(h, 'Accetta').props.onClick(); await settle();
  assert.equal(h.calls.find(c => c.url === 'inbox/one/accept').body.teacher, 'a');
  button(h, 'Cronologia').props.onClick(); h.render(); await settle();
  assert.ok(h.calls.some(c => c.url === 'inbox?history=true'));
});

test('Summary polling announces contextual counts without navigation or form data requests', async () => {
  const h = harness('useInboxStatus', { 'inbox/summary': { pending: 2, configured: true } });
  h.render(); await settle();
  h.timers[0](); await settle();
  assert.deepEqual(h.calls.map(c => c.url), ['inbox/summary', 'inbox/summary']);
  const notice = h.exports.InboxNotice({ count: 2 });
  assert.equal(notice.props.role, 'status');
  assert.equal(notice.props['aria-atomic'], 'true');
  assert.ok(text(notice).includes('2 comunicazioni da esaminare'));
  assert.equal(h.exports.InboxNotice({ count: 0 }).props.children, false);
});

test('Inbox rows show compact dates and selected Supplenze-style hour chips', async () => {
  const base = { raw: [], status: 'pending', name: 'Anna', error: '', teacher: 'a', teachers: [{id:'a',name:'Anna'}], days:['2026-10-19'], hours:[1,2,3,4,5,6,7], start:'2026-10-19', end:'2026-10-19' };
  const h = harness('AbsenceInbox', { 'inbox/summary': {pending:3,configured:true}, 'inbox?history=false': [
    {...base,id:'day'}, {...base,id:'range',end:'2026-10-23'}, {...base,id:'hour',case:'Assenza (da NON recuperare) su ALCUNE ORE di un giorno',hours:[1,3]},
  ]});
  h.render(); await settle();
  const nodes = h.render();
  const labels = nodes.filter(n => n.props?.className === 'inbox-absence').map(text);
  assert.equal(labels[0], 'Assenza 19/10/2026');
  assert.equal(labels[1], 'Assenza 19/10/2026 – 23/10/2026');
  assert.equal(nodes.filter(n => n.props?.className === 'hrs inbox-hours').length, 1);
  assert.deepEqual(nodes.filter(n => n.type === 'span' && n.props.className === 'on').map(text), ['1','3']);
  assert.equal(nodes.filter(n => n.type === 'select').length, 0);
  assert.equal(nodes.filter(n => n.type === 'details' && n.props.open).length, 0);
});


test('Matched names lead each row; only unknown or ambiguous names offer reassignment; time is the form timestamp', async () => {
  const base = { raw: ['16/10/2026 10.10.54'], submitted:'2026-10-16T10:10:54+02:00', status:'pending', error:'', start:'2026-10-19', end:'2026-10-19', hours:[1], teachers:[{id:'a',name:'Anna'}] };
  const h = harness('AbsenceInbox', {'inbox/summary':{pending:3,configured:true}, 'inbox?history=false':[
    {...base,id:'match',name:'Anna',teacher:'a'}, {...base,id:'unknown',name:'Anan',error:'Seleziona docente'},
    {...base,id:'ambiguous',name:'Anna',error:'Seleziona docente',teachers:[{id:'a',name:'Anna'},{id:'b',name:'Anna'}]},
  ]});
  h.render(); await settle();
  const nodes = h.render();
  const rows = nodes.filter(n=>n.type==='article');
  assert.equal(rows[0].props.children[0].props.className, 'inbox-person');
  assert.equal(nodes.filter(n=>n.type==='select').length, 2);
  assert.deepEqual(nodes.filter(n=>n.type==='time').map(text), Array(3).fill('16/10/2026 10.10.54'));
  assert.ok(text(rows[1].props.children[0]).startsWith('Anan→'));
});


test('List count broadcasts immediately and stale in-flight summaries cannot overwrite it', async () => {
  const pending = [];
  const h = harness('useInboxStatus', {'inbox/summary': () => new Promise(resolve => pending.push(resolve))});
  h.render();
  h.listeners.get('inbox-changed')(new CustomEvent('inbox-changed', {detail:{pending:3}}));
  assert.equal(h.status().pending, 3);
  pending.shift()({pending:0,received:0,configured:true}); await settle();
  assert.equal(h.status().pending, 3);
  assert.equal(pending.length, 1, 'a fresh summary is queued after the stale request');
  pending.shift()({pending:3,received:3,configured:true}); await settle();
  assert.equal(h.status().pending, 3);
});

test('Only the global notifier chimes for new submissions, not initial load or acceptance', async () => {
  chimes = 0;
  const h = harness('useInboxStatus', {'inbox/summary':{pending:2,received:5,configured:true}}, true);
  h.render(); await settle();
  assert.equal(chimes, 0);
  h.listeners.get('pointerdown')();
  h.responses['inbox/summary'] = {pending:2,received:6,configured:true};
  h.timers[0](); await settle();
  assert.equal(chimes, 1, 'new submission chimes even when the pending count is unchanged');
  h.timers[0](); await settle();
  h.responses['inbox/summary'] = {pending:1,received:6,configured:true};
  h.timers[0](); await settle();
  assert.equal(chimes, 1);
  const passive = harness('useInboxStatus', {'inbox/summary':{pending:1,received:6,configured:true}});
  passive.render(); await settle();
  assert.equal(passive.listeners.has('pointerdown'), false);
});

test('alias matches use the server resolution and display the current name without a selector', async () => {
  const h = harness('AbsenceInbox', { 'inbox/summary': {pending:1,configured:true}, 'inbox?history=false': [{
    id: 'alias', raw: ['', '', 'Savelli'], status: 'pending', error: '', name: 'Savelli',
    teacher: 'a', nameMatched: true, teacherName: 'Spillari Davide (Savelli)',
    teachers: [{id:'a',name:'Spillari Davide (Savelli)'}], start:'2026-10-19', end:'2026-10-19', hours:[1],
  }] });
  h.render(); await settle();
  assert.equal(h.render().filter(n => n.type === 'select').length, 0);
  assert.ok(text(h.render()).includes('Spillari Davide (Savelli)'));
  assert.equal(button(h, 'Accetta').props.disabled, false);
});


test('Inbox keeps optional absence details through polling and submits them on acceptance', async () => {
  const item = {id:'one',raw:[],status:'pending',error:'',teacher:'a',nameMatched:true};
  const h = harness('AbsenceInbox', {'inbox/summary':{pending:1,configured:true},'inbox?history=false':[item],'inbox/one/accept':{ok:true}});
  h.render(); await settle();
  h.render().find(n => n.type === 'textarea').props.onChange({target:{value:'Trip notes'}});
  const controls = h.render().filter(n => typeof n.props?.onChange === 'function' && n.type !== 'textarea');
  controls.find(n => n.props.value === null).props.onChange('trip');
  controls.find(n => n.props.value === undefined).props.onChange({mediaType:'image/png',data:'example'});
  h.timers.forEach(fn => fn()); await settle();
  button(h, 'Accetta').props.onClick(); await settle();
  const body = h.calls.find(c => c.url === 'inbox/one/accept').body;
  assert.equal(body.classification, 'trip');
  assert.equal(body.note, 'Trip notes');
  assert.equal(body.attachment.data, 'example');
});
