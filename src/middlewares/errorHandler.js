/**
 * Centralized Error Handler Middleware
 * Catches all unhandled synchronous and asynchronous errors across the application.
 */

export class AppError extends Error {
  /**
   * @param {string} message - Human readable error description
   * @param {number} statusCode - HTTP status code (default 500)
   * @param {string} [errorCode] - Machine readable code identifier
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  // Log in development or non-operational errors
  if (process.env.NODE_ENV !== 'production' || !err.isOperational) {
    console.error(`[Error Handler] ${req.method} ${req.url} -> [${statusCode}] ${errorCode}: ${message}`);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  });
}
