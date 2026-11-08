import { useRef, useState } from 'react';
import type { NodeRecord } from '../types';
import { NodeList } from './NodeList';
import { AsyncState } from './AsyncState';
import { filterDevices } from '../lib/deviceFilters';
export function DeviceInventory({
  nodes,
  selectedNodeId,
  onSelect,
  loading,
  error,
  onRetry,
}: {
  nodes: NodeRecord[];
  selectedNodeId?: string;
  onSelect: (id: string) => void;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  const params = new URLSearchParams(location.search);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [health, setHealth] = useState(params.get('health') ?? 'all');
  const [condition, setCondition] = useState(params.get('condition') ?? 'all');
  const input = useRef<HTMLInputElement>(null);
  const matches = filterDevices(nodes, query, health, condition);
  function update(nextQuery: string, nextHealth: string, nextCondition: string) {
    setQuery(nextQuery);
    setHealth(nextHealth);
    setCondition(nextCondition);
    const search = new URLSearchParams(location.search);
    for (const [key, value] of [
      ['q', nextQuery],
      ['health', nextHealth],
      ['condition', nextCondition],
    ] as const) {
      if (value && value !== 'all') search.set(key, value);
      else search.delete(key);
    }
    window.history.replaceState(
      null,
      '',
      `${location.pathname}${search.size ? '?' + search.toString() : ''}${location.hash}`,
    );
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Station register</h2>
          <p>Find a device, then inspect its measurements and connection health.</p>
        </div>
        <button type="button" onClick={onRetry}>
          Refresh stations
        </button>
      </div>
      <div className="inventory-filters">
        <label htmlFor="device-search">
          Search devices
          <div className="search-field">
            <input
              ref={input}
              id="device-search"
              type="search"
              autoComplete="off"
              placeholder="Name or device ID"
              value={query}
              onChange={(event) => update(event.target.value, health, condition)}
            />
            {query && (
              <button
                type="button"
                className="quiet clear-search"
                aria-label="Clear device search"
                onClick={() => {
                  update('', health, condition);
                  input.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
        </label>
        <label htmlFor="device-health">
          Communication
          <select
            id="device-health"
            value={health}
            onChange={(event) => update(query, event.target.value, condition)}
          >
            <option value="all">All health states</option>
            <option value="online">Online</option>
            <option value="stale">Stale</option>
            <option value="offline">Offline</option>
            <option value="never">Awaiting first reading</option>
          </select>
        </label>
        <label htmlFor="device-condition">
          Environment
          <select
            id="device-condition"
            value={condition}
            onChange={(event) => update(query, health, event.target.value)}
          >
            <option value="all">All conditions</option>
            <option value="normal">Normal</option>
            <option value="warning">Warning</option>
            <option value="alert">Critical</option>
          </select>
        </label>
      </div>
      <AsyncState loading={loading && !nodes.length} error={error} onRetry={onRetry}>
        <p className="result-count" role="status">
          {matches.length} of {nodes.length} devices
        </p>
        {nodes.length && !matches.length ? (
          <div className="state">
            <strong>No matching devices</strong>
            <p>Try another name or clear the health and condition filters.</p>
            <button
              type="button"
              onClick={() => {
                update('', 'all', 'all');
                input.current?.focus();
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <NodeList nodes={matches} selectedNodeId={selectedNodeId} onSelect={onSelect} />
        )}
      </AsyncState>
    </section>
  );
}
