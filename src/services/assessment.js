import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

export async function createDiagnosticAssessment(learnerId, topicId, questions) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO assessments (learner_id, topic_id, questions, assessment_type, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [learnerId, topicId, JSON.stringify(questions), 'diagnostic', 'in_progress']
  );
  logger.info('Diagnostic assessment created', { learnerId, topicId });
  return result.rows[0];
}

/**
 * Submit and grade responses using only answer keys stored with the assessment.
 * The row lock prevents concurrent or repeated submissions from racing.
 */
export async function submitAssessment(assessmentId, learnerId, responses) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT questions FROM assessments
       WHERE id = $1 AND learner_id = $2 AND status = 'in_progress'
       FOR UPDATE`,
      [assessmentId, learnerId]
    );

    if (found.rows.length === 0) {
      const error = new Error('Assessment not found or not available to this learner');
      error.status = 404;
      throw error;
    }

    const questions = typeof found.rows[0].questions === 'string'
      ? JSON.parse(found.rows[0].questions)
      : found.rows[0].questions;
    const graded = gradeAssessmentResponses(questions, responses);

    const updated = await client.query(
      `UPDATE assessments
       SET responses = $1, score = $2, status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND learner_id = $4 AND status = 'in_progress'
       RETURNING id, learner_id, topic_id, score, status, completed_at`,
      [JSON.stringify(graded.responses), graded.score, assessmentId, learnerId]
    );

    if (updated.rows.length === 0) {
      const error = new Error('Assessment is no longer available for submission');
      error.status = 409;
      throw error;
    }

    // Persist the diagnostic result on the learner's active path for this subject.
    const startingLevel = determineStartingLevel(graded.score);
    await client.query(
      `UPDATE learning_paths lp
       SET starting_level = $1, updated_at = CURRENT_TIMESTAMP
       FROM topics t
       WHERE lp.learner_id = $2
         AND lp.subject_id = t.subject_id
         AND t.id = $3
         AND lp.status = 'active'`,
      [startingLevel, learnerId, updated.rows[0].topic_id]
    );

    await client.query('COMMIT');
    logger.info('Assessment submitted and graded', { assessmentId, learnerId, score: graded.score });
    return updated.rows[0];
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      logger.error('Assessment rollback failed', { error: rollbackError.message });
    }
    logger.error('Assessment submission failed', { assessmentId, learnerId, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

export async function getAssessment(assessmentId, learnerId) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT id, learner_id, topic_id, responses, score, assessment_type, status, completed_at, created_at FROM assessments WHERE id = $1 AND learner_id = $2',
    [assessmentId, learnerId]
  );
  return result.rows[0] || null;
}

export function gradeAssessmentResponses(questions, responses) {
  if (!Array.isArray(questions) || questions.length === 0 ||
      !Array.isArray(responses) || responses.length !== questions.length) {
    const error = new Error('Submit exactly one response for every assessment question');
    error.status = 400;
    throw error;
  }

  const byId = new Map(questions.map(question => [String(question.id), question]));
  if (byId.size !== questions.length) {
    const error = new Error('Assessment question IDs must be unique');
    error.status = 422;
    throw error;
  }

  const seen = new Set();
  let correctCount = 0;
  const gradedResponses = responses.map(response => {
    const questionId = String(response?.questionId);
    const question = byId.get(questionId);
    if (!question || seen.has(questionId)) {
      const error = new Error('Responses contain an unknown or duplicate question ID');
      error.status = 400;
      throw error;
    }
    seen.add(questionId);

    const key = question.correctAnswer ?? question.correctOptionId ?? question.answerKey;
    const accepted = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [key];
    if (accepted.length === 0 || accepted.some(value => value === undefined || value === null || String(value).trim() === '')) {
      const error = new Error('Assessment contains a question without a server-side answer key');
      error.status = 422;
      throw error;
    }

    const normalize = value => String(value).normalize('NFKC').trim().toLowerCase();
    const isCorrect = accepted.some(value => normalize(value) === normalize(response.answer));
    if (isCorrect) correctCount += 1;

    return { questionId: response.questionId, answer: response.answer, isCorrect };
  });

  return {
    score: Math.round((correctCount / questions.length) * 100),
    responses: gradedResponses
  };
}

export function sanitizeAssessmentQuestions(questions) {
  const hidden = new Set(['correctAnswer', 'correctOptionId', 'answerKey', 'acceptedAnswers', 'isCorrect', 'correct']);
  function strip(value) {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;
    const safe = {};
    for (const [key, nested] of Object.entries(value)) {
      if (!hidden.has(key)) safe[key] = strip(nested);
    }
    return safe;
  }
  return strip(questions);
}

export function determineStartingLevel(score) {
  if (score >= 80) return 'LIKELY_MASTERED';
  if (score >= 60) return 'PRACTICING';
  if (score >= 40) return 'DEVELOPING';
  if (score >= 20) return 'INTRODUCED';
  return 'NOT_ASSESSED';
}
