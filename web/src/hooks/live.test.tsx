import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNodes } from './useNodes';
import { useReadings } from './useReadings';
const { listeners, socket } = vi.hoisted(() => {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  const socket = {
    on: (event: string, fn: (value: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off: (event: string, fn: (value: unknown) => void) => listeners.get(event)?.delete(fn),
  };
  return { listeners, socket };
});
vi.mock('../lib/socket', () => ({ getSocket: () => socket }));
function emit(event: string, value: unknown) {
  for (const listener of listeners.get(event) ?? []) listener(value);
}
const node = {
  nodeId: 'n1',
  name: 'Station',
  lat: 0,
  lng: 0,
  installedAt: '2026-01-01T00:00:00Z',
  lastSeenAt: null,
  status: 'normal',
};
const reading = {
  id: 2,
  nodeId: 'n1',
  ts: '2026-01-01T00:00:02Z',
  temperatureC: 22,
  humidityPct: 50,
  gasPpm: 10,
  batteryPct: 90,
  lat: 0,
  lng: 0,
  severity: 'normal',
};
describe('live data reconciliation', () => {
  beforeEach(() => {
    listeners.clear();
  });
  afterEach(() => vi.unstubAllGlobals());
  it('discovers a device after page load and merges events received during the initial request', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      ),
    );
    const { result, unmount } = renderHook(() => useNodes());
    act(() => emit('node', node));
    act(() => resolve(new Response('[]', { status: 200 })));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.nodes).toHaveLength(1);
    act(() => emit('node', { ...node, name: 'Renamed' }));
    expect(result.current.nodes[0]?.name).toBe('Renamed');
    unmount();
    expect(listeners.get('node')?.size).toBe(0);
  });
  it('merges and deduplicates history/socket races then clears readings when switching devices', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      ),
    );
    const { result, rerender } = renderHook(({ id }) => useReadings(id), {
      initialProps: { id: 'n1' },
    });
    act(() => emit('reading', reading));
    act(() =>
      resolve(
        new Response(JSON.stringify([{ ...reading, id: 1, ts: '2026-01-01T00:00:01Z' }, reading]), {
          status: 200,
        }),
      ),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.readings.map((r) => r.id)).toEqual([1, 2]);
    rerender({ id: 'n2' });
    expect(result.current.readings).toEqual([]);
  });
  it('exposes API failures for retry instead of presenting them as a successful empty fleet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 }),
      ),
    );
    const { result } = renderHook(() => useNodes());
    await waitFor(() => expect(result.current.error).toBe('Service unavailable'));
    expect(result.current.loading).toBe(false);
  });
});
