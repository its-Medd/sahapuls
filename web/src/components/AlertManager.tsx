import { useState } from 'react';
import { acknowledgeAlert, fetchAlertHistory } from '../lib/api';
import type { AlertEvent, AlertRecord } from '../types';
import { METRIC_CONFIG } from '../lib/metrics';
export function AlertManager({
  alerts,
  onChange,
  compact = false,
}: {
  alerts: AlertRecord[];
  onChange: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<{ id: number; events: AlertEvent[] }>();
  async function act(alert: AlertRecord, action: 'ack' | 'history') {
    setBusy(alert.id);
    setError(undefined);
    try {
      if (action === 'ack') {
        await acknowledgeAlert(alert.id);
        onChange();
      } else setHistory({ id: alert.id, events: await fetchAlertHistory(alert.id) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed. Retry.');
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <ul className="alert-list">
        {alerts.slice(0, compact ? 5 : 100).map((alert) => (
          <li key={alert.id}>
            <span className={`severity-bar ${alert.severity}`} aria-hidden="true" />
            <div className="alert-copy">
              <div className="row">
                <strong>{METRIC_CONFIG[alert.metric].label}</strong>
                <span className={`badge ${alert.state.toLowerCase()}`}>
                  {alert.state.toLowerCase()}
                </span>
              </div>
              <p>
                {alert.nodeId} · {alert.value} {METRIC_CONFIG[alert.metric].unit} · {alert.severity}
              </p>
              <time dateTime={alert.ts}>{new Date(alert.ts).toLocaleString()}</time>
              {!compact && (
                <div className="row actions">
                  {alert.state === 'OPEN' && (
                    <button
                      type="button"
                      disabled={busy !== undefined}
                      onClick={() => void act(alert, 'ack')}
                    >
                      {busy === alert.id ? 'Working…' : 'Acknowledge'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy !== undefined}
                    onClick={() => void act(alert, 'history')}
                  >
                    View history
                  </button>
                </div>
              )}
              {history?.id === alert.id && (
                <div className="alert-history">
                  <button type="button" className="quiet" onClick={() => setHistory(undefined)}>
                    Close history
                  </button>
                  <ol>
                    {history.events.map((e) => (
                      <li key={e.id}>
                        {e.action.toLowerCase()} · {new Date(e.ts).toLocaleString()}
                      </li>
                    ))}
                  </ol>
                  {!history.events.length && <p>This legacy alert predates lifecycle tracking.</p>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!alerts.length && (
        <div className="state">
          <strong>No alerts in this view</strong>
          <p>Threshold breaches and recovery events will appear here.</p>
        </div>
      )}
    </div>
  );
}
