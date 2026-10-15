const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const { buildTeacherTimetables } = (() => {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('src/timetables.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports });
  return exports;
})();

const dataset = {
  teachers: {
    a: { name: 'Anna', code: 'A' },
    b: { name: 'Bruno', code: 'B' },
    c: { name: 'Carla', code: 'C' },
    z: { name: 'Zero', code: 'Z' },
  },
  lessons: {
    'a|lun|1': { classes: ['1A'], activities: [] },
    'b|lun|1': { classes: ['1A'], activities: [] },
    'c|lun|1': { classes: ['1A'], activities: [] },
    'a|mar|2': { classes: [], activities: ['POT'] },
  },
};
const grid = id => buildTeacherTimetables(dataset).find(g => g.id === id);
const cell = (id, day, hour) => grid(id).cells[day][hour - 1];

test('a lesson cell exposes its class and no activity code', () => {
  assert.deepEqual([...cell('a', 0, 1).classes], ['1A']);
  assert.deepEqual([...cell('a', 0, 1).codes], []);
});

test('an hour without a class exposes its activity code', () => {
  assert.deepEqual([...cell('a', 1, 2).codes], ['POT']);
  assert.deepEqual([...cell('a', 1, 2).classes], []);
});

test('two teachers in one class and hour are each other compresenza', () => {
  const two = buildTeacherTimetables({ teachers: dataset.teachers, lessons: {
    'a|lun|1': { classes: ['1A'] }, 'b|lun|1': { classes: ['1A'] },
  } });
  assert.deepEqual([...two.find(g => g.id === 'a').cells[0][0].partners], ['b']);
  assert.deepEqual([...two.find(g => g.id === 'b').cells[0][0].partners], ['a']);
});

test('three teachers in one class and hour each list the other two', () => {
  for (const id of ['a', 'b', 'c'])
    assert.deepEqual([...cell(id, 0, 1).partners].sort(), ['a', 'b', 'c'].filter(x => x !== id).sort());
});

test('teachers with no lessons are omitted and grids are ordered by name', () => {
  const grids = buildTeacherTimetables(dataset);
  assert.deepEqual([...grids.map(g => g.id)], ['a', 'b', 'c']);
});
