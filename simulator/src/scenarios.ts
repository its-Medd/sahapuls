import type { TelemetryReading } from './types.js';
export const SCENARIOS = [
  'random',
  'normal',
  'high-temperature',
  'dry-soil',
  'declining-water',
  'high-gas',
  'low-battery',
  'disconnection',
] as const;
export type Scenario = (typeof SCENARIOS)[number];
/** A repeatable progression based only on sequence + device index. Never generates historical data. */
export function scenarioReading(
  input: TelemetryReading,
  scenario: Scenario,
  index: number,
): TelemetryReading | null {
  if (scenario === 'disconnection' && index === 0) return null;
  if (scenario === 'random') return input;
  const wave = Math.sin((input.seq + index * 7) / 12);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    ...input,
    temperatureC: round(
      scenario === 'high-temperature' ? Math.min(55, 30 + input.seq * 2) : 22 + wave,
    ),
    humidityPct: round(52 + wave * 3),
    gasPpm: round(scenario === 'high-gas' ? Math.min(650, 50 + input.seq * 40) : 10 + wave * 2),
    batteryPct: round(scenario === 'low-battery' ? Math.max(5, 25 - input.seq * 2) : 92),
    soilMoisturePct: round(
      scenario === 'dry-soil' ? Math.max(8, 35 - input.seq * 2) : 55 + wave * 2,
    ),
    waterLevelCm: round(
      scenario === 'declining-water' ? Math.max(3, 40 - input.seq * 2) : 65 + wave,
    ),
    lat: round(input.lat * 10000) / 10000,
    lng: round(input.lng * 10000) / 10000,
    simulatedAlert: !['normal', 'disconnection'].includes(scenario),
  };
}
