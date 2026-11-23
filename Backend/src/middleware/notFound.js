/**
 * Middleware to handle unknown routes (404)
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`
  });
};

export default notFound;
