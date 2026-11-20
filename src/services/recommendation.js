import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Get next recommended lesson for learner
 */
export async function getNextRecommendation(learnerId, subjectId) {
  const pool = getPool();
  
  try {
    // Recommend next uncompleted lesson
    const recommendationResult = await pool.query(
      `SELECT l.id, l.title, l.description, l.difficulty_level, t.name as topic_name
       FROM lessons l
       JOIN skills s ON l.skill_id = s.id
       JOIN topics t ON s.topic_id = t.id
       LEFT JOIN progress p ON l.id = p.lesson_id AND p.learner_id = $1
       JOIN learning_paths lp
         ON lp.subject_id = t.subject_id
        AND lp.learner_id = $1
        AND lp.status = 'active'
       WHERE t.subject_id = $2
         AND t.status = 'published'
         AND s.status = 'published'
         AND l.status = 'published'
         AND (p.id IS NULL OR p.status != 'completed')
       ORDER BY
         CASE lp.starting_level
           WHEN 'LIKELY_MASTERED' THEN
             CASE LOWER(COALESCE(l.difficulty_level, 'beginner'))
               WHEN 'advanced' THEN 0 WHEN 'hard' THEN 0
               WHEN 'intermediate' THEN 1 WHEN 'medium' THEN 1
               ELSE 2
             END
           WHEN 'PRACTICING' THEN
             CASE LOWER(COALESCE(l.difficulty_level, 'beginner'))
               WHEN 'intermediate' THEN 0 WHEN 'medium' THEN 0
               WHEN 'advanced' THEN 1 WHEN 'hard' THEN 1
               ELSE 2
             END
           ELSE
             CASE LOWER(COALESCE(l.difficulty_level, 'beginner'))
               WHEN 'beginner' THEN 0 WHEN 'easy' THEN 0
               WHEN 'intermediate' THEN 1 WHEN 'medium' THEN 1
               ELSE 2
             END
         END,
         t.id, s.difficulty_level, l.id
       LIMIT 1`,
      [learnerId, subjectId]
    );
    
    const recommendation = recommendationResult.rows[0];
    
    if (recommendation) {
      logger.info('💡 Recommendation generated', {
        learnerId,
        lessonId: recommendation.id,
        topic: recommendation.topic_name
      });
    }
    
    return recommendation;
  } catch (error) {
    logger.error('❌ Recommendation generation failed', { error: error.message });
    throw error;
  }
}
