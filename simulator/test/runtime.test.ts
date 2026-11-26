import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFleet } from '../src/fleet.js';
import { SimulationRuntime } from '../src/runtime.js';
import { SCENARIOS, scenarioReading } from '../src/scenarios.js';
import { loadConfig } from '../src/config.js';
describe('simulator runtime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('rejects invalid intervals, fleet counts and probabilities from the supplied environment', () => {
    expect(
      loadConfig({ NODE_COUNT: '3', PUBLISH_INTERVAL_MS: '250', ALERT_PROBABILITY: '0' }),
    ).toMatchObject({ nodeCount: 3, publishIntervalMs: 250, alertProbability: 0 });
    for (const value of ['0', '249', '60001', '4000x', '1.5'])
      expect(() => loadConfig({ PUBLISH_INTERVAL_MS: value })).toThrow();
    expect(() => loadConfig({ NODE_COUNT: '-1' })).toThrow();
    expect(() => loadConfig({ ALERT_PROBABILITY: '1.1' })).toThrow();
  });
  it('start is idempotent, never overlaps slow ticks, and stop clears its timer', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const publish = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const runtime = new SimulationRuntime(createFleet(1), publish, 250, 'normal');
    runtime.start();
    runtime.start();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(1);
    runtime.stop();
    expect(vi.getTimerCount()).toBe(0);
    finish();
    await runtime.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it('reconfigures without leaking timers and validates before changing running state', async () => {
    vi.useFakeTimers();
    const runtime = new SimulationRuntime(createFleet(1), async () => undefined, 250, 'normal');
    runtime.start();
    expect(() => runtime.configure(true, 'normal', 0)).toThrow();
    expect(runtime.state.running).toBe(true);
    runtime.configure(true, 'high-gas', 500);
    expect(vi.getTimerCount()).toBe(1);
    expect(runtime.state.scenario).toBe('high-gas');
    await runtime.close();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(SCENARIOS.filter((scenario) => scenario !== 'random'))(
    'produces deterministic scenario %s within physical bounds',
    (scenario) => {
      const reading = createFleet(1)[0]!.tick();
      const first = scenarioReading({ ...reading, seq: 100 }, scenario, 1)!;
      expect(scenarioReading({ ...reading, seq: 100 }, scenario, 1)).toEqual(first);
      expect(first.humidityPct).toBeGreaterThanOrEqual(0);
      expect(first.humidityPct).toBeLessThanOrEqual(100);
      expect(first.soilMoisturePct).toBeGreaterThanOrEqual(0);
      expect(first.soilMoisturePct).toBeLessThanOrEqual(100);
      expect(first.waterLevelCm).toBeGreaterThanOrEqual(0);
      expect(first.batteryPct).toBeGreaterThanOrEqual(0);
    },
  );
  it('disconnects only the first station and drives each abnormal scenario through its threshold', () => {
    const reading = { ...createFleet(1)[0]!.tick(), seq: 100 };
    expect(scenarioReading(reading, 'disconnection', 0)).toBeNull();
    expect(scenarioReading(reading, 'disconnection', 1)).not.toBeNull();
    expect(scenarioReading(reading, 'high-temperature', 0)!.temperatureC).toBeGreaterThanOrEqual(
      45,
    );
    expect(scenarioReading(reading, 'high-gas', 0)!.gasPpm).toBeGreaterThanOrEqual(400);
    expect(scenarioReading(reading, 'dry-soil', 0)!.soilMoisturePct).toBeLessThanOrEqual(15);
    expect(scenarioReading(reading, 'declining-water', 0)!.waterLevelCm).toBeLessThanOrEqual(10);
    expect(scenarioReading(reading, 'low-battery', 0)!.batteryPct).toBeLessThanOrEqual(10);
  });
});
