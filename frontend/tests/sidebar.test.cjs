const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// The shared norm()/grid helper main.tsx imports; loaded once for the require map.
const timetables = (() => {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/timetables.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports });
  return exports;
})();

// HourHelp, rendered by the walker below; minimal hooks suffice for node inspection.
const tooltip = (() => {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const react = { useRef: initial => ({ current: initial }), useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] };
  runInNewContext(ts.transpileModule(readFileSync('src/Tooltip.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    throw Error(id);
  }, setTimeout, clearTimeout });
  return exports;
})();

// Run the actual App handlers with deferred HTTP responses and minimal hook storage.
function app(localStorage = { getItem: () => null, setItem() {} }, confirm = () => false, campus = 'centrale') {
  const effects = [], requests = [], comps = new Map(), timers = [];
  const listeners = new Map();
  const document = { documentElement: { dataset: {} }, activeElement: null, visibilityState: 'visible',
    getElementById: () => ({ focus() {} }), querySelectorAll: () => [],
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn) };

  const inboxStatus = { pending: 0 };
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
      return [e.slots[i].value, value => { e.slots[i] = { value: typeof value === "function" ? value(e.slots[i].value) : value }; }];
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
      if (!(i in e.slots) || (!deps || deps.some((d, j) => d !== e.slots[i].value?.[j])))
        effects.push(() => { e.slots[i]?.cleanup?.(); e.slots[i] = { value: deps, cleanup: fn() }; });

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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let ApiErrorClass;
  const fetcher = (url, options) => {
      if (url === '/api/environment') return Promise.resolve({ ok: true, json: async () => ({ testing: false }) });
      return new Promise(resolve => requests.push({
        url, options,
        resolve: (data, ok = true, status = ok ? 200 : 422) => resolve({ ok, status, json: async () => data && typeof data === "object" && !Array.isArray(data) ? { concurrency: { records: {}, dates: {} }, ...data } : data }),
      }));
    };
  runInNewContext(code, {
    exports: {}, URLSearchParams, Date, localStorage, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {},
    window: { innerWidth: 1024, innerHeight: 768, confirm },
    document,
    fetch: fetcher,
    require(id) {
      if (id === './Auth') return { Auth: ({children}) => children, useAccount: () => ({ id:'test', username:'test', name:'Test', campus }) };
      if (id === './session') return { requestApi: async (url, body) => {
        const response = await fetcher('/api/'+url, body === undefined ? undefined : {method:'POST',body:JSON.stringify(body)});
        const data = await response.json(); if (!response.ok) throw new ApiErrorClass(response.status,data.detail); return data;
      }};
      if (id === './concurrency' || id === './useQuietRefresh') {
        const exports = {};
        runInNewContext(ts.transpileModule(readFileSync('src/' + id.slice(2) + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
          exports, require: () => ({ ...react, useLayoutEffect: react.useEffect }),
          document,
          setInterval: fn => { timers.push(fn); return timers.length; }, clearInterval() {},
        });
        if (id === './concurrency') ApiErrorClass=exports.ApiError;
        return exports;
      }
      if (id === 'react') return { ...react, default: { Fragment: 'fragment' } };
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === 'react-dom/client') return {
        createRoot: () => ({ render: element => { App = element.type; } }),
      };
      if (id === './TimetableImport') return { TimetableImport: 'timetable-import' };
      if (id === './SettingsGroup') {
        const exports = {};
        runInNewContext(ts.transpileModule(readFileSync('src/SettingsGroup.tsx', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText, {exports, require: () => ({jsx, jsxs: jsx})});
        return exports;
      }
      if (id === './Receptions') return { ReceptionImport: 'reception-import' };
      if (id === './HourTypes') return { HourTypes: 'hour-types' };
      if (id === './CandidateDrawer') return { CandidateDrawer: 'drawer' };
      if (id === './ClassificationChoices') {
        const exports = {};
        runInNewContext(ts.transpileModule(readFileSync('src/ClassificationChoices.tsx', 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        }).outputText, { exports, require: () => ({ jsx, jsxs: jsx }) });
        return exports;
      }
      if (id === './Attachments') return { AttachmentField: 'attachment-field', RecordInfo: 'record-info' };
      if (id === './Inbox') return { AbsenceInbox: 'absence-inbox', SheetsSettings: 'sheets-settings', InboxNotice: () => null, useInboxStatus: () => inboxStatus };
      if (id === './Stats') return { Stats: 'stats' };
      if (id === './TeacherTimetables') return { TeacherTimetables: 'teacher-timetables' };
      if (id === './Tooltip') return tooltip;
      if (id === './SubstitutionExportPanel') return { SubstitutionExport: 'substitution-export' };
      if (id === './timetables') return timetables;
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
  return { render, requests, inboxStatus, document, timers, key: e => { for (const fn of listeners.get("keydown") || []) fn(e); }, go: p => {
    const screen = path => ['/permessi', '/settings', '/stats', '/banca-ore', '/orari'].includes(path) ? path : '/';
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
async function loaded(over = {}, campus) {
  const a = app(undefined, undefined, campus);
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
  assert.equal(ent.name, 'Entra dopo alle 08:35');
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
  a.render().find(n => n.props['aria-label'] === 'Modifica disposizione di Auto T, 2ª ora').props.onClick();
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
  assert.ok(a.render().some(n => n.type === 'record-info' && n.props.text === '1A entra dopo, 1A esce prima'), 'locked reason shown as (i) tooltip');
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
    const button = a.render().find(n => n.props['aria-label'] === `Modifica disposizione di ${name}, 2ª ora`);
    assert.equal(button.props.children.props.className, 'assigned-name');
    assert.ok(button.props['aria-description'].includes('Assegnato:'));
  }
  a.render().find(n => n.props['aria-label'] === 'Modifica disposizione di Auto T, 2ª ora').props.onClick();
  assert.equal(a.render().find(n => n.props['aria-label'] === 'Auto T, 2ª ora').props.disabled, true);
});

test('entry and exit assignments display every supplied period time', async () => {
  for (const [v, label, times] of [
    ['ENTRA', 'Entra h', ['08:35', '09:40', '10:35', '11:40', '12:35', '12:35', '13:25']],
    ['ESCE', 'Esce prima', ['', '08:35', '09:30', '10:35', '11:30', '12:35', '13:25']],
  ]) {
    for (let h = 1; h <= 7; h++) {
      const a = await loaded({
        rows: [{ ...row, h, k: `t|${h}|1A` }],
        state: { ...data.state, asg: { [todayYmd]: { [`t|${h}|1A`]: { v, t: 'SPECIAL', c: '1A' } } } },
      });
      const button = a.render().find(n => n.props?.className === 'fill ');
      assert.equal(button.props.children[0], label + (times[h - 1] ? (v === 'ENTRA' ? ' ' : ' alle ') + times[h - 1] : ''));
    }
  }
});

test('reminds about next-day class entry and exit changes', async () => {
  const tomorrow = new Date(now.getTime() + 864e5);
  const tomorrowYmd = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const a = await loaded({
    state: { abs: {}, cf: {}, dis: {}, disSites: {}, asg: {
      [tomorrowYmd]: {
        't|2|1A': { v: 'ESCE', t: 'SPECIAL', c: '1A' },
        't|7|2B': { v: 'ENTRA', t: 'SPECIAL', c: '2B' },
      },
    } },
  });
  const banner = a.render().find(n => n.props?.className === 'reminder');
  assert.ok(banner);
  const text = String(banner.props.children);
  assert.ok(text.includes('1A esce prima alle 08:35'));
  assert.ok(text.includes('2B entra dopo alle 13:25'));
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

test('shell shows brand, glasses icon and seven tabs, defaulting to Supplenze', async () => {
  const a = await loaded();
  assert.ok(a.render().find(n => n.props?.className === 'bar'), 'top bar present');
  const svg = a.render().find(n => n.type === 'svg' && n.props?.viewBox === '0 0 24 24');
  assert.ok(svg, 'glasses icon rendered');
  assert.equal(svg.props.children.props.stroke, 'currentColor', 'icon themes with currentColor');
  const links = tabLinks(a);
  assert.deepEqual(links.map(l => [l.props.href, Array.isArray(l.props.children) ? l.props.children[0] : l.props.children]), [
    ['#/', 'Supplenze'],
    ['#/permessi', 'Permessi'],
    ['#/orari', 'Orari'],
    ['#/banca-ore', 'Banca ore'],
    ['#/stats', 'Stats'],
    ['#/inbox', 'Inbox'],
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
  assert.ok(a.render().find(n => n.props?.className?.split(' ').includes('settings')), 'settings shows the management screen');
  assert.equal(currentTab(a).props.href, '#/settings');
  a.go('/');
  assert.ok(!a.render().some(n => n.props?.className === 'stub'), 'Supplenze is not a placeholder');
  a.go('/stats');
  assert.ok(a.render().some(n => n.type === 'stats'), 'Stats is functional');
  a.go('/orari');
  assert.ok(a.render().some(n => n.type === 'teacher-timetables'), 'Orari is functional');
  assert.equal(currentTab(a).props.href, '#/orari', 'Orari tab is current');
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
async function permitsLoaded(records = {}, confirm) {
  const a = app(undefined, confirm);
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
  assert.deepEqual(JSON.parse(req.options.body), { expected: { 'permessi|2026-10-12|t': 'absent' }, day: '2026-10-12', id: 't', requested_on: todayYmd, note: '', classification: null, hours: [6,7] });
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, permessi: { '2026-10-12': { t: [6,7] } } }); await settle();
  assert.equal(a.render().filter(n => n.props?.className === 'permit-period').length, 2);
  assert.ok(a.render().some(n => n.props?.className === 'permit-remaining' && n.props.children === 2));
});

test('permit errors preserve form; editing supplies original identity and deletion is explicit', async () => {
  let confirmDeletion = false;
  const a = await permitsLoaded({ '2026-10-12': { t: [2,3] } }, () => confirmDeletion);
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
  assert.equal(a.requests.length, 0, 'cancelling confirmation keeps the permit');
  confirmDeletion = true;
  a.render().find(n => n.props?.['aria-label'] === 'Rimuovi permesso di Contartase').props.onClick();
  assert.deepEqual(JSON.parse(a.requests.shift().options.body), { expected: { 'permessi|2026-10-12|t': 'absent' }, day: '2026-10-12', id: 't', hours: null });
});

test('permit absences lock and keep manual control payloads separate', async () => {
  const a = await loaded({ dataset: permitData.dataset, state: { ...data.state, abs: { [todayYmd]: { t: [2] } }, permessi: { [todayYmd]: { t: [2,3] } } } });
  const button = h => a.render().find(n => n.type === 'button' && n.props['aria-label'] === `Contartase, ${h}ª ora`);
  assert.equal(button(2).props.disabled, true);
  assert.equal(button(3).props['aria-pressed'], true);
  assert.equal(button(4).props.disabled, false);
  assert.ok(a.render().some(n => n.type === 'record-info' && n.props.text === 'Permesso'), 'permit reason shown in information popover');
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
  assert.equal(a.render().find(n => n.props?.className?.split(' ').includes('permit-save')).props.disabled, false);
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(a.requests.shift().options.body).hours, [1,2,3]);
  permitHour(a,3).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'warning-icon').length, 0);
  assert.equal(a.render().find(n => n.props?.className?.split(' ').includes('permit-save')).props.disabled, false);
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
const openEntry = a => clickText(a, '+ Aggiungi');
const search = a => a.render().find(n => n.props?.id === 'q');
const submitEntry = a => a.render().find(n => n.type === 'form' && n.props.className === 'entry-form ui-form').props.onSubmit({ preventDefault() {} });
const entrySubmit = a => a.render().find(n => n.props?.className?.split(' ').includes('entry-submit'));
const suggestion = (a, name) => a.render().find(n => n.type === 'button' && n.props.children?.[0] === name && n.props.children?.[1]?.type === 'small');
const pressed = (a, text) => a.render().find(n => n.type === 'button' && n.props.children === text).props['aria-pressed'];
async function resolveEntry(a, response = entryData) {
  a.requests.shift().resolve({ ok: true }); await settle();
  a.requests.shift().resolve(response); await settle();
}
test('daily selection, explicit submit and Enter retain options for consecutive entries', async () => {
  const a = await loaded(entryData); openEntry(a);
  assert.equal(pressed(a, 'Tutto il giorno'), true);
  assert.ok(!a.render().some(n => n.props?.children === 'Più giorni'));
  search(a).props.onChange({ target: { value: 'anna' } }); suggestion(a, 'Anna').props.onClick();
  assert.equal(a.requests.length, 0);
  clickText(a, 'Tutto il giorno'); assert.equal(entrySubmit(a).props.disabled, true);
  submitEntry(a); assert.equal(a.requests.length, 0);
  for (const h of [2,3]) a.render().find(n => n.props?.['aria-label'] === `Aggiungi ${h}ª ora`).props.onClick();
  clickText(a, 'Programmata'); submitEntry(a);
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { expected: { ['abs|' + todayYmd + '|a']: 'absent' }, day: todayYmd, group: 'abs', id: 'a', hours: [2,3], site: 'centrale', defaults: false, classification: 'planned', note: '' });
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
  const a = await loaded(entryData); openEntry(a);
  search(a).props.onChange({ target: { value: 'a' } });
  search(a).props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  search(a).props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() {} }); assert.equal(a.requests.length, 0);
  search(a).props.onKeyDown({ key: 'Enter', preventDefault() {} }); assert.equal(JSON.parse(a.requests[0].options.body).id, 'b');
  a.requests.shift().resolve({ detail: 'Errore prova' }, false); await settle(); assert.equal(search(a).props.value, 'a');
  assert.ok(a.render().some(n => n.props?.role === 'alert' && n.props.children.includes('Errore prova')));
  search(a).props.onChange({ target: { value: 'anna' } }); suggestion(a, 'Anna').props.onClick();
  search(a).props.onChange({ target: { value: 'missing' } }); assert.equal(entrySubmit(a).props.disabled, true);
  submitEntry(a); assert.equal(a.requests.length, 0);
  a.key({ key: 'Escape', preventDefault() {} }); assert.equal(search(a), undefined); openEntry(a); assert.equal(search(a).props.value, '');
});
test('availability and class entries omit classification while defaults and campus persist', async () => {
  const a = await loaded(entryData); openEntry(a); clickText(a, 'Last minute'); clickText(a, 'A disposizione');
  assert.ok(!a.render().some(n => n.props?.children === 'Last minute'));
  a.render().find(n => n.props?.className === 'dis-location').props.children[1].props.onChange({ target: { value: 'succursale' } });
  search(a).props.onChange({ target: { value: 'anna' } }); submitEntry(a);
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { expected: { ['dis|' + todayYmd + '|a']: 'absent' }, day: todayYmd, group: 'dis', id: 'a', hours: [1,2,3,4,5,6,7], site: 'succursale', defaults: true });
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
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { expected: { ['abs|' + todayYmd + '|a']: 'absent' }, day: todayYmd, group: 'abs', id: 'a', hours: [2], classification: 'planned' });
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
    assert.equal(a.render().find(n => n.props?.className?.split(' ').includes('permit-save')).props.disabled, true);
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

test('saved over-limit permits keep warnings and identify outstanding balances', async () => {
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
  assert.equal(a.render().find(n => n.props?.className?.split(' ').includes('permit-save')).props.disabled, false);
  permitForm(a).props.onSubmit({ preventDefault() {} });
  const req = a.requests.shift();
  assert.equal(req.url, '/api/manual-permits');
  assert.deepEqual(JSON.parse(req.options.body), { expected: { 'manualPermits||t': 'absent' }, id: 't', hours: 8, note: '', editing: false });
  req.resolve({ ok: true }); await settle();
  a.requests.shift().resolve({ ...permitData, manualPermits: { t: { id: 'm', hours: 8, recovered: 2, remaining: 6, recoveries: [] } } }); await settle();
  assert.ok(a.render().some(n => n.props?.className === 'permit-remaining' && n.props.children === 6));
  a.render().find(n => n.props?.['aria-label'] === 'Modifica saldo manuale di Contartase').props.onClick();
  assert.equal(total().props.value, '8');
  assert.equal(permitTeacher(a).props.disabled, true);
  total().props.onChange({ target: { value: '10' } });
  permitForm(a).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(JSON.parse(a.requests.shift().options.body), { expected: { 'manualPermits||t': 'absent' }, id: 't', hours: 10, note: '', editing: true });
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
  clickText(a, 'Salva nota e allegato');
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { expected: { ['abs|' + todayYmd + '|a']: 'absent' }, day: todayYmd, group: 'abs', id: 'a', hours: [2], note: 'draft' });
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.equal(noteField(a, 'Note assenza di Anna').props.value, 'draft');
  clickText(a, 'Salva nota e allegato');
  await resolveEntry(a, { ...response, state: { ...state, absenceNotes: { [todayYmd]: { a: 'draft', b: 'Barbara note' } } } });
  edit('Barbara');
  assert.equal(noteField(a, 'Note assenza di Barbara').props.value, 'Barbara note');
  edit('Anna');
  noteField(a, 'Note assenza di Anna').props.onChange({ target: { value: '' } });
  clickText(a, 'Salva nota e allegato');
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

test('daily info combines source notes and keeps permit-only information', async () => {
  for (const [manual, permit] of [[true, true], [true, false], [false, true], [false, false]]) {
    const state = { ...data.state,
      abs: manual ? { [todayYmd]: { a: [2] } } : {},
      permessi: permit ? { [todayYmd]: { a: [3] } } : {},
      absenceNotes: manual ? { [todayYmd]: { a: '<b>literal</b>\n' + 'long '.repeat(300) } } : {},
      permitNotes: permit ? { [todayYmd]: { a: 'permit note' } } : {},
    };
    const a = await loaded({ ...entryData, state });
    const info = a.render().filter(n => n.type === 'record-info' && (n.props.text || n.props.links.some(link => link.id)));
    assert.equal(info.length, manual || permit ? 1 : 0);
    if (!info.length) continue;
    assert.equal(info[0].props.text.includes('Assenza: <b>literal</b>'), manual);
    assert.equal(info[0].props.text.includes('Permesso: permit note'), permit);
  }
  const a = await loaded({ ...entryData, state: { ...data.state, permessi: { [todayYmd]: { a: [3] } } } });
  assert.ok(a.render().some(n => n.type === 'record-info' && n.props.text === 'Permesso'));
});

test('trip choice saves teacher classification and groups mixed sources once', async () => {
  const a = await loaded(entryData); openEntry(a);
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

test('Settings delegates timetable imports to the reviewed version import flow', () => {
  const a = app(); a.go('/settings');
  const importer = a.render().find(n => n.type === 'timetable-import');
  assert.equal(typeof importer.props.api, 'function');
  assert.equal(typeof importer.props.onImported, 'function');
  assert.equal(a.requests.filter(r => r.url.startsWith('/api/timetable')).length, 0);
});

test('Settings groups share independent native disclosures and theme changes preserve workflow identity', () => {
  const a = app(); a.go('/settings');
  const nodes = a.render();
  assert.deepEqual(nodes.filter(node => node.props?.className === 'settings-group-title').map(node => node.props.children), ['Orari e ricevimenti', 'Regole supplenze', 'Collegamenti', 'Dati e backup', 'Aspetto']);
  const groups = nodes.filter(node => node.props?.className?.split(' ').includes('settings-group'));
  assert.equal(groups.length, 5);
  assert.ok(groups.every(node => node.type === 'details' && !node.props.open && !node.props.name));
  assert.equal(a.requests.filter(request => request.options?.method === 'POST').length, 0);
  const importer = nodes.find(node => node.type === 'timetable-import');
  nodes.find(node => node.type === 'button' && node.props.children === 'Chiaro / scuro').props.onClick();
  assert.equal(a.render().find(node => node.type === 'timetable-import').type, importer.type);
  assert.equal(a.requests.filter(request => request.options?.method === 'POST').length, 0);
});

test('Settings backup restore requires a named confirmation and exposes failures without removing the backup', async () => {
  let accepted = false; const prompts = [];
  const a = app(undefined, message => { prompts.push(message); return accepted; }); a.go('/settings'); a.render();
  a.requests.find(request => request.url === '/api/backups').resolve([{filename:'before.sqlite', created_at:'2026-10-21T09:00:00', size:2048}]);
  await settle();
  let restore = a.render().find(node => node.type === 'button' && node.props.children === 'Ripristina');
  await restore.props.onClick();
  assert.match(prompts[0], /before.sqlite.*sovrascritti/);
  assert.equal(a.requests.filter(request => request.url === '/api/backups/restore').length, 0);
  accepted = true; restore.props.onClick();
  const request = a.requests.find(request => request.url === '/api/backups/restore');
  assert.deepEqual(JSON.parse(request.options.body), {filename:'before.sqlite', confirm:true});
  request.resolve({detail:'Ripristino fallito'}, false); await settle();
  assert.ok(a.render().some(node => node.props?.role === 'alert' && String(node.props.children).includes('Ripristino fallito')));
  assert.ok(a.render().some(node => node.type === 'button' && node.props.children === 'Ripristina' && !node.props.disabled));
  a.render().find(node => node.type === 'button' && node.props.children === 'Ripristina').props.onClick();
  a.requests.filter(request => request.url === '/api/backups/restore').at(-1).resolve({ok:true}); await settle();
  a.requests.filter(request => request.url === '/api/backups').at(-1).resolve([{filename:'before.sqlite', created_at:'2026-10-21T09:00:00', size:2048}]); await settle();
  assert.ok(a.render().some(node => node.props?.role === 'status' && node.props.children === 'Backup ripristinato con successo.'));
  assert.ok(a.requests.filter(request => request.url.startsWith('/api/day/')).length > 1, 'successful restore refreshes Settings data');
});

test('Settings JSON restore names the file and cancel performs no import', async () => {
  const prompts = []; const a = app(undefined, message => { prompts.push(message); return false; }); a.go('/settings'); a.render();
  a.render().find(node => node.props?.type === 'file' && node.props.accept === '.json,application/json').props.onChange({target:{files:[{name:'archive.json',text:async()=>'{"schema":7}'}]}});
  await settle();
  a.requests.find(request => request.url === '/api/import/preview').resolve({overrides:[]}); await settle();
  assert.match(prompts[0], /archive.json.*sostituiti/);
  assert.equal(a.requests.filter(request => request.url === '/api/import').length, 0);
});

test('new absence note saves with teacher, survives failure and clears after success or source/date changes', async () => {
  const a = await loaded(entryData); openEntry(a);
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
  assert.ok(a.render().some(n => n.type === 'record-info' && n.props.text === 'Assenza: initial note'));
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
  assert.equal(draft(), undefined); openEntry(a); assert.equal(draft().props.value, '');
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

test('dated and undated tables expose only their own note', async () => {
  const a = app(); a.go('/permessi'); a.render();
  const response = { ...permitData, permessi: { '2026-10-12': { t:[6] } }, permitNotes: { '2026-10-12': { t:'<b>dated</b>' } },
    manualPermits: { t: { id:'m',hours:8,recovered:0,remaining:8,recoveries:[] } }, manualPermitNotes: { t:'manual note' } };
  a.requests.shift().resolve(response); await settle();
  const infos = () => a.render().filter(n => n.type === 'record-info' && n.props.text || n.props?.className === 'hour-help' && n.props.children?.[0]?.props?.className === 'why');
  const texts = () => infos().map(n => n.type === 'record-info' ? n.props.text : n.props['aria-label']);
  assert.deepEqual(texts(), ['<b>dated</b>', 'manual note']);
  assert.ok(a.render().some(n => n.props?.className === 'warning-icon'));
  a.render().find(n => n.props?.['aria-label'] === 'Modifica saldo manuale di Contartase').props.onClick();
  noteField(a, 'Note permesso').props.onChange({target:{value:''}});
  permitForm(a).props.onSubmit({preventDefault(){}});
  a.requests.shift().resolve({ok:true}); await settle();
  a.requests.shift().resolve({...response,manualPermitNotes:{}}); await settle();
  assert.deepEqual(texts(), ['<b>dated</b>']);
  assert.ok(a.render().some(n=>n.props?.className==='warning-icon'));
});

test('permit warning uses the timetable effective on the selected date', async () => {
  const a = app(); a.go('/permessi'); a.render();
  a.requests.shift().resolve({...permitData, timetableVersions:[
    {effective:null, dataset:permitData.dataset},
    {effective:'2026-10-19', dataset:{...permitData.dataset, lessons:{}}},
  ]});
  await settle();
  permitDay(a).props.onChange({target:{value:'12/10/2026'}});
  permitTeacher(a).props.onChange({target:{value:'cont'}});permitTeacher(a).props.onKeyDown({key:'Enter',preventDefault(){}});
  permitHour(a,1).props.onClick();
  assert.equal(a.render().filter(n => n.props?.className === 'hour-help').length, 0);
  permitDay(a).props.onChange({target:{value:'19/10/2026'}});
  assert.ok(a.render().some(n => n.props?.className === 'hour-help' && n.props['aria-label'].includes('nessuna attività')));
});

test('entry and exit blocks show one boundary time and persist Comunicato', async () => {
  const rows = [1, 2, 3, 5, 6, 7].map(h => ({ ...row, h, k: `t|${h}|${h < 4 ? '1A' : '2A'}`, c: h < 4 ? '1A' : '2A' }));
  const asg = Object.fromEntries(rows.map(r => [r.k, { v: r.h < 4 ? 'ENTRA' : 'ESCE', t: 'SPECIAL', c: r.c }]));
  const response = { ...data, rows, state: { ...data.state, asg: { [todayYmd]: asg } } };
  const a = await loaded(response);
  const labels = () => a.render().filter(n => n.type === 'button' && n.props.className === 'fill ').map(n => n.props.children[0]);
  assert.deepEqual(labels(), ['Non entrata', 'Non entrata', 'Entra h 10:35', 'Esce prima alle 11:30', 'Uscita', 'Uscita']);
  const checks = () => a.render().filter(n => n.type === 'button' && n.props['aria-label']?.startsWith('Comunicato '));
  assert.equal(checks().length, 2);
  assert.equal(checks()[0].props['aria-pressed'], false);
  checks()[0].props.onClick();
  assert.deepEqual(JSON.parse(a.requests[0].options.body), { expected: { ['asg|' + todayYmd + '|t|3|1A']: 'absent' }, day: todayYmd, key: 't|3|1A', communicated: true });
  a.requests.shift().resolve({ ok: true }); await settle();
  const updated = { ...response, state: { ...response.state, asg: { [todayYmd]: { ...asg, 't|3|1A': { ...asg['t|3|1A'], communicated: true } } } } };
  a.requests.shift().resolve(updated); await settle();
  assert.equal(checks()[0].props['aria-pressed'], true);
  assert.equal(checks()[0].props.className, 'on');
  checks()[0].props.onClick();
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.equal(checks()[0].props['aria-pressed'], true, 'failed save retains the saved status');
});


test('Inbox status changes preserve the active absence draft and current route', async () => {
  const a = await loaded(entryData); openEntry(a);
  search(a).props.onChange({ target: { value: 'anna' } });
  suggestion(a, 'Anna').props.onClick();
  noteField(a, 'Note nuova assenza').props.onChange({ target: { value: 'keep draft' } });
  a.inboxStatus.pending = 3;
  a.render();
  assert.equal(noteField(a, 'Note nuova assenza').props.value, 'keep draft');
  assert.equal(search(a).props.value, 'Anna');
  assert.equal(currentTab(a).props.href, '#/');
  assert.ok(a.render().some(n => n.props?.className === 'inbox-count' && n.props.children === 3));
});

const disTable = a => a.render().find(n => n.props?.className === 'dis-table');
const tableRows = a => disTable(a).props.children[1].props.children;
const tableHeaders = a => disTable(a).props.children[0].props.children.props.children[1].map(n => n.props.children);
const cellNames = cell => cell.props.children === '—' ? [] : cell.props.children.map(fragment => fragment.props.children[1].props.children[0].props.children.props.children);
const disFixture = () => {
  const weekday = ['dom','lun','mar','mer','gio','ven','sab'][new Date(todayYmd + 'T12:00').getDay()];
  return {
    ...data,
    dataset: { teachers: { a: { name: 'Anna' }, z: { name: 'Zeta' } }, classes: [], warnings: [], lessons: {
      [`a|${weekday}|2`]: { site: 'centrale' }, [`a|${weekday}|3`]: { site: 'succursale' },
      [`z|${weekday}|2`]: { site: 'centrale' },
    } },
    state: { ...data.state, dis: { [todayYmd]: { a: [2,4], z: [2] } } },
    autoDis: { [todayYmd]: { a: { 2: ['1A fuori'], 3: ['2A fuori'] } } },
  };
};
test('availability table groups, deduplicates and sorts teacher-hours with conditional unknown campus', async () => {
  const fixture = disFixture(), a = await loaded(fixture);
  assert.equal(tableRows(a).length, 7);
  assert.deepEqual(Array.from(tableHeaders(a)), ['Centrale', 'Succursale', 'Sconosciuto']);
  const cells = h => tableRows(a)[h-1].props.children[1];
  assert.deepEqual(Array.from(cellNames(cells(2)[0])), ['Anna','Zeta']);
  assert.deepEqual(Array.from(cellNames(cells(3)[1])), ['Anna']);
  assert.deepEqual(Array.from(cellNames(cells(4)[2])), ['Anna']);
  assert.ok(cells(1).every(cell => cell.props.children === '—'));
  // Main campus filtering must not remove unknown availability.
  a.render().find(n => n.type === 'button' && n.props.children === 'Centrale').props.onClick();
  assert.equal(tableHeaders(a).length, 3);
  a.render().find(n => n.props['aria-label'] === 'Modifica disposizione di Anna, 4ª ora').props.onClick();
  a.render().find(n => n.props['data-dis-site'] === 'a').props.onChange({ target: { value: 'centrale' } });
  assert.equal(JSON.parse(a.requests[0].options.body).site, 'centrale');
  a.requests.shift().resolve({}); await settle();
  a.requests.shift().resolve({ ...fixture, state: { ...fixture.state, disSites: { [todayYmd]: { a: 'centrale' } } } }); await settle();
  assert.equal(tableHeaders(a).length, 2);
  // The override applies to manual hours; automatic-only hour 3 stays in succursale.
  assert.deepEqual(Array.from(cellNames(cells(3)[1])), ['Anna']);
  a.render().find(n => n.props.className === 'd').props.onClick(); a.render();
  a.requests.shift().resolve(data); await settle();
  assert.equal(tableHeaders(a).length, 2);
  assert.ok(!a.render().some(n => n.props['data-dis-site'] === 'a'));
});
test('assignment styling is per hour and information retains the attachment outside the struck name', async () => {
  const fixture = disFixture();
  fixture.state.asg = { [todayYmd]: { 'x|2|1A': { v: 'a', c: '1A', t: 'D' } } };
  fixture.state.disAttachments = { [todayYmd]: { a: 'image-id' } };
  const a = await loaded(fixture);
  const nameButton = h => a.render().find(n => n.props['aria-label'] === `Modifica disposizione di Anna, ${h}ª ora`);
  assert.equal(nameButton(2).props.children.props.className, 'assigned-name');
  assert.equal(nameButton(3).props.children.props.className, undefined);
  const info = a.render().find(n => n.type === 'record-info' && n.props.text.includes('Assegnato: 1A'));
  assert.ok(info.props.text.includes('1A fuori'));
  assert.equal(info.props.links[0].id, 'image-id');
  assert.ok(!a.render().some(n => n.props['data-dis-site'] === 'a'));
  nameButton(2).props.onClick();
  a.render().find(n => n.props['aria-label'] === 'Rimuovi Anna').props.onClick();
  a.requests.shift().resolve({}); await settle();
  a.requests.shift().resolve({ ...fixture, state: { ...fixture.state, dis: {}, asg: {} } }); await settle();
  assert.equal(nameButton(2).props.children.props.className, undefined);
  assert.equal(a.render().find(n => n.props['aria-label'] === 'Anna, 2ª ora').props.disabled, true);
});


test('stale metadata save keeps text and baseline until explicit reload', async () => {
  const a = await loaded({ dataset: { teachers: { a: { name: 'Anna' } }, classes: [], warnings: [] }, state: { ...data.state, abs: { [todayYmd]: { a: [2] } }, absenceNotes: { [todayYmd]: { a: 'saved' } } }, concurrency: { records: { ['abs|' + todayYmd + '|a']: 'old-token' }, dates: {} } });
  a.render().find(n => n.props?.['aria-label'] === 'Modifica assenza di Anna').props.onClick();
  const note = () => a.render().find(n => n.props?.['aria-label'] === 'Note assenza di Anna');
  note().props.onChange({ target: { value: 'my text' } });
  a.render().find(n => n.type === 'button' && n.props.children === 'Salva nota e allegato').props.onClick();
  const req = a.requests.shift();
  assert.equal(JSON.parse(req.options.body).expected['abs|' + todayYmd + '|a'], 'old-token');
  req.resolve({ detail: { code: 'record_changed', message: 'Changed elsewhere' } }, false, 409); await settle();
  assert.equal(a.requests[0].url.startsWith('/api/day/'), true);
  a.requests.shift().resolve({ ...data, state: { ...data.state, abs: { [todayYmd]: { a: [2, 3] } }, absenceNotes: { [todayYmd]: { a: 'remote text' } } } }); await settle();
  assert.ok(a.render().some(n => n.props?.role === 'status' && String(n.props.children).includes('remote text')));
  assert.equal(note().props.value, 'my text');
  assert.ok(a.render().some(n => n.type === 'button' && n.props.children === 'Ricarica valori salvati'));
  a.render().find(n => n.type === 'button' && n.props.children === 'Salva nota e allegato').props.onClick();
  assert.equal(a.requests.length, 0, 'no silent retry with a fresh baseline');
});

const entryDialog = a => a.render().find(n => n.props?.role === 'dialog' && n.props['aria-labelledby'] === 'entry-title');
const descendants = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(descendants) : [node, ...descendants(node.props?.children)];
test('entry dialog trigger, dismissal, focus trap, draft reset and refresh pause', async () => {
  const a = await loaded(entryData);
  assert.equal(entryDialog(a), undefined);
  assert.ok(!descendants(a.render().find(n => n.type === 'aside')).some(n => n.type === 'form'));
  let focused = '';
  a.document.getElementById = () => ({ focus() { focused = 'search'; } });
  const trigger = a.render().find(n => n.props?.className === 'ui-button entry-trigger');
  trigger.props.ref.current = { focus() { focused = 'trigger'; } };
  openEntry(a); assert.ok(entryDialog(a)); assert.equal(focused, 'search');
  assert.equal(a.render().find(n => n.props?.className === 'app ui-scope supplenze').props.inert, true);
  const first = { focus() { focused = 'first'; } }, last = { focus() { focused = 'last'; } };
  entryDialog(a).props.ref.current = { querySelectorAll: () => [first, last] };
  a.document.activeElement = last;
  let prevented = false;
  a.key({ key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(focused, 'first'); assert.equal(prevented, true);
  a.document.activeElement = first; a.key({ key: 'Tab', shiftKey: true, preventDefault() {} }); assert.equal(focused, 'last');
  for (const timer of a.timers) timer(); await settle(); assert.equal(a.requests.length, 0);
  search(a).props.onChange({ target: { value: 'anna' } });
  noteField(a, 'Note nuova assenza').props.onChange({ target: { value: 'discard' } });
  a.key({ key: 'Escape', preventDefault() {} }); assert.equal(entryDialog(a), undefined); assert.equal(focused, 'trigger');
  openEntry(a); assert.equal(search(a).props.value, ''); assert.equal(noteField(a, 'Note nuova assenza').props.value, '');
  const backdrop = a.render().find(n => n.props?.className === 'entry-backdrop');
  backdrop.props.onClick({ target: {}, currentTarget: {} }); assert.ok(entryDialog(a), 'inside click keeps dialog open');
  const outside = {}; backdrop.props.onClick({ target: outside, currentTarget: outside }); assert.equal(entryDialog(a), undefined);
  openEntry(a); a.render().find(n => n.props?.['aria-label'] === 'Chiudi inserimento').props.onClick(); assert.equal(entryDialog(a), undefined);
  for (const timer of a.timers) timer(); await settle(); assert.equal(a.requests.length, 1, 'polling resumes after close');
});
test('opening entry cancels pending candidates and opening candidates closes entry', async () => {
  const a = await loaded(entryData);
  slot(a).props.onClick(); openEntry(a); a.requests.shift().resolve([]); await settle();
  assert.ok(entryDialog(a)); assert.equal(drawer(a), undefined);
  slot(a).props.onClick(); a.requests.shift().resolve([]); await settle();
  assert.equal(entryDialog(a), undefined); assert.ok(drawer(a));
  openEntry(a); assert.ok(entryDialog(a)); assert.equal(drawer(a), undefined);
});
test('entry campus defaults to account, persists explicit selection, confirms saves and blocks duplicates', async () => {
  const a = await loaded(entryData, 'succursale'); openEntry(a); clickText(a, 'A disposizione');
  const campus = () => a.render().find(n => n.props?.className === 'dis-location').props.children[1];
  assert.equal(campus().props.value, 'succursale');
  campus().props.onChange({ target: { value: 'centrale' } });
  search(a).props.onChange({ target: { value: 'anna' } }); submitEntry(a);
  const saved = { ...entryData, state: { ...data.state, dis: { [todayYmd]: { a: [1] } } } };
  await resolveEntry(a, saved);
  assert.equal(campus().props.value, 'centrale');
  assert.ok(descendants(entryDialog(a)).some(n => n.props?.role === 'status' && n.props.children.includes('Anna: registrazione aggiunta')));
  search(a).props.onChange({ target: { value: 'anna' } }); suggestion(a, 'Anna').props.onClick();
  assert.equal(entrySubmit(a).props.disabled, true); submitEntry(a); assert.equal(a.requests.length, 0);
  assert.ok(descendants(entryDialog(a)).some(n => n.props?.role === 'status' && JSON.stringify(n.props.children).includes('già registrato')));
});
test('entry failures and conflicting saved values are recoverable inside dialog', async () => {
  const a = await loaded(entryData); openEntry(a);
  search(a).props.onChange({ target: { value: 'anna' } }); submitEntry(a);
  a.requests.shift().resolve({ detail: 'failure' }, false); await settle();
  assert.ok(descendants(entryDialog(a)).some(n => n.props?.role === 'alert' && n.props.children.includes('failure')));
  submitEntry(a); a.requests.shift().resolve({ detail: 'changed' }, false, 409); await settle();
  a.requests.shift().resolve({ ...entryData, state: { ...data.state, abs: { [todayYmd]: { a: [2,3] } }, absenceNotes: { [todayYmd]: { a: 'remote note' } } } }); await settle();
  assert.ok(descendants(entryDialog(a)).some(n => n.props?.role === 'status' && n.props.children.includes('Ore salvate: 2, 3') && n.props.children.includes('remote note')));
  assert.equal(search(a).props.value, 'anna');
  const reload = descendants(entryDialog(a)).find(n => n.type === 'button' && n.props.children === 'Ricarica valori salvati');
  const pending = reload.props.onClick(); a.requests.shift().resolve(entryData); await pending;
  assert.ok(entryDialog(a)); assert.equal(search(a).props.value, ''); assert.equal(entrySubmit(a).props.disabled, true);
});
test('recorded classes also explain duplicate prevention', async () => {
  const a = await loaded({ ...entryData, state: { ...data.state, cf: { [todayYmd]: { '1A': [2] } } } }); openEntry(a);
  search(a).props.onChange({ target: { value: '1A' } }); suggestion(a, '1A').props.onClick();
  assert.equal(entrySubmit(a).props.disabled, true); submitEntry(a); assert.equal(a.requests.length, 0);
  assert.ok(descendants(entryDialog(a)).some(n => n.props?.role === 'status' && JSON.stringify(n.props.children).includes('già registrato')));
});
