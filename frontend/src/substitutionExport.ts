import type { Data } from './types';

export type Campus = 'centrale' | 'succursale';
export type CampusChoice = Campus | 'both';
export const campusLabel = (site: Campus) => site === 'centrale' ? 'Centrale' : 'Separata';
export const periods = [1, 2, 3, 4, 5, 6, 7];
export type PrintName = { text: string; used?: boolean };
export type PrintSheet = {
  campus: Campus;
  rows: { period: number; absent: string; classe: string; room: string; substitute: string; type: string }[];
  classes: PrintName[];
  companions: PrintName[];
  available: Record<number, PrintName[]>;
};
export type DailyExport = { day: string; sheets: PrintSheet[]; warnings: string[] };

export function projectExport(data: Data, day: string, choice: CampusChoice,
  specialLabel: (key: string) => string | undefined): DailyExport {
  const assignments = data.state.asg[day] || {};
  const name = (id: string) => data.dataset.teachers[id]?.name || ({ DIR: 'Dirigente', UNCOVERED: 'Scoperta' }[id]) || id;
  const weekday = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date(day + 'T12:00').getDay()];
  const lessons = Object.entries(data.dataset.lessons).filter(([key]) => key.split('|')[1] === weekday);
  const knownCampus = (sites: (string | null | undefined)[]): Campus | undefined => {
    const unique = [...new Set(sites.filter(s => s === 'centrale' || s === 'succursale'))];
    return unique.length === 1 ? unique[0] as Campus : undefined;
  };
  const teacherSite = (id: string, hs: number[]) => knownCampus(lessons
    .filter(([key]) => key.split('|')[0] === id && hs.includes(Number(key.split('|')[2])))
    .map(([, lesson]) => lesson.site));
  const classSite = (cls: string, hs: number[]) => knownCampus(lessons
    .filter(([key, lesson]) => lesson.classes.includes(cls) && hs.includes(Number(key.split('|')[2])))
    .map(([, lesson]) => lesson.site));
  const sort = (items: PrintName[]) => items.sort((a, b) => a.text.localeCompare(b.text, 'it'));
  const manual = data.state.dis[day] || {};
  const auto = data.autoDis?.[day] || {};
  const warnings: string[] = [];
  const unknown = data.rows.filter(r => r.sede !== 'centrale' && r.sede !== 'succursale');
  if (unknown.length) warnings.push(`${unknown.length} righe con sede non indicata: non incluse nel PDF. Correggere la sede prima della distribuzione.`);
  if (data.issues.length) warnings.push(`${data.issues.length} assegnazioni da verificare nella giornata.`);
  const sheets = (choice === 'both' ? ['centrale', 'succursale'] as const : [choice]).map(campus => {
    const included = (site: Campus | undefined) => !site || site === campus;
    const label = (text: string, site: Campus | undefined): PrintName => ({ text: text + (!site ? ' (sede non indicata)' : '') });
    const classes = sort(Object.entries(data.state.cf[day] || {}).flatMap(([cls, hs]) => {
      const site = classSite(cls, hs);
      return hs.length && included(site) ? [label(cls, site)] : [];
    }));
    const companions = sort(Object.keys(data.dataset.teachers).flatMap(id => {
      const hs = [...new Set([
        ...(data.state.absenceKinds?.[day]?.[id] === 'trip' ? data.state.abs[day]?.[id] || [] : []),
        ...(data.state.permitKinds?.[day]?.[id] === 'trip' ? data.state.permessi?.[day]?.[id] || [] : []),
      ])];
      const site = teacherSite(id, hs);
      return hs.length && included(site) ? [label(name(id), site)] : [];
    }));
    const available = Object.fromEntries(periods.map(h => [h, sort([...new Set([...Object.keys(manual), ...Object.keys(auto)])].flatMap(id => {
      if (!manual[id]?.includes(h) && !auto[id]?.[h]) return [];
      const site = (manual[id]?.includes(h) ? knownCampus([data.state.disSites[day]?.[id]]) : undefined) || teacherSite(id, [h]);
      if (!included(site)) return [];
      return [{ ...label(name(id), site), used: Object.entries(assignments).some(([key, a]) => a.v === id && Number(key.split('|')[1]) === h) }];
    }))]));
    const rows = data.rows.filter(r => r.sede === campus).map(r => {
      const a = assignments[r.k];
      return { period: r.h, absent: r.ids.map(name).join(' / '), classe: r.c,
        room: [r.aula, campusLabel(campus)].filter(Boolean).join(' / '),
        substitute: a ? specialLabel(r.k) || name(a.v) : '', type: a && a.t !== 'SPECIAL' ? a.t : '' };
    }).sort((a, b) => a.period - b.period || a.classe.localeCompare(b.classe, 'it'));
    return { campus, rows, classes, companions, available };
  });
  return { day, sheets, warnings };
}
