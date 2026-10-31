const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function compile(file, globals) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, ...globals });
  return exports;
}
const loading = compile('src/Loading.tsx', { require: () => ({ jsx, jsxs: jsx }), requestAnimationFrame: fn => fn() });
function quiet(react) {
  return compile('src/useQuietRefresh.ts', {
    require: () => ({ ...react, useLayoutEffect: react.useLayoutEffect || react.useEffect }),
    document: { visibilityState: 'visible', querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
    setInterval: () => 1, clearInterval() {},
  });
}
module.exports = { loading, quiet };
