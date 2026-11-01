import test from 'node:test';
import assert from 'node:assert/strict';
import { processMessage } from './botController.js';

test('botController: /start initializes user and returns welcome message with Mini App', async () => {
  const fromUser = { id: 91929394, first_name: 'Minh', username: 'minh_dev' };
  const res = await processMessage('/start', fromUser, 91929394);

  assert.equal(res.type, 'start');
  assert.match(res.replyText, /Chào mừng Minh/);
  assert.match(res.replyText, /Hendy Bot/);
});

test('botController: /profile returns accurate user information', async () => {
  const fromUser = { id: 91929394, first_name: 'Minh', username: 'minh_dev' };
  const res = await processMessage('/profile', fromUser, 91929394);

  assert.equal(res.type, 'profile');
  assert.match(res.replyText, /Hồ sơ Hendy/);
  assert.match(res.replyText, /91929394/);
});

test('botController: /help lists bot commands', async () => {
  const fromUser = { id: 91929394, first_name: 'Minh' };
  const res = await processMessage('/help', fromUser, 91929394);

  assert.equal(res.type, 'help');
  assert.match(res.replyText, /\/start/);
  assert.match(res.replyText, /\/miniapp/);
  assert.match(res.replyText, /\/ask/);
});

test('botController: /menu opens the configurable Mini App menu', async () => {
  const fromUser = { id: 92939495, first_name: 'MenuTester', username: 'menu_tester' };
  const res = await processMessage('/menu', fromUser, fromUser.id);

  assert.equal(res.type, 'miniapp');
  assert.match(res.replyText, /Mini App/);
  assert.ok(res.result?.simulated || res.result?.ok);
});
