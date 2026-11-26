import { lazy, Suspense, useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource';
import type { Analytics, Settings } from '../lib/api';
import type { MetricName, NodeRecord } from '../types';
import { METRICS, METRIC_CONFIG } from '../lib/metrics';
import { AsyncState } from './AsyncState';
const MetricChart = lazy(() =>
  import('./MetricChart').then((module) => ({ default: module.MetricChart })),
);
export function AnalyticsView({
  nodes,
  nodeId,
  onSelect,
  settings,
}: {
  nodes: NodeRecord[];
  nodeId?: string;
  onSelect: (id: string) => void;
  settings: Settings | null;
}) {
  const [windowMs, setWindowMs] = useState('3600000');
  const [anchor, setAnchor] = useState(Date.now());
  const [metric, setMetric] = useState<MetricName>('temperatureC');
  const selected = nodeId ?? nodes[0]?.nodeId;
  const bucketMs =
    Number(windowMs) <= 3600000 ? 60_000 : Number(windowMs) <= 86400000 ? 900_000 : 3_600_000;
  const from = new Date(anchor - Number(windowMs)).toISOString(),
    to = new Date(anchor).toISOString();
  const path = selected
    ? `/api/nodes/${encodeURIComponent(selected)}/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucketMs=${bucketMs}`
    : null;
  const resource = useResource<Analytics | null>(path, null);
  const stats = resource.data?.statistics[metric];
  const points = useMemo(
    () =>
      resource.data?.buckets.map((bucket) => ({
        ts: bucket.bucketStart,
        value: bucket[metric]?.avg ?? null,
      })) ?? [],
    [resource.data, metric],
  );
  const rule = settings?.rules[metric];
  const thresholds =
    rule && settings
      ? { warning: settings.thresholds[rule.warning]!, alert: settings.thresholds[rule.alert]! }
      : undefined;
  return (
    <div className="analytics-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Environmental analytics</h2>
            <p>
              Explore a complete time window with averages calculated from measured source samples.
            </p>
          </div>
          <span className="badge">Synthetic telemetry</span>
        </div>
        <div className="row filters analytics-filters">
          <label htmlFor="analytics-device">
            Device
            <select
              id="analytics-device"
              value={selected ?? ''}
              onChange={(event) => onSelect(event.target.value)}
            >
              {nodes.map((node) => (
                <option key={node.nodeId} value={node.nodeId}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="analytics-range">
            Time range
            <select
              id="analytics-range"
              value={windowMs}
              onChange={(event) => {
                setWindowMs(event.target.value);
                setAnchor(Date.now());
              }}
            >
              <option value="900000">Last 15 minutes</option>
              <option value="3600000">Last hour</option>
              <option value="86400000">Last 24 hours</option>
              <option value="604800000">Last 7 days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setAnchor(Date.now());
              resource.reload();
            }}
          >
            Refresh analysis
          </button>
        </div>
        <div className="metric-tabs" aria-label="Analytics metric">
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
          loading={resource.loading && !!selected}
          error={resource.error}
          onRetry={resource.reload}
          empty={
            !selected
              ? 'Start the simulator to register devices.'
              : resource.data?.sampleCount === 0
                ? 'No observations in this time range. Choose another window or wait for telemetry.'
                : undefined
          }
        >
          <div className="analytics-statistics" aria-label="Selected metric statistics">
            {[
              ['Average', stats?.avg],
              ['Minimum', stats?.min],
              ['Maximum', stats?.max],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {value ?? '—'}
                  <small> {METRIC_CONFIG[metric].unit}</small>
                </strong>
              </div>
            ))}
            <div>
              <span>Measured samples</span>
              <strong>{stats?.count ?? 0}</strong>
            </div>
          </div>
          <div className="analytics-chart">
            <Suspense fallback={<AsyncState loading />}>
              <MetricChart
                metric={metric}
                points={points}
                thresholds={thresholds}
                showDates={Number(windowMs) >= 86400000}
              />
            </Suspense>
          </div>
          <p className="analysis-note">
            {resource.data?.sampleCount ?? 0} observations · {METRIC_CONFIG[metric].label} ·{' '}
            {bucketMs / 60000}-minute averages · {new Date(from).toLocaleString()} –{' '}
            {new Date(to).toLocaleString()}
          </p>
          <p className="analysis-note">
            Missing sensor values remain unmeasured. Up to 50000 source samples per window; larger
            ranges require a narrower selection.
          </p>
        </AsyncState>
      </section>
    </div>
  );
}
