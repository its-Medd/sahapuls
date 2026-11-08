import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NodeRecord } from '../types';
import { NodeList } from './NodeList';

function node(overrides: Partial<NodeRecord> = {}): NodeRecord {
  return {
    nodeId: 'node-01',
    name: 'Ridge North',
    lat: 49.98,
    lng: -119.4,
    installedAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: null,
    status: 'normal',
    ...overrides,
  };
}

describe('NodeList', () => {
  it('renders an empty-state message when there are no nodes', () => {
    render(<NodeList nodes={[]} selectedNodeId={undefined} onSelect={() => undefined} />);
    expect(screen.getByText(/no nodes yet/i)).toBeInTheDocument();
  });

  it('renders a row per node with its name and status', () => {
    render(
      <NodeList
        nodes={[
          node({ nodeId: 'node-01', name: 'Ridge North' }),
          node({ nodeId: 'node-02', name: 'Creek Basin', status: 'alert' }),
        ]}
        selectedNodeId={undefined}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('Ridge North')).toBeInTheDocument();
    expect(screen.getByText('Creek Basin')).toBeInTheDocument();
    expect(screen.getByText('Alert')).toBeInTheDocument();
  });

  it('calls onSelect with the clicked node id', () => {
    const onSelect = vi.fn();
    render(
      <NodeList
        nodes={[node({ nodeId: 'node-01', name: 'Ridge North' })]}
        selectedNodeId={undefined}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('Ridge North'));

    expect(onSelect).toHaveBeenCalledWith('node-01');
  });
});
