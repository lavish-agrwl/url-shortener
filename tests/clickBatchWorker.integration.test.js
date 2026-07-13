const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const { createClickBatchWorker } = require("../src/services/clickBatchWorker");
const Click = require("../src/models/click");

describe("clickBatchWorker Integration Tests", () => {
  let mongoServer;
  let mongoUri;
  let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  let queueRedisClient;
  let workerRedisClient;
  let worker;
  let testQueue;

  const TEST_BATCH_SIZE = 50;
  const TEST_FLUSH_INTERVAL_MS = 1000; // Use 1s for faster tests
  const QUEUE_NAME = "test-click-events";

  // Poll `checkFn` until it returns true or `maxWaitMs` elapses. Fails with
  // a clear assertion message (rather than an opaque Jest timeout) if the
  // condition never becomes true, and reports the last observed value.
  async function waitUntil(
    checkFn,
    { maxWaitMs = 8000, intervalMs = 50, label = "condition" } = {},
  ) {
    const deadline = Date.now() + maxWaitMs;
    let lastValue;

    while (Date.now() < deadline) {
      lastValue = await checkFn();
      if (lastValue) {
        return lastValue;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(
      `Timed out after ${maxWaitMs}ms waiting for ${label}. Last observed value: ${JSON.stringify(lastValue)}`,
    );
  }

  beforeAll(async () => {
    if (process.env.MONGODB_URI) {
      mongoUri = process.env.MONGODB_URI;
    } else {
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
    }
    await mongoose.connect(mongoUri);

    queueRedisClient = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    workerRedisClient = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    try {
      await queueRedisClient.ping();
      await workerRedisClient.ping();
    } catch (err) {
      throw new Error(`Redis connection failed: ${err.message}`);
    }
  }, 60000);

  beforeEach(async () => {
    await Click.deleteMany({});
    await queueRedisClient.flushdb();

    testQueue = new Queue(QUEUE_NAME, { connection: queueRedisClient });
    worker = createClickBatchWorker(QUEUE_NAME, workerRedisClient, {
      batchSize: TEST_BATCH_SIZE,
      flushIntervalMs: TEST_FLUSH_INTERVAL_MS,
    });
  });

  afterEach(async () => {
    if (worker) {
      await worker.close();
    }
    if (testQueue) {
      await testQueue.close();
    }
  });

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }
    if (testQueue) {
      await testQueue.close();
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    if (queueRedisClient) {
      await queueRedisClient.quit();
    }
    if (workerRedisClient) {
      await workerRedisClient.quit();
    }
  });

  test("Test 1: should flush immediately when count threshold (50) is reached", async () => {
    const clicks = [];
    for (let i = 0; i < TEST_BATCH_SIZE; i++) {
      clicks.push({
        slug: `slug-${i}`,
        ipHash: "a".repeat(64),
        userAgent: "test",
      });
    }

    // Enqueue 50 events in rapid succession
    await Promise.all(clicks.map((data) => testQueue.add("click", data)));

    // The flush should be "immediate" upon hitting the threshold, but we
    // still need to give the worker a moment to pull jobs from Redis.
    const count = await waitUntil(
      async () => {
        const n = await Click.countDocuments();
        return n === TEST_BATCH_SIZE ? n : false;
      },
      {
        maxWaitMs: 8000,
        label: `${TEST_BATCH_SIZE} click documents to be persisted`,
      },
    );

    expect(count).toBe(TEST_BATCH_SIZE);
  }, 10000);

  test("Test 2: should flush on timer trigger when count threshold is not hit", async () => {
    const count = 10;
    const clicks = [];
    for (let i = 0; i < count; i++) {
      clicks.push({
        slug: `slug-${i}`,
        ipHash: "b".repeat(64),
        userAgent: "test",
      });
    }

    await Promise.all(clicks.map((data) => testQueue.add("click", data)));

    // Verify not flushed immediately (give the worker a brief moment to
    // have pulled the jobs into pendingJobs first, so this is a
    // meaningful check rather than a race against job pickup).
    await waitUntil(() => worker.state.pendingJobs.length === count, {
      maxWaitMs: 2000,
      label: `${count} jobs to be picked up into pendingJobs`,
    });
    const currentCount = await Click.countDocuments();
    expect(currentCount).toBe(0);

    // Wait for the timer-driven flush to happen.
    const finalCount = await waitUntil(
      async () => {
        const n = await Click.countDocuments();
        return n === count ? n : false;
      },

      {
        maxWaitMs: TEST_FLUSH_INTERVAL_MS + 3000,
        label: `${count} click documents via timer flush`,
      },
    );

    expect(finalCount).toBe(count);
  }, 10000);

  test("Test 3: should handle events straddling both triggers without double-flush or loss", async () => {
    const countBeforeLast = TEST_BATCH_SIZE - 1; // 49
    const clicks = [];
    for (let i = 0; i < countBeforeLast; i++) {
      clicks.push({
        slug: `slug-${i}`,
        ipHash: "a".repeat(64),
        userAgent: "test",
      });
    }

    await Promise.all(clicks.map((data) => testQueue.add("click", data)));

    // Fix #4: instead of sleeping for a fixed % of the interval (racy
    // relative to the actual timer), wait for a deterministic signal that
    // we're in the straddle window: all 49 jobs picked up, none flushed
    // yet, with enough of the interval elapsed that the timer is close.
    await waitUntil(() => worker.state.pendingJobs.length === countBeforeLast, {
      maxWaitMs: 3000,
      label: `${countBeforeLast} jobs picked up before adding the straddling event`,
    });

    // Enqueue the 50th event right as the timer is about to fire
    await testQueue.add("click", {
      slug: "last-slug",
      ipHash: "c".repeat(64),
      userAgent: "test",
    });

    // Wait for processing
    const currentCount = await waitUntil(
      async () => {
        const n = await Click.countDocuments();
        return n === TEST_BATCH_SIZE ? n : false;
      },
      {
        maxWaitMs: TEST_FLUSH_INTERVAL_MS + 3000,
        label: `${TEST_BATCH_SIZE} click documents after straddle`,
      },
    );

    expect(currentCount).toBe(TEST_BATCH_SIZE);

    // Guard against a double-flush inflating the count: wait past where a
    // second (timer) flush could have fired, then confirm the count is
    // still exactly TEST_BATCH_SIZE rather than assuming the loop above
    // stopping at the right number is sufficient proof.
    await new Promise((r) => setTimeout(r, TEST_FLUSH_INTERVAL_MS));
    const finalCount = await Click.countDocuments();
    expect(finalCount).toBe(TEST_BATCH_SIZE);
  }, 15000);
});
