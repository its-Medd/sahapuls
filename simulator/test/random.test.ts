import { describe, expect, it } from 'vitest';
import { clamp, gaussianNoise, pickRandom } from '../src/random.js';

describe('clamp', () => {
  it('returns the value unchanged when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to the maximum when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles min === max', () => {
    expect(clamp(3, 5, 5)).toBe(5);
  });
});

describe('gaussianNoise', () => {
  it('returns finite numbers', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(Number.isFinite(gaussianNoise(1))).toBe(true);
    }
  });

  it('scales roughly with the requested standard deviation over many samples', () => {
    const samples = Array.from({ length: 5000 }, () => gaussianNoise(2));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    // Statistical, not exact: mean should hover near 0 and stdDev near 2.
    expect(Math.abs(mean)).toBeLessThan(0.3);
    expect(stdDev).toBeGreaterThan(1.5);
    expect(stdDev).toBeLessThan(2.5);
  });

  it('returns 0 spread when stdDev is 0', () => {
    // Math.abs normalizes the -0 that `standardNormal * 0` can produce for a
    // negative sample - -0 === 0 under regular equality, just not under the
    // Object.is check `toBe` uses.
    expect(Math.abs(gaussianNoise(0))).toBe(0);
  });
});

describe('pickRandom', () => {
  it('always returns an element from the array', () => {
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i += 1) {
      expect(items).toContain(pickRandom(items));
    }
  });

  it('throws for an empty array', () => {
    expect(() => pickRandom([])).toThrow();
  });
});
