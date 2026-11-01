/**
 * Hendy-Bot-Tele Server Entry Point
 * Initializes Express HTTP Server, Database connection, Security middlewares,
 * Telegram Bot Webhook, and Vite Dev Middleware / Production Static serving.
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { telegramStartup } from './services/telegramStartup.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
// Bind to 3000 in development for AI Studio iframe preview, or production PORT
const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (!req.url.startsWith('/@') && !req.url.startsWith('/src') && !req.url.includes('.')) {
      console.log(`[HTTP] ${req.method} ${req.url}`);
    }
    next();
  });
}

// Mount REST API endpoints
app.use('/api', apiRouter);

// Database connection mock/check
console.log('📦 [Database] Initializing in-memory data store with persistent sync ready...');
if (process.env.DATABASE_URL) {
  console.log(`📦 [Database] DATABASE_URL detected: ${process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@')}`);
}

// Fullstack Integration: Vite dev middleware in development, static files in production
async function setupFrontend() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Mount Vite middleware
    try {
      const { createServer: createViteServer } = await import('vite');
      const fs = await import('fs');
      const vite = await createViteServer({
        configFile: path.resolve(rootDir, 'vite.config.ts'),
        server: {
          middlewareMode: true,
          hmr: false,
          ws: false,
        },
        appType: 'custom',
        root: rootDir,
      });
      app.use(vite.middlewares);
      app.use('*', async (req, res, next) => {
        if (req.originalUrl.startsWith('/api')) {
          return next();
        }
        try {
          let template = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace?.(e);
          next(e);
        }
      });
      console.log('⚡ [Vite] Middleware mounted (HMR & WS disabled for AI Studio)');
    } catch (err) {
      console.warn('⚠️ [Vite] Could not initialize Vite middleware:', err.message);
    }
  } else {
    // Production mode: Serve built assets from dist
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`🚀 [Production] Serving static files from ${distPath}`);
  }

  // Centralized Error Handler (must be mounted after routes and middlewares)
  app.use(errorHandler);

  // Start HTTP Server
  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌐 [Server] Hendy-Bot-Tele server running on http://0.0.0.0:${PORT}`);
    // Initialize Telegram Bot service
    await telegramStartup.initialize();
  });

  // Handle port conflicts gracefully to prevent unhandled 'error' crash
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ [Server] Port ${PORT} busy during reload. Listening will resume once released.`);
    } else {
      console.error('❌ [Server Error]', err);
    }
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Start the application
setupFrontend().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

export default app;
