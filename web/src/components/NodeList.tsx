import { timeAgo } from '../lib/format';
import type { NodeRecord } from '../types';
import { StatusBadge } from './StatusBadge';

export function NodeList({
  nodes,
  selectedNodeId,
  onSelect,
}: {
  nodes: NodeRecord[];
  selectedNodeId: string | undefined;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <ul className="divide-y divide-line dark:divide-line-dark">
      {nodes.map((node) => {
        const isSelected = node.nodeId === selectedNodeId;
        return (
          <li key={node.nodeId}>
            <button
              type="button"
              onClick={() => onSelect(node.nodeId)}
              aria-pressed={isSelected}
              className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                isSelected
                  ? 'bg-accent/10 dark:bg-accent-dark/10'
                  : 'hover:bg-plane dark:hover:bg-plane-dark'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink-primary dark:text-ink-primary-dark">
                  {node.name}
                </span>
                <StatusBadge status={node.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>{node.nodeId}</span>
                <span>
                  {node.communicationHealth ?? 'never'} ·{' '}
                  {timeAgo(node.lastReceivedAt ?? node.lastSeenAt)}
                </span>
              </div>
            </button>
          </li>
        );
      })}
      {nodes.length === 0 && (
        <li className="px-4 py-6 text-center text-sm text-ink-muted">
          No nodes yet. Start the simulator to see the fleet appear here.
        </li>
      )}
    </ul>
  );
}
