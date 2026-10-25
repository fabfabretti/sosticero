const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/${file}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: id => id === './timetables' ? load('timetables') : require(id) });
  return exports;
}
const { projectTimetableExport, generateTimetablePdf } = load('timetablePdf');
const fixture = { teachers: { c: { name: 'Carla' }, a: { name: 'Anna' }, b: { name: 'Bruno' }, d: { name: 'Dario' }, e: { name: 'Elena' }, x: { name: 'Retired', retired: true } }, lessons: {
  'a|lun|1': { classes: ['1A', '2A'], room: 'LAB.T', site: 'succursale', disabled: true },
  'b|lun|1': { classes: ['1A', '2A'] }, 'c|lun|1': { classes: ['1A'] }, 'd|mar|2': { activities: ['POT'] },
}, receptions: [{ teacher: 'e', day: 'ven', hour: 3, time: '10:00', location: 'online', site: null }] };
test('projection keeps full names, rooms, general-purpose activities, receptions and deduplicates partners', () => {
  const rows = projectTimetableExport(fixture);
  assert.equal(rows.map(t => t.name).join(','), 'Anna,Bruno,Carla,Dario,Elena');
  assert.match(rows[0].cells[0][0], /LAB.T \/ S/);
  assert.doesNotMatch(rows[0].cells[0][0], /disabilitata/);
  assert.equal(rows[3].cells[1][1], 'POT');
  assert.equal(rows[0].kinds[0][0].activity, 'lesson');
  assert.equal(rows[3].kinds[1][1].activity, 'activity');
  assert.equal(rows[4].kinds[4][2].reception, true);
  assert.match(rows[0].cells[0][0], /Comp.: Bruno, Carla/);
  assert.match(rows[1].cells[0][0], /Aula n.d. \/ \?/);
  assert.match(rows[4].cells[4][2], /Ricevimento.*10:00.*online/);
  assert.equal(rows[0].cells[4][6], '');
});
test('A4 landscape with two fixed grids per page and odd last page', () => {
  for (const count of [1, 2, 5]) {
    const doc = generateTimetablePdf(projectTimetableExport(fixture).slice(0, count), '2026-10-21', '2026-10-16');
    assert.equal(doc.getNumberOfPages(), Math.ceil(count / 2));
    const bodies = doc.internal.pages.slice(1).flat().filter(line => line.endsWith(' re')).map(line => line.split(' ').slice(2, 4).join(' ')).filter(size => Math.abs(Number(size.split(' ')[0]) - 54.2 * 72 / 25.4) < 0.01 && Math.abs(Number(size.split(' ')[1]) + 10 * 72 / 25.4) < 0.01);
    assert.equal(bodies.length, count * 35);
    assert.equal(new Set(bodies).size, 1);
    assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < 0.1);
    assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < 0.1);
  }
});
test('overflow reports teacher and slot instead of dropping content', () => {
  const rows = projectTimetableExport(fixture);
  rows[0].cells[0][0] = 'Nome molto lungo '.repeat(100);
  assert.throws(() => generateTimetablePdf(rows, '2026-10-21', null), /Anna, Lunedì 1ª/);
});

test('long compresenza names and overlapping reception remain present', () => {
  const ds = structuredClone(fixture);
  ds.teachers.b.name = 'Bruno Alessandro Rossi';
  ds.teachers.c.name = 'Carla Francesca Bianchi';
  ds.lessons['a|lun|1'].disabled = false;
  ds.receptions.push({ teacher: 'a', day: 'mar', hour: 2, time: '09:00', location: '', site: 'centrale' });
  ds.lessons['a|mar|2'] = { classes: ['1A'], room: 'A1', site: 'centrale' };
  const rows = projectTimetableExport(ds);
  assert.match(rows[0].cells[0][0], /Bruno Alessandro Rossi, Carla Francesca Bianchi/);
  assert.match(rows[0].cells[1][1], /sovrapposizione/);
  assert.doesNotThrow(() => generateTimetablePdf(rows, '2026-10-21', null));
});

if (process.env.TIMETABLE_SAMPLE) {
  const sample = structuredClone(fixture);
  sample.teachers.b.name = 'Bruno Alessandro Rossi';
  sample.teachers.c.name = 'Carla Francesca Bianchi';
  sample.lessons['a|lun|1'].disabled = false;
  sample.lessons['a|mar|2'] = { classes: ['1A'], room: 'A1', site: 'centrale' };
  sample.receptions.push({ teacher: 'a', day: 'mar', hour: 2, time: '09:00', location: '', site: 'centrale' });
  fs.writeFileSync(process.env.TIMETABLE_SAMPLE, Buffer.from(generateTimetablePdf(projectTimetableExport(sample), '2026-10-21', '2026-10-16').output('arraybuffer')));
}

test('activity locations include only available information', () => {
  const ds = structuredClone(fixture);
  ds.lessons['d|mar|2'] = { activities: ['SILV'] };
  ds.lessons['d|mar|3'] = { activities: ['STAFF'], room: 'A1' };
  ds.lessons['d|mar|4'] = { activities: ['STAFF'], site: 'centrale' };
  const row = projectTimetableExport(ds).find(t => t.name === 'Dario');
  assert.equal(row.cells[1][1], 'SILV');
  assert.equal(row.cells[1][2], 'STAFF · A1');
  assert.equal(row.cells[1][3], 'STAFF · C');
});
test('PDF retains text operators rather than rasterized timetable content', () => {
  const pdf = generateTimetablePdf(projectTimetableExport(fixture), '2026-10-21', '2026-10-16');
  const operators = pdf.internal.pages.slice(1).flat().join('\n');
  for (const text of ['Anna', 'Bruno', 'Carla', 'LAB.T / S', 'POT', 'Ricevimento', '21/10/2026', '16/10/2026']) assert.ok(operators.includes(text), text);
  assert.doesNotMatch(operators, /disabilitata|solo in caso di necessità/i);
});
