# Hendy Server Bot — production deployment

This repository runs the Telegram Bot as a Node.js **Render Web Service**. Render receives Telegram webhooks and calls a private Cloudflare Worker for durable state. The Worker owns the **D1** and **R2** bindings. The Telegram Mini App is built and deployed to **Cloudflare Pages**.

## Architecture

- **Render Web Service:** Express API, Telegram webhook receiver, Gemini AI calls, health endpoints and dashboard.
- **Cloudflare Worker:** private authenticated data API; webhook-update idempotency; D1 users, balances, daily rewards, tasks and leaderboard; R2 object uploads.
- **Cloudflare D1:** persistent Telegram user profiles and update state.
- **Cloudflare R2:** uploaded packages, proofs and binary objects.
- **Cloudflare Pages:** public Telegram Mini App.
- **GitHub Actions:** tests/builds on pull requests and deploys Worker + Pages after changes reach main. Render deploys from the connected GitHub main branch.

Render and Cloudflare are separate runtimes. The Render process must call the Worker over HTTPS; it cannot use Cloudflare D1/R2 bindings directly. Do not point Telegram webhooks at the Pages hostname.

## 1. Rotate exposed credentials first

The previous `.env.example` contained values that looked like a real Telegram token and encryption secret. Treat any real BotFather token or secret ever committed to Git as compromised.

1. Use BotFather to revoke the old token and issue a new `TELEGRAM_BOT_TOKEN`.
2. Generate a fresh webhook secret containing only letters, digits, underscore or hyphen (example: `openssl rand -hex 32`).
3. Generate unique random values for `HENDY_INTERNAL_API_TOKEN` and `ADMIN_API_TOKEN`.
4. Never commit `.env`, Render secrets, Cloudflare API tokens or Telegram tokens.

Editing the current file does not erase earlier Git commits. If the old token was real, rotate it even if the repository's latest revision has been cleaned.

## 2. Provision Cloudflare D1 and R2 once

Install Node.js 24, then authenticate:

```bash
npm install
npx wrangler login
```

Create resources:

```bash
npx wrangler d1 create hendy-bot-data
npx wrangler r2 bucket create hendy-bot-assets
```

Copy the D1 UUID from the command output into `wrangler.toml`, replacing `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`. Keep database name `hendy-bot-data` and R2 bucket name `hendy-bot-assets` consistent.

Apply migration and set the internal Worker secret:

```bash
npx wrangler d1 migrations apply hendy-bot-data --remote
npx wrangler secret put HENDY_INTERNAL_API_TOKEN
npx wrangler deploy --config wrangler.toml
```

Save the deployed Worker URL, normally `https://hendy-bot-data.<account-subdomain>.workers.dev`. Verify `GET <worker-url>/healthz` returns HTTP 200.

The Worker exposes only `/healthz` publicly. All `/internal/*` routes require a Bearer token and must never be called from browser JavaScript.

## 3. Add GitHub Actions secrets

In **GitHub → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers Scripts edit, D1 edit, R2 edit and Cloudflare Pages edit permissions on the target account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 UUID created above |
| `HENDY_INTERNAL_API_TOKEN` | Same random value used by `wrangler secret put` |
| `RENDER_PUBLIC_URL` | Public Render service URL, e.g. `https://hendy-server-bot.onrender.com` |

The workflow applies D1 migrations, refreshes the Worker secret, deploys the Worker, builds the Mini App against Render's URL and publishes Pages.

Create the Pages project once (if it does not already exist):

```bash
npx wrangler pages project create hendy-bot-mini-app --production-branch main
```

Use the GitHub Actions workflow as its deployment owner; avoid enabling a second independent build that races with the workflow.

## 4. Deploy the Render Web Service from GitHub

1. Open Render Dashboard → **New → Blueprint**.
2. Connect GitHub and select `ngogiaidy56-eng/hendy-server-bot`.
3. Choose the `main` branch and the repository's `render.yaml`.
4. Confirm the service named `hendy-server-bot` in Singapore. The Blueprint uses the Starter plan because a webhook receiver should not depend on free-service sleep; Starter is a paid plan.
5. Set these service environment values and deploy.

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | New token issued by BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | New random secret (letters, digits, underscore, hyphen only) |
| `CLOUDFLARE_DATA_API_URL` | Deployed Data Worker URL |
| `CLOUDFLARE_DATA_API_TOKEN` | Same value as `HENDY_INTERNAL_API_TOKEN` |
| `ADMIN_API_TOKEN` | Separate random admin API token |
| `MINI_APP_URL` | Pages URL, e.g. `https://hendy-bot-mini-app.pages.dev` |
| `CORS_ALLOWED_ORIGINS` | Pages origin only, e.g. `https://hendy-bot-mini-app.pages.dev` |
| `GEMINI_API_KEY` | Optional Google AI Studio key for `/ask` and Mini App AI chat |
| `GEMINI_MODEL` | `gemini-3.8-flash` |

Set `WEBHOOK_BASE_URL` only if Render's `RENDER_EXTERNAL_URL` is not available. It must be the Render service's public HTTPS URL. The bot registers commands and configures `setWebhook` on startup with the configured secret token.

Do not set a fixed `PORT`. Render injects the port; the application binds to `0.0.0.0`.

## 5. Live menu, environment discovery and WebSocket

The Telegram Mini App opens on the 14-button menu shown in the reference image. The menu layout, label, enabled state, color variant (`orange`, `cyan`, `green`), row width and destination URL are stored in D1 table `app_settings` under key `menu`.

After the `0002_menu_config.sql` migration has been applied:

- Open the Render service root URL to reach **Hendy Bot Control Center**.
- Enter `ADMIN_API_TOKEN` in the password field. It is used in memory for admin requests and is not written to local storage.
- The Config Center checks Render's own runtime variables, probes the Cloudflare Data Worker health endpoint for D1/R2 connectivity and lists the exact GitHub/Cloudflare settings pages for secrets it cannot inspect.
- Edit button labels, links, colors, layout, visibility or in-app tab targets, then choose **Lưu & đồng bộ menu**.
- The menu is saved to D1 and broadcast immediately to connected Mini Apps.

WebSocket channels:

| Channel | Access | Events |
|---|---|---|
| `/ws/menu` | Public, sanitized menu only | `menu:config` |
| `/ws/config` | Requires a one-use ticket from `POST /api/config/ws-ticket` | `config:status`, `menu:config` |

The admin WebSocket ticket is short-lived and consumed once. Do not add `ADMIN_API_TOKEN`, BotFather tokens or Worker secrets to the URL or browser bundle. The Mini App menu link accepts only HTTPS or Telegram `tg://` destinations; an unset URL shows a clear “chưa cấu hình” message rather than navigating to a fake page.

The service can verify Render environment variable presence because those values are available to its own process. It deliberately marks GitHub Actions and Cloudflare Worker secret presence as **unverified**: those secret stores do not expose list/read operations to this Render process. Use the links in the Config Center to update those values, then rerun the GitHub deploy workflow or restart Render as appropriate.

## 6. Local development

```bash
cp .env.example .env
# Fill local development values; do not commit .env
npm install
npm run dev
```

The local Express server uses Vite middleware. In development, the simulator can be used without a real bot token. Production does not report a simulated send as a real delivery.

For a full local Cloudflare integration, set `CLOUDFLARE_DATA_API_URL` and `CLOUDFLARE_DATA_API_TOKEN` to use the deployed Worker. Keep development accounts and balances separate from production.

## 7. Verification and operations

After deployment, verify:

- `GET https://<render-service>/healthz` returns HTTP 200.
- `GET https://<render-service>/readyz` returns `status: ready` and Telegram status becomes `active`.
- `GET <worker-url>/healthz` returns HTTP 200 and reports D1 connected.
- In Telegram, send `/start`, then `/profile` and `/daily`. A second `/daily` claim on the same UTC day must not credit another reward.
- Open the Pages Mini App from Telegram. Requests for user-specific data include Telegram signed `initData`.
- GitHub Actions shows both CI and the Cloudflare deployment workflow successful.

Useful endpoints:

| Endpoint | Purpose |
|---|---|
| `/healthz` | Render liveness check |
| `/readyz` | Configuration and Telegram readiness diagnostics |
| `/api/health` | Backward-compatible API health |
| `/api/bot/status` | Bot startup status |
| `/api/menu/config` | Public sanitized menu configuration |
| `/api/config/status` | Admin-only environment discovery and Worker health |
| `/api/config/ws-ticket` | Admin-only one-use WebSocket ticket |
| `/ws/menu` | Public live menu updates |
| `/ws/config` | Admin-only configuration updates using one-use ticket |
| `/api/bot/webhook` | Telegram webhook receiver (secret header required) |
| `/internal/storage/stats` | Private D1/R2 statistics (Worker Bearer token required) |

Store mutations under `/api/store/*` require `Authorization: Bearer <ADMIN_API_TOKEN>`. Never embed this token in frontend code.

## 8. Deployment notes and known boundaries

- A push to `main` triggers Render auto-deploy through the GitHub connection and the Cloudflare Worker/Pages workflow.
- Pull requests run CI only; production secrets are not needed by test jobs.
- D1 migrations `0001_bot_runtime.sql` and `0002_menu_config.sql` add Telegram runtime and live menu configuration tables without deleting the legacy store schema.
- R2 object upload is available through private Worker `PUT /internal/r2/object`, with keys under `uploads/`, `packages/` or `proofs/`, up to 25 MB.
- The internal Worker token is shared between Render and Cloudflare. Store it only in GitHub Actions, Render and Worker secret stores.
- The included task reward list is server-side allow-listed and each task may be claimed once per account. Social task completion still needs a provider-specific membership verification policy before real token or cash-equivalent payouts.
- Legacy storefront routes under `/api/store/*` still rely on in-memory orders, deposits, gift codes and product records. They are deliberately disabled in production (except the live D1/R2 statistics route) until their commerce tables, payment verification and idempotent ledger transactions are migrated to D1. Do not enable them for real-money or redeemable balance operations in this release.
- A passing CI build does not prove a service is live. Confirm Render's latest deploy is live and run the smoke tests above.
