const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function load(name, globals = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/' + name + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals });
  return exports;
}
const { preconditions } = load('concurrency');
test('preconditions select only affected records and cover range, future and moves', () => {
  const b = { records: { 'abs|2026-10-12|t': 'old', 'abs|2026-10-13|t': 'next', 'abs|2026-10-14|other': 'unrelated' }, dates: { abs: ['2026-10-13'] } };
  assert.deepEqual({ ...preconditions(b, 'entries', { day: '2026-10-12', group: 'abs', id: 't' }) }, { 'abs|2026-10-12|t': 'old' });
  assert.equal(preconditions(b, 'entries', { day: '2026-10-12', group: 'abs', id: 't', future: true })['abs|2026-10-13|t'], 'next');
  assert.equal(Object.keys(preconditions(b, 'entries', { day: '2026-10-16', group: 'abs', id: 't', until: '2026-10-19' })).length, 2);
  assert.equal(Object.keys(preconditions(b, 'permessi', { day: '2026-10-13', id: 'b', original_day: '2026-10-12', original_id: 'a' })).length, 2);
});
function harness() {
  let index = 0, active = false, scope = 'day1';
  const slots = [], effects = [], timers = new Map(), listeners = new Map(), requests = [], applied = [];
  const element = { scrollTop: 123, scrollLeft: 8 };
  const react = {
    useRef(value) { const i = index++; return slots[i] ||= { current: value }; },
    useEffect(fn, deps) {
      const i = index++, previous = slots[i];
      if (!previous || !deps || deps.some((v, n) => v !== previous.deps?.[n])) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  react.useLayoutEffect = react.useEffect;
  const doc = { visibilityState: 'visible', querySelectorAll: () => [element], addEventListener: (e, fn) => listeners.set(e, fn), removeEventListener: e => listeners.delete(e) };
  const { useQuietRefresh } = load('useQuietRefresh', { require: () => react, document: doc, setInterval: fn => { timers.set(fn, fn); return fn; }, clearInterval: id => timers.delete(id) });
  const render = () => {
    index = 0;
    const result = useQuietRefresh(() => new Promise((resolve, reject) => requests.push({ resolve, reject })), value => applied.push(value), active, scope);
    effects.splice(0).forEach(f => f());
    return result;
  };
  return { render, requests, applied, element, listeners, timers, active: value => { active = value; }, scope: value => { scope = value; }, poll: async () => { [...timers.values()][0](); await settle(); }, unmount: () => slots.forEach(s => s?.cleanup?.()) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('quiet refresh defers active work, retains only latest snapshot and restores scroll', async () => {
  const h = harness(); h.active(true); h.render();
  const first = h.poll(); h.requests.shift().resolve('first'); await first;
  const second = h.poll(); h.requests.shift().resolve('latest'); await second;
  assert.deepEqual(h.applied, []);
  h.active(false); h.render();
  assert.deepEqual(h.applied, ['latest']);
  h.element.scrollTop = 0; h.render();
  assert.equal(h.element.scrollTop, 123);
  h.unmount(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});
test('old polls cannot overwrite local mutations or a different day; failures remain quiet', async () => {
  const h = harness(); let controls = h.render();
  const old = h.poll();
  const oldRequest = h.requests.shift();
  controls.invalidate(); const fresh = controls.refresh(); h.requests.shift().resolve('saved'); await fresh;
  oldRequest.resolve('stale'); await old;
  assert.deepEqual(h.applied, ['saved']);
  const late = h.poll(); const lateRequest = h.requests.shift();
  h.scope('day2'); controls = h.render(); lateRequest.resolve('wrong day'); await late;
  assert.deepEqual(h.applied, ['saved']);
  const failing = h.poll(); h.requests.shift().reject(Error('offline')); await failing;
  assert.deepEqual(h.applied, ['saved']);
  h.unmount();
});
test('non-overlapping polls and visibility return share the same guarded loader', async () => {
  const h = harness(); h.render(); const pending = h.poll(); h.poll(); assert.equal(h.requests.length, 1);
  h.requests.shift().resolve('one'); await pending;
  const returned = h.listeners.get('visibilitychange')(); h.requests.shift().resolve('two'); await returned;
  assert.deepEqual(h.applied, ['one', 'two']); h.unmount();
});
