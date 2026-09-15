/**
 * Authentication middleware
 */
import { verifyToken, getUserById } from '../services/auth.js';
import { logger } from '../utils/logger.js';

export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      const error = new Error('Missing or invalid authorization header');
      error.status = 401;
      throw error;
    }
    
    const payload = verifyToken(token);
    
    if (!payload) {
      const error = new Error('Invalid or expired token');
      error.status = 401;
      throw error;
    }
    
    // Get user details
    const user = await getUserById(payload.userId);
    
    if (!user || user.status !== 'active') {
      const error = new Error('User not found or inactive');
      error.status = 401;
      throw error;
    }
    
    // Attach to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    logger.warn('🚫 Authentication failed', { error: error.message });
    res.status(error.status || 401).json({ error: error.message });
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('🚫 Unauthorized access attempt', {
        userId: req.user.id,
        requiredRole: allowedRoles,
        userRole: req.user.role
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}
