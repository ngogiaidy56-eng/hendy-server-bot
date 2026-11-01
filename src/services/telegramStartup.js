/**
 * Telegram Bot lifecycle: validate credentials, register commands and configure webhook.
 */
const TELEGRAM_API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10000;

async function telegramRequest(token, method, payload) {
  const response = await fetch(TELEGRAM_API_BASE + '/bot' + token + '/' + method, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'content-type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.description || ('Telegram ' + method + ' failed (HTTP ' + response.status + ')'));
  }
  return data.result;
}

const COMMANDS = [
  { command: 'start', description: 'Khởi động Hendy Bot' },
  { command: 'miniapp', description: 'Mở Hendy Mini App' },
  { command: 'ask', description: 'Hỏi đáp với Hendy AI' },
  { command: 'daily', description: 'Điểm danh nhận thưởng' },
  { command: 'profile', description: 'Xem hồ sơ và số dư' },
  { command: 'help', description: 'Xem hướng dẫn sử dụng' },
];

export const telegramStartup = {
  botInfo: null,
  webhookConfigured: false,
  status: 'initializing',
  lastError: null,

  async initialize(token = process.env.TELEGRAM_BOT_TOKEN) {
    this.lastError = null;
    this.webhookConfigured = false;

    if (!token || !token.trim()) {
      if (process.env.NODE_ENV === 'production') {
        this.status = 'configuration_required';
        this.lastError = 'TELEGRAM_BOT_TOKEN is not configured.';
        return { success: false, error: this.lastError };
      }
      this.status = 'development_without_bot_token';
      return { success: true, mode: 'development', botInfo: null };
    }

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === 'production' &&
        (!webhookSecret || !/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret))) {
      this.status = 'configuration_required';
      this.lastError = 'TELEGRAM_WEBHOOK_SECRET is missing or has an invalid format.';
      return { success: false, error: this.lastError };
    }

    const webhookBase = process.env.WEBHOOK_BASE_URL ||
      process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '';
    if (!webhookBase.startsWith('https://')) {
      this.status = 'configuration_required';
      this.lastError = 'Set WEBHOOK_BASE_URL to the public HTTPS URL of the Render service.';
      return { success: false, error: this.lastError };
    }

    try {
      this.botInfo = await telegramRequest(token, 'getMe');
      await telegramRequest(token, 'setMyCommands', { commands: COMMANDS });
      const webhookUrl = webhookBase.replace(/\/$/, '') + '/api/bot/webhook';
      const webhookPayload = {
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
        max_connections: 20,
        drop_pending_updates: false,
      };
      if (webhookSecret) webhookPayload.secret_token = webhookSecret;
      await telegramRequest(token, 'setWebhook', webhookPayload);

      this.webhookConfigured = true;
      this.status = 'active';
      console.log('[telegram] Authenticated as @' + this.botInfo.username + '; webhook configured.');
      return { success: true, mode: 'webhook', botInfo: this.botInfo };
    } catch (error) {
      this.status = 'error';
      this.lastError = error.message;
      console.error('[telegram] Initialization failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  async getWebhookInfo() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
    return telegramRequest(token, 'getWebhookInfo');
  },

  getStatus() {
    return {
      status: this.status,
      botInfo: this.botInfo ? {
        id: this.botInfo.id,
        username: this.botInfo.username,
        first_name: this.botInfo.first_name,
      } : null,
      webhookConfigured: this.webhookConfigured,
      lastError: this.lastError,
      timestamp: new Date().toISOString(),
    };
  },
};
