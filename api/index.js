const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { loadEnv } = require("../src/config/env");
const { getHealthStatus } = require("../src/services/health");

let env;
try {
  env = loadEnv(process.env);
} catch (err) {
  // Load failed (missing vars) — fall back to safe defaults for local dev
  console.warn("env validation failed, falling back to defaults:", err.message);
  env = {
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/url-shortener",
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    BASE_URL: process.env.BASE_URL || "http://localhost:3000",
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}

const app = express();

app.use(helmet());

if (env.NODE_ENV === "production") {
  app.use(cors({ origin: env.BASE_URL }));
} else {
  app.use(cors());
}

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/", (req, res) => res.json({ status: "ok" }));

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
