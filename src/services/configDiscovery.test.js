import test from "node:test";
import assert from "node:assert/strict";
import { discoverConfiguration } from "./configDiscovery.js";

test("configuration discovery reports missing Render values without exposing values", async () => {
  const result = await discoverConfiguration({
    env: { NODE_ENV: "production", TELEGRAM_BOT_TOKEN: "sensitive-token" },
    fetchImpl: async () => { throw new Error("should not run"); },
  });
  const render = result.providers.find((provider) => provider.id === "render");
  const token = render.variables.find((item) => item.name === "TELEGRAM_BOT_TOKEN");
  assert.equal(token.status, "configured");
  assert.equal(Object.hasOwn(token, "value"), false);
  assert.ok(result.summary.renderMissing > 0);
  assert.equal(result.providers.find((provider) => provider.id === "github").variables[0].status, "unverified");
});

test("configuration discovery verifies the Worker D1 and R2 health response", async () => {
  const result = await discoverConfiguration({
    env: {
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: "secret",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      CLOUDFLARE_DATA_API_URL: "https://hendy-bot-data.example.workers.dev",
      CLOUDFLARE_DATA_API_TOKEN: "private",
      ADMIN_API_TOKEN: "admin",
      MINI_APP_URL: "https://hendy-bot-mini-app.pages.dev",
    },
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith("/healthz")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { database: "connected", r2: true } }),
        };
      }
      assert.equal(url, "https://hendy-bot-data.example.workers.dev/internal/menu/config/get");
      assert.equal(options.headers.authorization, "Bearer private");
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { buttons: [{ id: "menu" }] } }),
      };
    },
  });
  assert.equal(result.providers.find((provider) => provider.id === "cloudflare").status, "connected");
  const cloudflare = result.providers.find((provider) => provider.id === "cloudflare");
  assert.equal(cloudflare.variables.find((item) => item.name === "HENDY_INTERNAL_API_TOKEN").status, "configured");
  assert.equal(cloudflare.variables.find((item) => item.name === "DB (D1 binding)").status, "configured");
});
