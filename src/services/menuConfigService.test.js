import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultMenuConfig, sanitizeMenuConfig } from "./menuConfigService.js";

test("default menu contains the fourteen reference menu actions", () => {
  const config = getDefaultMenuConfig();
  assert.equal(config.buttons.length, 14);
  assert.equal(config.buttons[0].id, "minigame");
  assert.equal(config.buttons[2].layout, "full");
});

test("menu config rejects unsafe URLs and unsupported colors", () => {
  const config = getDefaultMenuConfig();
  config.buttons[0].href = "javascript:alert(1)";
  assert.throws(() => sanitizeMenuConfig(config), /HTTPS or Telegram/i);

  const changed = getDefaultMenuConfig();
  changed.buttons[0].variant = "arbitrary-css";
  assert.throws(() => sanitizeMenuConfig(changed), /color/i);
});

test("menu config accepts safe label, color and HTTPS destination changes", () => {
  const config = getDefaultMenuConfig();
  config.buttons[0].label = "🚀 LIVE ARENA";
  config.buttons[0].variant = "cyan";
  config.buttons[0].href = "https://example.com/game";
  const safe = sanitizeMenuConfig(config);
  assert.equal(safe.buttons[0].label, "🚀 LIVE ARENA");
  assert.equal(safe.buttons[0].variant, "cyan");
  assert.equal(safe.buttons[0].href, "https://example.com/game");
});
