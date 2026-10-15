import React, { useRef, useState } from "react";

// Hover/focus tooltip. Fixed positioning escapes scroll/overflow clipping;
// coords come from the trigger and the tip flips above when the trigger sits low.
export function HourHelp({ text, children }: { text: string; children: React.ReactNode }) {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [tip, setTip] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const show = (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    clearTimeout(hideTimer.current);
    const above = r.top > window.innerHeight / 2;
    setTip({ left: Math.max(8, Math.min(r.left, window.innerWidth - 246)), top: above ? r.top - 6 : r.bottom + 6, above });
  };
  const hide = () => { hideTimer.current = setTimeout(() => setTip(null), 150); };
  return <span className="hour-help" tabIndex={0} aria-label={text}
    onMouseEnter={show} onMouseLeave={hide}
    onFocus={show} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTip(null); }}
    onKeyDown={e => { if (e.key === "Escape") setTip(null); }}>
    {children}
    {tip && <span role="tooltip" tabIndex={0} className="tip" onMouseEnter={() => clearTimeout(hideTimer.current)} style={{ maxHeight: Math.max(40, (tip.above ? tip.top : window.innerHeight - tip.top) - 8), left: tip.left, top: tip.top, transform: tip.above ? "translateY(-100%)" : undefined }}>{text}</span>}
  </span>;
}
