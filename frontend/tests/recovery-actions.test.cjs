const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function component(clipboard) {
  let feedback = '';
  const exports = {}, jsx = (type, props) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync('src/RecoveryActions.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, navigator: { clipboard }, require(id) {
    if (id === 'react') return { useState: () => [feedback, v => { feedback = v; }] };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    throw Error(id);
  } });
  return { ...exports, render(props) {
    const nodes = [];
    function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      nodes.push(n); walk(n.props?.children);
    }
    walk(exports.RecoveryActions(props)); return nodes;
  } };
}
const row = { k: 'absent|3|1A', h: 3, c: '1A', aula: '12', sede: 'centrale' };
const permit = { date: '2026-10-12', periods: [2] };
const props = () => ({ day: '2026-10-27', row, permit, assignment: { v: 'rp', t: 'RP' }, canAssign: true, busy: false, onAccept() {} });
const buttons = nodes => nodes.filter(n => n.type === 'button');
const status = nodes => nodes.find(n => n.props?.role === 'status').props.children;
const settle = () => new Promise(resolve => setImmediate(resolve));

test('exact request template, sorted multi-period variants and manual balance', () => {
  const { recoveryMessage } = component();
  assert.equal(recoveryMessage('2026-10-27', row, permit), `[Recupero permesso] 27/10/2026 · 3ª ora · 1A

Gentile Professoressa/Professore,

In assenza di altre soluzioni, richiederei la sua presenza in data/ora
27/10/2026 · 3ª ora classe 1A, aula 12, recuperando l'ora di permesso presa il 12/10/2026 alla 2ª ora. Le è possibile?

Grazie mille e cordiali saluti,
Fabiola Fabretti`);
  assert.match(recoveryMessage('2026-10-27', row, { ...permit, periods: [3, 2] }), /alle ore 2ª e 3ª/);
  assert.match(recoveryMessage('2026-10-27', row, { ...permit, periods: [5, 3, 2] }), /alle ore 2ª, 3ª e 5ª/);
  assert.match(recoveryMessage('2026-10-27', { ...row, aula: null }, { date: null }), /aula da verificare, recuperando un'ora del saldo permessi pregresso\. Le è possibile\?/);
});

test('acceptance guarded by campus and busy state; copying stays read-only across campuses', async () => {
  const copied = [], c = component({ writeText: async value => { copied.push(value); } });
  let mutations = 0;
  const p = { ...props(), onAccept: () => mutations++ };
  buttons(c.render(p))[0].props.onClick(); assert.equal(mutations, 1);
  p.canAssign = false;
  const [accept, copy] = buttons(c.render(p));
  assert.equal(accept.props.disabled, true);
  assert.match(accept.props['aria-label'], /riservata alla sede centrale/);
  accept.props.onClick(); assert.equal(mutations, 1);
  assert.equal(copy.props.disabled, false);
  copy.props.onClick(); await settle();
  assert.equal(copied[0], c.recoveryMessage(p.day, row, permit));
  assert.equal(status(c.render(p)), 'Copiato');
  assert.equal(p.assignment.accepted, undefined);
  p.canAssign = true; p.busy = true;
  buttons(c.render(p))[0].props.onClick(); assert.equal(mutations, 1);
  p.assignment.accepted = true;
  assert.equal(buttons(c.render(p))[0].props['aria-pressed'], true);
});

test('clipboard failures and unresolved permit have accessible feedback', async () => {
  for (const clipboard of [undefined, { writeText: async () => { throw Error('denied'); } }]) {
    const c = component(clipboard), p = props();
    buttons(c.render(p))[1].props.onClick(); await settle();
    assert.match(status(c.render(p)), /Copia non riuscita/);
    assert.equal(p.assignment.accepted, undefined);
  }
  const c = component(), p = { ...props(), permit: undefined };
  assert.equal(buttons(c.render(p))[1].props.disabled, true);
  assert.match(status(c.render(p)), /Permesso collegato non disponibile/);
});
