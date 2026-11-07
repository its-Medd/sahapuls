import { Router } from 'express';
import { aggregateReadings } from '../alerts/aggregate.js';
import type { DashboardDatabase } from '../db/database.js';

export function createNodesRouter(db: DashboardDatabase): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.getNodes());
  });

  router.get('/:nodeId', (req, res) => {
    const node = db.getNode(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: `node ${req.params.nodeId} not found` });
      return;
    }
    res.json(node);
  });

  router.get('/:nodeId/readings', (req, res) => {
    const node = db.getNode(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: `node ${req.params.nodeId} not found` });
      return;
    }

    const { from, to } = req.query;
    const limitRaw = req.query.limit;
    const bucketMsRaw = req.query.bucketMs;

    const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : undefined;
    if (limitRaw !== undefined && (limit === undefined || !Number.isFinite(limit) || limit <= 0)) {
      res.status(400).json({ error: 'limit must be a positive integer' });
      return;
    }

    const readings = db.getReadings(req.params.nodeId, {
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      limit,
    });

    if (typeof bucketMsRaw === 'string') {
      const bucketMs = Number.parseInt(bucketMsRaw, 10);
      if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
        res.status(400).json({ error: 'bucketMs must be a positive integer' });
        return;
      }
      res.json(aggregateReadings(readings, bucketMs));
      return;
    }

    res.json(readings);
  });

  return router;
}
