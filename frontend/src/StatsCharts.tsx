import { formatNumber as fmt } from './stats-report';
import { init, use } from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { SVGRenderer } from 'echarts/renderers';

use([PieChart, SVGRenderer]);

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
  const width = 800;
  const height = Math.max(280, Math.ceil(visible.length / 2) * 64);
  const chart = init(null, undefined, { renderer: 'svg', ssr: true, width, height });
  chart.setOption({
    animation: false,
    series: [{
      type: 'pie', startAngle: -rotation * 180 / Math.PI, radius: 105, center: ['50%', visible.length > 8 ? '42%' : '50%'],
      avoidLabelOverlap: true, percentPrecision: 2,
      itemStyle: { borderColor: 'var(--pan)', borderWidth: 1 },
      label: { show: true, position: 'outer', alignTo: 'labelLine', fontSize: 15, lineHeight: 19,
        formatter: (p: { name: string; value: number; percent: number }) => `${p.name}\n${fmt(p.value)} ore · ${fmt(p.percent)}%` },
      labelLine: { show: true, length: 20, length2: 20, lineStyle: { width: 1.7 } },
      data: visible.map(s => ({ name: s.name, value: s.hours, itemStyle: { color: s.color },
        label: { color: s.color }, labelLine: { lineStyle: { color: s.color } } })),
    }],
  });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return <div className="composition-chart" role="img" aria-label={visible.map(s => `${s.name}: ${fmt(s.hours)} ore, ${fmt(s.hours / total * 100)}%`).join('; ')} dangerouslySetInnerHTML={{ __html: svg }} />;
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
