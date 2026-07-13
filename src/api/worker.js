const { loadEnv } = require("../config/env");
const { CLICK_EVENTS_QUEUE } = require("../services/queue");
const { createClickBatchWorker } = require("../services/clickBatchWorker");
const mongoose = require("mongoose");

const env = loadEnv(process.env);
const redisUrl = new URL(env.REDIS_URL);
const redisConnection = {
  host: redisUrl.hostname || "127.0.0.1",
  port: parseInt(redisUrl.port || "6379", 10),
};

async function start() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB");

    console.log("Starting click batch worker...");
    const batchWorker = createClickBatchWorker(CLICK_EVENTS_QUEUE, redisConnection);

    batchWorker.worker.on("ready", () => {
      console.log("Click batch worker is ready and listening for jobs");
    });

    batchWorker.worker.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed: ${err.message}`);
    });

    process.on("SIGINT", async () => {
      await batchWorker.close();
      await mongoose.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await batchWorker.close();
      await mongoose.disconnect();
      process.exit(0);
    });

  } catch (err) {
    console.error("Failed to start worker:", err);
    process.exit(1);
  }
}

start();
