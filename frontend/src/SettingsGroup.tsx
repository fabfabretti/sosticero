import type { ReactNode } from 'react';

export function SettingsGroup({ title, description, status, children }: { title: string; description: string; status: string; children: ReactNode }) {
  return <details className="ui-surface settings-group">
    <summary className="settings-group-heading">
      <span className="settings-group-copy"><span className="settings-group-title">{title}</span><span className="settings-muted">{description}</span></span>
      <span className="settings-group-status">{status}</span>
      <span className="settings-group-chevron" aria-hidden="true" />
    </summary>
    <div className="settings-group-body">{children}</div>
  </details>;
}
