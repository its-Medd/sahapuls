import { randomUUID } from 'node:crypto';
import type { MqttClient } from 'mqtt';
import { z } from 'zod';

export const scenarios = [
  'random',
  'normal',
  'high-temperature',
  'dry-soil',
  'declining-water',
  'high-gas',
  'low-battery',
  'disconnection',
] as const;
const commandSchema = z
  .object({
    running: z.boolean(),
    scenario: z.enum(scenarios),
    intervalMs: z.number().int().min(250).max(60_000),
  })
  .strict();
const statusSchema = commandSchema.extend({
  updatedAt: z.string().datetime(),
  requestId: z.string().optional(),
});
type Status = z.infer<typeof statusSchema>;
export class SimulatorBridge {
  private status?: Status;
  private readonly pending = new Map<
    string,
    { resolve: (s: Status) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  constructor(
    private readonly client: MqttClient,
    private readonly prefix: string,
  ) {
    client.on('connect', () => {
      client.subscribe(`${prefix}/simulator/status`, { qos: 1 }, (error) => {
        if (error) console.error('[simulator] status subscription failed');
      });
    });
    client.on('message', (topic, payload) => {
      if (topic !== `${prefix}/simulator/status` || payload.length > 16384) return;
      try {
        const result = statusSchema.safeParse(JSON.parse(payload.toString()));
        if (!result.success) return;
        this.status = result.data;
        const request = result.data.requestId && this.pending.get(result.data.requestId);
        if (request) {
          clearTimeout(request.timer);
          this.pending.delete(result.data.requestId!);
          request.resolve(result.data);
        }
      } catch {
        /* Ignore untrusted status packets. */
      }
    });
  }
  getStatus(): Partial<Status> & { available: boolean } {
    const age = this.status ? Date.now() - Date.parse(this.status.updatedAt) : Infinity;
    return { ...this.status, available: this.client.connected && age >= -5000 && age < 30_000 };
  }
  async command(input: unknown): Promise<Status> {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success)
      throw Object.assign(
        new Error('Invalid simulator scenario, running state or interval (250–60000 ms)'),
        { status: 400 },
      );
    if (!this.getStatus().available)
      throw Object.assign(new Error('Simulator is offline. Start its process and retry.'), {
        status: 503,
      });
    const requestId = randomUUID();
    return new Promise<Status>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          Object.assign(
            new Error('Simulator did not confirm the command; refresh before retrying.'),
            { status: 504 },
          ),
        );
      }, 5000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.client.publish(
        `${this.prefix}/simulator/control`,
        JSON.stringify({ ...parsed.data, requestId }),
        { qos: 1, retain: false },
        (error) => {
          if (error) {
            clearTimeout(timer);
            this.pending.delete(requestId);
            reject(error);
          }
        },
      );
    });
  }
  close(): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Server shutting down'));
    }
    this.pending.clear();
  }
}
