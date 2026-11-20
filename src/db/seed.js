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
        const existingTopic = await pool.query(
          'SELECT id FROM topics WHERE subject_id = $1 AND name = $2 LIMIT 1',
          [mathSubjectId, topicName]
        );
        if (existingTopic.rows.length === 0) {
          await pool.query(
            `INSERT INTO topics (subject_id, name, description, status)
             VALUES ($1, $2, $3, $4)`,
            [mathSubjectId, topicName, `Learn about ${topicName}`, 'published']
          );
        }
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
            },
            {
              id: 'arith-add-06',
              prompt: 'Calculate 23 + 14.',
              correctAnswer: '37',
              explanation: 'Add tens and ones: 20 + 10 = 30, and 3 + 4 = 7. Then 30 + 7 = 37.'
            },
            {
              id: 'arith-add-07',
              prompt: 'Find the missing addend: 38 + ? = 52.',
              correctAnswer: '14',
              explanation: 'Subtract the known addend from the total: 52 - 38 = 14.'
            },
            {
              id: 'arith-add-08',
              prompt: 'Calculate 46 + 27.',
              correctAnswer: '73',
              explanation: 'Add ones: 6 + 7 = 13, regroup 10 ones as 1 ten, then add tens: 4 + 2 + 1 = 7 tens. The total is 73.'
            },
            {
              id: 'arith-add-09',
              prompt: 'A school collected 125 cans on Monday and 38 cans on Tuesday. How many cans did it collect altogether?',
              correctAnswer: '163',
              explanation: 'The amounts are combined: 125 + 38 = 163 cans.'
            },
            {
              id: 'arith-sub-10',
              prompt: 'Calculate 32 - 17.',
              correctAnswer: '15',
              explanation: 'Subtract 10 to get 22, then subtract 7 to get 15.'
            },
            {
              id: 'arith-sub-11',
              prompt: 'Calculate 50 - 28.',
              correctAnswer: '22',
              explanation: 'Subtract 20 to get 30, then subtract 8 to get 22.'
            },
            {
              id: 'arith-sub-12',
              prompt: 'Calculate 81 - 36.',
              correctAnswer: '45',
              explanation: 'Subtract 30 to get 51, then subtract 6 to get 45.'
            },
            {
              id: 'arith-sub-13',
              prompt: 'A class needs 100 sheets of paper. It has already used 64. How many sheets remain?',
              correctAnswer: '36',
              explanation: 'The remaining amount is 100 - 64 = 36 sheets.'
            },
            {
              id: 'arith-word-14',
              prompt: 'A bus has 26 passengers. At the next stop, 18 more passengers board. How many passengers are on the bus now?',
              correctAnswer: '44',
              explanation: 'More passengers board, so add 26 + 18 = 44 passengers.'
            },
            {
              id: 'arith-word-15',
              prompt: 'Jordan has 45 stickers and gives 19 away. How many stickers does Jordan have left?',
              correctAnswer: '26',
              explanation: 'Giving stickers away reduces the amount: 45 - 19 = 26 stickers.'
            },
            {
              id: 'arith-missing-16',
              prompt: 'Find the missing number: ? + 18 = 40.',
              correctAnswer: '22',
              explanation: 'Use the inverse operation: 40 - 18 = 22.'
            },
            {
              id: 'arith-missing-17',
              prompt: 'Find the missing number: 63 - ? = 28.',
              correctAnswer: '35',
              explanation: 'The missing amount is the difference between 63 and 28: 63 - 28 = 35.'
            },
            {
              id: 'arith-reason-18',
              prompt: 'A learner says 52 - 18 = 44. What is the correct difference?',
              correctAnswer: '34',
              explanation: '52 - 20 = 32, then add back 2 because only 18 was subtracted. The correct difference is 34.'
            },
            {
              id: 'arith-place-19',
              prompt: 'What number is made by 3 tens and 4 ones?',
              correctAnswer: '34',
              explanation: 'Three tens equal 30 and four ones equal 4. Together they make 34.'
            },
            {
              id: 'arith-check-20',
              prompt: 'Which number sentence checks that 47 - 19 = 28?',
              acceptedAnswers: ['28 + 19 = 47', '19 + 28 = 47'],
              explanation: 'Addition checks subtraction. Adding the difference, 28, to the amount taken away, 19, returns the starting number 47.'
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

      // Seed a second complete topic slice for fractions and decimals.
      const fractionsTopic = await pool.query(
        'SELECT id FROM topics WHERE subject_id = $1 AND name = $2 AND status = $3',
        [mathSubjectId, 'Fractions and Decimals', 'published']
      );
      if (fractionsTopic.rows.length > 0) {
        const topicId = fractionsTopic.rows[0].id;
        let skill = await pool.query(
          'SELECT id FROM skills WHERE topic_id = $1 AND name = $2 LIMIT 1',
          [topicId, 'Fraction Concepts and Equivalent Forms']
        );
        if (skill.rows.length === 0) {
          skill = await pool.query(
            `INSERT INTO skills (topic_id, name, description, difficulty_level, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [topicId, 'Fraction Concepts and Equivalent Forms',
              'Interpret fractions, identify equivalent forms, and connect common fractions to decimals.',
              'beginner', 'published']
          );
        }

        const lessonContent = {
          overview: 'Understand fractions as equal parts of a whole and connect common fractions to decimal notation.',
          learningObjectives: [
            'Identify the numerator and denominator and explain what each represents',
            'Find simple fractions of a quantity and compare fractions with related denominators',
            'Add and subtract fractions with like denominators',
            'Convert common fractions to equivalent decimals and simplify fractions'
          ],
          sections: [
            {
              title: 'Numerator and denominator',
              body: 'The denominator tells how many equal parts make one whole. The numerator tells how many of those parts are being described.'
            },
            {
              title: 'Equivalent fractions',
              body: 'Equivalent fractions name the same amount. Multiply or divide the numerator and denominator by the same nonzero number to create an equivalent fraction.'
            },
            {
              title: 'Fractions of a quantity',
              body: 'To find a unit fraction of a quantity, divide the quantity by the denominator. Multiply that result by the numerator for a non-unit fraction.'
            },
            {
              title: 'Fractions and decimals',
              body: 'A fraction can be written as a decimal by dividing its numerator by its denominator. Common examples include one-half as 0.5 and one-quarter as 0.25.'
            }
          ],
          workedExamples: [
            {
              prompt: 'Find three-quarters of 8.',
              solution: 'One-quarter of 8 is 8 ÷ 4 = 2. Three-quarters is 3 × 2 = 6.'
            },
            {
              prompt: 'Write 0.75 as a fraction in simplest form.',
              solution: '0.75 = 75/100. Divide numerator and denominator by 25 to get 3/4.'
            }
          ],
          questions: [
            { id: 'frac-01', prompt: 'In the fraction 3/5, what is the numerator?', correctAnswer: '3', explanation: 'The numerator is the top number. It tells how many equal parts are being counted.' },
            { id: 'frac-02', prompt: 'In the fraction 3/5, what is the denominator?', correctAnswer: '5', explanation: 'The denominator is the bottom number. It tells how many equal parts make one whole.' },
            { id: 'frac-03', prompt: 'What is one-quarter of 8?', correctAnswer: '2', explanation: 'One-quarter means divide by 4. Since 8 ÷ 4 = 2, the answer is 2.' },
            { id: 'frac-04', prompt: 'What is three-quarters of 8?', correctAnswer: '6', explanation: 'First find one-quarter: 8 ÷ 4 = 2. Then take three parts: 3 × 2 = 6.' },
            { id: 'frac-05', prompt: 'Which is larger: 1/2 or 1/4?', correctAnswer: '1/2', explanation: 'When the whole is the same size, halves are larger pieces than quarters. One-half is greater than one-quarter.' },
            { id: 'frac-06', prompt: 'Write 2/4 as an equivalent fraction in simplest form.', correctAnswer: '1/2', explanation: 'Divide the numerator and denominator by 2: 2/4 = 1/2.' },
            { id: 'frac-07', prompt: 'Calculate 1/3 + 1/3.', correctAnswer: '2/3', explanation: 'The denominators are the same, so add the numerators: 1 + 1 = 2. Keep the denominator 3.' },
            { id: 'frac-08', prompt: 'Calculate 1/4 + 2/4.', correctAnswer: '3/4', explanation: 'The denominators are the same, so add the numerators: 1 + 2 = 3. The result is 3/4.' },
            { id: 'frac-09', prompt: 'Calculate 3/5 - 1/5.', correctAnswer: '2/5', explanation: 'Subtract the numerators and keep the denominator: 3 - 1 = 2, so the result is 2/5.' },
            { id: 'frac-10', prompt: 'What is two-thirds of 12?', correctAnswer: '8', explanation: 'One-third of 12 is 12 ÷ 3 = 4. Two-thirds is 2 × 4 = 8.' },
            { id: 'frac-11', prompt: 'Write 0.5 as a fraction in simplest form.', correctAnswer: '1/2', explanation: '0.5 is five-tenths, or 5/10. Divide the numerator and denominator by 5 to get 1/2.' },
            { id: 'frac-12', prompt: 'Write 0.25 as a fraction in simplest form.', correctAnswer: '1/4', explanation: '0.25 is 25/100. Divide both numbers by 25 to get 1/4.' },
            { id: 'frac-13', prompt: 'Write 3/10 as a decimal.', correctAnswer: '0.3', explanation: 'Three-tenths means 3 divided by 10, which is 0.3.' },
            { id: 'frac-14', prompt: 'Write 0.75 as a fraction in simplest form.', correctAnswer: '3/4', explanation: '0.75 is 75/100. Divide the numerator and denominator by 25 to get 3/4.' },
            { id: 'frac-15', prompt: 'Write 1/2 as a decimal.', correctAnswer: '0.5', explanation: 'One-half is the same as five-tenths, which is written as 0.5.' },
            { id: 'frac-16', prompt: 'Write 0.2 as a fraction in simplest form.', correctAnswer: '1/5', explanation: '0.2 is 2/10. Divide numerator and denominator by 2 to get 1/5.' },
            { id: 'frac-17', prompt: 'Calculate 2/5 + 1/5.', correctAnswer: '3/5', explanation: 'The denominators match, so add the numerators: 2 + 1 = 3. The result is 3/5.' },
            { id: 'frac-18', prompt: 'Calculate 7/8 - 3/8 and write the answer in simplest form.', correctAnswer: '1/2', explanation: '7/8 - 3/8 = 4/8. Divide numerator and denominator by 4 to simplify to 1/2.' },
            { id: 'frac-19', prompt: 'What is three-quarters of 20?', correctAnswer: '15', explanation: 'One-quarter of 20 is 20 ÷ 4 = 5. Three-quarters is 3 × 5 = 15.' },
            { id: 'frac-20', prompt: 'A pizza is cut into 8 equal slices. Three slices are eaten. What fraction of the pizza remains?', correctAnswer: '5/8', explanation: 'There are 8 equal slices and 3 are eaten, leaving 5. The fraction remaining is 5/8.' }
          ]
        };
        const qualityErrors = validateLessonForPublishing(lessonContent);
        if (qualityErrors.length > 0) {
          throw new Error(`Seed fractions lesson failed publishing quality checks: ${qualityErrors.join('; ')}`);
        }

        const existingLesson = await pool.query(
          'SELECT id FROM lessons WHERE skill_id = $1 AND title = $2 LIMIT 1',
          [skill.rows[0].id, 'Fractions: Parts of a Whole and Equivalent Forms']
        );
        if (existingLesson.rows.length === 0) {
          await pool.query(
            `INSERT INTO lessons
              (skill_id, title, description, content, duration_minutes, difficulty_level, status)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
            [skill.rows[0].id,
              'Fractions: Parts of a Whole and Equivalent Forms',
              'Build fraction sense with equivalent forms, fraction operations, and decimal connections.',
              JSON.stringify(lessonContent), 18, 'beginner', 'published']
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
