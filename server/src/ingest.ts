import { DEFAULT_THRESHOLDS, evaluateThresholds, type Thresholds } from './alerts/thresholds.js';
import { transitionAlerts } from './alerts/lifecycle.js';
import type { DashboardDatabase } from './db/database.js';
import { telemetrySchema } from './mqtt/parse.js';
import type {
  AlertRecord,
  NodeRecord,
  ReadingRecord,
  Severity,
  TelemetryReading,
} from './types.js';

export interface RealtimeEmitter {
  emitReading(reading: ReadingRecord): void;
  emitAlert(alert: AlertRecord): void;
  emitNodeStatus(nodeId: string, status: Severity): void;
  emitNode?(node: NodeRecord): void;
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
  duplicate: boolean;
}

/** All writes commit before events. Out-of-order history never regresses current device/alert state. */
export function ingestTelemetry(
  db: DashboardDatabase,
  input: TelemetryReading,
  emitter: RealtimeEmitter = noopEmitter,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): IngestResult {
  const reading = telemetrySchema.parse(input);
  const result = db.transaction(() => {
    const duplicate = db.findReading(reading);
    if (duplicate)
      return { reading: duplicate, severity: duplicate.severity, alerts: [], duplicate: true };
    const node = db.getNode(reading.nodeId);
    if (!node)
      db.upsertNode({
        nodeId: reading.nodeId,
        name: reading.nodeId,
        lat: reading.lat,
        lng: reading.lng,
        installedAt: reading.ts,
      });
    const current = !node?.lastSeenAt || reading.ts >= node.lastSeenAt;
    const transition = current
      ? transitionAlerts(db, reading, thresholds)
      : { changes: [], severity: evaluateThresholds(reading, thresholds).severity };
    const stored = db.insertReading(reading, transition.severity);
    return {
      reading: stored,
      severity: transition.severity,
      alerts: transition.changes,
      duplicate: false,
    };
  });
  if (!result.duplicate) {
    emitter.emitReading(result.reading);
    emitter.emitNodeStatus(reading.nodeId, db.getNode(reading.nodeId)!.status);
    for (const alert of result.alerts) emitter.emitAlert(alert);
    emitter.emitNode?.(db.getNode(reading.nodeId)!);
  }
  return result;
}
