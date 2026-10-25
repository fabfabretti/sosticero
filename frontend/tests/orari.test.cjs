const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function load(file, require, confirm = () => true) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => id === './useQuietRefresh' ? {useQuietRefresh:(load,apply)=>({refresh:async()=>{const v=await load();apply(v);return v;},invalidate(){}})} : require(id), URLSearchParams, setTimeout, clearTimeout, requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {}, window: { confirm, scrollBy: options => scrollsForTest.push(options) }, document: { elementFromPoint: () => null } });
  return exports;
}
const exportsForTest = [], downloadsForTest = [];
const scrollsForTest = [];
const timetables = load('src/timetables.ts');
const tooltip = load('src/Tooltip.tsx', id => {
  if (id === 'react') return { useRef: i => ({ current: i }), useState: i => [i, () => {}] };
  if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  throw Error(id);
});

// Run the real component with minimal hook storage and a fake api.
function component(file, confirm) {
  const slots = []; let cursor = 0; const effects = [], layouts = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useEffect(fn) { if (!effects.length) effects.push(fn); },
    useLayoutEffect(fn) { layouts.push(fn); },
    useMemo(fn) { return fn(); },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = load(file, id => {
    if (id === './useQuietRefresh') return { useQuietRefresh: (load,apply) => ({ refresh:async()=>{const v=await load();apply(v);return v;},invalidate(){} }) };
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === './timetables') return timetables;
    if (id === './timetablePdf') return { projectTimetableExport: ds => { exportsForTest.push(ds); return ds; }, generateTimetablePdf: () => ({ save: filename => downloadsForTest.push(filename) }) };
    if (id === './Tooltip') return tooltip;
    throw Error(id);
  }, confirm);
  return { render(props) {
    cursor = 0;
    const nodes = [];
    (function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); })(exports.TeacherTimetables(props));
    layouts.splice(0).forEach(fn => fn());
    return nodes;
  }, start() { effects.splice(0).forEach(fn => fn()); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

const orari = { day: '2026-10-18', basis: 'basis', overrides: [], effective: '2026-10-16', dataset: {
  teachers: { a: { id: 'a', name: 'Anna', code: 'ANN', classe_concorso: 'A041', cdcName: 'Scienze e tecnologie informatiche' }, b: { id: 'b', name: 'Bruno', code: 'BRU' } },
  lessons: {
    'a|lun|1': { classes: ['1A'], activities: [], site: 'centrale' },
    'b|lun|1': { classes: ['1A'], activities: [] },
    'a|mar|2': { classes: [], activities: ['POT'], site: 'succursale' },
  },
} };
const types = { types: { 'code:POT': { label: 'POT', color: 'amber', available: true, visible: true, school: true } } };

function screen(handler, confirm) {
  const c = component('src/TeacherTimetables.tsx', confirm);
  const calls = [];
  const api = async (url, body) => { calls.push(url); return handler ? handler(url, body) : url.startsWith('orari?') ? orari : types; };
  const props = { api };
  return { c, calls, props, nodes: () => c.render(props) };
}
async function loaded(handler, confirm) {
  const s = screen(handler, confirm);
  s.c.render(s.props); s.c.start();
  await settle();
  return s;
}
const tables = s => s.nodes().filter(n => n.type === 'table');

test('edit transitions compensate the timetable position after controls resize', async () => {
  const s = await loaded();
  let top = 200;
  tables(s)[0].props.ref({ getBoundingClientRect: () => ({ top }) });
  s.nodes().find(n => n.type === 'button' && n.props['aria-label'] === 'Modifica orario di Anna').props.onClick();
  top = 420;
  s.nodes();
  assert.equal(scrollsForTest.at(-1).top, 220);
  assert.equal(scrollsForTest.at(-1).behavior, 'instant');
  s.nodes().find(n => n.type === 'button' && n.props.children === 'Annulla').props.onClick();
  top = 200;
  s.nodes();
  assert.equal(scrollsForTest.at(-1).top, -220);
});

test('receptions overlay lessons with details and survive teaching edit mode', async () => {
  const data = { ...orari, dataset: { ...orari.dataset, receptions: [
    { teacher: 'a', day: 'lun', hour: 1, time: '08:00 - 08:35', site: null, location: 'a distanza' },
    { teacher: 'a', day: 'mer', hour: 4, time: '', site: 'centrale', location: '' },
  ] } };
  const s = await loaded(async url => url.startsWith('orari?') ? data : types);
  const tips = () => s.nodes().filter(n => n.type === tooltip.HourHelp && n.props.text.startsWith('Ricevimento'));
  assert.equal(tips().length, 2);
  assert.match(tips()[0].props.text, /Sede da verificare.*a distanza.*Sovrapposizione/);
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-session-label' && n.props.children === '1A'));
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  assert.equal(tips().length, 2);
});

test('renders one grid per teacher from the current version only', async () => {
  const s = await loaded();
  assert.equal(s.calls.length, 1); assert.ok(s.calls[0].startsWith('orari?day='));
  assert.equal(tables(s).length, 2);
  assert.ok(s.nodes().some(n => n.props?.className === 'sub' && n.props.children === 'Orario dal 16/10/2026'), 'effective date is shown');
});

test('grids expose day and hour headers', async () => {
  const s = await loaded();
  const th = s.nodes().filter(n => n.type === 'th');
  assert.ok(th.some(n => n.props.scope === 'col' && n.props.children === 'Lun'));
  assert.ok(th.some(n => n.props.scope === 'row' && Array.isArray(n.props.children) && n.props.children.join('') === '1ª'));
  assert.ok(tables(s).some(n => n.props['aria-label'] === 'Orario di Anna'));
});

test('compresenza is a marker whose tooltip names the co-teachers', async () => {
  const s = await loaded();
  const tips = s.nodes().filter(n => n.type === tooltip.HourHelp);
  assert.deepEqual(tips.map(n => n.props.text).sort(), ['Compresenza: Anna', 'Compresenza: Bruno']);
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-partners'), 'the marker itself is shown');
});

test('each teacher shows the classe di concorso with its full name', async () => {
  const s = await loaded();
  const cdcs = s.nodes().filter(n => n.props?.className === 'orari-cdc');
  assert.deepEqual(cdcs.map(n => n.props.title), ['A041 · Scienze e tecnologie informatiche']);
});

test('an activity hour shows its code with campus fill', async () => {
  const s = await loaded();
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-session campus-succursale orari-special'));
});

test('the filter narrows by name or code and clears back to everyone', async () => {
  const s = await loaded();
  const box = v => s.nodes().find(n => n.props?.['aria-label'] === 'Cerca docente').props.onChange({ target: { value: v } });
  box('bruno'); assert.equal(tables(s).length, 1);
  box('ann'); assert.equal(tables(s).length, 1);
  assert.ok(s.nodes().some(n => n.props['aria-label'] === 'Orario di Anna'));
  box(''); assert.equal(tables(s).length, 2);
});

test('lesson and activity cells show their campus, with an explicit unknown fallback', async () => {
  const s = await loaded();
  const labels = s.nodes().filter(n => n.props?.className?.split(' ').includes('orari-site')).map(n => n.props.children);
  assert.deepEqual(labels, ['C', 'S', '?']);
  assert.deepEqual(s.nodes().filter(n => n.props?.className?.split(' ').includes('orari-site')).map(n => n.props.title), ['Centrale', 'Succursale', 'Sede ignota']);
});

test('compresenza tooltip wraps all session content in the cell', async () => {
  const s = await loaded();
  const cells = s.nodes().filter(n => n.type === 'td' && n.props.className?.includes('orari-shared'));
  assert.equal(cells.length, 2);
  for (const cell of cells) {
    const help = Array.isArray(cell.props.children) ? cell.props.children.at(-1) : cell.props.children;
    assert.equal(help.type, tooltip.HourHelp);
    const content = help.props.children.props.children;
    assert.ok(content[0].props.className.startsWith('orari-session'));
    const session = content[0];
    const meta = session.props.children[1];
    assert.equal(meta.props.children[0].props.children, 'Comp.');
  }
});

test('campus chips expose separate color hooks', async () => {
  const s = await loaded();
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-session campus-centrale'));
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-session campus-succursale orari-special'));
});

const helpers = load('src/TeacherTimetables.tsx', id => {
  if (id === 'react') return {};
  if (id === './timetables') return timetables;
  if (id === './timetablePdf') return { projectTimetableExport: ds => { exportsForTest.push(ds); return ds; }, generateTimetablePdf: () => ({ save: filename => downloadsForTest.push(filename) }) };
  if (id === './Tooltip') return tooltip;
  if (id === 'react/jsx-runtime') return {};
  throw Error(id);
});
test('special moves and swaps preserve campus and disabled status and reject ordinary lessons', () => {
  const pot = { classes: [], activities: ['POT'], site: 'centrale', disabled: true };
  const staff = { classes: [], activities: ['STAFF'], site: 'succursale' };
  const cells = { a: pot, b: staff, c: null, d: { classes: ['1A'] } };
  const swapped = helpers.moveHour(cells, 'a', 'b');
  assert.equal(swapped.a, staff); assert.equal(swapped.b, pot);
  const moved = helpers.moveHour(cells, 'a', 'c');
  assert.equal(moved.a, null); assert.equal(moved.c, pot);
  assert.equal(helpers.moveHour(cells, 'a', 'd'), cells);
  assert.equal(helpers.moveHour(cells, 'd', 'c'), cells);
  assert.equal(helpers.moveHour(cells, 'a', 'missing'), cells);
  assert.equal(helpers.editableHour({ classes: ['1A'], activities: ['POT'] }), false);
});
test('override precedence includes end date and reset suppresses earlier history', () => {
  const records = [
    { teacher: 'a', start: '2026-10-01', end: null, groups: [1] },
    { teacher: 'a', start: '2026-10-12', end: '2026-10-16', groups: [2] },
    { teacher: 'a', start: '2026-10-19', end: null, reset: true, groups: [] },
  ];
  assert.equal(helpers.activeOverride(records, 'a', '2026-10-16').groups[0], 2);
  assert.equal(helpers.activeOverride(records, 'a', '2026-10-17').groups[0], 1);
  assert.equal(helpers.activeOverride(records, 'a', '2026-10-20').reset, true);
});
test('editor offers accessible movement, date boundaries and cancel without writes', async () => {
  const s = await loaded();
  const exportHint = () => s.nodes().find(n => n.type === 'span' && n.props.children === 'Salva o annulla le modifiche prima di esportare.');
  assert.ok(exportHint());
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  assert.ok(exportHint());
  const labels = s.nodes().filter(n => n.type === 'label');
  assert.ok(labels.some(n => n.props.children?.[0] === 'Dal'));
  assert.ok(!s.nodes().some(n => n.props?.children === 'Sposta'));
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-edit-toolbar'));
  assert.ok(s.nodes().some(n => n.props?.children === 'Salva'));
  assert.equal(s.nodes().find(n => n.type === 'button' && n.props?.['aria-label'] === 'Modifica orario di Anna').props.disabled, true);
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Disabilita Mar 2ª POT'));
  s.nodes().find(n => n.type === 'button' && n.props.children === 'Annulla').props.onClick();
  assert.equal(s.nodes().find(n => n.type === 'button' && n.props?.['aria-label'] === 'Modifica orario di Anna').props.disabled, false);
  assert.equal(s.calls.length, 1);
});

test('changing the start date of an untouched draft needs no confirmation', async () => {
  const prompts = [];
  const s = await loaded(undefined, message => { prompts.push(message); return false; });
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  const start = s.nodes().find(n => n.type === 'input' && n.props.required);
  await start.props.onChange({ target: { value: '2026-10-19' } });
  assert.deepEqual(prompts, []);
  assert.ok(s.calls.some(url => url === 'orari?day=2026-10-19'));
  assert.equal(s.nodes().find(n => n.type === 'input' && n.props.required).props.value, '2026-10-19');
});

test('changing the start date asks only when the draft has unsaved edits', async () => {
  const prompts = [];
  const s = await loaded(undefined, message => { prompts.push(message); return false; });
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Disabilita Mar 2ª POT').props.onClick();
  const start = s.nodes().find(n => n.type === 'input' && n.props.required);
  const anotherDate = start.props.value === '2026-10-19' ? '2026-10-20' : '2026-10-19';
  await start.props.onChange({ target: { value: anotherDate } });
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /modifiche non salvate/);
  assert.equal(s.calls.length, 1);
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Riattiva Mar 2ª POT'));
});

test('failed save preserves the edited draft and clears stale preview', async () => {
  let previewBody;
  const s = await loaded(async (url, body) => {
    if (url.startsWith('orari?')) return orari;
    if (url === 'orari/preview') { previewBody = body; return { token: 't', days: [] }; }
    throw Error('Anteprima scaduta');
  });
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Disabilita Mar 2ª POT').props.onClick();
  await s.nodes().find(n => n.type === 'button' && n.props.children === 'Salva').props.onClick();
  assert.equal(previewBody.cells['mar|2'].disabled, true);
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Riattiva Mar 2ª POT'));
  assert.ok(s.nodes().some(n => n.props?.role === 'alert' && n.props.children.includes('scaduta')));
  assert.ok(!s.nodes().some(n => n.props?.children === 'Conferma e salva'));
});
test('drag shows a floating preview without disabling and keyboard movement remains available', async () => {
  const s = await loaded();
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  const b = s.nodes().find(n => n.props?.['aria-label'] === 'Modifica POT Mar 2ª POT');
  b.props.onPointerDown({ button: 0, clientX: 0, clientY: 0, pointerId: 1, currentTarget: { setPointerCapture() {} } });
  b.props.onPointerMove({ clientX: 20, clientY: 20, preventDefault() {} });
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-drag-preview'));
  b.props.onClick();
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Disabilita Mar 2ª POT' && n.props['aria-pressed'] === false));
  b.props.onPointerUp({ clientX: 20, clientY: 20 }); await new Promise(r => setTimeout(r, 1));
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica POT Mar 2ª POT').props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {} });
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Disabilita Mar 3ª POT'));
});

test('legend names campuses and saving requests confirmation only for affected assignments', async () => {
  const calls = [];
  const s = await loaded(async (url, body) => {
    calls.push(url);
    if (url.startsWith('orari?')) return orari;
    if (url === 'orari/preview') return { token: 't', days: [{ day: '2026-10-19', assignments: ['a|2|1A'], issues: [{ key: 'a|2|1A', message: 'Ora disabilitata' }] }] };
    return { ok: true };
  });
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Legenda sedi'));
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  await s.nodes().find(n => n.type === 'button' && n.props.children === 'Salva').props.onClick();
  assert.ok(!calls.includes('orari/override'));
  await s.nodes().find(n => n.type === 'button' && n.props.children === 'Conferma e salva').props.onClick();
  assert.ok(calls.includes('orari/override'));
});

test('unaffected saved assignments do not interrupt saving or display a list of days', async () => {
  const calls = [];
  const s = await loaded(async url => {
    calls.push(url);
    if (url.startsWith('orari?')) return orari;
    if (url === 'orari/preview') return { token: 't', days: Array.from({ length: 20 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, assignments: ['a|2|1A'], issues: [] })) };
    return { ok: true };
  });
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  await s.nodes().find(n => n.type === 'button' && n.props.children === 'Salva').props.onClick();
  assert.ok(calls.includes('orari/override'));
  assert.ok(!s.nodes().some(n => n.props?.['aria-label'] === 'Conferma modifica'));
});

test('a saved override can be deleted without creating a reset', async () => {
  const record = { id: 'revision', teacher: 'a', start: '2026-10-12', end: null, reset: false, groups: [{ before: {}, after: {}, conflicts: [] }] };
  let current = { ...orari, overrides: [record] };
  const calls = [];
  const s = await loaded(async (url, body) => {
    calls.push([url, body]);
    if (url.startsWith('orari?')) return current;
    if (url === 'orari/preview') return { token: 'delete-token', days: [] };
    current = { ...current, overrides: [] };
    return { ok: true };
  });
  const header = s.nodes().find(n => n.props?.className === 'orari-card-actions');
  assert.ok(!header.props.children.some(child => child?.props?.children === 'Elimina'));
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-history'));
  await s.nodes().find(n => n.props?.['aria-label'] === 'Elimina modifica di Anna dal 12/10/2026').props.onClick();
  assert.equal(calls[1][0], 'orari/preview');
  assert.equal(JSON.stringify(calls[1][1]), JSON.stringify({ delete: true, id: 'revision', teacher: 'a', start: '2026-10-12', basis: 'basis' }));
  assert.equal(calls[2][0], 'orari/override');
  assert.equal(calls[2][1].token, 'delete-token');
  assert.ok(!s.nodes().some(n => n.props?.className === 'orari-history'));
});

test('deleting an override shows only new assignment problems before confirmation', async () => {
  const record = { id: 'reset', teacher: 'a', start: '2026-10-19', end: null, reset: true, groups: [] };
  const calls = [];
  const s = await loaded(async (url, body) => {
    calls.push([url, body]);
    if (url.startsWith('orari?')) return { ...orari, overrides: [record] };
    if (url === 'orari/preview') return { token: 'delete-token', days: [{ day: '2026-10-19', assignments: ['a|2|1A'], issues: [{ key: 'a|2|1A', message: 'Ora disabilitata' }] }] };
    return { ok: true };
  });
  await s.nodes().find(n => n.props?.['aria-label'] === 'Elimina modifica di Anna dal 19/10/2026').props.onClick();
  assert.ok(!calls.some(([url]) => url === 'orari/override'));
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Conferma eliminazione'));
  await s.nodes().find(n => n.props?.children === 'Conferma ed elimina').props.onClick();
  assert.ok(calls.some(([url, body]) => url === 'orari/override' && body.token === 'delete-token'));
});

test('name editor saves explicit names, searches imported aliases and removes without timetable writes', async () => {
  let current = structuredClone(orari);
  current.dataset.teachers.a.name = 'Binotto Rosaria (Cavallaro)';
  const writes = [];
  const s = await loaded(async (url, body) => {
    if (url.startsWith('orari?')) return current;
    writes.push([url, body]);
    assert.equal(url, 'orari/name');
    const t = current.dataset.teachers.a;
    if (body.value) {
      t.importedName = 'Binotto Rosaria (Cavallaro)'; t.nameOverride = body.value;
      t.name = `${body.value.name} (${body.value.originalName})`;
    } else { t.name = t.importedName; delete t.importedName; delete t.nameOverride; }
    return { ok: true };
  });
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica nome di Binotto Rosaria (Cavallaro)').props.onClick();
  let inputs = s.nodes().filter(n => n.type === 'input' && n.props.maxLength === 200);
  inputs[0].props.onChange({ target: { value: 'Binotto Steven' } });
  inputs = s.nodes().filter(n => n.type === 'input' && n.props.maxLength === 200);
  inputs[1].props.onChange({ target: { value: 'Cavallaro' } });
  await s.nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await settle();
  assert.equal(writes[0][1].previous, null);
  assert.equal(writes[0][1].value.name, 'Binotto Steven');
  assert.ok(s.nodes().some(n => n.type === 'del' && n.props.children === 'Binotto Rosaria (Cavallaro)'));
  const search = s.nodes().find(n => n.props?.type === 'search');
  for (const value of ['Steven', 'Cavallaro', 'Rosaria']) {
    search.props.onChange({ target: { value } });
    assert.equal(tables(s).length, 1);
  }
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica nome di Binotto Steven (Cavallaro)').props.onClick();
  await s.nodes().find(n => n.type === 'button' && n.props.children === 'Rimuovi nome personalizzato').props.onClick();
  assert.equal(writes[1][1].value, null);
  assert.equal(writes[1][1].previous.originalName, 'Cavallaro');
  assert.ok(!s.nodes().some(n => n.type === 'del'));
});

test('canceling a name draft never writes and errors preserve its fields', async () => {
  const s = await loaded(async url => {
    if (url.startsWith('orari?')) return orari;
    throw Error('Nome modificato da un altro utente');
  });
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica nome di Anna').props.onClick();
  assert.ok(s.nodes().some(n => n.props?.className === 'sub' && n.props.children.includes('Permessi e recuperi')));
  s.nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await settle();
  assert.ok(s.nodes().some(n => n.props?.role === 'alert'));
  assert.ok(s.nodes().some(n => n.type === 'form'));
  s.nodes().find(n => n.type === 'button' && n.props.children === 'Annulla').props.onClick();
  assert.ok(!s.nodes().some(n => n.type === 'form'));
  assert.equal(s.calls.filter(u => u === 'orari/override').length, 0);
});

test('POT click and double click edit class and campus without toggling availability', async () => {
  const s = await loaded();
  assert.ok(!s.nodes().some(n => n.props?.onDoubleClick));
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Disabilita Mar 2ª POT').props.onClick();
  let pot = s.nodes().find(n => n.props?.['aria-label'] === 'Modifica POT Mar 2ª POT');
  pot.props.onClick(); pot.props.onClick(); pot.props.onDoubleClick();
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Riattiva Mar 2ª POT'));
  s.nodes().find(n => n.props?.['aria-label'] === 'Classe POT').props.onChange({ target: { value: '1A' } });
  s.nodes().find(n => n.props?.role === 'option' && n.props.children[0] === '1A').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Annulla modifica attività').props.onClick();
  pot.props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Classe POT').props.onChange({ target: { value: '1A' } });
  s.nodes().find(n => n.props?.role === 'option' && n.props.children[0] === '1A').props.onClick();
  s.nodes().find(n => n.type === 'button' && n.props.children === 'Centrale').props.onClick();
  s.nodes().find(n => n.props?.children === 'Applica').props.onClick();
  pot = s.nodes().find(n => n.props?.['aria-label'] === 'Modifica POT Mar 2ª 1A · POT');
  assert.ok(pot);
  assert.ok(s.nodes().some(n => n.props?.title === '1A · POT · Centrale'));
  pot.props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {} });
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Modifica POT Mar 3ª 1A · POT'));
  s.nodes().find(n => n.props?.['aria-label'] === 'Riattiva Mar 3ª 1A · POT').props.onClick();
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Disabilita Mar 3ª POT'));
});

test('future overrides are expanded and removable while editing', async () => {
  const record = { id: 'future', teacher: 'a', start: '2099-10-19', end: null, reset: false, groups: [{}] };
  let current = { ...orari, overrides: [record] };
  const writes = [];
  const s = await loaded(async (url, body) => {
    if (url.startsWith('orari?')) return current;
    writes.push([url, body]);
    if (url === 'orari/preview') return { token: 'future-delete', days: [] };
    current = { ...current, overrides: [] }; return { ok: true };
  });
  assert.equal(s.nodes().find(n => n.props?.className === 'orari-history').props.open, true);
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  assert.ok(s.nodes().some(n => n.props?.className === 'orari-history'));
  await s.nodes().find(n => n.props?.['aria-label'] === 'Elimina modifica di Anna dal 19/10/2099').props.onClick();
  assert.equal(writes[1][1].token, 'future-delete');
  assert.ok(!s.nodes().some(n => n.props?.className === 'orari-history'));
});

for (const code of ['ALF', 'PE', 'RIT', 'DIS']) test(`${code} uses the class and campus editor on click and double click in edit mode`, async () => {
  const alf = structuredClone(orari);
  alf.dataset.lessons['a|mar|2'].activities = [code];
  const s = await loaded(async () => alf);
  assert.ok(!s.nodes().some(n => n.props?.onDoubleClick));
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === `Disabilita Mar 2ª ${code}`).props.onClick();
  const cell = s.nodes().find(n => n.props?.['aria-label'] === `Modifica ${code} Mar 2ª ${code}`);
  cell.props.onClick(); cell.props.onClick(); cell.props.onDoubleClick();
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === `Riattiva Mar 2ª ${code}`));
  s.nodes().find(n => n.props?.['aria-label'] === `Classe ${code}`).props.onChange({ target: { value: '1A' } });
  s.nodes().find(n => n.props?.role === 'option' && n.props.children[0] === '1A').props.onClick();
  s.nodes().find(n => n.type === 'button' && n.props.children === 'Centrale').props.onClick();
  s.nodes().find(n => n.props?.children === 'Applica').props.onClick();
  assert.ok(s.nodes().some(n => n.props?.title === `1A · ${code} · Centrale`));
  s.nodes().find(n => n.props?.['aria-label'] === `Riattiva Mar 2ª 1A · ${code}`).props.onClick();
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === `Disabilita Mar 2ª ${code}`));
});


test('activity editor stays outside the grid with keyboard class suggestions and three campus buttons', async () => {
  const s = await loaded();
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Disabilita Mar 2ª POT').props.onClick();
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica POT Mar 2ª POT').props.onClick();
  assert.ok(s.nodes().some(n => n.type === 'dialog'));
  function hasDialog(n) { if (!n || typeof n !== 'object') return false; if (Array.isArray(n)) return n.some(hasDialog); return n.type === 'dialog' || hasDialog(n.props?.children); }
  assert.ok(s.nodes().filter(n => n.type === 'td').every(n => !hasDialog(n)));
  assert.ok(!s.nodes().some(n => n.type === 'select'));
  const campus = () => s.nodes().filter(n => n.type === 'button' && ['Centrale', 'Staccata', 'Non indicata'].includes(n.props.children));
  assert.equal(campus().length, 3);
  assert.equal(campus().filter(n => n.props['aria-pressed']).length, 1);
  campus().find(n => n.props.children === 'Non indicata').props.onClick();
  assert.equal(campus().filter(n => n.props['aria-pressed']).length, 1);
  assert.equal(campus().find(n => n.props.children === 'Non indicata').props['aria-pressed'], true);
  s.nodes().find(n => n.props?.['aria-label'] === 'Classe POT').props.onChange({ target: { value: '1' } });
  assert.equal(s.nodes().find(n => n.props?.children === 'Applica').props.disabled, true);
  s.nodes().find(n => n.props?.['aria-label'] === 'Classe POT').props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(s.nodes().find(n => n.props?.['aria-label'] === 'Classe POT').props.value, '1A');
  s.nodes().find(n => n.type === 'dialog').props.onCancel();
  assert.ok(!s.nodes().some(n => n.type === 'dialog'));
  assert.ok(s.nodes().some(n => n.props?.['aria-label'] === 'Modifica POT Mar 2ª POT'));
  assert.equal(s.calls.length, 1);
});

test('teachers with only receptions still get a timetable and R markers', async () => {
  const data = { ...orari, dataset: { ...orari.dataset,
    teachers: { ...orari.dataset.teachers, only: { id: 'only', name: 'Only receptions' } },
    receptions: [{ teacher: 'only', day: 'ven', hour: 3, time: '10:00', site: null, location: '' }],
  } };
  const s = await loaded(async () => data);
  assert.ok(tables(s).some(node => node.props['aria-label'] === 'Orario di Only receptions'));
  assert.equal(s.nodes().filter(node => node.type === tooltip.HourHelp && node.props.text.startsWith('Ricevimento')).length, 1);
});

 test('PDF exports all saved teachers despite search and blocks unsaved drafts', async () => {
  const current = { ...orari, day: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date()) };
  const s = await loaded(async () => current);
  s.nodes().find(n => n.props?.['aria-label'] === 'Cerca docente').props.onChange({ target: { value: 'Anna' } });
  const button = () => s.nodes().find(n => n.type === 'button' && n.props.children === 'Scarica PDF completo');
  button().props.onClick();
  assert.equal(exportsForTest.at(-1), orari.dataset);
  assert.equal(downloadsForTest.at(-1), `orari-${current.day}.pdf`);
  s.nodes().find(n => n.props?.['aria-label'] === 'Modifica orario di Anna').props.onClick();
  assert.equal(button().props.disabled, true);
 });

 test('PDF is disabled before loading, on empty schedules and during name edits', async () => {
  const s = screen();
  const button = () => s.nodes().find(n => n.type === 'button' && n.props.children === 'Scarica PDF completo');
  assert.equal(button().props.disabled, true);
  const current = { ...orari, day: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date()) };
  const loadedScreen = await loaded(async () => current);
  loadedScreen.nodes().find(n => n.props?.['aria-label'] === 'Modifica nome di Anna').props.onClick();
  assert.equal(loadedScreen.nodes().find(n => n.type === 'button' && n.props.children === 'Scarica PDF completo').props.disabled, true);
  const empty = await loaded(async () => ({ ...current, dataset: { teachers: {}, lessons: {} } }));
  assert.equal(empty.nodes().find(n => n.type === 'button' && n.props.children === 'Scarica PDF completo').props.disabled, true);
 });
