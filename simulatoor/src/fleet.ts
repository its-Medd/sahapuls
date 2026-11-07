import { VirtualNode } from './node.js';

/**
 * Fixed install points for the demo fleet, loosely modeled on a small forest
 * environmental-monitoring deployment (ridge, creek basin, lookout tower,
 * trailhead, valley camp, summit). Coordinates are fictional and centered in
 * a generic forested area - not tied to any real installation.
 */
const SITE_TEMPLATES = [
  {
    name: 'Ridge North',
    lat: 49.9812,
    lng: -119.4012,
    temperatureC: 18,
    humidityPct: 42,
    gasPpm: 8,
  },
  {
    name: 'Creek Basin',
    lat: 49.9701,
    lng: -119.421,
    temperatureC: 16,
    humidityPct: 55,
    gasPpm: 6,
  },
  {
    name: 'Lookout Tower',
    lat: 49.993,
    lng: -119.389,
    temperatureC: 19,
    humidityPct: 38,
    gasPpm: 9,
  },
  { name: 'Trailhead', lat: 49.9645, lng: -119.4321, temperatureC: 21, humidityPct: 45, gasPpm: 7 },
  {
    name: 'Valley Camp',
    lat: 49.9558,
    lng: -119.4487,
    temperatureC: 22,
    humidityPct: 48,
    gasPpm: 10,
  },
  {
    name: 'Summit East',
    lat: 50.0021,
    lng: -119.3745,
    temperatureC: 14,
    humidityPct: 33,
    gasPpm: 5,
  },
  {
    name: 'West Meadow',
    lat: 49.9877,
    lng: -119.4623,
    temperatureC: 20,
    humidityPct: 50,
    gasPpm: 8,
  },
  {
    name: 'South Gate',
    lat: 49.9433,
    lng: -119.4098,
    temperatureC: 23,
    humidityPct: 40,
    gasPpm: 11,
  },
] as const;

/** Build a fleet of `count` virtual nodes, cycling through site templates if count exceeds them. */
export function createFleet(count: number): VirtualNode[] {
  const nodeCount = Math.max(1, count);
  const nodes: VirtualNode[] = [];

  for (let i = 0; i < nodeCount; i += 1) {
    const template = SITE_TEMPLATES[i % SITE_TEMPLATES.length]!;
    const cycle = Math.floor(i / SITE_TEMPLATES.length);
    const nodeId = `node-${String(i + 1).padStart(2, '0')}`;
    const name = cycle === 0 ? template.name : `${template.name} ${cycle + 1}`;

    nodes.push(
      new VirtualNode({
        nodeId,
        name,
        // Spread repeated cycles out a bit so markers don't stack exactly on the map.
        lat: template.lat + cycle * 0.01,
        lng: template.lng + cycle * 0.01,
        baselineTemperatureC: template.temperatureC,
        baselineHumidityPct: template.humidityPct,
        baselineGasPpm: template.gasPpm,
      }),
    );
  }

  return nodes;
}
