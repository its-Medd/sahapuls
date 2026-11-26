import { useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource';
import type { NodeRecord, ReadingRecord } from '../types';
import { AsyncState } from './AsyncState';
export function HistoryView({ nodes }: { nodes: NodeRecord[] }) {
  const [selected, setSelected] = useState('');
  const [range, setRange] = useState('3600000');
  const [anchor, setAnchor] = useState(Date.now());
  const nodeId = selected || nodes[0]?.nodeId;
  const path = useMemo(
    () =>
      nodeId
        ? `/api/nodes/${encodeURIComponent(nodeId)}/readings?limit=5000&from=${encodeURIComponent(new Date(anchor - Number(range)).toISOString())}&to=${encodeURIComponent(new Date(anchor).toISOString())}`
        : null,
    [nodeId, range, anchor],
  );
  const resource = useResource<ReadingRecord[]>(path, []);
  function exportCsv() {
    const columns = [
      'ts',
      'nodeId',
      'temperatureC',
      'humidityPct',
      'gasPpm',
      'batteryPct',
      'soilMoisturePct',
      'waterLevelCm',
      'lat',
      'lng',
    ] as const;
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      columns.join(','),
      ...resource.data.map((reading) => columns.map((column) => escape(reading[column])).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sahapul-${nodeId}-readings.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Observation archive</h2>
          <p>Latest 5000 samples in the selected window. Times use your browser timezone.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={resource.loading || !!resource.error || !resource.data.length || !nodeId}
        >
          Export CSV
        </button>
      </div>
      <div className="row filters">
        <label htmlFor="history-node">
          Device
          <select
            id="history-node"
            value={nodeId ?? ''}
            onChange={(event) => setSelected(event.target.value)}
          >
            {nodes.map((node) => (
              <option key={node.nodeId} value={node.nodeId}>
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="history-range">
          Window
          <select
            id="history-range"
            value={range}
            onChange={(event) => {
              setRange(event.target.value);
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
          Refresh window
        </button>
      </div>
      <AsyncState
        loading={resource.loading}
        error={nodeId ? resource.error : undefined}
        empty={
          !nodeId
            ? 'Start the simulator to register devices.'
            : !resource.loading && !resource.data.length
              ? 'Choose another window or wait for live observations.'
              : undefined
        }
        onRetry={resource.reload}
      >
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Historical readings">
          <table>
            <caption className="sr-only">Sensor measurements</caption>
            <thead>
              <tr>
                {[
                  'Observed at',
                  'Temp °C',
                  'Humidity %',
                  'Gas ppm',
                  'Battery %',
                  'Soil %',
                  'Water cm',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resource.data.map((reading) => (
                <tr key={reading.id}>
                  <td>{new Date(reading.ts).toLocaleString()}</td>
                  {(
                    [
                      'temperatureC',
                      'humidityPct',
                      'gasPpm',
                      'batteryPct',
                      'soilMoisturePct',
                      'waterLevelCm',
                    ] as const
                  ).map((metric) => (
                    <td key={metric}>{reading[metric] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="subtle">{resource.data.length} samples · Missing sensors are shown as —.</p>
      </AsyncState>
    </section>
  );
}
