/**
 * Crypto Service
 * Provides cryptographic primitives: AES-256-GCM encryption/decryption,
 * HMAC-SHA256 signature verification, and secure token generation.
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for AES-GCM
const AUTH_TAG_LENGTH = 16;
const DEFAULT_KEY_SALT = 'hendy_tele_bot_crypto_salt_2026';

/**
 * Derive a 32-byte key from a secret string using scrypt.
 * @param {string} secret
 * @returns {Buffer}
 */
export function deriveKey(secret = process.env.ENCRYPTION_SECRET || 'fallback-secret-hendy-key-123456') {
  return crypto.scryptSync(secret, DEFAULT_KEY_SALT, 32);
}

/**
 * Encrypts plain text using AES-256-GCM.
 * @param {string} text - Plain text to encrypt
 * @param {string} [customSecret] - Optional custom secret key
 * @returns {string} - Encrypted string formatted as iv:authTag:ciphertext in hex
 */
export function encrypt(text, customSecret) {
  if (typeof text !== 'string') {
    throw new TypeError('Text to encrypt must be a string');
  }

  const key = deriveKey(customSecret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a formatted cipher text using AES-256-GCM.
 * @param {string} encryptedPayload - String formatted as iv:authTag:ciphertext in hex
 * @param {string} [customSecret] - Optional custom secret key
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedPayload, customSecret) {
  if (typeof encryptedPayload !== 'string') {
    throw new TypeError('Encrypted payload must be a string');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, cipherText] = parts;
  const key = deriveKey(customSecret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Corrupted IV or authentication tag');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Computes HMAC-SHA256 hex digest for given data and key.
 * @param {string|Buffer} key
 * @param {string} data
 * @returns {string} Hex string
 */
export function computeHmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Generates a cryptographically secure random token (hex).
 * @param {number} bytes
 * @returns {string}
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
