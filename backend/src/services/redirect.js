const { findActiveUrlBySlug } = require("../data/urlRepository");
const logger = require("../lib/logger");
const constants = require("../config/constants");


/**
 * Retrieve a URL for redirect, with Redis-first lookup and MongoDB fallback.
 * If found in MongoDB, repopulates the Redis cache.
 * Validates expiry on every access (soft-expiry check).
 *
 * @param {string} slug - The short slug to look up
 * @param {object} cacheClient - Redis ioredis client
 * @param {Date} [now] - Current time (for expiry checks)
 * @returns {Promise<string|null>} - Original URL or null if not found/expired
 */
async function getRedirectUrl(slug, cacheClient, now = new Date()) {
  const cacheKey = `url:${slug}`;

  // Try Redis first
  const cachedMetadata = await cacheClient.get(cacheKey);
  if (cachedMetadata) {
    try {
      const metadata = JSON.parse(cachedMetadata);
      const { originalUrl, expiresAt } = metadata;

      // Check if the cached entry has expired
      if (expiresAt) {
        const expiryTime = new Date(expiresAt);
        if (now >= expiryTime) {
          // Soft-expired: delete from cache and return null
          await cacheClient.del(cacheKey).catch(() => {});
          return null;
        }
      }

      return originalUrl;
    } catch (_err) {
      logger.warn({ slug }, "Malformed cache entry for redirect");
      // Malformed cache entry; treat as miss
    }
  }

  // Cache miss — fall back to MongoDB
  const urlRecord = await findActiveUrlBySlug(slug, now);
  if (!urlRecord) {
    // Not found or expired
    return null;
  }

  // Repopulate Redis cache with the found URL and its expiry
  const metadata = {
    originalUrl: urlRecord.originalUrl,
    expiresAt: urlRecord.expiresAt ? urlRecord.expiresAt.toISOString() : null,
  };
    await cacheClient.set(
      cacheKey,
      JSON.stringify(metadata),
      "EX",
      constants.CACHE.REDIRECT_TTL_SECONDS,
    ).catch((err) => {
    logger.warn({ slug, err }, "Failed to repopulate redirect cache");
  });

  return urlRecord.originalUrl;
}

module.exports = {
  getRedirectUrl,
};
