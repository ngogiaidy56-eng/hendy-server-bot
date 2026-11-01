import { useCallback, useEffect, useState } from 'react';

type ServiceHealth = {
  status?: string;
  service?: string;
  uptimeSeconds?: number;
};

type BotStatus = {
  status?: string;
  webhookConfigured?: boolean;
  botInfo?: { username?: string; first_name?: string } | null;
  lastError?: string | null;
};

export default function App() {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [healthResponse, botResponse] = await Promise.all([
        fetch('/healthz', { cache: 'no-store' }),
        fetch('/api/bot/status', { cache: 'no-store' }),
      ]);
      if (!healthResponse.ok) throw new Error('Service health check returned HTTP ' + healthResponse.status);
      if (!botResponse.ok) throw new Error('Telegram status endpoint returned HTTP ' + botResponse.status);
      const healthData = await healthResponse.json();
      const botData = await botResponse.json();
      setHealth(healthData);
      setBot(botData.data || null);
      setCheckedAt(new Date().toLocaleString());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retrieve service status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const botUsername = bot?.botInfo?.username;
  const telegramUrl = botUsername ? 'https://t.me/' + botUsername : '';
  const serviceOnline = health?.status === 'ok';
  const webhookOnline = bot?.webhookConfigured === true && bot?.status === 'active';
  const uptime = health?.uptimeSeconds
    ? Math.floor(health.uptimeSeconds / 3600) + ' giờ ' +
      Math.floor((health.uptimeSeconds % 3600) / 60) + ' phút'
    : '—';

  return (
    <main className="min-h-screen bg-[#0b1220] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center gap-3 border-b border-slate-800 pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-xl font-black text-cyan-300">H</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Hendy Services</p>
            <h1 className="text-xl font-bold sm:text-2xl">Telegram Bot Platform</h1>
          </div>
        </header>

        <section className="grid flex-1 content-center gap-6 py-12 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Production service</p>
              <h2 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Hendy Bot, <span className="text-cyan-300">ready for Telegram.</span>
              </h2>
              <p className="max-w-xl text-base leading-7 text-slate-400">
                Bot API and Telegram Mini App are served through a production webhook runtime.
                User profiles and bot state are stored through Cloudflare D1.
              </p>
            </div>
            {telegramUrl ? (
              <a href={telegramUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-3 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200">
                Mở @{botUsername} trên Telegram
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <div className="rounded-xl border border-amber-400/30 bg-amber-300/5 px-4 py-3 text-sm text-amber-200">
                Bot chưa xác thực với Telegram. Hãy cấu hình TELEGRAM_BOT_TOKEN và triển khai lại Render.
              </div>
            )}
            <p className="text-xs text-slate-500">
              Trong Telegram, gửi lệnh <code className="rounded bg-slate-800 px-1.5 py-1 text-slate-300">/start</code> để bắt đầu.
            </p>
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="font-bold">Trạng thái hệ thống</h3>
              <button type="button" onClick={() => void refresh()}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-300 hover:text-cyan-200">
                Làm mới
              </button>
            </div>
            <div className="space-y-4">
              <StatusRow label="Render Web Service" value={loading ? 'Đang kiểm tra' : serviceOnline ? 'Đang hoạt động' : 'Chưa sẵn sàng'} good={serviceOnline} />
              <StatusRow label="Telegram Webhook" value={loading ? 'Đang kiểm tra' : webhookOnline ? 'Đã kết nối' : bot?.status || 'Chưa kết nối'} good={webhookOnline} />
              <StatusRow label="Telegram Bot" value={botUsername ? '@' + botUsername : 'Chưa cấu hình'} good={Boolean(botUsername)} />
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Thời gian chạy</span>
                  <span className="font-medium text-slate-200">{uptime}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Kiểm tra gần nhất</span>
                  <span className="text-right text-xs text-slate-500">{checkedAt || '—'}</span>
                </div>
              </div>
              {error && <p role="alert" className="rounded-lg bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
              {bot?.lastError && <p className="rounded-lg bg-amber-300/10 p-3 text-xs text-amber-100">{bot.lastError}</p>}
              <p className="text-xs leading-5 text-slate-500">
                Trang này chỉ hiển thị trạng thái dịch vụ. Không có ví, số dư mẫu, giao dịch giả lập hoặc thông tin bí mật.
              </p>
            </div>
          </section>
        </section>

        <footer className="border-t border-slate-800 pt-5 text-xs text-slate-500">
          Hendy Bot Platform · Render Web Service · Cloudflare Workers / D1 / R2 · Cloudflare Pages
        </footer>
      </div>
    </main>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm font-semibold">
        <span className={'h-2 w-2 rounded-full ' + (good ? 'bg-emerald-400' : 'bg-amber-400')} />
        {value}
      </span>
    </div>
  );
}
