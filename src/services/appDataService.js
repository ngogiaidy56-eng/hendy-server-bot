/**
 * App Data Service
 * Provides Telegram Mini App specific data, task lists, leaderboard calculations,
 * and server-side Gemini AI integration for the Hendy AI Assistant.
 */

import { GoogleGenAI } from '@google/genai';
import { userService } from './userService.js';

// Server-side Gemini AI initialization
let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return aiClient;
}

const DEFAULT_TASKS = [
  {
    id: 'welcome_bonus',
    title: 'Claim Welcome Bonus',
    description: 'Welcome to Hendy Telegram Mini App!',
    reward: 1000,
    category: 'basic',
    icon: 'gift',
    url: '',
  },
  {
    id: 'telegram_channel',
    title: 'Join Official Hendy Channel',
    description: 'Get latest bot updates and airdrop news',
    reward: 2000,
    category: 'social',
    icon: 'send',
    url: 'https://t.me/telegram',
  },
  {
    id: 'telegram_group',
    title: 'Join Hendy Community Chat',
    description: 'Discuss with fellow community members',
    reward: 1500,
    category: 'social',
    icon: 'users',
    url: 'https://t.me/telegram',
  },
  {
    id: 'ask_gemini_ai',
    title: 'Ask Hendy Gemini AI a Question',
    description: 'Chat with our AI bot powered by Gemini 3.8 Flash',
    reward: 1200,
    category: 'ai',
    icon: 'sparkles',
    url: '',
  },
  {
    id: 'invite_3_friends',
    title: 'Invite 3 Friends',
    description: 'Share your referral link with Telegram friends',
    reward: 5000,
    category: 'referral',
    icon: 'user-plus',
    url: '',
  },
];

export const appDataService = {
  /**
   * Get all tasks with user completion status
   * @param {string|number} userId
   */
  getTasksForUser(userId) {
    const user = userService.getUserById(userId);
    const completed = new Set(user?.completedTasks || []);

    return DEFAULT_TASKS.map((task) => ({
      ...task,
      isCompleted: completed.has(task.id),
    }));
  },

  /**
   * Get current leaderboard ranked by coins
   * @param {number} limit
   */
  getLeaderboard(limit = 10) {
    const allUsers = userService.getAllUsers();
    const sorted = [...allUsers].sort((a, b) => b.coins - a.coins);

    return sorted.slice(0, limit).map((u, index) => ({
      rank: index + 1,
      id: u.id,
      name: `${u.firstName} ${u.lastName || ''}`.trim() || u.username,
      username: u.username,
      coins: u.coins,
      level: u.level,
      streak: u.streak,
    }));
  },

  /**
   * Generates AI chat response using Gemini 3.8 Flash
   * @param {string} prompt
   * @param {object} [contextUser]
   * @returns {Promise<string>}
   */
  async generateHendyAiResponse(prompt, contextUser = null) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required');
    }

    const ai = getAiClient();

    if (!ai) {
      // In development or when API key is not configured, provide a rich helpful fallback
      return `🤖 [Hendy AI Demo Mode] Xin chào ${contextUser?.firstName || 'bạn'}! Tôi là Hendy Bot AI.
Câu hỏi của bạn: "${prompt}"
Để kích hoạt tính năng Gemini AI trực tiếp, hãy đảm bảo biến môi trường GEMINI_API_KEY đã được cấu hình trong Secrets hoặc .env. Hiện tại tôi vẫn đang hỗ trợ bạn quản lý Mini App, điểm thưởng và các lệnh Bot Telegram!`;
    }

    try {
      const systemInstruction = `You are Hendy Bot AI, a friendly, witty, and highly intelligent AI Telegram Bot assistant and Telegram Mini App companion.
You speak Vietnamese and English fluently (adapt to the user's language).
You help users with general queries, tech questions, Telegram bot operations (/start, /help, /daily, /miniapp), crypto/token earnings, and daily advice.
Keep answers concise, engaging, and well-formatted with markdown and friendly emojis suitable for Telegram chat messages.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      return response.text || 'Xin lỗi, tôi chưa thể trả lời lúc này. Bạn thử lại nhé!';
    } catch (err) {
      console.error('[Gemini AI Error]', err?.message || err);

      // Contextual knowledge base fallback for common Telegram and Hendy queries
      const lower = prompt.toLowerCase();
      let answer = '';

      if (lower.includes('tính năng') || lower.includes('làm được gì') || lower.includes('features')) {
        answer = `🤖 **Các tính năng nổi bật của Hendy Bot & Mini App:**
1. 🚀 **Telegram Mini App (TMA):** Giao diện WebApp React + Vite hiện đại chạy trực tiếp trong Telegram.
2. ⛏️ **Mining & Tap to Earn:** Chạm để đào $HNDY coin với thanh năng lượng tự phục hồi.
3. 🔥 **Daily Check-in Streak:** Điểm danh liên tục 7 ngày nhận thưởng nhân đôi.
4. 🧠 **Gemini 3.8 Flash AI:** Trợ lý trí tuệ nhân tạo giải đáp thông minh.
5. 🛡️ **Bảo mật chuẩn Telegram:** Xác thực HMAC-SHA256 initData & mã hóa AES-256-GCM.
6. 🌐 **Express Backend REST API:** Quản lý User, Leaderboard, Webhook và Polling.`;
      } else if (lower.includes('mini app') || lower.includes('hoạt động')) {
        answer = `🎨 **Telegram Mini App (TMA) hoạt động như thế nào?**
Telegram Mini App là ứng dụng web nhúng trực tiếp vào giao diện Telegram qua WebView:
• Truyền dữ liệu xác thực an toàn qua \`window.Telegram.WebApp.initData\`.
• Backend kiểm tra chữ ký HMAC-SHA256 với bot token (xem file \`src/security/telegramAuth.js\`).
• Tương thích hoàn toàn với chế độ Dark/Light theme và Haptic Feedback của Telegram!`;
      } else if (lower.includes('coin') || lower.includes('hndy') || lower.includes('kiếm')) {
        answer = `💰 **Cách kiếm thêm $HNDY Coin:**
• **Chạm màn hình:** Tap liên tục ở tab "Đào Coin" để nhận thưởng theo sức mạnh chạm.
• **Điểm danh hàng ngày:** Vào tab "Nhiệm Vụ" -> nhận từ 500 đến 3,500 $HNDY mỗi ngày.
• **Hoàn thành nhiệm vụ:** Tham gia nhóm cộng đồng, mời bạn bè qua link giới thiệu!`;
      } else {
        answer = `Xin chào ${contextUser?.firstName || 'bạn'}! Tôi đã ghi nhận câu hỏi: "${prompt}".
Hendy Bot là hệ thống toàn diện gồm Backend Node.js Express (/src) và Frontend React Vite (/mini-app). Bạn có thể thử các lệnh /start, /profile, /daily trong tab Console!`;
      }

      if (String(err?.message || '').includes('403') || String(err?.message || '').includes('PERMISSION_DENIED')) {
        answer += `\n\n*(Lưu ý: API Key hiện tại chưa kích hoạt billing/trả phí của Gemini. Hệ thống tự động chuyển sang chế độ phản hồi tri thức nội bộ).*`;
      }

      return answer;
    }
  },
};
