import type { MetricName } from '../types';
export const METRIC_CONFIG: Record<MetricName, { label: string; unit: string }> = {
  temperatureC: { label: 'Temperature', unit: '°C' },
  humidityPct: { label: 'Humidity', unit: '%' },
  gasPpm: { label: 'Gas concentration', unit: 'ppm' },
  batteryPct: { label: 'Battery', unit: '%' },
  soilMoisturePct: { label: 'Soil moisture', unit: '%' },
  waterLevelCm: { label: 'Water level', unit: 'cm' },
};
export const METRICS: MetricName[] = [
  'temperatureC',
  'humidityPct',
  'gasPpm',
  'batteryPct',
  'soilMoisturePct',
  'waterLevelCm',
];
