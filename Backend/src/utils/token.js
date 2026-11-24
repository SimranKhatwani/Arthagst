import jwt from 'jsonwebtoken';

/**
 * Generate signed JWT for authenticated user and tenant context
 * @param {Object} payload - { userId, tenantId, role }
 * @returns {string} Signed JWT token
 */
export const generateToken = ({ userId, tenantId, role }) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  return jwt.sign(
    {
      userId: userId ? userId.toString() : null,
      tenantId: tenantId ? tenantId.toString() : null,
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    }
  );
};

/**
 * Verify JWT token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

export default {
  generateToken,
  verifyToken,
};
