/**
 * Telegram Startup Service
 * Configures Telegram Bot Webhook, Polling, Command menus, and health checks on server startup.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export const telegramStartup = {
  botInfo: null,
  webhookConfigured: false,
  status: 'initializing',
  lastError: null,

  /**
   * Initializes the Telegram Bot integration
   * @param {string} [token]
   * @param {string} [appUrl]
   */
  async initialize(token = process.env.TELEGRAM_BOT_TOKEN, appUrl = process.env.APP_URL) {
    if (!token || token.trim() === '' || token === 'your_telegram_bot_token_here') {
      this.status = 'simulated_dev_mode';
      this.botInfo = {
        id: 123456789,
        is_bot: true,
        first_name: 'Hendy Bot (Simulated)',
        username: 'hendy_tele_bot',
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: true,
      };
      console.log('🤖 [Telegram Startup] Running in Simulated Mode (No TELEGRAM_BOT_TOKEN provided). Bot Webhook and Controller are ready for testing.');
      return { success: true, mode: 'simulated', botInfo: this.botInfo };
    }

    try {
      // 1. Fetch bot information
      const getMeRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`);
      const getMeData = await getMeRes.json();

      if (!getMeData.ok) {
        throw new Error(`Telegram getMe failed: ${getMeData.description || 'Unknown error'}`);
      }

      this.botInfo = getMeData.result;
      console.log(`🤖 [Telegram Startup] Authenticated as @${this.botInfo.username} (${this.botInfo.first_name})`);

      // 2. Register Bot Command List in Telegram UI
      await this.registerCommands(token);

      // 3. Configure Webhook if APP_URL is available
      if (appUrl && appUrl.startsWith('https://')) {
        const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/bot/webhook`;
        await this.setupWebhook(token, webhookUrl);
      } else {
        console.log('ℹ️ [Telegram Startup] APP_URL not configured for HTTPS webhook. Use manual webhook setup or simulator.');
      }

      this.status = 'active';
      return { success: true, mode: 'live', botInfo: this.botInfo };
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message;
      console.error('❌ [Telegram Startup Error]', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sets Telegram Bot Command Menu
   */
  async registerCommands(token) {
    const commands = [
      { command: 'start', description: '🚀 Khởi động Hendy Bot & nhận thưởng' },
      { command: 'miniapp', description: '🎨 Mở Telegram Mini App Hendy' },
      { command: 'ask', description: '🧠 Chat thông minh với Gemini 3.8 Flash' },
      { command: 'daily', description: '🎁 Điểm danh nhận thưởng mỗi ngày' },
      { command: 'profile', description: '👤 Xem hồ sơ, số dư & năng lượng' },
      { command: 'help', description: '📖 Hướng dẫn sử dụng & danh sách lệnh' },
    ];

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
      });
      const data = await res.json();
      if (data.ok) {
        console.log('✅ [Telegram Startup] Bot command list registered successfully.');
      }
    } catch (e) {
      console.warn('⚠️ [Telegram Startup] Could not register bot commands:', e.message);
    }
  },

  /**
   * Configures Webhook URL with secret token
   */
  async setupWebhook(token, webhookUrl) {
    try {
      const secretToken = process.env.ENCRYPTION_SECRET?.slice(0, 32) || 'hendy_webhook_secret_2026';
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query', 'inline_query'],
          secret_token: secretToken,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        this.webhookConfigured = true;
        console.log(`🌐 [Telegram Startup] Webhook active at: ${webhookUrl}`);
      } else {
        console.warn(`⚠️ [Telegram Startup] setWebhook response:`, data.description);
      }
    } catch (e) {
      console.error('❌ [Telegram Startup] Webhook configuration failed:', e.message);
    }
  },

  /**
   * Returns current status report
   */
  getStatus() {
    return {
      status: this.status,
      botInfo: this.botInfo,
      webhookConfigured: this.webhookConfigured,
      lastError: this.lastError,
      timestamp: new Date().toISOString(),
    };
  },
};
