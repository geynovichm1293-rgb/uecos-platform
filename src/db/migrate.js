#!/usr/bin/env node

/**
 * Database migration runner
 */

import { initializeDatabase } from './init.js';
import { logger } from '../utils/logger.js';

async function runMigrations() {
  try {
    logger.info('🚀 Starting database migrations...');
    await initializeDatabase();
    logger.info('✅ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
