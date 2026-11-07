import type { AlertRecord } from '../types';

const SEVERITY_DOT: Record<AlertRecord['severity'], string> = {
  warning: 'bg-status-warning',
  alert: 'bg-status-critical',
};

export function AlertFeed({ alerts }: { alerts: AlertRecord[] }) {
  return (
    <ul className="flex max-h-full flex-col divide-y divide-line overflow-y-auto dark:divide-line-dark">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start gap-2 px-4 py-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-primary dark:text-ink-primary-dark">{alert.message}</p>
            <p className="text-xs text-ink-muted">
              {alert.nodeId} &middot; {new Date(alert.ts).toLocaleTimeString()} &middot;{' '}
              <span className="uppercase">{alert.severity}</span>
            </p>
          </div>
        </li>
      ))}
      {alerts.length === 0 && (
        <li className="px-4 py-6 text-center text-sm text-ink-muted">
          No alerts yet. Alerts appear here when a node breaches a temperature, gas, or battery
          threshold.
        </li>
      )}
    </ul>
  );
}
