import test from "node:test";
import assert from "node:assert/strict";
import { createAdminWsTicket } from "./configRealtime.js";

test("admin WebSocket tickets are random, short lived capabilities", () => {
  const first = createAdminWsTicket();
  const second = createAdminWsTicket();
  assert.equal(typeof first.ticket, "string");
  assert.ok(first.ticket.length >= 40);
  assert.notEqual(first.ticket, second.ticket);
  assert.equal(first.expiresInSeconds, 60);
});
