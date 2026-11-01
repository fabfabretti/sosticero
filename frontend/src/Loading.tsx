import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Loading({ label = 'Caricamento…', overlay = false, reserve }: { label?: string; overlay?: boolean; reserve?: string }) {
  const status = <span className={"ui-loading" + (overlay ? " ui-operation-status" : "")} role="status"><span className="ui-spinner" aria-hidden="true" /><span className={reserve ? "sr-only" : "ui-loading-label"}>{label}</span></span>;
  if (overlay) return createPortal(status, document.body);
  return reserve ? <span className="ui-loading-button"><span className="ui-loading-reserve" aria-hidden="true">{reserve}</span>{status}</span> : status;
}

export function LoadingRegion({ pending, blocked = pending, local = false, label, error, retry, children }: {
  pending: boolean; blocked?: boolean; local?: boolean; label?: string; error?: string; retry?: () => void; children?: ReactNode;
}) {
  const content = <>
    {pending && (local ? <span className="ui-section-status"><Loading label={label} /></span> : <Loading overlay label={label} />)}
    {error && <p className="ui-notice ui-notice-error" role="alert">{error} {retry && <button type="button" className="ui-button" onClick={retry} disabled={pending}>Riprova</button>}</p>}
    <div className={blocked ? 'ui-loading-content' : undefined} inert={blocked} aria-busy={pending}>{children}</div>
  </>;
  return local ? <div className="ui-loading-region">{content}</div> : content;
}

// Two frames let pending feedback paint before synchronous PDF preparation.
export const paintLoading = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
