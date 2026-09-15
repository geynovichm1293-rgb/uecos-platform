import assert from 'assert';
import { getPool } from '../db/init.js';

const test = await import('node:test');

test.describe('Database Integrity Tests', () => {
  test.it('should enforce foreign key constraints', async () => {
    const pool = getPool();
    
    try {
      // Attempt to insert orphaned learner
      await pool.query(
        'INSERT INTO learners (user_id, first_name) VALUES ($1, $2)',
        [99999, 'Orphan']
      );
      
      assert.fail('Should not allow orphaned record');
    } catch (error) {
      assert.ok(error.message.includes('foreign key'), 'Should fail on foreign key violation');
    }
  });
  
  test.it('should prevent duplicate unique entries', async () => {
    const pool = getPool();
    
    try {
      const email = `test-${Date.now()}@example.com`;
      
      // First insert should succeed
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        [email, 'hash', 'learner']
      );
      
      // Second insert with same email should fail
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        [email, 'hash', 'learner']
      );
      
      assert.fail('Should not allow duplicate email');
    } catch (error) {
      assert.ok(error.message.includes('unique'), 'Should fail on unique constraint');
    }
  });
});
