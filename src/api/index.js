const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");

const { loadEnv } = require("../config/env");
const { getHealthStatus } = require("../services/health");
const { getRedisClient } = require("../services/redisClient");
const { createQueueBoard } = require("../services/bullBoard");
const { createShortUrl } = require("../services/shorten");
const { getRedirectUrl } = require("../services/redirect");
const { getAnalytics } = require("../services/analytics");
const { listUrls } = require("../services/urlList");

const {
  getClickQueues,
  enqueueClick,
  getClientIp,
} = require("../services/queue");
const logger = require("../lib/logger");
const {
  checkRateLimit,
  setRateLimitHeaders,
  RATE_LIMITS,
} = require("../services/rateLimiter");

const env = loadEnv(process.env);

const app = express();
const redisClient = getRedisClient(env.REDIS_URL);
// Extract Redis connection from URL for BullMQ
const redisUrl = new URL(env.REDIS_URL);
const redisConnection = {
  host: redisUrl.hostname || "127.0.0.1",
  port: parseInt(redisUrl.port || "6379", 10),
};
const { clickQueue, clickDlq } = getClickQueues(redisConnection);

app.use(helmet());
app.use(express.json());

if (env.NODE_ENV === "production") {
  app.use(cors({ origin: env.BASE_URL }));
} else {
  app.use(cors());
}

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.use("/dashboard", express.static(path.join(__dirname, "../../dashboard")));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../../dashboard/index.html"));
});

app.get("/", (req, res) => res.json({ status: "ok" }));

app.use("/admin/queues", createQueueBoard({ clickQueue, clickDlq }));

app.post("/api/shorten", async (req, res) => {
  const clientIp = getClientIp(req);
  const now = new Date();
  const rateLimitResult = await checkRateLimit(
    redisClient,
    clientIp,
    "shorten",
    RATE_LIMITS.shorten.limit,
    now,
  );

  setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.shorten.limit);

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const shortened = await createShortUrl(req.body, {
      baseUrl: env.BASE_URL,
      now,
      cacheClient: redisClient,
    });

    res.status(201).json(shortened);
  } catch (err) {
    if (err && err.name === "ZodError") {
      return res.status(400).json({
        error: "Invalid request body",
        issues: err.issues,
      });
    }

    if (err && err.statusCode === 409) {
      return res.status(409).json({
        error: "Custom slug already taken",
      });
    }

    logger.error({ err }, "Unexpected error during URL shortening");
    res.status(500).json({
      error: "Failed to shorten URL",
    });
  }
});

app.get("/health", async (req, res) => {
  try {
    const health = await getHealthStatus(env);
    const statusCode = health.status === "ok" ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (err) {
    logger.error({ err }, "Health check failure");
    res.status(503).json({
      status: "degraded",
      redis: "disconnected",
      mongodb: "disconnected",
      queueDepth: 0,
      error: err.message,
    });
  }
});

app.get("/api/analytics/:slug", async (req, res) => {
  const clientIp = getClientIp(req);
  const now = new Date();
  const rateLimitResult = await checkRateLimit(
    redisClient,
    clientIp,
    "analytics",
    RATE_LIMITS.analytics.limit,
    now,
  );
  setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.analytics.limit);

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const { slug } = req.params;
    const analytics = await getAnalytics(slug, { redisClient, now });
    if (!analytics) {
      return res.status(404).json({ error: "Slug not found or expired" });
    }
    res.json(analytics);
  } catch (err) {
    logger.error({ slug: req.params.slug, err }, "Failed to retrieve analytics");
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});

app.get("/api/urls", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = parseInt(req.query.skip, 10) || 0;
    const urls = await listUrls({ limit, skip });
    res.json(urls);
  } catch (err) {
    logger.error({ limit: req.query.limit, skip: req.query.skip, err }, "Failed to retrieve URLs");
    res.status(500).json({ error: "Failed to retrieve URLs" });
  }
});

app.get("/:slug", async (req, res) => {
  const clientIp = getClientIp(req);
  const now = new Date();
  const rateLimitResult = await checkRateLimit(
    redisClient,
    clientIp,
    "redirect",
    RATE_LIMITS.redirect.limit,
    now,
  );

  setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.redirect.limit);

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const { slug } = req.params;
    const originalUrl = await getRedirectUrl(slug, redisClient);

    if (!originalUrl) {
      return res.status(404).json({ error: "Slug not found or expired" });
    }

    // Enqueue click event asynchronously (fire-and-forget, non-blocking)
    enqueueClick(clickQueue, slug, req);

    res.redirect(301, originalUrl);
  } catch (err) {
    logger.error({ slug: req.params.slug, err }, "Redirect failure");
    res.status(500).json({
      error: "Failed to redirect",
    });
  }
});

const port = process.env.PORT || 3000;

mongoose
  .connect(env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => {
      logger.info({ port, env: env.NODE_ENV }, "API listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB");
    process.exit(1);
  });
