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
const row = { k: 'r', id: 't', h: 1, c: '1A', sede: 'centrale' };
const data = {
  dataset: { teachers: {}, classes: [], warnings: [] },
  state: { abs: {}, cf: {}, dis: {}, disSites: {}, asg: {} },
  rows: [row], issues: [],
};
async function loaded() {
  const a = app();
  a.render();
  a.requests.shift().resolve(data);
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
