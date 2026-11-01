import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, computeHmacSha256, generateRandomToken } from './cryptoService.js';

test('cryptoService: encrypt and decrypt round trip correctly', () => {
  const secretMessage = 'Hello Telegram Mini App user 12345';
  const encrypted = encrypt(secretMessage);

  assert.notEqual(encrypted, secretMessage);
  assert.equal(encrypted.split(':').length, 3);

  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, secretMessage);
});

test('cryptoService: encrypt with custom secret', () => {
  const text = 'HendyBotSuperSecretData';
  const customKey = 'custom-user-secret-phrase-key';
  const encrypted = encrypt(text, customKey);
  const decrypted = decrypt(encrypted, customKey);

  assert.equal(decrypted, text);

  // Decryption with wrong secret should fail
  assert.throws(() => {
    decrypt(encrypted, 'wrong-secret-key-phrase');
  });
});

test('cryptoService: computeHmacSha256 produces valid 64-char hex digest', () => {
  const hmac = computeHmacSha256('secret-bot-token', 'data-to-sign');
  assert.equal(typeof hmac, 'string');
  assert.equal(hmac.length, 64);
});

test('cryptoService: generateRandomToken returns unique random hex tokens', () => {
  const token1 = generateRandomToken(16);
  const token2 = generateRandomToken(16);
  assert.equal(token1.length, 32); // 16 bytes = 32 hex chars
  assert.notEqual(token1, token2);
});
