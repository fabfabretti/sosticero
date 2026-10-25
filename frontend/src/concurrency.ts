export type Baseline = { generation?: number; records: Record<string, string>; dates: Record<string, string[]> };
type Mutation = { [field: string]: unknown; day?: string; group?: string; id?: string; key?: string; replace_key?: string; original_day?: string; original_id?: string; future?: boolean; until?: string };
export function preconditions(baseline: Baseline | undefined, route: string, body: Mutation) {
  if (!baseline) throw Error('Ricarica la pagina prima di salvare.');
  const refs: string[] = [];
  const add = (group: string, day: string, id: string) => refs.push(`${group}|${day}|${id}`);
  const day = body.day || '';
  if (route === 'entries') {
    const days = [day];
    if (body.future) days.push(...(baseline.dates[body.group!] || []).filter(d => d > day));
    else if (body.until) {
      const d = new Date(day + 'T12:00:00Z');
      for (d.setUTCDate(d.getUTCDate() + 1); d.toISOString().slice(0, 10) <= body.until; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
      }
    }
    days.forEach(d => add(body.group!, d, body.id!));
  } else if (route === 'assignments') {
    add('asg', day, body.key!);
    if (body.replace_key) add('asg', day, body.replace_key);
  } else if (route === 'permessi') {
    add('permessi', day, body.id!);
    if (body.original_day) add('permessi', body.original_day, body.original_id!);
  } else if (route === 'manual-permits') add('manualPermits', '', body.id!);
  return Object.fromEntries([...refs.map(ref => [ref, baseline.records[ref] || 'absent']), ...(baseline.generation === undefined ? [] : [['__generation__', String(baseline.generation)]])]);
}
export class ApiError extends Error {
  constructor(public status: number, detail: string | { message?: string }) {
    super(typeof detail === 'string' ? detail : detail.message || JSON.stringify(detail));
  }
}
