#!/usr/bin/env node

/**
 * Seed database with initial data for development/testing
 */

import { getPool } from './init.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/auth.js';
import { validateLessonForPublishing } from '../services/lesson.js';

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

      // Seed one carefully structured, server-graded starter lesson.
      const arithmeticTopic = await pool.query(
        'SELECT id FROM topics WHERE subject_id = $1 AND name = $2 AND status = $3',
        [mathSubjectId, 'Arithmetic Fundamentals', 'published']
      );
      if (arithmeticTopic.rows.length > 0) {
        const topicId = arithmeticTopic.rows[0].id;
        let skill = await pool.query(
          'SELECT id FROM skills WHERE topic_id = $1 AND name = $2 LIMIT 1',
          [topicId, 'Addition and Subtraction Foundations']
        );
        if (skill.rows.length === 0) {
          skill = await pool.query(
            `INSERT INTO skills (topic_id, name, description, difficulty_level, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [topicId, 'Addition and Subtraction Foundations',
              'Combine quantities, compare amounts, and solve basic addition and subtraction problems.',
              'beginner', 'published']
          );
        }

        const lessonContent = {
          overview: 'Learn to combine quantities, find differences, and solve everyday arithmetic problems.',
          learningObjectives: [
            'Add two quantities using place-value and counting strategies',
            'Subtract to find how many remain or how far apart quantities are',
            'Solve a missing-addend problem using the relationship between addition and subtraction'
          ],
          sections: [
            {
              title: 'Addition combines quantities',
              body: 'Addition tells how many there are altogether. You can count on from the larger number or break numbers into tens and ones.'
            },
            {
              title: 'Subtraction finds what remains or the difference',
              body: 'Subtraction can describe taking away or comparing two amounts. Check a subtraction answer by adding the difference back to the smaller amount.'
            },
            {
              title: 'A missing number can be found with the inverse operation',
              body: 'If 9 + ? = 16, ask what must be added to 9 to reach 16. The missing number is 16 - 9.'
            }
          ],
          workedExamples: [
            {
              prompt: 'A box has 8 blue pencils and 7 red pencils. How many pencils are there altogether?',
              solution: '8 + 7 = 15 pencils.'
            },
            {
              prompt: 'There are 14 apples. Six are used. How many remain?',
              solution: '14 - 6 = 8 apples.'
            }
          ],
          questions: [
            {
              id: 'arith-add-01',
              prompt: 'Calculate 7 + 5.',
              correctAnswer: '12',
              explanation: 'Start at 7 and count on five: 8, 9, 10, 11, 12.'
            },
            {
              id: 'arith-word-02',
              prompt: 'A library cart has 9 books. A librarian adds 8 more. How many books are on the cart now?',
              correctAnswer: '17',
              explanation: 'The books are combined, so add 9 + 8 to get 17 books.'
            },
            {
              id: 'arith-sub-03',
              prompt: 'A basket contains 14 apples. Six apples are used. How many apples remain?',
              correctAnswer: '8',
              explanation: 'Taking 6 away means subtract: 14 - 6 = 8 apples.'
            },
            {
              id: 'arith-missing-04',
              prompt: 'Find the missing number: 9 + ? = 16.',
              correctAnswer: '7',
              explanation: 'Subtract the known addend from the total: 16 - 9 = 7.'
            },
            {
              id: 'arith-check-05',
              prompt: 'Which number makes this subtraction true: 18 - ? = 11?',
              correctAnswer: '7',
              explanation: 'The difference between 18 and 11 is 7. Check: 18 - 7 = 11.'
            }
          ]
        };
        const qualityErrors = validateLessonForPublishing(lessonContent);
        if (qualityErrors.length > 0) {
          throw new Error(`Seed lesson failed publishing quality checks: ${qualityErrors.join('; ')}`);
        }

        const existingLesson = await pool.query(
          'SELECT id FROM lessons WHERE skill_id = $1 AND title = $2 LIMIT 1',
          [skill.rows[0].id, 'Addition and Subtraction: Combining and Comparing Quantities']
        );
        if (existingLesson.rows.length === 0) {
          await pool.query(
            `INSERT INTO lessons
              (skill_id, title, description, content, duration_minutes, difficulty_level, status)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
            [skill.rows[0].id,
              'Addition and Subtraction: Combining and Comparing Quantities',
              'Build confidence with addition, subtraction, and missing-number problems.',
              JSON.stringify(lessonContent), 12, 'beginner', 'published']
          );
        }
      }
    }
    
    logger.info('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
