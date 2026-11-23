/**
 * Standard API response helper
 */
export const sendResponse = (res, statusCode, success, message, data = null) => {
  const response = {
    success,
    message,
    ...(data !== null && { data })
  };
  return res.status(statusCode).json(response);
};

/**
 * Format Zod validation errors cleanly across both Zod v3 and v4
 */
export const formatZodErrors = (error) => {
  const issues = error.issues || error.errors || [];
  return issues.map((e) => ({
    field: e.path ? e.path.join('.') : 'root',
    message: e.message,
  }));
};

export default sendResponse;
