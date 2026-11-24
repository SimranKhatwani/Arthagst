/**
 * Recursively mutate objects in-place to strip MongoDB query operator keys ($ and .)
 * Works seamlessly with Express 5 where req.query has only a getter.
 */
const sanitizeInPlace = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (item && typeof item === 'object') {
        sanitizeInPlace(item);
      }
    });
    return;
  }

  for (const key of Object.keys(obj)) {
    // Strip keys starting with '$' or containing '.'
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object') {
      sanitizeInPlace(obj[key]);
    }
  }
};

/**
 * Express middleware to sanitize all incoming request parameters, query, and body in place
 */
export const sanitizeMiddleware = (req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      sanitizeInPlace(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeInPlace(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      sanitizeInPlace(req.params);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default sanitizeMiddleware;
