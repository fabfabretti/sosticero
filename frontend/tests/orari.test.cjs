const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function load(file, require) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require });
  return exports;
}
const timetables = load('src/timetables.ts');
const tooltip = load('src/Tooltip.tsx', id => {
  if (id === 'react') return { useRef: i => ({ current: i }), useState: i => [i, () => {}] };
  if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  throw Error(id);
});

// Run the real component with minimal hook storage and a fake api.
function component(file) {
  const slots = []; let cursor = 0; const effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; },
    useEffect(fn) { if (!effects.length) effects.push(fn); },
    useMemo(fn) { return fn(); },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = load(file, id => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === './timetables') return timetables;
    if (id === './Tooltip') return tooltip;
    throw Error(id);
  });
  return { render(props) {
    cursor = 0;
    const nodes = [];
    (function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); })(Object.values(exports)[0](props));
    return nodes;
  }, start() { effects.splice(0).forEach(fn => fn()); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

const orari = { effective: '2026-10-16', dataset: {
  teachers: { a: { id: 'a', name: 'Anna', code: 'ANN', classe_concorso: 'A041', cdcName: 'Scienze e tecnologie informatiche' }, b: { id: 'b', name: 'Bruno', code: 'BRU' } },
  lessons: {
    'a|lun|1': { classes: ['1A'], activities: [] },
    'b|lun|1': { classes: ['1A'], activities: [] },
    'a|mar|2': { classes: [], activities: ['POT'] },
  },
} };
const types = { types: { 'code:POT': { label: 'POT', color: 'amber', available: true, visible: true, school: true } } };

function screen() {
  const c = component('src/TeacherTimetables.tsx');
  const calls = [];
  const api = async url => { calls.push(url); return url === 'orari' ? orari : types; };
  const props = { api };
  return { c, calls, props, nodes: () => c.render(props) };
}
async function loaded() {
  const s = screen();
  s.c.render(s.props); s.c.start();
  await settle();
  return s;
}
const tables = s => s.nodes().filter(n => n.type === 'table');

test('renders one grid per teacher from the current version only', async () => {
  const s = await loaded();
  assert.deepEqual(s.calls, ['orari', 'hour-types'], 'fetches only the current timetable and hour types');
  assert.equal(tables(s).length, 2);
  assert.ok(s.nodes().some(n => n.props?.className === 'sub' && n.props.children === 'Orario dal 16/10/2026'), 'effective date is shown');
});

test('grids expose day and hour headers', async () => {
  const s = await loaded();
  const th = s.nodes().filter(n => n.type === 'th');
  assert.ok(th.some(n => n.props.scope === 'col' && n.props.children === 'Lun'));
  assert.ok(th.some(n => n.props.scope === 'row' && n.props.children === '1ª'));
  assert.ok(tables(s).some(n => n.props['aria-label'] === 'Orario di Anna'));
});

test('compresenza is a marker whose tooltip names the co-teachers', async () => {
  const s = await loaded();
  const tips = s.nodes().filter(n => n.type === tooltip.HourHelp);
  assert.deepEqual(tips.map(n => n.props.text).sort(), ['Anna', 'Bruno']);
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-partners'), 'the marker itself is shown');
});

test('each teacher shows the classe di concorso with its full name', async () => {
  const s = await loaded();
  const cdcs = s.nodes().filter(n => n.props?.className === 'orari-cdc');
  assert.deepEqual(cdcs.map(n => n.props.title), ['A041 · Scienze e tecnologie informatiche']);
});

test('an activity hour shows its code with the configured color', async () => {
  const s = await loaded();
  assert.ok(s.nodes().some(n => n.props?.className === 'type-chip palette-amber' && n.props.children === 'POT'));
});

test('the filter narrows by name or code and clears back to everyone', async () => {
  const s = await loaded();
  const box = v => s.nodes().find(n => n.props?.['aria-label'] === 'Cerca docente').props.onChange({ target: { value: v } });
  box('bruno'); assert.equal(tables(s).length, 1);
  box('ann'); assert.equal(tables(s).length, 1);
  assert.ok(s.nodes().some(n => n.props['aria-label'] === 'Orario di Anna'));
  box(''); assert.equal(tables(s).length, 2);
});
