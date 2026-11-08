import type { NodeRecord } from '../types';
export function filterDevices(
  nodes: NodeRecord[],
  query: string,
  health: string,
  condition: string,
): NodeRecord[] {
  const term = query.trim().toLocaleLowerCase();
  return nodes.filter(
    (node) =>
      (!term || `${node.name} ${node.nodeId}`.toLocaleLowerCase().includes(term)) &&
      (health === 'all' || node.communicationHealth === health) &&
      (condition === 'all' || node.status === condition),
  );
}
