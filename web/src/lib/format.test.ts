import { describe, expect, it } from 'vitest';
import { formatClockTime, timeAgo } from './format';

describe('timeAgo', () => {
  const now = new Date('2026-07-11T12:00:00.000Z').getTime();

  it('returns "never" for null', () => {
    expect(timeAgo(null, now)).toBe('never');
  });

  it('returns "just now" for timestamps within the last few seconds', () => {
    expect(timeAgo(new Date(now - 2000).toISOString(), now)).toBe('just now');
  });

  it('returns seconds for sub-minute durations', () => {
    expect(timeAgo(new Date(now - 30_000).toISOString(), now)).toBe('30s ago');
  });

  it('returns minutes for sub-hour durations', () => {
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m ago');
  });

  it('returns hours for longer durations', () => {
    expect(timeAgo(new Date(now - 3 * 60 * 60_000).toISOString(), now)).toBe('3h ago');
  });
});

describe('formatClockTime', () => {
  it('produces a non-empty time string for a valid ISO timestamp', () => {
    const result = formatClockTime('2026-07-11T12:34:56.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
