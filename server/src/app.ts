import cors from 'cors';
import express, { type Express } from 'express';
import type { DashboardDatabase } from './db/database.js';
import { createAlertsRouter } from './routes/alerts.js';
import { createNodesRouter } from './routes/nodes.js';

/**
 * Builds the Express app in isolation from MQTT/Socket.IO/process wiring so
 * it can be exercised directly in tests with supertest against an in-memory
 * database and no network dependencies.
 */
export function createApp(db: DashboardDatabase, corsOrigin: string): Express {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/nodes', createNodesRouter(db));
  app.use('/api/alerts', createAlertsRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  return app;
}
