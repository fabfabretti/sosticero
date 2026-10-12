const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// Run the actual App handlers with deferred HTTP responses and minimal hook storage.
function app() {
  const effects = [], requests = [], comps = new Map();
  let App, pathname = '/', current = null;
  const envelope = () => {
    let e = comps.get(current);
    if (!e) comps.set(current, (e = { slots: [], count: 0 }));
    return e;
  };
  const react = {
    useState(initial) {
      const e = envelope();
      const i = e.count++;
      if (!(i in e.slots)) e.slots[i] = { value: initial };
      return [e.slots[i].value, value => { e.slots[i] = { value }; }];
    },
    useRef(initial) {
      const e = envelope();
      const i = e.count++;
      if (!(i in e.slots)) e.slots[i] = { value: { current: initial } };
      return e.slots[i].value;
    },
    useEffect(fn, deps) {
      const e = envelope();
      const i = e.count++;
      if (!(i in e.slots) || deps.some((d, j) => d !== e.slots[i].value[j]))
        effects.push(fn);
      e.slots[i] = { value: deps };
    },
  };
  const jsx = (type, props) => ({ type, props });
  // Pass-through react-router so routes render through the mock.
  const router = {
    HashRouter: ({ children }) => children,
    Link: ({ to, children, ...rest }) => ({
      type: 'a',
      props: { ...rest, href: '#' + to, children },
    }),
    useLocation: () => ({ pathname }),
  };
  const code = ts.transpileModule(readFileSync('src/main.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    exports: {}, URLSearchParams, Date,
    document: { getElementById: () => ({}) },
    fetch(url, options) {
      return new Promise(resolve => requests.push({
        url, options,
        resolve: (data, ok = true) => resolve({ ok, json: async () => data }),
      }));
    },
    require(id) {
      if (id === 'react') return { ...react, default: { Fragment: 'fragment' } };
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === 'react-dom/client') return {
        createRoot: () => ({ render: element => { App = element.type; } }),
      };
      if (id === './CandidateDrawer') return { CandidateDrawer: 'drawer' };
      if (id === 'react-router') return router;
      if (id.endsWith('.css')) return {};
      throw Error(id);
    },
  });
  function render() {
    for (const e of comps.values()) e.count = 0;
    const nodes = [];
    // Descend into function components so routed screens are visible to tests;
    // string/null nodes are collected and their children walked as before.
    function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (typeof node.type === 'function') {
        const prev = current;
        current = node.type;
        try {
          return walk(node.type(node.props || {}));
        } finally {
          current = prev;
        }
      }
      nodes.push(node);
      walk(node.props?.children);
    }
    walk({ type: App, props: {} });
    effects.splice(0).forEach(fn => fn());
    return nodes;
  }
  return { render, requests, go: p => { pathname = p; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const row = { k: 'r', id: 't', ids: ['t'], h: 1, c: '1A', aula: null, sede: 'centrale' };
const data = {
  dataset: { teachers: {}, classes: [], warnings: [] },
  state: { abs: {}, cf: {}, dis: {}, disSites: {}, asg: {} },
  rows: [row], issues: [],
};
const now = new Date();
const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
async function loaded(over = {}) {
  const a = app();
  a.render();
  a.requests.shift().resolve({ ...data, ...over });
  await settle();
  return a;
}
const slot = a => a.render().find(n => n.props?.className === 'fill ph');
const drawer = a => a.render().find(n => n.type === 'drawer');

test('only the latest slot response opens the drawer', async () => {
  const a = await loaded();
  slot(a).props.onClick();
  slot(a).props.onClick();
  a.requests[1].resolve([{ id: 'new' }]);
  await settle();
  a.requests[0].resolve([{ id: 'old' }]);
  await settle();
  assert.equal(drawer(a).props.cands[0].id, 'new');
});

test('changing day discards pending candidates', async () => {
  const a = await loaded();
  slot(a).props.onClick();
  a.render().find(n => n.props?.className === 'd').props.onClick();
  a.render();
  a.requests[0].resolve([]);
  await settle();
  assert.equal(drawer(a), undefined);
});

test('saving closes immediately and ignores pending slot responses', async () => {
  const a = await loaded();
  slot(a).props.onClick();
  a.requests.shift().resolve([]);
  await settle();
  const open = drawer(a);
  slot(a).props.onClick();
  open.props.onAssign('teacher');
  assert.equal(drawer(a), undefined);
  a.requests[0].resolve([]);
  await settle();
  assert.equal(drawer(a), undefined);
  const count = a.requests.length;
  slot(a).props.onClick();
  assert.equal(a.requests.length, count);
  a.requests[1].resolve({});
  await settle();
  a.requests[2].resolve(data);
  await settle();
  slot(a).props.onClick();
  a.requests[3].resolve([]);
  await settle();
  assert.ok(drawer(a));
});

test('drawer candidates carry profile and entry/exit enable flags', async () => {
  const a = await loaded();
  slot(a).props.onClick();
  a.requests.shift().resolve([
    {
      id: 'co', name: 'Co', ty: 'C', loc: 'centrale', why: '', tag: 'Compresenza',
      today: 0, total: 0, role: 'ITP', cdc: 'B016',
      cdcName: 'Laboratori di scienze e tecnologie informatiche',
      clsWeek: ['1A', '3B'], inClass: true,
    },
    {
      id: 'ENTRA', name: 'Entra dopo', ty: 'SPECIAL', loc: null, why: '',
      tag: 'Da verificare', today: 0, total: 0, enable: false,
      info: 'La classe entra alle 1 ed esce alle 7',
    },
  ]);
  await settle();
  const d = drawer(a);
  const ent = d.props.cands.find(c => c.id === 'ENTRA');
  assert.equal(d.props.cands[0].role, 'ITP');
  assert.ok(d.props.cands[0].cdcName.includes('informatiche'));
  assert.equal(ent.enable, false);
  assert.ok(ent.info.includes('entra alle 1'));
});

test('auto availability hours lock while other hours toggle manual', async () => {
  const teacher = { name: 'Auto T', role: 'curricolare', classe_concorso: 'A041' };
  const base = {
    dataset: { teachers: { auto: teacher }, classes: [], warnings: [] },
    state: { abs: {}, cf: {}, dis: {}, disSites: {}, asg: {} },
    rows: [],
    issues: [],
    autoDis: { [todayYmd]: { auto: { 2: ['1A entra dopo'], 3: ['1A esce prima'] } } },
  };
  const a = await loaded(base);
  const hour = label => a.render().find(n => n.props['aria-label'] === label);
  const locked = hour('Auto T, 2ª ora');
  assert.equal(locked.props.disabled, true);
  assert.ok(String(locked.props.title).includes('entra dopo'));
  const free = hour('Auto T, 4ª ora');
  assert.equal(free.props.disabled, false);
  free.props.onClick();
  a.requests.shift().resolve({});
  await settle();
  a.requests.shift().resolve({
    ...base,
    state: { abs: {}, cf: {}, dis: { [todayYmd]: { auto: [4] } }, disSites: {}, asg: {} },
  });
  await settle();
  assert.equal(hour('Auto T, 4ª ora').props['aria-pressed'], true);
  assert.equal(hour('Auto T, 2ª ora').props.disabled, true);
});

test('co-absent teachers render as one merged label', async () => {
  const a = app();
  a.render();
  a.requests.shift().resolve({
    dataset: {
      teachers: {
        d056: { name: 'Domaschi Alberto' },
        d134: { name: 'Savelli Luca' },
      },
      classes: [],
      warnings: [],
    },
    state: { abs: {}, cf: {}, dis: {}, disSites: {}, asg: {} },
    rows: [
      {
        k: 'd056|7|3FB',
        id: 'd056',
        ids: ['d056', 'd134'],
        h: 7,
        c: '3FB',
        aula: 'A39C',
        sede: 'centrale',
      },
    ],
    issues: [],
  });
  await settle();
  const cells = a.render().filter(n => n.type === 'td');
  assert.ok(
    cells.some(n => n.props.children === 'Domaschi Alberto / Savelli Luca'),
    'merged label is rendered in one cell',
  );
});

const tabLinks = a => a.render().filter(n => n.type === 'a' && n.props?.href?.startsWith('#/'));
const currentTab = a => tabLinks(a).find(l => l.props.className === 'on');

test('shell shows brand, glasses icon and five tabs, defaulting to Supplenze', async () => {
  const a = await loaded();
  assert.ok(a.render().find(n => n.props?.className === 'bar'), 'top bar present');
  const svg = a.render().find(n => n.type === 'svg' && n.props?.viewBox === '0 0 24 24');
  assert.ok(svg, 'glasses icon rendered');
  assert.equal(svg.props.children.props.stroke, 'currentColor', 'icon themes with currentColor');
  const links = tabLinks(a);
  assert.deepEqual(links.map(l => [l.props.href, l.props.children]), [
    ['#/', 'Supplenze'],
    ['#/permessi', 'Permessi'],
    ['#/banca-ore', 'Banca ore'],
    ['#/stats', 'Stats'],
    ['#/settings', 'Settings'],
  ]);
  assert.equal(currentTab(a).props.href, '#/', 'home tab is current');
  assert.ok(a.render().some(n => n.props?.className === 'fill ph'), 'substitution screen renders');
});

test('unknown route falls back to Supplenze', async () => {
  const a = await loaded();
  a.go('/nope');
  const nodes = a.render();
  assert.ok(nodes.some(n => n.props?.className === 'fill ph'), 'substitution screen shown');
  assert.equal(currentTab(a).props.href, '#/');
});

test('future tabs show placeholder screens and mark their tab current', () => {
  const a = app();
  a.render();
  for (const [route, label] of [
    ['/banca-ore', 'Banca ore'],
    ['/stats', 'Stats'],
  ]) {
    a.go(route);
    assert.ok(a.render().find(n => n.props?.className === 'stub'), route + ' shows a placeholder');
    assert.equal(a.render().find(n => n.type === 'h1').props.children, label);
    assert.equal(currentTab(a).props.href, '#' + route, route + ' tab is current');
  }
  a.go('/settings');
  assert.ok(a.render().find(n => n.props?.className === 'settings'), 'settings shows the management screen');
  assert.equal(currentTab(a).props.href, '#/settings');
  a.go('/');
  assert.ok(!a.render().some(n => n.props?.className === 'stub'), 'Supplenze is not a placeholder');
});

test('credits footer shows only at the end of Settings', () => {
  const a = app();
  a.render();
  a.go('/settings');
  const f = a.render().find(n => n.props?.className === 'credits');
  assert.ok(f, 'credits footer on settings');
  assert.ok(String(f.props.children).includes('Big Pickle'));
  a.go('/');
  assert.ok(!a.render().some(n => n.props?.className === 'credits'));
  a.go('/permessi');
  assert.ok(!a.render().some(n => n.props?.className === 'credits'));
});

const permitData = {
  dataset: { teachers: { t: { id: 't', name: 'Contartase', role: 'curricolare' } }, lessons: Object.fromEntries([1,2,3,4,5].map(h => ['t|lun|' + h, { classes: h === 3 || h === 4 ? [] : ['1A'] }])) },
  permessi: {},
};
async function permitsLoaded(records = {}) {
  const a = app();
  a.go('/permessi'); a.render();
  assert.equal(a.requests[0].url, '/api/permessi');
  a.requests.shift().resolve({ ...permitData, permessi: records });
  await settle();
  return a;
}
const permitTeacher = a => a.render().find(n => n.type === 'input' && n.props['aria-label'] === 'Cerca docente');
const permitDay = a => a.render().find(n => n.props?.['aria-label'] === 'Data permesso');
const permitHour = (a, h) => a.render().find(n => n.type === 'button' && n.props['aria-label'] === `Permesso ${h}ª ora`);
const permitForm = a => a.render().find(n => n.type === 'form');
const clickText = (a, text) => a.render().find(n => n.type === 'button' && n.props.children === text).props.onClick();

test('permit form warns about unscheduled periods and saves them within limit', async () => {
  const a = await permitsLoaded();
  assert.ok(!a.render().some(n => n.props?.className === 'stub'));
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  permitDay(a).props.onChange({ target: { value: '2026-10-12' } });
  permitHour(a, 3).props.onClick(); permitHour(a, 4).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 0, 'scheduled POT/DIS have no warning');
  permitHour(a, 3).props.onClick(); permitHour(a, 4).props.onClick();
  permitHour(a, 6).props.onClick(); permitHour(a, 7).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 2);
  assert.ok(a.render().some(n => n.props?.tabIndex === 0 && n.props['aria-label']?.includes('nessuna attività')));
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.deepEqual(JSON.parse(req.options.body), { day: '2026-10-12', id: 't', requested_on: null, hours: [6,7] });
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, permessi: { '2026-10-12': { t: [6,7] } } }); await settle();
  assert.equal(a.render().filter(n => n.props?.className === 'permit-period').length, 2);
  assert.ok(a.render().some(n => n.type === 'td' && n.props.children === 2));
});

test('permit errors preserve form; editing supplies original identity and deletion is explicit', async () => {
  const a = await permitsLoaded({ '2026-10-12': { t: [2,3] } });
  a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick();
  assert.equal(permitTeacher(a).props.value, 'Contartase');
  assert.equal(permitDay(a).props.value, '2026-10-12');
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.equal(JSON.parse(req.options.body).original_id, 't');
  req.resolve({ detail: 'Permesso già presente: modifica la registrazione esistente.' }, false); await settle();
  assert.ok(a.render().some(n => n.props?.role === 'alert' && n.props.children.includes('già presente')));
  assert.equal(permitTeacher(a).props.value, 'Contartase');
  a.render().find(n => n.props?.['aria-label'] === 'Rimuovi permesso di Contartase').props.onClick();
  assert.deepEqual(JSON.parse(a.requests.shift().options.body), { day: '2026-10-12', id: 't', hours: null });
});

test('permit absences lock and keep manual control payloads separate', async () => {
  const a = await loaded({ dataset: permitData.dataset, state: { ...data.state, abs: { [todayYmd]: { t: [2] } }, permessi: { [todayYmd]: { t: [2,3] } } } });
  const button = h => a.render().find(n => n.type === 'button' && n.props['aria-label'] === `Contartase, ${h}ª ora`);
  assert.equal(button(2).props.disabled, true);
  assert.equal(button(3).props['aria-pressed'], true);
  assert.equal(button(4).props.disabled, false);
  button(4).props.onClick();
  assert.deepEqual(JSON.parse(a.requests.shift().options.body).hours, [2,4]);
  a.render().find(n => n.type === 'button' && n.props?.className === 'n' && n.props.children === 'Contartase').props.onClick();
  assert.deepEqual(JSON.parse(a.requests.shift().options.body).hours, [1,2,3,4,5,6,7]);
  a.render().find(n => n.type === 'button' && n.props['aria-label'] === 'Rimuovi Contartase').props.onClick();
  assert.equal(JSON.parse(a.requests.shift().options.body).hours, undefined);
  const only = await loaded({ dataset: permitData.dataset, state: { ...data.state, permessi: { [todayYmd]: { t: [2] } } } });
  assert.equal(only.render().find(n => n.type === 'button' && n.props['aria-label'] === 'Rimuovi Contartase').props.disabled, true);
});

test('permit search supports keyboard selection and immediately warns above the daily limit', async () => {
  const a = await permitsLoaded();
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(permitTeacher(a).props.value, 'Contartase');
  permitDay(a).props.onChange({ target: { value: '2026-10-12' } });
  for (const h of [1,2,3]) permitHour(a,h).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 3);
  assert.ok(a.render().some(n => n.props?.role === 'alert'));
  assert.equal(a.render().find(n => n.props?.className === 'permit-save').props.disabled, true);
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.equal(a.requests.length, 0);
  permitHour(a,3).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 0);
  assert.equal(a.render().find(n => n.props?.className === 'permit-save').props.disabled, false);
});

test('request date is optional, submitted and restored when editing', async () => {
  const a = await permitsLoaded();
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  permitDay(a).props.onChange({ target: { value: '2026-10-12' } });
  a.render().find(n => n.props?.['aria-label'] === 'Data richiesta').props.onChange({ target: { value: '2026-10-09' } });
  permitHour(a,2).props.onClick();
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.equal(JSON.parse(req.options.body).requested_on, '2026-10-09');
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, permessi: { '2026-10-12': { t: [2] } }, permitRequests: { '2026-10-12': { t: '2026-10-09' } } }); await settle();
  assert.ok(a.render().some(n => n.type === 'td' && n.props.children === '09/10/2026'));
  a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick();
  assert.equal(a.render().find(n => n.props?.['aria-label'] === 'Data richiesta').props.value, '2026-10-09');
  assert.ok(a.render().some(n => n.props?.className === 'permit-feedback'));
});
