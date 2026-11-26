import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, evaluateThresholds } from '../src/alerts/thresholds.js';

const baseReading = { temperatureC: 20, gasPpm: 10, batteryPct: 80 };

describe('evaluateThresholds', () => {
  it('returns normal severity with no breaches for a calm reading', () => {
    const result = evaluateThresholds(baseReading);
    expect(result.severity).toBe('normal');
    expect(result.breaches).toHaveLength(0);
  });

  it('flags a temperature warning just at the warning threshold', () => {
    const result = evaluateThresholds({
      ...baseReading,
      temperatureC: DEFAULT_THRESHOLDS.temperatureWarningC,
    });
    expect(result.severity).toBe('warning');
    expect(result.breaches).toEqual([
      expect.objectContaining({ metric: 'temperatureC', severity: 'warning' }),
    ]);
  });

  it('does not flag a temperature just below the warning threshold', () => {
    const result = evaluateThresholds({
      ...baseReading,
      temperatureC: DEFAULT_THRESHOLDS.temperatureWarningC - 0.01,
    });
    expect(result.severity).toBe('normal');
  });

  it('flags a temperature alert at or above the alert threshold', () => {
    const result = evaluateThresholds({
      ...baseReading,
      temperatureC: DEFAULT_THRESHOLDS.temperatureAlertC,
    });
    expect(result.severity).toBe('alert');
    expect(result.breaches[0]).toMatchObject({ metric: 'temperatureC', severity: 'alert' });
  });

  it('flags a gas ppm alert', () => {
    const result = evaluateThresholds({
      ...baseReading,
      gasPpm: DEFAULT_THRESHOLDS.gasAlertPpm + 50,
    });
    expect(result.severity).toBe('alert');
    expect(result.breaches[0]).toMatchObject({ metric: 'gasPpm', severity: 'alert' });
  });

  it('flags low battery as a breach even though the value is small', () => {
    const result = evaluateThresholds({
      ...baseReading,
      batteryPct: DEFAULT_THRESHOLDS.batteryAlertPct - 1,
    });
    expect(result.severity).toBe('alert');
    expect(result.breaches[0]).toMatchObject({ metric: 'batteryPct', severity: 'alert' });
  });

  it('does not flag battery when it is well above the warning threshold', () => {
    const result = evaluateThresholds({ ...baseReading, batteryPct: 95 });
    expect(result.severity).toBe('normal');
  });

  it('escalates overall severity to the highest breach across multiple metrics', () => {
    const result = evaluateThresholds({
      temperatureC: DEFAULT_THRESHOLDS.temperatureWarningC + 1, // warning
      gasPpm: DEFAULT_THRESHOLDS.gasAlertPpm + 1, // alert
      batteryPct: 80, // fine
    });
    expect(result.severity).toBe('alert');
    expect(result.breaches).toHaveLength(2);
  });

  it('can report breaches on all three metrics simultaneously', () => {
    const result = evaluateThresholds({
      temperatureC: DEFAULT_THRESHOLDS.temperatureAlertC + 5,
      gasPpm: DEFAULT_THRESHOLDS.gasAlertPpm + 5,
      batteryPct: DEFAULT_THRESHOLDS.batteryAlertPct - 5,
    });
    expect(result.severity).toBe('alert');
    expect(result.breaches.map((b) => b.metric).sort()).toEqual([
      'batteryPct',
      'gasPpm',
      'temperatureC',
    ]);
  });

  it('respects custom thresholds passed in explicitly', () => {
    const customThresholds = {
      ...DEFAULT_THRESHOLDS,
      temperatureWarningC: 25,
      temperatureAlertC: 30,
    };
    const result = evaluateThresholds({ ...baseReading, temperatureC: 26 }, customThresholds);
    expect(result.severity).toBe('warning');
  });
});
