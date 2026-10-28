const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const source = readFileSync('src/main.tsx', 'utf8');
const helpers = source.slice(source.indexOf('  const permitDataset ='), source.indexOf('  const scheduled ='));
const evaluate = data => runInNewContext(ts.transpileModule(helpers + '\nteachingSites;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, { data });

test('permit sites use the entire effective week and exact teacher identity', () => {
  const old = { lessons: {
    'a|lun|1': { site: 'centrale' }, 'a|mar|1': { site: 'succursale' },
    'a|mer|1': { site: null }, 'ab|lun|1': { site: 'succursale' },
    'single|ven|1': { site: 'centrale' },
  } };
  const current = { lessons: { 'a|lun|1': { site: 'centrale' } } };
  const sites = evaluate({ dataset: current, timetableVersions: [{ effective: null, dataset: old }, { effective: '2026-10-19', dataset: current }] });
  assert.equal(JSON.stringify(sites('a', '2026-10-12')), '["centrale","succursale"]');
  assert.equal(JSON.stringify(sites('a', '2026-10-19')), '["centrale"]');
  assert.equal(JSON.stringify(sites('single', '2026-10-12')), '["centrale"]');
  assert.equal(JSON.stringify(sites('unknown', '2026-10-12')), '[]');
});

test('campus tags expose full names with compact visible labels', () => {
  const helper = source.slice(source.indexOf('const campusTag ='), source.indexOf('const entryExitBoundary ='));
  const jsx = (type, props) => ({ type, props });
  const render = runInNewContext(ts.transpileModule(helper + '\ncampusTag;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, { React: { createElement: (type, props, children) => jsx(type, { ...props, children }) } });
  for (const [site, label, short] of [['centrale', 'Centrale', 'C'], ['succursale', 'Succursale', 'S']]) {
    const tag = render(site);
    assert.equal(tag.props['aria-label'], label);
    assert.equal(tag.props.title, label);
    assert.equal(tag.props.children, short);
  }
});
