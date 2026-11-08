import type { ReadingRecord } from '../types.js';

export interface MetricStats {
  avg: number;
  min: number;
  max: number;
}

export interface AggregatedBucket {
  bucketStart: string;
  sampleCount: number;
  temperatureC: MetricStats;
  humidityPct: MetricStats;
  gasPpm: MetricStats;
  batteryPct: MetricStats;
  soilMoisturePct: MetricStats | null;
  waterLevelCm: MetricStats | null;
}

export const SENSOR_METRICS = [
  'temperatureC',
  'humidityPct',
  'gasPpm',
  'batteryPct',
  'soilMoisturePct',
  'waterLevelCm',
] as const;
export type SensorMetric = (typeof SENSOR_METRICS)[number];
/** Statistics over actual source samples, never an unweighted mean of bucket averages. */
export function summarizeReadings(
  readings: ReadingRecord[],
): Record<SensorMetric, (MetricStats & { count: number }) | null> {
  return Object.fromEntries(
    SENSOR_METRICS.map((metric) => {
      const values = readings
        .map((reading) => reading[metric])
        .filter((value): value is number => value != null && Number.isFinite(value));
      return [metric, values.length ? { ...statsFor(values), count: values.length } : null];
    }),
  ) as Record<SensorMetric, (MetricStats & { count: number }) | null>;
}

function statsFor(values: number[]): MetricStats {
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    avg: round2(sum / values.length),
    min: round2(Math.min(...values)),
    max: round2(Math.max(...values)),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Buckets a chronologically-ordered (or unordered) list of readings into
 * fixed-width time windows and computes avg/min/max per metric in each
 * bucket. Used by the historical readings REST endpoint to keep chart
 * payloads small when a caller requests a wide time range, without needing a
 * time-series database with built-in continuous aggregates.
 *
 * Buckets are emitted in ascending chronological order and are only created
 * for windows that actually contain at least one reading (no empty-bucket
 * padding).
 */
export function aggregateReadings(readings: ReadingRecord[], bucketMs: number): AggregatedBucket[] {
  if (!Number.isFinite(bucketMs) || !Number.isInteger(bucketMs) || bucketMs <= 0) {
    throw new Error('bucketMs must be a positive number');
  }
  if (readings.length === 0) return [];

  const buckets = new Map<number, ReadingRecord[]>();
  for (const reading of readings) {
    const readingTime = new Date(reading.ts).getTime();
    const bucketKey = Math.floor(readingTime / bucketMs) * bucketMs;
    const bucket = buckets.get(bucketKey);
    if (bucket) {
      bucket.push(reading);
    } else {
      buckets.set(bucketKey, [reading]);
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketKey, bucketReadings]) => ({
      bucketStart: new Date(bucketKey).toISOString(),
      sampleCount: bucketReadings.length,
      temperatureC: statsFor(bucketReadings.map((r) => r.temperatureC)),
      humidityPct: statsFor(bucketReadings.map((r) => r.humidityPct)),
      gasPpm: statsFor(bucketReadings.map((r) => r.gasPpm)),
      batteryPct: statsFor(bucketReadings.map((r) => r.batteryPct)),
      soilMoisturePct: nullableStats(bucketReadings.map((r) => r.soilMoisturePct)),
      waterLevelCm: nullableStats(bucketReadings.map((r) => r.waterLevelCm)),
    }));
}

function nullableStats(values: (number | null | undefined)[]): MetricStats | null {
  const measured = values.filter((v): v is number => v != null);
  return measured.length ? statsFor(measured) : null;
}
