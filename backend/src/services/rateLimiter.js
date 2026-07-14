/**
 * Sliding window rate limiter using Redis sorted sets.
 * Prevents burst attacks better than fixed-window algorithms.
 */

const logger = require("../lib/logger");
const crypto = require("crypto");
const constants = require("../config/constants");


/**
 * Check rate limit for a client/endpoint combination.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 * resetAt is a Unix timestamp (ms).
 *
 * @param {object} redisClient - Redis ioredis client
 * @param {string} ip - Client IP address
 * @param {string} endpoint - Endpoint identifier (e.g., 'redirect', 'shorten')
 * @param {number} limit - Max requests allowed in the window
 * @param {Date} [now] - Current time (defaults to now)
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
async function checkRateLimit(
  redisClient,
  ip,
  endpoint,
  limit,
  now = new Date(),
) {
  const nowMs = now.getTime();
  const key = `rl:${ip}:${endpoint}`;
  const windowStart = nowMs - constants.RATE_LIMIT.WINDOW_SIZE_MS;

  try {
    // Use pipeline for atomic operations
    const pipeline = redisClient.pipeline();

    // Remove entries older than window
    pipeline.zremrangebyscore(key, "-inf", windowStart);

    // Add current request (score = timestamp, member = timestamp for uniqueness)
    pipeline.zadd(key, nowMs, `${nowMs}-${Math.random()}`);

    // Count requests in window
    pipeline.zcard(key);

    // Set expiry
    pipeline.expire(key, constants.RATE_LIMIT.REDIS_EXPIRY);

    const results = await pipeline.exec();

    // results[2] is the ZCARD result [null, count]
    const requestCount = results[2][1];

    const allowed = requestCount <= limit;
    const remaining = Math.max(0, limit - requestCount);
    const resetAt = nowMs + constants.RATE_LIMIT.WINDOW_SIZE_MS;

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (err) {
    // On Redis error, allow the request (fail open)
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    logger.error({ ipHash, endpoint }, err, "Rate limit check failed");
    return {
      allowed: true,
      remaining: limit,
      resetAt: now.getTime() + constants.RATE_LIMIT.WINDOW_SIZE_MS,
    };
  }
}

/**
 * Rate limit configuration for endpoints.
 */
const RATE_LIMITS = constants.RATE_LIMIT.LIMITS;

/**
 * Apply rate limit headers to a response.
 * @param {object} res - Express response object
 * @param {object} rateLimitResult - Result from checkRateLimit
 * @param {number} limit - The limit for this endpoint
 */
function setRateLimitHeaders(res, rateLimitResult, limit) {
  const now = Date.now();
  const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt - now) / 1000);

  res.set("X-RateLimit-Limit", String(limit));
  res.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
  res.set(
    "X-RateLimit-Reset",
    String(Math.floor(rateLimitResult.resetAt / 1000)),
  );

  if (!rateLimitResult.allowed) {
    res.set("Retry-After", String(retryAfterSeconds));
  }
}

module.exports = {
  checkRateLimit,
  setRateLimitHeaders,
  RATE_LIMITS,
};
