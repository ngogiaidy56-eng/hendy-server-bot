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

  let dataWorker = {
    status: "not_configured",
    message: "Set CLOUDFLARE_DATA_API_URL and CLOUDFLARE_DATA_API_TOKEN on Render.",
    secretStatus: "missing",
    d1Status: "missing",
    r2Status: "missing"
  };
  if (isSet(env, "CLOUDFLARE_DATA_API_URL") && isSet(env, "CLOUDFLARE_DATA_API_TOKEN")) {
    const base = env.CLOUDFLARE_DATA_API_URL.replace(/\/+$/, "");
    try {
      const healthResponse = await fetchImpl(base + "/healthz", {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      const health = await healthResponse.json().catch(() => ({}));
      const storageReady = healthResponse.ok && health.success &&
        health.data?.database === "connected" && health.data?.r2 === true;
      if (!storageReady) {
        dataWorker = {
          status: "error",
          message: "Worker health check did not confirm both D1 and R2 bindings.",
          secretStatus: "unverified",
          d1Status: health.data?.database === "connected" ? "configured" : "missing",
          r2Status: health.data?.r2 === true ? "configured" : "missing"
        };
      } else {
        const privateResponse = await fetchImpl(base + "/internal/menu/config/get", {
          method: "POST",
          headers: {
            authorization: "Bearer " + env.CLOUDFLARE_DATA_API_TOKEN,
            "content-type": "application/json"
          },
          body: "{}",
          signal: AbortSignal.timeout(5000)
        });
        const privateResult = await privateResponse.json().catch(() => ({}));
        const privateReady = privateResponse.ok && privateResult.success === true &&
          Array.isArray(privateResult.data?.buttons);
        dataWorker = privateReady
          ? {
              status: "connected",
              message: "Worker secret, D1, R2 và bảng cấu hình menu đã được xác minh.",
              secretStatus: "configured",
              d1Status: "configured",
              r2Status: "configured"
            }
          : {
              status: "error",
              message: privateResponse.status === 401
                ? "Worker từ chối Bearer token. Hãy đồng bộ HENDY_INTERNAL_API_TOKEN và CLOUDFLARE_DATA_API_TOKEN."
                : "Worker đã phản hồi nhưng endpoint menu/D1 chưa sẵn sàng. Kiểm tra migration 0002_menu_config.sql.",
              secretStatus: privateResponse.status === 401 ? "missing" : "unverified",
              d1Status: "configured",
              r2Status: "configured"
            };
      }
    } catch (error) {
      dataWorker = {
        status: "error",
        message: "Không kết nối được Data Worker: " + error.message,
        secretStatus: "unverified",
        d1Status: "unverified",
        r2Status: "unverified"
      };
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
        description: "Kiểm tra thực tế Worker Bearer token, D1, R2 và bảng app_settings; không trả giá trị secret về trình duyệt.",
        status: dataWorker.status,
        message: dataWorker.message,
        variables: [
          { name: "HENDY_INTERNAL_API_TOKEN", required: true, purpose: "Worker secret; phải trùng CLOUDFLARE_DATA_API_TOKEN trên Render.", status: dataWorker.secretStatus },
          { name: "DB (D1 binding)", required: true, purpose: "Binding D1 được kiểm tra qua /healthz và API menu.", status: dataWorker.d1Status },
          { name: "ASSETS_BUCKET (R2 binding)", required: true, purpose: "Binding R2 được kiểm tra qua Worker health check.", status: dataWorker.r2Status },
          { name: "app_settings / menu", required: true, purpose: "D1 migration 0002_menu_config.sql phải được áp dụng.", status: dataWorker.status === "connected" ? "configured" : "missing" }
        ],
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
