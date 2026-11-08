import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeviceInventory } from './DeviceInventory';
import { filterDevices } from '../lib/deviceFilters';
import type { NodeRecord } from '../types';
const nodes: NodeRecord[] = [
  {
    nodeId: 'n1',
    name: 'North ridge',
    lat: 0,
    lng: 0,
    installedAt: '2026-01-01T00:00:00Z',
    lastSeenAt: null,
    status: 'normal',
    communicationHealth: 'online',
  },
  {
    nodeId: 'n2',
    name: 'Dry basin',
    lat: 0,
    lng: 0,
    installedAt: '2026-01-01T00:00:00Z',
    lastSeenAt: null,
    status: 'alert',
    communicationHealth: 'stale',
  },
];
describe('device inventory', () => {
  it('combines case-insensitive name/ID search, health and environmental condition', () => {
    expect(filterDevices(nodes, ' NORTH ', 'online', 'normal').map((node) => node.nodeId)).toEqual([
      'n1',
    ]);
    expect(filterDevices(nodes, 'n2', 'stale', 'alert').map((node) => node.nodeId)).toEqual(['n2']);
    expect(filterDevices(nodes, 'n2', 'online', 'alert')).toEqual([]);
  });
  it('clears search, preserves focus, exposes no results and resets filters', () => {
    window.history.replaceState(null, '', '/#devices');
    render(
      <DeviceInventory
        nodes={nodes}
        selectedNodeId="n1"
        onSelect={vi.fn()}
        loading={false}
        onRetry={vi.fn()}
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Search devices' });
    fireEvent.change(input, { target: { value: 'missing' } });
    expect(screen.getByText('No matching devices')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear device search' }));
    expect(input).toHaveFocus();
    expect(screen.getByText('2 of 2 devices')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Communication'), { target: { value: 'offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByText('North ridge')).toBeInTheDocument();
  });
});
