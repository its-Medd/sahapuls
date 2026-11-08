import type { NodeMeta, TelemetryReading } from './types.js';
import { clamp, gaussianNoise } from './random.js';

export interface VirtualNodeOptions {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  baselineTemperatureC: number;
  baselineHumidityPct: number;
  baselineGasPpm: number;
}

/** How many ticks an alert episode ramps up, holds, then decays over. */
const ALERT_RAMP_TICKS = 3;
const ALERT_HOLD_TICKS = 4;
const ALERT_DECAY_TICKS = 5;
const ALERT_TOTAL_TICKS = ALERT_RAMP_TICKS + ALERT_HOLD_TICKS + ALERT_DECAY_TICKS;

/** Peak deltas applied on top of baseline during the hottest part of an alert episode. */
const ALERT_PEAK_TEMPERATURE_DELTA_C = 35;
const ALERT_PEAK_GAS_PPM = 650;

/**
 * A single simulated LoRa sensor node. Owns its own slowly-drifting baseline
 * state and, optionally, a running "alert episode" (e.g. a nearby fire or
 * fault condition) that temporarily pushes temperature and gas readings up
 * before decaying back to normal - this is what exercises the backend's
 * alert-threshold logic end-to-end.
 */
export class VirtualNode {
  readonly nodeId: string;
  readonly name: string;
  readonly installedAt: string;

  private lat: number;
  private lng: number;
  private readonly homeLat: number;
  private readonly homeLng: number;

  private temperatureC: number;
  private humidityPct: number;
  private gasPpm: number;
  private batteryPct: number;

  private seq = 0;
  private alertTick: number | null = null;

  constructor(options: VirtualNodeOptions) {
    this.nodeId = options.nodeId;
    this.name = options.name;
    this.homeLat = options.lat;
    this.homeLng = options.lng;
    this.lat = options.lat;
    this.lng = options.lng;
    this.temperatureC = options.baselineTemperatureC;
    this.humidityPct = options.baselineHumidityPct;
    this.gasPpm = options.baselineGasPpm;
    this.batteryPct = 85 + Math.random() * 15;
    this.installedAt = new Date(
      Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 120,
    ).toISOString();
  }

  toMeta(): NodeMeta {
    return {
      nodeId: this.nodeId,
      name: this.name,
      lat: this.homeLat,
      lng: this.homeLng,
      installedAt: this.installedAt,
    };
  }

  get isInAlertEpisode(): boolean {
    return this.alertTick !== null;
  }

  /** Start (or restart) a simulated alert episode on this node. */
  triggerAlertEpisode(): void {
    this.alertTick = 0;
  }

  /** Advance the node's internal state by one tick and return the new reading. */
  tick(): TelemetryReading {
    this.seq += 1;

    // Slow random-walk drift plus noise keeps baselines from looking robotic.
    this.temperatureC = clamp(this.temperatureC + gaussianNoise(0.15), -20, 60);
    this.humidityPct = clamp(this.humidityPct + gaussianNoise(0.4), 0, 100);
    this.gasPpm = clamp(this.gasPpm + gaussianNoise(1.2), 0, 50);
    this.batteryPct = clamp(this.batteryPct - Math.abs(gaussianNoise(0.01)), 0, 100);

    // Tiny GPS jitter to simulate consumer-grade GPS drift around a fixed install point.
    this.lat = this.homeLat + gaussianNoise(0.00006);
    this.lng = this.homeLng + gaussianNoise(0.00006);

    const alertMultiplier = this.computeAlertMultiplier();
    const simulatedAlert = alertMultiplier > 0;

    const reading: TelemetryReading = {
      nodeId: this.nodeId,
      seq: this.seq,
      ts: new Date().toISOString(),
      temperatureC: Number(
        (this.temperatureC + alertMultiplier * ALERT_PEAK_TEMPERATURE_DELTA_C).toFixed(2),
      ),
      humidityPct: Number(this.humidityPct.toFixed(2)),
      gasPpm: Number((this.gasPpm + alertMultiplier * ALERT_PEAK_GAS_PPM).toFixed(2)),
      batteryPct: Number(this.batteryPct.toFixed(2)),
      soilMoisturePct: Number(clamp(55 + gaussianNoise(2), 0, 100).toFixed(2)),
      waterLevelCm: Number(clamp(65 + gaussianNoise(1), 0, 100).toFixed(2)),
      lat: Number(this.lat.toFixed(6)),
      lng: Number(this.lng.toFixed(6)),
      simulatedAlert,
    };

    this.advanceAlertEpisode();
    return reading;
  }

  /**
   * Returns a 0..1 multiplier describing how "deep" into an alert spike the
   * node currently is: ramps up linearly, holds at 1, then decays linearly
   * back to 0, tracing out a trapezoid over ALERT_TOTAL_TICKS ticks.
   */
  private computeAlertMultiplier(): number {
    if (this.alertTick === null) return 0;

    const t = this.alertTick;
    if (t < ALERT_RAMP_TICKS) {
      return (t + 1) / ALERT_RAMP_TICKS;
    }
    if (t < ALERT_RAMP_TICKS + ALERT_HOLD_TICKS) {
      return 1;
    }
    const decayIndex = t - ALERT_RAMP_TICKS - ALERT_HOLD_TICKS;
    return Math.max(0, 1 - (decayIndex + 1) / ALERT_DECAY_TICKS);
  }

  private advanceAlertEpisode(): void {
    if (this.alertTick === null) return;
    this.alertTick += 1;
    if (this.alertTick >= ALERT_TOTAL_TICKS) {
      this.alertTick = null;
    }
  }
}
