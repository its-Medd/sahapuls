import { describe, expect, it } from 'vitest';
import { aggregateReadings } from '../src/alerts/aggregate.js';
import type { ReadingRecord } from '../src/types.js';

function reading(overrides: Partial<ReadingRecord>): ReadingRecord {
  return {
    id: 1,
    nodeId: 'node-01',
    ts: '2026-07-11T00:00:00.000Z',
    temperatureC: 20,
    humidityPct: 50,
    gasPpm: 10,
    batteryPct: 90,
    lat: 0,
    lng: 0,
    severity: 'normal',
    ...overrides,
  };
}

describe('aggregateReadings', () => {
  it('returns an empty array for no readings', () => {
    expect(aggregateReadings([], 60_000)).toEqual([]);
  });

  it('throws for a non-positive bucket size', () => {
    expect(() => aggregateReadings([reading({})], 0)).toThrow();
    expect(() => aggregateReadings([reading({})], -100)).toThrow();
  });

  it('groups readings within the same bucket window and computes avg/min/max', () => {
    const readings = [
      reading({ ts: '2026-07-11T00:00:01.000Z', temperatureC: 10 }),
      reading({ ts: '2026-07-11T00:00:20.000Z', temperatureC: 20 }),
      reading({ ts: '2026-07-11T00:00:40.000Z', temperatureC: 30 }),
    ];

    const buckets = aggregateReadings(readings, 60_000); // 1-minute buckets
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.sampleCount).toBe(3);
    expect(buckets[0]?.temperatureC).toEqual({ avg: 20, min: 10, max: 30 });
  });

  it('splits readings into separate buckets when they cross a boundary', () => {
    const readings = [
      reading({ ts: '2026-07-11T00:00:10.000Z', temperatureC: 10 }),
      reading({ ts: '2026-07-11T00:01:10.000Z', temperatureC: 50 }),
    ];

    const buckets = aggregateReadings(readings, 60_000);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.temperatureC.avg).toBe(10);
    expect(buckets[1]?.temperatureC.avg).toBe(50);
  });

  it('returns buckets in ascending chronological order regardless of input order', () => {
    const readings = [
      reading({ ts: '2026-07-11T00:05:00.000Z' }),
      reading({ ts: '2026-07-11T00:01:00.000Z' }),
      reading({ ts: '2026-07-11T00:03:00.000Z' }),
    ];

    const buckets = aggregateReadings(readings, 60_000);
    const starts = buckets.map((b) => b.bucketStart);
    const sorted = [...starts].sort();
    expect(starts).toEqual(sorted);
  });

  it('does not pad in empty buckets between sparse readings', () => {
    const readings = [
      reading({ ts: '2026-07-11T00:00:00.000Z' }),
      reading({ ts: '2026-07-11T01:00:00.000Z' }),
    ];

    const buckets = aggregateReadings(readings, 60_000);
    expect(buckets).toHaveLength(2);
  });

  it('rounds averages to two decimal places', () => {
    const readings = [
      reading({ ts: '2026-07-11T00:00:00.000Z', humidityPct: 10 }),
      reading({ ts: '2026-07-11T00:00:01.000Z', humidityPct: 11 }),
      reading({ ts: '2026-07-11T00:00:02.000Z', humidityPct: 11 }),
    ];

    const buckets = aggregateReadings(readings, 60_000);
    expect(buckets[0]?.humidityPct.avg).toBeCloseTo(10.67, 2);
  });
});
