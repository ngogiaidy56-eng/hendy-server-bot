/**
 * Production Telegram webhook dispatcher.
 */
import { userService } from '../services/userService.js';
import { appDataService } from '../services/appDataService.js';
import { cloudflareDataClient } from '../services/cloudflareDataClient.js';
import { constantTimeEqual } from '../security/webhookSecret.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

async function telegramApi(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  const response = await fetch(TELEGRAM_API_BASE + '/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.description || ('Telegram API ' + method + ' returned HTTP ' + response.status));
  }
  return result;
}

export async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    if (process.env.NODE_ENV === 'production') throw new Error('Telegram bot token is missing.');
    return {
      ok: true,
      simulated: true,
      result: { message_id: 1, chat: { id: chatId }, text, reply_markup: replyMarkup },
    };
  }
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramApi('sendMessage', payload);
}

function requireWebhookSecret(req, res) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV !== 'production') return true;
    res.status(503).json({ ok: false, error: 'Webhook secret is not configured.' });
    return false;
  }
  const supplied = req.get('x-telegram-bot-api-secret-token') || '';
  if (!constantTimeEqual(supplied, expected)) {
    res.status(401).json({ ok: false, error: 'Invalid Telegram webhook secret.' });
    return false;
  }
  return true;
}

async function getRuntimeUser(telegramUser) {
  if (cloudflareDataClient.isConfigured()) return cloudflareDataClient.upsertTelegramUser(telegramUser);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cloudflare Data Worker is required in production.');
  }
  return userService.getOrCreateUser(telegramUser);
}

async function claimDaily(userId) {
  if (cloudflareDataClient.isConfigured()) return cloudflareDataClient.claimDailyReward(userId);
  if (process.env.NODE_ENV === 'production') throw new Error('Cloudflare Data Worker is required in production.');
  const result = userService.claimDailyReward(userId);
  return { claimed: true, ...result };
}

export async function handleWebhook(req, res) {
  if (!requireWebhookSecret(req, res)) return;
  const update = req.body;
  if (!update || typeof update !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid update body.' });
  }

  const updateId = update.update_id;
  let claimedUpdate = false;
  try {
    if (Number.isInteger(updateId) && cloudflareDataClient.isConfigured()) {
      const claim = await cloudflareDataClient.claimTelegramUpdate(updateId);
      if (claim.duplicate) return res.status(200).json({ ok: true, duplicate: true });
      if (claim.inProgress) return res.status(503).json({ ok: false, retry: true, error: 'Update is still being processed.' });
      claimedUpdate = true;
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ ok: false, error: 'Cloudflare update storage is not configured.' });
    }

    let message = update.message || update.edited_message;
    let commandText = message?.text || message?.caption || '';
    let fromUser = message?.from;
    let chatId = message?.chat?.id;

    if (update.callback_query) {
      const callback = update.callback_query;
      await telegramApi('answerCallbackQuery', { callback_query_id: callback.id });
      message = callback.message;
      fromUser = callback.from;
      chatId = message?.chat?.id;
      commandText = callback.data === 'cmd_daily' ? '/daily'
        : callback.data === 'cmd_profile' ? '/profile' : '/help';
    }

    if (!fromUser?.id || !chatId) {
      if (claimedUpdate) await cloudflareDataClient.completeTelegramUpdate(updateId);
      return res.status(200).json({ ok: true, ignored: true });
    }

    const result = await processMessage(commandText, fromUser, chatId);
    if (claimedUpdate) await cloudflareDataClient.completeTelegramUpdate(updateId);
    return res.status(200).json({ ok: true, type: result.type });
  } catch (error) {
    if (claimedUpdate) await cloudflareDataClient.failTelegramUpdate(updateId).catch(() => {});
    console.error('[telegram webhook] Update processing failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Update processing failed. Telegram may retry.' });
  }
}

/** Supported commands: /start, /miniapp, /ask, /daily, /profile, /balance and /help. */
export async function processMessage(text, fromUser, chatId = 0) {
  const cleanText = String(text || '').trim();
  const parts = cleanText.split(/\s+/);
  const rawCommand = parts.shift() || '';
  const command = rawCommand.split('@')[0].toLowerCase();
  const args = parts;
  const user = await getRuntimeUser(fromUser);
  const appUrl = process.env.MINI_APP_URL || process.env.APP_URL || 'https://example.invalid';
  const miniAppKeyboard = {
    inline_keyboard: [
      [{ text: '🚀 Mở Hendy Mini App', web_app: { url: appUrl } }],
      [
        { text: '🎁 Điểm danh', callback_data: 'cmd_daily' },
        { text: '👤 Hồ sơ', callback_data: 'cmd_profile' },
      ],
    ],
  };

  if (command === '/start' || command === '') {
    const name = escapeHtml(user.firstName || fromUser.first_name || 'bạn');
    const message = '✨ <b>Chào mừng ' + name + ' đến với Hendy Bot!</b>\n\n' +
      'Mở Mini App để xem tài khoản, nhiệm vụ và bảng xếp hạng.\n\n' +
      '<b>Lệnh:</b> /menu · /miniapp · /ask · /daily · /profile · /help';
    const result = await sendTelegramMessage(chatId, message, miniAppKeyboard);
    return { type: 'start', replyText: message, result };
  }

  if (command === '/miniapp' || command === '/menu') {
    const message = '🎨 Hendy Mini App đã sẵn sàng. Nhấn nút bên dưới để mở ứng dụng.';
    const result = await sendTelegramMessage(chatId, message, miniAppKeyboard);
    return { type: 'miniapp', replyText: message, result };
  }

  if (command === '/daily') {
    const claim = await claimDaily(user.id);
    if (!claim.claimed) {
      const message = '⏳ Bạn đã nhận thưởng hôm nay. Hãy quay lại vào ngày mai nhé!';
      const result = await sendTelegramMessage(chatId, message);
      return { type: 'daily_already_claimed', replyText: message, result };
    }
    const message = '🎉 <b>Điểm danh thành công!</b>\n🎁 Nhận: +<b>' +
      Number(claim.reward).toLocaleString() + '</b> $HNDY\n🔥 Chuỗi: <b>' +
      claim.streak + ' ngày</b>\n💰 Số dư: <b>' +
      Number(claim.coins).toLocaleString() + '</b> $HNDY';
    const result = await sendTelegramMessage(chatId, message);
    return { type: 'daily', replyText: message, result };
  }

  if (command === '/profile' || command === '/balance') {
    const message = '👤 <b>Hồ sơ Hendy</b>\n\n🆔 ID: <code>' + escapeHtml(user.id) +
      '</code>\n👤 Tên: <b>' + escapeHtml(user.firstName) +
      '</b>\n💰 Số dư: <b>' + Number(user.coins || 0).toLocaleString() +
      ' $HNDY</b>\n⭐ Level: <b>' + (user.level || 1) +
      '</b> · XP: ' + (user.xp || 0) + '\n🔥 Chuỗi: <b>' +
      (user.streak || 0) + ' ngày</b>\n\nMở Mini App để xem thêm chi tiết.';
    const result = await sendTelegramMessage(chatId, message, miniAppKeyboard);
    return { type: 'profile', replyText: message, result };
  }

  if (command === '/ask') {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      const message = 'Vui lòng nhập câu hỏi sau lệnh /ask. Ví dụ: /ask Telegram Mini App hoạt động thế nào?';
      const result = await sendTelegramMessage(chatId, message);
      return { type: 'ask_empty', replyText: message, result };
    }
    const reply = await appDataService.generateHendyAiResponse(prompt, user);
    const message = '🧠 <b>Hendy AI</b>\n\n' + escapeHtml(reply).slice(0, 3800);
    const result = await sendTelegramMessage(chatId, message);
    return { type: 'ask', replyText: message, result };
  }

  if (command === '/help') {
    const message = '📖 <b>Hendy Bot — Hướng dẫn</b>\n\n/start — Khởi động bot\n' +
      '/menu — Mở menu dịch vụ\n/miniapp — Mở Mini App\n/ask câu hỏi — Hỏi Hendy AI\n/daily — Điểm danh\n' +
      '/profile — Xem hồ sơ\n/help — Trợ giúp';
    const result = await sendTelegramMessage(chatId, message);
    return { type: 'help', replyText: message, result };
  }

  if (cleanText && !command.startsWith('/')) {
    const reply = await appDataService.generateHendyAiResponse(cleanText, user);
    const message = '🧠 <b>Hendy AI</b>\n\n' + escapeHtml(reply).slice(0, 3800);
    const result = await sendTelegramMessage(chatId, message);
    return { type: 'general_chat', replyText: message, result };
  }

  const message = '❓ Lệnh chưa được hỗ trợ. Gõ /help để xem danh sách lệnh.';
  const result = await sendTelegramMessage(chatId, message);
  return { type: 'unknown', replyText: message, result };
}

export async function simulateBotCommand(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }
  try {
    const body = req.body || {};
    const message = body.message;
    if (!message) return res.status(400).json({ success: false, error: { code: 'PARAM_MISSING', message: 'message is required' } });
    const simulatedUser = body.user || { id: 777888999, first_name: 'Hendy Explorer', username: 'hendy_user' };
    const result = await processMessage(message, simulatedUser, simulatedUser.id);
    return res.json({ success: true, result });
  } catch (error) {
    return next(error);
  }
}
