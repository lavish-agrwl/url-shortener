const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { loadEnv } = require("../src/config/env");
const { getHealthStatus } = require("../src/services/health");
const { createShortUrl } = require("../src/services/shorten");

let env;
try {
  env = loadEnv(process.env);
} catch (err) {
  // Load failed (missing vars) — fall back to safe defaults for local dev
  console.warn("env validation failed, falling back to defaults:", err.message);
  env = {
    MONGODB_URI:
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/url-shortener",
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    BASE_URL: process.env.BASE_URL || "http://localhost:3000",
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}

const app = express();

app.use(helmet());
app.use(express.json());

if (env.NODE_ENV === "production") {
  app.use(cors({ origin: env.BASE_URL }));
} else {
  app.use(cors());
}

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/", (req, res) => res.json({ status: "ok" }));

app.post("/api/shorten", async (req, res) => {
  try {
    const shortened = await createShortUrl(req.body, {
      baseUrl: env.BASE_URL,
      now: new Date(),
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
    res.status(503).json({
      status: "degraded",
      redis: "disconnected",
      mongodb: "disconnected",
      queueDepth: 0,
      error: err.message,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on ${port} (env=${env.NODE_ENV})`);
});
