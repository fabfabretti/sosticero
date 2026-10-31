import type { ReactNode } from 'react';

export function Loading({ label = 'Caricamento…' }: { label?: string }) {
  return <span className="ui-loading" role="status"><span className="ui-spinner" aria-hidden="true" />{label}</span>;
}

export function LoadingRegion({ pending, blocked = pending, error, retry, children }: {
  pending: boolean; blocked?: boolean; error?: string; retry?: () => void; children?: ReactNode;
}) {
  return <>
    {pending && <Loading />}
    {error && <p className="ui-notice ui-notice-error" role="alert">{error} {retry && <button type="button" className="ui-button" onClick={retry} disabled={pending}>Riprova</button>}</p>}
    <div className={blocked ? 'ui-loading-content' : undefined} inert={blocked} aria-busy={pending}>{children}</div>
  </>;
}

// Two frames let pending feedback paint before synchronous PDF preparation.
export const paintLoading = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
