import { useResource } from '../hooks/useResource';
import type { Health } from '../lib/api';
import { AsyncState } from './AsyncState';
export function SystemStatus() {
  const resource = useResource<Health | null>('/api/health', null, 10000);
  const data = resource.data;
  return (
    <section className="panel system-status">
      <div className="panel-heading">
        <div>
          <h2>System status</h2>
          <p>Live service checks · refreshed every 10 seconds</p>
        </div>
        <button type="button" onClick={resource.reload}>
          Check now
        </button>
      </div>
      <AsyncState
        error={resource.error}
        loading={resource.loading && !data}
        onRetry={resource.reload}
      >
        {data && (
          <>
            <dl className="service-checks">
              <div>
                <dt>HTTP API</dt>
                <dd className="text-positive">Available</dd>
              </div>
              <div>
                <dt>SQLite database</dt>
                <dd
                  className={
                    data.components.sqlite.status === 'up' ? 'text-positive' : 'text-critical'
                  }
                >
                  {data.components.sqlite.status === 'up' ? 'Healthy' : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt>MQTT broker</dt>
                <dd className={data.mqttConnected ? 'text-positive' : 'text-critical'}>
                  {data.mqttConnected ? 'Connected' : 'Disconnected'}
                </dd>
              </div>
              <div>
                <dt>Simulator</dt>
                <dd>{data.components.simulator.status}</dd>
              </div>
              <div>
                <dt>Application version</dt>
                <dd>{data.version}</dd>
              </div>
              <div>
                <dt>Database schema</dt>
                <dd>{data.components.sqlite.schemaVersion ?? '—'}</dd>
              </div>
              <div>
                <dt>Journal mode</dt>
                <dd>{data.components.sqlite.journalMode ?? '—'}</dd>
              </div>
              <div>
                <dt>Foreign keys</dt>
                <dd>
                  {data.components.sqlite.foreignKeys === undefined
                    ? '—'
                    : data.components.sqlite.foreignKeys
                      ? 'Enforced'
                      : 'Disabled'}
                </dd>
              </div>
            </dl>
            <div className="system-footnote">
              <span className={`badge ${data.ready ? 'online' : 'offline'}`}>
                {data.ready ? 'Ready for telemetry' : 'Telemetry not ready'}
              </span>
              <p>
                Readiness requires SQLite and MQTT. A paused or offline simulator does not make
                stored observations unavailable.
              </p>
            </div>
          </>
        )}
      </AsyncState>
    </section>
  );
}
