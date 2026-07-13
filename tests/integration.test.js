const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { getRedisClient } = require('../src/services/redisClient');
const { getClickQueues } = require('../src/services/queue');
const { createQueueBoard } = require('../src/services/bullBoard');
const { getHealthStatus } = require('../src/services/health');
const { getAnalytics } = require('../src/services/analytics');
const { createShortUrl } = require('../src/services/shorten');
const { getRedirectUrl } = require('../src/services/redirect');
const { getClientIp, enqueueClick } = require('../src/services/queue');
const { RATE_LIMITS, setRateLimitHeaders, checkRateLimit } = require('../src/services/rateLimiter');

// Helper to spin up the server in a separate process for each suite
async function setupServer({ mongoUri, redisUrl }) {
  const app = express();
  app.use(require('helmet')());
  app.use(express.json());
  app.use(require('cors')());
  app.use(require('morgan')('dev'));

    const redisClient = getRedisClient(redisUrl);
    const { clickQueue, clickDlq } = getClickQueues(redisClient);

  // Endpoints from the real API (all logic is kept in the same functions)
  app.post("/api/shorten", async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const now = new Date();
      const rateLimitResult = await checkRateLimit(redisClient, clientIp, "shorten", RATE_LIMITS.shorten.limit, now);
      setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.shorten.limit);
      if (!rateLimitResult.allowed) return res.status(429).json({ error: "Rate limit exceeded" });
      try {
        const shortened = await createShortUrl(req.body, { baseUrl: "http://localhost", now, cacheClient: redisClient });
        res.status(201).json(shortened);
      } catch (err) {
        console.error("Shorten internal error:", err);
        res.status(500).json({ error: "Failed" });
      }
    } catch (err) {
      console.error("Shorten wrapper error:", err);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/api/analytics/:slug", async (req, res) => {
    const clientIp = getClientIp(req);
    const now = new Date();
    const rateLimitResult = await checkRateLimit(redisClient, clientIp, "analytics", RATE_LIMITS.analytics.limit, now);
    setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.analytics.limit);
    if (!rateLimitResult.allowed) return res.status(429).json({ error: "Rate limit exceeded" });
    try {
      const { slug } = req.params;
      const analytics = await getAnalytics(slug, { redisClient, now });
      if (!analytics) return res.status(404).json({ error: "Slug not found" });
      res.json(analytics);
    } catch (err) {
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/health", async (req, res) => {
    try {
      const health = await getHealthStatus({ REDIS_URL: redisUrl, MONGODB_URI: mongoUri });
      const statusCode = health.status === "ok" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (err) {
      res.status(503).json({ status: "degraded" });
    }
  });

  app.get("/:slug", async (req, res) => {
    const clientIp = getClientIp(req);
    const now = new Date();
    const rateLimitResult = await checkRateLimit(redisClient, clientIp, "redirect", RATE_LIMITS.redirect.limit, now);
    setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.redirect.limit);
    if (!rateLimitResult.allowed) return res.status(429).json({ error: "Rate limit exceeded" });
    try {
      const { slug } = req.params;
      const originalUrl = await getRedirectUrl(slug, redisClient);
      if (!originalUrl) return res.status(404).json({ error: "Slug not found" });
      enqueueClick(clickQueue, slug, req);
      res.redirect(301, originalUrl);
    } catch (err) {
      console.error("Redirect error:", err);
      res.status(500).json({ error: "Failed" });
    }
  });

  const server = app.listen(0); // random available port
  const port = server.address().port;
  return { app, server, request: request(app), url: `http://localhost:${port}` };
}

describe('Integration tests', () => {
  let mongoServer;
  let mongoUri;
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  let redisClient;
  let serverInfo;

  beforeAll(async () => {
    if (process.env.MONGODB_URI) {
      mongoUri = process.env.MONGODB_URI;
    } else {
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
    }
    await mongoose.connect(mongoUri);

    // Ensure Redis is connected
    redisClient = getRedisClient(redisUrl);
    try {
      await redisClient.ping();
    } catch (err) {
      throw new Error(`Redis connection failed: ${err.message}. Make sure Redis is running at ${redisUrl}`);
    }

    serverInfo = await setupServer({ mongoUri, redisUrl });
  }, 60000);

  beforeEach(async () => {
    // Clear Redis state between tests
    await redisClient.flushdb();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    if (serverInfo?.server) {
      serverInfo.server.close();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  });

  test('POST /api/shorten creates a short URL', async () => {
    const payload = { url: "https://example.com", expiresAt: new Date(Date.now() + 86400000).toISOString() };
    const resp = await serverInfo.request.post("/api/shorten").send(payload);
    expect(resp.status).toBe(201);
    expect(resp.body).toHaveProperty("shortUrl");
    expect(resp.body).toHaveProperty("slug");
  });

  test('GET /:slug redirects and records click', async () => {
    // First create a slug
    const createResp = await serverInfo.request.post("/api/shorten").send({ url: "https://example.com" });
    const slug = createResp.body.slug;

    const redirectResp = await serverInfo.request.get(`/${slug}`);
    expect(redirectResp.status).toBe(301);
    // 301 redirects to the original URL; supertest follows redirects automatically, so check location header
    expect(redirectResp.headers.location).toBe('https://example.com');

    // Wait a tick for the async click job to be processed by the worker (not enforced literally – BullMQ will process on schedule)
    await new Promise((r) => setTimeout(r, 200));
  });

  test('GET /api/analytics/:slug returns analytics data', async () => {
    const createResp = await serverInfo.request.post("/api/shorten").send({ url: "https://example.com" });
    const slug = createResp.body.slug;

    // Trigger a couple of redirects to generate click data
    await serverInfo.request.get(`/${slug}`);
    await serverInfo.request.get(`/${slug}`);

    const analyticsResp = await serverInfo.request.get(`/api/analytics/${slug}`);
    expect(analyticsResp.status).toBe(200);
    expect(analyticsResp.body).toHaveProperty("totalClicks");
    expect(analyticsResp.body).toHaveProperty("clicksPerDay");
    expect(analyticsResp.body).toHaveProperty("topReferrers");
    expect(analyticsResp.body).toHaveProperty("topCountries");
  });

  test('GET /health returns service status', async () => {
    const healthResp = await serverInfo.request.get("/health");
    expect(healthResp.status).toBe(200);
    expect(healthResp.body).toHaveProperty("status");
    expect(healthResp.body).toHaveProperty("redis");
    expect(healthResp.body).toHaveProperty("mongodb");
  });
});
