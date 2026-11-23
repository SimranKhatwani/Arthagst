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

export default sendResponse;
