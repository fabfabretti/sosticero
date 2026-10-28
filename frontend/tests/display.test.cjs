const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function board(data) {
  const exports = {}, times = {}, jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync('src/timetables.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: times });
  let stateIndex = 0;
  const states = [{ day: '2026-10-28', data, error: false }, 0, { columns: 1, pages: [[[0]]], fits: true }];
  runInNewContext(ts.transpileModule(readFileSync('src/Display.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, URLSearchParams, window: { location: { search: '?campus=centrale' } }, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === './timetables') return times;
    if (id === './display') return { romeDay: () => '2026-10-28' };
    if (id === 'react') return { useEffect() {}, useLayoutEffect() {}, useRef: () => ({ current: null }),
      useState: initial => [stateIndex < states.length ? states[stateIndex++] : (stateIndex++, initial), () => {}] };
    return {};
  } });
  const nodes = [], text = [];
  function walk(node) {
    if (node == null || typeof node === 'boolean') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== 'object') { text.push(String(node)); return; }
    if (typeof node.type === 'function') return walk(node.type(node.props));
    nodes.push(node); walk(node.props?.children);
  }
  walk(exports.Display());
  return { nodes, text: text.join(' ') };
}

test('cells show all replaced names and a compact class summary uses operational times', () => {
  const result = board({ updated: '2026-10-28T08:00:00Z', teachers: [
    { name: 'Rossi', slots: [{ period: 3, classe: '1A', room: 'A12', replaced: ['Bianchi', 'Verdi'] }] },
  ], changes: [{ classe: '2A', action: 'ENTRA', period: 2 }, { classe: '3B', action: 'ESCE', period: 5 }] });
  assert.ok(result.text.includes('per  Bianchi / Verdi'));
  assert.ok(result.text.includes('2A   entra dopo alle 09:40'));
  assert.ok(result.text.includes('3B   esce prima alle 11:30'));
  assert.ok(!result.text.includes('aggiornamento ogni'));
  assert.ok(!result.text.includes('docenti con supplenze'));
  assert.ok(!result.text.includes('Schermo intero'));
  assert.ok(!result.nodes.some(n => n.type === 'footer'));
});

test('class notes remain visible without substitutes and disappear when there are no changes', () => {
  const data = { updated: '2026-10-28T08:00:00Z', teachers: [], changes: [{ classe: '1A', action: 'ESCE', period: 1 }] };
  const result = board(data);
  assert.ok(result.text.includes('Nessuna supplenza assegnata'));
  assert.ok(result.text.includes('esce prima (1ª ora)'));
  assert.ok(result.nodes.some(n => n.props?.className === 'display-changes'));
  assert.ok(!board({ ...data, changes: [] }).nodes.some(n => n.props?.className === 'display-changes'));
});

test('a shorter refreshed dataset renders safely before measured pagination catches up', () => {
  const exports = {}, jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync('src/Display.tsx', 'utf8') + '\nexport { TeacherTable };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => id === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : {} });
  const teachers = [{ name: 'Still assigned', slots: [{ period: 1, classe: '1A', room: 'A12', replaced: ['Bianchi', 'Verdi'] }] }];
  const table = exports.TeacherTable({ teachers, indices: [0, 1, 59, 89] });
  const rows = table.props.children[2].props.children;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].props.children[0].props.children, 'Still assigned');
  assert.equal(exports.TeacherTable({ teachers: [], indices: [0, 59] }).props.children[2].props.children.length, 0);
});

function harness(start = '2026-10-28T08:00:00Z') {
  let now = Date.parse(start), nextId = 0;
  const timers = new Map(), listeners = new Map(), requests = [], states = [], exports = {};
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const schedule = (fn, delay, repeat = false) => {
    const id = ++nextId;
    timers.set(id, { fn, at: now + delay, delay, repeat });
    return id;
  };
  runInNewContext(ts.transpileModule(readFileSync('src/display.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Date: ClockDate, Intl, AbortController,
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
    document: { visibilityState: 'visible', addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: event => listeners.delete(event) },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const tick = async duration => {
    const end = now + duration;
    while (true) {
      const entry = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry;
      now = timer.at;
      if (timer.repeat) timer.at += timer.delay; else timers.delete(id);
      timer.fn(); await flush();
    }
    now = end; await flush();
  };
  const respond = async (index, patch = {}) => {
    requests[index].resolve({ ok: true, json: async () => ({ day: exports.romeDay(new Date(now)), campus: 'centrale', teachers: [], changes: [], updated: new Date(now).toISOString(), incomplete: false, ...patch }) });
    await flush();
  };
  return { ...exports, requests, states, listeners, timers, tick, respond, flush,
    start: () => exports.startDisplay('centrale', state => states.push(state)),
    setNow: value => { now = Date.parse(value); }, last: () => states.at(-1),
  };
}

test('whole measured rows pack at exact boundaries without lost or duplicate teachers', () => {
  const h = harness();
  assert.deepEqual(JSON.parse(JSON.stringify(h.packRows([40, 60, 40, 60, 100], 100, 2))), [[[0, 1], [2, 3]], [[4]]]);
  assert.equal(h.packRows([101], 100, 2), undefined);
  assert.equal(h.packRows([40], 0, 2), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(h.packRows([50, 50], 100, 1))), [[[0, 1]]]);
});

test('school date and next midnight respect Rome and both DST transitions', () => {
  const h = harness();
  for (const [now, day, next] of [
    ['2026-10-28T23:00:00Z', '2026-10-29', '2026-10-29T23:00:00Z'],
    ['2026-03-29T00:30:00Z', '2026-03-29', '2026-03-29T22:00:00Z'],
    ['2026-10-25T00:30:00Z', '2026-10-25', '2026-10-25T23:00:00Z'],
    ['2026-12-31T23:00:00Z', '2027-01-01', '2027-01-01T23:00:00Z'],
  ]) {
    assert.equal(h.romeDay(new Date(now)), day);
    assert.equal(h.nextMidnight(new Date(now)), Date.parse(next));
  }
});

test('overflow pages advance every 15 seconds and stop for a single page or cleanup', async () => {
  const h = harness(), visited = [0];
  let page = 0;
  const stop = h.rotatePages(3, change => { page = change(page); visited.push(page); });
  await h.tick(14999); assert.deepEqual(visited, [0]);
  await h.tick(1); assert.deepEqual(visited, [0, 1]);
  await h.tick(30000); assert.deepEqual(visited, [0, 1, 2, 0]);
  stop(); await h.tick(30000); assert.deepEqual(visited, [0, 1, 2, 0]);
  h.rotatePages(1, () => assert.fail('single-page board must not rotate'));
  await h.tick(60000);
});

test('30-second anonymous polls prevent overlap, retain stale snapshots and recover', async () => {
  const h = harness(), stop = h.start();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/display?campus=centrale');
  assert.equal(h.requests[0].options.credentials, 'omit');
  assert.equal(h.requests[0].options.cache, 'no-store');
  await h.respond(0);
  const snapshot = h.last().data;
  await h.tick(29999); assert.equal(h.requests.length, 1);
  await h.tick(1); assert.equal(h.requests.length, 2);
  h.listeners.get('visibilitychange')(); assert.equal(h.requests.length, 2);
  h.requests[1].reject(new Error('offline')); await h.flush();
  assert.equal(h.last().error, true);
  assert.equal(h.last().data, snapshot);
  await h.tick(30000); await h.respond(2);
  assert.equal(h.last().error, false);
  assert.notEqual(h.last().data.updated, snapshot.updated);
  stop(); assert.equal(h.listeners.size, 0);
});

test('initial failure is unavailable and stopped responses never publish', async () => {
  const h = harness(), stop = h.start();
  h.requests[0].reject(new Error('missing timetable')); await h.flush();
  assert.equal(h.last().error, true);
  assert.equal(h.last().data, undefined);
  await h.tick(30000); stop();
  const count = h.states.length;
  await h.respond(1); assert.equal(h.states.length, count);
});

test('midnight clears yesterday, cancels the pending request and ignores its late response', async () => {
  const h = harness('2026-10-28T22:59:40Z'), stop = h.start();
  await h.respond(0, { teachers: [{ name: 'Yesterday', slots: [] }] });
  await h.tick(1000); h.listeners.get('visibilitychange')();
  await h.tick(19000);
  assert.equal(h.last().day, '2026-10-29');
  assert.equal(h.last().data, undefined);
  assert.equal(h.requests[1].options.signal.aborted, true);
  await h.respond(1, { day: '2026-10-28', teachers: [{ name: 'Late yesterday', slots: [] }] });
  assert.equal(h.last().data, undefined);
  h.requests[2].reject(new Error('offline')); await h.flush();
  assert.equal(h.last().error, true);
  assert.equal(h.last().data, undefined);
  stop();
});

test('waking on another day clears the old board and refreshes immediately', async () => {
  const h = harness(), stop = h.start();
  await h.respond(0); h.setNow('2026-10-29T10:00:00Z');
  h.listeners.get('visibilitychange')();
  assert.equal(h.last().day, '2026-10-29');
  assert.equal(h.last().data, undefined);
  assert.equal(h.requests.length, 2);
  await h.respond(1); assert.equal(h.last().data.day, '2026-10-29');
  stop();
});
