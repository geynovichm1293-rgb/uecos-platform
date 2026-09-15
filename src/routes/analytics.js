import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getPool } from '../db/init.js';

const router = express.Router();

/**
 * POST /api/analytics/event
 * Track user event
 */
router.post('/event', asyncHandler(async (req, res) => {
  const { eventType, data } = req.body;
  
  logger.info('📊 Analytics event', { eventType });
  
  // TODO: Store event in analytics table for future analysis
  
  res.json({ status: 'recorded' });
}));

/**
 * GET /api/analytics/learner/:learnerId (admin only)
 * Get learner analytics
 */
router.get('/learner/:learnerId', authenticate, asyncHandler(async (req, res) => {
  const { learnerId } = req.params;
  
  logger.info('📈 Learner analytics', { learnerId });
  
  const pool = getPool();
  
  // Get learner stats
  const statsResult = await pool.query(
    `SELECT 
       COUNT(DISTINCT lp.id) as learning_paths,
       COUNT(DISTINCT p.lesson_id) as lessons_started,
       COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.lesson_id END) as lessons_completed,
       AVG(p.attempts) as avg_attempts,
       MAX(p.last_attempt_at) as last_activity
     FROM learners l
     LEFT JOIN learning_paths lp ON l.id = lp.learner_id
     LEFT JOIN progress p ON l.id = p.learner_id
     WHERE l.id = $1`,
    [learnerId]
  );
  
  res.json(statsResult.rows[0]);
}));

export default router;
