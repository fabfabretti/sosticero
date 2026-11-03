const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

test('manual dialog warns but permits occupied teachers and submits an optional note', () => {
  const slots = []; let cursor = 0; const calls = [];
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/ManualAssignmentDialog.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require(id) {
      if (id === './timetables') return { norm: value => value.toLowerCase() };
      if (id === 'react') return { useRef: () => ({current: null}), useEffect() {}, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = v]; } };
      return { jsx, jsxs: jsx };
    },
  });
  const props = { teachers: [{id: 'busy', name: 'Rossi', tag: 'Ora occupata: 2A'}, {id: 'free', name: 'Bianchi', tag: ''}], hour: 2, onClose() {}, onAssign: (...args) => calls.push(args) };
  function render() { cursor = 0; const nodes = []; (function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); })(exports.ManualAssignmentDialog(props)); return nodes; }
  let nodes = render();
  assert.equal(nodes.find(n => n.type === 'button' && n.props.children === 'Assegna').props.disabled, true);
  assert.ok(!nodes.some(n => n.type === 'select'));
  nodes.find(n => n.type === 'input').props.onChange({target: {value: 'ros'}});
  nodes = render();
  assert.equal(nodes.filter(n => n.props?.role === 'option').length, 1);
  nodes.find(n => n.props?.role === 'option').props.onClick();
  nodes = render();
  assert.ok(nodes.some(n => n.props?.role === 'alert'));
  assert.equal(nodes.find(n => n.type === 'button' && n.props.children === 'Assegna comunque').props.disabled, false);
  nodes.find(n => n.type === 'textarea').props.onChange({target: {value: 'Accordo con docente'}});
  render().find(n => n.type === 'form').props.onSubmit({preventDefault() {}});
  assert.deepEqual(calls, [['busy', true, 'MANUAL', 'Accordo con docente']]);
  render().find(n => n.type === 'input').props.onChange({target: {value: 'bian'}});
  nodes = render();
  assert.ok(!nodes.some(n => n.props?.role === 'alert'));
  nodes.find(n => n.type === 'input').props.onKeyDown({key: 'Enter', preventDefault() {}});
  nodes = render();
  assert.equal(nodes.find(n => n.type === 'input').props.value, 'Bianchi');
  assert.ok(!nodes.some(n => n.props?.role === 'option'));
  assert.equal(calls.length, 1);

});
