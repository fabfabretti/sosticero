const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function components() {
  let slots = [], cursor = 0, cleanups = [], readers = [];
  const jsx = (type, props) => ({ type, props });
  const state = initial => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], value => { slots[i] = value; }];
  };
  const react = {
    useState: state,
    useId: () => "test-info",
    useRef(initial) { const [value] = state({ current: initial }); return value; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; cleanups.push(fn()); } },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/Attachments.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, encodeURIComponent, setTimeout, clearTimeout, window: { innerWidth: 400, innerHeight: 600, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({matches:true}) },
    FileReader: class { constructor() { readers.push(this); } readAsDataURL() {} },
    require(id) { return id === 'react' ? react : { jsx, jsxs: jsx }; },
  });
  function render(name, props) {
    cursor = 0;
    const nodes = [];
    function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      nodes.push(node); walk(node.props.children);
    }
    walk(exports[name](props));
    return nodes;
  }
  return { render, readers, unmount() { cleanups.forEach(fn => fn?.()); } };
}

test('paste validates clipboard content, previews, removes and ignores late reads after unmount', async () => {
  const c = components(); let value, changes = 0;
  const props = () => ({ value, onChange: next => { value = next; changes++; } });
  const nodes = () => c.render('AttachmentField', props());
  const paste = file => nodes().find(n => n.props.onPaste).props.onPaste({ preventDefault() {}, clipboardData: { items: file ? [{ kind: 'file', type: file.type, getAsFile: () => file }] : [] } });
  await paste(null);
  assert.match(nodes().find(n => n.props.role === 'alert').props.children, /PNG/);
  await paste({ type: 'image/png', size: 5_242_881 });
  assert.match(nodes().find(n => n.props.role === 'alert').props.children, /5 MiB/);
  assert.equal(changes, 0);
  await paste({ type: 'image/png', size: 10 });
  c.readers[0].result = 'data:image/png;base64,aGVsbG8='; c.readers[0].onload();
  assert.equal(value.data, 'aGVsbG8=');
  assert.equal(nodes().find(n => n.type === 'img').props.src, c.readers[0].result);
  nodes().find(n => n.type === 'button').props.onClick();
  assert.equal(value, null);
  await paste({ type: 'image/png', size: 10 });
  c.unmount(); c.readers[1].result = 'data:image/png;base64,bGF0ZQ=='; c.readers[1].onload();
  assert.equal(value, null);
});

test('all information uses native click toggling, anchored positioning and Escape focus return', () => {
  const c = components();
  const nodes = c.render('RecordInfo', { text: '<b>literal</b>', links: [{ label: 'Apri allegato assenza', id: 'abc' }] });
  const trigger = nodes.find(n => n.type === 'button'), popup = nodes.find(n => n.props.popover);
  let closed = false, focused = false;
  trigger.props.ref.current = { focus() { focused = true; }, getBoundingClientRect: () => ({ left: 20, top: 400, bottom: 414 }) };
  popup.props.ref.current = { style: {}, hidePopover() { closed = true; } };
  assert.equal(trigger.props.popoverTarget, popup.props.id);
  assert.equal(trigger.props.popoverTargetAction, 'toggle');
  assert.equal(nodes[0].props.onMouseEnter, undefined);
  assert.equal(trigger.props.onFocus, undefined);
  trigger.props.onClick();
  assert.equal(popup.props.ref.current.style.left, '20px');
  assert.equal(popup.props.ref.current.style.top, '394px');
  assert.equal(popup.props.ref.current.style.transform, 'translateY(-100%)');
  const link = nodes.find(n => n.type === 'a');
  assert.equal(link.props.href, '/api/attachments/abc'); assert.equal(link.props.target, '_blank'); assert.equal(link.props.rel, 'noopener');
  assert.equal(nodes.find(n => n.type === 'p').props.children, '<b>literal</b>');
  popup.props.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.ok(closed && focused);
  c.unmount();
});
