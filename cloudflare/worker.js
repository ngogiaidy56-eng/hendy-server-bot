const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function ok(data = {}) {
  return json({ success: true, data });
}
function fail(message, status = 400, code = 'BAD_REQUEST') {
  return json({ success: false, error: { code, message } }, status);
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function mapUser(row) {
  if (!row) return null;
  return {
    id: row.telegram_id, firstName: row.first_name, lastName: row.last_name || '',
    username: row.username || '', languageCode: row.language_code || 'en',
    coins: row.coins, level: row.level, xp: row.xp, energy: row.energy,
    maxEnergy: row.max_energy, tapPower: row.tap_power, streak: row.streak,
    lastDailyClaim: row.last_daily_claim_at, referredBy: row.referred_by,
    referralsCount: row.referrals_count, completedTasks: JSON.parse(row.completed_tasks || '[]'),
    createdAt: row.created_at, lastActiveAt: row.last_active_at
  };
}
async function selectUser(db, id) {
  return db.prepare('SELECT * FROM bot_users WHERE telegram_id = ?').bind(String(id)).first();
}

const TASKS = [
  { id: 'welcome_bonus', title: 'Claim Welcome Bonus', description: 'Welcome to Hendy Telegram Mini App!', reward: 1000, category: 'basic', icon: 'gift', url: '' },
  { id: 'telegram_channel', title: 'Join Official Hendy Channel', description: 'Get latest bot updates and community news', reward: 2000, category: 'social', icon: 'send', url: '' },
  { id: 'telegram_group', title: 'Join Hendy Community Chat', description: 'Discuss with the Hendy community', reward: 1500, category: 'social', icon: 'users', url: '' },
  { id: 'ask_gemini_ai', title: 'Ask Hendy AI a Question', description: 'Chat with the Hendy AI assistant', reward: 1200, category: 'ai', icon: 'sparkles', url: '' },
  { id: 'invite_3_friends', title: 'Invite 3 Friends', description: 'Invite friends to the Hendy community', reward: 5000, category: 'referral', icon: 'user-plus', url: '' }
];

const DEFAULT_MENU_CONFIG = {
  version: 1,
  theme: { background: "#0b5263", radius: "12px" },
  buttons: [
    { id: "minigame", label: "🚀 MINIGAME LIVE", variant: "orange", layout: "half", enabled: true, href: "", tab: "" },
    { id: "tool_rental", label: "🧰 THUÊ TOOL (NEW)", variant: "cyan", layout: "half", enabled: true, href: "", tab: "" },
    { id: "gift_packs", label: "🎁 MUA LÌ XÌ · CODE MÀN · CODE TELE", variant: "green", layout: "full", enabled: true, href: "", tab: "" },
    { id: "topup", label: "💳 NẠP TIỀN", variant: "orange", layout: "half", enabled: true, href: "", tab: "" },
    { id: "otp_proxy", label: "⚙ OTP & PROXY", variant: "cyan", layout: "half", enabled: true, href: "", tab: "" },
    { id: "vip_tools", label: "🏆 VIP KHO CÔNG CỤ ĐẶC QUYỀN", variant: "cyan", layout: "full", enabled: true, href: "", tab: "" },
    { id: "customer_center", label: "💎 TRUNG TÂM KHÁCH HÀNG", variant: "cyan", layout: "full", enabled: true, href: "", tab: "" },
    { id: "matchmaking", label: "🎉 HỆ THỐNG GHÉP ĐÔI ĐẤU", variant: "orange", layout: "full", enabled: true, href: "", tab: "" },
    { id: "referral", label: "👥 Giới thiệu REF", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "vip_center", label: "🏅 TRUNG TÂM VIP", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "chat_group", label: "👑 NHÓM CHAT", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "announcements", label: "📢 KÊNH THÔNG BÁO", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "giftcode", label: "🎁 NHẬP GIFTCODE", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "support", label: "🧑🏻 LIÊN HỆ CSKH", variant: "green", layout: "half", enabled: true, href: "", tab: "" }
  ]
};

const ALLOWED_MENU_VARIANTS = new Set(["orange", "cyan", "green"]);
const ALLOWED_MENU_TABS = new Set(["", "menu", "tap", "ai", "tasks", "leaderboard"]);

function sanitizeMenuConfig(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.buttons)) {
    throw new Error("Menu config must contain a buttons array.");
  }
  const submitted = new Map(input.buttons.map((item) => [String(item?.id || ""), item]));
  const buttons = DEFAULT_MENU_CONFIG.buttons.map((base) => {
    const candidate = submitted.get(base.id) || base;
    const label = String(candidate.label ?? base.label).trim();
    const variant = String(candidate.variant ?? base.variant);
    const layout = String(candidate.layout ?? base.layout);
    const href = String(candidate.href ?? base.href).trim();
    const tab = String(candidate.tab ?? base.tab);
    if (!label || label.length > 64) throw new Error("Menu labels must contain 1–64 characters.");
    if (!ALLOWED_MENU_VARIANTS.has(variant)) throw new Error("Unsupported menu button color.");
    if (!["half", "full"].includes(layout)) throw new Error("Unsupported menu button layout.");
    if (!ALLOWED_MENU_TABS.has(tab)) throw new Error("Unsupported menu tab target.");
    if (href) {
      let parsed;
      try { parsed = new URL(href); } catch { throw new Error("Invalid menu URL."); }
      if (!["https:", "tg:"].includes(parsed.protocol)) throw new Error("Menu URLs must use HTTPS or tg:.");
    }
    return { id: base.id, label, variant, layout, enabled: candidate.enabled !== false, href, tab };
  });
  return { version: 1, theme: DEFAULT_MENU_CONFIG.theme, buttons };
}

async function readMenuConfig(db) {
  const row = await db.prepare("SELECT config_json FROM app_settings WHERE setting_key = 'menu'")
    .first();
  if (!row?.config_json) return DEFAULT_MENU_CONFIG;
  try { return sanitizeMenuConfig(JSON.parse(row.config_json)); }
  catch { return DEFAULT_MENU_CONFIG; }
}

async function writeMenuConfig(db, input) {
  const config = sanitizeMenuConfig(input);
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO app_settings (setting_key, config_json, updated_at) VALUES ('menu', ?, ?) " +
    "ON CONFLICT(setting_key) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at"
  ).bind(JSON.stringify(config), now).run();
  return { ...config, updatedAt: now };
}

async function requireInternal(request, env) {
  const expected = env.HENDY_INTERNAL_API_TOKEN;
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return Boolean(expected && safeEqual(supplied, expected));
}

async function handleInternal(request, env, url) {
  if (!await requireInternal(request, env)) return fail('Unauthorized.', 401, 'UNAUTHORIZED');
  if (!env.DB || !env.ASSETS_BUCKET) return fail('D1 or R2 binding is missing.', 503, 'BINDING_MISSING');

  if (request.method === 'POST' && url.pathname === '/internal/telegram/updates/claim') {
    const body = await request.json().catch(() => ({}));
    const updateId = String(body.updateId || '');
    if (!/^\d{1,24}$/.test(updateId)) return fail('Valid updateId is required.');
    const now = new Date().toISOString();
    const inserted = await env.DB.prepare(
      "INSERT OR IGNORE INTO telegram_updates (update_id, status, received_at) VALUES (?, 'processing', ?)"
    ).bind(updateId, now).run();
    if (inserted.meta?.changes === 1) return ok({ duplicate: false });

    const previous = await env.DB.prepare(
      'SELECT status, received_at FROM telegram_updates WHERE update_id = ?'
    ).bind(updateId).first();
    if (previous?.status === 'processed') return ok({ duplicate: true });
    const age = previous?.received_at ? Date.now() - new Date(previous.received_at).getTime() : 0;
    if (previous?.status === 'processing' && age < 120000) return ok({ duplicate: false, inProgress: true });
    await env.DB.prepare(
      "UPDATE telegram_updates SET status = 'processing', received_at = ?, processed_at = NULL WHERE update_id = ?"
    ).bind(now, updateId).run();
    return ok({ duplicate: false });
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/updates/complete') {
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare("UPDATE telegram_updates SET status = 'processed', processed_at = ? WHERE update_id = ?")
      .bind(new Date().toISOString(), String(body.updateId || '')).run();
    return ok({ completed: true });
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/updates/fail') {
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare("UPDATE telegram_updates SET status = 'failed' WHERE update_id = ?")
      .bind(String(body.updateId || '')).run();
    return ok({ failed: true });
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/users/upsert') {
    const body = await request.json().catch(() => ({}));
    const user = body.user;
    if (!user?.id || !/^\d{1,20}$/.test(String(user.id))) return fail('Telegram user id is invalid.');
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO bot_users (telegram_id, first_name, last_name, username, language_code, coins, level, xp, energy, max_energy, tap_power, streak, completed_tasks, created_at, updated_at, last_active_at) ' +
      "VALUES (?, ?, ?, ?, ?, 1000, 1, 50, 1000, 1000, 2, 0, '[]', ?, ?, ?) " +
      'ON CONFLICT(telegram_id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, ' +
      'username = excluded.username, language_code = excluded.language_code, updated_at = excluded.updated_at, last_active_at = excluded.last_active_at'
    ).bind(
      String(user.id), String(user.first_name || 'Hendy Explorer').slice(0, 80),
      String(user.last_name || '').slice(0, 80), String(user.username || '').slice(0, 64),
      String(user.language_code || 'en').slice(0, 12), now, now, now
    ).run();
    const row = await selectUser(env.DB, user.id);
    return ok(mapUser(row));
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/users/get') {
    const body = await request.json().catch(() => ({}));
    const row = await selectUser(env.DB, body.userId);
    if (!row) return fail('User not found.', 404, 'NOT_FOUND');
    return ok(mapUser(row));
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/users/tap') {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || '');
    const row = await selectUser(env.DB, userId);
    if (!row) return fail('User not found.', 404, 'NOT_FOUND');
    const taps = Math.max(1, Math.min(100, Math.floor(Number(body.taps) || 1)));
    const nowMs = Date.now();
    const lastActiveAt = Date.parse(row.last_active_at || '') || nowMs;
    const recovered = Math.max(0, Math.floor((nowMs - lastActiveAt) / 1000) * 3);
    const energy = Math.min(row.max_energy, row.energy + recovered);
    const cost = taps * row.tap_power;
    if (energy < cost) return fail('Not enough energy to tap.', 409, 'ENERGY_EXHAUSTED');
    const earned = cost;
    const nextXp = row.xp + taps;
    const nextCoins = row.coins + earned;
    const nextEnergy = energy - cost;
    const now = new Date(nowMs).toISOString();
    const update = await env.DB.prepare(
      'UPDATE bot_users SET coins = ?, xp = ?, energy = ?, level = ?, last_active_at = ?, updated_at = ? ' +
      'WHERE telegram_id = ? AND coins = ? AND xp = ? AND energy = ? AND last_active_at = ?'
    ).bind(nextCoins, nextXp, nextEnergy, Math.floor(nextXp / 1000) + 1, now, now,
      userId, row.coins, row.xp, row.energy, row.last_active_at).run();
    if (update.meta?.changes !== 1) return fail('Concurrent update detected. Please retry.', 409, 'CONFLICT');
    return ok({ success: true, coins: nextCoins, energy: nextEnergy, earned, level: Math.floor(nextXp / 1000) + 1, xp: nextXp });
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/users/daily') {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || '');
    const row = await selectUser(env.DB, userId);
    if (!row) return fail('User not found.', 404, 'NOT_FOUND');
    const now = new Date();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const last = row.last_daily_claim_at;
    if (last && String(last).slice(0, 10) === today) {
      return ok({ claimed: false, coins: row.coins, streak: row.streak, reward: 0 });
    }
    const elapsedHours = last ? (now.getTime() - new Date(last).getTime()) / 3600000 : Number.POSITIVE_INFINITY;
    const streak = !last || elapsedHours > 48 ? 1 : row.streak + 1;
    const reward = 500 * Math.min(streak, 7);
    const xpGain = 50 * Math.min(streak, 7);
    const update = await env.DB.prepare(
      "UPDATE bot_users SET coins = coins + ?, xp = xp + ?, streak = ?, last_daily_claim_at = ?, updated_at = ? " +
      "WHERE telegram_id = ? AND COALESCE(last_daily_claim_at, '') = COALESCE(?, '')"
    ).bind(reward, xpGain, streak, nowIso, nowIso, userId, last || '').run();
    if (update.meta?.changes !== 1) {
      const fresh = await selectUser(env.DB, userId);
      return ok({ claimed: false, coins: fresh?.coins || row.coins, streak: fresh?.streak || row.streak, reward: 0 });
    }
    const fresh = await selectUser(env.DB, userId);
    return ok({ claimed: true, reward, streak, coins: fresh.coins, user: mapUser(fresh) });
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/tasks/list') {
    const body = await request.json().catch(() => ({}));
    const row = await selectUser(env.DB, body.userId);
    if (!row) return fail('User not found.', 404, 'NOT_FOUND');
    const completed = new Set(JSON.parse(row.completed_tasks || '[]'));
    return ok(TASKS.map((task) => ({ ...task, isCompleted: completed.has(task.id) })));
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/tasks/complete') {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || '');
    const taskId = String(body.taskId || '');
    const task = TASKS.find((item) => item.id === taskId);
    if (!task) return fail('Task not found.', 404, 'NOT_FOUND');
    const row = await selectUser(env.DB, userId);
    if (!row) return fail('User not found.', 404, 'NOT_FOUND');
    const completed = new Set(JSON.parse(row.completed_tasks || '[]'));
    if (completed.has(taskId)) return fail('Task already completed.', 409, 'ALREADY_COMPLETED');
    completed.add(taskId);
    const nextXp = row.xp + 50;
    const update = await env.DB.prepare(
      'UPDATE bot_users SET completed_tasks = ?, coins = coins + ?, xp = ?, level = ?, updated_at = ? ' +
      'WHERE telegram_id = ? AND completed_tasks = ?'
    ).bind(JSON.stringify([...completed]), task.reward, nextXp, Math.floor(nextXp / 1000) + 1,
      new Date().toISOString(), userId, row.completed_tasks || '[]').run();
    if (update.meta?.changes !== 1) return fail('Task state changed. Refresh and retry.', 409, 'CONFLICT');
    const fresh = await selectUser(env.DB, userId);
    return ok({ taskId, reward: task.reward, coins: fresh.coins, xp: fresh.xp, completedTasks: [...completed] });
  }

  if (request.method === 'POST' && url.pathname === '/internal/telegram/leaderboard') {
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(100, Number.parseInt(body.limit, 10) || 10));
    const rows = await env.DB.prepare(
      'SELECT telegram_id, first_name, last_name, username, coins, level, streak FROM bot_users ORDER BY coins DESC LIMIT ?'
    ).bind(limit).all();
    return ok((rows.results || []).map((row, index) => ({
      rank: index + 1, id: row.telegram_id,
      name: (row.first_name + ' ' + (row.last_name || '')).trim() || row.username,
      username: row.username, coins: row.coins, level: row.level, streak: row.streak
    })));
  }

  if (request.method === 'POST' && url.pathname === '/internal/menu/config/get') {
    const config = await readMenuConfig(env.DB);
    return ok(config);
  }

  if (request.method === 'POST' && url.pathname === '/internal/menu/config/update') {
    const body = await request.json().catch(() => ({}));
    const config = await writeMenuConfig(env.DB, body.config);
    return ok(config);
  }

  if (request.method === 'PUT' && url.pathname === '/internal/r2/object') {
    const key = request.headers.get('x-object-key') || '';
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    if (!/^(uploads|packages|proofs)\/[A-Za-z0-9/_\-.]+$/.test(key) || key.includes('..')) {
      return fail('Invalid R2 object key.', 400, 'INVALID_OBJECT_KEY');
    }
    if (!request.body) return fail('Object body is required.');
    const objectBody = await request.arrayBuffer();
    if (objectBody.byteLength > 25 * 1024 * 1024) {
      return fail('Maximum object size is 25 MB.', 413, 'OBJECT_TOO_LARGE');
    }
    await env.ASSETS_BUCKET.put(key, objectBody, {
      httpMetadata: { contentType },
      customMetadata: { uploadedAt: new Date().toISOString() }
    });
    return ok({ key, sizeBytes: objectBody.byteLength, contentType });
  }

  if (request.method === 'GET' && url.pathname === '/internal/storage/stats') {
    const [users, updates, objects] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS count FROM bot_users').first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM telegram_updates').first(),
      env.ASSETS_BUCKET.list({ limit: 1000 })
    ]);
    return ok({
      database: 'D1',
      botUsers: users?.count || 0,
      telegramUpdates: updates?.count || 0,
      r2ObjectsOnFirstPage: objects.objects.length,
      r2ListingTruncated: objects.truncated
    });
  }

  return fail('Not found.', 404, 'NOT_FOUND');
}

export default {
  async scheduled(_controller, env, ctx) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM telegram_updates WHERE received_at < ?')
        .bind(cutoff).run()
    );
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz' && request.method === 'GET') {
      try {
        if (!env.DB || !env.ASSETS_BUCKET) {
          return fail('D1 or R2 binding is missing.', 503, 'BINDING_MISSING');
        }
        await env.DB.prepare('SELECT 1 AS ok').first();
        return ok({ status: 'healthy', database: 'connected', r2: true });
      } catch {
        return fail('Cloudflare storage is not ready.', 503, 'STORAGE_UNAVAILABLE');
      }
    }
    if (url.pathname.startsWith('/internal/')) {
      try {
        return await handleInternal(request, env, url);
      } catch (error) {
        console.error('[data-worker] Request failed:', error.message);
        return fail('Internal storage operation failed.', 500, 'STORAGE_ERROR');
      }
    }
    return fail('Not found.', 404, 'NOT_FOUND');
  }
};
