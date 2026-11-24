import { ZodError } from 'zod';

/**
 * Centralized error handling middleware
 * Gracefully handles Mongoose CastError, ValidationError, MongoServerError (11000 duplicate key),
 * ZodError, JsonWebTokenError, TokenExpiredError, and standard exceptions.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // 1. Mongoose CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier format for '${err.path}': ${err.value}`;
  }

  // 2. Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // 3. MongoDB 11000 Duplicate Key Error
  else if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'Field';
    message = `Duplicate key error: A record with this '${duplicatedField}' already exists.`;
  }

  // 4. Zod Validation Error
  else if (err instanceof ZodError || err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation failed';
    const issues = err.issues || err.errors || [];
    errors = issues.map((e) => ({
      field: e.path ? e.path.join('.') : 'root',
      message: e.message,
    }));
  }

  // 5. JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
  }

  const response = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', err);
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
