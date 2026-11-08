import { Router } from 'express';
import { z } from 'zod';
import type { DashboardDatabase } from '../db/database.js';
import type { RealtimeEmitter } from '../ingest.js';
import { nodeIdSchema } from '../mqtt/parse.js';
export function createAlertsRouter(db: DashboardDatabase, emitter?: RealtimeEmitter): Router {
  const router = Router();
  router.get('/', (req, res) => {
    const parsed = z
      .object({
        nodeId: nodeIdSchema.optional(),
        state: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
        limit: z
          .string()
          .regex(/^[1-9]\d*$/)
          .transform(Number)
          .pipe(z.number().max(5000))
          .optional(),
      })
      .strict()
      .safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid alert filters or limit (1–5000)' });
      return;
    }
    res.json(db.getAlerts(parsed.data));
  });
  router.get('/:id/history', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || !db.getAlert(id)) {
      res.status(404).json({ error: 'alert not found' });
      return;
    }
    res.json(db.getAlertEvents(id));
  });
  router.post('/:id/acknowledge', (req, res) => {
    const id = Number(req.params.id);
    const alert = Number.isSafeInteger(id) ? db.acknowledgeAlert(id) : undefined;
    if (!alert) {
      res.status(404).json({ error: 'alert not found' });
      return;
    }
    if (alert.state === 'RESOLVED') {
      res.status(409).json({ error: 'Resolved alerts cannot be acknowledged' });
      return;
    }
    emitter?.emitAlert(alert);
    res.json(alert);
  });
  return router;
}
