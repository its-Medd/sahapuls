import { useEffect } from 'react';
import { useResource } from './useResource';
import { getSocket } from '../lib/socket';
import type { NodeRecord } from '../types';
const merge = (snapshot: NodeRecord[], current: NodeRecord[]) => [
  ...new Map([...snapshot, ...current].map((n) => [n.nodeId, n])).values(),
];
export function useNodes() {
  const resource = useResource<NodeRecord[]>('/api/nodes', [], 0, merge);
  const { setData } = resource;
  useEffect(() => {
    const socket = getSocket();
    const onNode = (node: NodeRecord) =>
      setData((previous) =>
        [...previous.filter((n) => n.nodeId !== node.nodeId), node].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
    socket.on('node', onNode);
    return () => {
      socket.off('node', onNode);
    };
  }, [setData]);
  return {
    nodes: resource.data,
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
}
