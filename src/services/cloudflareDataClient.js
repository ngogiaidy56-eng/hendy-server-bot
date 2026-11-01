/**
 * Authenticated client for the Cloudflare Data Worker.
 * Render must not attempt to use Cloudflare D1/R2 bindings directly.
 */
const baseUrl = () => (process.env.CLOUDFLARE_DATA_API_URL || '').replace(/\/+$/, '');
const apiToken = () => process.env.CLOUDFLARE_DATA_API_TOKEN || '';

export function isCloudflareDataConfigured() {
  return Boolean(baseUrl() && apiToken());
}

async function post(path, payload = {}) {
  if (!isCloudflareDataConfigured()) {
    throw new Error('Cloudflare Data Worker is not configured.');
  }

  let response;
  try {
    response = await fetch(baseUrl() + path, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + apiToken(),
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new Error('Cloudflare Data Worker is unavailable: ' + error.message);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.error?.message || ('Cloudflare Data Worker returned HTTP ' + response.status));
  }
  return result.data;
}

async function get(path) {
  if (!isCloudflareDataConfigured()) {
    throw new Error('Cloudflare Data Worker is not configured.');
  }
  const response = await fetch(baseUrl() + path, {
    method: 'GET',
    headers: { authorization: 'Bearer ' + apiToken() },
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.error?.message || ('Cloudflare Data Worker returned HTTP ' + response.status));
  }
  return result.data;
}

export const cloudflareDataClient = {
  isConfigured: isCloudflareDataConfigured,
  claimTelegramUpdate(updateId) {
    return post('/internal/telegram/updates/claim', { updateId: String(updateId) });
  },
  completeTelegramUpdate(updateId) {
    return post('/internal/telegram/updates/complete', { updateId: String(updateId) });
  },
  failTelegramUpdate(updateId) {
    return post('/internal/telegram/updates/fail', { updateId: String(updateId) });
  },
  upsertTelegramUser(user) {
    return post('/internal/telegram/users/upsert', { user });
  },
  getUser(userId) {
    return post('/internal/telegram/users/get', { userId: String(userId) });
  },
  tap(userId, taps = 1) {
    return post('/internal/telegram/users/tap', { userId: String(userId), taps });
  },
  claimDailyReward(userId) {
    return post('/internal/telegram/users/daily', { userId: String(userId) });
  },
  getTasks(userId) {
    return post('/internal/telegram/tasks/list', { userId: String(userId) });
  },
  completeTask(userId, taskId) {
    return post('/internal/telegram/tasks/complete', { userId: String(userId), taskId });
  },
  getLeaderboard(limit = 10) {
    return post('/internal/telegram/leaderboard', { limit });
  },
  getStorageStats() {
    return get('/internal/storage/stats');
  },
};
