const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync('src/main.tsx', 'utf8');
const helpers = source.slice(source.indexOf('const localDate ='), source.indexOf('const italianDate ='));
const schoolDate = runInNewContext(ts.transpileModule(helpers + '\nschoolDate;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, { Date });

test('default school day skips weekends, including month and year boundaries', () => {
  for (const [input, expected] of [
    ['2026-10-23', '2026-10-23'],
    ['2026-10-24', '2026-10-26'],
    ['2026-10-25', '2026-10-26'],
    ['2026-10-31', '2026-11-02'],
    ['2027-01-02', '2027-01-04'],
  ]) assert.equal(schoolDate(new Date(input + 'T12:00')), expected);
});

test('notices target the next weekday, including Friday across DST changes', () => {
  for (const [input, expected] of [
    ['2026-10-22', '2026-10-23'],
    ['2026-10-23', '2026-10-26'],
    ['2026-03-27', '2026-03-30'],
    ['2027-12-31', '2028-01-03'],
  ]) {
    const date = new Date(input + 'T12:00');
    assert.equal(schoolDate(date, 1), expected);
    assert.equal(date.getDate(), Number(input.slice(8)));
  }
});
