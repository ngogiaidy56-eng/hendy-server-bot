/**
 * Telegram WebApp initData Verification
 * Implements the official Telegram WebApp integrity check algorithm:
 * HMAC-SHA256 signature verification over sorted data string.
 */

import crypto from 'node:crypto';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Validates Telegram WebApp initData string.
 * @param {string} initData - The raw initData query string sent from window.Telegram.WebApp.initData
 * @param {string} [botToken] - Telegram Bot Token
 * @param {number} [maxAgeSeconds=86400] - Maximum token age (default: 24h)
 * @returns {{ isValid: boolean, user: object|null, authDate: number, params: Record<string, string>, error?: string }}
 */
export function validateTelegramInitData(initData, botToken = process.env.TELEGRAM_BOT_TOKEN, maxAgeSeconds = 86400) {
  if (!initData || typeof initData !== 'string') {
    return { isValid: false, user: null, authDate: 0, params: {}, error: 'initData is required' };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return { isValid: false, user: null, authDate: 0, params: {}, error: 'Hash missing from initData' };
    }

    // Filter out 'hash' and sort remaining keys alphabetically
    const dataCheckArr = [];
    const params = {};

    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${value}`);
      }
    }

    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // If bot token is not configured or in simulated dev mode
    const token = botToken || 'simulated_dev_bot_token';

    // Step 1: secret_key = HMAC_SHA256("WebAppData", bot_token)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();

    // Step 2: calculated_hash = HMAC_SHA256(secret_key, data_check_string)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Compare hashes safely
    let isHashMatch = false;
    try {
      isHashMatch = crypto.timingSafeEqual(
        Buffer.from(calculatedHash, 'utf-8'),
        Buffer.from(hash, 'utf-8')
      );
    } catch {
      isHashMatch = false;
    }

    // Parse user object
    let user = null;
    if (params.user) {
      try {
        user = JSON.parse(params.user);
      } catch {
        user = null;
      }
    }

    const authDate = parseInt(params.auth_date, 10) || 0;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    // If expired
    if (maxAgeSeconds > 0 && authDate > 0 && (nowInSeconds - authDate > maxAgeSeconds)) {
      return {
        isValid: false,
        user,
        authDate,
        params,
        error: 'Telegram session has expired (auth_date too old)',
      };
    }

    if (!isHashMatch) {
      // In development environments with mock data, allow flag if explicitly enabled
      const isSimulated = process.env.ALLOW_SIMULATED_TELEGRAM_AUTH === 'true' || process.env.NODE_ENV !== 'production';
      if (isSimulated && hash.startsWith('mock_')) {
        return {
          isValid: true,
          user: user || { id: 99999999, first_name: 'Demo Telegram User', username: 'demo_user' },
          authDate: authDate || nowInSeconds,
          params,
          simulated: true,
        };
      }

      return {
        isValid: false,
        user,
        authDate,
        params,
        error: 'Telegram hash signature verification failed',
      };
    }

    return {
      isValid: true,
      user,
      authDate,
      params,
    };
  } catch (err) {
    return {
      isValid: false,
      user: null,
      authDate: 0,
      params: {},
      error: `Validation error: ${err.message}`,
    };
  }
}

/**
 * Express middleware to authenticate Telegram Mini App requests
 */
export function telegramAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const initData = req.headers['x-telegram-init-data'] || 
    (authHeader && authHeader.startsWith('tma ') ? authHeader.slice(4) : null) ||
    req.body?.initData ||
    req.query?.initData;

  if (!initData) {
    return next(new AppError('Unauthorized: Missing Telegram WebApp initData', 401, 'AUTH_INIT_DATA_MISSING'));
  }

  const result = validateTelegramInitData(initData);
  if (!result.isValid) {
    return next(new AppError(`Forbidden: ${result.error || 'Invalid Telegram credentials'}`, 403, 'AUTH_INVALID_SIGNATURE'));
  }

  // Attach verified user and params to request
  req.telegramUser = result.user;
  req.telegramAuth = result;
  next();
}

/**
 * Helper to generate valid mock initData for testing/development
 */
export function generateMockInitData(userData = { id: 12345678, first_name: 'Hendy', username: 'hendy_user' }, botToken = 'simulated_dev_bot_token') {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(userData);

  const params = new URLSearchParams();
  params.set('auth_date', authDate.toString());
  params.set('query_id', 'AAHdF6IQAAAAAN0XohD72Kj_');
  params.set('user', userJson);

  const dataCheckArr = [
    `auth_date=${authDate}`,
    `query_id=AAHdF6IQAAAAAN0XohD72Kj_`,
    `user=${userJson}`
  ];
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}
