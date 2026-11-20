import { createHmac } from 'node:crypto';
import { getPool } from '../db/init.js';
import { logger } from '../utils/logger.js';

let requestsSinceCleanup = 0;
const RATE_LIMIT_HASH_SECRET = process.env.RATE_LIMIT_HASH_SECRET || process.env.JWT_SECRET;
if (!RATE_LIMIT_HASH_SECRET || RATE_LIMIT_HASH_SECRET.length < 32) {
  throw new Error('A 32-character RATE_LIMIT_HASH_SECRET or JWT_SECRET is required.');
}

function hashBucketKey(value) {
  return createHmac('sha256', RATE_LIMIT_HASH_SECRET).update(value).digest('hex');
}

/**
 * PostgreSQL-backed fixed-window rate limiter.
 * Counts both caller IP and normalized email; stores only hashed bucket keys.
 */
export function rateLimit({ scope, windowMs, max }) {
  if (!scope || !Number.isInteger(windowMs) || windowMs < 1000 ||
      !Number.isInteger(max) || max < 1) {
    throw new Error('Rate-limit configuration is invalid.');
  }

  return (req, res, next) => {
    (async () => {
      const pool = getPool();
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const email = typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : null;
      const rawKeys = [`${scope}:ip:${ip}`];
      if (email) rawKeys.push(`${scope}:email:${email}`);

      for (const rawKey of rawKeys) {
        const bucketKey = hashBucketKey(rawKey);
        const result = await pool.query(
          `INSERT INTO api_rate_limits (bucket_key, window_started_at, request_count)
           VALUES ($1, NOW(), 1)
           ON CONFLICT (bucket_key) DO UPDATE SET
             request_count = CASE
               WHEN api_rate_limits.window_started_at <= NOW() - ($2::double precision * INTERVAL '1 millisecond')
               THEN 1
               ELSE api_rate_limits.request_count + 1
             END,
             window_started_at = CASE
               WHEN api_rate_limits.window_started_at <= NOW() - ($2::double precision * INTERVAL '1 millisecond')
               THEN NOW()
               ELSE api_rate_limits.window_started_at
             END
           RETURNING request_count, window_started_at`,
          [bucketKey, windowMs]
        );

        const bucket = result.rows[0];
        if (bucket.request_count > max) {
          const resetAt = new Date(new Date(bucket.window_started_at).getTime() + windowMs);
          const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
          res.setHeader('Retry-After', String(retryAfter));
          res.setHeader('RateLimit-Limit', String(max));
          logger.warn('Authentication rate limit exceeded', { scope });
          res.status(429).json({ error: 'Too many requests. Please try again later.' });
          return;
        }
      }

      requestsSinceCleanup += 1;
      if (requestsSinceCleanup >= 100) {
        requestsSinceCleanup = 0;
        pool.query("DELETE FROM api_rate_limits WHERE window_started_at < NOW() - INTERVAL '24 hours'")
          .catch(error => logger.warn('Rate-limit cleanup failed', { error: error.message }));
      }

      next();
    })().catch(next);
  };
}
