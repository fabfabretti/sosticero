import { useState } from "react";
import { metricNames, weekdays, formatNumber as fmt } from "./stats-report";
import type { Metric, StatReport } from "./stats-report";

export function HeatCell({ cell, metric, max }: { cell: StatReport["heatmap"][number]; metric: Metric; max: number }) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const value = cell[metric];
  const id = `heat-details-${cell.weekday}-${cell.hour}`;
  const show = (event: { currentTarget: HTMLTableCellElement }) => {
    if (!cell.observations.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)), top: Math.max(8, Math.min(rect.bottom, window.innerHeight - 264)) });
  };
  return <td tabIndex={cell.observations.length ? 0 : undefined}
    aria-label={`${weekdays[cell.weekday]}, ${cell.hour}ª ora: ${fmt(value)} ${metric === "teachers" ? "docenti" : "ore"} in media`}
    aria-describedby={position ? id : undefined}
    onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)}
    onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setPosition(null); } }}
    style={{ background: `color-mix(in srgb, var(--acc) ${Math.round((value || 0) / max * 24)}%, var(--pan))` }}>
    {fmt(value)}
    {position && <div id={id} role="tooltip" className="stats-cell-tooltip" style={position}>
      <strong>{weekdays[cell.weekday]} · {cell.hour}ª ora</strong><span>{metricNames[metric]}</span>
      <ul>{cell.observations.map(entry => <li key={entry.date}>
        {new Date(entry.date + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}: {entry[metric]} {metric === "teachers" ? entry[metric] === 1 ? "docente" : "docenti" : entry[metric] === 1 ? "ora" : "ore"}
      </li>)}</ul>
    </div>}
  </td>;
}
