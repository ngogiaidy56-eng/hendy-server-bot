/**
 * Bot Controller
 * Receives incoming Telegram updates, dispatches commands (/start, /ask, /daily, /profile, /miniapp),
 * orchestrates Gemini AI integration, and returns response payloads.
 */

import { userService } from '../services/userService.js';
import { appDataService } from '../services/appDataService.js';
import { telegramStartup } from '../services/telegramStartup.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Sends a message back to Telegram chat
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} [replyMarkup]
 */
export async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  // In simulated dev mode or if token is not set, log and return simulated payload
  if (!token || token.trim() === '' || token === 'your_telegram_bot_token_here') {
    return {
      ok: true,
      result: {
        message_id: Math.floor(Math.random() * 100000),
        chat: { id: chatId },
        text,
        reply_markup: replyMarkup,
        date: Math.floor(Date.now() / 1000),
      },
      simulated: true,
    };
  }

  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return await res.json();
  } catch (err) {
    console.error('[sendTelegramMessage Error]', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Main Controller Handler for Telegram Webhook
 */
export async function handleWebhook(req, res, next) {
  try {
    const update = req.body;
    if (!update) {
      return res.status(200).json({ ok: true, message: 'Empty update ignored' });
    }

    const message = update.message;
    if (!message) {
      return res.status(200).json({ ok: true, message: 'No message in update' });
    }

    const chatId = message.chat.id;
    const fromUser = message.from;
    const text = message.text || '';

    const response = await processMessage(text, fromUser, chatId);
    return res.status(200).json({ ok: true, response });
  } catch (err) {
    next(err);
  }
}

/**
 * Core command processing logic
 * @param {string} text
 * @param {object} fromUser
 * @param {string|number} chatId
 */
export async function processMessage(text, fromUser, chatId = 0) {
  const cleanText = (text || '').trim();
  const [command, ...args] = cleanText.split(' ');
  const user = userService.getOrCreateUser(fromUser);
  const appUrl = process.env.APP_URL || 'https://hendy-tele-app.onrender.com';

  // Inline keyboard for Telegram Mini App
  const miniAppKeyboard = {
    inline_keyboard: [
      [
        {
          text: '🚀 Mở Hendy Mini App',
          web_app: { url: appUrl },
        },
      ],
      [
        { text: '🎁 Điểm danh (/daily)', callback_data: 'cmd_daily' },
        { text: '👤 Hồ sơ (/profile)', callback_data: 'cmd_profile' },
      ],
    ],
  };

  if (command === '/start') {
    const welcomeMsg = `✨ <b>Chào mừng ${user.firstName} đến với Hendy Bot!</b> ✨

Tôi là <b>Hendy</b> — Trợ lý Telegram AI thông minh tích hợp <b>Telegram Mini App (TMA)</b> và trí tuệ nhân tạo <b>Gemini 3.8 Flash</b>.

💰 <b>Số dư khởi tạo:</b> ${user.coins.toLocaleString()} $HNDY
⚡ <b>Cấp độ:</b> Level ${user.level} (Năng lượng: ${user.energy}/${user.maxEnergy})

📌 <b>Các lệnh nhanh:</b>
• <code>/miniapp</code> : Khởi chạy Mini App trên Telegram
• <code>/ask [câu hỏi]</code> : Hỏi đáp với AI Gemini
• <code>/daily</code> : Điểm danh nhận thưởng hàng ngày
• <code>/profile</code> : Xem chi tiết tài khoản & mã mời
• <code>/help</code> : Xem hướng dẫn chi tiết

👇 <i>Nhấn nút bên dưới để mở Mini App ngay:</i>`;

    const result = await sendTelegramMessage(chatId, welcomeMsg, miniAppKeyboard);
    return { type: 'start', replyText: welcomeMsg, result };
  }

  if (command === '/miniapp') {
    const msg = `🎨 <b>Hendy Telegram Mini App</b> đã sẵn sàng!\nNhấn nút bên dưới để trải nghiệm giao diện WebApp trực tiếp:`;
    const result = await sendTelegramMessage(chatId, msg, miniAppKeyboard);
    return { type: 'miniapp', replyText: msg, result };
  }

  if (command === '/daily') {
    try {
      const claimResult = userService.claimDailyReward(user.id);
      const msg = `🎉 <b>Điểm danh thành công!</b>
🎁 Nhận được: +<b>${claimResult.reward.toLocaleString()}</b> $HNDY
🔥 Chuỗi điểm danh: <b>${claimResult.streak} ngày liên tiếp</b>
💰 Tổng số dư hiện tại: <b>${claimResult.coins.toLocaleString()}</b> $HNDY`;

      const result = await sendTelegramMessage(chatId, msg);
      return { type: 'daily', replyText: msg, result };
    } catch (e) {
      const msg = `⏳ <b>Thông báo:</b> ${e.message}`;
      const result = await sendTelegramMessage(chatId, msg);
      return { type: 'daily_error', replyText: msg, result };
    }
  }

  if (command === '/profile' || command === '/balance') {
    const msg = `👤 <b>Hồ sơ Hendy của bạn:</b>

🆔 ID: <code>${user.id}</code>
👤 Tên: <b>${user.firstName}</b> (@${user.username})
💰 Số dư: <b>${user.coins.toLocaleString()} $HNDY</b>
⭐ Level: <b>${user.level}</b> (XP: ${user.xp})
⚡ Năng lượng: <b>${user.energy}/${user.maxEnergy}</b>
🔥 Chuỗi Streak: <b>${user.streak} ngày</b>
👥 Bạn bè đã mời: <b>${user.referralsCount} người</b>
🔗 Link giới thiệu: <code>https://t.me/HendyBot?start=ref_${user.id}</code>`;

    const result = await sendTelegramMessage(chatId, msg, miniAppKeyboard);
    return { type: 'profile', replyText: msg, result };
  }

  if (command === '/ask') {
    const query = args.join(' ').trim();
    if (!query) {
      const msg = `❓ Vui lòng nhập câu hỏi sau lệnh <code>/ask</code>.\n<i>Ví dụ:</i> <code>/ask Telegram Mini App hoạt động như thế nào?</code>`;
      const result = await sendTelegramMessage(chatId, msg);
      return { type: 'ask_empty', replyText: msg, result };
    }

    const aiReply = await appDataService.generateHendyAiResponse(query, user);
    const msg = `🧠 <b>Hendy AI (Gemini 3.8 Flash):</b>\n\n${aiReply}`;
    const result = await sendTelegramMessage(chatId, msg);
    return { type: 'ask', replyText: msg, result };
  }

  if (command === '/help') {
    const msg = `📖 <b>Danh sách lệnh & hướng dẫn Hendy Bot:</b>

/start - Khởi động lại Bot và nhận link Mini App
/miniapp - Mở giao diện Telegram Mini App (TMA)
/ask &lt;câu hỏi&gt; - Trò chuyện với trợ lý Gemini AI
/daily - Điểm danh nhận thưởng chuỗi mỗi 24 giờ
/profile - Xem thông tin người dùng, số dư và link ref
/help - Xem bảng hướng dẫn này

Hệ thống được thiết kế với kiến trúc chuẩn Node.js Express Backend và React Vite Mini App.`;

    const result = await sendTelegramMessage(chatId, msg);
    return { type: 'help', replyText: msg, result };
  }

  // If user sends normal text without slash command, treat as Gemini AI query
  if (cleanText.length > 0 && !cleanText.startsWith('/')) {
    const aiReply = await appDataService.generateHendyAiResponse(cleanText, user);
    const msg = `🧠 <b>Hendy AI:</b>\n\n${aiReply}`;
    const result = await sendTelegramMessage(chatId, msg);
    return { type: 'general_chat', replyText: msg, result };
  }

  const defaultMsg = `❓ Lệnh không nhận diện. Gõ <code>/help</code> để xem hướng dẫn sử dụng bot.`;
  const result = await sendTelegramMessage(chatId, defaultMsg);
  return { type: 'unknown', replyText: defaultMsg, result };
}

/**
 * Controller endpoint to test/simulate commands directly from Web UI
 */
export async function simulateBotCommand(req, res, next) {
  try {
    const { message, user } = req.body;
    const testUser = user || {
      id: 99887766,
      first_name: 'Tester',
      username: 'tester_tma',
    };

    const result = await processMessage(message, testUser, 99887766);
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}
