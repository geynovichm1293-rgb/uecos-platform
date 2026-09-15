import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { generateLearningPath, getLearningPath } from '../services/learningPath.js';
import { getLesson, completeLesson, generateFeedback, updateProgress } from '../services/lesson.js';
import { getLearnerProgress, getSkillProgress } from '../services/progress.js';
import { getNextRecommendation } from '../services/recommendation.js';
import { createDiagnosticAssessment, submitAssessment, getAssessment } from '../services/assessment.js';

const router = express.Router();

/**
 * GET /api/learner/dashboard
 * Get learner dashboard data
 */
router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const { learner_id } = req.query;
  const learnerId = learner_id || req.user.id;
  
  logger.info('📊 Dashboard load', { learnerId });
  
  // Get active learning paths
  const pool = require('../db/init.js').getPool();
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
router.post('/goal', authenticate, asyncHandler(async (req, res) => {
  const { subjectId, goalDescription } = req.body;
  const learnerId = req.user.id;
  
  logger.info('🎯 Goal selection', { learnerId, subjectId, goalDescription });
  
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
  const learnerId = req.user.id;
  
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
  const learnerId = req.user.id;
  
  logger.info('📖 Lesson view', { lessonId, learnerId });
  
  const lessonData = await getLesson(lessonId, learnerId);
  
  res.json(lessonData);
}));

/**
 * POST /api/learner/lesson/:lessonId/answer
 * Submit lesson answer and get feedback
 */
router.post('/lesson/:lessonId/answer', authenticate, asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { questionId, answer, correctAnswer } = req.body;
  const learnerId = req.user.id;
  
  logger.info('✏️ Answer submission', { lessonId, learnerId });
  
  // Generate feedback
  const feedback = await generateFeedback(
    { explanation: 'See explanation above' },
    answer,
    correctAnswer
  );
  
  // Update progress
  const completion = feedback.isCorrect ? 100 : 50;
  await updateProgress(lessonId, learnerId, 'in_progress', completion);
  
  // Get next recommendation
  const pool = require('../db/init.js').getPool();
  const pathResult = await pool.query(
    'SELECT subject_id FROM learning_paths WHERE id IN (SELECT path_id FROM progress WHERE lesson_id = $1 LIMIT 1) LIMIT 1',
    [lessonId]
  );
  
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
  const learnerId = req.user.id;
  
  logger.info('✅ Lesson completion', { lessonId, learnerId });
  
  await completeLesson(lessonId, learnerId);
  
  // Get next recommendation
  const pool = require('../db/init.js').getPool();
  const pathResult = await pool.query(
    `SELECT lp.subject_id FROM learning_paths lp
     JOIN progress p ON true
     WHERE p.lesson_id = $1 LIMIT 1`,
    [lessonId]
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
  const { subjectId } = req.query;
  const learnerId = req.user.id;
  
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
router.post('/assessment/diagnostic', authenticate, asyncHandler(async (req, res) => {
  const { topicId } = req.body;
  const learnerId = req.user.id;
  
  logger.info('📋 Diagnostic assessment started', { learnerId, topicId });
  
  // Create sample diagnostic questions
  const diagnosticQuestions = [
    { id: 1, text: 'Sample diagnostic question 1', explanation: 'Learn more here' },
    { id: 2, text: 'Sample diagnostic question 2', explanation: 'Learn more here' }
  ];
  
  const assessment = await createDiagnosticAssessment(learnerId, topicId, diagnosticQuestions);
  
  res.status(201).json({
    assessmentId: assessment.id,
    questions: assessment.questions,
    message: 'Answer these questions to determine your starting point'
  });
}));

/**
 * POST /api/learner/assessment/:assessmentId/submit
 * Submit diagnostic assessment
 */
router.post('/assessment/:assessmentId/submit', authenticate, asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const { responses } = req.body;
  const learnerId = req.user.id;
  
  logger.info('📋 Diagnostic assessment submitted', { learnerId, assessmentId });
  
  const assessment = await submitAssessment(assessmentId, responses);
  
  res.json({
    assessmentId: assessment.id,
    score: assessment.score,
    message: `You scored ${assessment.score}% - personalized learning path ready!`
  });
}));

export default router;
