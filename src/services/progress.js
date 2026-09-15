import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Get learner's overall progress
 */
export async function getLearnerProgress(learnerId, subjectId = null) {
  const pool = getPool();
  
  try {
    let query = `
      SELECT 
        COUNT(DISTINCT l.id) as total_lessons,
        COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN l.id END) as completed_lessons,
        COUNT(DISTINCT s.id) as total_skills,
        COUNT(DISTINCT CASE WHEN p.mastery_level = 'LIKELY_MASTERED' THEN s.id END) as mastered_skills,
        AVG(CAST(p.completion_percentage AS FLOAT)) as average_completion,
        MAX(p.completed_at) as last_activity
      FROM lessons l
      JOIN skills s ON l.skill_id = s.id
      JOIN topics t ON s.topic_id = t.id
      LEFT JOIN progress p ON l.id = p.lesson_id AND p.learner_id = $1
    `;
    
    const params = [learnerId];
    
    if (subjectId) {
      query += ' WHERE t.subject_id = $2';
      params.push(subjectId);
    }
    
    const result = await pool.query(query, params);
    const stats = result.rows[0];
    
    logger.info('📊 Progress fetched', { learnerId, stats });
    
    return {
      totalLessons: parseInt(stats.total_lessons) || 0,
      completedLessons: parseInt(stats.completed_lessons) || 0,
      completionPercentage: stats.total_lessons > 0 ? Math.round((stats.completed_lessons / stats.total_lessons) * 100) : 0,
      totalSkills: parseInt(stats.total_skills) || 0,
      masteredSkills: parseInt(stats.mastered_skills) || 0,
      averageCompletion: Math.round(stats.average_completion) || 0,
      lastActivity: stats.last_activity
    };
  } catch (error) {
    logger.error('❌ Progress fetch failed', { error: error.message });
    throw error;
  }
}

/**
 * Get learner's skill-by-skill breakdown
 */
export async function getSkillProgress(learnerId, subjectId) {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      `SELECT 
        s.id,
        s.name,
        COUNT(l.id) as lesson_count,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_lessons,
        MAX(p.mastery_level) as mastery_level,
        AVG(CAST(p.completion_percentage AS FLOAT)) as avg_completion
       FROM skills s
       JOIN lessons l ON s.id = l.skill_id
       LEFT JOIN progress p ON l.id = p.lesson_id AND p.learner_id = $1
       WHERE s.topic_id IN (
         SELECT id FROM topics WHERE subject_id = $2
       )
       GROUP BY s.id, s.name
       ORDER BY s.id`,
      [learnerId, subjectId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('❌ Skill progress fetch failed', { error: error.message });
    throw error;
  }
}
