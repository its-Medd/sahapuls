import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { NodeRecord, Severity } from '../types';

const STATUS_COLOR: Record<Severity, string> = {
  normal: '#0ca30c',
  warning: '#fab219',
  alert: '#d03b3b',
};

/** Recenters the map when the fleet's average position shifts materially (e.g. first load). */
function RecenterOnFleet({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
    // Only re-run when the center actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
}

export function MapView({
  nodes,
  selectedNodeId,
  onSelect,
}: {
  nodes: NodeRecord[];
  selectedNodeId: string | undefined;
  onSelect: (nodeId: string) => void;
}) {
  const center: [number, number] =
    nodes.length > 0
      ? [
          nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length,
          nodes.reduce((sum, n) => sum + n.lng, 0) / nodes.length,
        ]
      : [49.98, -119.4];

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterOnFleet center={center} />
      {nodes.map((node) => (
        <CircleMarker
          key={node.nodeId}
          center={[node.lat, node.lng]}
          radius={node.nodeId === selectedNodeId ? 11 : 8}
          pathOptions={{
            color: '#fcfcfb',
            weight: 2,
            fillColor: STATUS_COLOR[node.status],
            fillOpacity: 0.9,
          }}
          eventHandlers={{ click: () => onSelect(node.nodeId) }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-medium">{node.name}</p>
              <p className="text-xs text-ink-muted">{node.nodeId}</p>
              <p className="mt-1 capitalize">status: {node.status}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
