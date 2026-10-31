const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function component(file) {
  const slots = []; let cursor = 0; const effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; },
    useEffect(fn) { effects.push(fn); },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require(id) { if (id === 'react') return react; if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }; throw Error(id); },
  });
  return { render(props) { cursor = 0; const nodes = []; function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; nodes.push(n); walk(n.props?.children); } walk(Object.values(exports)[0](props)); return nodes; }, start() { effects.splice(0).forEach(fn => fn()); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('schedule saves, disables and keeps the saved time after a failure', async () => {
  const c = component('src/PublicationSchedule.tsx'); const calls = []; let fail = false; let summary;
  const api = async (url, body) => {
    calls.push(body);
    if (!body) return { time: '07:30' };
    if (fail) throw Error('Save failed');
    return { time: body.time };
  };
  const props = { api, onSummary: value => summary = value };
  c.render(props); c.start(); await settle();
  c.render(props); c.start(); await settle();
  assert.equal(summary, 'Ogni giorno alle 07:30');
  const field = () => c.render(props).find(n => n.props?.type === 'time');
  const button = label => c.render(props).find(n => n.type === 'button' && n.props.children === label);
  assert.equal(field().props.value, '07:30');
  assert.equal(button('Salva orario').props.disabled, true);
  field().props.onChange({ target: { value: '08:00' } });
  await button('Salva orario').props.onClick(); await settle();
  assert.equal(calls.at(-1).time, '08:00');
  assert.ok(c.render(props).some(n => n.props?.role === 'status' && n.props.children === 'Orario salvato.'));
  fail = true;
  field().props.onChange({ target: { value: '09:00' } });
  await button('Salva orario').props.onClick(); await settle();
  assert.ok(c.render(props).some(n => n.props?.role === 'alert' && String(n.props.children).includes('Save failed')));
  assert.equal(button('Salva orario').props.disabled, false);
  fail = false;
  await button('Disattiva').props.onClick(); await settle();
  assert.equal(calls.at(-1).time, '');
  assert.ok(c.render(props).some(n => n.props?.role === 'status' && n.props.children === 'Pubblicazione automatica disattivata.'));
});
