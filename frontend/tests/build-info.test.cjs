const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

test('build checks detect a different release, ignore failures, and clean up', async () => {
  const exports = {}, states = [], listeners = new Map();
  let cleanup, poll, cleared = false, response = { builtAt: '2026-10-28T12:00:00.000Z' };
  const events = { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  runInNewContext(ts.transpileModule(readFileSync('src/BuildInfo.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, __BUILD_TIME__: response.builtAt, Date, Number, AbortSignal,
    window: events, document: { ...events, visibilityState: 'visible' },
    setInterval: fn => { poll = fn; return 1; }, clearInterval: () => { cleared = true; },
    fetch: async (url, options) => {
      assert.match(url, /^\/build-info.json\?t=/);
      assert.equal(options.cache, 'no-store');
      if (response instanceof Error) throw response;
      return { ok: true, json: async () => response };
    },
    require: id => id === 'react' ? {
      useState: () => [false, value => states.push(value)], useEffect: fn => { cleanup = fn(); },
    } : { jsx: () => null, jsxs: () => null },
  });
  exports.BuildWarning();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(states, [false]);
  response = { builtAt: '2026-10-28T13:00:00.000Z' };
  await poll();
  assert.deepEqual(states, [false, true]);
  response = { builtAt: 'invalid' };
  await poll();
  response = new Error('offline');
  await poll();
  assert.deepEqual(states, [false, true]);
  cleanup();
  assert.equal(cleared, true);
  assert.equal(listeners.size, 0);
});
