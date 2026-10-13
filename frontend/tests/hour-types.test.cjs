const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function component(file, confirm = () => true) {
  const slots = []; let cursor = 0; const effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; },
    useRef: () => ({ current: null }),
    useEffect(fn) { if (!effects.length) effects.push(fn); },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, window: { confirm }, document: { addEventListener() {}, removeEventListener() {} },
    require(id) { if (id === 'react') return react; if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }; throw Error(id); },
  });
  return { render(props) { cursor = 0; const tree = Object.values(exports)[0](props); const nodes = []; function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); } walk(tree); return nodes; }, start() { effects.forEach(f => f()); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('type controls retain saved values on failure and update after successful save', async () => {
  const c = component('src/HourTypes.tsx'); let fail = false; const calls = [];
  const policy = { label: 'PE', available: false, visible: true, school: null, color: 'blue' };
  const api = async (url, body) => { calls.push(body); if (!body) return { types: { 'code:PE': policy }, needsReimport: false }; if (fail) throw Error('Save failed'); return { 'code:PE': { ...policy, ...body } }; };
  const props = { api }; c.render(props); c.start(); await settle();
  const control = () => c.render(props).find(n => n.props?.['aria-label'] === 'PE: Disponibile per supplenze');
  fail = true; await control().props.onChange({ target: { checked: true } }); await settle();
  assert.equal(control().props.checked, false);
  assert.ok(c.render(props).some(n => n.props?.role === 'alert'));
  fail = false; control().props.onChange({ target: { checked: true } }); await settle();
  assert.equal(control().props.checked, true);
  assert.equal(calls.at(-1).id, 'code:PE'); assert.equal(calls.at(-1).school, null);
});
test('occupied candidates require confirmation and hard blocked buttons stay disabled', () => {
  for (const accepted of [false, true]) {
    const assigned = []; const confirmations = [];
    const c = component('src/CandidateDrawer.tsx', message => { confirmations.push(message); return accepted; });
    const nodes = c.render({ open: { h: 2, c: '1A', ids: [] }, name: x => x, busy: false, onClose() {}, onAssign: (...args) => assigned.push(args), cands: [
      { id: 't', name: 'Teacher', ty: 'C', typeLabel: 'Compresenza ITP', exceptional: true, color: 'purple', why: '', total: 0, today: 0 },
      { id: 'blocked', name: 'Absent', ty: 'C', exceptional: true, why: 'Assente', total: 0, today: 0 },
    ] });
    const buttons = nodes.filter(n => n.type === 'button' && n.props.className?.includes('c1'));
    buttons[0].props.onClick(); assert.equal(assigned.length, accepted ? 1 : 0);
    assert.ok(confirmations[0].includes('Compresenza ITP'));
    assert.equal(buttons[1].props.disabled, true);
    assert.ok(nodes.some(n => n.props.className === 'type-chip palette-purple'));
  }
});


test('RP groups retain server ordering, badges, explanations and blocked transfer state', () => {
  const c = component('src/CandidateDrawer.tsx'); const assigned = [];
  const nodes = c.render({ open: { h: 4, c: '1A', ids: [], sede: 'centrale' }, name: x => x, busy: false, onClose() {}, onAssign: id => assigned.push(id), cands: [
    { id: 'good', name: 'Good', ty: 'RP', convenient: true, typeLabel: 'RP · Recupero permesso', tag: 'Ora favorevole · 2 ore disponibili', why: '', total: 0, today: 0 },
    { id: 'normal', name: 'Normal', ty: 'D', why: '', total: 0, today: 0 },
    { id: 'occupied', name: 'Occupied', ty: 'C', exceptional: true, why: '', total: 0, today: 0 },
    { id: 'other', name: 'Other', ty: 'RP', convenient: false, why: 'Cambio sede senza intervallo', total: 0, today: 0 },
  ] });
  const buttons = nodes.filter(n => n.type === 'button' && n.props.className?.includes('c1'));
  assert.equal(buttons[3].props.disabled, true);
  buttons[0].props.onClick(); assert.deepEqual(assigned, ['good']);
  assert.equal(nodes.filter(n => n.type === 'h3').map(n => n.props.children).join('|'), 'Recuperi permesso · ore favorevoli|Solo in caso di necessità|Altri recuperi permesso');
  assert.ok(nodes.some(n => n.props.className === 'type-chip type-rp'));
});
