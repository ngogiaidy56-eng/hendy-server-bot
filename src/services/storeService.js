/**
 * Store & Administrative Service (Cloudflare D1 & R2 Powered)
 * Manages Product catalog packaging/publishing, Order queues, Deposit approvals,
 * Cryptographic gift codes, and Support staff timeline lookups.
 */

import crypto from 'node:crypto';
import { userService } from './userService.js';
import { appDataService } from './appDataService.js';

// In-Memory Cloudflare D1 Simulated Tables
const productsStore = new Map();
const ordersStore = new Map();
const depositsStore = new Map();
const giftCodesStore = new Map();
const redemptionsStore = [];
const supportNotesStore = new Map();

// Cloudflare R2 Simulated Bucket Storage (key => metadata/data)
const r2Bucket = new Map();

// Helper: Generate formatted gift code: HNDY-XXXX-XXXX-XXXX
export function formatGiftCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const genPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `HNDY-${genPart(4)}-${genPart(4)}-${genPart(4)}`;
}

// Seed Initial Digital Store Catalog (Play Store / App Store style)
const INITIAL_PRODUCTS = [
  {
    id: 'prod_gemini_bot_pro',
    slug: 'hendy-ai-bot-vip-pass',
    title: 'Hendy Bot VIP Ultra License',
    category: 'apps',
    shortDescription: 'Unlocks unlimited Gemini 3.8 Flash queries, priority webhook bandwidth, and custom Telegram bot commands.',
    fullDescription: 'The ultimate upgrade for Telegram community administrators and creators. Includes auto-moderation AI, sentiment analysis, multi-channel broadcast tools, and zero-latency webhook routing.',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    rating: 4.9,
    reviewsCount: 342,
    priceHndy: 3500,
    priceUsd: 9.99,
    downloadSize: '18.4 MB',
    developer: 'Hendy Studios',
    version: 'v2.4.0',
    status: 'published',
    packageR2Key: 'packages/hendy-ai-vip-v2.4.0.zip',
    features: ['Unlimited Gemini 3.8 Flash calls', 'Telegram Channel Auto-Poster', 'Priority 24/7 Support'],
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'prod_ton_miner_booster',
    slug: 'ton-miner-energy-supercharge',
    title: 'TON Miner 10X Supercharge',
    category: 'gaming',
    shortDescription: 'Multiplies tapping power by 10x and permanently expands mining energy capacity by +5,000 units.',
    fullDescription: 'Boost your Telegram Mini App mining efficiency! Get +10 coins per tap, automated offline turbo-harvester, and exclusive golden tap particle cosmetics.',
    iconUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=200&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=80',
    rating: 4.8,
    reviewsCount: 890,
    priceHndy: 2000,
    priceUsd: 4.99,
    downloadSize: '8.2 MB',
    developer: 'Telegram Labs',
    version: 'v1.1.2',
    status: 'published',
    packageR2Key: 'packages/ton-miner-booster.zip',
    features: ['10x Mining Yield', '+5,000 Max Energy', 'Auto-miner 12h Offline'],
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'prod_crypto_signals_pass',
    slug: 'crypto-whale-signals-pro',
    title: 'Crypto Whale Signals & Radar',
    category: 'subscriptions',
    shortDescription: 'Real-time Telegram notifications for TON, BTC, and Solana large wallet transactions and breakout setups.',
    fullDescription: 'Professional on-chain analytics streamed straight to your Telegram inbox. Powered by high-speed WebSocket monitors and Gemini-summarized market sentiment reports.',
    iconUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=200&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800&auto=format&fit=crop&q=80',
    rating: 4.7,
    reviewsCount: 156,
    priceHndy: 5000,
    priceUsd: 14.99,
    downloadSize: '24.1 MB',
    developer: 'AlphaPulse Tech',
    version: 'v3.0.1',
    status: 'published',
    packageR2Key: 'packages/whale-signals-v3.0.1.zip',
    features: ['Instant Telegram Alerts', 'Whale Wallet Tracking', 'Weekly PDF Macro Report'],
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'prod_mini_app_template_kit',
    slug: 'react-telegram-mini-app-kit',
    title: 'Telegram Mini App Starter Kit',
    category: 'ai_tools',
    shortDescription: 'Production-ready React 19 + Tailwind + Vite template with Telegram SDK, Webhook router, and D1 database.',
    fullDescription: 'Launch your Telegram Mini App in under 15 minutes. Includes prebuilt wallet connectors, Telegram Theme sync, HMAC-SHA256 validator, and responsive mobile mockups.',
    iconUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
    rating: 5.0,
    reviewsCount: 78,
    priceHndy: 4500,
    priceUsd: 12.50,
    downloadSize: '42.5 MB',
    developer: 'Hendy OpenSource',
    version: 'v4.0.0',
    status: 'published',
    packageR2Key: 'packages/tma-starter-kit-v4.zip',
    features: ['React 19 & Tailwind CSS', 'Cloudflare D1 & R2 Ready', 'Express Backend Included'],
    createdAt: Date.now() - 86400000 * 1,
  },
];

INITIAL_PRODUCTS.forEach((p) => productsStore.set(p.id, p));

// Seed Initial Orders
const INITIAL_ORDERS = [
  {
    id: 'ORD-98214',
    userId: '777888999',
    productId: 'prod_gemini_bot_pro',
    productTitle: 'Hendy Bot VIP Ultra License',
    quantity: 1,
    totalHndy: 3500,
    currency: 'HNDY',
    status: 'completed',
    issuedCode: 'VIP-GEMINI-89A2-BC14',
    supportNotes: 'Instant fulfillment via automated bot license queue',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    fulfilledAt: new Date(Date.now() - 86350000).toISOString(),
  },
  {
    id: 'ORD-98215',
    userId: '777888999',
    productId: 'prod_ton_miner_booster',
    productTitle: 'TON Miner 10X Supercharge',
    quantity: 1,
    totalHndy: 2000,
    currency: 'HNDY',
    status: 'pending',
    issuedCode: null,
    supportNotes: 'Awaiting manual gift voucher verification',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    fulfilledAt: null,
  },
];

INITIAL_ORDERS.forEach((o) => ordersStore.set(o.id, o));

// Seed Initial Deposits
const INITIAL_DEPOSITS = [
  {
    id: 'DEP-4011',
    userId: '777888999',
    currency: 'TON',
    amount: 5.0,
    rateToHndy: 1000,
    creditedHndy: 5000,
    txHash: '0x3f7a9c8b2e1d4a6f8b0c2e4d6a8f0b2c4e6a8d0f',
    proofImageR2Key: 'proofs/dep-4011-receipt.png',
    status: 'approved',
    reviewerNotes: 'Verified on TON blockchain explorer',
    reviewedBy: 'Admin_Sarah',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    reviewedAt: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString(),
  },
  {
    id: 'DEP-4012',
    userId: '777888999',
    currency: 'USDT',
    amount: 15.0,
    rateToHndy: 500,
    creditedHndy: 7500,
    txHash: '0x88f2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
    proofImageR2Key: 'proofs/dep-4012-usdt.png',
    status: 'pending',
    reviewerNotes: 'Pending blockchain confirmation check',
    reviewedBy: null,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    reviewedAt: null,
  },
];

INITIAL_DEPOSITS.forEach((d) => depositsStore.set(d.id, d));

// Seed Gift Codes
const SEED_CODES = [
  {
    code: 'HNDY-WELCOME-2026-GIFT',
    hndyValue: 2500,
    bonusXp: 150,
    maxRedemptions: 100,
    redeemedCount: 14,
    status: 'active',
    expiresAt: new Date(Date.now() + 86400000 * 60).toISOString(),
    batchId: 'BATCH_COMMUNITY_LAUNCH',
  },
  {
    code: 'HNDY-VIP7-MINER-BONUS',
    hndyValue: 5000,
    bonusXp: 300,
    maxRedemptions: 1,
    redeemedCount: 0,
    status: 'active',
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    batchId: 'BATCH_INFLUENCER_REWARD',
  },
];

SEED_CODES.forEach((c) => {
  const hash = crypto.createHash('sha256').update(c.code).digest('hex');
  giftCodesStore.set(c.code, {
    ...c,
    codeHash: hash,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
  });
});

export const storeService = {
  // ==========================================
  // 1. PRODUCTS & CATALOG MANAGEMENT
  // ==========================================

  getAllProducts(category = null, search = null) {
    let list = Array.from(productsStore.values());
    if (category && category !== 'all') {
      list = list.filter((p) => p.category === category);
    }
    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.developer.toLowerCase().includes(q)
      );
    }
    return list;
  },

  getProductById(id) {
    return productsStore.get(id) || null;
  },

  createProduct(data) {
    const id = data.id || `prod_${Date.now()}`;
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newProduct = {
      id,
      slug,
      title: data.title,
      category: data.category || 'apps',
      shortDescription: data.shortDescription || '',
      fullDescription: data.fullDescription || '',
      iconUrl: data.iconUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
      bannerUrl: data.bannerUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      rating: parseFloat(data.rating) || 5.0,
      reviewsCount: parseInt(data.reviewsCount, 10) || 0,
      priceHndy: parseInt(data.priceHndy, 10) || 1000,
      priceUsd: parseFloat(data.priceUsd) || 0.0,
      downloadSize: data.downloadSize || '15 MB',
      developer: data.developer || 'Hendy Creator',
      version: data.version || '1.0.0',
      status: data.status || 'published',
      packageR2Key: data.packageR2Key || `packages/${slug}-${data.version || '1.0.0'}.zip`,
      features: Array.isArray(data.features) ? data.features : ['Digital License', 'Fast Delivery'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    productsStore.set(id, newProduct);
    return newProduct;
  },

  updateProduct(id, updates) {
    const existing = productsStore.get(id);
    if (!existing) {
      throw new Error(`Product ${id} not found`);
    }
    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    productsStore.set(id, updated);
    return updated;
  },

  deleteProduct(id) {
    if (!productsStore.has(id)) {
      throw new Error(`Product ${id} not found`);
    }
    productsStore.delete(id);
    return { success: true, deletedId: id };
  },

  // ==========================================
  // 2. ORDER QUEUE MANAGEMENT
  // ==========================================

  getAllOrders(statusFilter = null) {
    let list = Array.from(ordersStore.values());
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createOrder(userId, productId) {
    const user = userService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const product = productsStore.get(productId);
    if (!product) throw new Error('Product not found');

    if (user.coins < product.priceHndy) {
      throw new Error(`Insufficient $HNDY balance. Requires ${product.priceHndy} but you have ${user.coins}`);
    }

    // Deduct coins atomically
    user.coins -= product.priceHndy;
    user.xp += 50;

    const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    const issuedCode = `KEY-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const newOrder = {
      id: orderId,
      userId: String(userId),
      productId: product.id,
      productTitle: product.title,
      quantity: 1,
      totalHndy: product.priceHndy,
      currency: 'HNDY',
      status: 'completed', // Auto-fulfilled for digital products
      issuedCode,
      supportNotes: 'Automated digital license issuance',
      createdAt: new Date().toISOString(),
      fulfilledAt: new Date().toISOString(),
    };

    ordersStore.set(orderId, newOrder);
    return { order: newOrder, remainingCoins: user.coins };
  },

  updateOrderStatus(orderId, newStatus, supportNotes = null, issuedCode = null) {
    const order = ordersStore.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    order.status = newStatus;
    if (supportNotes) order.supportNotes = supportNotes;
    if (issuedCode) order.issuedCode = issuedCode;

    if (newStatus === 'completed' && !order.fulfilledAt) {
      order.fulfilledAt = new Date().toISOString();
      if (!order.issuedCode) {
        order.issuedCode = `KEY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      }
    }

    if (newStatus === 'refunded') {
      // Refund balance
      const user = userService.getUserById(order.userId);
      if (user) {
        user.coins += order.totalHndy;
      }
    }

    ordersStore.set(orderId, order);
    return order;
  },

  // ==========================================
  // 3. DEPOSIT QUEUE & APPROVALS
  // ==========================================

  getAllDeposits(statusFilter = null) {
    let list = Array.from(depositsStore.values());
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((d) => d.status === statusFilter);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  submitDeposit(userId, currency, amount, txHash = null) {
    const user = userService.getUserById(userId);
    if (!user) throw new Error('User not found');

    const rates = {
      TON: 1000, // 1 TON = 1,000 HNDY
      USDT: 500, // 1 USDT = 500 HNDY
      FIAT_VND: 0.1, // 10,000 VND = 1,000 HNDY
    };

    const rate = rates[currency] || 500;
    const creditedHndy = Math.floor(amount * rate);
    const depositId = `DEP-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDeposit = {
      id: depositId,
      userId: String(userId),
      currency,
      amount: parseFloat(amount),
      rateToHndy: rate,
      creditedHndy,
      txHash: txHash || `0x${crypto.randomBytes(20).toString('hex')}`,
      proofImageR2Key: `proofs/${depositId.toLowerCase()}-receipt.png`,
      status: 'pending',
      reviewerNotes: 'Submitted by user, waiting for admin approval',
      reviewedBy: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };

    depositsStore.set(depositId, newDeposit);
    return newDeposit;
  },

  reviewDeposit(depositId, action, reviewerName = 'Admin', notes = '') {
    const deposit = depositsStore.get(depositId);
    if (!deposit) throw new Error(`Deposit ${depositId} not found`);

    if (deposit.status !== 'pending') {
      throw new Error(`Deposit is already ${deposit.status}`);
    }

    if (action === 'approve') {
      deposit.status = 'approved';
      deposit.reviewedBy = reviewerName;
      deposit.reviewerNotes = notes || 'Deposit confirmed and credited to user balance';
      deposit.reviewedAt = new Date().toISOString();

      // Credit user's Hendy balance
      const user = userService.getUserById(deposit.userId);
      if (user) {
        user.coins += deposit.creditedHndy;
        user.xp += 100;
      }
    } else if (action === 'reject') {
      deposit.status = 'rejected';
      deposit.reviewedBy = reviewerName;
      deposit.reviewerNotes = notes || 'Deposit invalid or unconfirmed transaction';
      deposit.reviewedAt = new Date().toISOString();
    } else {
      throw new Error('Action must be either "approve" or "reject"');
    }

    depositsStore.set(depositId, deposit);
    return deposit;
  },

  // ==========================================
  // 4. SECURE CRYPTOGRAPHIC GIFT CODES
  // ==========================================

  getAllGiftCodes() {
    return Array.from(giftCodesStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  generateGiftCode(hndyValue = 1000, bonusXp = 100, maxRedemptions = 1, batchId = 'DEFAULT_BATCH') {
    const code = formatGiftCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const giftCodeRecord = {
      code,
      codeHash,
      batchId,
      hndyValue: parseInt(hndyValue, 10),
      bonusXp: parseInt(bonusXp, 10),
      maxRedemptions: parseInt(maxRedemptions, 10),
      redeemedCount: 0,
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      createdBy: 'admin_panel',
      createdAt: new Date().toISOString(),
    };

    giftCodesStore.set(code, giftCodeRecord);
    return giftCodeRecord;
  },

  generateBatchGiftCodes(count = 5, hndyValue = 1000, batchId = 'BATCH') {
    const results = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      results.push(this.generateGiftCode(hndyValue, 100, 1, batchId));
    }
    return results;
  },

  redeemGiftCode(codeStr, userId) {
    if (!codeStr || typeof codeStr !== 'string') {
      throw new Error('Gift code is required');
    }
    const cleanCode = codeStr.trim().toUpperCase();
    const record = giftCodesStore.get(cleanCode);

    if (!record) {
      throw new Error('Invalid or non-existent gift code');
    }

    if (record.status !== 'active') {
      throw new Error(`This gift code is ${record.status}`);
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      record.status = 'expired';
      throw new Error('This gift code has expired');
    }

    if (record.redeemedCount >= record.maxRedemptions) {
      record.status = 'redeemed';
      throw new Error('This gift code has reached its maximum redemption limit');
    }

    // Check if user already redeemed this code
    const alreadyRedeemed = redemptionsStore.some(
      (r) => r.code === cleanCode && String(r.userId) === String(userId)
    );
    if (alreadyRedeemed) {
      throw new Error('You have already redeemed this gift code');
    }

    const user = userService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Increment redemptions & credit user
    record.redeemedCount += 1;
    if (record.redeemedCount >= record.maxRedemptions) {
      record.status = 'redeemed';
    }

    user.coins += record.hndyValue;
    user.xp += record.bonusXp;

    const redemptionRecord = {
      id: `RED-${Date.now()}`,
      code: cleanCode,
      userId: String(userId),
      creditedHndy: record.hndyValue,
      redeemedAt: new Date().toISOString(),
    };
    redemptionsStore.push(redemptionRecord);

    return {
      success: true,
      creditedHndy: record.hndyValue,
      newBalance: user.coins,
      bonusXp: record.bonusXp,
      code: cleanCode,
    };
  },

  // ==========================================
  // 5. CUSTOMER SUPPORT "MINI APP" TIMELINE
  // ==========================================

  getCustomerTimeline(userId) {
    const user = userService.getUserById(userId);
    if (!user) throw new Error(`Customer with ID ${userId} not found`);

    const userOrders = Array.from(ordersStore.values()).filter(
      (o) => String(o.userId) === String(userId)
    );
    const userDeposits = Array.from(depositsStore.values()).filter(
      (d) => String(d.userId) === String(userId)
    );
    const userRedemptions = redemptionsStore.filter(
      (r) => String(r.userId) === String(userId)
    );

    // Merge into chronological timeline
    const timeline = [];

    userOrders.forEach((o) => {
      timeline.push({
        id: o.id,
        type: 'ORDER',
        title: `Purchased: ${o.productTitle}`,
        amount: `-${o.totalHndy} $HNDY`,
        status: o.status,
        date: o.createdAt,
        details: o,
      });
    });

    userDeposits.forEach((d) => {
      timeline.push({
        id: d.id,
        type: 'DEPOSIT',
        title: `Deposit: ${d.amount} ${d.currency}`,
        amount: `+${d.creditedHndy} $HNDY`,
        status: d.status,
        date: d.createdAt,
        details: d,
      });
    });

    userRedemptions.forEach((r) => {
      timeline.push({
        id: r.id,
        type: 'REDEMPTION',
        title: `Redeemed Gift Code: ${r.code}`,
        amount: `+${r.creditedHndy} $HNDY`,
        status: 'completed',
        date: r.redeemedAt,
        details: r,
      });
    });

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      user,
      stats: {
        totalOrders: userOrders.length,
        totalDeposits: userDeposits.length,
        totalRedemptions: userRedemptions.length,
      },
      timeline,
      orders: userOrders,
      deposits: userDeposits,
    };
  },

  // ==========================================
  // 6. CLOUDFLARE R2 & PACKAGING SIMULATOR
  // ==========================================

  uploadPackageToR2(fileName, mimeType = 'application/zip', sizeBytes = 1048576) {
    const key = `packages/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const mockR2Object = {
      key,
      size: sizeBytes,
      etag: crypto.randomBytes(16).toString('hex'),
      httpMetadata: { contentType: mimeType },
      uploaded: new Date().toISOString(),
      publicUrl: `https://pub-r2.hendy-bot.dev/${key}`,
    };
    r2Bucket.set(key, mockR2Object);
    return mockR2Object;
  },

  getR2Objects() {
    return Array.from(r2Bucket.values());
  },
};
