import logger from '../utils/logger.js';

/**
 * Middleware to validate JSON body
 * Catches malformed JSON before it reaches route handlers
 */
export const validateJson = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn(`Invalid JSON received: ${err.message}`, {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains malformed JSON',
      details: err.message
    });
  }
  next(err);
};

/**
 * Validate required parameters
 */
export const validateRequired = (params) => {
  return (req, res, next) => {
    const missing = [];
    const source = req.method === 'GET' ? req.query : req.body;
    
    for (const param of params) {
      if (source[param] === undefined || source[param] === null || source[param] === '') {
        missing.push(param);
      }
    }
    
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: `The following parameters are required: ${missing.join(', ')}`,
        missing
      });
    }
    
    next();
  };
};

/**
 * Validate integer parameter
 */
export const validateInteger = (paramName, source = 'params', options = {}) => {
  return (req, res, next) => {
    const value = req[source][paramName];
    
    if (value === undefined || value === null) {
      if (options.optional) {
        return next();
      }
      return res.status(400).json({
        error: 'Missing parameter',
        message: `Parameter '${paramName}' is required`,
        parameter: paramName
      });
    }
    
    const parsed = parseInt(value);
    
    if (isNaN(parsed)) {
      return res.status(400).json({
        error: 'Invalid parameter type',
        message: `Parameter '${paramName}' must be an integer`,
        parameter: paramName,
        received: value
      });
    }
    
    if (options.min !== undefined && parsed < options.min) {
      return res.status(400).json({
        error: 'Parameter out of range',
        message: `Parameter '${paramName}' must be at least ${options.min}`,
        parameter: paramName,
        received: parsed,
        min: options.min
      });
    }
    
    if (options.max !== undefined && parsed > options.max) {
      return res.status(400).json({
        error: 'Parameter out of range',
        message: `Parameter '${paramName}' must be at most ${options.max}`,
        parameter: paramName,
        received: parsed,
        max: options.max
      });
    }
    
    // Store validated value
    req[source][paramName] = parsed;
    next();
  };
};

/**
 * Validate enum parameter
 */
export const validateEnum = (paramName, allowedValues, source = 'query', options = {}) => {
  return (req, res, next) => {
    const value = req[source][paramName];
    
    if (value === undefined || value === null || value === '') {
      if (options.optional) {
        return next();
      }
      return res.status(400).json({
        error: 'Missing parameter',
        message: `Parameter '${paramName}' is required`,
        parameter: paramName,
        allowedValues
      });
    }
    
    if (!allowedValues.includes(value)) {
      return res.status(400).json({
        error: 'Invalid parameter value',
        message: `Parameter '${paramName}' must be one of: ${allowedValues.join(', ')}`,
        parameter: paramName,
        received: value,
        allowedValues
      });
    }
    
    next();
  };
};

/**
 * Validate broadcast day format (YYYYMMDD)
 */
export const validateBroadcastDay = (paramName = 'day', source = 'params') => {
  return (req, res, next) => {
    const value = req[source][paramName];
    
    if (!value) {
      return res.status(400).json({
        error: 'Missing parameter',
        message: `Parameter '${paramName}' is required`,
        parameter: paramName,
        format: 'YYYYMMDD'
      });
    }
    
    const parsed = parseInt(value);
    
    if (isNaN(parsed)) {
      return res.status(400).json({
        error: 'Invalid parameter format',
        message: `Parameter '${paramName}' must be a valid date in YYYYMMDD format`,
        parameter: paramName,
        received: value,
        format: 'YYYYMMDD',
        example: '20251101'
      });
    }
    
    // Validate YYYYMMDD format
    const dateStr = parsed.toString();
    if (dateStr.length !== 8) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: `Parameter '${paramName}' must be 8 digits in YYYYMMDD format`,
        parameter: paramName,
        received: value,
        format: 'YYYYMMDD',
        example: '20251101'
      });
    }
    
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));
    
    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Year must be between 2000 and 2100',
        parameter: paramName,
        received: value
      });
    }
    
    if (month < 1 || month > 12) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Month must be between 01 and 12',
        parameter: paramName,
        received: value
      });
    }
    
    if (day < 1 || day > 31) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Day must be between 01 and 31',
        parameter: paramName,
        received: value
      });
    }
    
    // Validate actual date
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Date does not exist in calendar',
        parameter: paramName,
        received: value,
        example: '20251101'
      });
    }
    
    req[source][paramName] = parsed;
    next();
  };
};

/**
 * Validate program key format
 */
export const validateProgramKey = (paramName = 'programKey', source = 'params') => {
  return (req, res, next) => {
    const value = req[source][paramName];
    
    if (!value) {
      return res.status(400).json({
        error: 'Missing parameter',
        message: `Parameter '${paramName}' is required`,
        parameter: paramName
      });
    }
    
    // Program keys are typically uppercase alphanumeric, 3-10 characters
    if (!/^[A-Z0-9]{2,10}$/i.test(value)) {
      return res.status(400).json({
        error: 'Invalid program key format',
        message: `Parameter '${paramName}' must be 2-10 alphanumeric characters`,
        parameter: paramName,
        received: value,
        example: '4SLF'
      });
    }
    
    next();
  };
};

/**
 * Validate search query
 */
export const validateSearchQuery = (req, res, next) => {
  const { q, type, limit, offset } = req.query;
  
  // Query is required
  if (!q || q.trim() === '') {
    return res.status(400).json({
      error: 'Missing search query',
      message: 'Parameter "q" is required and cannot be empty',
      parameter: 'q'
    });
  }
  
  // Query length limits
  if (q.length < 2) {
    return res.status(400).json({
      error: 'Search query too short',
      message: 'Search query must be at least 2 characters',
      parameter: 'q',
      received: q
    });
  }
  
  if (q.length > 200) {
    return res.status(400).json({
      error: 'Search query too long',
      message: 'Search query must be at most 200 characters',
      parameter: 'q',
      received: q.substring(0, 50) + '...'
    });
  }
  
  // Validate type if provided
  if (type && !['broadcasts', 'items', 'all'].includes(type)) {
    return res.status(400).json({
      error: 'Invalid search type',
      message: 'Parameter "type" must be one of: broadcasts, items, all',
      parameter: 'type',
      received: type,
      allowedValues: ['broadcasts', 'items', 'all']
    });
  }
  
  // Validate limit if provided
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        error: 'Invalid limit',
        message: 'Parameter "limit" must be between 1 and 100',
        parameter: 'limit',
        received: limit
      });
    }
    req.query.limit = parsedLimit;
  }
  
  // Validate offset if provided
  if (offset !== undefined) {
    const parsedOffset = parseInt(offset);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        error: 'Invalid offset',
        message: 'Parameter "offset" must be 0 or greater',
        parameter: 'offset',
        received: offset
      });
    }
    req.query.offset = parsedOffset;
  }
  
  next();
};

/**
 * Validate image hash format (SHA-256)
 */
export const validateImageHash = (req, res, next) => {
  const { hash } = req.params;
  
  if (!hash) {
    return res.status(400).json({
      error: 'Missing parameter',
      message: 'Image hash is required',
      parameter: 'hash'
    });
  }
  
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    return res.status(400).json({
      error: 'Invalid hash format',
      message: 'Image hash must be a valid SHA-256 hash (64 hexadecimal characters)',
      parameter: 'hash',
      received: hash,
      format: 'SHA-256 (64 hex characters)'
    });
  }
  
  next();
};

/**
 * Async error wrapper - catches async errors and passes to error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
