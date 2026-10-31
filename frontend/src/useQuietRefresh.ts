import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Keep only the latest snapshot; active interactions retain their displayed baseline.
export function useQuietRefresh<T>(load: () => Promise<T>, apply: (value: T) => void, active: boolean, scope: string, paused = false) {
  const latest = useRef({ load, apply, active, paused, scope });
  latest.current = { load, apply, active, paused, scope };
  const generation = useRef(0), pending = useRef<{ value: T; generation: number } | undefined>(undefined);
  const running = useRef(false), alive = useRef(true);
  const scroll = useRef<[Element, number, number][]>([]);
  const [foreground, setForeground] = useState<{ scope: string; pending: boolean; error: string; ready: boolean }>({ scope: '', pending: false, error: '', ready: false });
  const foregroundRunning = useRef(false);
  const [, commitRefresh] = useState(0);
  const accept = (value: T) => {
    scroll.current = Array.from(document.querySelectorAll('*')).filter(e => e.scrollTop || e.scrollLeft).map(e => [e, e.scrollTop, e.scrollLeft]);
    latest.current.apply(value);
    // Clear the snapshot in this refresh's commit even when apply keeps the same data.
    commitRefresh(revision => revision + 1);
  };
  useLayoutEffect(() => {
    for (const [element, top, left] of scroll.current) { element.scrollTop = top; element.scrollLeft = left; }
    scroll.current = [];
  });
  const invalidate = () => { ++generation.current; pending.current = undefined; };
  const refresh = async () => {
    invalidate();
    const n = generation.current;
    const owner = latest.current.scope;
    foregroundRunning.current = true;
    setForeground({ scope: owner, pending: true, error: '', ready: false });
    try {
      const value = await latest.current.load();
      if (alive.current && n === generation.current && owner === latest.current.scope) {
        accept(value);
        setForeground({ scope: owner, pending: false, error: '', ready: true });
        return value;
      }
    } catch (e) {
      if (alive.current && n === generation.current && owner === latest.current.scope) {
        setForeground({ scope: owner, pending: false, error: String(e), ready: false });
        throw e;
      }
    } finally { if (n === generation.current) foregroundRunning.current = false; }
  };
  useEffect(() => {
    alive.current = true;
    invalidate();
    const poll = async () => {
      if (latest.current.paused || foregroundRunning.current || running.current || document.visibilityState === 'hidden' || document.documentElement?.dataset.auth === 'locked') return;
      running.current = true;
      const n = generation.current, owner = latest.current.scope;
      try {
        const value = await latest.current.load();
        if (!alive.current || n !== generation.current || owner !== latest.current.scope) return;
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
  return { refresh, invalidate, loading: foreground.scope !== scope || foreground.pending, ready: foreground.scope === scope && foreground.ready, loadError: foreground.scope === scope ? foreground.error : '' };
}
