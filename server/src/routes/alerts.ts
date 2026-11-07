import { Router } from 'express';
import type { DashboardDatabase } from '../db/database.js';

export function createAlertsRouter(db: DashboardDatabase): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const { nodeId } = req.query;
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : undefined;

    if (limitRaw !== undefined && (limit === undefined || !Number.isFinite(limit) || limit <= 0)) {
      res.status(400).json({ error: 'limit must be a positive integer' });
      return;
    }

    res.json(
      db.getAlerts({
        nodeId: typeof nodeId === 'string' ? nodeId : undefined,
        limit,
      }),
    );
  });

  return router;
}
