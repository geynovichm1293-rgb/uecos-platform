import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';
import { determineStartingLevel } from './assessment.js';

/**
 * Generate personalized learning path
 */
export async function generateLearningPath(learnerId, subjectId, goalDescription, diagnosticScore = null) {
  const pool = getPool();
  
  try {
    // Create learning path
    const pathResult = await pool.query(
      `INSERT INTO learning_paths (learner_id, subject_id, goal, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [learnerId, subjectId, goalDescription, 'active']
    );
    
    const path = pathResult.rows[0];
    
    // Get subject content hierarchy
    const contentResult = await pool.query(
      `SELECT t.id, t.name, s.id as skill_id, s.name as skill_name, s.difficulty_level
       FROM topics t
       LEFT JOIN skills s ON t.id = s.topic_id
       WHERE t.subject_id = $1
       ORDER BY t.id, s.difficulty_level`,
      [subjectId]
    );
    
    // Organize content by starting level
    const startingLevel = diagnosticScore ? determineStartingLevel(diagnosticScore) : 'INTRODUCED';
    const recommendedTopics = filterContentByLevel(contentResult.rows, startingLevel);
    
    logger.info('🎯 Learning path generated', {
      pathId: path.id,
      learnerId,
      topicCount: recommendedTopics.length,
      startingLevel
    });
    
    return {
      path,
      topics: recommendedTopics,
      startingLevel,
      totalTopics: contentResult.rows.length
    };
  } catch (error) {
    logger.error('❌ Learning path generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Get learning path with progress
 */
export async function getLearningPath(pathId, learnerId) {
  const pool = getPool();
  
  try {
    // Get path
    const pathResult = await pool.query(
      'SELECT * FROM learning_paths WHERE id = $1 AND learner_id = $2',
      [pathId, learnerId]
    );
    
    if (pathResult.rows.length === 0) {
      throw new Error('Learning path not found');
    }
    
    const path = pathResult.rows[0];
    
    // Get topics for this subject
    const topicsResult = await pool.query(
      `SELECT t.id, t.name, t.description, 
              COUNT(l.id) as lesson_count,
              COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_lessons
       FROM topics t
       LEFT JOIN skills s ON t.id = s.topic_id
       LEFT JOIN lessons l ON s.id = l.skill_id
       LEFT JOIN progress p ON l.id = p.lesson_id AND p.learner_id = $1
       WHERE t.subject_id = $2
       GROUP BY t.id, t.name, t.description
       ORDER BY t.id`,
      [learnerId, path.subject_id]
    );
    
    // Get next recommended lesson
    const nextLessonResult = await pool.query(
      `SELECT l.id, l.title, l.skill_id, l.description
       FROM lessons l
       JOIN skills s ON l.skill_id = s.id
       JOIN topics t ON s.topic_id = t.id
       LEFT JOIN progress p ON l.id = p.lesson_id AND p.learner_id = $1
       WHERE t.subject_id = $2 AND (p.id IS NULL OR p.status != 'completed')
       ORDER BY t.id, s.difficulty_level
       LIMIT 1`,
      [learnerId, path.subject_id]
    );
    
    return {
      path,
      topics: topicsResult.rows,
      nextLesson: nextLessonResult.rows[0] || null
    };
  } catch (error) {
    logger.error('❌ Learning path fetch failed', { error: error.message });
    throw error;
  }
}

/**
 * Filter content based on learner level
 */
function filterContentByLevel(content, level) {
  const levelPriority = {
    'NOT_ASSESSED': 0,
    'INTRODUCED': 1,
    'DEVELOPING': 2,
    'PRACTICING': 3,
    'LIKELY_MASTERED': 4
  };
  
  // Start with topics below or at learner's current level
  const filteredByTopic = {};
  
  content.forEach(row => {
    if (!filteredByTopic[row.id]) {
      filteredByTopic[row.id] = {
        id: row.id,
        name: row.name,
        skills: []
      };
    }
    
    if (row.skill_id) {
      filteredByTopic[row.id].skills.push({
        id: row.skill_id,
        name: row.skill_name,
        difficulty: row.difficulty_level
      });
    }
  });
  
  return Object.values(filteredByTopic);
}
