import type { VirtualNode } from './node.js';
import { scenarioReading, type Scenario, SCENARIOS } from './scenarios.js';
import type { TelemetryReading } from './types.js';
export class SimulationRuntime {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private running = false;
  constructor(
    private readonly fleet: VirtualNode[],
    private readonly publish: (reading: TelemetryReading) => Promise<void>,
    private intervalMs = 4000,
    private scenario: Scenario = 'random',
  ) {
    this.validate(intervalMs, scenario);
  }
  get state(): { running: boolean; scenario: Scenario; intervalMs: number } {
    return { running: this.running, scenario: this.scenario, intervalMs: this.intervalMs };
  }
  private validate(interval: number, scenario: Scenario): void {
    if (
      !Number.isInteger(interval) ||
      interval < 250 ||
      interval > 60000 ||
      !SCENARIOS.includes(scenario)
    )
      throw new Error('Invalid simulator configuration');
  }
  configure(running: boolean, scenario: Scenario, intervalMs: number): void {
    this.validate(intervalMs, scenario);
    this.stop();
    this.scenario = scenario;
    this.intervalMs = intervalMs;
    if (running) this.start();
  }
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    void this.tick();
  }
  stop(): void {
    this.running = false;
    clearInterval(this.timer);
    this.timer = undefined;
  }
  async tick(): Promise<void> {
    if (!this.running || this.inFlight) return;
    this.inFlight = (async () => {
      await Promise.all(
        this.fleet.map(async (node, index) => {
          const reading = scenarioReading(node.tick(), this.scenario, index);
          if (reading) await this.publish(reading);
        }),
      );
    })().catch((error: unknown) => {
      console.error('[simulator] publish failed', error);
    });
    await this.inFlight;
    this.inFlight = undefined;
  }
  async close(): Promise<void> {
    this.stop();
    await this.inFlight;
  }
}
