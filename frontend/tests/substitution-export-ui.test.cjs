const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function component() {
  const slots = [], effects = [], revoked = [], calls = [];
  let cursor = 0, fail = false, nextUrl = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = v; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((d, j) => d !== previous.deps[j])) effects.push(() => {
        previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/SubstitutionExportPanel.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL: { createObjectURL: () => 'blob:test-' + ++nextUrl, revokeObjectURL: u => revoked.push(u) }, require(id) {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === './substitutionExport') return { projectExport(data, day, choice) { calls.push({ data, day, choice }); return { warnings: ['Example warning'] }; } };
    if (id === './substitutionPdf') return { generateSubstitutionPdf() { if (fail) throw Error('PDF failure'); return { output: () => ({}) }; } };
    throw Error(id);
  } });
  return {
    calls, revoked, fail() { fail = true; },
    render(props) {
      cursor = 0;
      const tree = exports.SubstitutionExport(props), nodes = [];
      function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); }
      walk(tree);
      effects.splice(0).forEach(f => f());
      return nodes;
    },
    unmount() { slots.forEach(s => s?.cleanup?.()); },
  };
}
const props = () => ({ data: {}, day: '2026-10-19', initialChoice: 'both', disabled: false, specialLabel: () => undefined });
const button = nodes => nodes.find(n => n.type === 'button');
const choice = (c, p, value = 'both') => c.render(p).find(n => n.type === 'select').props.onChange({ target: { value } });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('campus selection defaults to the page; download and print share the generated dated PDF and revoke on replacement/unmount', async () => {
  const c = component(), p = props();
  c.render(p);
  assert.equal(button(c.render(p)).props.disabled, false);
  assert.equal(c.render(p).find(n => n.type === 'select').props.value, 'both');
  choice(c, p);
  await button(c.render(p)).props.onClick(); await settle();
  const links = c.render(p).filter(n => n.type === 'a');
  assert.equal(links.length, 2);
  assert.equal(links[0].props.href, links[1].props.href);
  assert.equal(links[0].props.download, 'supplenze-2026-10-19-entrambe.pdf');
  assert.equal(links[1].props.target, '_blank');
  assert.equal(c.calls[0].day, p.day);
  assert.equal(c.calls[0].choice, 'both');
  choice(c, p, 'succursale'); c.render(p);
  assert.deepEqual(c.revoked, ['blob:test-1']);
  await button(c.render(p)).props.onClick(); await settle(); c.render(p); c.unmount();
  assert.deepEqual(c.revoked, ['blob:test-1', 'blob:test-2']);
});

test('pending loads/mutations disable generation and changed snapshots clear output', async () => {
  const c = component(), p = props(); c.render(p); choice(c, p);
  p.disabled = true;
  assert.equal(button(c.render(p)).props.disabled, true);
  await button(c.render(p)).props.onClick(); assert.equal(c.calls.length, 0);
  p.disabled = false;
  button(c.render(p)).props.onClick();
  p.data = {}; c.render(p);
  await settle();
  assert.equal(c.render(p).filter(n => n.type === 'a').length, 0);
  p.disabled = true;
  await button(c.render(p)).props.onClick();
  assert.equal(c.render(p).filter(n => n.type === 'a').length, 0);
});

test('generation failure exposes an error and restores the control', async () => {
  const c = component(), p = props(); c.render(p); choice(c, p); c.fail();
  button(c.render(p)).props.onClick(); await settle();
  const nodes = c.render(p);
  assert.ok(nodes.some(n => n.props.role === 'alert' && n.props.children.includes('PDF failure')));
  assert.equal(button(nodes).props.disabled, false);
});

test('the page campus is preselected while manual changes survive data refresh', () => {
  for (const campus of ['centrale', 'succursale', 'both']) {
    const c = component(), p = { ...props(), initialChoice: campus };
    c.render(p);
    assert.equal(c.render(p).find(n => n.type === 'select').props.value, campus);
    choice(c, p, 'succursale');
    p.data = {}; c.render(p);
    assert.equal(c.render(p).find(n => n.type === 'select').props.value, 'succursale');
  }
});
