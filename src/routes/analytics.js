import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getPool } from '../db/init.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

/**
 * POST /api/analytics/event
 * Track user event
 */
router.post('/event', authenticate, validate('analyticsEvent'), asyncHandler(async (req, res) => {
  const { eventType, data } = req.body;
  
  logger.info('📊 Analytics event', { eventType });
  
  // TODO: Store event in analytics table for future analysis
  
  res.status(202).json({ status: 'accepted', persisted: false });
}));

/**
 * GET /api/analytics/learner/:learnerId (admin only)
 * Get learner analytics
 */
router.get('/learner/:learnerId', authenticate, authorize('administrator'), asyncHandler(async (req, res) => {
  const learnerId = Number(req.params.learnerId);
  if (!Number.isSafeInteger(learnerId) || learnerId < 1) {
    return res.status(400).json({ error: 'Invalid learner ID' });
  }

  logger.info('Learner analytics requested', { learnerId });
  const pool = getPool();
  const statsResult = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM learning_paths WHERE learner_id = $1) AS learning_paths,
       (SELECT COUNT(*) FROM progress WHERE learner_id = $1) AS lessons_started,
       (SELECT COUNT(*) FROM progress WHERE learner_id = $1 AND status = 'completed') AS lessons_completed,
       (SELECT AVG(attempts) FROM progress WHERE learner_id = $1) AS avg_attempts,
       (SELECT MAX(updated_at) FROM progress WHERE learner_id = $1) AS last_activity
     FROM learners
     WHERE id = $1`,
    [learnerId]
  );

  if (statsResult.rows.length === 0) {
    return res.status(404).json({ error: 'Learner not found' });
  }
  res.json(statsResult.rows[0]);
}));

export default router;
