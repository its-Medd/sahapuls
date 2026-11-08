import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { NodeRecord, Severity } from '../types';

const STATUS_COLOR: Record<Severity, string> = {
  normal: 'var(--accent)',
  warning: 'var(--warning)',
  alert: 'var(--critical)',
};

/** Recenters the map when the fleet's average position shifts materially (e.g. first load). */
function RecenterOnFleet({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), {
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
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
  const [tileError, setTileError] = useState(false);
  const center: [number, number] =
    nodes.length > 0
      ? [
          nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length,
          nodes.reduce((sum, n) => sum + n.lng, 0) / nodes.length,
        ]
      : [49.98, -119.4];

  return (
    <div className="map-content">
      <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <RecenterOnFleet center={center} />
        {nodes.map((node) => (
          <CircleMarker
            key={node.nodeId}
            center={[node.lat, node.lng]}
            radius={node.nodeId === selectedNodeId ? 11 : 8}
            pathOptions={{
              color: 'var(--surface)',
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
      {tileError && (
        <p className="map-error" role="status">
          Base map unavailable. Station markers and the station list remain usable.
        </p>
      )}
    </div>
  );
}
