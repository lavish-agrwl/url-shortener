const { Queue } = require("bullmq");
const { getRedisClient } = require("./redisClient");
const crypto = require("crypto");

const queues = new Map();

/**
 * Get or create a BullMQ queue instance.
 * @param {string} queueName - Name of the queue
 * @param {object} redisConnection - Redis connection details or client
 * @returns {Queue} - BullMQ Queue instance
 */
function getQueue(queueName, redisConnection) {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    queue.on("error", (err) => {
      console.error(`Queue ${queueName} error:`, err);
    });

    queues.set(queueName, queue);
  }

  return queues.get(queueName);
}

/**
 * Hash an IP address using SHA-256.
 * @param {string} ip - IP address to hash
 * @returns {string} - SHA-256 hash of the IP
 */
function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Extract client IP from request, accounting for proxies.
 * @param {object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "0.0.0.0"
  );
}

/**
 * Enqueue a click event asynchronously (non-blocking).
 * @param {object} queue - BullMQ Queue instance
 * @param {string} slug - Short slug
 * @param {object} req - Express request object
 * @param {Date} [timestamp] - Click timestamp (defaults to now)
 */
async function enqueueClick(queue, slug, req, timestamp = new Date()) {
  const clientIp = getClientIp(req);
  const ipHash = hashIp(clientIp);
  const userAgent = req.headers["user-agent"] || "";
  const referrer = req.headers["referer"] || null;

  try {
    // Fire-and-forget: don't await, add to queue without blocking
    queue.add(
      "click",
      {
        slug,
        timestamp: timestamp.toISOString(),
        ipHash,
        userAgent,
        referrer,
      },
      {
        // Unique job ID per slug+timestamp to prevent duplicates
        jobId: `${slug}-${timestamp.getTime()}`,
      },
    );
  } catch (err) {
    // Queue enqueue failure is non-critical; log and continue
    console.error("Failed to enqueue click event:", err);
  }
}

module.exports = {
  getQueue,
  hashIp,
  getClientIp,
  enqueueClick,
};
