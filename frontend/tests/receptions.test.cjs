const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function mount(api, confirm = () => true) {
  const slots = []; let cursor = 0;
  const state = initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => slots[index] = value]; };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/Receptions.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Uint8Array, btoa, window: { confirm }, require(id) {
      if (id === 'react') return { useState: state, useEffect() {}, useRef: initial => { const [value] = state({ current: initial }); return value; } };
      if (id === './StatsCalendar') return { todayInRome: () => '2026-10-12' };
      return { jsx, jsxs: jsx };
    },
  });
  const render = () => { cursor = 0; const nodes = []; (function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; nodes.push(node); walk(node.props?.children); })(exports.ReceptionImport({ api })); return nodes; };
  const button = label => render().find(node => node.type === 'button' && node.props.children === label);
  const file = () => render().find(node => node.props?.type === 'file').props.onChange({ target: { files: [{ name: 'ricevimenti.xlsx', size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }] } });
  return { render, button, file };
}
const impact = { token: 'token', effective: '2026-10-12', end: null, days: [], teachers: { one: 'Rossi Mario' }, ready: false,
  rows: [{ row: 2, name: 'Rossi', teacher: null, day: 'lun', hour: 4, time: '', location: '', site: null, skip: false, error: '', suggestions: ['one'] }] };

test('uncertain matches require selection and a refreshed preview before import', async () => {
  const calls = [];
  const screen = mount(async (url, data) => {
    calls.push([url, data]);
    if (url === 'receptions/preview') return { ...impact, ready: !!data.choices['2']?.teacher, rows: impact.rows.map(row => ({ ...row, ...data.choices['2'] })) };
    return { versions: [], backup: { filename: 'before.sqlite' } };
  });
  await screen.file(); await screen.button('Mostra anteprima ricevimenti').props.onClick();
  assert.equal(screen.button('Conferma ricevimenti').props.disabled, true);
  const search = screen.render().find(node => node.props?.['aria-label'] === 'Docente Riga 2 Rossi');
  search.props.onChange({ target: { value: 'Rossi Mario [one]', setCustomValidity() {} } });
  assert.equal(screen.button('Conferma ricevimenti').props.disabled, true);
  await screen.button('Mostra anteprima ricevimenti').props.onClick();
  assert.equal(screen.button('Conferma ricevimenti').props.disabled, false);
  await screen.button('Conferma ricevimenti').props.onClick();
  assert.equal(calls.find(([url]) => url === 'receptions' && calls.length)[1].choices['2'].teacher, 'one');
  assert.match(screen.render().find(node => node.props?.role === 'status').props.children, /before.sqlite/);
});

test('location edits, explicit skips, date changes and cancellation invalidate confirmation', async () => {
  const calls = [];
  const screen = mount(async (url, data) => { calls.push([url, data]); return { ...impact, ready: true }; }, () => false);
  await screen.file(); await screen.button('Mostra anteprima ricevimenti').props.onClick();
  screen.render().find(node => node.type === 'select').props.onChange({ target: { value: 'succursale' } });
  assert.equal(screen.button('Conferma ricevimenti').props.disabled, true);
  screen.render().find(node => node.props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  await screen.button('Mostra anteprima ricevimenti').props.onClick();
  assert.equal(calls.at(-1)[1].choices['2'].skip, true);
  assert.equal(calls.at(-1)[1].choices['2'].site, 'succursale');
  await screen.button('Conferma ricevimenti').props.onClick();
  assert.equal(calls.filter(([url]) => url === 'receptions').length, 0);
  screen.render().find(node => node.props?.type === 'date').props.onChange({ target: { value: '2026-11-02' } });
  assert.equal(screen.button('Conferma ricevimenti').props.disabled, true);
});

test('candidate drawer keeps uncertain reception adjacency outside the favorable group', () => {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync('src/CandidateDrawer.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require(id) { return id === 'react' ? { useEffect() {}, useRef: () => ({ current: null }) } : { jsx, jsxs: jsx }; },
  });
  const nodes = [];
  const candidate = { id: 'one', name: 'One', ty: 'RP', convenient: true, tag: 'Ora favorevole', classes: [] };
  (function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; nodes.push(node); walk(node.props?.children); })(exports.CandidateDrawer({
    open: { h: 3, c: '1A', ids: ['absent'], sede: 'centrale' }, cands: [candidate, { ...candidate, id: 'two', convenient: false, tag: 'Potenzialmente favorevole · sede da verificare' }, { ...candidate, id: 'three', convenient: false, why: 'Cambio sede senza intervallo', tag: 'Cambio sede senza intervallo' }], name: id => id, busy: false, onClose() {}, onAssign() {},
  }));
  assert.deepEqual(nodes.filter(node => node.type === 'h3').map(node => node.props.children), ['Recuperi permesso · ore favorevoli', 'Altri recuperi permesso']);
  assert.ok(nodes.some(node => node.props?.className === 'tag' && node.props.children.includes('Potenzialmente favorevole · sede da verificare')));
  assert.equal(nodes.filter(node => node.props?.className?.startsWith('c1')).at(-1).props.disabled, true);
});
