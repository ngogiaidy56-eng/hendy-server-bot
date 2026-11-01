/**
 * Hendy Telegram Bot — Render Web Service entry point.
 * Telegram webhooks arrive here. Durable bot state is delegated to the
 * authenticated Cloudflare Data Worker (D1/R2); Pages hosts the Mini App.
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from './routes/api.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { telegramStartup } from './services/telegramStartup.js';
import { constantTimeEqual } from './security/webhookSecret.js';
import { attachConfigRealtime } from './services/configRealtime.js';
import { discoverConfiguration } from './services/configDiscovery.js';
import { getDefaultMenuConfig } from './services/menuConfigService.js';
import { cloudflareDataClient } from './services/cloudflareDataClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Restrict cross-origin browser calls to configured frontends.
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && (allowedOrigins.has(origin) || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Liveness: fast, dependency-independent endpoint for Render health checks.
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'hendy-server-bot',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: report missing configuration without exposing secret values.
app.get('/readyz', (_req, res) => {
  const required = process.env.NODE_ENV === 'production'
    ? [
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_WEBHOOK_SECRET',
        'CLOUDFLARE_DATA_API_URL',
        'CLOUDFLARE_DATA_API_TOKEN',
        'ADMIN_API_TOKEN',
      ]
    : [];
  const missing = required.filter((key) => !process.env[key]);
  const telegram = telegramStartup.getStatus();
  const ready = missing.length === 0 &&
    (process.env.NODE_ENV !== 'production' || telegram.status === 'active');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'configuration_required',
    missing,
    telegram,
    timestamp: new Date().toISOString(),
  });
});

// Only the public catalogue is anonymous. Every other store endpoint is admin-only.
app.use('/api/store', (req, res, next) => {
  const publicCatalogueRead =
    req.method === 'GET' && /^\/products(?:\/[^/]+)?\/?$/.test(req.path);
  if (publicCatalogueRead) return next();

  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(503).json({
      success: false,
      error: { code: 'ADMIN_AUTH_NOT_CONFIGURED', message: 'Admin API is not configured.' },
    });
  }
  const supplied = req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!constantTimeEqual(supplied, expected)) {
    return res.status(401).json({
      success: false,
      error: { code: 'ADMIN_UNAUTHORIZED', message: 'Valid admin credentials are required.' },
    });
  }
  return next();
});

// UI simulator is development-only and is not exposed in production.
app.use('/api/bot/simulate', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }
  return next();
});

app.use('/api', apiRouter);

async function setupFrontend() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(rootDir, 'vite.config.ts'),
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'custom',
      root: rootDir,
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const fs = await import('node:fs');
        let html = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        return res.status(200).type('html').send(html);
      } catch (error) {
        vite.ssrFixStacktrace?.(error);
        return next(error);
      }
    });
    return;
  }

  const distPath = path.join(rootDir, 'dist');
  app.use(express.static(distPath, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(distPath, 'index.html'), (error) => error && next(error));
  });
}

async function start() {
  await setupFrontend();
  app.use(errorHandler);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('[server] Listening on 0.0.0.0:' + PORT);
    telegramStartup.initialize().then((result) => {
      if (!result.success) {
        console.error('[telegram] Startup is degraded:', result.error || 'configuration required');
      }
    }).catch((error) => {
      console.error('[telegram] Startup failed:', error.message);
    });
  });

  // WebSocket upgrade shares Render's single public PORT.
  // /ws/menu streams only sanitized UI data; /ws/config requires a one-use admin ticket.
  attachConfigRealtime(server, {
    loadMenuConfig: async () => {
      if (cloudflareDataClient.isConfigured()) return cloudflareDataClient.getMenuConfig();
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Cloudflare D1 menu storage is not configured.');
      }
      return getDefaultMenuConfig();
    },
    loadConfigStatus: () => discoverConfiguration(),
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log('[server] ' + signal + ' received; closing HTTP listener.');
    server.close((error) => {
      if (error) {
        console.error('[server] Shutdown error:', error.message);
        process.exitCode = 1;
      }
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

start().catch((error) => {
  console.error('[server] Fatal startup error:', error);
  process.exit(1);
});

export default app;
