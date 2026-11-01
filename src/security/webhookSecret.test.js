import test from 'node:test';
import assert from 'node:assert/strict';
import { constantTimeEqual } from './webhookSecret.js';

test('constantTimeEqual accepts identical non-empty secrets', () => {
  assert.equal(constantTimeEqual('webhook-secret-123', 'webhook-secret-123'), true);
});

test('constantTimeEqual rejects different, missing, and empty secrets', () => {
  assert.equal(constantTimeEqual('one', 'two'), false);
  assert.equal(constantTimeEqual('', 'secret'), false);
  assert.equal(constantTimeEqual(undefined, 'secret'), false);
});
