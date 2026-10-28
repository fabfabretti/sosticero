const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function load(file, imports = {}, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: id => id === './session' ? {sessionFetch:(...args)=>globals.fetch(...args)} : imports[id], URLSearchParams, ...globals });
  return exports;
}
const reporting = load('src/stats-report.ts');
const teachers = [
  { id: 'a', name: 'Alfa', activities: ['POT'], sites: ['centrale'] },
  { id: 'b', name: 'Beta', activities: ['DI.S'], sites: ['centrale'] },
];
const rp = { id: 'c', name: 'Gamma', activities: ['RP'], sites: ['centrale', 'succursale'] };
const data = { campus: 'total', start: '2026-10-12', end: '2026-10-16',
  dates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'],
  cells: [{ date: '2026-10-12', hour: 2, weekday: 0, available: teachers, recovery: [rp, teachers[0]] }],
  pot: { enabled: 18, total: 50, percentage: 36, reference: 40 }, unknown: { hours: 0, pot: 0 } };
function flatten(tree) {
  const nodes = [];
  function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (typeof n.type === 'function') { nodes.push(n); return walk(n.type(n.props)); }
    nodes.push(n); walk(n.props?.children);
  }
  walk(tree); return nodes;
}
function screen() {
  let cursor = 0;
  const slots = [], setters = [], effects = [], requests = [], ready = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; setters[i] ||= value => { slots[i] = value; }; return [slots[i], setters[i]]; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((v, j) => slots[i].deps[j] !== v)) {
        slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); });
      }
    },
  };
  const module = load('src/StatsAvailability.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './StatsCalendar': { todayInRome: () => '2026-10-20' }, './stats-report': reporting }, {
    fetch(url) { return new Promise(resolve => requests.push({ url, resolve: (body, ok = true) => resolve({ ok, json: async () => body }) })); },
    window: { innerWidth: 1280, innerHeight: 800 },
  });
  const onReady = value => ready.push(value);
  return { ...module, requests, ready,
    render(campus = 'total', preview = false) { cursor = 0; const nodes = flatten(module.StatsAvailability({ campus, preview, onReady })); while (effects.length) effects.shift()(); return nodes; },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('grid cell reuses the heatmap pattern: counts, dedup, tooltip on hover/focus, Escape', () => {
  const s = screen();
  let nodes = flatten(s.AvailabilityTable({ data, selected: ['available'] }));
  let cell = nodes.find(n => n.type === s.AvailabilityCell);
  assert.equal(cell.props.cell.hour, 2);
  assert.deepEqual(Array.from(cell.props.selected), ['available']);
  assert.equal(cell.props.max, 2);

  let pos = null;
  const react = { useState: () => [pos, value => { pos = value; }] };
  const mod = load('src/StatsAvailability.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './StatsCalendar': { todayInRome: () => '2026-10-20' }, './stats-report': reporting }, { window: { innerWidth: 1280, innerHeight: 800 } });
  const render = recovery => flatten(mod.AvailabilityCell({ cell: data.cells[0], selected: recovery ? ['available', 'recovery'] : ['available'], activeCell: 'availability-2026-10-12-2', onActivate() {}, max: recovery ? 3 : 2 })).find(n => n.type === 'td');

  let td = render(false);
  assert.equal(td.props.children[0], 2);
  assert.equal(td.props.tabIndex, 0);
  assert.match(td.props['aria-label'], /Lunedì 2026-10-12, 2ª ora: 2 docenti/);
  assert.match(td.props.style.background, /color-mix\(in srgb, var\(--acc\) 24%, var\(--pan\)\)/);
  assert.ok(!td.props.children.some(n => n && n.props && n.props.role === 'tooltip'));

  td.props.onMouseEnter({ currentTarget: { getBoundingClientRect: () => ({ left: 100, bottom: 200 }) } });
  td = render(false);
  let tip = td.props.children.find(n => n && n.props && n.props.role === 'tooltip');
  const lines = flatten(tip).filter(n => n.type === 'li').map(n => n.props.children);
  assert.deepEqual(lines, ['Alfa - POT - C', 'Beta - DIS - C']);
  assert.ok(tip.props.style.left <= 1280 - 328 && tip.props.style.left >= 8, 'tooltip stays in the viewport');
  assert.equal(td.props['aria-describedby'], tip.props.id);
  assert.ok(!flatten(mod.AvailabilityCell({ cell: data.cells[0], selected: ['available'], max: 2, activeCell: 'another-cell', onActivate() {} })).some(n => n.props.role === 'tooltip'), 'only the table’s active cell renders its panel');

  assert.equal(pos.pinned, false);
  assert.ok(tip.props.className.includes('availability-tooltip'));
  td.props.onClick({ target: { closest: () => null } });
  td = render(false);
  assert.equal(pos.pinned, true, 'click pins a long list for scrolling');
  td.props.onMouseLeave();
  assert.ok(pos, 'pinned list survives pointer movement');
  const focused = {};
  td.props.onKeyDown({ key: 'Enter', target: focused, currentTarget: focused, preventDefault() {} });
  assert.equal(pos.pinned, false, 'keyboard can unpin the list');
  td = render(false);
  td.props.onMouseLeave();
  assert.equal(pos, null, 'ordinary hover panel closes when moving to a nearby cell');
  td.props.onMouseEnter({ currentTarget: { getBoundingClientRect: () => ({ left: 100, bottom: 200 }) } });
  td = render(false);
  td.props.onClick({ target: { closest: () => null } });
  td = render(false);

  assert.ok(td.props.children.find(n => n?.props?.role === 'tooltip').props.className.includes('is-pinned'));


  td.props.onKeyDown({ key: 'Escape', stopPropagation() {} });
  td = render(false);
  assert.ok(!td.props.children.some(n => n && n.props && n.props.role === 'tooltip'), 'Escape closes the tooltip');

  td = render(true);
  assert.equal(td.props.children[0], 3, 'recovery view adds non-duplicated recovery teachers');
  const focusTarget = { getBoundingClientRect: () => ({ left: 100, bottom: 200 }) };
  td.props.onFocus({ currentTarget: focusTarget, target: focusTarget });
  td = render(true);
  tip = td.props.children.find(n => n && n.props && n.props.role === 'tooltip');
  const recoveryLines = flatten(tip).filter(n => n.type === 'li').map(n => n.props.children);
  assert.equal(recoveryLines.filter(l => String(l).includes('Alfa')).length, 1, 'Alfa appears once even in recovery view');
  assert.match(recoveryLines.at(-1), /^Gamma - RP - C\/S/);
  assert.deepEqual(flatten(tip).filter(n => n.type === 'h3').map(n => n.props.children), ['Potenziamenti disponibili', 'Recuperi permesso']);
  const css = readFileSync('src/style.css', 'utf8');
  assert.match(css, /\.availability-tooltip\s*\{[^}]*pointer-events: none/s);
  assert.match(css, /\.availability-tooltip\.is-pinned\s*\{[^}]*pointer-events: auto/s);


  pos = null;
  const empty = mod.AvailabilityCell({ cell: { ...data.cells[0], available: [], recovery: [] }, selected: ['available'], max: 3, activeCell: null, onActivate() {} });
  const emptyTd = flatten(empty).find(n => n.type === 'td');
  assert.equal(emptyTd.props.children[0], 0);
  assert.equal(emptyTd.props.tabIndex, undefined, 'empty cells are not focusable');
});
test('availability refreshes by shared campus and future date and discards stale responses', async () => {
  const s = screen(); let nodes = s.render();
  assert.match(s.requests[0].url, /date=2026-10-20&campus=total/);
  nodes = s.render('centrale');
  s.requests[1].resolve({ ...data, campus: 'centrale' }); await settle();
  s.requests[0].resolve(data); await settle();
  nodes = s.render('centrale');
  assert.equal(nodes.find(n => n.type === s.AvailabilityTable).props.data.campus, 'centrale');
  nodes.find(n => n.type === 'input').props.onChange({ target: { value: '2099-10-12' } });
  s.render('centrale');
  assert.match(s.requests.at(-1).url, /date=2099-10-12&campus=centrale/);
  nodes = s.render('succursale');
  assert.match(s.requests.at(-1).url, /date=2099-10-12&campus=succursale/);
  const count = s.requests.length; s.render('succursale');
  assert.equal(s.requests.length, count, 'unrelated rerenders do not reload');
  s.requests.at(-1).resolve({ detail: 'Errore disponibilità' }, false); await settle();
  nodes = s.render('succursale');
  assert.ok(nodes.some(n => n.props.role === 'alert'));
  nodes.find(n => n.type === 'button' && n.props.children === 'Riprova').props.onClick();
  s.render('succursale');
  assert.equal(s.requests.length, count + 1);
});
test('print keeps the selected grid and week with the family ratio; empty totals have no fake percent', async () => {
  const s = screen(); s.render(); s.requests[0].resolve(data); await settle();
  let nodes = s.render('total', true);
  assert.equal(nodes.filter(n => n.type === s.AvailabilityTable).length, 1);
  assert.ok(nodes.some(n => n.props.className === 'availability-ratio'));
  const text = JSON.stringify(nodes);
  assert.match(text, /18/); assert.match(text, /50/); assert.match(text, /36/); assert.match(text, /40/);
  assert.match(text, /2026-10-12/);
  assert.ok(s.ready.includes(true), 'availability alone enables printing');
  s.render('succursale');
  s.requests.at(-1).resolve({ ...data, campus: 'succursale', pot: { enabled: 0, total: 0, percentage: null, reference: 40 } }); await settle();
  nodes = s.render('succursale');
  assert.match(JSON.stringify(nodes), /Nessuna ora POT/);
  assert.match(s.absenceExplanation, /attività senza una classe da sostituire/);
  assert.match(s.absenceExplanation, /classe e ora contano separatamente/);
});

test('shared Orari tooltip supports keyboard focus, Escape and constrained long lists', () => {
  let tip = null;
  const react = { useRef: () => ({ current: null }), useState: () => [tip, value => { tip = value; }] };
  const tooltip = load('src/Tooltip.tsx', { react: { ...react, default: react }, 'react/jsx-runtime': { jsx, jsxs: jsx } },
    { window: { innerWidth: 375, innerHeight: 640 }, clearTimeout() {}, setTimeout() {} });
  const text = Array.from({ length: 40 }, (_, i) => 'Docente ' + i).join('\n');
  let nodes = flatten(tooltip.HourHelp({ text, children: '40' }));
  const trigger = nodes.find(n => n.props.className === 'hour-help');
  assert.equal(trigger.props.tabIndex, 0);
  trigger.props.onFocus({ currentTarget: { getBoundingClientRect: () => ({ left: 320, top: 500, bottom: 544 }) } });
  nodes = flatten(tooltip.HourHelp({ text, children: '40' }));
  const popup = nodes.find(n => n.props.role === 'tooltip');
  assert.equal(popup.props.children, text);
  assert.ok(popup.props.style.left <= 129, 'tooltip stays within a narrow viewport');
  assert.ok(popup.props.style.maxHeight < 640);
  assert.equal(popup.props.style.transform, 'translateY(-100%)');
  nodes.find(n => n.props.className === 'hour-help').props.onKeyDown({ key: 'Escape' });
  nodes = flatten(tooltip.HourHelp({ text, children: '40' }));
  assert.ok(!nodes.some(n => n.props.role === 'tooltip'));
  const css = readFileSync('src/style.css', 'utf8');
  assert.match(css, /\.tip[^}]*overflow-y: auto/s);
  assert.match(css, /hour-help:focus-visible/);
});

test('paid category unions overlapping teacher opportunities and has its own toggle', async () => {
  const s = screen();
  const paid = { ...rp, activities:['PAID'], uncertain:true };
  const mixed = {...data, cells:[{...data.cells[0],paid:[paid,{...paid,id:'d',name:'Delta'}]}]};
  const nodes = flatten(s.AvailabilityCell({cell:mixed.cells[0], selected:['available','recovery','paid'], max:4, activeCell:null,onActivate(){}}));
  assert.equal(nodes.find(n=>n.type==='td').props.children[0],4);
  const fresh = screen(); fresh.render(); fresh.requests[0].resolve(mixed); await settle();
  const view=fresh.render(); assert.ok(view.some(n=>n.type==='button' && n.props.children==='A pagamento'));
});

test('category toggles independently filter counts, including none and all combinations', async () => {
  const s = screen(); s.render();
  const mixed = {...data, cells:[{...data.cells[0], paid:[rp,{...rp,id:'d'}]}]};
  s.requests[0].resolve(mixed); await settle();
  for (let mask=0; mask<8; mask++) {
    const selected=['available','recovery','paid'].filter((_,i)=>mask & (1<<i));
    const nodes=flatten(s.AvailabilityCell({cell:mixed.cells[0],selected,max:4,activeCell:null,onActivate(){}}));
    const expected=new Set(selected.flatMap(key=>mixed.cells[0][key]).map(t=>t.id)).size;
    assert.equal(nodes.find(n=>n.type==='td').props.children[0],expected);
  }
  let view=s.render();
  for (const label of ['Recuperi permesso','A pagamento','Potenziamenti disponibili']) {
    view.find(n=>n.type==='button' && n.props.children===label).props.onClick();
    view=s.render();
  }
  assert.deepEqual(Array.from(view.find(n=>n.type===s.AvailabilityTable).props.selected),['recovery','paid']);
  assert.equal(s.render('total',true).filter(n=>n.type===s.AvailabilityTable).length,1);
});
