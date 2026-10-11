const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// Run the actual App handlers with deferred HTTP responses and minimal hook storage.
function app() {
  const slots = [], effects = [], requests = [];
  let cursor = 0, App;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = value; }];
    },
    useRef(initial) {
      const i = cursor++;
      return slots[i] ??= { current: initial };
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((d, j) => d !== slots[i][j])) effects.push(fn);
      slots[i] = deps;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const code = ts.transpileModule(readFileSync('src/main.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    exports: {}, URLSearchParams, Date,
    document: { getElementById: () => ({}) },
    fetch(url) {
      return new Promise(resolve => requests.push({
        url,
        resolve: data => resolve({ ok: true, json: async () => data }),
      }));
    },
    require(id) {
      if (id === 'react') return { ...react, default: { Fragment: 'fragment' } };
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === 'react-dom/client') return {
        createRoot: () => ({ render: element => { App = element.type; } }),
      };
      if (id === './CandidateDrawer') return { CandidateDrawer: 'drawer' };
      if (id.endsWith('.css')) return {};
      throw Error(id);
    },
  });
  function render() {
    cursor = 0;
    const tree = App();
    effects.splice(0).forEach(fn => fn());
    const nodes = [];
    function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      nodes.push(node);
      walk(node.props?.children);
    }
    walk(tree);
    return nodes;
  }
  return { render, requests };
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
