const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const cache = {};
function load(file) {
  file = path.resolve(file);
  if (cache[file]) return cache[file];
  const exports = cache[file] = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: id => id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id), Date,
  });
  return exports;
}
const { projectExport } = load('src/substitutionExport.ts');
const { generateSubstitutionPdf } = load('src/substitutionPdf.ts');
const day = '2026-10-19';
function fixture() {
  const teachers = Object.fromEntries(['absent', 'coabsent', 'manual', 'automatic', 'pot', 'trip', 'permitTrip', 'unknown'].map(id => [id, { id, name: 'Docente ' + id, role: '' }]));
  const lessons = {
    'trip|lun|1': { classes: ['9Z'], site: 'centrale' },
    'automatic|lun|2': { classes: ['2A'], site: 'centrale' },
    'permitTrip|lun|2': { classes: ['9Z'], site: 'succursale' },
    'pot|lun|2': { classes: [], special: 'POT', site: 'centrale' },
  };
  const row = { id: 'absent', ids: ['absent', 'coabsent'], h: 2, c: '1A', k: 'absent|2|1A', aula: '101', sede: 'centrale' };
  return { dataset: { teachers, lessons, classes: ['1A', '2A', '9Z'], warnings: [] }, state: {
    abs: { [day]: { trip: [1] } }, permessi: { [day]: { permitTrip: [2] } },
    absenceKinds: { [day]: { trip: 'trip' } }, permitKinds: { [day]: { permitTrip: 'trip', trip: 'trip' } },
    cf: { [day]: { '2A': [2], '3B': [1] } }, dis: { [day]: { manual: [2, 3], unknown: [2] } },
    disSites: { [day]: { manual: 'centrale' } }, asg: { [day]: {
      [row.k]: { v: 'manual', t: 'RP', c: '1A' },
      'absent|3|1B': { v: 'manual', t: 'D', c: '1B' },
    } },
  }, rows: [row, { ...row, ids: ['absent'], h: 3, k: 'absent|3|1B', c: '1B', sede: 'succursale' }, { ...row, h: 4, k: 'absent|4|1A' }], autoDis: { [day]: { automatic: { 2: ['2A classe fuori'] }, manual: { 2: ['classe fuori'] } } }, issues: [] };
}
const project = (data, choice = 'both') => projectExport(data, day, choice, key => key === 'absent|4|1A' && data.state.asg[day][key]?.v === 'ENTRA' ? 'Entra h 10:35' : undefined);

test('projection preserves grouped rows, room, types, blank and special assignments without writes', () => {
  const data = fixture(); const before = JSON.stringify(data);
  const result = project(data);
  assert.equal(result.sheets.length, 2);
  const rows = result.sheets[0].rows;
  assert.equal(rows[0].absent, 'Docente absent / Docente coabsent');
  assert.equal(rows[0].room, '101 / Centrale');
  assert.equal(rows[0].type, 'RP');
  assert.equal(rows[1].substitute, '');
  assert.equal(rows[1].type, '');
  assert.equal(result.sheets[1].rows[0].classe, '1B');
  assert.equal(JSON.stringify(data), before);
  for (const type of ['POT', 'C', 'RP', 'D', 'RC', 'UTC']) {
    data.state.asg[day]['absent|2|1A'].t = type;
    assert.equal(project(data, 'centrale').sheets[0].rows[0].type, type);
  }
  data.state.asg[day]['absent|4|1A'] = { v: 'ENTRA', t: 'SPECIAL', c: '1A' };
  assert.equal(project(data, 'centrale').sheets[0].rows[1].substitute, 'Entra h 10:35');
  assert.equal(project(data, 'centrale').sheets[0].rows[1].type, '');
  data.state.asg[day]['absent|4|1A'].v = 'UNCOVERED';
  assert.equal(project(data, 'centrale').sheets[0].rows[1].substitute, 'Scoperta');
});

test('independent saved class/trip lists and disposition keep used names, exclude POT, and flag unknown campus', () => {
  const data = fixture(); const { sheets } = project(data);
  const sheet = sheets[0];
  assert.equal(sheet.classes.length, 2);
  assert.ok(sheet.classes.some(c => c.text.startsWith('2A')));
  assert.ok(!sheet.classes.some(c => c.text.startsWith('9Z')));
  assert.equal(sheet.companions.length, 1);
  assert.equal(sheets[1].companions[0].text, 'Docente permitTrip');
  assert.equal(sheet.available[2].length, 3);
  assert.equal(sheet.available[2].filter(n => n.text === 'Docente manual').length, 1);
  assert.equal(sheet.available[2].find(n => n.text === 'Docente manual').used, true);
  assert.equal(sheet.available[3].find(n => n.text === 'Docente manual').used, true); // used at other campus
  delete data.state.asg[day]['absent|3|1B'];
  assert.equal(project(data).sheets[0].available[3].find(n => n.text === 'Docente manual').used, false);
  assert.equal(sheet.available[2].find(n => n.text.includes('automatic')).used, false);
  assert.ok(!sheet.available[2].some(n => n.text.includes('pot')));
  assert.ok(sheets.every(s => s.classes.some(c => c.text.includes('sede non indicata'))));
  assert.ok(sheets.every(s => s.available[2].some(c => c.text.includes('unknown (sede non indicata)'))));
  data.rows.push({ ...data.rows[0], sede: null });
  assert.match(project(data).warnings[0], /1 righe con sede non indicata/);
});

function commands(doc, page) { return doc.internal.pages[page].join('\n'); }
test('A3 empty sheet contains every period, both lower sections and ample ruled handwriting lines', () => {
  const data = fixture(); data.rows = []; data.state.cf = {}; data.state.abs = {}; data.state.permessi = {}; data.state.dis = {}; data.autoDis = {};
  const doc = generateSubstitutionPdf(project(data, 'centrale'));
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < 0.1);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 420) < 0.1);
  const text = commands(doc, 1);
  for (let h = 1; h <= 7; h++) assert.ok(text.includes(`(${h}) Tj`));
  assert.ok(text.includes('(AULA / SEDE) Tj'));
  assert.ok(text.includes('(DOCENTI ACCOMPAGNATORI IN USCITA) Tj'));
  assert.ok(text.includes('(DOCENTI A DISPOSIZIONE) Tj'));
  assert.ok(!text.includes('(PAGE 1/1)'));
  assert.ok((text.match(/ re\n/g) || []).length >= 7 * 8 * 7);
});

test('both campuses start on separate sheets and count globally at top and bottom', () => {
  const doc = generateSubstitutionPdf(project(fixture()));
  assert.equal(doc.getNumberOfPages(), 2);
  for (let p = 1; p <= 2; p++) assert.equal(commands(doc, p).split(`(PAGE ${p}/2) Tj`).length - 1, 2);
  assert.match(commands(doc, 2), /Sede Separata/);
});

test('crowded periods and supplementary lists continue, retaining last entries and two blank lines per period', () => {
  const data = fixture();
  data.rows = Array.from({ length: 80 }, (_, i) => ({ ...data.rows[0], h: 2, c: `CL${i}`, k: `absent|2|CLASSE-${i}` }));
  data.state.cf[day] = Object.fromEntries(Array.from({ length: 90 }, (_, i) => [`FUORI-${i}`, [2]]));
  data.dataset.teachers.absent.name = 'Nome molto lungo con più cognomi De Angelis Della Rovere';
  const doc = generateSubstitutionPdf(project(data, 'centrale'));
  assert.ok(doc.getNumberOfPages() > 3);
  const all = doc.internal.pages.slice(1).map(p => p.join('\n')).join('\n');
  assert.ok(all.includes('CL79'));
  assert.ok(all.includes('FUORI-89'));
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    const page = commands(doc, p);
    assert.equal(page.split(`(PAGE ${p}/${doc.getNumberOfPages()}) Tj`).length - 1, 2);
    assert.ok(page.includes('Sede Centrale'));
  }
});

module.exports = { fixture, project, load };

test('availability is a wrapping comma-separated list and period borders are thicker', () => {
  const data = fixture();
  const doc = generateSubstitutionPdf(project(data, 'centrale'));
  const text = commands(doc, 1);
  assert.ok(text.includes('(automatic, ) Tj'));
  assert.ok(text.includes('(manual, ) Tj'));
  const widths = [...text.matchAll(/([\d.]+) w/g)].map(m => Number(m[1]));
  assert.ok(widths.some(w => Math.abs(w - 0.55 * 72 / 25.4) < 0.001));
  for (let i = 0; i < 30; i++) {
    const id = 'available-' + i;
    data.dataset.teachers[id] = { id, name: 'Long Availability Teacher ' + i, role: '' };
    data.state.dis[day][id] = [7];
    data.state.disSites[day][id] = 'centrale';
  }
  const wrapped = generateSubstitutionPdf(project(data, 'centrale'));
  const all = wrapped.internal.pages.slice(1).map(p => p.join('\n')).join('\n');
  assert.ok(all.includes('(29, ) Tj') || all.includes('(29) Tj'));
});

test('POT compresence retains its distinct label in PDF projection', () => {
  const data = fixture();
  data.state.asg[day]['absent|2|1A'] = { v: 'pot', t: 'CP', c: '1A' };
  assert.equal(project(data, 'centrale').sheets[0].rows[0].type, 'Compresenza - POT');
  assert.equal(load('src/stats-report.ts').typeNames.CP, 'Compresenza - POT');
});
