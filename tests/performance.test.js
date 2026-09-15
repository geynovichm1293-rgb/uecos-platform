/**
 * Performance benchmarks for UECOS Platform
 */

import assert from 'assert';
import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const client = axios.create({ baseURL: API_BASE });

const THRESHOLDS = {
  healthCheck: 100,      // ms
  apiResponse: 200,      // ms
  dashboard: 500,        // ms
  search: 1000           // ms
};

const test = await import('node:test');

test.describe('Performance Benchmarks', () => {
  test.it('Health check should respond in <100ms', async () => {
    const start = Date.now();
    await client.get('/health');
    const duration = Date.now() - start;
    
    assert.ok(duration < THRESHOLDS.healthCheck, `Health check took ${duration}ms, should be <${THRESHOLDS.healthCheck}ms`);
  });
  
  test.it('API endpoints should respond in <200ms', async () => {
    const start = Date.now();
    try {
      await client.get('/api/content/subjects');
    } catch (error) {
      // OK if 401, still counts as response
    }
    const duration = Date.now() - start;
    
    assert.ok(duration < THRESHOLDS.apiResponse, `API took ${duration}ms, should be <${THRESHOLDS.apiResponse}ms`);
  });
});
