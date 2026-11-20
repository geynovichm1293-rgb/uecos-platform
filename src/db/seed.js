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

      // Seed a third starter slice for geometry and measurement.
      const geometryTopic = await pool.query(
        'SELECT id FROM topics WHERE subject_id = $1 AND name = $2 AND status = $3',
        [mathSubjectId, 'Geometry Basics', 'published']
      );
      if (geometryTopic.rows.length > 0) {
        const topicId = geometryTopic.rows[0].id;
        let skill = await pool.query(
          'SELECT id FROM skills WHERE topic_id = $1 AND name = $2 LIMIT 1',
          [topicId, 'Shape Properties and Measurement']
        );
        if (skill.rows.length === 0) {
          skill = await pool.query(
            `INSERT INTO skills (topic_id, name, description, difficulty_level, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [topicId, 'Shape Properties and Measurement',
              'Recognize common shapes, describe their properties, and calculate simple perimeter and area.',
              'beginner', 'published']
          );
        }

        const lessonContent = {
          overview: 'Explore common two-dimensional shapes, angle facts, and the difference between perimeter and area.',
          learningObjectives: [
            'Identify common shapes and describe their sides, angles, and circle measurements',
            'Use right-angle and triangle angle facts to classify shapes',
            'Calculate the perimeter of squares and rectangles',
            'Calculate the area of squares and rectangles using square units'
          ],
          sections: [
            {
              title: 'Describe shapes by their properties',
              body: 'A polygon is a closed shape made from straight line segments. Triangles have three sides and quadrilaterals have four. A circle is a curved shape with a center, radius, and diameter.'
            },
            {
              title: 'Understand angles',
              body: 'A right angle measures 90 degrees. The interior angles of a triangle add to 180 degrees. An obtuse angle is greater than 90 degrees and less than 180 degrees.'
            },
            {
              title: 'Perimeter measures the boundary',
              body: 'Perimeter is the total distance around a two-dimensional shape. Add all side lengths. For a rectangle, use 2 × (length + width).'
            },
            {
              title: 'Area measures the surface inside',
              body: 'Area counts square units covering the inside of a shape. For a rectangle, multiply length by width. For a square, multiply the side length by itself.'
            }
          ],
          workedExamples: [
            {
              prompt: 'Find the perimeter of a rectangle with length 5 cm and width 3 cm.',
              solution: 'Add all four sides: 5 + 3 + 5 + 3 = 16 cm.'
            },
            {
              prompt: 'Find the area of the same rectangle.',
              solution: 'Multiply length by width: 5 × 3 = 15 square centimeters.'
            }
          ],
          questions: [
            { id: 'geo-01', prompt: 'How many sides does a triangle have?', correctAnswer: '3', explanation: 'A triangle is a polygon with exactly three straight sides and three angles.' },
            { id: 'geo-02', prompt: 'How many sides does a square have?', correctAnswer: '4', explanation: 'A square is a quadrilateral, so it has four straight sides.' },
            { id: 'geo-03', prompt: 'What is the name for the distance around a circle?', correctAnswer: 'circumference', explanation: 'The circumference is the distance around the boundary of a circle.' },
            { id: 'geo-04', prompt: 'What is the name of a segment from the center of a circle to its edge?', correctAnswer: 'radius', explanation: 'A radius connects the center of a circle to a point on its circumference.' },
            { id: 'geo-05', prompt: 'What is the name of a segment that crosses a circle through its center and touches both sides?', correctAnswer: 'diameter', explanation: 'The diameter passes through the center and equals two radii.' },
            { id: 'geo-06', prompt: 'A circle has a diameter of 10 cm. What is its radius?', correctAnswer: '5', explanation: 'The radius is half the diameter: 10 ÷ 2 = 5 cm.' },
            { id: 'geo-07', prompt: 'What is the measure of a right angle in degrees?', correctAnswer: '90', explanation: 'A right angle always measures exactly 90 degrees.' },
            { id: 'geo-08', prompt: 'What is the sum of the interior angles of a triangle?', correctAnswer: '180', explanation: 'The three interior angles in every triangle add to 180 degrees.' },
            { id: 'geo-09', prompt: 'A square has side length 4 cm. What is its perimeter?', correctAnswer: '16', explanation: 'A square has four equal sides. Its perimeter is 4 + 4 + 4 + 4 = 16 cm.' },
            { id: 'geo-10', prompt: 'A rectangle is 5 cm long and 3 cm wide. What is its perimeter?', correctAnswer: '16', explanation: 'Add the four sides: 5 + 3 + 5 + 3 = 16 cm.' },
            { id: 'geo-11', prompt: 'A rectangle is 5 cm long and 3 cm wide. What is its area in square centimeters?', correctAnswer: '15', explanation: 'Area equals length times width: 5 × 3 = 15 square centimeters.' },
            { id: 'geo-12', prompt: 'A square has side length 6 cm. What is its area in square centimeters?', correctAnswer: '36', explanation: 'Area of a square is side length multiplied by itself: 6 × 6 = 36 square centimeters.' },
            { id: 'geo-13', prompt: 'What do you call a triangle with three equal sides?', correctAnswer: 'equilateral', explanation: 'An equilateral triangle has three sides of equal length and three equal angles.' },
            { id: 'geo-14', prompt: 'What do you call a triangle with exactly two equal sides?', correctAnswer: 'isosceles', explanation: 'An isosceles triangle has at least two sides of equal length.' },
            { id: 'geo-15', prompt: 'What is an angle greater than 90 degrees but less than 180 degrees called?', correctAnswer: 'obtuse', explanation: 'An obtuse angle is wider than a right angle but smaller than a straight angle.' },
            { id: 'geo-16', prompt: 'What is an angle smaller than 90 degrees called?', correctAnswer: 'acute', explanation: 'An acute angle measures more than 0 degrees and less than 90 degrees.' },
            { id: 'geo-17', prompt: 'In the coordinate point (3, 2), what is the x-coordinate?', correctAnswer: '3', explanation: 'Coordinates are written (x, y). The first number is the x-coordinate.' },
            { id: 'geo-18', prompt: 'A rectangle is 8 m long and 4 m wide. What is its area in square meters?', correctAnswer: '32', explanation: 'Multiply length by width: 8 × 4 = 32 square meters.' },
            { id: 'geo-19', prompt: 'A rectangle is 8 m long and 4 m wide. What is its perimeter in meters?', correctAnswer: '24', explanation: 'Add all sides: 8 + 4 + 8 + 4 = 24 meters.' },
            { id: 'geo-20', prompt: 'A rectangle has an area of 24 square centimeters and a width of 4 cm. What is its length?', correctAnswer: '6', explanation: 'Area equals length × width. Divide 24 by 4 to find the length: 6 cm.' }
          ]
        };
        const qualityErrors = validateLessonForPublishing(lessonContent);
        if (qualityErrors.length > 0) {
          throw new Error(`Seed geometry lesson failed publishing quality checks: ${qualityErrors.join('; ')}`);
        }

        const existingLesson = await pool.query(
          'SELECT id FROM lessons WHERE skill_id = $1 AND title = $2 LIMIT 1',
          [skill.rows[0].id, 'Geometry: Shape Properties, Perimeter, and Area']
        );
        if (existingLesson.rows.length === 0) {
          await pool.query(
            `INSERT INTO lessons
              (skill_id, title, description, content, duration_minutes, difficulty_level, status)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
            [skill.rows[0].id,
              'Geometry: Shape Properties, Perimeter, and Area',
              'Recognize shapes and solve introductory geometry and measurement problems.',
              JSON.stringify(lessonContent), 18, 'beginner', 'published']
          );
        }
      }

      // Seed a fourth starter slice for introductory algebra.
      const algebraTopic = await pool.query(
        'SELECT id FROM topics WHERE subject_id = $1 AND name = $2 AND status = $3',
        [mathSubjectId, 'Algebra Fundamentals', 'published']
      );
      if (algebraTopic.rows.length > 0) {
        const topicId = algebraTopic.rows[0].id;
        let skill = await pool.query(
          'SELECT id FROM skills WHERE topic_id = $1 AND name = $2 LIMIT 1',
          [topicId, 'Variables and One-Step Equations']
        );
        if (skill.rows.length === 0) {
          skill = await pool.query(
            `INSERT INTO skills (topic_id, name, description, difficulty_level, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [topicId, 'Variables and One-Step Equations',
              'Understand variables, write simple expressions, and solve one-step and introductory two-step equations.',
              'beginner', 'published']
          );
        }

        const lessonContent = {
          overview: 'Use variables to represent unknown values and solve equations by keeping both sides balanced.',
          learningObjectives: [
            'Explain what a variable represents in an expression or equation',
            'Translate simple verbal descriptions into algebraic expressions',
            'Solve one-step addition, subtraction, multiplication, and division equations',
            'Solve introductory two-step equations using inverse operations'
          ],
          sections: [
            {
              title: 'Variables represent values',
              body: 'A variable is a letter or symbol that stands for a number. An expression such as x + 3 describes a value that depends on x.'
            },
            {
              title: 'Equations express equality',
              body: 'An equation says that two expressions have the same value. The equals sign means both sides are balanced, not that the answer comes next.'
            },
            {
              title: 'Use inverse operations',
              body: 'Addition and subtraction undo each other. Multiplication and division undo each other. Apply the same operation to both sides to keep an equation balanced.'
            },
            {
              title: 'Translate words into expressions',
              body: 'More than usually signals addition, less than signals subtraction, twice means multiply by 2, and a quotient describes division. Define the variable before writing the expression.'
            }
          ],
          workedExamples: [
            {
              prompt: 'Solve x + 4 = 11.',
              solution: 'Subtract 4 from both sides: x = 11 - 4 = 7. Check: 7 + 4 = 11.'
            },
            {
              prompt: 'Solve 2y + 3 = 13.',
              solution: 'Subtract 3 from both sides to get 2y = 10. Divide both sides by 2, so y = 5.'
            }
          ],
          questions: [
            { id: 'alg-01', prompt: 'Solve x + 3 = 8.', correctAnswer: '5', explanation: 'Subtract 3 from both sides: x = 8 - 3 = 5.' },
            { id: 'alg-02', prompt: 'Solve y - 4 = 6.', correctAnswer: '10', explanation: 'Add 4 to both sides: y = 6 + 4 = 10.' },
            { id: 'alg-03', prompt: 'Solve 2a = 14.', correctAnswer: '7', explanation: 'Divide both sides by 2: a = 14 ÷ 2 = 7.' },
            { id: 'alg-04', prompt: 'Solve b/3 = 5.', correctAnswer: '15', explanation: 'Multiply both sides by 3: b = 5 × 3 = 15.' },
            { id: 'alg-05', prompt: 'Solve n + 9 = 12.', correctAnswer: '3', explanation: 'Subtract 9 from both sides: n = 12 - 9 = 3.' },
            { id: 'alg-06', prompt: 'Solve 18 - c = 11.', correctAnswer: '7', explanation: 'Subtract 11 from 18 to find c: c = 7. Check: 18 - 7 = 11.' },
            { id: 'alg-07', prompt: 'Solve 4x = 28.', correctAnswer: '7', explanation: 'Divide both sides by 4: x = 28 ÷ 4 = 7.' },
            { id: 'alg-08', prompt: 'Solve p/5 = 4.', correctAnswer: '20', explanation: 'Multiply both sides by 5: p = 4 × 5 = 20.' },
            { id: 'alg-09', prompt: 'Solve 2x + 3 = 11.', correctAnswer: '4', explanation: 'Subtract 3 to get 2x = 8, then divide by 2 to get x = 4.' },
            { id: 'alg-10', prompt: 'Solve 3y - 2 = 13.', correctAnswer: '5', explanation: 'Add 2 to get 3y = 15, then divide by 3 to get y = 5.' },
            { id: 'alg-11', prompt: 'Solve 5 + x = 14.', correctAnswer: '9', explanation: 'Subtract 5 from both sides: x = 14 - 5 = 9.' },
            { id: 'alg-12', prompt: 'Solve x/4 + 2 = 5.', correctAnswer: '12', explanation: 'Subtract 2 to get x/4 = 3, then multiply by 4 to get x = 12.' },
            { id: 'alg-13', prompt: 'Solve 2(a + 3) = 14.', correctAnswer: '4', explanation: 'Divide both sides by 2 to get a + 3 = 7, then subtract 3 to get a = 4.' },
            { id: 'alg-14', prompt: 'Solve 3x + 6 = 21.', correctAnswer: '5', explanation: 'Subtract 6 to get 3x = 15, then divide by 3 to get x = 5.' },
            { id: 'alg-15', prompt: 'Solve 20 - 2m = 8.', correctAnswer: '6', explanation: 'Subtract 20 from both sides to get -2m = -12, then divide by -2 to get m = 6.' },
            { id: 'alg-16', prompt: 'Solve 7n = 49.', correctAnswer: '7', explanation: 'Divide both sides by 7: n = 49 ÷ 7 = 7.' },
            { id: 'alg-17', prompt: 'If x = 3, what is the value of 2x + 5?', correctAnswer: '11', explanation: 'Substitute 3 for x: 2(3) + 5 = 6 + 5 = 11.' },
            { id: 'alg-18', prompt: 'If y = 4, what is the value of y squared plus 1?', correctAnswer: '17', explanation: 'Substitute 4 for y: 4² + 1 = 16 + 1 = 17.' },
            { id: 'alg-19', prompt: 'Write an algebraic expression for five more than t.', acceptedAnswers: ['t + 5', '5 + t'], explanation: 'Five more than t means add 5 to t. Addition can be written in either order.' },
            { id: 'alg-20', prompt: 'Write an algebraic expression for twice a number n, decreased by 3.', correctAnswer: '2n - 3', explanation: 'Twice n is 2n. Decreased by 3 means subtract 3, giving 2n - 3.' }
          ]
        };
        const qualityErrors = validateLessonForPublishing(lessonContent);
        if (qualityErrors.length > 0) {
          throw new Error(`Seed algebra lesson failed publishing quality checks: ${qualityErrors.join('; ')}`);
        }

        const existingLesson = await pool.query(
          'SELECT id FROM lessons WHERE skill_id = $1 AND title = $2 LIMIT 1',
          [skill.rows[0].id, 'Algebra: Variables and One- and Two-Step Equations']
        );
        if (existingLesson.rows.length === 0) {
          await pool.query(
            `INSERT INTO lessons
              (skill_id, title, description, content, duration_minutes, difficulty_level, status)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
            [skill.rows[0].id,
              'Algebra: Variables and One- and Two-Step Equations',
              'Use variables and inverse operations to solve introductory algebra problems.',
              JSON.stringify(lessonContent), 20, 'beginner', 'published']
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
