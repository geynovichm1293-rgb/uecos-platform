#!/usr/bin/env node

/**
 * Seed database with initial data for development/testing
 */

import { getPool } from './init.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/auth.js';

async function seedDatabase() {
  const pool = getPool();
  
  try {
    logger.info('🌱 Seeding database...');
    
    // Create an administrator only when explicitly configured.
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (adminEmail || adminPassword) {
      if (!adminEmail || !adminPassword ||
          Buffer.byteLength(adminPassword, 'utf8') < 8 ||
          Buffer.byteLength(adminPassword, 'utf8') > 72) {
        throw new Error('Set both SEED_ADMIN_EMAIL and an 8–72 byte SEED_ADMIN_PASSWORD to create a seed administrator.');
      }
      const passwordHash = await hashPassword(adminPassword);
      await pool.query(
        `INSERT INTO users (email, password_hash, role, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [adminEmail, passwordHash, 'administrator', 'active']
      );
      logger.info('Seed administrator ensured');
    }
    
    // Create sample subjects
    const subjects = [
      { name: 'Mathematics', description: 'From basic arithmetic to advanced calculus', ageMin: 4, ageMax: 88 },
      { name: 'English Language', description: 'Reading, writing, grammar, and literature', ageMin: 4, ageMax: 88 },
      { name: 'Science', description: 'Physics, chemistry, biology, and earth science', ageMin: 5, ageMax: 88 },
      { name: 'History', description: 'World history, civilizations, and cultural studies', ageMin: 6, ageMax: 88 },
      { name: 'Coding', description: 'Programming languages and computer science fundamentals', ageMin: 7, ageMax: 88 }
    ];
    
    for (const subject of subjects) {
      await pool.query(
        `INSERT INTO subjects (name, description, age_range_min, age_range_max, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`,
        [subject.name, subject.description, subject.ageMin, subject.ageMax, 'published']
      );
    }
    logger.info('✅ Sample subjects created');
    
    // Create sample topics for Math
    const mathTopics = [
      'Arithmetic Fundamentals',
      'Fractions and Decimals',
      'Geometry Basics',
      'Algebra Fundamentals',
      'Pre-Calculus'
    ];
    
    const mathSubject = await pool.query(
      'SELECT id FROM subjects WHERE name = $1',
      ['Mathematics']
    );
    
    if (mathSubject.rows.length > 0) {
      const mathSubjectId = mathSubject.rows[0].id;
      
      for (const topicName of mathTopics) {
        await pool.query(
          `INSERT INTO topics (subject_id, name, description, status)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [mathSubjectId, topicName, `Learn about ${topicName}`, 'published']
        );
      }
      logger.info('✅ Sample topics created');
    }
    
    logger.info('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
