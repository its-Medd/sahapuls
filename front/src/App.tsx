import { useEffect, useState } from 'react';
import { AlertFeed } from './components/AlertFeed';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { MetricChart } from './components/MetricChart';
import { NodeList } from './components/NodeList';
import { useAlerts } from './hooks/useAlerts';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useNodes } from './hooks/useNodes';
import { useReadings } from './hooks/useReadings';
import { METRIC_CONFIG, METRICS } from './lib/metrics';
import type { MetricName } from './types';

export function App() {
  const connected = useConnectionStatus();
  const { nodes, loading: nodesLoading } = useNodes();
  const { alerts } = useAlerts();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedMetric, setSelectedMetric] = useState<MetricName>('temperatureC');
  const { readings } = useReadings(selectedNodeId);

  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0]?.nodeId);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find((n) => n.nodeId === selectedNodeId);

  return (
    <div className="flex h-screen flex-col bg-plane text-ink-primary dark:bg-plane-dark dark:text-ink-primary-dark">
      <Header connected={connected} />

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="flex min-h-0 flex-col gap-4">
          <div className="h-64 overflow-hidden rounded-lg border border-line shadow-sm dark:border-line-dark lg:h-80">
            <MapView nodes={nodes} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface p-4 shadow-sm dark:border-line-dark dark:bg-surface-dark">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">
                {selectedNode ? selectedNode.name : 'Select a node'}
                {selectedNode && (
                  <span className="ml-2 text-xs text-ink-muted">{selectedNode.nodeId}</span>
                )}
              </h2>
              <div className="flex gap-1 rounded-md bg-plane p-1 dark:bg-plane-dark">
                {METRICS.map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => setSelectedMetric(metric)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      selectedMetric === metric
                        ? 'bg-accent text-white dark:bg-accent-dark'
                        : 'text-ink-secondary hover:bg-surface dark:text-ink-secondary-dark dark:hover:bg-surface-dark'
                    }`}
                  >
                    {METRIC_CONFIG[metric].label}
                  </button>
                ))}
              </div>
            </div>
            <MetricChart readings={readings} metric={selectedMetric} />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface shadow-sm dark:border-line-dark dark:bg-surface-dark">
            <h2 className="border-b border-line px-4 py-3 font-medium dark:border-line-dark">
              Nodes {nodesLoading && <span className="text-xs text-ink-muted">(loading...)</span>}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NodeList
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-surface shadow-sm dark:border-line-dark dark:bg-surface-dark">
            <h2 className="border-b border-line px-4 py-3 font-medium dark:border-line-dark">
              Alert feed
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AlertFeed alerts={alerts} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
