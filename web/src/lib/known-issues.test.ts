import { describe, expect, it } from 'vitest';
import { timeAgo, formatClockTime } from './format';
// Characterization of documented, deliberately retained original UI defects.
// Replace with acceptance assertions when completing docs/open-bug-tasks.md.
describe('documented future formatting exercises', () => {
  it('reproduces BUG-01 early rounding', () => {
    const now = Date.parse('2026-07-11T12:00:00.000Z');
    expect(timeAgo(new Date(now - 59600).toISOString(), now)).toBe('1m ago');
  });
  it('reproduces BUG-02 invalid timestamp output', () => {
    expect(timeAgo('not-a-date', Date.parse('2026-07-11T12:00:00Z'))).toBe('NaNh ago');
  });
  it('reproduces BUG-03 indistinguishable tick labels on adjacent dates', () => {
    expect(formatClockTime('2026-07-10T12:00:00Z')).toBe(formatClockTime('2026-07-11T12:00:00Z'));
  });
});
