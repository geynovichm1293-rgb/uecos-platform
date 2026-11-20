import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getLearnerProfile } from '../services/auth.js';
import { getPool } from '../db/init.js';
import { generateLearningPath, getLearningPath } from '../services/learningPath.js';
import { getLesson, completeLesson, evaluateLessonAnswer, updateProgress } from '../services/lesson.js';
import { getLearnerProgress, getSkillProgress } from '../services/progress.js';
import { getNextRecommendation } from '../services/recommendation.js';
import { createDiagnosticAssessment, submitAssessment, sanitizeAssessmentQuestions } from '../services/assessment.js';

const router = express.Router();

async function getAuthenticatedLearnerId(req) {
  const learnerProfile = await getLearnerProfile(req.user.id);
  if (!learnerProfile) {
    const error = new Error('Learner profile not found');
    error.status = 404;
    throw error;
  }
  return learnerProfile.id;
}

/**
 * GET /api/learner/dashboard
 * Get learner dashboard data
 */
router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('📊 Dashboard load', { learnerId });
  
  // Get active learning paths
  const pool = getPool();
  const pathsResult = await pool.query(
    'SELECT id, subject_id, goal, status FROM learning_paths WHERE learner_id = $1 AND status = $2 LIMIT 5',
    [learnerId, 'active']
  );
  
  const paths = pathsResult.rows;
  
  res.json({
    activePaths: paths,
    nextAction: paths.length > 0 ? 'Continue learning' : 'Choose a subject to begin'
  });
}));

/**
 * POST /api/learner/goal
 * Set or update learner goal and generate learning path
 */
router.post('/goal', authenticate, validate('goal'), asyncHandler(async (req, res) => {
  const { subjectId, goalDescription } = req.body;
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('Goal selection', { learnerId, subjectId });
  
  // Generate learning path
  const pathData = await generateLearningPath(learnerId, subjectId, goalDescription);
  
  res.status(201).json({
    path: pathData.path,
    topics: pathData.topics,
    startingLevel: pathData.startingLevel,
    message: '✅ Learning path created successfully. Start with the first lesson!'
  });
}));

/**
 * GET /api/learner/path/:pathId
 * Get learning path details with progress
 */
router.get('/path/:pathId', authenticate, asyncHandler(async (req, res) => {
  const { pathId } = req.params;
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('📋 Path view', { pathId, learnerId });
  
  const pathData = await getLearningPath(pathId, learnerId);
  
  res.json({
    path: pathData.path,
    topics: pathData.topics,
    nextLesson: pathData.nextLesson,
    message: pathData.nextLesson ? `Ready to learn: ${pathData.nextLesson.title}` : 'Path complete!'
  });
}));

/**
 * GET /api/learner/lesson/:lessonId
 * Get lesson content
 */
router.get('/lesson/:lessonId', authenticate, asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('📖 Lesson view', { lessonId, learnerId });
  
  const lessonData = await getLesson(lessonId, learnerId);
  
  res.json(lessonData);
}));

/**
 * POST /api/learner/lesson/:lessonId/answer
 * Submit lesson answer and get feedback
 */
router.post('/lesson/:lessonId/answer', authenticate, validate('answer'), asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { questionId, answer } = req.body;
  const learnerId = await getAuthenticatedLearnerId(req);

  logger.info('Lesson answer submitted', { lessonId, learnerId, questionId });

  const feedback = await evaluateLessonAnswer(lessonId, learnerId, questionId, answer);
  const completion = feedback.isCorrect ? 100 : 50;
  await updateProgress(lessonId, learnerId, 'in_progress', completion);

  res.json({
    feedback,
    progress: completion,
    nextAction: feedback.isCorrect ? 'Continue to next question' : 'Try again or review the concept'
  });
}));

/**
 * POST /api/learner/lesson/:lessonId/complete
 * Mark lesson as completed
 */
router.post('/lesson/:lessonId/complete', authenticate, asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('✅ Lesson completion', { lessonId, learnerId });
  
  await completeLesson(lessonId, learnerId);
  
  // Get next recommendation
  const pool = getPool();
  const pathResult = await pool.query(
    `SELECT DISTINCT lp.subject_id
     FROM learning_paths lp
     JOIN topics t ON t.subject_id = lp.subject_id
     JOIN skills s ON s.topic_id = t.id
     JOIN lessons l ON l.skill_id = s.id
     WHERE l.id = $1
       AND lp.learner_id = $2
       AND lp.status = 'active'
       AND t.status = 'published'
       AND s.status = 'published'
       AND l.status = 'published'
     ORDER BY lp.subject_id
     LIMIT 1`,
    [lessonId, learnerId]
  );
  
  const subjectId = pathResult.rows[0]?.subject_id;
  const nextLesson = subjectId ? await getNextRecommendation(learnerId, subjectId) : null;
  
  res.json({
    status: 'completed',
    nextLesson,
    message: nextLesson ? `Great work! Next: ${nextLesson.title}` : 'Congratulations on completing this lesson!'
  });
}));

/**
 * GET /api/learner/progress
 * Get learner's overall progress
 */
router.get('/progress', authenticate, asyncHandler(async (req, res) => {
  const rawSubjectId = req.query.subjectId;
  const subjectId = rawSubjectId === undefined ? null : Number(rawSubjectId);
  if (rawSubjectId !== undefined && (!Number.isSafeInteger(subjectId) || subjectId <= 0)) {
    return res.status(400).json({ error: 'subjectId must be a positive integer' });
  }
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('📈 Progress fetch', { learnerId });
  
  const progress = await getLearnerProgress(learnerId, subjectId);
  const skillProgress = subjectId ? await getSkillProgress(learnerId, subjectId) : [];
  
  res.json({
    overall: progress,
    bySkill: skillProgress
  });
}));

/**
 * POST /api/learner/assessment/diagnostic
 * Start diagnostic assessment
 */
router.post('/assessment/diagnostic', authenticate, validate('diagnostic'), asyncHandler(async (req, res) => {
  const { topicId } = req.body;
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('📋 Diagnostic assessment started', { learnerId, topicId });
  
  // Create sample diagnostic questions
  const diagnosticQuestions = [
    { id: 1, text: 'What is 2 + 2?', correctAnswer: '4', explanation: '2 + 2 equals 4.' },
    { id: 2, text: 'What is half of 10?', correctAnswer: '5', explanation: 'Half means divide by 2; 10 divided by 2 equals 5.' }
  ];
  
  const assessment = await createDiagnosticAssessment(learnerId, topicId, diagnosticQuestions);
  
  res.status(201).json({
    assessmentId: assessment.id,
    questions: sanitizeAssessmentQuestions(assessment.questions),
    message: 'Answer these questions to determine your starting point'
  });
}));

/**
 * POST /api/learner/assessment/:assessmentId/submit
 * Submit diagnostic assessment
 */
router.post('/assessment/:assessmentId/submit', authenticate, validate('assessmentResponses'), asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const { responses } = req.body;
  const learnerId = await getAuthenticatedLearnerId(req);
  
  logger.info('📋 Diagnostic assessment submitted', { learnerId, assessmentId });
  
  const assessment = await submitAssessment(assessmentId, learnerId, responses);
  
  res.json({
    assessmentId: assessment.id,
    score: assessment.score,
    message: `You scored ${assessment.score}% - personalized learning path ready!`
  });
}));

export default router;
