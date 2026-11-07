import { DEFAULT_THRESHOLDS, evaluateThresholds, type Thresholds } from './alerts/thresholds.js';
import type { DashboardDatabase } from './db/database.js';
import type { AlertRecord, ReadingRecord, Severity, TelemetryReading } from './types.js';

/**
 * Abstraction over "however we tell connected dashboard clients about new
 * data" so the ingest pipeline can be unit tested with a plain in-memory fake
 * instead of a real Socket.IO server.
 */
export interface RealtimeEmitter {
  emitReading(reading: ReadingRecord): void;
  emitAlert(alert: AlertRecord): void;
  emitNodeStatus(nodeId: string, status: Severity): void;
}

export const noopEmitter: RealtimeEmitter = {
  emitReading: () => undefined,
  emitAlert: () => undefined,
  emitNodeStatus: () => undefined,
};

export interface IngestResult {
  reading: ReadingRecord;
  severity: Severity;
  alerts: AlertRecord[];
}

/**
 * Core ingest pipeline shared by the live MQTT path and (indirectly) by
 * tests: validate happens upstream, this step evaluates alert thresholds,
 * persists the reading, persists any threshold breaches as alerts, and
 * notifies connected clients through the emitter. Kept free of any MQTT- or
 * Socket.IO-specific types so it can be exercised directly in tests.
 */
export function ingestTelemetry(
  db: DashboardDatabase,
  reading: TelemetryReading,
  emitter: RealtimeEmitter = noopEmitter,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): IngestResult {
  const evaluation = evaluateThresholds(reading, thresholds);
  const storedReading = db.insertReading(reading, evaluation.severity);
  emitter.emitReading(storedReading);
  emitter.emitNodeStatus(reading.nodeId, evaluation.severity);

  const alerts = evaluation.breaches.map((breach) =>
    db.insertAlert({
      nodeId: reading.nodeId,
      ts: reading.ts,
      severity: breach.severity,
      metric: breach.metric,
      value: breach.value,
      threshold: breach.threshold,
      message: breach.message,
    }),
  );
  for (const alert of alerts) {
    emitter.emitAlert(alert);
  }

  return { reading: storedReading, severity: evaluation.severity, alerts };
}
