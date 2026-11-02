import { jsPDF } from 'jspdf';
import type { Report } from './PaidHours';

const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
const date = (value: string) => value.split('-').reverse().join('/');
const site = (value: string) => value === 'centrale' ? 'Centrale' : 'Succursale';

export function generatePaidPdf(report: Report) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Banca ore - ${report.dates[0]}`, creator: 'Sosticero' });
  const widths = [12, ...Array(5).fill(53)], lineHeight = 4;
  const font = (bold = false, size = 9) => doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
  const draw = (cells: string[][], y: number, height: number, bold = false) => {
    let x = 10;
    font(bold);
    cells.forEach((lines, i) => {
      doc.rect(x, y, widths[i], height);
      if (lines.length) doc.text(lines, x + 2, y + 4, { lineHeightFactor: lineHeight / (9 * 25.4 / 72) });
      x += widths[i];
    });
  };
  const header = () => {
    font(true, 12);
    doc.text('I.S.S. "M.O. LUCIANO DAL CERO"', 10, 16);
    doc.text('BANCA ORE', 287, 16, { align: 'right' });
    font();
    doc.text('Disponibilità ricorrenti per supplenze a pagamento', 10, 23);
    doc.text(`${date(report.dates[0])} - ${date(report.dates[4])}`, 287, 23, { align: 'right' });
    doc.line(10, 27, 287, 27);
    draw([['Ora'], ...days.map((day, i) => [day, date(report.dates[i])])], 31, 11, true);
    return 42;
  };
  doc.setLineWidth(0.2);
  let y = header();
  for (let hour = 1; hour <= 7; hour++) {
    font();
    const cells: string[][] = days.map((_, weekday) => {
      const teachers = report.cells.find(c => c.weekday === weekday && c.hour === hour)?.teachers || [];
      return teachers.length ? teachers.flatMap(t => doc.splitTextToSize(`${t.name} - ${t.why || (t.uncertain ? 'Sede da verificare' : t.sites.length === 2 ? 'Entrambe' : t.sites.map(site).join(' / '))}${t.addedBy ? ` [${t.addedBy === 'centrale' ? 'C' : 'S'}]` : ''}`, 49) as string[]) : ['-'];
    });
    let offset = 0;
    const count = Math.max(...cells.map(c => c.length));
    while (offset < count) {
      if (y + 10 > 186) { doc.addPage(); y = header(); }
      const take = Math.min(count - offset, Math.floor((186 - y - 2) / lineHeight));
      const height = Math.max(8, take * lineHeight + 2);
      draw([[`${hour}ª`], ...cells.map(c => c.slice(offset, offset + take))], y, height);
      y += height;
      offset += take;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); font(false, 8);
    doc.text('C / S = sede di inserimento. Sedi calcolate dall’orario; assenze e supplenze verificate all’assegnazione.', 10, 197);
    doc.text(`Pagina ${page} / ${pages}`, 287, 203, { align: 'right' });
  }
  return doc;
}
