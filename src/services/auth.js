import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password) {
  return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return bcryptjs.compare(password, hash);
}

/**
 * Create JWT token
 */
export function createToken(userId, role) {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.warn('Token verification failed', { error: error.message });
    return null;
  }
}

/**
 * Register new user
 */
export async function registerUser(email, password, role = 'learner') {
  const pool = getPool();
  
  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      const error = new Error('User with this email already exists');
      error.status = 409;
      throw error;
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [email, passwordHash, role, 'active']
    );
    
    const user = result.rows[0];
    logger.info('✅ User registered successfully', { userId: user.id, email: user.email });
    
    return user;
  } catch (error) {
    logger.error('❌ User registration failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Authenticate user and return token
 */
export async function authenticateUser(email, password) {
  const pool = getPool();
  
  try {
    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    
    if (!isValid) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }
    
    // Generate token
    const token = createToken(user.id, user.role);
    
    logger.info('🔐 User authenticated successfully', { userId: user.id, email: user.email });
    
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      token
    };
  } catch (error) {
    logger.error('❌ Authentication failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  const pool = getPool();
  
  const result = await pool.query(
    'SELECT id, email, role, status, created_at FROM users WHERE id = $1',
    [userId]
  );
  
  return result.rows[0] || null;
}

/**
 * Create learner profile
 */
export async function createLearnerProfile(userId, firstName, lastName, age, gradeLevel) {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      `INSERT INTO learners (user_id, first_name, last_name, age, grade_level, learning_preferences, accessibility_settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, firstName, lastName, age, gradeLevel, '{}', '{}']
    );
    
    logger.info('👤 Learner profile created', { userId, learnerId: result.rows[0].id });
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Learner profile creation failed', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get learner profile
 */
export async function getLearnerProfile(userId) {
  const pool = getPool();
  
  const result = await pool.query(
    'SELECT * FROM learners WHERE user_id = $1',
    [userId]
  );
  
  return result.rows[0] || null;
}
