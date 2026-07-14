/**
 * Centralized application constants and configuration.
 */

module.exports = {
  APP: {
    PORT: process.env.PORT || 3000,
  },
  REDIS: {
    DEFAULT_HOST: "127.0.0.1",
    DEFAULT_PORT: 6379,
    DEFAULT_URL: "redis://localhost:6379",
    CONNECTION_OPTIONS: {
      maxRetriesPerRequest: null,
    },
  },
  QUEUE: {
    CLICK_EVENTS_QUEUE: "click-events",
    CLICK_EVENTS_DLQ: "click-events-dlq",
    DEFAULT_JOB_OPTIONS: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
    BATCH_WORKER: {
      DEFAULT_BATCH_SIZE: 50,
      DEFAULT_FLUSH_INTERVAL_MS: 5000,
      DEFAULT_SHUTDOWN_TIMEOUT_MS: 10000,
    },
  },
  RATE_LIMIT: {
    WINDOW_SIZE_MS: 60 * 1000,
    REDIS_EXPIRY: 120,
    LIMITS: {
      redirect: {
        limit: 60,
        windowMs: 60 * 1000,
      },
      shorten: {
        limit: 10,
        windowMs: 60 * 1000,
      },
      analytics: {
        limit: 30,
        windowMs: 60 * 1000,
      },
    },
  },
  CACHE: {
    REDIRECT_TTL_SECONDS: 86400, // 24 hours
  },
  SLUG: {
    BASE62_ALPHABET: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    DEFAULT_LENGTH: 7,
    MAX_ATTEMPTS: 5,
  },
  TIME: {
    THIRTY_DAYS_IN_MS: 30 * 24 * 60 * 60 * 1000,
    NINETY_DAYS_IN_SECONDS: 90 * 24 * 60 * 60,
  },
};
