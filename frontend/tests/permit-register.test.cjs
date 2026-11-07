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
  const old = { sites: { a: ['centrale', 'succursale'], ab: ['succursale'], single: ['centrale'] } };
  const current = { sites: { a: ['centrale'] } };
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

test('permit register sorts remaining days numerically and filters by account identity', () => {
  const block = source.slice(source.indexOf('  const today = new Intl.DateTimeFormat'), source.indexOf('  const permitPages ='));
  const evaluate = (ascending, creatorFilter = '') => runInNewContext(ts.transpileModule(block + '\nrecords;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, { data: {
    permessi: { '2026-10-01': { a: [1], b: [1], c: [1] } },
    recoveries: { '2026-10-01': { a: { deadline: '2026-12-01' }, b: { deadline: '2026-11-10' }, c: { deadline: '2026-11-03' } } },
    permitCreators: { '2026-10-01': { a: { id: 'one', name: 'Same' }, b: { id: 'two', name: 'Same' } } },
    dataset: { teachers: {} },
  }, sort: { field: 'days', ascending }, creatorFilter, authorLabel: a => a?.name || 'Autore non disponibile' });
  assert.equal(evaluate(true).map(r => r.id).join(), 'c,b,a');
  assert.equal(evaluate(false).map(r => r.id).join(), 'a,b,c');
  assert.equal(evaluate(true, 'two').map(r => r.id).join(), 'b');
  assert.equal(evaluate(true)[2].days - evaluate(true)[0].days, 28);
});

test('pagination clamps the current page when records shrink', () => {
  const block = source.slice(source.indexOf('  const permitPages ='), source.indexOf('  const warning ='));
  let clamped;
  const result = runInNewContext(ts.transpileModule(block + '\n({currentPermitPage,visibleRecords});', {
    compilerOptions: {target:ts.ScriptTarget.ES2022},
  }).outputText, {records:[{id:'remaining'}],permitPage:3,useEffect:fn=>fn(),setPermitPage:p=>{clamped=p;}});
  assert.equal(result.currentPermitPage, 1);
  assert.equal(result.visibleRecords[0].id, 'remaining');
  assert.equal(clamped, 1);
});
