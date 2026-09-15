import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  registerUser,
  authenticateUser,
  createLearnerProfile,
  getLearnerProfile
} from '../services/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Create new user account and learner profile
 */
router.post('/register', validate('register'), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, age, gradeLevel } = req.body;
  
  // Create user
  const user = await registerUser(email, password, 'learner');
  
  // Create learner profile
  const learnerProfile = await createLearnerProfile(
    user.id,
    firstName || null,
    lastName || null,
    age || null,
    gradeLevel || null
  );
  
  logger.info('✅ Registration complete', { userId: user.id });
  
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    },
    learner: learnerProfile
  });
}));

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
router.post('/login', validate('login'), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  const authResult = await authenticateUser(email, password);
  
  // Get learner profile if exists
  const learnerProfile = await getLearnerProfile(authResult.id);
  
  logger.info('✅ Login successful', { userId: authResult.id });
  
  res.json({
    user: {
      id: authResult.id,
      email: authResult.email,
      role: authResult.role
    },
    learner: learnerProfile,
    token: authResult.token
  });
}));

/**
 * POST /api/auth/logout
 * Invalidate JWT token (client-side for now)
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  logger.info('🚪 User logout', { userId: req.user.id });
  
  // TODO: Implement token blacklisting in future
  
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
}));

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const learnerProfile = await getLearnerProfile(req.user.id);
  
  res.json({
    user: req.user,
    learner: learnerProfile
  });
}));

export default router;
