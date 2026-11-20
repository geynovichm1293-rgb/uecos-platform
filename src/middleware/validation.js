import Joi from 'joi';
import { logger } from '../utils/logger.js';

const schemas = {
  register: Joi.object({
    email: Joi.string().email().lowercase().trim().max(254).required(),
    password: Joi.string().min(8).max(72).custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('string.max', { limit: 72 })).required(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    age: Joi.number().integer().min(2).max(120).optional(),
    gradeLevel: Joi.string().optional()
  }),
  
  login: Joi.object({
    email: Joi.string().email().lowercase().trim().max(254).required(),
    password: Joi.string().min(1).max(72).custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('string.max', { limit: 72 })).required()
  }),
  
  goal: Joi.object({
    subjectId: Joi.number().integer().positive().required(),
    goalDescription: Joi.string().trim().min(1).max(500).required()
  }),
  
  answer: Joi.object({
    questionId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1).max(100)).required(),
    answer: Joi.string().max(5000).required()
  }),
  diagnostic: Joi.object({
    topicId: Joi.number().integer().positive().required()
  }),
  assessmentResponses: Joi.object({
    responses: Joi.array().items(Joi.object({
      questionId: Joi.number().integer().positive().required(),
      answer: Joi.alternatives().try(Joi.string().max(5000), Joi.number(), Joi.boolean()).required()
    })).min(1).max(100).required()
  }),
  subject: Joi.object({
    name: Joi.string().trim().min(2).max(255).required(),
    description: Joi.string().max(5000).allow('', null),
    ageRangeMin: Joi.number().integer().min(2).max(120).required(),
    ageRangeMax: Joi.number().integer().min(2).max(120).required()
  }).custom((value, helpers) => value.ageRangeMin <= value.ageRangeMax
    ? value
    : helpers.error('any.invalid')),
  topic: Joi.object({
    subjectId: Joi.number().integer().positive().required(),
    name: Joi.string().trim().min(2).max(255).required(),
    description: Joi.string().max(5000).allow('', null)
  }),
  lesson: Joi.object({
    skillId: Joi.number().integer().positive().required(),
    title: Joi.string().trim().min(2).max(255).required(),
    description: Joi.string().max(5000).allow('', null),
    content: Joi.object().unknown(true).required(),
    durationMinutes: Joi.number().integer().min(1).max(600).required()
  }),
  analyticsEvent: Joi.object({
    eventType: Joi.string().trim().min(1).max(100).required(),
    data: Joi.object().unknown(true).optional()
  }),
  lessonUpdate: Joi.object({
    title: Joi.string().trim().min(2).max(255),
    description: Joi.string().max(5000).allow('', null),
    content: Joi.object().unknown(true)
  }).min(1)
};

export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schemas[schema].validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      logger.warn('⚠️ Validation failed', {
        schema,
        errors: error.details.map(d => d.message)
      });
      
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }
    
    req.body = value;
    next();
  };
}
