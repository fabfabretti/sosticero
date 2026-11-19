import { formatNumber as fmt } from './stats-report';

export type Slice = { name: string; hours: number; color: string };

export function CompositionPie({ slices }: { slices: Slice[] }) {
  const visible = slices.filter(s => s.hours > 0);
  const total = visible.reduce((sum, s) => sum + s.hours, 0);
  let running = 0;
  const centers = visible.map(s => {
    const middle = running + s.hours / total * Math.PI;
    running += s.hours / total * 2 * Math.PI;
    return middle;
  });
  const rotation = Array.from({ length: 360 }, (_, i) => i * Math.PI / 180).reduce((best, candidate) => {
    const imbalance = (r: number) => Math.abs(visible.length - 2 * centers.filter(m => Math.cos(m + r) >= 0).length);
    return imbalance(candidate) < imbalance(best) ? candidate : best;
  }, -Math.PI / 2);
  let angle = rotation;
  const parts = visible.map(s => {
    const start = angle;
    angle += s.hours / total * 2 * Math.PI;
    const middle = (start + angle) / 2;
    return { ...s, start, end: angle, middle, side: Math.cos(middle) >= 0 ? 'right' : 'left' };
  });
  const sides = ['left', 'right'] as const;
  const maxLabels = Math.max(0, ...sides.map(side => parts.filter(p => p.side === side).length));
  const height = Math.max(300, maxLabels * 42 + 30);
  const centerY = height / 2;
  return <div className="composition-chart">
    <svg viewBox={`0 0 600 ${height}`} role="img" aria-label={visible.map(s => `${s.name}: ${fmt(s.hours)} ore, ${fmt(s.hours / total * 100)}%`).join('; ')}>
      {parts.map((p, i) => {
        const x1 = 300 + 90 * Math.cos(p.start), y1 = centerY + 90 * Math.sin(p.start);
        const x2 = 300 + 90 * Math.cos(p.end), y2 = centerY + 90 * Math.sin(p.end);
        return visible.length === 1 ? <circle key={i} cx="300" cy={centerY} r="90" fill={p.color} /> : <path key={i} d={`M 300 ${centerY} L ${x1} ${y1} A 90 90 0 ${p.end - p.start > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`} fill={p.color} stroke="var(--pan)" />;
      })}
      {sides.flatMap(side => parts.filter(p => p.side === side).sort((a, b) => Math.sin(a.middle) - Math.sin(b.middle)).map((p, i, group) => {
        const y = centerY + (i - (group.length - 1) / 2) * 42;
        const right = side === 'right', anchorX = 300 + 90 * Math.cos(p.middle), anchorY = centerY + 90 * Math.sin(p.middle);
        const radius = 104 + Math.min(45, Math.abs(y - centerY) * 0.35);
        const elbowX = 300 + radius * Math.cos(p.middle), elbowY = centerY + radius * Math.sin(p.middle);
        const lane = right ? 450 : 150;
        const edge = right ? 455 : 145, textX = right ? 465 : 135;
        return <g key={p.name}>{visible.length <= 8 ? <path d={`M ${anchorX} ${anchorY} L ${elbowX} ${elbowY} L ${lane} ${elbowY} L ${edge} ${y} L ${right ? 461 : 139} ${y}`} fill="none" stroke={p.color} strokeWidth="1.7" strokeLinejoin="round" /> : <circle cx={right ? 457 : 143} cy={y + 1} r="3.5" fill={p.color} />}<text x={textX} y={y - 3} textAnchor={right ? 'start' : 'end'} fill={p.color} fontSize="12"><tspan x={textX}>{p.name}</tspan><tspan x={textX} dy="15">{fmt(p.hours)} ore · {fmt(p.hours / total * 100)}%</tspan></text></g>;
      }))}
    </svg>
  </div>;
}

export function DemandCalendar({ start, end, daily }: { start: string; end: string; daily: { date: string; demand: number }[] }) {
  const values = new Map(daily.map(d => [d.date, d.demand]));
  const max = Math.max(1, ...daily.map(d => d.demand));
  const months = [];
  const cursor = new Date(start.slice(0, 7) + '-01T12:00:00Z');
  const last = end.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= last) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const offset = (cursor.getUTCDay() + 6) % 7;
    const title = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(cursor);
    const cells = Array.from({ length: offset + count }, (_, i) => {
      if (i < offset) return <span key={i} />;
      const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(i - offset + 1).padStart(2, '0')}`;
      if (d < start || d > end) return <span key={i} />;
      const n = values.get(d), level = n === undefined ? 'missing' : n === 0 ? 'zero' : String(Math.max(1, Math.ceil(n / max * 4)));
      return <span key={i} className={`demand-day demand-${level}`} title={`${d}: ${n === undefined ? 'nessun dato registrato' : `${fmt(n)} ore da coprire`}`} aria-label={`${d}: ${n === undefined ? 'nessun dato registrato' : `${fmt(n)} ore da coprire`}`} />;
    });
    months.push(<div className="demand-month" key={`${year}-${month}`}><strong>{title}</strong><div className="demand-month-grid">{cells}</div></div>);
    cursor.setUTCMonth(month + 1);
  }
  return <div><p className="stats-method">Ore da coprire per giorno · colore più intenso = maggiore domanda. Grigio: nessun dato registrato.</p><div className="demand-calendar" aria-label="Domanda giornaliera">{months}</div></div>;
}
