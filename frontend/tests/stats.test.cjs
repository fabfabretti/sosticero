const { loading, quiet } = require('./loading-harness.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: id => id === './Loading' ? loading : id === './useQuietRefresh' ? quiet(imports.react) : id === './session' ? {sessionFetch:(...args)=>globals.fetch(...args)} : imports[id], URLSearchParams, ...globals });
  return exports;
}
const reporting = load('src/stats-report.ts');
const jsx = (type, props) => ({ type, props });
const calendar = load('src/StatsCalendar.tsx', { 'react/jsx-runtime': { jsx, jsxs: jsx } });
const counts = { teachers: 2, teacherHours: 2, demand: 1, covered: 0, uncovered: 1, late: 0, early: 0, pending: 0 };
const fixture = { campus: 'centrale', period: 'all', start: '2026-10-12', end: '2026-10-13', days: 1,
  totals: counts, averages: counts, coverage: 0, daily: [{ date: '2026-10-12', ...counts }],
  weekdays: Array.from({ length: 7 }, (_, weekday) => ({ weekday, days: weekday === 0 ? 1 : 0, ...counts })),
  hours: [{ hour: 2, teachers: 2, teacherHours: 2, demand: 1 }],
  heatmap: [{ weekday: 0, hour: 2, days: 1, teachers: 2, teacherHours: 2, demand: 1 }],
  absenceTypes: [{kind: 'planned', hours: 2, percentage: 100}, {kind: 'unclassified', hours: 0, percentage: 0}], teacherAbsences: [{id: 'one', name: '=Nome', hours: 2, days: 1}],
  types: {}, exceptional: 0, classes: [{ name: '=1+1;"A', demand: 1 }], worst: [],
  unknown: { teacherHours: 0, demand: 0 }, provenance: { recorded: 2 }, issues: 0 };

test('CSV preserves totals, filters, denominators and safely quotes spreadsheet text', () => {
  const csv = reporting.reportCsv(fixture);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Sede";"Centrale"'));
  assert.ok(csv.includes('"Ore da coprire";"1";"1"'));
  assert.ok(csv.includes('"2026-10-12";"1";"2";"2";"0";"1";"0";"0";"0"'));
  assert.ok(csv.includes('"\'=1+1;""A";"1"'));
  assert.ok(csv.includes('Solo giorni con assenze registrate'));
});

function screen(storage) {
  let cursor = 0;
  const slots = [], effects = [], requests = [];
  const react = {
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = {current:initial}; return slots[i]; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !deps || deps.some((v, j) => slots[i].deps?.[j] !== v)) {
        slots[i]?.cleanup?.();
        slots[i] = { deps };
        effects.push(() => { slots[i].cleanup = fn(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const { Stats } = load('src/Stats.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './stats-report': reporting, './StatsAvailability': { StatsAvailability: 'stats-availability', absenceExplanation: 'Le ore dei docenti assenti includono anche attività senza una classe da sostituire.' }, './StatsCalendar': calendar, './HeatCell': { HeatCell: 'heat-cell' }, './Attachments': { RecordInfo: 'record-info' }, recharts: new Proxy({}, { get: (_, name) => name }) }, {
    localStorage: storage, document: { getElementById: () => ({focus() {}}) },
    fetch(url) { return new Promise(resolve => requests.push({ url, resolve: body => resolve({ ok: true, json: async () => body }) })); },
  });
  return {
    requests,
    render() { cursor = 0; const nodes = [];
      function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return;
        nodes.push(node); walk(node.props?.children);
      }
      walk(Stats()); while (effects.length) effects.shift()(); return nodes;
    },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('filter requests discard stale responses and custom ranges validate before fetching', async () => {
  const s = screen(); let nodes = s.render();
  nodes.find(n => n.type === 'button' && n.props.children === 'Centrale').props.onClick();
  s.render();
  assert.equal(s.requests.length, 2);
  assert.ok(s.requests[1].url.includes('campus=centrale'));
  s.requests[1].resolve(fixture); await settle();
  assert.ok(s.render().some(n => n.props.className === 'stats-cards'));
  s.requests[0].resolve({ ...fixture, campus: 'total', days: 0 }); await settle();
  assert.ok(s.render().some(n => n.props.className === 'stats-cards'), 'old response cannot replace current data');
  nodes = s.render();
  nodes.find(n => n.type === 'button' && n.props.children === 'Stampa report').props.onClick();
  nodes = s.render();
  assert.ok(nodes.some(n => n.props.className === 'stats-preview-actions'));
  assert.ok(nodes.filter(n => n.type === 'details').every(n => n.props.open), 'print preview expands the numerical tables');
  nodes.find(n => n.type === 'button' && n.props.children === 'Torna alle statistiche').props.onClick();
  nodes = s.render();
  nodes.find(n => n.type === 'button' && n.props.children === 'Personalizzato').props.onClick();
  nodes = s.render();
  assert.equal(s.requests.length, 3);
  nodes.find(n => n.type === calendar.StatsCalendar).props.onSelect('2026-10-13');
  nodes = s.render();
  assert.ok(s.requests.at(-1).url.includes('start=2026-10-13&end=2026-10-13'));
  nodes.find(n => n.type === calendar.StatsCalendar).props.onSelect('2026-10-01');
  nodes = s.render();
  assert.ok(s.requests.at(-1).url.includes('start=2026-10-01&end=2026-10-13'), 'reverse selection produces an inclusive ordered range');
  assert.equal(nodes.filter(n => n.type === 'select').length, 0, 'campus, period and charts have no dropdowns');
});

function flatten(tree) {
  const nodes = [];
  function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); }
  walk(tree); return nodes;
}

test('calendar presets highlight ranges and support cross-month navigation', () => {
  assert.equal(calendar.presetRange('week', '2026-11-02', '2026-10-01').start, '2026-11-02');
  assert.equal(calendar.presetRange('week', '2026-11-01', '2026-10-01').start, '2026-10-26');
  assert.equal(calendar.presetRange('month', '2026-11-02', '2026-10-01').start, '2026-11-01');
  assert.equal(calendar.presetRange('all', '2026-11-02', '2026-10-01').start, '2026-10-01');
  const moved = [], picked = [];
  const nodes = flatten(calendar.StatsCalendar({ start:'2026-10-30', end:'2026-11-02', today:'2026-11-02', month:'2026-11-01', onMonth: d => moved.push(d), onSelect: d => picked.push(d) }));
  assert.equal(nodes.find(n => n.props['aria-label'] === '2026-11-01').props['aria-pressed'], true);
  assert.equal(nodes.find(n => n.props['aria-label'] === '2026-11-03').props.disabled, true);
  nodes.find(n => n.props['aria-label'] === 'Mese precedente').props.onClick();
  assert.equal(moved[0], '2026-10-01');
  nodes.find(n => n.props['aria-label'] === '2026-11-02').props.onClick();
  assert.equal(picked[0], '2026-11-02');
});

test('summary leads with daily averages; daily trend uses lines and averages use grouped bars', async () => {
  const s = screen(); s.render();
  s.requests[0].resolve({ ...fixture, totals: { ...counts, demand: 18 }, averages: { ...counts, demand: 6 } }); await settle();
  const nodes = s.render();
  const firstCard = nodes.find(n => n.props.className === 'stats-card');
  assert.equal(flatten(firstCard).find(n => n.type === 'strong').props.children, '6');
  const trends = nodes.filter(n => typeof n.type === 'function' && n.type.name === 'Trend');
  assert.equal(trends.length, 3);
  assert.equal(trends.filter(t => t.props.bars).length, 2);
  for (const trend of trends) {
    const children = flatten(trend.type(trend.props));
    assert.equal(children.filter(n => n.type === (trend.props.bars ? 'Bar' : 'Line')).map(n => n.props.dataKey).join(','), trend.props.bars ? 'demand' : 'demand,teacherHours,teachers');
    assert.ok(children.some(n => n.type === 'Legend'));
  }
});


test('heatmap uses weekdays as column headers and periods as row headers', async () => {
  const s = screen(); s.render(); s.requests[0].resolve(fixture); await settle();
  const table = s.render().find(n => n.type === 'table' && n.props.className === 'stats-heatmap');
  const headers = flatten(table).filter(n => n.type === 'th');
  assert.ok(headers.some(n => n.props.scope === 'col' && n.props.children[0] === 'Lunedì'));
  assert.equal(headers.filter(n => n.props.scope === 'row').length, 7);
  assert.equal(headers.find(n => n.props.scope === 'row').props.children.join(''), '1ª ora');
});


test('heatmap detail opens on hover and focus, includes zeroes and closes on Escape', () => {
  let position = null;
  const { HeatCell } = load('src/HeatCell.tsx', {
    react: { useState: () => [position, value => { position = value; }] },
    'react/jsx-runtime': { jsx, jsxs: jsx }, './stats-report': reporting,
  }, { window: { innerWidth: 800, innerHeight: 600 } });
  const cell = { weekday: 0, hour: 1, days: 2, demand: 1.5, teacherHours: 2, teachers: 2, observations: [
    { date: '2026-10-05', demand: 0, teacherHours: 1, teachers: 1 },
    { date: '2026-10-12', demand: 3, teacherHours: 3, teachers: 3 },
  ] };
  const render = (metric = 'demand') => flatten(HeatCell({ cell, metric, max: 3 }));
  let nodes = render();
  nodes[0].props.onMouseEnter({ currentTarget: { getBoundingClientRect: () => ({ left: 750, bottom: 580 }) } });
  nodes = render();
  assert.ok(nodes.some(n => n.props.role === 'tooltip'));
  const lines = nodes.filter(n => n.type === 'li').map(n => n.props.children.join(''));
  assert.ok(lines[0].includes('5 ott 2026: 0 ore'));
  assert.ok(lines[1].includes('12 ott 2026: 3 ore'));
  assert.ok(position.left <= 472 && position.top <= 336, 'tooltip stays within the viewport');
  nodes[0].props.onKeyDown({ key: 'Escape', stopPropagation() {} });
  assert.ok(!render().some(n => n.props.role === 'tooltip'));
  render()[0].props.onFocus({ currentTarget: { getBoundingClientRect: () => ({ left: 20, bottom: 40 }) } });
  assert.ok(render('teachers').filter(n => n.type === 'li')[0].props.children.join('').includes('1 docente'));
});

test('empty historical report keeps availability and its shared campus scope; availability enables printing', async () => {
  const s = screen(); s.render();
  s.requests[0].resolve({ ...fixture, days: 0 }); await settle();
  let nodes = s.render();
  let section = nodes.find(n => n.type === 'stats-availability');
  assert.equal(section.props.campus, 'total');
  section.props.onReady(true);
  nodes = s.render();
  assert.equal(nodes.find(n => n.type === 'button' && n.props.children === 'Stampa report').props.disabled, false);
  nodes.find(n => n.type === 'button' && n.props.children === 'Succursale').props.onClick();
  nodes = s.render();
  assert.equal(nodes.find(n => n.type === 'stats-availability').props.campus, 'succursale');
});

test('summary omits incomplete coverage and heatmap keeps only demand and absent teachers', async () => {
  const s = screen(); s.render(); s.requests[0].resolve({ ...fixture, coverage: 75 }); await settle();
  const nodes = s.render();
  const cards = nodes.filter(n => n.props.className === 'stats-card');
  assert.equal(cards.length, 3);
  assert.ok(!cards.some(n => JSON.stringify(n).includes('Ore coperte')));
  assert.ok(!JSON.stringify(cards).includes('della domanda'));
  const selector = nodes.find(n => n.props['aria-label'] === 'Indicatore della mappa');
  assert.deepEqual(flatten(selector).filter(n => n.type === 'button').map(n => n.props.children), ['Ore da coprire', 'Docenti assenti']);
  const css = readFileSync('src/style.css', 'utf8');
  assert.match(css, /\.stats-heatmap\s*\{[^}]*table-layout: fixed/s);
  assert.match(css, /\.stats-scroll \.stats-heatmap thead th:last-child\s*\{[^}]*display: table-cell/s);
});

test('campus survives remounts and invalid or unavailable storage falls back to total', () => {
  let saved='succursale';
  const storage={getItem:key=>key==='stats-campus'?saved:null,setItem:(key,value)=>{if(key==='stats-campus')saved=value;}};
  let s=screen(storage); let nodes=s.render();
  assert.match(s.requests[0].url,/campus=succursale/);
  nodes.find(n=>n.type==='button' && n.props.children==='Centrale').props.onClick();s.render();
  s=screen(storage);s.render();assert.match(s.requests[0].url,/campus=centrale/);
  saved='invalid';s=screen(storage);s.render();assert.match(s.requests[0].url,/campus=total/);
  s=screen({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  s.render();assert.match(s.requests[0].url,/campus=total/);
});

test('tabs persist and keyboard navigation preserves the complete print preview', async () => {
  const saved = new Map();
  const storage = {getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
  const s=screen(storage); s.render(); s.requests[0].resolve(fixture); await settle();
  let nodes=s.render();
  const tab=label=>nodes.find(n=>n.props.role==='tab' && n.props.children===label);
  assert.equal(tab('Andamento').props['aria-selected'],true);
  tab('A disposizione').props.onClick();nodes=s.render();
  assert.equal(saved.get('stats-tab'),'availability');
  assert.equal(nodes.find(n=>n.props.id==='stats-panel-trends').props.hidden,true);
  assert.equal(nodes.find(n=>n.props.id==='stats-panel-availability').props.hidden,false);
  assert.ok(nodes.some(n=>n.type==='stats-availability'));
  const fresh=screen(storage);fresh.render();
  assert.equal(fresh.render().find(n=>n.props.id==='stats-tab-availability').props['aria-selected'],true);
  tab('A disposizione').props.onKeyDown({key:'End',preventDefault(){}});nodes=s.render();
  assert.equal(tab('Classi e docenti').props['aria-selected'],true);
  tab('Classi e docenti').props.onKeyDown({key:'ArrowRight',preventDefault(){}});nodes=s.render();
  assert.equal(tab('Andamento').props['aria-selected'],true);
  tab('Andamento').props.onKeyDown({key:'ArrowLeft',preventDefault(){}});nodes=s.render();
  nodes.find(n=>n.type==='button' && n.props.children==='Stampa report').props.onClick();nodes=s.render();
  assert.ok(nodes.filter(n=>n.props.role==='tabpanel').every(n=>!n.props.hidden));
  nodes.find(n=>n.type==='button' && n.props.children==='Torna alle statistiche').props.onClick();nodes=s.render();
  assert.equal(tab('Classi e docenti').props['aria-selected'],true);
  assert.equal(s.requests.length,1);
});

test('metric help, pie, teacher rows and CSV use absent teacher-hours', async()=>{
  const s=screen();s.render();s.requests[0].resolve(fixture);await settle();const nodes=s.render();
  const help=nodes.filter(n=>n.type==='record-info');assert.equal(help.length,3);assert.ok(help.every(n=>n.props.hover));
  const pie=nodes.find(n=>n.type==='Pie');assert.equal(pie.props.dataKey,'hours');assert.equal(pie.props.data.length,1);
  const teacher=nodes.find(n=>typeof n.type==='function' && n.type.name==='Values' && n.props.headings[0]==='Docente');
  assert.equal(teacher.props.rows[0].join(','),'=Nome,2,1');
  const csv=reporting.reportCsv(fixture);assert.ok(csv.includes('"Programmata";"2";"100"'));assert.ok(csv.includes('"\'=Nome";"2";"1"'));
  const empty=screen();empty.render();empty.requests[0].resolve({...fixture,totals:{...counts,teacherHours:0},absenceTypes:[],teacherAbsences:[]});await settle();
  assert.ok(!empty.render().some(n=>n.type==='Pie'));
});

test('returning to a cached statistics campus restores its own report without another request', async () => {
  const s=screen();s.render();s.requests[0].resolve({...fixture,campus:'total'});await settle();
  let nodes=s.render();nodes.find(n=>n.type==='button'&&n.props.children==='Centrale').props.onClick();s.render();
  s.requests[1].resolve({...fixture,campus:'centrale'});await settle();nodes=s.render();
  nodes.find(n=>n.type==='button'&&n.props.children==='Totale').props.onClick();s.render();nodes=s.render();
  assert.equal(s.requests.length,2);
  assert.ok(nodes.some(n=>n.props.className==='stats-scope'&&JSON.stringify(n.props.children).includes('Totale')));
  assert.equal(nodes.find(n=>n.type===loading.LoadingRegion).props.blocked,false);
});
