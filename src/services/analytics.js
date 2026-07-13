/**
 * Analytics service implementation.
 * Provides a function to retrieve analytics data for a given slug.
 * It uses Redis caching (TTL 60 seconds) for the aggregated result.
 */
 
const { findActiveUrlBySlug } = require("../data/urlRepository");
const logger = require("../lib/logger");
const {
  aggregateTotalClicks,

  aggregateClicksPerDay,
  aggregateTopReferrers,
  aggregateTopCountries,
} = require("../data/analyticsRepository");

/**
 * Retrieve analytics for a slug.
 * @param {string} slug - Short slug.
 * @param {object} options
 * @param {object} options.redisClient - ioredis client for caching.
 * @param {Date} [options.now] - Current time for expiry checks.
 * @returns {Promise<object|null>} - Analytics object or null if slug not found/expired.
 */
async function getAnalytics(slug, { redisClient, now = new Date() } = {}) {
  const cacheKey = `analytics:${slug}`;

  // Try cache first
  if (redisClient) {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
       try {
         return JSON.parse(cached);
       } catch (_) {
         logger.warn({ slug }, "Malformed analytics cache entry");
         // malformed cache entry – ignore and recompute
       }

    }
  }

  // Verify that the slug exists and is not expired
  const urlRecord = await findActiveUrlBySlug(slug, now);
  if (!urlRecord) {
    return null; // Not found or expired
  }

  // Compute aggregates in parallel
  const [totalClicks, clicksPerDay, topReferrers, topCountries] = await Promise.all([
    aggregateTotalClicks(slug),
    aggregateClicksPerDay(slug, now),
    aggregateTopReferrers(slug),
    aggregateTopCountries(slug),
  ]);

   const result = {
     slug,
     createdAt: urlRecord.createdAt,
     totalClicks,
     clicksPerDay,
     topReferrers,
     topCountries,
   };

  // Cache result for 60 seconds if cache available
   if (redisClient) {
     try {
       await redisClient.set(cacheKey, JSON.stringify(result), "EX", 60);
     } catch (_) {
       logger.warn({ slug }, "Failed to write analytics cache");
       // ignore cache write errors – analytics still works
     }
   }


  return result;
}

module.exports = {
  getAnalytics,
};
