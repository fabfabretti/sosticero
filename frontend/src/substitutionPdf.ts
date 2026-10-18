import { jsPDF } from 'jspdf';
import { campusLabel, periods, type DailyExport, type PrintName } from './substitutionExport';

const margin = 10, bottom = 395, rowHeight = 4.5, lineHeight = 4.5;
const columns = [12, 60, 22, 38, 62, 16, 67];
const headings = ['ORA', 'DOCENTE ASSENTE', 'CLASSE', 'AULA / SEDE', 'DOCENTE SUPPLENTE', 'TIPO', 'FIRMA'];
type Run = { text: string; x: number; line: number; used?: boolean };
type Cell = { lines: string[]; used?: boolean; runs?: Run[] };
type Line = { cells: Cell[]; height: number };

export function generateSubstitutionPdf(content: DailyExport) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a3', compress: true });
  doc.setProperties({ title: `Assenze e sostituzioni - ${content.day}`, creator: 'Sosticero' });
  doc.setLineWidth(0.2);
  let y = 0;
  const font = (bold = false, size = 10.5) => doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
  const wrap = (text: string, w: number): string[] => {
    font();
    if (!text) return [];
    return doc.splitTextToSize(text.replace(/[\r\t]/g, ' '), w - 4);
  };
  const line = (texts: (string | PrintName)[], widths: number[]): Line => {
    const cells = texts.map((value, i) => ({ lines: wrap(typeof value === 'string' ? value : value.text, widths[i]), used: typeof value === 'string' ? false : value.used }));
    return { cells, height: Math.max(rowHeight, ...cells.map(c => c.lines.length * lineHeight + 1)) };
  };
  const draw = (row: Line, x: number, top: number, widths: number[], bold = false, size = 10.5) => {
    font(bold, size);
    for (const [i, cell] of row.cells.entries()) {
      doc.rect(x, top, widths[i], row.height);
      if (cell.runs) {
        cell.runs.forEach(run => {
          const baseline = top + 3.8 + run.line * lineHeight;
          doc.text(run.text, x + 2 + run.x, baseline);
          if (run.used) doc.line(x + 2 + run.x, baseline - 1.2, x + 2 + run.x + doc.getTextWidth(run.text), baseline - 1.2);
        });
      } else cell.lines.forEach((text, j) => {
        const baseline = top + 3.8 + j * lineHeight;
        doc.text(text, x + 2, baseline);
        if (cell.used && text) doc.line(x + 1.5, baseline - 1.2, x + 2 + doc.getTextWidth(text), baseline - 1.2);
      });
      x += widths[i];
    }
  };
  const availabilityLine = (h: number, names: PrintName[]): Line => {
    font();
    const runs: Run[] = [];
    let x = 0, lineNumber = 0;
    names.forEach((name, i) => {
      const parts = (name.text + (i < names.length - 1 ? ', ' : '')).match(/\S+\s*/g) || [];
      for (const part of parts) {
        // Split an unusually long word too, so names never spill into the border.
        const fragments = doc.getTextWidth(part.trimEnd()) > 123 ? doc.splitTextToSize(part, 123) as string[] : [part];
        for (const text of fragments) {
          if (x && x + doc.getTextWidth(text.trimEnd()) > 123) { lineNumber++; x = 0; }
          runs.push({ text, x, line: lineNumber, used: name.used });
          x += doc.getTextWidth(text);
        }
      }
    });
    const row = line([String(h), ''], [12, 127]);
    row.cells[1].runs = runs;
    row.height = Math.max(row.height, (lineNumber + 1) * lineHeight + 1);
    return row;
  };
  const header = (campus: Parameters<typeof campusLabel>[0], newPage: boolean) => {
    if (newPage) doc.addPage('a3', 'portrait');
    font(true, 13);
    doc.text('I.S.S. "M.O. LUCIANO DAL CERO"', margin, 25);
    doc.text('ASSENZE E SOSTITUZIONI', 287, 25, { align: 'right' });
    font(false, 11);
    doc.text(`Sede ${campusLabel(campus)}`, margin, 33);
    doc.text(new Date(content.day + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 287, 33, { align: 'right' });
    doc.line(margin, 37, 287, 37);
    y = 41;
  };
  const mainHeading = () => {
    font(true, 9);
    const cells = headings.map((text, i) => ({ lines: doc.splitTextToSize(text, columns[i] - 4) }));
    const row = { cells, height: Math.max(9, ...cells.map(c => c.lines.length * lineHeight + 1)) };
    draw(row, margin, y, columns, true, 9);
    y += row.height;
  };
  content.sheets.forEach((sheet, sheetIndex) => {
    header(sheet.campus, sheetIndex > 0);
    mainHeading();
    // Three independent lists: class rows never imply a pairing with trip teachers.
    const lists = [
      { x: margin, widths: [32], title: ['CLASSI ASSENTI'], rows: sheet.classes.map(n => line([n], [32])) },
      { x: margin + 32, widths: [100], title: ['DOCENTI ACCOMPAGNATORI IN USCITA'], rows: sheet.companions.map(n => line([n], [100])) },
      { x: margin + 138, widths: [12, 127], title: ['', 'DOCENTI A DISPOSIZIONE'], rows: periods.map(h => availabilityLine(h, sheet.available[h])) },
    ];
    for (const list of lists) {
      const minLines = list.widths.length === 1 ? 9 : 7;
      while (list.rows.length < minLines) list.rows.push(line(list.widths.map(() => ''), list.widths));
    }
    const blocks = periods.map(h => {
      const rows = sheet.rows.filter(r => r.period === h).map(r => line(['', r.absent, r.classe, r.room, r.substitute, r.type, ''], columns));
      for (let n = 0, count = Math.max(2, 8 - rows.length); n < count; n++) rows.push(line(Array(7).fill(''), columns));
      return { h, rows };
    });
    // Use spare room for handwriting while keeping space for the lower sections.
    let mainHeight = blocks.flatMap(b => b.rows).reduce((sum, r) => sum + r.height, 0);
    const lowerHeight = Math.max(...lists.map(l => 9 + l.rows.reduce((sum, r) => sum + r.height, 0)));
    const mainBudget = Math.min(252, bottom - y - 5 - lowerHeight);
    while (mainHeight + rowHeight <= mainBudget) {
      const block = blocks.reduce((a, b) => a.rows.length <= b.rows.length ? a : b);
      block.rows.push(line(Array(7).fill(''), columns));
      mainHeight += rowHeight;
    }
    for (const block of blocks) {
      let segmentTop = y;
      const closePeriod = () => {
        if (y <= segmentTop) return;
        doc.setFillColor('#ffffff');
        doc.rect(margin, segmentTop, columns[0], y - segmentTop, 'F');
        doc.rect(margin, segmentTop, columns[0], y - segmentTop);
        doc.setLineWidth(0.55);
        doc.line(margin, segmentTop, 287, segmentTop);
        doc.line(margin, y, 287, y);
        doc.setLineWidth(0.2);
        font(true, 13);
        doc.text(String(block.h), margin + columns[0] / 2, segmentTop + (y - segmentTop) / 2 + 1.5, { align: 'center' });
      };
      for (const row of block.rows) {
        if (row.height > bottom - 60) throw Error('Una riga è troppo lunga per una pagina A3. Ridurre il testo prima di esportare.');
        if (y + row.height > bottom) {
          closePeriod();
          header(sheet.campus, true);
          mainHeading();
          segmentTop = y;
        }
        draw(row, margin, y, columns);
        y += row.height;
      }
      closePeriod();
    }
    y += 5;
    if (bottom - y < Math.min(lowerHeight, 85)) header(sheet.campus, true);
    while (lists.some(l => l.rows.length)) {
      const top = y;
      let maxEnd = y;
      for (const list of lists) {
        const title = line(list.widths.length === 2 ? ['', list.title[1]] : list.title, list.widths);
        // Lower section labels fit at 9pt; keep body type unchanged.
        title.height = 9;
        font(true, 9);
        title.cells = (list.widths.length === 2 ? ['', list.title[1]] : list.title).map((text, i) => ({ lines: doc.splitTextToSize(text, list.widths[i] - 3) }));
        title.height = Math.max(9, ...title.cells.map(c => c.lines.length * lineHeight + 1));
        draw(title, list.x, top, list.widths, true, 9);
        let pos = top + title.height;
        let lastPeriod = '';
        while (list.rows.length && pos + list.rows[0].height <= bottom) {
          const row = list.rows.shift()!;
          if (list.widths.length === 2) {
            if (row.cells[0].lines[0]) lastPeriod = row.cells[0].lines[0];
            else if (pos === top + title.height) row.cells[0].lines = [lastPeriod || list.title[0]];
          }
          draw(row, list.x, pos, list.widths);
          pos += row.height;
        }
        if (list.rows.length && list.rows[0].height > bottom - 65) throw Error('Una voce è troppo lunga per una pagina A3.');
        if (list.widths.length === 2 && lastPeriod) list.title[0] = lastPeriod;
        maxEnd = Math.max(maxEnd, pos);
      }
      y = maxEnd;
      if (lists.some(l => l.rows.length)) header(sheet.campus, true);
    }
  });
  const total = doc.getNumberOfPages();
  if (total > 1) for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    font(true, 22);
    doc.text(`PAGE ${page}/${total}`, 148.5, 13, { align: 'center' });
    doc.text(`PAGE ${page}/${total}`, 148.5, 410, { align: 'center' });
  }
  return doc;
}
