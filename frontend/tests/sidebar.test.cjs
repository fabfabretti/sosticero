const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// Run the actual App handlers with deferred HTTP responses and minimal hook storage.
function app(localStorage = { getItem: () => null, setItem() {} }, confirm = () => false) {
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
      if (!(i in e.slots)) e.slots[i] = { value: typeof initial === 'function' ? initial() : initial };
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
    exports: {}, URLSearchParams, Date, localStorage, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {},
    window: { innerWidth: 1024, innerHeight: 768, confirm },
    document: { getElementById: () => ({ focus() {} }) },
    fetch(url, options) {
      if (url === '/api/environment') return Promise.resolve({ ok: true, json: async () => ({ testing: false }) });
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
      if (id === './HourTypes') return { HourTypes: 'hour-types' };
      if (id === './CandidateDrawer') return { CandidateDrawer: 'drawer' };
      if (id === './Stats') return { Stats: 'stats' };
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
  return { render, requests, go: p => {
    const screen = path => ['/permessi', '/settings', '/stats', '/banca-ore'].includes(path) ? path : '/';
    if (screen(p) !== screen(pathname)) for (const component of comps.keys()) {
      if (['Supplenze', 'Permessi', 'Settings', 'BackupSection'].includes(component?.name)) comps.delete(component);
    }
    pathname = p;
  } };
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
  assert.ok(a.render().some(n => n.props?.['aria-label'] === 'Automatico: 1A entra dopo'), 'locked hour keeps its reason in the tooltip');
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
  assert.ok(a.render().some(n => n.props?.['aria-label'] === '1A entra dopo, 1A esce prima'), 'locked reason shown as (i) tooltip');
});

test('assigned availability stays visible with status for automatic and manual hours', async () => {
  const a = await loaded({
    dataset: { teachers: { auto: { name: 'Auto T' }, manual: { name: 'Manual T' } }, classes: [], warnings: [] },
    state: { abs: {}, cf: {}, dis: { [todayYmd]: { manual: [2] } }, disSites: {}, asg: {
      [todayYmd]: { 'x|2|1A': { v: 'auto', c: '1A', t: 'D' }, 'y|2|2A': { v: 'manual', c: '2A', t: 'D' } },
    } },
    autoDis: { [todayYmd]: { auto: { 2: ['3A classe fuori'] } } },
  });
  for (const name of ['Auto T', 'Manual T']) {
    const hour = a.render().find(n => n.props['aria-label'] === `${name}, 2ª ora`);
    assert.ok(hour.props.className.includes('assigned'));
    assert.ok(hour.props['aria-description'].includes('Assegnato:'));
  }
  assert.equal(a.render().find(n => n.props['aria-label'] === 'Auto T, 2ª ora').props.disabled, true);
});

test('reminds about next-day class entry and exit changes', async () => {
  const tomorrow = new Date(now.getTime() + 864e5);
  const tomorrowYmd = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const a = await loaded({
    state: { abs: {}, cf: {}, dis: {}, disSites: {}, asg: {
      [tomorrowYmd]: {
        't|1|1A': { v: 'ESCE', t: 'SPECIAL', c: '1A' },
        't|7|2B': { v: 'ENTRA', t: 'SPECIAL', c: '2B' },
      },
    } },
  });
  const banner = a.render().find(n => n.props?.className === 'reminder');
  assert.ok(banner);
  const text = String(banner.props.children);
  assert.ok(text.includes('1A esce prima'));
  assert.ok(text.includes('2B entra dopo'));
});

test('no next-day reminder without entry or exit changes', async () => {
  const a = await loaded();
  assert.equal(a.render().find(n => n.props?.className === 'reminder'), undefined);
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
  a.go('/stats');
  assert.ok(a.render().some(n => n.type === 'stats'), 'Stats is functional');
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
  permitDay(a).props.onChange({ target: { value: '12/10/2026' } });
  permitHour(a, 3).props.onClick(); permitHour(a, 4).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 0, 'scheduled POT/DIS have no warning');
  permitHour(a, 3).props.onClick(); permitHour(a, 4).props.onClick();
  permitHour(a, 6).props.onClick(); permitHour(a, 7).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 2);
  assert.ok(a.render().some(n => n.props?.tabIndex === 0 && n.props['aria-label']?.includes('nessuna attività')));
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.deepEqual(JSON.parse(req.options.body), { day: '2026-10-12', id: 't', requested_on: todayYmd, note: '', classification: null, hours: [6,7] });
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, permessi: { '2026-10-12': { t: [6,7] } } }); await settle();
  assert.equal(a.render().filter(n => n.props?.className === 'permit-period').length, 2);
  assert.ok(a.render().some(n => n.props?.className === 'permit-remaining' && n.props.children === 2));
});

test('permit errors preserve form; editing supplies original identity and deletion is explicit', async () => {
  const a = await permitsLoaded({ '2026-10-12': { t: [2,3] } });
  a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick();
  assert.equal(permitTeacher(a).props.value, 'Contartase');
  assert.equal(permitDay(a).props.value, '12/10/2026');
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
  assert.ok(a.render().some(n => n.props?.['aria-label'] === 'Permesso'), 'permit reason shown as (i) tooltip');
  assert.ok(a.render().some(n => n.props?.['aria-label'] === 'Modifica dalla pagina permessi'), 'disabled permit hours explain themselves');
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
  permitDay(a).props.onChange({ target: { value: '12/10/2026' } });
  for (const h of [1,2,3]) permitHour(a,h).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 3);
  assert.ok(a.render().some(n => n.props?.role === 'alert'));
  assert.equal(a.render().find(n => n.props?.className === 'permit-save').props.disabled, false);
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(a.requests.shift().options.body).hours, [1,2,3]);
  permitHour(a,3).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 0);
  assert.equal(a.render().find(n => n.props?.className === 'permit-save').props.disabled, false);
});

test('request date is optional, submitted and restored when editing', async () => {
  const a = await permitsLoaded();
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  permitDay(a).props.onChange({ target: { value: '12/10/2026' } });
  a.render().find(n => n.props?.['aria-label'] === 'Data richiesta').props.onChange({ target: { value: '09/10/2026' } });
  permitHour(a,2).props.onClick();
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.equal(JSON.parse(req.options.body).requested_on, '2026-10-09');
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, permessi: { '2026-10-12': { t: [2] } }, permitRequests: { '2026-10-12': { t: '2026-10-09' } } }); await settle();
  assert.ok(a.render().some(n => n.type === 'td' && n.props.children === '09/10/2026'));
  a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick();
  assert.equal(a.render().find(n => n.props?.['aria-label'] === 'Data richiesta').props.value, '09/10/2026');
  assert.ok(a.render().some(n => n.props?.className === 'permit-feedback'));
});


test('campus preference survives reopening and tolerates unavailable or invalid storage', () => {
  let saved = null;
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const a = app(storage);
  clickText(a, 'Succursale'); a.render();
  assert.equal(saved, 'succursale');
  const reopened = app(storage);
  assert.equal(reopened.render().find(n => n.type === 'button' && n.props.children === 'Succursale').props['aria-pressed'], true);
  saved = 'invalid';
  assert.equal(app(storage).render().find(n => n.type === 'button' && n.props.children === 'Entrambe').props['aria-pressed'], true);
  const blocked = app({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  clickText(blocked, 'Centrale');
  assert.equal(blocked.render().find(n => n.type === 'button' && n.props.children === 'Centrale').props['aria-pressed'], true);
});

test('permit date headers toggle sorting, with missing request dates always last', async () => {
  const a = app(); a.go('/permessi'); a.render();
  a.requests.shift().resolve({ ...permitData,
    permessi: { '2026-10-10': { t: [1] }, '2026-10-11': { t: [1] }, '2026-10-12': { t: [1] } },
    permitRequests: { '2026-10-10': { t: '2026-10-09' }, '2026-10-12': { t: '2026-10-08' } },
  });
  await settle();
  const dates = () => a.render().filter(n => n.type === 'td' && /^1[012]\/10\/2026$/.test(n.props.children)).map(n => n.props.children);
  const sortBy = field => a.render().find(n => n.type === 'button' && n.props.children?.[0] === field).props.onClick();
  assert.deepEqual(dates(), ['12/10/2026', '11/10/2026', '10/10/2026']);
  sortBy('Data permesso');
  assert.deepEqual(dates(), ['10/10/2026', '11/10/2026', '12/10/2026']);
  sortBy('Data richiesta');
  assert.deepEqual(dates(), ['10/10/2026', '12/10/2026', '11/10/2026']);
  sortBy('Data richiesta');
  assert.deepEqual(dates(), ['12/10/2026', '10/10/2026', '11/10/2026']);
  assert.ok(a.render().some(n => n.type === 'th' && n.props['aria-sort'] === 'ascending'));
});


test('permit recovery register shows dated links, expiry, totals and refreshes on return', async () => {
  const a = app(); a.go('/permessi'); a.render();
  const response = { ...permitData, permessi: { '2026-10-12': { t: [2,3] } },
    balances: { t: { remaining: 1, expired: 1, eligible: 0 } },
    recoveries: { '2026-10-12': { t: { id: 'permit', deadline: '2026-11-12', recovered: 1, remaining: 1, expired: true,
      recoveries: [{ date: '2026-10-19', h: 4, key: 'absent|4|1A' }] } } },
  };
  a.requests.shift().resolve(response); await settle();
  const nodes = a.render();
  assert.ok(nodes.some(n => n.type === 'tr' && n.props.className === 'permit-outstanding'));
  assert.ok(nodes.some(n => n.props.className === 'permit-expired' && n.props.children === 'Scadute'));
  assert.ok(nodes.some(n => n.type === 'td' && n.props.children === '12/11/2026'));
  assert.ok(nodes.some(n => n.type === 'li' && n.props.children.join('').includes('19/10/2026 · 4ª ora')));
  a.go('/'); a.render();
  a.requests.shift().resolve(data); await settle();
  a.go('/permessi'); a.render();
  assert.equal(a.requests.shift().url, '/api/permessi');
});

const entryData = { ...data, dataset: { ...data.dataset, teachers: {
  a: { id: 'a', name: 'Anna', code: 'A' }, b: { id: 'b', name: 'Barbara', code: 'B' }, c: { id: 'c', name: 'Carla', code: 'C' },
}, classes: ['1A'] } };
const search = a => a.render().find(n => n.props?.id === 'q');
const submitEntry = a => a.render().find(n => n.type === 'form' && n.props.className === 'daily-entry').props.onSubmit({ preventDefault() {} });
const entrySubmit = a => a.render().find(n => n.props?.className === 'entry-submit');
const suggestion = (a, name) => a.render().find(n => n.type === 'button' && n.props.children?.[0] === name && n.props.children?.[1]?.type === 'small');
const pressed = (a, text) => a.render().find(n => n.type === 'button' && n.props.children === text).props['aria-pressed'];
async function resolveEntry(a, response = entryData) {
  a.requests.shift().resolve({ ok: true }); await settle();
  a.requests.shift().resolve(response); await settle();
}
test('daily selection, explicit submit and Enter retain options for consecutive entries', async () => {
  const a = await loaded(entryData);
  assert.equal(pressed(a, 'Tutto il giorno'), true);
  assert.ok(!a.render().some(n => n.props?.children === 'Più giorni'));
  search(a).props.onChange({ target: { value: 'anna' } }); suggestion(a, 'Anna').props.onClick();
  assert.equal(a.requests.length, 0);
  clickText(a, 'Tutto il giorno'); assert.equal(entrySubmit(a).props.disabled, true);
  submitEntry(a); assert.equal(a.requests.length, 0);
  for (const h of [2,3]) a.render().find(n => n.props?.['aria-label'] === `Aggiungi ${h}ª ora`).props.onClick();
  clickText(a, 'Programmata'); submitEntry(a);
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { day: todayYmd, group: 'abs', id: 'a', hours: [2,3], site: 'centrale', defaults: false, classification: 'planned', note: '' });
  submitEntry(a); assert.equal(a.requests.length, 1);
  await resolveEntry(a); assert.equal(search(a).props.value, '');
  assert.equal(a.render().find(n => n.props?.['aria-label'] === 'Aggiungi 2ª ora').props['aria-pressed'], true);
  search(a).props.onChange({ target: { value: 'bar' } }); search(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  const body = JSON.parse(a.requests[0].options.body);
  assert.equal(body.id, 'b'); assert.equal(body.classification, 'planned'); assert.deepEqual(body.hours, [2,3]);
  await resolveEntry(a);
  clickText(a, 'Last minute'); assert.equal(pressed(a, 'Programmata'), false);
  clickText(a, 'Last minute'); assert.equal(pressed(a, 'Last minute'), false);
});
test('daily keyboard, invalidation, composition and failed save preserve draft', async () => {
  const a = await loaded(entryData);
  search(a).props.onChange({ target: { value: 'a' } });
  search(a).props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  search(a).props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() {} }); assert.equal(a.requests.length, 0);
  search(a).props.onKeyDown({ key: 'Enter', preventDefault() {} }); assert.equal(JSON.parse(a.requests[0].options.body).id, 'b');
  a.requests.shift().resolve({ detail: 'Errore prova' }, false); await settle(); assert.equal(search(a).props.value, 'a');
  assert.ok(a.render().some(n => n.props?.role === 'alert' && n.props.children.includes('Errore prova')));
  search(a).props.onChange({ target: { value: 'anna' } }); suggestion(a, 'Anna').props.onClick();
  search(a).props.onChange({ target: { value: 'missing' } }); assert.equal(entrySubmit(a).props.disabled, true);
  submitEntry(a); assert.equal(a.requests.length, 0);
  search(a).props.onKeyDown({ key: 'Escape' }); assert.equal(search(a).props.value, '');
});
test('availability and class entries omit classification while defaults and campus persist', async () => {
  const a = await loaded(entryData); clickText(a, 'Last minute'); clickText(a, 'A disposizione');
  assert.ok(!a.render().some(n => n.props?.children === 'Last minute'));
  a.render().find(n => n.props?.className === 'dis-location').props.children[1].props.onChange({ target: { value: 'succursale' } });
  search(a).props.onChange({ target: { value: 'anna' } }); submitEntry(a);
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { day: todayYmd, group: 'dis', id: 'a', hours: [1,2,3,4,5,6,7], site: 'succursale', defaults: true });
  await resolveEntry(a); search(a).props.onChange({ target: { value: 'bar' } }); submitEntry(a);
  assert.equal(JSON.parse(a.requests[0].options.body).site, 'succursale'); await resolveEntry(a);
  clickText(a, 'A disposizione'); search(a).props.onChange({ target: { value: '1A' } });
  assert.ok(!a.render().some(n => n.props?.children === 'Last minute')); submitEntry(a);
  const body = JSON.parse(a.requests[0].options.body); assert.equal(body.group, 'cf'); assert.ok(!('classification' in body));
  await resolveEntry(a); assert.equal(pressed(a, 'Last minute'), true);
});
const groupFor = (a, teacher) => {
  const nodes = a.render(), index = nodes.findIndex(n => n.type === 'button' && n.props.className === 'n' && n.props.children === teacher);
  return nodes.slice(0, index).filter(n => n.type === 'h2').at(-1)?.props.children;
};
test('sidebar combines hours once, resolves mixed classifications and allows manual reclassification', async () => {
  const state = { ...data.state, abs: { [todayYmd]: { a: [2], b: [1], c: [3] } }, permessi: { [todayYmd]: { a: [3], b: [2] } },
    absenceKinds: { [todayYmd]: { a: 'last_minute', b: 'planned' } }, permitKinds: { [todayYmd]: { a: 'planned', b: 'last_minute' } } };
  const response = { ...entryData, state }, a = await loaded(response);
  assert.equal(groupFor(a, 'Anna'), 'Assenze last minute'); assert.equal(groupFor(a, 'Barbara'), 'Assenze last minute'); assert.equal(groupFor(a, 'Carla'), 'Assenze non classificate');
  assert.equal(a.render().filter(n => n.props?.className === 'n' && n.props.children === 'Anna').length, 1);
  for (const h of [2,3]) assert.equal(a.render().find(n => n.props?.['aria-label'] === `Anna, ${h}ª ora`).props['aria-pressed'], true);
  assert.equal(a.render().find(n => n.props?.['aria-label'] === 'Anna, 3ª ora').props.disabled, true);
  a.render().find(n => n.props?.['aria-label'] === 'Modifica assenza di Anna').props.onClick();
  a.render().filter(n => n.props?.className === 'opt classification').at(-1).props.children[0].props.onClick();
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { day: todayYmd, group: 'abs', id: 'a', hours: [2], classification: 'planned' });
  const changed = { ...state, absenceKinds: { [todayYmd]: { a: 'planned', b: 'planned' } } };
  await resolveEntry(a, { ...response, state: changed }); assert.equal(groupFor(a, 'Anna'), 'Assenze programmate');
  const headings = a.render().filter(n => n.type === 'h2').map(n => n.props.children);
  assert.ok(headings.indexOf('Assenze programmate') < headings.indexOf('Assenze non classificate')); assert.ok(headings.indexOf('Assenze non classificate') < headings.indexOf('Assenze last minute'));
  a.render().filter(n => n.props?.className === 'opt classification').at(-1).props.children[0].props.onClick();
  assert.equal(JSON.parse(a.requests[0].options.body).classification, null);
  await resolveEntry(a, { ...response, state: { ...changed, absenceKinds: {} } }); assert.equal(groupFor(a, 'Anna'), 'Assenze programmate');
  a.render().find(n => n.props?.['aria-label'] === 'Rimuovi Anna').props.onClick();
  await resolveEntry(a, { ...response, state: { ...state, abs: {}, absenceKinds: {}, permitKinds: { [todayYmd]: { a: 'planned', b: 'last_minute' } } } });
  assert.equal(groupFor(a, 'Anna'), 'Assenze programmate'); assert.equal(groupFor(a, 'Barbara'), 'Assenze last minute');
});
test('permit classification loads saved choice and keeps separate creation preference', async () => {
  const a = await permitsLoaded(); clickText(a, 'Last minute');
  permitTeacher(a).props.onChange({ target: { value: 'cont' } }); permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  permitDay(a).props.onChange({ target: { value: '12/10/2026' } }); permitHour(a, 2).props.onClick(); permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(a.requests[0].options.body).classification, 'last_minute');
  a.requests.shift().resolve({ ok: true }); await settle();
  const response = { ...permitData, permessi: { '2026-10-12': { t: [2] } }, permitKinds: { '2026-10-12': { t: 'planned' } } };
  a.requests.shift().resolve(response); await settle(); assert.equal(pressed(a, 'Last minute'), true);
  a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick(); assert.equal(pressed(a, 'Programmata'), true);
  clickText(a, 'Programmata'); permitForm(a).props.onSubmit({ preventDefault() {} }); assert.equal(JSON.parse(a.requests[0].options.body).classification, null);
  a.requests.shift().resolve({ ok: true }); await settle(); a.requests.shift().resolve({ ...response, permitKinds: {} }); await settle(); assert.equal(pressed(a, 'Last minute'), true);
  a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick(); assert.equal(pressed(a, 'Last minute'), false);
  clickText(a, 'Programmata'); clickText(a, 'Annulla modifica'); assert.equal(pressed(a, 'Last minute'), true);
});

test('permit dates default to today in Italian format and reject invalid calendar dates', async () => {
  const a = await permitsLoaded();
  const today = todayYmd.split('-').reverse().join('/');
  assert.equal(permitDay(a).props.value, today);
  assert.equal(a.render().find(n => n.props?.['aria-label'] === 'Data richiesta').props.value, today);
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  permitHour(a, 1).props.onClick();
  for (const value of ['31/02/2026', '10/2026', '02/29/2026']) {
    permitDay(a).props.onChange({ target: { value } });
    assert.equal(a.render().find(n => n.props?.className === 'permit-save').props.disabled, true);
    permitForm(a).props.onSubmit({ preventDefault() {} });
    assert.equal(a.requests.length, 0);
  }
  permitDay(a).props.onChange({ target: { value: '12/10/2026' } });
  a.render().find(n => n.props?.['aria-label'] === 'Data richiesta').props.onChange({ target: { value: '' } });
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const body = JSON.parse(a.requests.shift().options.body);
  assert.equal(body.day, '2026-10-12');
  assert.equal(body.requested_on, null);
});

test('saved over-limit permits keep warnings and highlight name and remaining hours', async () => {
  const a = await permitsLoaded({ '2026-10-12': { t: [1,2,3] } });
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 3);
  assert.ok(a.render().some(n => n.props?.className === 'permit-outstanding'));
  assert.ok(a.render().some(n => n.props?.className === 'permit-name' && n.props.children === 'Contartase'));
  assert.ok(a.render().some(n => n.props?.className === 'permit-remaining' && n.props.children === 3));
});

test('manual permits save an undated number of hours without absence fields', async () => {
  const a = await permitsLoaded();
  const toggle = a.render().find(n => n.type === 'input' && n.props.type === 'checkbox' && n.props.checked === false);
  toggle.props.onChange({ target: { checked: true } });
  assert.equal(permitDay(a), undefined);
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  const total = () => a.render().find(n => n.props?.['aria-label'] === 'Ore totali da recuperare');
  total().props.onChange({ target: { value: '8' } });
  assert.equal(a.render().find(n => n.props?.className === 'permit-save').props.disabled, false);
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.equal(req.url, '/api/manual-permits');
  assert.deepEqual(JSON.parse(req.options.body), { id: 't', hours: 8, note: '', editing: false });
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, manualPermits: { t: { id: 'm', hours: 8, recovered: 2, remaining: 6, recoveries: [] } } }); await settle();
  assert.ok(a.render().some(n => n.props?.className === 'permit-remaining' && n.props.children === 6));
  a.render().find(n => n.props?.['aria-label'] === 'Modifica saldo manuale di Contartase').props.onClick();
  assert.equal(total().props.value, '8');
  assert.equal(permitTeacher(a).props.disabled, true);
  total().props.onChange({ target: { value: '10' } });
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(a.requests.shift().options.body), { id: 't', hours: 10, note: '', editing: true });
});

const noteField = (a, label) => a.render().find(n => n.type === 'textarea' && n.props['aria-label'] === label);
test('manual note editor saves explicitly, preserves failed drafts and resets on source/date switches', async () => {
  const state = { ...data.state, abs: { [todayYmd]: { a: [2], b: [1] } }, absenceNotes: { [todayYmd]: { a: 'saved', b: 'Barbara note' } } };
  const response = { ...entryData, state }, a = await loaded(response);
  const edit = name => a.render().find(n => n.props?.['aria-label'] === `Modifica assenza di ${name}`).props.onClick();
  edit('Anna');
  assert.equal(noteField(a, 'Note assenza di Anna').props.value, 'saved');
  noteField(a, 'Note assenza di Anna').props.onChange({ target: { value: 'draft' } });
  assert.equal(a.requests.length, 0);
  clickText(a, 'Salva nota');
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { day: todayYmd, group: 'abs', id: 'a', hours: [2], note: 'draft' });
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.equal(noteField(a, 'Note assenza di Anna').props.value, 'draft');
  clickText(a, 'Salva nota');
  await resolveEntry(a, { ...response, state: { ...state, absenceNotes: { [todayYmd]: { a: 'draft', b: 'Barbara note' } } } });
  edit('Barbara');
  assert.equal(noteField(a, 'Note assenza di Barbara').props.value, 'Barbara note');
  edit('Anna');
  noteField(a, 'Note assenza di Anna').props.onChange({ target: { value: '' } });
  clickText(a, 'Salva nota');
  assert.equal(JSON.parse(a.requests[0].options.body).note, '');
  await resolveEntry(a, response);
  a.render().find(n => n.props?.className === 'd').props.onClick(); a.render();
  assert.equal(noteField(a, 'Note assenza di Anna'), undefined);
});

test('permit notes load, preserve failed edits and reset after save/cancel', async () => {
  const a = app(); a.go('/permessi'); a.render();
  const response = { ...permitData, permessi: { '2026-10-12': { t: [2] } }, permitNotes: { '2026-10-12': { t: 'saved permit' } } };
  a.requests.shift().resolve(response); await settle();
  const edit = () => a.render().find(n => n.props?.['aria-label'] === 'Modifica permesso di Contartase').props.onClick();
  edit(); assert.equal(noteField(a, 'Note permesso').props.value, 'saved permit');
  noteField(a, 'Note permesso').props.onChange({ target: { value: 'changed' } });
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(a.requests[0].options.body).note, 'changed');
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.equal(noteField(a, 'Note permesso').props.value, 'changed');
  permitForm(a).props.onSubmit({ preventDefault() {} });
  a.requests.shift().resolve({ ok: true }); await settle();
  a.requests.shift().resolve(response); await settle();
  assert.equal(noteField(a, 'Note permesso').props.value, '');
  edit(); clickText(a, 'Annulla modifica');
  assert.equal(noteField(a, 'Note permesso').props.value, '');
  edit(); noteField(a, 'Note permesso').props.onChange({ target: { value: '' } });
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(a.requests[0].options.body).note, '');
});

test('daily info combines source notes, keeps permit-only information and supports focus and escape', async () => {
  for (const [manual, permit] of [[true, true], [true, false], [false, true], [false, false]]) {
    const state = { ...data.state,
      abs: manual ? { [todayYmd]: { a: [2] } } : {},
      permessi: permit ? { [todayYmd]: { a: [3] } } : {},
      absenceNotes: manual ? { [todayYmd]: { a: '<b>literal</b>\n' + 'long '.repeat(300) } } : {},
      permitNotes: permit ? { [todayYmd]: { a: 'permit note' } } : {},
    };
    const a = await loaded({ ...entryData, state });
    const info = a.render().filter(n => n.props?.className === 'hour-help' && n.props.children?.[0]?.props?.className === 'why');
    assert.equal(info.length, manual || permit ? 1 : 0);
    if (!info.length) continue;
    const trigger = info[0];
    assert.equal(trigger.props['aria-label'].includes('Assenza: <b>literal</b>'), manual);
    assert.equal(trigger.props['aria-label'].includes('Permesso: permit note'), permit);
    trigger.props.onFocus({ currentTarget: { getBoundingClientRect: () => ({ left: 20, top: 400, bottom: 420 }) } });
    const tip = a.render().find(n => n.props?.role === 'tooltip');
    assert.equal(typeof tip.props.children, 'string');
    assert.ok(tip.props.style.maxHeight > 0);
    trigger.props.onKeyDown({ key: 'Escape' });
    assert.ok(!a.render().some(n => n.props?.role === 'tooltip'));
  }
  const a = await loaded({ ...entryData, state: { ...data.state, permessi: { [todayYmd]: { a: [3] } } } });
  assert.ok(a.render().some(n => n.props?.className === 'hour-help' && n.props['aria-label'] === 'Permesso'));
});

test('trip choice saves teacher classification and groups mixed sources once', async () => {
  const a = await loaded(entryData);
  clickText(a, 'In gita');
  search(a).props.onChange({ target: { value: 'anna' } }); submitEntry(a);
  assert.equal(JSON.parse(a.requests[0].options.body).classification, 'trip');
  assert.equal(JSON.parse(a.requests[0].options.body).group, 'abs');
  const state = { ...data.state, abs: { [todayYmd]: { a: [2], b: [1], c: [3] } },
    permessi: { [todayYmd]: { a: [3], b: [2], c: [4] } },
    absenceKinds: { [todayYmd]: { a: 'trip', b: 'planned', c: 'trip' } },
    permitKinds: { [todayYmd]: { a: 'planned', b: 'trip', c: 'last_minute' } } };
  await resolveEntry(a, { ...entryData, state });
  assert.equal(groupFor(a, 'Anna'), 'In gita');
  assert.equal(groupFor(a, 'Barbara'), 'In gita');
  assert.equal(groupFor(a, 'Carla'), 'Assenze last minute');
  assert.equal(a.render().filter(n => n.props?.className === 'n' && n.props.children === 'Anna').length, 1);
  clickText(a, 'In gita');
  assert.equal(pressed(a, 'In gita'), false);
});

test('TESTING ribbon stays until the backend confirms production', async () => {
  const a = app();
  const ribbon = nodes => nodes.find(n => n.props?.className === 'testing-ribbon');
  assert.equal(ribbon(a.render()).props.children, 'TESTING');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ribbon(a.render()), undefined);
});

test('production timetable upload requires the user to confirm replacement', async () => {
  for (const approved of [false, true]) {
    const confirmations = [];
    const a = app(undefined, message => { confirmations.push(message); return approved; });
    a.go('/settings');
    const input = a.render().find(n => n.type === 'input' && n.props.type === 'file');
    input.props.onChange({ target: { files: [{ name: 'orario.json', text: async () => '{"docenti":[],"orario":[]}' }] } });
    await settle();
    assert.equal(confirmations.length, 1);
    assert.ok(confirmations[0].includes('orario.json'));
    const uploads = a.requests.filter(r => r.url.startsWith('/api/timetable'));
    assert.equal(uploads.length, approved ? 1 : 0);
    if (approved) assert.equal(uploads[0].url, '/api/timetable?confirm=true');
  }
});

test('new absence note saves with teacher, survives failure and clears after success or source/date changes', async () => {
  const a = await loaded(entryData);
  const draft = () => noteField(a, 'Note nuova assenza');
  assert.ok(draft());
  search(a).props.onChange({ target: { value: 'anna' } }); suggestion(a, 'Anna').props.onClick();
  draft().props.onChange({ target: { value: 'initial note' } });
  submitEntry(a);
  assert.equal(JSON.parse(a.requests[0].options.body).note, 'initial note');
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.equal(draft().props.value, 'initial note');
  assert.equal(search(a).props.value, 'Anna');
  submitEntry(a);
  await resolveEntry(a, { ...entryData, state: { ...data.state, abs: { [todayYmd]: { a: [1,2,3,4,5,6,7] } }, absenceNotes: { [todayYmd]: { a: 'initial note' } } } });
  assert.equal(draft().props.value, '');
  assert.ok(a.render().some(n => n.props?.className === 'hour-help' && n.props['aria-label'] === 'Assenza: initial note'));
  draft().props.onChange({ target: { value: 'discard' } });
  clickText(a, 'A disposizione'); a.render(); assert.equal(draft(), undefined);
  clickText(a, 'A disposizione'); assert.equal(draft().props.value, '');
  draft().props.onChange({ target: { value: 'class note' } });
  search(a).props.onChange({ target: { value: '1a' } }); suggestion(a, '1A').props.onClick();
  assert.equal(draft(), undefined); submitEntry(a);
  assert.ok(!('note' in JSON.parse(a.requests[0].options.body))); await resolveEntry(a);
  search(a).props.onChange({ target: { value: 'bar' } });
  draft().props.onChange({ target: { value: 'date note' } });
  a.render().find(n => n.props?.className === 'd').props.onClick(); a.render();
  assert.equal(draft().props.value, '');
});

test('both Permessi creation modes show notes before teacher selection and save manual balance drafts', async () => {
  const a = await permitsLoaded();
  const note = () => noteField(a, 'Note permesso');
  assert.ok(note());
  note().props.onChange({ target: { value: 'dated draft' } });
  const toggle = checked => a.render().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked } });
  toggle(true); assert.equal(note().props.value, '');
  note().props.onChange({ target: { value: 'manual draft' } });
  permitTeacher(a).props.onChange({ target: { value: 'cont' } });
  permitTeacher(a).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(note().props.value, 'manual draft');
  a.render().find(n => n.props?.['aria-label'] === 'Ore totali da recuperare').props.onChange({ target: { value: '8' } });
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.equal(a.requests[0].url, '/api/manual-permits');
  assert.equal(JSON.parse(a.requests[0].options.body).note, 'manual draft');
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.equal(note().props.value, 'manual draft');
  permitForm(a).props.onSubmit({ preventDefault() {} });
  a.requests.shift().resolve({ ok: true }); await settle();
  const response = { ...permitData, manualPermits: { t: { id:'m', hours:8, recovered:0, remaining:8, recoveries:[] } }, manualPermitNotes: { t:'manual draft' } };
  a.requests.shift().resolve(response); await settle();
  assert.equal(note().props.value, '');
  a.render().find(n => n.props?.['aria-label'] === 'Modifica saldo manuale di Contartase').props.onClick();
  assert.equal(note().props.value, 'manual draft');
  clickText(a, 'Annulla modifica'); assert.equal(note().props.value, '');
  toggle(false); assert.ok(note());
});

test('dated and undated tables expose only their own note with focusable info icons', async () => {
  const a = app(); a.go('/permessi'); a.render();
  const response = { ...permitData, permessi: { '2026-10-12': { t:[6] } }, permitNotes: { '2026-10-12': { t:'<b>dated</b>' } },
    manualPermits: { t: { id:'m',hours:8,recovered:0,remaining:8,recoveries:[] } }, manualPermitNotes: { t:'manual note' } };
  a.requests.shift().resolve(response); await settle();
  const infos = () => a.render().filter(n => n.props?.className === 'hour-help' && n.props.children?.[0]?.props?.className === 'why');
  assert.deepEqual(infos().map(n => n.props['aria-label']), ['<b>dated</b>', 'manual note']);
  assert.ok(infos().every(n => n.props.tabIndex === 0));
  assert.ok(a.render().some(n => n.props?.className === 'warning-icon'));
  const dated = infos()[0];
  dated.props.onFocus({ currentTarget: { getBoundingClientRect: () => ({left:20,top:200,bottom:220}) } });
  assert.equal(a.render().find(n => n.props?.role === 'tooltip').props.children, '<b>dated</b>');
  dated.props.onKeyDown({key:'Escape'});
  a.render().find(n => n.props?.['aria-label'] === 'Modifica saldo manuale di Contartase').props.onClick();
  noteField(a, 'Note permesso').props.onChange({target:{value:''}});
  permitForm(a).props.onSubmit({preventDefault(){}});
  a.requests.shift().resolve({ok:true}); await settle();
  a.requests.shift().resolve({...response,manualPermitNotes:{}}); await settle();
  assert.deepEqual(infos().map(n=>n.props['aria-label']), ['<b>dated</b>']);
  assert.ok(a.render().some(n=>n.props?.className==='warning-icon'));
});
