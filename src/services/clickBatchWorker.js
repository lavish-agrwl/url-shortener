const { Queue, Worker } = require("bullmq");
const { CLICK_EVENTS_DLQ } = require("./queue");
const { bulkIncrementUrlClicks, createClicksBatch } = require("../data");
const logger = require("../lib/logger");

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10000;

function createBatchState() {
  return {
    pendingJobs: [],
    currentBatch: null,
    lastFlushAt: Date.now(),
    flushTimer: null,
    flushInProgress: false,
  };
}

async function flushBatch(state) {
  if (state.flushInProgress || state.pendingJobs.length === 0) {
    return;
  }

  state.flushInProgress = true;
  state.currentBatch = state.pendingJobs.splice(0, state.pendingJobs.length);
  state.lastFlushAt = Date.now();

  try {
    const clicks = state.currentBatch.map(({ data }) => data);
    await createClicksBatch(clicks);
    await bulkIncrementUrlClicks(countClicksBySlug(clicks));

    for (const entry of state.currentBatch) {
      entry.resolve({ flushed: true });
    }
  } catch (err) {
    for (const entry of state.currentBatch) {
      entry.reject(err);
    }
  } finally {
    state.currentBatch = null;
    state.flushInProgress = false;
  }
}

function countClicksBySlug(clicks) {
  const clickCounts = new Map();

  for (const click of clicks) {
    clickCounts.set(click.slug, (clickCounts.get(click.slug) || 0) + 1);
  }

  return Array.from(clickCounts.entries()).map(([slug, count]) => ({
    slug,
    count,
  }));
}

function scheduleFlush(state, flushIntervalMs) {
  if (state.flushTimer) {
    return;
  }

  state.flushTimer = setInterval(async () => {
    if (Date.now() - state.lastFlushAt >= flushIntervalMs) {
      await flushBatch(state);
    }
  }, flushIntervalMs);

  state.flushTimer.unref?.();
}

function createClickBatchWorker(queueName, redisConnection, options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const flushIntervalMs = options.flushIntervalMs || DEFAULT_FLUSH_INTERVAL_MS;
  const ownsDlq = !options.dlq;
  const dlq = options.dlq || new Queue(CLICK_EVENTS_DLQ, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
  const state = createBatchState();

  scheduleFlush(state, flushIntervalMs);

  const worker = new Worker(
    queueName,
    async (job) => {
      return new Promise((resolve, reject) => {
        state.pendingJobs.push({ data: job.data, resolve, reject });

        if (state.pendingJobs.length >= batchSize) {
          flushBatch(state).catch(reject);
        }
      });
    },
    {
      connection: redisConnection,
      concurrency: batchSize,
    },
  );

  worker.on("failed", async (job, err) => {
    if (!job || job.attemptsMade < (job.opts.attempts || 1)) {
      return;
    }

    try {
      await dlq.add("click-failed", {
        originalJobId: job.id,
        failedReason: err ? err.message : job.failedReason,
        attemptsMade: job.attemptsMade,
        data: job.data,
      }, {
        jobId: `failed-${job.id}`,
      });
    } catch (dlqErr) {
      logger.error({ originalJobId: job.id }, dlqErr, "Failed to route click job to DLQ");
    }
  });

  return {
    worker,
    state,
    flushBatch: () => flushBatch(state),
    close: async (timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS) => {
      logger.debug({ event: "worker_shutdown_start" }, "Worker shutdown started");

      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("Shutdown timed out")), timeoutMs);
      });

      const shutdownPromise = (async () => {
        if (state.flushTimer) {
          clearInterval(state.flushTimer);
          state.flushTimer = null;
        }

        while (state.flushInProgress) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        await flushBatch(state);
        await worker.close();
        if (ownsDlq) {
          await dlq.close();
        }
      })();

      try {
        await Promise.race([shutdownPromise, timeoutPromise]);
        logger.debug({ event: "worker_shutdown_complete" }, "Worker shutdown complete");
      } catch (err) {
        const pendingCount = state.pendingJobs.length;
        const inFlightCount = state.currentBatch ? state.currentBatch.length : 0;
        const lostEvents = pendingCount + inFlightCount;
        logger.error({ event: "worker_shutdown_failed", lostEvents }, err, "Worker shutdown failed");
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}

module.exports = {
  createClickBatchWorker,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL_MS,
};
