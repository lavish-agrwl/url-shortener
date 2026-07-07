const { Worker } = require("bullmq");
const { bulkIncrementUrlClicks, createClicksBatch } = require("../data");

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;

function createBatchState() {
  return {
    pendingJobs: [],
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
  const batch = state.pendingJobs.splice(0, state.pendingJobs.length);
  state.lastFlushAt = Date.now();

  try {
    const clicks = batch.map(({ data }) => data);
    await createClicksBatch(clicks);
    await bulkIncrementUrlClicks(countClicksBySlug(clicks));

    for (const entry of batch) {
      entry.resolve({ flushed: true });
    }
  } catch (err) {
    for (const entry of batch) {
      entry.reject(err);
    }
  } finally {
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

  worker.on("failed", async () => {
    // Let BullMQ retry according to queue settings; nothing to do here yet.
  });

  return {
    worker,
    state,
    flushBatch: () => flushBatch(state),
    close: async () => {
      if (state.flushTimer) {
        clearInterval(state.flushTimer);
        state.flushTimer = null;
      }
      await flushBatch(state);
      await worker.close();
    },
  };
}

module.exports = {
  createClickBatchWorker,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL_MS,
};
