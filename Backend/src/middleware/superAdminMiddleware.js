import jwt from 'jsonwebtoken';
import User from '../modules/users/user.model.js';

/**
 * Super Admin Authorization Middleware
 * Verifies that the requesting user is an active Platform Super Administrator.
 * Strictly forbids tenant owners, tenant admins, or unauthenticated clients.
 */
export const requireSuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Malformed authorization token.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token payload.',
      });
    }

    // Fetch user from DB to verify actual current role and privileges
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Administrator account is deactivated.',
      });
    }

    // Verify Super Admin status (never trust solely token payload or client headers)
    const isSuperAdmin = user.isSuperAdmin === true || user.role === 'super_admin';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted to Platform Super Administrators only.',
      });
    }

    req.user = user;
    req.isSuperAdmin = true;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.',
    });
  }
};

export default requireSuperAdmin;
