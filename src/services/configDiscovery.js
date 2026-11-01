const RENDER_VARIABLES = [
  { name: "TELEGRAM_BOT_TOKEN", required: true, purpose: "Token do BotFather để bot gọi Telegram Bot API." },
  { name: "TELEGRAM_WEBHOOK_SECRET", required: true, purpose: "Bảo vệ endpoint nhận Telegram webhook." },
  { name: "CLOUDFLARE_DATA_API_URL", required: true, purpose: "URL Worker kết nối D1/R2." },
  { name: "CLOUDFLARE_DATA_API_TOKEN", required: true, purpose: "Bearer token nội bộ giữa Render và Worker." },
  { name: "ADMIN_API_TOKEN", required: true, purpose: "Bảo vệ bảng điều khiển cấu hình." },
  { name: "MINI_APP_URL", required: true, purpose: "Địa chỉ Cloudflare Pages của Telegram Mini App." },
  { name: "CORS_ALLOWED_ORIGINS", required: false, purpose: "Danh sách origin Pages được phép gọi API." },
  { name: "GEMINI_API_KEY", required: false, purpose: "Bật tính năng hỏi đáp Hendy AI." }
];

const GITHUB_SECRETS = [
  { name: "CLOUDFLARE_API_TOKEN", purpose: "Deploy Worker, D1, R2 và Pages." },
  { name: "CLOUDFLARE_ACCOUNT_ID", purpose: "Cloudflare account cho Wrangler." },
  { name: "CLOUDFLARE_D1_DATABASE_ID", purpose: "ID database D1 production." },
  { name: "HENDY_INTERNAL_API_TOKEN", purpose: "Worker secret; phải trùng CLOUDFLARE_DATA_API_TOKEN trên Render." },
  { name: "RENDER_PUBLIC_URL", purpose: "Render API origin được inject lúc build Mini App." }
];

const LOCATION_LINKS = {
  render: "https://dashboard.render.com",
  github: "https://github.com/ngogiaidy56-eng/hendy-server-bot/settings/secrets/actions",
  cloudflare: "https://dash.cloudflare.com"
};

function isSet(env, name) {
  return typeof env[name] === "string" && env[name].trim().length > 0;
}

export async function discoverConfiguration({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const renderVariables = RENDER_VARIABLES.map((item) => ({
    ...item,
    status: isSet(env, item.name) ? "configured" : item.required ? "missing" : "optional",
  }));

  let dataWorker = { status: "not_configured", message: "Set CLOUDFLARE_DATA_API_URL and CLOUDFLARE_DATA_API_TOKEN on Render." };
  if (isSet(env, "CLOUDFLARE_DATA_API_URL") && isSet(env, "CLOUDFLARE_DATA_API_TOKEN")) {
    try {
      const base = env.CLOUDFLARE_DATA_API_URL.replace(/\/+$/, "");
      const response = await fetchImpl(base + "/healthz", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      const result = await response.json().catch(() => ({}));
      dataWorker = response.ok && result.success && result.data?.database === "connected" && result.data?.r2
        ? { status: "connected", message: "Worker, D1 và R2 đang phản hồi." }
        : { status: "error", message: "Worker health check không xác nhận đủ D1/R2.", httpStatus: response.status };
    } catch (error) {
      dataWorker = { status: "error", message: "Không kết nối được Data Worker: " + error.message };
    }
  }

  const missingRequired = renderVariables.filter((item) => item.required && item.status === "missing");
  return {
    checkedAt: new Date().toISOString(),
    environment: env.NODE_ENV || "development",
    ready: missingRequired.length === 0 && dataWorker.status === "connected",
    summary: {
      renderMissing: missingRequired.length,
      githubUnverified: GITHUB_SECRETS.length,
      dataWorker: dataWorker.status,
    },
    providers: [
      {
        id: "render",
        title: "Render Web Service",
        destination: "Dashboard → hendy-server-bot → Environment",
        url: LOCATION_LINKS.render,
        description: "Các biến này được kiểm tra trực tiếp trong môi trường Node.js đang chạy.",
        variables: renderVariables,
      },
      {
        id: "github",
        title: "GitHub Actions Secrets",
        destination: "Repository → Settings → Secrets and variables → Actions",
        url: LOCATION_LINKS.github,
        description: "Render không được phép liệt kê GitHub secrets. CI workflow kiểm tra các secret này khi chạy deploy.",
        variables: GITHUB_SECRETS.map((item) => ({ ...item, required: true, status: "unverified" })),
      },
      {
        id: "cloudflare",
        title: "Cloudflare Worker / D1 / R2",
        destination: "Cloudflare Dashboard → Workers & Pages → hendy-bot-data → Settings → Variables and Secrets",
        url: LOCATION_LINKS.cloudflare,
        description: "Worker health probe kiểm tra D1 và R2 thực tế; secret nội bộ không bao giờ được đọc hoặc trả về trình duyệt.",
        status: dataWorker.status,
        message: dataWorker.message,
      },
      {
        id: "pages",
        title: "Cloudflare Pages",
        destination: "Cloudflare Dashboard → Workers & Pages → hendy-bot-mini-app",
        url: LOCATION_LINKS.cloudflare,
        description: "Mini App được build bằng RENDER_PUBLIC_URL trong GitHub Actions và deploy vào Pages.",
        status: isSet(env, "MINI_APP_URL") ? "url_configured" : "missing_url",
      },
    ],
  };
}
