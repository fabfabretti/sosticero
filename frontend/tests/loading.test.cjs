const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { loading } = require('./loading-harness.cjs');
function flatten(n) {
  if (Array.isArray(n)) return n.flatMap(flatten);
  return n && typeof n === 'object' ? [n, ...flatten(n.props.children)] : [];
}
test('loading status and retry remain outside the inert dimmed region', () => {
  let retried = 0;
  const nodes = flatten(loading.LoadingRegion({pending:false,blocked:true,error:'offline',retry:()=>retried++,children:'previous'}));
  const content = nodes.find(n=>n.props.inert);
  assert.equal(content.props.children,'previous'); assert.equal(content.props.className,'ui-loading-content');
  assert.equal(content.props['aria-busy'],false);
  const retry = nodes.find(n=>n.type==='button'); retry.props.onClick(); assert.equal(retried,1);
  assert.equal(retry.props.disabled,false);
  const status = loading.Loading({label:'Salvataggio…'});
  assert.equal(status.props.role,'status'); assert.equal(status.props.children[0].props['aria-hidden'],'true');
  assert.equal(status.props.children[1].props.className, 'ui-loading-label');
  assert.equal(status.props.children[1].props.children, 'Salvataggio…');
  const css=readFileSync('src/ui.css','utf8'); assert.match(css,/prefers-reduced-motion: reduce/); assert.match(css,/\.ui-spinner \{ animation: none/);
});


test('page feedback is outside the content flow and busy buttons retain their label footprint', () => {
  const region = flatten(loading.LoadingRegion({ pending: true, children: 'existing content' }));
  const status = region.find(n => n.type === loading.Loading);
  assert.equal(status.props.overlay, true);
  const overlay = loading.Loading(status.props);
  assert.ok(overlay.props.className.includes('ui-operation-status'));
  const button = loading.Loading({label: 'Generazione…', reserve: 'Scarica PDF completo'});
  assert.equal(button.props.children[0].props.children, 'Scarica PDF completo');
  assert.equal(button.props.children[0].props['aria-hidden'], 'true');
  assert.equal(button.props.children[1].props.role, 'status');
  assert.equal(button.props.children[1].props.children[1].props.children, 'Generazione…');
});

test('subsection loading stays local and never requests the page backdrop', () => {
  const region = loading.LoadingRegion({pending: true, local: true, children: 'section contents'});
  assert.equal(region.props.className, 'ui-loading-region');
  const nodes = flatten(region);
  const status = nodes.find(n => n.type === loading.Loading);
  assert.notEqual(status.props.overlay, true);
  assert.ok(nodes.some(n => n.props.className === 'ui-section-status'));
});
