import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Gift,
  Trophy,
  Terminal,
  Send,
  User,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Coins,
  ChevronRight,
  Flame,
  KeyRound,
  ExternalLink,
  MessageSquare,
  Bot,
  Copy,
  Check
} from 'lucide-react';

export default function App() {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const apiFetch = (url, options = {}) => {
    const initData = window.Telegram?.WebApp?.initData || '';
    const headers = {
      ...(options.headers || {}),
      ...(initData ? { Authorization: 'tma ' + initData } : {}),
    };
    return fetch(apiBase + url, { ...options, headers });
  };
  const [activeTab, setActiveTab] = useState('tap');
  const [user, setUser] = useState({
    id: 0,
    firstName: 'Telegram User',
    username: 'telegram_user',
    coins: 0,
    level: 1,
    xp: 0,
    energy: 1000,
    maxEnergy: 1000,
    tapPower: 2,
    streak: 0,
    lastDailyClaim: null,
  });

  const [tapsParticles, setTapsParticles] = useState([]);
  const [isTelegramClient, setIsTelegramClient] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Gemini AI Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: '👋 Xin chào! Tôi là **Hendy AI** được vận hành bởi **Gemini 3.8 Flash**. Tôi có thể giúp bạn trả lời câu hỏi, hướng dẫn Telegram Bot & Mini App, phân tích dữ liệu hoặc trò chuyện!',
      time: 'Vừa xong',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Bot Simulator state
  const [botConsoleHistory, setBotConsoleHistory] = useState([
    {
      command: '/start',
      reply: '✨ Chào mừng bạn đến với Hendy Bot! Nhấn /help để xem hướng dẫn hoặc mở Mini App.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [simCommand, setSimCommand] = useState('/profile');
  const [isSimulating, setIsSimulating] = useState(false);

  // Security & InitData state
  const [initDataString, setInitDataString] = useState('');
  const [authValidationResult, setAuthValidationResult] = useState(null);
  const [encryptInput, setEncryptInput] = useState('Telegram Secret Wallet Key: 0x9a8b7c6d5e4f');
  const [encryptedOutput, setEncryptedOutput] = useState('');
  const [decryptedOutput, setDecryptedOutput] = useState('');

  // 1. Initialize Telegram WebApp SDK if available
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegramClient(true);
      tg.ready();
      tg.expand();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser) {
        setUser((prev) => ({
          ...prev,
          id: tgUser.id,
          firstName: tgUser.first_name || prev.firstName,
          username: tgUser.username || prev.username,
        }));
      }
      setInitDataString(tg.initData);
      if (tgUser?.id) {
        fetchUserData(tgUser.id);
        fetchTasks(tgUser.id);
      }
      fetchLeaderboard();
    } else {
      setIsTelegramClient(false);
      setTasks([]);
      setLeaderboard([]);
    }

    // Passive energy regeneration ticker
    const timer = setInterval(() => {
      setUser((prev) => {
        if (prev.energy < prev.maxEnergy) {
          return { ...prev, energy: Math.min(prev.maxEnergy, prev.energy + 3) };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiTyping]);

  const showToast = (msg, isError = false) => {
    setFeedbackMsg({ text: msg, isError });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const fetchUserData = async (userId = user.id) => {
    try {
      const res = await apiFetch(`/api/user/${userId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setUser((prev) => ({
          ...prev,
          coins: data.data.coins,
          level: data.data.level,
          xp: data.data.xp,
          energy: data.data.energy,
          maxEnergy: data.data.maxEnergy,
          tapPower: data.data.tapPower,
          streak: data.data.streak,
          lastDailyClaim: data.data.lastDailyClaim,
        }));
      }
    } catch {
      // Offline fallback
    }
  };

  const fetchTasks = async (userId = user.id) => {
    try {
      const res = await apiFetch(`/api/miniapp/tasks/${userId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTasks(data.data);
      }
    } catch {
      // Fallback
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await apiFetch('/api/miniapp/leaderboard');
      const data = await res.json();
      if (data.success && data.data) {
        setLeaderboard(data.data);
      }
    } catch {
      // Fallback
    }
  };

  // Handle Tap Action
  const handleTap = (e) => {
    if (user.energy < user.tapPower) {
      showToast('⚡ Hết năng lượng! Hãy đợi hồi phục...', true);
      return;
    }

    // Telegram Haptic
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
    const y = e.clientY ? e.clientY - rect.top : rect.height / 2;

    const newParticle = {
      id: Date.now() + Math.random(),
      x,
      y,
      value: `+${user.tapPower}`,
    };
    setTapsParticles((prev) => [...prev.slice(-15), newParticle]);

    // Optimistic UI update
    setUser((prev) => ({
      ...prev,
      coins: prev.coins + prev.tapPower,
      energy: Math.max(0, prev.energy - prev.tapPower),
      xp: prev.xp + 1,
    }));

    // Trigger API in background
    apiFetch(`/api/user/${user.id}/tap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taps: 1 }),
    }).catch(() => {});
  };

  // Handle Daily Streak Claim
  const handleClaimDaily = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/user/${user.id}/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setUser((prev) => ({
          ...prev,
          coins: data.data.coins,
          streak: data.data.streak,
          lastDailyClaim: new Date().toISOString(),
        }));
        showToast(`🎉 Nhận thành công +${data.data.reward} $HNDY! Chuỗi: ${data.data.streak} ngày!`);
      } else {
        showToast(data.error?.message || 'Không thể điểm danh lúc này', true);
      }
    } catch (err) {
      showToast('Lỗi kết nối khi điểm danh', true);
    } finally {
      setLoading(false);
    }
  };

  // Complete a task
  const handleCompleteTask = async (taskId, reward) => {
    try {
      const res = await apiFetch(`/api/miniapp/tasks/${user.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, reward }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setUser((prev) => ({ ...prev, coins: data.data.coins }));
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, isCompleted: true } : t))
        );
        showToast(`✅ Đã hoàn thành nhiệm vụ! +${reward} $HNDY`);
      } else {
        showToast(data.error?.message || 'Nhiệm vụ đã hoàn thành trước đó', true);
      }
    } catch {
      showToast('Lỗi hoàn thành nhiệm vụ', true);
    }
  };

  // Send AI chat message to Gemini 3.8 Flash
  const handleSendAiMessage = async (e) => {
    e?.preventDefault();
    if (!inputPrompt.trim() || isAiTyping) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');

    const newMessages = [
      ...chatMessages,
      { sender: 'user', text: userText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ];
    setChatMessages(newMessages);
    setIsAiTyping(true);

    try {
      const res = await apiFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, user }),
      });
      const data = await res.json();
      const reply = data.data?.reply || 'Xin lỗi, tôi chưa nhận được phản hồi từ AI.';

      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: '⚠️ Đã xảy ra lỗi kết nối với Gemini AI. Vui lòng thử lại sau!', time: 'Lỗi' },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Run simulated bot command
  const handleRunBotCommand = async (cmd) => {
    const targetCmd = cmd || simCommand;
    if (!targetCmd) return;
    setIsSimulating(true);

    try {
      const res = await apiFetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: targetCmd, user }),
      });
      const data = await res.json();
      const replyText = data.result?.replyText || 'No response';

      setBotConsoleHistory((prev) => [
        ...prev,
        { command: targetCmd, reply: replyText, timestamp: new Date().toLocaleTimeString() },
      ]);
      fetchUserData();
    } catch {
      setBotConsoleHistory((prev) => [
        ...prev,
        { command: targetCmd, reply: '⚠️ Lỗi gửi lệnh bot', timestamp: new Date().toLocaleTimeString() },
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  // Validate Telegram initData
  const handleValidateInitData = async () => {
    try {
      const res = await apiFetch('/api/auth/validate-init-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initDataString }),
      });
      const data = await res.json();
      setAuthValidationResult(data);
      if (data.success) {
        showToast('🛡️ Chữ ký HMAC Telegram hợp lệ!');
      } else {
        showToast('❌ Xác thực thất bại', true);
      }
    } catch (e) {
      showToast('Lỗi khi gửi yêu cầu xác thực', true);
    }
  };

  // Test AES encryption
  const handleEncryptTest = async () => {
    try {
      const res = await apiFetch('/api/security/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: encryptInput }),
      });
      const data = await res.json();
      if (data.success) {
        setEncryptedOutput(data.data.encrypted);
        showToast('🔒 Đã mã hóa AES-256-GCM!');
      }
    } catch {
      showToast('Lỗi mã hóa', true);
    }
  };

  const handleDecryptTest = async () => {
    try {
      const res = await apiFetch('/api/security/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encryptedOutput }),
      });
      const data = await res.json();
      if (data.success) {
        setDecryptedOutput(data.data.decrypted);
        showToast('🔓 Đã giải mã thành công!');
      }
    } catch {
      showToast('Lỗi giải mã dữ liệu', true);
    }
  };

  if (!isTelegramClient) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center text-2xl font-black">H</div>
          <h1 className="text-xl font-bold">Hendy Mini App</h1>
          <p className="text-sm text-slate-400">Để bảo vệ tài khoản và số dư, hãy mở Mini App từ nút trong cuộc trò chuyện với Hendy Bot trên Telegram.</p>
          <p className="text-xs text-slate-500">Không đăng nhập hoặc hiển thị tài khoản mẫu trên trình duyệt công khai.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="h-full min-h-[640px] bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto relative shadow-2xl border-x border-slate-800">
      {/* Toast Notification */}
      {feedbackMsg && (
        <div
          role="status"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
            feedbackMsg.isError ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Top Header */}
      <header className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center font-bold text-cyan-400">
                H
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight">{user.firstName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20">
                  Lvl {user.level}
                </span>
              </div>
              <span className="text-xs text-slate-400">@{user.username}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUserData}
              aria-label="Refresh user data"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-300">{user.streak}d</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Scroll Area */}
      <main className="flex-1 overflow-y-auto pb-24 p-4">
        {/* TAB 1: TAP & MINE */}
        {activeTab === 'tap' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-6">
            {/* Balance Badge */}
            <div className="text-center space-y-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Số dư Hendy</span>
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-7 h-7 text-amber-400 animate-pulse-slow" />
                <span className="text-4xl font-black tracking-tight text-white">
                  {user.coins.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  $HNDY
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Sức mạnh chạm: <span className="text-cyan-400 font-semibold">+{user.tapPower}</span> | XP: {user.xp}
              </div>
            </div>

            {/* Mining Tap Target */}
            <div className="relative my-2 select-none">
              <button
                onClick={handleTap}
                aria-label="Tap to mine Hendy coins"
                className="w-56 h-56 rounded-full bg-gradient-to-b from-cyan-400 via-blue-600 to-indigo-900 p-2 shadow-2xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-transform duration-100 flex items-center justify-center relative overflow-hidden group focus:outline-none focus:ring-4 focus:ring-cyan-500/40"
              >
                <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center border-4 border-cyan-400/30">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Bot className="w-14 h-14 text-white" />
                  </div>
                  <span className="mt-2 text-xs font-bold tracking-wider text-cyan-300 uppercase">
                    Chạm để đào
                  </span>
                </div>
              </button>

              {/* Floating particles */}
              {tapsParticles.map((p) => (
                <div
                  key={p.id}
                  className="floating-tap text-lg"
                  style={{ left: `${p.x}px`, top: `${p.y}px` }}
                >
                  {p.value}
                </div>
              ))}
            </div>

            {/* Energy Bar */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  Năng lượng đào
                </span>
                <span className="font-bold text-slate-200">
                  {user.energy} <span className="text-slate-500">/ {user.maxEnergy}</span>
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-cyan-400 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (user.energy / user.maxEnergy) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                Hồi phục tự động: +3/giây
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="w-full grid grid-cols-2 gap-3">
              <button
                onClick={handleClaimDaily}
                disabled={loading}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-br from-indigo-900/60 to-purple-900/40 border border-indigo-700/40 hover:border-indigo-500 text-left transition-all"
              >
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Điểm danh</div>
                  <div className="text-[11px] text-indigo-300">Nhận quà ngày {user.streak + 1}</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-br from-cyan-900/60 to-blue-900/40 border border-cyan-700/40 hover:border-cyan-500 text-left transition-all"
              >
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Hỏi Gemini AI</div>
                  <div className="text-[11px] text-cyan-300">Trí tuệ nhân tạo</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: GEMINI AI CHAT */}
        {activeTab === 'ai' && (
          <div className="flex flex-col h-[75vh]">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white">Hendy AI Assistant</h2>
                  <span className="text-[10px] text-cyan-400">Powered by Gemini 3.8 Flash</span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Server-side
              </span>
            </div>

            {/* Suggestion Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {[
                'Telegram Mini App hoạt động thế nào?',
                'Hendy Bot có những tính năng gì?',
                'Hướng dẫn kiếm thêm $HNDY coin?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputPrompt(suggestion)}
                  className="whitespace-nowrap text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              {isAiTyping && (
                <div className="flex items-center gap-2 text-xs text-cyan-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 w-fit">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Hendy AI đang suy nghĩ...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Box */}
            <form onSubmit={handleSendAiMessage} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Nhập câu hỏi cho Hendy AI..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isAiTyping || !inputPrompt.trim()}
                aria-label="Send message to AI"
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: TASKS & EARN */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Daily Streak Card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                    Chuỗi đăng nhập 7 ngày
                  </h3>
                  <p className="text-[11px] text-slate-400">Điểm danh mỗi ngày để tăng thưởng $HNDY</p>
                </div>
                <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {user.streak} ngày
                </span>
              </div>

              {/* Day badges */}
              <div className="grid grid-cols-7 gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const isClaimed = day <= user.streak;
                  const isCurrent = day === user.streak + 1;
                  return (
                    <div
                      key={day}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                        isClaimed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : isCurrent
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-2 ring-amber-500/20'
                          : 'bg-slate-900/60 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="text-[10px] font-medium">N{day}</span>
                      <span className="text-[11px] font-bold">+{day * 500}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleClaimDaily}
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" />
                <span>{loading ? 'Đang điểm danh...' : 'Điểm danh ngay (+500 - +3,500 $HNDY)'}</span>
              </button>
            </div>

            {/* Mission List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Nhiệm vụ nhận thưởng
              </h3>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-800 text-cyan-400">
                      {task.category === 'ai' ? (
                        <Sparkles className="w-4 h-4" />
                      ) : task.category === 'social' ? (
                        <Send className="w-4 h-4" />
                      ) : (
                        <Gift className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{task.title}</h4>
                      <p className="text-[11px] text-slate-400">{task.description}</p>
                      <span className="text-[11px] font-bold text-amber-400">
                        +{task.reward.toLocaleString()} $HNDY
                      </span>
                    </div>
                  </div>

                  <div>
                    {task.isCompleted ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã nhận
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCompleteTask(task.id, task.reward)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
                      >
                        Nhận
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Bảng Xếp Hạng Cộng Đồng
                </h3>
                <p className="text-[11px] text-slate-400">Top thợ mỏ $HNDY tích cực nhất</p>
              </div>
              <button
                onClick={fetchLeaderboard}
                aria-label="Refresh leaderboard"
                className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {leaderboard.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    String(item.id) === String(user.id)
                      ? 'bg-cyan-950/40 border-cyan-500/40'
                      : 'bg-slate-900/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${
                        item.rank === 1
                          ? 'bg-amber-400 text-slate-950'
                          : item.rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : item.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{item.name}</span>
                        {String(item.id) === String(user.id) && (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1 rounded">Bạn</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Cấp {item.level} • Chuỗi {item.streak}d
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-400">
                      {item.coins.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-500">$HNDY</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: BOT CONSOLE & SECURITY */}
        {activeTab === 'console' && (
          <div className="space-y-4">
            {/* Telegram WebApp initData validation card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Xác thực Telegram initData (HMAC-SHA256)
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  {isTelegramClient ? 'Client Telegram' : 'Giả lập Browser'}
                </span>
              </div>
              <textarea
                value={initDataString}
                onChange={(e) => setInitDataString(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleValidateInitData}
                className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
              >
                Kiểm tra tính toàn vẹn (telegramAuth.js)
              </button>
              {authValidationResult && (
                <div
                  className={`p-2 rounded-lg text-[11px] font-mono ${
                    authValidationResult.success
                      ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/40 border border-rose-800 text-rose-300'
                  }`}
                >
                  {authValidationResult.success ? '✅ Chữ ký hợp lệ' : '❌ Chữ ký không hợp lệ'}
                  {authValidationResult.data?.validation?.simulated && ' (Simulated Dev Mode)'}
                </div>
              )}
            </div>

            {/* AES-256-GCM Cryptographic Service */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  Mã hóa bảo mật (cryptoService.js)
                </span>
                <span className="text-[10px] text-purple-400">AES-256-GCM</span>
              </div>
              <input
                type="text"
                value={encryptInput}
                onChange={(e) => setEncryptInput(e.target.value)}
                placeholder="Chuỗi cần mã hóa bí mật..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEncryptTest}
                  className="flex-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors"
                >
                  Mã hóa
                </button>
                <button
                  onClick={handleDecryptTest}
                  disabled={!encryptedOutput}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs transition-colors"
                >
                  Giải mã
                </button>
              </div>
              {encryptedOutput && (
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-purple-300 break-all">
                  Cipher: {encryptedOutput}
                </div>
              )}
              {decryptedOutput && (
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-300">
                  Decrypted: {decryptedOutput}
                </div>
              )}
            </div>

            {/* Telegram Bot Command Tester */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Giả lập lệnh Bot Telegram (/start, /ask...)
                </span>
                <span className="text-[10px] text-amber-400">botController.js</span>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['/start', '/profile', '/daily', '/miniapp', '/help'].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => {
                      setSimCommand(cmd);
                      handleRunBotCommand(cmd);
                    }}
                    className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded"
                  >
                    {cmd}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={simCommand}
                  onChange={(e) => setSimCommand(e.target.value)}
                  placeholder="Nhập lệnh: /ask Bạn là ai?"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none"
                />
                <button
                  onClick={() => handleRunBotCommand()}
                  disabled={isSimulating}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  {isSimulating ? '...' : 'Chạy'}
                </button>
              </div>

              {/* Bot Console Log */}
              <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2 text-[11px] font-mono">
                {botConsoleHistory.map((entry, idx) => (
                  <div key={idx} className="border-b border-slate-900 pb-1.5 last:border-0">
                    <div className="text-cyan-400 font-semibold">{entry.command} <span className="text-slate-600 text-[9px]">[{entry.timestamp}]</span></div>
                    <div className="text-slate-300 whitespace-pre-wrap">{entry.reply}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Telegram Mini App Tab Navigation */}
      <nav className="sticky bottom-0 left-0 right-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-40 px-2 py-2">
        <div className="grid grid-cols-5 gap-1">
          <button
            onClick={() => setActiveTab('tap')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'tap' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">Đào Coin</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'ai' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">Hendy AI</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'tasks' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gift className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">Nhiệm Vụ</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'leaderboard' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">Bảng Vàng</span>
          </button>

          {!import.meta.env.PROD && (
          <button
            onClick={() => setActiveTab('console')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'console' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">Console</span>
          </button>
          )}
        </div>
      </nav>
    </div>
  );
}
