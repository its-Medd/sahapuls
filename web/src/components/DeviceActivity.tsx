import type { NodeRecord, ReadingRecord } from '../types';
import { timeAgo } from '../lib/format';
export function DeviceActivity({
  nodes,
  readings,
}: {
  nodes: NodeRecord[];
  readings: ReadingRecord[];
}) {
  const latest = new Map(readings.map((reading) => [reading.nodeId, reading]));
  const recent = [...nodes].sort((a, b) =>
    (b.lastReceivedAt ?? '').localeCompare(a.lastReceivedAt ?? ''),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Device activity</h2>
          <p>Latest server receipt per station; environmental condition is independent.</p>
        </div>
        <span className="badge">{nodes.length} devices</span>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Recent device activity">
        <table>
          <thead>
            <tr>
              <th>Station</th>
              <th>Communication</th>
              <th>Last received</th>
              <th>Battery</th>
              <th>Environment</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((node) => (
              <tr key={node.nodeId}>
                <td>
                  <strong>{node.name}</strong>
                  <small className="cell-id">{node.nodeId}</small>
                </td>
                <td>
                  <span className={`badge ${node.communicationHealth}`}>
                    {node.communicationHealth === 'never'
                      ? 'Awaiting data'
                      : node.communicationHealth}
                  </span>
                </td>
                <td>
                  <time
                    dateTime={node.lastReceivedAt ?? undefined}
                    title={
                      node.lastReceivedAt
                        ? new Date(node.lastReceivedAt).toLocaleString()
                        : 'No reading received'
                    }
                  >
                    {timeAgo(node.lastReceivedAt ?? null)}
                  </time>
                </td>
                <td>{latest.get(node.nodeId)?.batteryPct ?? '—'}%</td>
                <td>
                  {node.status === 'alert'
                    ? 'Critical'
                    : node.status === 'warning'
                      ? 'Warning'
                      : 'Normal'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!nodes.length && <div className="state">Start the simulator to see device activity.</div>}
      </div>
    </section>
  );
}
