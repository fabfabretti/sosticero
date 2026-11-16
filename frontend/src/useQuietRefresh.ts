import { cachedPage, loadPage, pageCacheEpoch, PAGE_FRESH_MS } from './pageCache';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Keep only the latest snapshot; active interactions retain their displayed baseline.
export function useQuietRefresh<T>(load: () => Promise<T>, apply: (value: T) => void, active: boolean, scope: string, paused = false, cacheKey?: string) {
  const latest = useRef({ load, apply, active, paused, scope, cacheKey });
  latest.current = { load, apply, active, paused, scope, cacheKey };
  const read = () => latest.current.cacheKey ? loadPage(latest.current.cacheKey, latest.current.load) : latest.current.load();
  const generation = useRef(0), pending = useRef<{ value: T; generation: number; epoch: number } | undefined>(undefined);
  const running = useRef(false), alive = useRef(true);
  const nextAttempt = useRef(0);
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
  const invalidate = () => { ++generation.current; pending.current = undefined; foregroundRunning.current = false; nextAttempt.current = 0; };
  const refresh = async () => {
    invalidate();
    const n = generation.current;
    const owner = latest.current.scope;
    foregroundRunning.current = true;
    setForeground({ scope: owner, pending: true, error: '', ready: false });
    try {
      const value = await read();
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
  useLayoutEffect(() => {
    const snapshot = cacheKey ? cachedPage<T>(cacheKey) : undefined;
    if (snapshot) {
      accept(snapshot.value);
      setForeground({ scope, pending: false, error: '', ready: true });
    }
  }, [scope, cacheKey]);
  const enter = async () => {
    const snapshot = cacheKey ? cachedPage<T>(cacheKey) : undefined;
    if (!snapshot) return refresh();
    // The layout effect already displayed this snapshot; a stale one stays usable.
    if (Date.now() - snapshot.receivedAt >= PAGE_FRESH_MS) await pollRef.current();
    return snapshot.value;
  };
  const pollRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    alive.current = true;
    invalidate();
    const poll = async () => {
      if (latest.current.paused || foregroundRunning.current || running.current || document.visibilityState === 'hidden' || document.documentElement?.dataset.auth === 'locked') return;
      const snapshot = cacheKey ? cachedPage<T>(cacheKey) : undefined;
      if (cacheKey && (Date.now() < nextAttempt.current || (snapshot && Date.now() - snapshot.receivedAt < PAGE_FRESH_MS))) return;
      nextAttempt.current = Date.now() + PAGE_FRESH_MS;
      running.current = true;
      const cacheOwner = pageCacheEpoch();
      const n = generation.current, owner = latest.current.scope;
      try {
        const value = await read();
        if (!alive.current || n !== generation.current || owner !== latest.current.scope || (cacheKey && cacheOwner !== pageCacheEpoch())) return;
        if (latest.current.active) pending.current = { value, generation: n, epoch: cacheOwner };
        else accept(value);
        if (cacheKey) setForeground(old => ({ ...old, scope: owner, error: '', ready: true }));
      } catch (error) {
        if (cacheKey && alive.current && n === generation.current && owner === latest.current.scope)
          setForeground(old => ({ ...old, error: String(error) }));
      }
      finally { running.current = false; }
    };
    pollRef.current = poll;
    const timer = setInterval(() => void poll(), cacheKey ? 1000 : PAGE_FRESH_MS);
    document.addEventListener('visibilitychange', poll);
    return () => { alive.current = false; invalidate(); clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [scope, cacheKey]);
  useEffect(() => {
    const next = pending.current;
    if (!active && next && next.generation === generation.current && (!cacheKey || next.epoch === pageCacheEpoch())) { pending.current = undefined; accept(next.value); }
  }, [active]);
  return { refresh, enter, invalidate, loading: foreground.scope !== scope || foreground.pending, ready: foreground.scope === scope && foreground.ready, loadError: foreground.scope === scope ? foreground.error : '' };
}
