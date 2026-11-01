import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTelegramInitData, generateMockInitData } from './telegramAuth.js';

test('telegramAuth: generates and validates valid HMAC signed initData', () => {
  const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const mockUser = { id: 87654321, first_name: 'Alex', username: 'alex_test' };
  const initData = generateMockInitData(mockUser, token);

  const result = validateTelegramInitData(initData, token);

  assert.equal(result.isValid, true);
  assert.ok(result.user);
  assert.equal(result.user.id, 87654321);
  assert.equal(result.user.first_name, 'Alex');
});

test('telegramAuth: rejects tampered initData', () => {
  const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const mockUser = { id: 87654321, first_name: 'Alex', username: 'alex_test' };
  const initData = generateMockInitData(mockUser, token);

  // Tamper with username in query string
  const tampered = initData.replace('alex_test', 'hacker_user');
  const result = validateTelegramInitData(tampered, token);

  assert.equal(result.isValid, false);
  assert.match(result.error || '', /signature/i);
});

test('telegramAuth: rejects missing or empty initData', () => {
  const result = validateTelegramInitData('');
  assert.equal(result.isValid, false);
  assert.equal(result.error, 'initData is required');
});

test('telegramAuth: production rejects mock fallback when bot token is absent', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.TELEGRAM_BOT_TOKEN;
    const signedWithPublicDevKey = generateMockInitData(
      { id: 456789, first_name: 'Untrusted' },
      'simulated_dev_bot_token'
    );
    const result = validateTelegramInitData(signedWithPublicDevKey);
    assert.equal(result.isValid, false);
    assert.match(result.error || '', /Bot Token is not configured/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  }
});
