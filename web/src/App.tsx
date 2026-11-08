import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { NodeList } from './components/NodeList';
import { AlertManager } from './components/AlertManager';
import { AsyncState } from './components/AsyncState';
import { HistoryView } from './components/HistoryView';
import { SimulatorControls } from './components/SimulatorControls';
import { DeviceInventory } from './components/DeviceInventory';
import { AnalyticsView } from './components/AnalyticsView';
import { SystemStatus } from './components/SystemStatus';
import { DeviceActivity } from './components/DeviceActivity';
import { NavIcon } from './components/NavIcon';
import { useAlerts } from './hooks/useAlerts';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useNodes } from './hooks/useNodes';
import { useReadings } from './hooks/useReadings';
import { useResource } from './hooks/useResource';
import { API_BASE_URL, requestJson, type Settings, type Summary } from './lib/api';
import { METRIC_CONFIG, METRICS } from './lib/metrics';
import type { MetricName } from './types';

const VIEWS = [
  'Overview',
  'Devices',
  'Analytics',
  'Alerts',
  'History',
  'Simulator',
  'Settings',
] as const;
const MapView = lazy(() =>
  import('./components/MapView').then((module) => ({ default: module.MapView })),
);
const MetricChart = lazy(() =>
  import('./components/MetricChart').then((module) => ({ default: module.MetricChart })),
);
type View = (typeof VIEWS)[number];
const DESCRIPTIONS: Record<View, string> = {
  Overview: 'The latest conditions across your monitoring network.',
  Devices: 'Station identity, location and communication health.',
  Analytics: 'Explore environmental trends from observed measurements.',
  Alerts: 'Review threshold breaches, acknowledge and track recovery.',
  History: 'Inspect and export recorded sensor observations.',
  Simulator: 'Exercise normal conditions, failures and environmental changes.',
  Settings: 'Monitoring rules and display preferences.',
};
function currentView(): View {
  return VIEWS.find((view) => view.toLowerCase() === location.hash.slice(1)) ?? 'Overview';
}
export function App() {
  const connected = useConnectionStatus();
  const { nodes, loading: nodesLoading, error: nodesError, reload: reloadNodes } = useNodes();
  const { alerts, loading: alertsLoading, error: alertsError, reload: reloadAlerts } = useAlerts();
  const summary = useResource<Summary | null>('/api/summary', null, 5000);
  const settings = useResource<Settings | null>('/api/settings', null);
  const [view, setView] = useState<View>(currentView);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [metric, setMetric] = useState<MetricName>('temperatureC');
  const [alertFilter, setAlertFilter] = useState('active');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState({ busy: false, error: '', message: '' });
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem('sahapul-compact') === 'true';
    } catch {
      return false;
    }
  });
  const history = useReadings(selectedNodeId);
  useEffect(() => {
    const listener = () => setView(currentView());
    addEventListener('hashchange', listener);
    return () => removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    document.title = `${view} · SahaPul`;
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
    try {
      localStorage.setItem('sahapul-compact', String(compact));
    } catch {
      /* Preference is optional. */
    }
  }, [compact]);
  useEffect(() => {
    if (!selectedNodeId && nodes.length) setSelectedNodeId(nodes[0]?.nodeId);
  }, [nodes, selectedNodeId]);
  const selected = nodes.find((node) => node.nodeId === selectedNodeId);
  const latest = summary.data?.latestReadings.find((reading) => reading.nodeId === selectedNodeId);
  const dirty = nodes.some(
    (node) => drafts[node.nodeId] !== undefined && drafts[node.nodeId] !== node.name,
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  const online = nodes.filter((node) => node.communicationHealth === 'online').length;
  const stale = nodes.filter((node) => node.communicationHealth === 'stale').length;
  const offline = nodes.filter((node) => node.communicationHealth === 'offline').length;
  const awaiting = nodes.filter((node) => node.communicationHealth === 'never').length;
  const chartRule = settings.data?.rules[metric];
  const chartThresholds =
    chartRule && settings.data
      ? {
          warning: settings.data.thresholds[chartRule.warning]!,
          alert: settings.data.thresholds[chartRule.alert]!,
        }
      : undefined;
  const filteredAlerts = alerts.filter(
    (alert) =>
      alertFilter === 'all' ||
      (alertFilter === 'active' ? alert.state !== 'RESOLVED' : alert.state === alertFilter),
  );
  async function saveName() {
    if (!selected) return;
    const name = (drafts[selected.nodeId] ?? selected.name).trim();
    if (!name || name.length > 100) {
      setSaveState({
        busy: false,
        error: 'Enter a device name from 1 to 100 characters.',
        message: '',
      });
      document.getElementById('device-name')?.focus();
      return;
    }
    setSaveState({ busy: true, error: '', message: '' });
    try {
      await requestJson(`/api/nodes/${encodeURIComponent(selected.nodeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[selected.nodeId];
        return next;
      });
      reloadNodes();
      setSaveState({ busy: false, error: '', message: 'Device name saved.' });
    } catch (error: unknown) {
      setSaveState({
        busy: false,
        error: error instanceof Error ? error.message : 'Could not save. Retry.',
        message: '',
      });
    }
  }
  const chart = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{selected?.name ?? 'Station observations'}</h2>
          <p>Latest 500 samples · {selected?.nodeId ?? 'Select a device'} · local time</p>
        </div>
        <span className="badge">Observed data</span>
      </div>
      <div className="metric-tabs" aria-label="Sensor metric">
        {METRICS.map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={metric === name}
            onClick={() => setMetric(name)}
          >
            {METRIC_CONFIG[name].label}
          </button>
        ))}
      </div>
      <AsyncState
        loading={history.loading}
        error={history.error}
        onRetry={history.reload}
        empty={!selected ? 'Choose a device to view measurements.' : undefined}
      >
        <Suspense fallback={<AsyncState loading />}>
          <MetricChart readings={history.readings} metric={metric} thresholds={chartThresholds} />
        </Suspense>
      </AsyncState>
    </section>
  );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="SahaPul overview">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path
              d="M5 24 12 11l6 13 6-13 7 13M5 29h26"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            SahaPul<small>ENVIRONMENTAL TELEMETRY</small>
          </span>
        </a>
        <p className="nav-caption">Workspace</p>
        <nav aria-label="Main navigation">
          {VIEWS.map((name) => (
            <a
              key={name}
              href={`#${name.toLowerCase()}`}
              aria-current={view === name ? 'page' : undefined}
            >
              <NavIcon name={name} />
              {name}
              {name === 'Alerts' && summary.data ? (
                <span className="nav-count">{summary.data.activeAlerts}</span>
              ) : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="station-line" aria-hidden="true" />
          <strong>Simulated sensor network</strong>
          <p>Live telemetry. Recorded history. No physical hardware connected.</p>
          <span className="badge">{connected ? 'Feed connected' : 'Feed disconnected'}</span>
        </div>
      </aside>
      <div className="workspace">
        <Header connected={connected} />
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">Environmental IoT Monitoring &amp; Telemetry Platform.</p>
              <h1>{view}</h1>
              <p>{DESCRIPTIONS[view]}</p>
            </div>
            <span className="date-label">
              {new Date().toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          {!connected && (
            <p className="notice" role="status">
              Live feed disconnected. Showing available observations; reconnecting automatically.
            </p>
          )}
          <div className="fleet-strip" aria-label="Network summary">
            <div>
              <span>Registered stations</span>
              <strong>{(nodesLoading || nodesError) && !nodes.length ? '—' : nodes.length}</strong>
            </div>
            <div>
              <span>Communicating now</span>
              <strong>
                {(nodesLoading || nodesError) && !nodes.length ? '—' : online}
                <small> / {nodes.length}</small>
              </strong>
            </div>
            <div>
              <span>Active alerts</span>
              <strong className={summary.data?.activeAlerts ? 'text-critical' : ''}>
                {summary.data?.activeAlerts ?? '—'}
              </strong>
            </div>
            <div>
              <span>Recorded samples</span>
              <strong>{summary.data?.readingCount.toLocaleString() ?? '—'}</strong>
            </div>
          </div>
          {view === 'Overview' && (
            <div className="health-strip" aria-label="Device communication distribution">
              <span>
                <i className="health-dot online" /> {online} online
              </span>
              <span>
                <i className="health-dot stale" /> {stale} stale
              </span>
              <span>
                <i className="health-dot offline" /> {offline} offline
              </span>
              <span>{awaiting} awaiting first reading</span>
              <span className="open-count">
                {summary.data?.openAlerts ?? '—'} open alerts ·{' '}
                {summary.data?.acknowledgedAlerts ?? '—'} acknowledged
              </span>
            </div>
          )}
          {summary.error && (
            <p className="inline-error" role="alert">
              Summary unavailable.{' '}
              <button type="button" onClick={summary.reload}>
                Retry summary
              </button>
            </p>
          )}
          {nodesError && <AsyncState error={nodesError} onRetry={reloadNodes} />}
          {view === 'Overview' && (
            <div className="dashboard-grid">
              <div className="main-column">
                {view === 'Overview' && (
                  <section className="panel map-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Network geography</h2>
                        <p>Choose a station on the map or in the station list.</p>
                      </div>
                      <span className="badge">{nodes.length} stations</span>
                    </div>
                    <div className="map-frame">
                      <Suspense fallback={<AsyncState loading />}>
                        <MapView
                          nodes={nodes}
                          selectedNodeId={selectedNodeId}
                          onSelect={setSelectedNodeId}
                        />
                      </Suspense>
                    </div>
                    <div className="map-key">
                      <span className="text-positive">● Normal</span>
                      <span className="text-warning">● Warning</span>
                      <span className="text-critical">● Alert</span>
                      <span>Health listed separately</span>
                    </div>
                  </section>
                )}
                {selected && (
                  <div className="sensor-strip">
                    {(['temperatureC', 'soilMoisturePct', 'waterLevelCm'] as const).map((name) => (
                      <div key={name}>
                        <span>{METRIC_CONFIG[name].label}</span>
                        <strong>
                          {latest?.[name] ?? '—'}
                          <small> {METRIC_CONFIG[name].unit}</small>
                        </strong>
                        <small>{selected.name}</small>
                      </div>
                    ))}
                  </div>
                )}
                {chart}
              </div>
              <div className="side-column">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Monitoring stations</h2>
                    <span className="badge">{nodes.length}</span>
                  </div>
                  <AsyncState loading={nodesLoading && !nodes.length}>
                    <NodeList
                      nodes={nodes}
                      selectedNodeId={selectedNodeId}
                      onSelect={setSelectedNodeId}
                    />
                  </AsyncState>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Recent alerts</h2>
                    <a href="#alerts">Manage alerts ↗</a>
                  </div>
                  <AsyncState
                    loading={alertsLoading && !alerts.length}
                    error={alertsError}
                    onRetry={reloadAlerts}
                  >
                    <AlertManager alerts={alerts} onChange={reloadAlerts} compact />
                  </AsyncState>
                </section>
              </div>
            </div>
          )}
          {view === 'Overview' && (
            <div className="activity-section">
              <DeviceActivity nodes={nodes} readings={summary.data?.latestReadings ?? []} />
            </div>
          )}
          {view === 'Devices' && (
            <div className="dashboard-grid">
              <DeviceInventory
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                loading={nodesLoading}
                error={nodesError}
                onRetry={reloadNodes}
                onSelect={(id) => {
                  setSelectedNodeId(id);
                  setSaveState({ busy: false, error: '', message: '' });
                }}
              />
              <section className="panel">
                <div className="panel-heading">
                  <h2>Station details</h2>
                </div>
                {selected ? (
                  <>
                    <dl className="details">
                      <dt>Identifier</dt>
                      <dd>{selected.nodeId}</dd>
                      <dt>Communication</dt>
                      <dd>{selected.communicationHealth}</dd>
                      <dt>Environment</dt>
                      <dd>{selected.status}</dd>
                      <dt>Coordinates</dt>
                      <dd>
                        {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                      </dd>
                      <dt>Last observation</dt>
                      <dd>
                        {selected.lastSeenAt
                          ? new Date(selected.lastSeenAt).toLocaleString()
                          : 'Never'}
                      </dd>
                      <dt>Last received</dt>
                      <dd>
                        {selected.lastReceivedAt
                          ? new Date(selected.lastReceivedAt).toLocaleString()
                          : 'Never'}
                      </dd>
                    </dl>
                    <form
                      className="edit-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveName();
                      }}
                    >
                      <label htmlFor="device-name">
                        Display name
                        <input
                          id="device-name"
                          maxLength={100}
                          value={drafts[selected.nodeId] ?? selected.name}
                          aria-invalid={!!saveState.error}
                          aria-describedby={saveState.error ? 'device-name-error' : undefined}
                          onChange={(event) =>
                            setDrafts((previous) => ({
                              ...previous,
                              [selected.nodeId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="row actions">
                        <button type="submit" className="primary" disabled={saveState.busy}>
                          {saveState.busy ? 'Saving…' : 'Save name'}
                        </button>
                        <button
                          type="button"
                          disabled={saveState.busy}
                          onClick={() => {
                            setDrafts((previous) => ({
                              ...previous,
                              [selected.nodeId]: selected.name,
                            }));
                            setSaveState({ busy: false, error: '', message: '' });
                          }}
                        >
                          Cancel edit
                        </button>
                      </div>
                      {saveState.error && (
                        <p id="device-name-error" className="inline-error" role="alert">
                          {saveState.error}
                        </p>
                      )}
                      <p role="status">{saveState.message}</p>
                    </form>
                  </>
                ) : (
                  <AsyncState empty="Select a registered station to inspect it." />
                )}
              </section>
            </div>
          )}
          {view === 'Alerts' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Alert lifecycle</h2>
                  <p>
                    Latest 100 episodes. Acknowledgment records review; recovery happens when
                    measurements clear hysteresis.
                  </p>
                </div>
                <button type="button" onClick={reloadAlerts}>
                  Refresh alerts
                </button>
              </div>
              <div className="filters">
                <label htmlFor="alert-filter">
                  State
                  <select
                    id="alert-filter"
                    value={alertFilter}
                    onChange={(event) => setAlertFilter(event.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="OPEN">Open</option>
                    <option value="ACKNOWLEDGED">Acknowledged</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="all">All states</option>
                  </select>
                </label>
              </div>
              <AsyncState
                loading={alertsLoading && !alerts.length}
                error={alertsError}
                onRetry={reloadAlerts}
              >
                <AlertManager
                  alerts={filteredAlerts}
                  onChange={() => {
                    reloadAlerts();
                    summary.reload();
                  }}
                />
              </AsyncState>
            </section>
          )}
          {view === 'Analytics' && (
            <AnalyticsView
              nodes={nodes}
              nodeId={selectedNodeId}
              onSelect={setSelectedNodeId}
              settings={settings.data}
            />
          )}
          {view === 'History' && <HistoryView nodes={nodes} />}
          {view === 'Simulator' && <SimulatorControls />}
          {view === 'Settings' && (
            <div className="settings-layout">
              <SystemStatus />
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Monitoring rules</h2>
                      <p>Read-only server policy. Values use sensor units.</p>
                    </div>
                  </div>
                  <AsyncState
                    loading={settings.loading}
                    error={settings.error}
                    onRetry={settings.reload}
                  >
                    {settings.data && (
                      <>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Metric</th>
                                <th>Warning</th>
                                <th>Critical</th>
                                <th>Recovery margin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(settings.data.rules).map(([name, rule]) => (
                                <tr key={name}>
                                  <td>{METRIC_CONFIG[name as MetricName].label}</td>
                                  <td>
                                    {rule.lower ? '≤' : '≥'}{' '}
                                    {settings.data?.thresholds[rule.warning]}
                                  </td>
                                  <td>
                                    {rule.lower ? '≤' : '≥'} {settings.data?.thresholds[rule.alert]}
                                  </td>
                                  <td>{settings.data?.hysteresis[name]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="panel-copy">
                          Episode cooldown: {settings.data.alertCooldownMs / 1000}s. Communication
                          becomes stale at {settings.data.staleAfterMs / 1000}s and offline at{' '}
                          {settings.data.offlineAfterMs / 1000}s.
                        </p>
                      </>
                    )}
                  </AsyncState>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Display & connection</h2>
                  </div>
                  <div className="panel-copy">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={compact}
                        onChange={(event) => setCompact(event.target.checked)}
                      />{' '}
                      Compact station rows
                    </label>
                    <p>
                      Preference is saved in this browser. Timestamps use your local timezone:{' '}
                      <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>.
                    </p>
                    <dl className="details">
                      <dt>API endpoint</dt>
                      <dd>{API_BASE_URL}</dd>
                      <dt>Live connection</dt>
                      <dd>{connected ? 'Connected' : 'Reconnecting'}</dd>
                    </dl>
                  </div>
                </section>
              </div>
            </div>
          )}
          <footer>
            SahaPul <span>Environmental IoT Monitoring & Telemetry Platform · synthetic data</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
