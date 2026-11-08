import { beforeEach, describe, expect, it } from 'vitest';
import { VirtualNode } from '../src/node.js';

function makeNode(): VirtualNode {
  return new VirtualNode({
    nodeId: 'node-01',
    name: 'Test Node',
    lat: 49.98,
    lng: -119.4,
    baselineTemperatureC: 20,
    baselineHumidityPct: 50,
    baselineGasPpm: 10,
  });
}

describe('VirtualNode.tick', () => {
  let node: VirtualNode;

  beforeEach(() => {
    node = makeNode();
  });

  it('increments seq on every tick', () => {
    const first = node.tick();
    const second = node.tick();
    expect(second.seq).toBe(first.seq + 1);
  });

  it('produces readings with the correct nodeId and coordinates near the home location', () => {
    const reading = node.tick();
    expect(reading.nodeId).toBe('node-01');
    expect(reading.lat).toBeCloseTo(49.98, 1);
    expect(reading.lng).toBeCloseTo(-119.4, 1);
  });

  it('keeps readings within sane physical bounds over many ticks with no alert', () => {
    for (let i = 0; i < 100; i += 1) {
      const reading = node.tick();
      expect(reading.humidityPct).toBeGreaterThanOrEqual(0);
      expect(reading.humidityPct).toBeLessThanOrEqual(100);
      expect(reading.batteryPct).toBeGreaterThanOrEqual(0);
      expect(reading.batteryPct).toBeLessThanOrEqual(100);
      expect(reading.simulatedAlert).toBe(false);
    }
  });

  it('does not report an alert episode by default', () => {
    expect(node.isInAlertEpisode).toBe(false);
    const reading = node.tick();
    expect(reading.simulatedAlert).toBe(false);
  });

  it('reports simulatedAlert=true and elevated temperature/gas while an alert episode is active', () => {
    const baseline = node.tick();
    node.triggerAlertEpisode();
    expect(node.isInAlertEpisode).toBe(true);

    const duringAlert = node.tick();
    expect(duringAlert.simulatedAlert).toBe(true);
    expect(duringAlert.temperatureC).toBeGreaterThan(baseline.temperatureC);
    expect(duringAlert.gasPpm).toBeGreaterThan(baseline.gasPpm);
  });

  it('ends the alert episode on its own after a bounded number of ticks and returns near baseline', () => {
    node.triggerAlertEpisode();

    let lastReading = node.tick();
    let ticks = 1;
    while (node.isInAlertEpisode && ticks < 50) {
      lastReading = node.tick();
      ticks += 1;
    }

    expect(node.isInAlertEpisode).toBe(false);
    expect(ticks).toBeLessThan(50); // sanity bound: the episode must actually terminate
    // Once the episode has fully decayed, gas readings should be back near the low baseline.
    expect(lastReading.gasPpm).toBeLessThan(50);
  });

  it('can trigger a new alert episode again after a previous one completes', () => {
    node.triggerAlertEpisode();
    let ticks = 0;
    while (node.isInAlertEpisode && ticks < 50) {
      node.tick();
      ticks += 1;
    }
    expect(node.isInAlertEpisode).toBe(false);

    node.triggerAlertEpisode();
    expect(node.isInAlertEpisode).toBe(true);
  });
});

describe('VirtualNode.toMeta', () => {
  it('exposes stable metadata matching construction options', () => {
    const node = makeNode();
    const meta = node.toMeta();
    expect(meta).toMatchObject({ nodeId: 'node-01', name: 'Test Node', lat: 49.98, lng: -119.4 });
    expect(typeof meta.installedAt).toBe('string');
  });
});
