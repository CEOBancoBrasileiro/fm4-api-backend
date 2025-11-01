import logger from '../utils/logger.js';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Global error handler middleware
 * Must be the last middleware added to the app
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`Error handling ${req.method} ${req.path}:`, {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Handle known API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.message,
      details: err.details,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Handle database errors
  if (err.message && err.message.includes('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Handle axios/network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Unable to connect to external service',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Default to 500 internal server error
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/**
 * 404 handler
 */
export const notFoundHandler = (req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(404).json({
    error: 'Not found',
    message: `The endpoint ${req.method} ${req.path} does not exist`,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      api: '/api/*',
      documentation: '/api-docs',
      health: '/health'
    }
  });
};
