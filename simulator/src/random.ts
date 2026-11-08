/**
 * Small deterministic-friendly random helpers used to make simulated sensor
 * readings look like noisy real-world data instead of a clean sine wave.
 */

/** Standard normal sample via the Box-Muller transform. */
export function gaussianNoise(stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const standardNormal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return standardNormal * stdDev;
}

/** Clamp a value to a [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pick a random element from a non-empty array. */
export function pickRandom<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('pickRandom called with an empty array');
  }
  return item;
}
