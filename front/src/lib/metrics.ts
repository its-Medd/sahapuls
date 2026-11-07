import type { MetricName } from '../types';

export const METRIC_CONFIG: Record<MetricName, { label: string; unit: string }> = {
  temperatureC: { label: 'Temperature', unit: 'C' },
  gasPpm: { label: 'Gas / smoke', unit: 'ppm' },
  batteryPct: { label: 'Battery', unit: '%' },
};

export const METRICS: MetricName[] = ['temperatureC', 'gasPpm', 'batteryPct'];
