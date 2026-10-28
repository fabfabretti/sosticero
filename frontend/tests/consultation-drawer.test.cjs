const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function render(props) {
  const effects = [], cleanups = [], listeners = new Map(), nodes = [];
  let restored = false, focused = false;
  const trigger = { focus() { restored = true; } };
  const document = {
    activeElement: trigger,
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: event => listeners.delete(event),
    querySelectorAll: () => nodes.filter(n => n.type === 'button' && !n.props.disabled),
  };
  const exports = {}, jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync('src/CandidateDrawer.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, document, window: { confirm() { throw Error('Unexpected confirmation'); } }, require(id) {
    if (id === 'react') return { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    throw Error(id);
  } });
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    if (node.props?.ref) node.props.ref.current = { focus() { focused = true; } };
    walk(node.props?.children);
  }
  walk(exports.CandidateDrawer(props));
  effects.forEach(fn => cleanups.push(fn()));
  return { nodes, listeners, focused: () => focused, restored: () => restored, unmount: () => cleanups.forEach(fn => fn()) };
}
const candidate = { id: 'pot', name: 'Available Teacher', ty: 'POT', loc: 'centrale', campus: 'centrale', today: 0, total: 0, clsWeek: ['1A'] };

test('consultation reuses guarded buttons, labels campuses and restores focus on Escape close', () => {
  let assignments = 0, closes = 0;
  const c = render({ open: { h: 2, sede: null }, cands: [candidate, { ...candidate, id: 'unknown', campus: null, loc: null }], busy: false,
    name: id => id, onAssign: () => assignments++, onClose: () => closes++ });
  assert.ok(c.focused());
  assert.equal(c.nodes.find(n => n.props?.role === 'dialog').props['aria-label'], 'Consulta disponibilità');
  assert.ok(c.nodes.some(n => n.props?.children === 'Solo consultazione'));
  assert.ok(c.nodes.some(n => n.props?.children === 'Sede non indicata'));
  const buttons = c.nodes.filter(n => n.type === 'button' && n.props.className?.startsWith('c1'));
  assert.equal(buttons.length, 2);
  for (const button of buttons) { assert.equal(button.props['aria-disabled'], true); button.props.onClick(); }
  assert.equal(assignments, 0);
  c.listeners.get('keydown')({ key: 'Escape' }); assert.equal(closes, 1);
  c.unmount(); assert.ok(c.restored()); assert.equal(c.listeners.size, 0);
  let returned = 0;
  const delayed = render({ open: { h: 2, sede: 'centrale' }, cands: [], busy: false, name: id => id,
    onAssign() {}, onClose() {}, returnFocus: { focus() { returned++; } } });
  delayed.unmount(); assert.equal(returned, 1);
});

test('empty consultation explains the result; real-row cross-campus read-only and assignment behavior stay intact', () => {
  const base = { cands: [], busy: false, name: id => id, onClose() {}, onAssign() {} };
  const empty = render({ ...base, open: { h: 7, sede: 'succursale' } });
  assert.ok(empty.nodes.some(n => n.props?.role === 'status' && n.props.children.includes('Nessun docente')));
  const open = { h: 2, sede: 'centrale', c: '1A', ids: ['absent'] };
  let assigned = 0;
  for (const readOnlyReason of ['Assegnazione riservata alla sede centrale', undefined]) {
    const c = render({ ...base, open, readOnlyReason, cands: [candidate], onAssign: () => assigned++ });
    assert.equal(c.nodes.find(n => n.props?.role === 'dialog').props['aria-label'], 'Scegli il supplente');
    c.nodes.find(n => n.type === 'button' && n.props.className === 'c1').props.onClick();
  }
  assert.equal(assigned, 1);
});
