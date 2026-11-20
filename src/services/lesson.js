import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Get lesson with all content
 */
export async function getLesson(lessonId, learnerId) {
  const pool = getPool();
  
  try {
    // Get lesson
    const lessonResult = await pool.query(
      `SELECT l.*
       FROM lessons l
       JOIN skills s ON s.id = l.skill_id
       JOIN topics t ON t.id = s.topic_id
       JOIN learning_paths lp
         ON lp.subject_id = t.subject_id
        AND lp.learner_id = $2
        AND lp.status = 'active'
       WHERE l.id = $1 AND l.status = 'published'
       LIMIT 1`,
      [lessonId, learnerId]
    );
    
    if (lessonResult.rows.length === 0) {
      const error = new Error('Lesson not found');
      error.status = 404;
      throw error;
    }
    
    const lesson = lessonResult.rows[0];
    
    // Get learner's progress on this lesson
    const progressResult = await pool.query(
      'SELECT * FROM progress WHERE lesson_id = $1 AND learner_id = $2',
      [lessonId, learnerId]
    );
    
    const progress = progressResult.rows[0] || null;
    const rawContent = typeof lesson.content === 'string'
      ? JSON.parse(lesson.content)
      : lesson.content;
    const content = sanitizeLessonContent(rawContent);
    const safeLesson = { ...lesson, content };

    logger.info('Lesson loaded', { lessonId, learnerId });

    return { lesson: safeLesson, progress, content };
  } catch (error) {
    logger.error('❌ Lesson fetch failed', { error: error.message });
    throw error;
  }
}

/**
 * Update learner progress on lesson
 */
export async function updateProgress(lessonId, learnerId, status, completionPercentage) {
  const pool = getPool();
  
  try {
    // Upsert progress
    const result = await pool.query(
      `INSERT INTO progress (lesson_id, learner_id, status, completion_percentage, attempts)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (lesson_id, learner_id)
       DO UPDATE SET status = EXCLUDED.status, completion_percentage = EXCLUDED.completion_percentage, attempts = progress.attempts + 1, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [lessonId, learnerId, status, completionPercentage]
    );
    
    logger.info('✅ Progress updated', { lessonId, learnerId, status });
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Progress update failed', { error: error.message });
    throw error;
  }
}

/**
 * Complete lesson (mark as completed)
 */
export async function completeLesson(lessonId, learnerId) {
  const pool = getPool();
  const access = await pool.query(
    `SELECT 1
     FROM lessons l
     JOIN skills s ON s.id = l.skill_id
     JOIN topics t ON t.id = s.topic_id
     JOIN learning_paths lp
       ON lp.subject_id = t.subject_id
      AND lp.learner_id = $2
      AND lp.status = 'active'
     WHERE l.id = $1 AND l.status = 'published'
     LIMIT 1`,
    [lessonId, learnerId]
  );

  if (access.rows.length === 0) {
    const error = new Error('Lesson not found in an active learning path');
    error.status = 404;
    throw error;
  }

  return updateProgress(lessonId, learnerId, 'completed', 100);
}

/**
 * Get lesson feedback based on answer
 */
export async function generateFeedback(question, userAnswer, correctAnswer) {
  try {
    // Basic feedback logic (AI integration future)
    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
    
    const feedback = {
      isCorrect,
      message: isCorrect
        ? '🎉 Great job! That\'s correct.'
        : '💭 Not quite. Let\'s try again or review the concept.',
      explanation: question.explanation || null,
      correctAnswer: !isCorrect ? correctAnswer : null
    };
    
    logger.info('📝 Feedback generated', { isCorrect });
    return feedback;
  } catch (error) {
    logger.error('❌ Feedback generation failed', { error: error.message });
    throw error;
  }
}

function normalizeAnswer(answer) {
  return String(answer).toLowerCase().trim();
}


/**
 * Grade a lesson answer using the answer key stored in the database.
 * Client-provided correctness flags or answer keys are never accepted.
 */
export async function evaluateLessonAnswer(lessonId, learnerId, questionId, submittedAnswer) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT l.content
     FROM lessons l
     JOIN skills s ON s.id = l.skill_id
     JOIN topics t ON t.id = s.topic_id
     JOIN learning_paths lp
       ON lp.subject_id = t.subject_id
      AND lp.learner_id = $2
      AND lp.status = 'active'
     WHERE l.id = $1 AND l.status = 'published'
     LIMIT 1`,
    [lessonId, learnerId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Lesson not found');
    error.status = 404;
    throw error;
  }

  const rawContent = typeof result.rows[0].content === 'string'
    ? JSON.parse(result.rows[0].content)
    : result.rows[0].content;
  const questions = Array.isArray(rawContent?.questions) ? rawContent.questions : [];
  const question = questions.find(item => String(item.id) === String(questionId));

  if (!question) {
    const error = new Error('Question not found');
    error.status = 404;
    throw error;
  }

  return gradeQuestion(question, submittedAnswer);
}

/** Validate the minimum structure required before a lesson can be published. */
export function validateLessonForPublishing(content) {
  const errors = [];
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return ['Lesson content must be an object'];
  }
  if (!Array.isArray(content.questions) || content.questions.length === 0) {
    return ['A publishable lesson must include at least one graded question'];
  }

  const seenIds = new Set();
  for (const [index, question] of content.questions.entries()) {
    const label = `questions[${index}]`;
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (question.id === undefined || question.id === null || String(question.id).trim() === '') {
      errors.push(`${label}.id is required`);
    } else if (seenIds.has(String(question.id))) {
      errors.push(`${label}.id must be unique`);
    } else {
      seenIds.add(String(question.id));
    }

    const prompt = question.prompt ?? question.text;
    if (typeof prompt !== 'string' || prompt.trim().length < 5) {
      errors.push(`${label} needs a meaningful prompt`);
    }

    const answerKey = question.correctAnswer ?? question.correctOptionId ?? question.answerKey;
    const accepted = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [answerKey];
    if (accepted.length === 0 || accepted.some(value => value === undefined || value === null || String(value).trim() === '')) {
      errors.push(`${label} needs a server-side answer key`);
    }

    if (typeof question.explanation !== 'string' || question.explanation.trim().length < 8) {
      errors.push(`${label} needs an explanation for learner feedback`);
    }
  }
  return errors;
}

/** Remove answer keys from question objects before sending lesson content to clients. */
export function sanitizeLessonContent(content) {
  const answerKeyNames = new Set([
    'correctAnswer',
    'correctOptionId',
    'answerKey',
    'acceptedAnswers',
    'isCorrect',
    'correct'
  ]);

  function strip(value) {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;

    const safe = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (!answerKeyNames.has(key)) {
        safe[key] = strip(nestedValue);
      }
    }
    return safe;
  }

  return strip(content);
}
/** Pure grading function, exported for focused unit tests. */
export function gradeQuestion(question, submittedAnswer) {
  const answerKey = question.correctAnswer ?? question.correctOptionId ?? question.answerKey;
  const acceptedAnswers = Array.isArray(question.acceptedAnswers)
    ? question.acceptedAnswers
    : [answerKey];

  if (acceptedAnswers.length === 0 || acceptedAnswers.some(value => value === undefined || value === null)) {
    const error = new Error('This question is not configured for server-side grading');
    error.status = 422;
    throw error;
  }

  const normalize = value => String(value).normalize('NFKC').trim().toLowerCase();
  const isCorrect = acceptedAnswers.some(value => normalize(value) === normalize(submittedAnswer));

  return {
    isCorrect,
    message: isCorrect
      ? "Great job! That's correct."
      : "Not quite. Review the explanation and try again.",
    explanation: question.explanation ?? null,
    correctAnswer: isCorrect ? null : String(acceptedAnswers[0])
  };
}
