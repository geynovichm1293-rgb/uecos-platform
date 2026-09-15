import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getPool } from '../db/init.js';

const router = express.Router();

/**
 * GET /api/content/subjects
 * List all published subjects
 */
router.get('/subjects', asyncHandler(async (req, res) => {
  logger.info('🔍 Subjects list');
  
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, description, icon, age_range_min, age_range_max
     FROM subjects WHERE status = $1
     ORDER BY name`,
    ['published']
  );
  
  res.json({
    subjects: result.rows,
    total: result.rows.length
  });
}));

/**
 * GET /api/content/search
 * Search content by keyword
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, type = 'all' } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  logger.info('🔎 Content search', { query: q, type });
  
  const pool = getPool();
  const searchTerm = `%${q}%`;
  
  let results = {};
  
  if (type === 'all' || type === 'subject') {
    const subjectsResult = await pool.query(
      `SELECT id, name FROM subjects WHERE (name ILIKE $1 OR description ILIKE $1) AND status = $2`,
      [searchTerm, 'published']
    );
    results.subjects = subjectsResult.rows;
  }
  
  if (type === 'all' || type === 'topic') {
    const topicsResult = await pool.query(
      `SELECT id, name FROM topics WHERE (name ILIKE $1 OR description ILIKE $1) AND status = $2`,
      [searchTerm, 'published']
    );
    results.topics = topicsResult.rows;
  }
  
  if (type === 'all' || type === 'lesson') {
    const lessonsResult = await pool.query(
      `SELECT id, title FROM lessons WHERE (title ILIKE $1 OR description ILIKE $1) AND status = $2`,
      [searchTerm, 'published']
    );
    results.lessons = lessonsResult.rows;
  }
  
  res.json(results);
}));

/**
 * POST /api/content/admin/subject (admin only)
 * Create new subject
 */
router.post('/admin/subject', authenticate, authorize('administrator'), asyncHandler(async (req, res) => {
  const { name, description, ageRangeMin, ageRangeMax } = req.body;
  
  logger.info('✏️ Subject creation (admin)', { name });
  
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO subjects (name, description, age_range_min, age_range_max, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, description, ageRangeMin, ageRangeMax, 'draft']
  );
  
  res.status(201).json(result.rows[0]);
}));

/**
 * POST /api/content/admin/topic (admin only)
 * Create new topic
 */
router.post('/admin/topic', authenticate, authorize('administrator'), asyncHandler(async (req, res) => {
  const { subjectId, name, description } = req.body;
  
  logger.info('✏️ Topic creation (admin)', { subjectId, name });
  
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO topics (subject_id, name, description, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [subjectId, name, description, 'draft']
  );
  
  res.status(201).json(result.rows[0]);
}));

/**
 * POST /api/content/admin/lesson (admin only)
 * Create new lesson
 */
router.post('/admin/lesson', authenticate, authorize('administrator'), asyncHandler(async (req, res) => {
  const { skillId, title, description, content, durationMinutes } = req.body;
  
  logger.info('✏️ Lesson creation (admin)', { skillId, title });
  
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO lessons (skill_id, title, description, content, duration_minutes, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [skillId, title, description, JSON.stringify(content), durationMinutes, 'draft']
  );
  
  res.status(201).json(result.rows[0]);
}));

/**
 * PATCH /api/content/admin/lesson/:lessonId (admin only)
 * Update lesson
 */
router.patch('/admin/lesson/:lessonId', authenticate, authorize('administrator'), asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { title, description, content } = req.body;
  
  logger.info('✏️ Lesson update (admin)', { lessonId });
  
  const pool = getPool();
  const result = await pool.query(
    `UPDATE lessons SET title = $1, description = $2, content = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [title, description, JSON.stringify(content), lessonId]
  );
  
  res.json(result.rows[0]);
}));

/**
 * POST /api/content/admin/publish/:lessonId (admin only)
 * Publish lesson
 */
router.post('/admin/publish/:lessonId', authenticate, authorize('administrator'), asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  
  logger.info('🚀 Lesson publish (admin)', { lessonId });
  
  const pool = getPool();
  const result = await pool.query(
    `UPDATE lessons SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    ['published', lessonId]
  );
  
  res.json({ status: 'published', lesson: result.rows[0] });
}));

export default router;
