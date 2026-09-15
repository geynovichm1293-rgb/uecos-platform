import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DATABASE_POOL_SIZE) || 10
    });
  }
  return pool;
}

export async function initializeDatabase() {
  const pool = getPool();
  
  try {
    const client = await pool.connect();
    const version = await client.query('SELECT version();');
    logger.info('Database connection established');
    logger.info('PostgreSQL version:', { version: version.rows[0].version });
    client.release();
    
    // Run migrations
    await runMigrations(pool);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

async function runMigrations(pool) {
  const migrations = [
    createUsersTable,
    createLearnersTable,
    createSubjectsTable,
    createTopicsTable,
    createSkillsTable,
    createLessonsTable,
    createLearningPathsTable,
    createProgressTable,
    createAssessmentsTable
  ];
  
  for (const migration of migrations) {
    try {
      await migration(pool);
      logger.info(`Migration completed: ${migration.name}`);
    } catch (error) {
      logger.error(`Migration failed: ${migration.name}`, error);
      throw error;
    }
  }
}

async function createUsersTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'learner',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createLearnersTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learners (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      age INTEGER,
      grade_level VARCHAR(50),
      learning_preferences JSONB,
      accessibility_settings JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function createSubjectsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(255),
      age_range_min INTEGER,
      age_range_max INTEGER,
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createTopicsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      subject_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      prerequisite_topic_id INTEGER,
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (prerequisite_topic_id) REFERENCES topics(id)
    )
  `);
}

async function createSkillsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      difficulty_level VARCHAR(50),
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    )
  `);
}

async function createLessonsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY,
      skill_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content JSONB,
      duration_minutes INTEGER,
      difficulty_level VARCHAR(50),
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  `);
}

async function createLearningPathsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learning_paths (
      id SERIAL PRIMARY KEY,
      learner_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      goal VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      estimated_duration_hours INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )
  `);
}

async function createProgressTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY,
      learner_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      status VARCHAR(50) DEFAULT 'not_started',
      completion_percentage INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      mastery_level VARCHAR(50) DEFAULT 'not_assessed',
      last_attempt_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      UNIQUE(learner_id, lesson_id)
    )
  `);
}

async function createAssessmentsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      learner_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      questions JSONB NOT NULL,
      responses JSONB,
      score INTEGER,
      assessment_type VARCHAR(50),
      status VARCHAR(50) DEFAULT 'in_progress',
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    )
  `);
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}