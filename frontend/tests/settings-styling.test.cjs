const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const ts = require('typescript');

test('Page workflows use shared CSS rather than inline presentation', () => {
  const files = ['main', 'SettingsGroup', 'TimetableImport', 'Receptions', 'HourTypes', 'Inbox', 'SubstitutionExportPanel'];
  for (const name of files) {
    const source = ts.createSourceFile(name + '.tsx', readFileSync('src/' + name + '.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const relevant = name === 'main' ? source.statements.filter(node => ts.isFunctionDeclaration(node) && ['Settings', 'BackupSection', 'Permessi', 'Supplenze'].includes(node.name?.text)) : name === 'Inbox' ? source.statements.filter(node => ts.isFunctionDeclaration(node) && ['SheetsSettings', 'AbsenceInbox'].includes(node.name?.text)) : [source];
    function visit(node) {
      if (ts.isJsxAttribute(node)) assert.notEqual(node.name.getText(source), 'style', name + ' must use shared CSS classes');
      ts.forEachChild(node, visit);
    }
    relevant.forEach(visit);
  }
});
