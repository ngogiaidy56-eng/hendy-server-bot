/**
 * API Routes
 * Declares public and protected REST endpoints for Bot Webhook, Mini App state,
 * Telegram Auth verification, and Gemini AI operations.
 */

import { Router } from 'express';
import { handleWebhook, simulateBotCommand } from '../controllers/botController.js';
import { telegramStartup } from '../services/telegramStartup.js';
import { userService } from '../services/userService.js';
import { appDataService } from '../services/appDataService.js';
import { validateTelegramInitData, generateMockInitData, telegramAuthMiddleware } from '../security/telegramAuth.js';
import { cloudflareDataClient } from '../services/cloudflareDataClient.js';
import { constantTimeEqual } from '../security/webhookSecret.js';
import { discoverConfiguration } from '../services/configDiscovery.js';
import { getDefaultMenuConfig, sanitizeMenuConfig } from '../services/menuConfigService.js';
import { createAdminWsTicket, broadcastMenuConfig, broadcastConfigStatus } from '../services/configRealtime.js';
import { encrypt, decrypt } from '../security/cryptoService.js';
import { storeService } from '../services/storeService.js';
import { AppError } from '../middlewares/errorHandler.js';

const router = Router();

function requireMenuAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  const supplied = req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !constantTimeEqual(supplied, expected)) {
    return res.status(expected ? 401 : 503).json({
      success: false,
      error: {
        code: expected ? 'ADMIN_UNAUTHORIZED' : 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'Admin API credentials are required.',
      },
    });
  }
  return next();
}

// Public menu data is sanitized and contains no secret configuration.
router.get('/menu/config', async (_req, res, next) => {
  try {
    if (cloudflareDataClient.isConfigured()) {
      const config = await cloudflareDataClient.getMenuConfig();
      return res.json({ success: true, data: config });
    }
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        error: { code: 'MENU_STORE_UNAVAILABLE', message: 'Cloudflare D1 menu storage is not configured.' },
      });
    }
    return res.json({ success: true, data: getDefaultMenuConfig() });
  } catch (error) {
    return next(error);
  }
});

router.put('/menu/config', requireMenuAdmin, async (req, res, next) => {
  try {
    if (!cloudflareDataClient.isConfigured()) {
      throw new AppError('Cloudflare Data Worker is not configured.', 503, 'DATA_STORE_UNAVAILABLE');
    }
    const safeConfig = sanitizeMenuConfig(req.body);
    const saved = await cloudflareDataClient.updateMenuConfig(safeConfig);
    broadcastMenuConfig(saved);
    return res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof TypeError) {
      return next(new AppError(error.message, 400, 'INVALID_MENU_CONFIG'));
    }
    return next(error);
  }
});

router.get('/config/status', requireMenuAdmin, async (_req, res, next) => {
  try {
    const status = await discoverConfiguration();
    broadcastConfigStatus(status);
    return res.json({ success: true, data: status });
  } catch (error) {
    return next(error);
  }
});

router.post('/config/ws-ticket', requireMenuAdmin, (_req, res) => {
  return res.json({ success: true, data: createAdminWsTicket() });
});

const enforceMiniAppIdentity = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  telegramAuthMiddleware(req, res, (error) => {
    if (error) return next(error);
    if (String(req.telegramUser?.id) !== String(req.params.id)) {
      return next(new AppError('Telegram user does not match the requested account.', 403, 'USER_MISMATCH'));
    }
    return next();
  });
};
router.use('/user/:id', enforceMiniAppIdentity);
router.use('/miniapp/tasks/:id', enforceMiniAppIdentity);

router.use('/store', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' &&
      !(req.method === 'GET' && req.path.endsWith('/d1/stats'))) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'STORE_DATA_LAYER_NOT_PRODUCTION_READY',
        message: 'Legacy storefront routes use in-memory data and are disabled in production. Use the D1-backed bot runtime; migrate store tables before enabling commerce.',
      },
    });
  }
  return next();
});

const useCloudflareData = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !cloudflareDataClient.isConfigured()) {
    return next(new AppError('Cloudflare Data Worker is not configured.', 503, 'DATA_STORE_UNAVAILABLE'));
  }
  return next();
};

// System Health & Bot Status
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/bot/status', (req, res) => {
  res.json({
    success: true,
    data: telegramStartup.getStatus(),
  });
});

// Telegram Webhook Endpoint
router.post('/bot/webhook', handleWebhook);

// Dev & UI Bot Simulator
router.post('/bot/simulate', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  return simulateBotCommand(req, res, next);
});

// Telegram WebApp Authentication & InitData verification
router.post('/auth/validate-init-data', async (req, res, next) => {
  try {
    const { initData } = req.body || {};
    if (!initData) {
      throw new AppError('Field "initData" is required', 400, 'PARAM_MISSING');
    }

    const validation = validateTelegramInitData(initData);
    let userRecord = null;
    if (validation.isValid && validation.user) {
      if (cloudflareDataClient.isConfigured()) {
        userRecord = await cloudflareDataClient.upsertTelegramUser(validation.user);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError('Cloudflare Data Worker is not configured.', 503, 'DATA_STORE_UNAVAILABLE');
      } else {
        userRecord = userService.getOrCreateUser(validation.user);
      }
    }

    return res.json({
      success: validation.isValid,
      data: {
        validation,
        user: userRecord,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// Generate mock initData for developer testing
router.post('/auth/generate-mock-init-data', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  try {
    const { user, token } = req.body;
    const mockData = generateMockInitData(user, token);
    res.json({
      success: true,
      data: {
        initData: mockData,
      },
    });
  } catch (err) {
    next(err);
  }
});

// User profile & balance
router.get('/user/:id', useCloudflareData, async (req, res, next) => {
  if (!cloudflareDataClient.isConfigured()) return next('route');
  try {
    const user = await cloudflareDataClient.getUser(req.params.id);
    return res.json({ success: true, data: user });
  } catch (error) { return next(error); }
});

router.get('/user/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    let user = userService.getUserById(id);
    if (!user) {
      // In dev mode, auto-create a user if needed
      user = userService.getOrCreateUser({ id, first_name: `Explorer_${id}` });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// Tap to mine coins
router.post('/user/:id/tap', useCloudflareData, async (req, res, next) => {
  if (!cloudflareDataClient.isConfigured()) return next('route');
  try {
    const result = await cloudflareDataClient.tap(req.params.id, req.body?.taps ?? 1);
    return res.json({ success: true, data: result });
  } catch (error) { return next(error); }
});

router.post('/user/:id/tap', (req, res, next) => {
  try {
    const { id } = req.params;
    const { taps = 1 } = req.body;
    const result = userService.tap(id, taps);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Claim daily reward
router.post('/user/:id/daily', useCloudflareData, async (req, res, next) => {
  if (!cloudflareDataClient.isConfigured()) return next('route');
  try {
    const result = await cloudflareDataClient.claimDailyReward(req.params.id);
    if (!result.claimed) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_CLAIMED', message: 'Daily reward already claimed today.' },
        data: result,
      });
    }
    return res.json({ success: true, data: result });
  } catch (error) { return next(error); }
});

router.post('/user/:id/daily', (req, res, next) => {
  try {
    const { id } = req.params;
    const result = userService.claimDailyReward(id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Mini App tasks
router.get('/miniapp/tasks/:id', useCloudflareData, async (req, res, next) => {
  if (!cloudflareDataClient.isConfigured()) return next('route');
  try {
    const tasks = await cloudflareDataClient.getTasks(req.params.id);
    return res.json({ success: true, data: tasks });
  } catch (error) { return next(error); }
});

router.get('/miniapp/tasks/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const tasks = appDataService.getTasksForUser(id);
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

router.post('/miniapp/tasks/:id/complete', useCloudflareData, async (req, res, next) => {
  if (!cloudflareDataClient.isConfigured()) return next('route');
  try {
    const taskId = req.body?.taskId;
    if (!taskId) throw new AppError('taskId is required', 400, 'PARAM_MISSING');
    const result = await cloudflareDataClient.completeTask(req.params.id, taskId);
    return res.json({ success: true, data: result });
  } catch (error) { return next(error); }
});

router.post('/miniapp/tasks/:id/complete', (req, res, next) => {
  try {
    const { id } = req.params;
    const { taskId, reward = 1000 } = req.body;
    if (!taskId) {
      throw new AppError('taskId is required', 400, 'PARAM_MISSING');
    }
    const result = userService.completeTask(id, taskId, reward);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Mini App Leaderboard
router.get('/miniapp/leaderboard', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  return telegramAuthMiddleware(req, res, next);
}, useCloudflareData, async (req, res, next) => {
  if (!cloudflareDataClient.isConfigured()) return next('route');
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const leaderboard = await cloudflareDataClient.getLeaderboard(limit);
    return res.json({ success: true, data: leaderboard });
  } catch (error) { return next(error); }
});

router.get('/miniapp/leaderboard', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const leaderboard = appDataService.getLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
});

// Gemini AI Chat endpoint
router.post('/gemini/chat', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  return telegramAuthMiddleware(req, res, next);
}, async (req, res, next) => {
  try {
    const { prompt, user } = req.body;
    if (!prompt) {
      throw new AppError('prompt is required', 400, 'PARAM_MISSING');
    }
    const verifiedUser = req.telegramUser || user;
    const reply = await appDataService.generateHendyAiResponse(prompt, verifiedUser);
    res.json({
      success: true,
      data: {
        reply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Security demo endpoint (AES-256-GCM)
router.post('/security/encrypt', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  try {
    const { text, secret } = req.body;
    if (!text) {
      throw new AppError('text is required', 400, 'PARAM_MISSING');
    }
    const encrypted = encrypt(text, secret);
    res.json({ success: true, data: { encrypted } });
  } catch (err) {
    next(err);
  }
});

router.post('/security/decrypt', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  try {
    const { payload, secret } = req.body;
    if (!payload) {
      throw new AppError('payload is required', 400, 'PARAM_MISSING');
    }
    const decrypted = decrypt(payload, secret);
    res.json({ success: true, data: { decrypted } });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// CLOUDFLARE D1 & R2 STOREFRONT & ADMIN APIS
// ==========================================

// 1. Products & Catalog
router.get('/store/products', (req, res, next) => {
  try {
    const { category, search } = req.query;
    const products = storeService.getAllProducts(category, search);
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
});

router.get('/store/products/:id', (req, res, next) => {
  try {
    const product = storeService.getProductById(req.params.id);
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// Admin product publishing & packaging
router.post('/store/products', (req, res, next) => {
  try {
    const newProduct = storeService.createProduct(req.body);
    res.status(201).json({ success: true, data: newProduct });
  } catch (err) {
    next(err);
  }
});

router.put('/store/products/:id', (req, res, next) => {
  try {
    const updated = storeService.updateProduct(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/store/products/:id', (req, res, next) => {
  try {
    const result = storeService.deleteProduct(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// 2. Orders & Checkout
router.get('/store/orders', (req, res, next) => {
  try {
    const { status } = req.query;
    const orders = storeService.getAllOrders(status);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

router.post('/store/orders', (req, res, next) => {
  try {
    const { userId, productId } = req.body;
    if (!userId || !productId) {
      throw new AppError('userId and productId are required', 400, 'PARAM_MISSING');
    }
    const result = storeService.createOrder(userId, productId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.patch('/store/orders/:id/status', (req, res, next) => {
  try {
    const { status, notes, issuedCode } = req.body;
    if (!status) throw new AppError('status is required', 400, 'PARAM_MISSING');
    const order = storeService.updateOrderStatus(req.params.id, status, notes, issuedCode);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// 3. Deposit Queue & Approvals
router.get('/store/deposits', (req, res, next) => {
  try {
    const { status } = req.query;
    const deposits = storeService.getAllDeposits(status);
    res.json({ success: true, data: deposits });
  } catch (err) {
    next(err);
  }
});

router.post('/store/deposits', (req, res, next) => {
  try {
    const { userId, currency, amount, txHash } = req.body;
    if (!userId || !currency || !amount) {
      throw new AppError('userId, currency, and amount are required', 400, 'PARAM_MISSING');
    }
    const deposit = storeService.submitDeposit(userId, currency, amount, txHash);
    res.status(201).json({ success: true, data: deposit });
  } catch (err) {
    next(err);
  }
});

router.patch('/store/deposits/:id/review', (req, res, next) => {
  try {
    const { action, reviewer, notes } = req.body;
    if (!action) throw new AppError('action (approve/reject) is required', 400, 'PARAM_MISSING');
    const deposit = storeService.reviewDeposit(req.params.id, action, reviewer, notes);
    res.json({ success: true, data: deposit });
  } catch (err) {
    next(err);
  }
});

// 4. Secure Gift Codes
router.get('/store/gift-codes', (req, res, next) => {
  try {
    const codes = storeService.getAllGiftCodes();
    res.json({ success: true, data: codes });
  } catch (err) {
    next(err);
  }
});

router.post('/store/gift-codes/generate', (req, res, next) => {
  try {
    const { hndyValue, bonusXp, maxRedemptions, count = 1, batchId } = req.body;
    if (count > 1) {
      const batch = storeService.generateBatchGiftCodes(count, hndyValue, batchId);
      return res.status(201).json({ success: true, data: batch });
    }
    const code = storeService.generateGiftCode(hndyValue, bonusXp, maxRedemptions, batchId);
    res.status(201).json({ success: true, data: code });
  } catch (err) {
    next(err);
  }
});

router.post('/store/gift-codes/redeem', (req, res, next) => {
  try {
    const { code, userId } = req.body;
    if (!code || !userId) {
      throw new AppError('code and userId are required', 400, 'PARAM_MISSING');
    }
    const result = storeService.redeemGiftCode(code, userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// 5. Customer Support "Mini App" Timeline & Gemini AI Assistant
router.get('/store/support/user/:id', (req, res, next) => {
  try {
    const timeline = storeService.getCustomerTimeline(req.params.id);
    res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
});

router.post('/store/support/ai-resolution', async (req, res, next) => {
  try {
    const { customerId, issueDescription, orderId } = req.body;
    if (!customerId || !issueDescription) {
      throw new AppError('customerId and issueDescription are required', 400, 'PARAM_MISSING');
    }

    const timelineData = storeService.getCustomerTimeline(customerId);
    const relatedOrder = orderId ? timelineData.orders.find((o) => o.id === orderId) : timelineData.orders[0];

    const aiPrompt = `Support Staff AI Assistant:
Customer: ${timelineData.user.firstName} (@${timelineData.user.username})
Current Balance: ${timelineData.user.coins} $HNDY
Total Orders: ${timelineData.stats.totalOrders}
Related Order: ${relatedOrder ? JSON.stringify(relatedOrder) : 'None'}
Issue Reported: "${issueDescription}"

Task:
1. Provide a quick root-cause diagnosis.
2. Recommend immediate resolution steps for support staff (e.g., re-issue key, refund, bonus compensation).
3. Draft a courteous, empathetic reply in Vietnamese and English for the customer.`;

    const resolution = await appDataService.generateHendyAiResponse(aiPrompt, timelineData.user);
    res.json({ success: true, data: { resolution, customer: timelineData.user, relatedOrder } });
  } catch (err) {
    next(err);
  }
});

// 6. Cloudflare R2 Packaging & D1 Schema stats
router.post('/store/r2/package', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.status(501).json({ success: false, error: { code: 'R2_UPLOAD_REQUIRES_BINARY_PIPELINE', message: 'Use the authenticated Cloudflare Worker R2 upload endpoint.' } });
  try {
    const { fileName, sizeBytes } = req.body;
    const pkg = storeService.uploadPackageToR2(fileName || 'hendy-app-bundle.zip', 'application/zip', sizeBytes);
    res.status(201).json({ success: true, data: pkg });
  } catch (err) {
    next(err);
  }
});

router.get('/store/d1/stats', async (req, res, next) => {
  if (cloudflareDataClient.isConfigured()) {
    try {
      const data = await cloudflareDataClient.getStorageStats();
      return res.json({ success: true, data });
    } catch (error) { return next(error); }
  }
  if (process.env.NODE_ENV === 'production') {
    return next(new AppError('Cloudflare Data Worker is not configured.', 503, 'DATA_STORE_UNAVAILABLE'));
  }
  return next('route');
});

router.get('/store/d1/stats', (req, res, next) => {
  try {
    const products = storeService.getAllProducts();
    const orders = storeService.getAllOrders();
    const deposits = storeService.getAllDeposits();
    const giftCodes = storeService.getAllGiftCodes();
    const r2Objects = storeService.getR2Objects();

    res.json({
      success: true,
      data: {
        database: 'hendy_production_db',
        binding: 'DB',
        r2Bucket: 'hendy-store-assets',
        tables: {
          products: products.length,
          orders: orders.length,
          deposits: deposits.length,
          gift_codes: giftCodes.length,
          r2_packages: r2Objects.length,
        },
        cloudflareEnvironment: {
          runtime: 'Cloudflare Pages / Workers',
          d1Enabled: true,
          r2Enabled: true,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
