import assert from 'assert';
import { hashPassword, comparePassword, createToken, verifyToken } from '../services/auth.js';

const test = await import('node:test');

test.describe('Authentication Service', () => {
  test.it('should hash and compare passwords correctly', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    assert.ok(hash !== password, 'Hash should differ from password');
    
    const isValid = await comparePassword(password, hash);
    assert.strictEqual(isValid, true, 'Password comparison should succeed');
    
    const isInvalid = await comparePassword('WrongPassword', hash);
    assert.strictEqual(isInvalid, false, 'Invalid password should not match');
  });
  
  test.it('should create and verify JWT tokens', () => {
    const userId = 123;
    const role = 'learner';
    const token = createToken(userId, role);
    
    assert.ok(token, 'Token should be created');
    
    const payload = verifyToken(token);
    assert.strictEqual(payload.userId, userId, 'Token should contain correct userId');
    assert.strictEqual(payload.role, role, 'Token should contain correct role');
  });
  
  test.it('should reject invalid tokens', () => {
    const invalidToken = 'invalid.token.here';
    const payload = verifyToken(invalidToken);
    
    assert.strictEqual(payload, null, 'Invalid token should return null');
  });
});
