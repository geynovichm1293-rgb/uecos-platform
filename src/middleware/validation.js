import Joi from 'joi';
import { logger } from '../utils/logger.js';

const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    age: Joi.number().integer().min(2).max(120).optional(),
    gradeLevel: Joi.string().optional()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  goal: Joi.object({
    subjectId: Joi.number().integer().required(),
    goalDescription: Joi.string().max(500).required()
  }),
  
  answer: Joi.object({
    questionId: Joi.number().integer().required(),
    answer: Joi.string().max(5000).required()
  }),
  diagnostic: Joi.object({
    topicId: Joi.number().integer().positive().required()
  }),
  assessmentResponses: Joi.object({
    responses: Joi.array().items(Joi.object({
      questionId: Joi.number().integer().required(),
      answer: Joi.alternatives().try(Joi.string().max(5000), Joi.number(), Joi.boolean()).required()
    }).unknown(false)).min(1).max(100).required()
  })
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
