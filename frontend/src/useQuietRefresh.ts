import { useEffect, useLayoutEffect, useRef } from 'react';

// Keep only the latest snapshot; active interactions retain their displayed baseline.
export function useQuietRefresh<T>(load: () => Promise<T>, apply: (value: T) => void, active: boolean, scope: string, paused = false) {
  const latest = useRef({ load, apply, active, paused });
  latest.current = { load, apply, active, paused };
  const generation = useRef(0), pending = useRef<{ value: T; generation: number } | undefined>(undefined);
  const running = useRef(false), alive = useRef(true);
  const scroll = useRef<[Element, number, number][]>([]);
  const accept = (value: T) => {
    scroll.current = Array.from(document.querySelectorAll('*')).filter(e => e.scrollTop || e.scrollLeft).map(e => [e, e.scrollTop, e.scrollLeft]);
    latest.current.apply(value);
  };
  useLayoutEffect(() => {
    for (const [element, top, left] of scroll.current) { element.scrollTop = top; element.scrollLeft = left; }
    scroll.current = [];
  });
  const invalidate = () => { ++generation.current; pending.current = undefined; };
  const refresh = async () => {
    invalidate();
    const n = generation.current;
    const value = await latest.current.load();
    if (alive.current && n === generation.current) { accept(value); return value; }
  };
  useEffect(() => {
    alive.current = true;
    invalidate();
    const poll = async () => {
      if (latest.current.paused || running.current || document.visibilityState === 'hidden' || document.documentElement?.dataset.auth === 'locked') return;
      running.current = true;
      const n = generation.current;
      try {
        const value = await latest.current.load();
        if (!alive.current || n !== generation.current) return;
        if (latest.current.active) pending.current = { value, generation: n };
        else accept(value);
      } catch { /* Keep the usable view; the next poll retries quietly. */ }
      finally { running.current = false; }
    };
    const timer = setInterval(() => void poll(), 15000);
    document.addEventListener('visibilitychange', poll);
    return () => { alive.current = false; invalidate(); clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [scope]);
  useEffect(() => {
    const next = pending.current;
    if (!active && next && next.generation === generation.current) { pending.current = undefined; accept(next.value); }
  }, [active]);
  return { refresh, invalidate };
}
