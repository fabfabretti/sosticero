const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsPdf = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/paidPdf.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsPdf, require });
const report = { dates: ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06'], cells: [{ weekday: 0, hour: 1, teachers: [{ name: 'Rossi Mario', sites: ['centrale'], addedBy: 'succursale' }] }] };
test('weekly availability uses A4 landscape and selectable names, sites and dates', () => {
  const doc = exportsPdf.generatePaidPdf(report);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < .1);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < .1);
  const text = doc.internal.pages.slice(1).flat().join('\n');
  for (const value of ['Rossi Mario - Centrale [S]', '02/11/2026', '06/11/2026', 'BANCA ORE']) assert.ok(text.includes(value), value);
  if (process.env.PAID_SAMPLE) fs.writeFileSync(process.env.PAID_SAMPLE, Buffer.from(doc.output('arraybuffer')));
});
test('crowded slots continue across pages without dropping names', () => {
  const crowded = structuredClone(report);
  crowded.cells[0].teachers = Array.from({ length: 200 }, (_, i) => ({ name: `Docente ${i}`, sites: [], uncertain: true }));
  const doc = exportsPdf.generatePaidPdf(crowded);
  assert.ok(doc.getNumberOfPages() > 1);
  const text = doc.internal.pages.slice(1).flat().join('\n');
  for (let i = 0; i < 200; i++) assert.ok(text.includes(`Docente ${i} -`));
});
