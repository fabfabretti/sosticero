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
  const css=readFileSync('src/ui.css','utf8'); assert.match(css,/prefers-reduced-motion: reduce/); assert.match(css,/\.ui-spinner \{ animation: none/);
});
