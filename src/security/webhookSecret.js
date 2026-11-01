import crypto from 'node:crypto';

/** Constant-time comparison for webhook and internal API secrets. */
export function constantTimeEqual(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !actual || !expected) {
    return false;
  }
  const actualHash = crypto.createHash('sha256').update(actual).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash) && actual.length === expected.length;
}
