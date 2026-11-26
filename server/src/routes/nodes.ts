import { Router } from 'express';
import { z } from 'zod';
import { aggregateReadings, summarizeReadings } from '../alerts/aggregate.js';
import type { DashboardDatabase } from '../db/database.js';
import type { RealtimeEmitter } from '../ingest.js';
import { timestampSchema } from '../mqtt/parse.js';

const integer = (max: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(max));
const querySchema = z
  .object({
    from: timestampSchema.optional(),
    to: timestampSchema.optional(),
    limit: integer(5000).optional(),
    bucketMs: integer(2_592_000_000).optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, 'from must not exceed to');
export function createNodesRouter(db: DashboardDatabase, emitter?: RealtimeEmitter): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(db.getNodes());
  });
  router.get('/:nodeId', (req, res) => {
    const node = db.getNode(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'device not found' });
      return;
    }
    res.json(node);
  });
  router.patch('/:nodeId', (req, res) => {
    const body = z
      .object({ name: z.string().trim().min(1).max(100) })
      .strict()
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'name must contain 1–100 characters' });
      return;
    }
    const node = db.renameNode(req.params.nodeId, body.data.name);
    if (!node) {
      res.status(404).json({ error: 'device not found' });
      return;
    }
    emitter?.emitNode?.(node);
    res.json(node);
  });
  router.get('/:nodeId/readings', (req, res) => {
    if (!db.getNode(req.params.nodeId)) {
      res.status(404).json({ error: 'device not found' });
      return;
    }
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const query = parsed.data;
    const readings = db.getReadings(req.params.nodeId, {
      ...query,
      limit: query.bucketMs ? 50_001 : query.limit,
    });
    if (query.bucketMs && readings.length > 50_000) {
      res.status(422).json({ error: 'Range exceeds 50000 samples; choose a smaller date range.' });
      return;
    }
    res.json(query.bucketMs ? aggregateReadings(readings, query.bucketMs) : readings);
  });
  router.get('/:nodeId/analytics', (req, res) => {
    if (!db.getNode(req.params.nodeId)) {
      res.status(404).json({ error: 'device not found' });
      return;
    }
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success || parsed.data.limit !== undefined) {
      res.status(400).json({
        error: 'Use valid from/to timestamps and bucketMs; limit is not supported for analytics.',
      });
      return;
    }
    const query = parsed.data;
    const readings = db.getReadings(req.params.nodeId, {
      from: query.from,
      to: query.to,
      limit: 50_001,
    });
    if (readings.length > 50_000) {
      res.status(422).json({ error: 'Range exceeds 50000 samples; choose a smaller date range.' });
      return;
    }
    const bucketMs = query.bucketMs ?? 60_000;
    res.json({
      nodeId: req.params.nodeId,
      from: query.from ?? null,
      to: query.to ?? null,
      bucketMs,
      sampleCount: readings.length,
      statistics: summarizeReadings(readings),
      buckets: aggregateReadings(readings, bucketMs),
    });
  });
  return router;
}
