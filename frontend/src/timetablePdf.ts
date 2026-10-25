import { jsPDF } from 'jspdf';
import { buildTeacherTimetables, DAYS, HOURS, type Dataset } from './timetables';
import type { Reception } from './Receptions';
const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
const colors = { lesson: '#e8f0fc', activity: '#fff2d6', reception: '#def3e6' };
const campus = (site?: string | null) => site === 'centrale' ? 'C' : site === 'succursale' ? 'S' : '?';
export function projectTimetableExport(dataset: Omit<Dataset, 'receptions'> & { receptions?: Reception[] }) {
  return buildTeacherTimetables(dataset).map(t => ({ name: t.name,
    kinds: DAYS.map((day, di) => HOURS.map(hour => {
      const cell = t.cells[di][hour - 1];
      return { activity: cell ? cell.codes.length ? 'activity' as const : 'lesson' as const : null,
        reception: !!dataset.receptions?.some(r => r.teacher === t.id && r.day === day && r.hour === hour) };
    })),
    cells: DAYS.map((day, di) => HOURS.map(hour => {
      const c = t.cells[di][hour - 1], lines: string[] = [];
      if (c) {
        const location = [c.room || (c.codes.length ? '' : 'Aula n.d.'), c.site ? campus(c.site) : c.codes.length ? '' : '?'].filter(Boolean).join(' / ');
        lines.push([...c.classes, ...c.codes, location].filter(Boolean).join(' · '));
        if (c.partners.length) lines.push('Comp.: ' + c.partners.map(id => dataset.teachers[id]?.name || id).join(', '));
      }
      for (const r of dataset.receptions || []) if (r.teacher === t.id && r.day === day && r.hour === hour)
        lines.push(['Ricevimento' + (c ? ' [sovrapposizione]' : ''), r.time, r.location, r.site ? campus(r.site) : ''].filter(Boolean).join(' · '));
      return lines.filter(Boolean).join('\n');
    })),
  }));
}
export function generateTimetablePdf(teachers: ReturnType<typeof projectTimetableExport>, day: string, effective: string | null) {
  if (!teachers.length) throw Error('Nessun docente da esportare.');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Orari - ${day}`, creator: 'Sosticero' });
  const date = (v: string) => v.split('-').reverse().join('/');
  const margin = 8, hourWidth = 10, width = (281 - hourWidth) / 5, height = 10;
  const font = (size: number, bold = false) => doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
  const fit = (text: string, w: number, h: number, context: string) => {
    for (let size = 9; size >= 7; size -= 0.5) {
      font(size);
      const lines: string[] = doc.splitTextToSize(text, w - 3);
      if (lines.length * size * 0.352778 * 1.05 <= h - 1.5 && lines.every(l => doc.getTextWidth(l) <= w - 3 + 0.01)) return { lines, size };
    }
    throw Error(`Testo troppo lungo: ${context}. Ridurre il testo prima di esportare.`);
  };
  const prepared = teachers.map(t => ({ ...t, heading: fit(t.name, 281, 7, t.name),
    fitted: t.cells.map((cells, di) => cells.map((text, hi) => fit(text, width, height, `${t.name}, ${dayNames[di]} ${hi + 1}ª ora`))),
  }));
  prepared.forEach((t, index) => {
    if (index % 2 === 0) {
      if (index) doc.addPage();
      font(11, true); doc.text(`Orari al ${date(day)}`, margin, 10);
      font(8); doc.text(effective ? `Orario dal ${date(effective)}` : 'Orario attuale', 289, 10, { align: 'right' });
      doc.text('C = Centrale · S = Succursale · ? = Sede ignota · Aula n.d. = aula non indicata · Comp. = altri docenti in compresenza', margin, 16);
      (['lesson', 'activity', 'reception'] as const).forEach((kind, i) => {
        const x = margin + i * 53;
        doc.setFillColor(colors[kind]); doc.rect(x, 18, 4, 4, 'F');
        doc.text(['Lezione', 'Altra attività', 'Ricevimento'][i], x + 6, 21);
      });
      doc.text('Fascia verde: ricevimento nella stessa ora', margin + 161, 21);
      doc.text(`Pagina ${Math.floor(index / 2) + 1} / ${Math.ceil(teachers.length / 2)}`, 289, 205, { align: 'right' });
    }
    const top = 25 + (index % 2) * 88;
    font(t.heading.size, true); doc.text(t.heading.lines, margin, top + 4, { lineHeightFactor: 1.05 });
    font(8, true); doc.rect(margin, top + 7, hourWidth, 6); doc.text('Ora', margin + 2, top + 11);
    dayNames.forEach((label, di) => {
      const x = margin + hourWidth + di * width;
      doc.rect(x, top + 7, width, 6); doc.text(label, x + width / 2, top + 11, { align: 'center' });
    });
    HOURS.forEach((hour, hi) => {
      const y = top + 13 + hi * height;
      font(8, true); doc.rect(margin, y, hourWidth, height); doc.text(String(hour), margin + hourWidth / 2, y + 5.5, { align: 'center' });
      DAYS.forEach((_, di) => {
        const x = margin + hourWidth + di * width, c = t.fitted[di][hi];
        const kind = t.kinds[di][hi];
        doc.setFillColor(kind.activity ? colors[kind.activity] : kind.reception ? colors.reception : '#ffffff');
        doc.rect(x, y, width, height, 'FD');
        if (kind.activity && kind.reception) {
          doc.setFillColor(colors.reception); doc.rect(x + 0.2, y + height - 1, width - 0.4, 0.8, 'F');
        }
        font(c.size);
        doc.text(c.lines, x + 1.5, y + 1 + c.size * 0.352778, { lineHeightFactor: 1.05 });
      });
    });
  });
  return doc;
}
