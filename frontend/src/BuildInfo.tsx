import { useEffect, useState } from 'react';

declare const __BUILD_TIME__: string;
export const builtAt = __BUILD_TIME__;

export function BuildWarning() {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch(`/build-info.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;
        const info = await response.json();
        if (alive && typeof info.builtAt === 'string' && Number.isFinite(Date.parse(info.builtAt))) setOutdated(info.builtAt !== builtAt);
      } catch { /* Keep the current UI usable; retry on the next check. */ }
    };
    void check();
    const timer = setInterval(check, 60000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return outdated ? <span className="build-warning" role="status" aria-atomic="true">
    Nuova versione disponibile. <button className="ui-button" onClick={() => window.location.reload()}>Ricarica</button>
    <small>Salva le modifiche prima di ricaricare.</small>
  </span> : null;
}
