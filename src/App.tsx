import { useCallback, useEffect, useRef, useState } from 'react';

type MenuButton = {
  id: string;
  label: string;
  variant: 'orange' | 'cyan' | 'green';
  layout: 'half' | 'full';
  enabled: boolean;
  href: string;
  tab: string;
};
type MenuConfig = {
  version: number;
  theme?: { background?: string; radius?: string };
  buttons: MenuButton[];
  updatedAt?: string;
};
type ConfigVariable = {
  name: string;
  required: boolean;
  status: 'configured' | 'missing' | 'optional' | 'unverified';
  purpose: string;
};
type Provider = {
  id: string;
  title: string;
  destination: string;
  url: string;
  description: string;
  variables?: ConfigVariable[];
  status?: string;
  message?: string;
};
type ConfigStatus = {
  ready: boolean;
  checkedAt: string;
  summary: { renderMissing: number; githubUnverified: number; dataWorker: string };
  providers: Provider[];
};
type BotStatus = {
  status?: string;
  webhookConfigured?: boolean;
  botInfo?: { username?: string; first_name?: string } | null;
  lastError?: string | null;
};

const variantClasses: Record<MenuButton['variant'], string> = {
  orange: 'bg-[#d07859] hover:bg-[#e18a68] border-[#eea183]/40',
  cyan: 'bg-[#269eb5] hover:bg-[#35b0c7] border-[#61d2df]/40',
  green: 'bg-[#41945d] hover:bg-[#50a86d] border-[#79c58d]/40',
};

const formatStatus = (status?: string) => ({
  configured: 'Đã khai báo',
  missing: 'Còn thiếu',
  optional: 'Không bắt buộc',
  unverified: 'Chưa thể tự xác minh',
  connected: 'Đã kết nối',
  error: 'Có lỗi',
  not_configured: 'Chưa cấu hình',
  url_configured: 'Đã khai báo URL',
  missing_url: 'Thiếu URL',
}[status || ''] || status || 'Chưa xác định');

export default function App() {
  const [health, setHealth] = useState<{ status?: string; uptimeSeconds?: number } | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [menuConfig, setMenuConfig] = useState<MenuConfig | null>(null);
  const [adminConnected, setAdminConnected] = useState(false);
  const [wsState, setWsState] = useState('Chưa kết nối');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkedAt, setCheckedAt] = useState('');
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);

  const refreshHealth = useCallback(async () => {
    try {
      const [healthResponse, botResponse] = await Promise.all([
        fetch('/healthz', { cache: 'no-store' }),
        fetch('/api/bot/status', { cache: 'no-store' }),
      ]);
      if (!healthResponse.ok) throw new Error('Health check HTTP ' + healthResponse.status);
      if (!botResponse.ok) throw new Error('Telegram status HTTP ' + botResponse.status);
      const healthData = await healthResponse.json();
      const botData = await botResponse.json();
      setHealth(healthData);
      setBot(botData.data || null);
      setCheckedAt(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được trạng thái dịch vụ.');
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const timer = window.setInterval(() => void refreshHealth(), 30000);
    return () => {
      window.clearInterval(timer);
      socketRef.current?.close();
    };
  }, [refreshHealth]);

  const adminRequest = useCallback(async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: 'Bearer ' + adminToken,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error?.message || 'Request failed with HTTP ' + response.status);
    }
    return payload.data;
  }, [adminToken]);

  const connectAdmin = async () => {
    if (!adminToken.trim()) {
      setError('Nhập ADMIN_API_TOKEN đã khai báo trong Render để mở bảng quản trị.');
      return;
    }
    setLoading(true);
    setError('');
    socketRef.current?.close();

    try {
      const [status, menu, ticketData] = await Promise.all([
        adminRequest('/api/config/status'),
        adminRequest('/api/menu/config'),
        adminRequest('/api/config/ws-ticket', { method: 'POST' }),
      ]);
      setConfigStatus(status);
      setMenuConfig(menu);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(
        protocol + '//' + window.location.host + '/ws/config?ticket=' + encodeURIComponent(ticketData.ticket)
      );
      socketRef.current = socket;
      socket.onopen = () => {
        setAdminConnected(true);
        setWsState('WebSocket đang hoạt động');
      };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          if (event.type === 'config:status') setConfigStatus(event.payload);
          if (event.type === 'menu:config') setMenuConfig(event.payload);
          if (event.type === 'stream:error') setError(event.payload?.message || 'WebSocket stream error');
        } catch {
          setError('Dữ liệu WebSocket không hợp lệ.');
        }
      };
      socket.onerror = () => setWsState('WebSocket có lỗi');
      socket.onclose = () => {
        setAdminConnected(false);
        setWsState('WebSocket đã ngắt — bấm Kết nối lại');
      };
    } catch (err) {
      setAdminConnected(false);
      setError(err instanceof Error ? err.message : 'Không thể kết nối quản trị.');
    } finally {
      setLoading(false);
    }
  };

  const updateButton = (id: string, patch: Partial<MenuButton>) => {
    setMenuConfig((current) => current ? {
      ...current,
      buttons: current.buttons.map((button) => button.id === id ? { ...button, ...patch } : button),
    } : current);
  };

  const saveMenu = async () => {
    if (!menuConfig) return;
    setSaving(true);
    setError('');
    try {
      const saved = await adminRequest('/api/menu/config', {
        method: 'PUT',
        body: JSON.stringify(menuConfig),
      });
      setMenuConfig(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được menu.');
    } finally {
      setSaving(false);
    }
  };

  const serviceOnline = health?.status === 'ok';
  const webhookOnline = bot?.webhookConfigured === true && bot?.status === 'active';
  const botUsername = bot?.botInfo?.username;
  const uptime = health?.uptimeSeconds
    ? Math.floor(health.uptimeSeconds / 3600) + ' giờ ' +
      Math.floor((health.uptimeSeconds % 3600) / 60) + ' phút'
    : '—';

  return (
    <main className="min-h-screen bg-[#081722] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-7">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-xl font-black text-cyan-300">H</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Hendy Services</p>
              <h1 className="text-xl font-bold sm:text-2xl">Telegram Bot Control Center</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusPill good={serviceOnline} label={serviceOnline ? 'Render Online' : 'Render chưa sẵn sàng'} />
            <StatusPill good={webhookOnline} label={webhookOnline ? 'Telegram Webhook Live' : 'Telegram Webhook'} />
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <InfoCard title="Render Web Service" value={serviceOnline ? 'Đang hoạt động' : 'Chưa sẵn sàng'} detail={'Uptime: ' + uptime} good={serviceOnline} />
          <InfoCard title="Telegram Bot" value={botUsername ? '@' + botUsername : 'Chưa kết nối'} detail={bot?.status || 'Đang chờ cấu hình'} good={Boolean(botUsername)} />
          <InfoCard title="WebSocket" value={wsState} detail={'Kiểm tra dịch vụ: ' + (checkedAt || '—')} good={adminConnected} />
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Tự động dò nơi cấu hình biến môi trường</h2>
            <p className="mt-1 text-sm text-slate-400">
              Kết nối bằng ADMIN_API_TOKEN để kiểm tra biến đang có trên Render, kiểm tra Worker/D1/R2 và hiển thị đúng nơi cần khai báo các GitHub Actions secrets.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Nhập ADMIN_API_TOKEN (không được lưu trên trình duyệt)"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400"
            />
            <button onClick={() => void connectAdmin()} disabled={loading}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
              {loading ? 'Đang kết nối…' : adminConnected ? 'Làm mới kết nối' : 'Kết nối quản trị'}
            </button>
          </div>
          {adminConnected && <p className="mt-2 text-xs text-emerald-300">WebSocket đã xác thực bằng vé một lần. Cập nhật cấu hình sẽ được đẩy trực tiếp đến Mini App.</p>}
          {error && <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
        </section>

        {configStatus && (
          <section className="mb-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Bản đồ cấu hình hệ thống</h2>
                <p className="text-sm text-slate-400">Cập nhật trực tiếp qua WebSocket · lần kiểm tra {new Date(configStatus.checkedAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <StatusPill good={configStatus.ready} label={configStatus.ready ? 'Render & Data Worker sẵn sàng' : 'Còn cấu hình thiếu'} />
                <span className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-300">
                  Render thiếu: {configStatus.summary.renderMissing}
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-300">
                  GitHub cần xác minh: {configStatus.summary.githubUnverified}
                </span>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {configStatus.providers.map((provider) => (
                <article key={provider.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-bold">{provider.title}</h3>
                    {provider.status && <StatusPill good={provider.status === 'connected' || provider.status === 'url_configured'} label={formatStatus(provider.status)} />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{provider.description}</p>
                  <p className="mt-3 text-xs font-semibold text-cyan-200">Nơi khai báo: {provider.destination}</p>
                  <a href={provider.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-cyan-300 underline underline-offset-2">Mở trang cấu hình ↗</a>
                  {provider.message && <p className="mt-2 text-xs text-amber-200">{provider.message}</p>}
                  {provider.variables && (
                    <div className="mt-3 space-y-2">
                      {provider.variables.map((variable) => (
                        <div key={variable.name} className="flex flex-wrap items-start justify-between gap-2 border-t border-white/5 pt-2">
                          <div className="min-w-0 flex-1">
                            <code className="break-all text-xs text-slate-200">{variable.name}</code>
                            <p className="text-[11px] text-slate-500">{variable.purpose}</p>
                          </div>
                          <span className={'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ' + (variable.status === 'configured' ? 'bg-emerald-400/10 text-emerald-300' : variable.status === 'missing' ? 'bg-rose-400/10 text-rose-300' : variable.status === 'unverified' ? 'bg-amber-400/10 text-amber-200' : 'bg-slate-700 text-slate-300')}>
                            {formatStatus(variable.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">
              Lưu ý: Render chỉ đọc được biến trong runtime của chính nó. GitHub Secrets và Worker Secrets không cho phép liệt kê từ Render; các mục đó được đánh dấu “Chưa thể tự xác minh” và dẫn đến đúng trang cấu hình, không đoán rằng chúng đã được khai báo.
            </p>
          </section>
        )}

        {menuConfig && (
          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">Xem trước menu Telegram</h2>
                  <p className="text-xs text-slate-400">Bố cục và bảng màu theo ảnh tham chiếu</p>
                </div>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">D1 → WebSocket</span>
              </div>
              <div className="rounded-2xl bg-[#0b5263] p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {menuConfig.buttons.filter((button) => button.enabled).map((button) => (
                    <div key={button.id} className={button.layout === 'full' ? 'col-span-2' : ''}>
                      <div className={'flex min-h-10 items-center justify-center rounded-lg border px-2 py-2 text-center text-[11px] font-bold tracking-wide text-white shadow-sm ' + variantClasses[button.variant]}>
                        {button.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Mục tiêu liên kết trống vẫn hiển thị trong menu; Mini App sẽ báo chưa cấu hình khi người dùng bấm. Điền URL ở bảng chỉnh sửa để kích hoạt đường dẫn.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">Chỉnh sửa nút và màu sắc</h2>
                  <p className="text-xs text-slate-400">Lưu xuống Cloudflare D1, sau đó phát menu:config bằng WebSocket</p>
                </div>
                <button onClick={() => void saveMenu()} disabled={saving}
                  className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
                  {saving ? 'Đang lưu…' : 'Lưu & đồng bộ menu'}
                </button>
              </div>
              <div className="max-h-[700px] space-y-3 overflow-y-auto pr-1">
                {menuConfig.buttons.map((button) => (
                  <div key={button.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <code className="text-[11px] text-cyan-200">{button.id}</code>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" checked={button.enabled} onChange={(event) => updateButton(button.id, { enabled: event.target.checked })} />
                        Hiển thị
                      </label>
                    </div>
                    <input value={button.label} onChange={(event) => updateButton(button.id, { label: event.target.value })}
                      maxLength={64} aria-label={'Nhãn ' + button.id}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
                    <input value={button.href} onChange={(event) => updateButton(button.id, { href: event.target.value })}
                      placeholder="URL HTTPS hoặc tg:// (để trống nếu dùng tab nội bộ)"
                      aria-label={'URL ' + button.id}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs outline-none focus:border-cyan-400" />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <select value={button.variant} onChange={(event) => updateButton(button.id, { variant: event.target.value as MenuButton['variant'] })}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs">
                        <option value="orange">Cam</option>
                        <option value="cyan">Xanh ngọc</option>
                        <option value="green">Xanh lá</option>
                      </select>
                      <select value={button.layout} onChange={(event) => updateButton(button.id, { layout: event.target.value as MenuButton['layout'] })}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs">
                        <option value="half">Nửa dòng</option>
                        <option value="full">Toàn dòng</option>
                      </select>
                      <select value={button.tab} onChange={(event) => updateButton(button.id, { tab: event.target.value })}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs">
                        <option value="">Không chuyển tab</option>
                        <option value="tap">Đào Coin</option>
                        <option value="ai">Hendy AI</option>
                        <option value="tasks">Nhiệm vụ</option>
                        <option value="leaderboard">Bảng vàng</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        <footer className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-500">
          Hendy Bot Control Center · Render WebSocket · Cloudflare Worker / D1 / R2 · Telegram Mini App
        </footer>
      </div>
    </main>
  );
}

function StatusPill({ good, label }: { good: boolean; label: string }) {
  return (
    <span className={'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ' + (good ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200')}>
      <span className={'h-2 w-2 rounded-full ' + (good ? 'bg-emerald-400' : 'bg-amber-300')} />
      {label}
    </span>
  );
}

function InfoCard({ title, value, detail, good }: { title: string; value: string; detail: string; good: boolean }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span className={'h-2 w-2 rounded-full ' + (good ? 'bg-emerald-400' : 'bg-amber-300')} />
        {detail}
      </div>
    </article>
  );
}
