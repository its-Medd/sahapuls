import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { requestJson, type SimulatorState } from '../lib/api';
import { AsyncState } from './AsyncState';
const SCENARIOS = [
  ['normal', 'Normal environment'],
  ['high-temperature', 'Excessive temperature'],
  ['dry-soil', 'Low soil moisture'],
  ['declining-water', 'Declining water level'],
  ['high-gas', 'High gas concentration'],
  ['low-battery', 'Low battery'],
  ['disconnection', 'First device disconnected'],
  ['random', 'Random environment'],
] as const;
export function SimulatorControls() {
  const resource = useResource<SimulatorState>('/api/simulator', { available: false }, 10000);
  const [scenario, setScenario] = useState('normal');
  const [interval, setIntervalValue] = useState('4000');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function apply(running: boolean) {
    setError('');
    setMessage('');
    const ms = running ? Number(interval) : (resource.data.intervalMs ?? 4000);
    const selectedScenario = running ? scenario : (resource.data.scenario ?? 'normal');
    if (!Number.isInteger(ms) || ms < 250 || ms > 60000) {
      setError('Enter an interval from 250 to 60000 milliseconds.');
      document.getElementById('interval')?.focus();
      return;
    }
    setBusy(true);
    try {
      const status = await requestJson<SimulatorState>('/api/simulator', {
        method: 'POST',
        body: JSON.stringify({ running, scenario: selectedScenario, intervalMs: ms }),
      });
      resource.setData({ ...status, available: true });
      setMessage(
        running
          ? 'Simulator confirmed: publishing with the selected scenario.'
          : 'Simulator confirmed: publishing paused.',
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Control failed. Refresh status and retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Simulation lab</h2>
          <p>Generate live test readings for the monitoring pipeline.</p>
        </div>
        <span className={`badge ${resource.data.available ? 'online' : 'offline'}`}>
          {resource.data.available ? (resource.data.running ? 'Publishing' : 'Paused') : 'Offline'}
        </span>
      </div>
      <AsyncState
        error={resource.error}
        loading={resource.loading && !resource.data.updatedAt}
        onRetry={resource.reload}
      >
        {!resource.data.available && (
          <p className="notice">
            Start the simulator process to enable controls. Historical observations stay available.
          </p>
        )}
        <p className="subtle">
          Current scenario: {resource.data.scenario ?? 'Unavailable'} · Interval:{' '}
          {resource.data.intervalMs ?? '—'} ms
        </p>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void apply(true);
          }}
          className="form-grid"
        >
          <label htmlFor="scenario">
            Test scenario
            <select
              id="scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              {SCENARIOS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="interval">
            Publish interval (ms)
            <input
              id="interval"
              type="number"
              min={250}
              max={60000}
              value={interval}
              onChange={(event) => setIntervalValue(event.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'simulator-error' : 'interval-help'}
            />
            <small id="interval-help">
              250–60000 ms. Deterministic scenarios advance with each reading.
            </small>
          </label>
          <div className="row actions">
            <button type="submit" className="primary" disabled={busy || !resource.data.available}>
              {busy ? 'Waiting for confirmation…' : 'Apply and start'}
            </button>
            <button
              type="button"
              disabled={busy || !resource.data.available || !resource.data.running}
              onClick={() => void apply(false)}
            >
              Pause publishing
            </button>
            <button type="button" className="quiet" onClick={resource.reload}>
              Refresh status
            </button>
          </div>
        </form>
        {error && (
          <p id="simulator-error" className="inline-error" role="alert">
            {error}
          </p>
        )}
        <p role="status">{message}</p>
        <p className="subtle">
          These are synthetic readings. The disconnection scenario pauses the first device; its
          communication health changes after 30 seconds and 2 minutes.
        </p>
      </AsyncState>
    </section>
  );
}
