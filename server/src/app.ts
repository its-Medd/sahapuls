import cors from 'cors';
import express, { type Express, type ErrorRequestHandler } from 'express';
import { DEFAULT_THRESHOLDS } from './alerts/thresholds.js';
import { ALERT_COOLDOWN_MS, HYSTERESIS, METRIC_RULES } from './alerts/lifecycle.js';
import type { DashboardDatabase } from './db/database.js';
import type { RealtimeEmitter } from './ingest.js';
import { createAlertsRouter } from './routes/alerts.js';
import { createNodesRouter } from './routes/nodes.js';
import type { SimulatorBridge } from './simulator.js';
import { inspectHealth, APP_VERSION } from './health.js';
import { isAllowedOrigin } from './origins.js';
export function createApp(
  db: DashboardDatabase,
  corsOrigin: string,
  services: {
    emitter?: RealtimeEmitter;
    simulator?: Pick<SimulatorBridge, 'getStatus' | 'command'>;
    mqttConnected?: () => boolean;
  } = {},
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin, corsOrigin)) }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isAllowedOrigin(origin, corsOrigin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    next();
  });
  app.get('/api/health', (_req, res) => {
    res.json(inspectHealth(db, services));
  });
  app.get('/api/health/live', (_req, res) => {
    res.json({ application: 'SahaPul', status: 'alive', version: APP_VERSION });
  });
  app.get('/api/health/ready', (_req, res) => {
    const health = inspectHealth(db, services);
    res.status(health.ready ? 200 : 503).json(health);
  });
  app.get('/api/summary', (_req, res) => {
    res.json(db.getSummary());
  });
  app.get('/api/settings', (_req, res) => {
    res.json({
      thresholds: DEFAULT_THRESHOLDS,
      rules: METRIC_RULES,
      hysteresis: HYSTERESIS,
      alertCooldownMs: ALERT_COOLDOWN_MS,
      staleAfterMs: 30_000,
      offlineAfterMs: 120_000,
    });
  });
  app.get('/api/simulator', (_req, res) => {
    res.json(services.simulator?.getStatus() ?? { available: false });
  });
  app.post('/api/simulator', async (req, res, next) => {
    try {
      if (!services.simulator) {
        res.status(503).json({ error: 'Simulator controls unavailable' });
        return;
      }
      res.json(await services.simulator.command(req.body));
    } catch (error) {
      next(error);
    }
  });
  app.use('/api/nodes', createNodesRouter(db, services.emitter));
  app.use('/api/alerts', createAlertsRouter(db, services.emitter));
  app.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status =
      error instanceof SyntaxError ? 400 : ((error as { status?: number }).status ?? 500);
    res.status(status).json({
      error:
        status < 500 && error instanceof Error
          ? error.message
          : 'Request failed; retry or check server logs.',
    });
    if (status === 500) console.error('[http]', error);
  };
  app.use(errorHandler);
  return app;
}
