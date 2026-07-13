const { Queue } = require("bullmq");
const crypto = require("crypto");
const geoip = require("geoip-lite");
const logger = require("../lib/logger");
const { buildClickEventPayload } = require("../validation/clickEvent");

const CLICK_EVENTS_QUEUE = "click-events";
const CLICK_EVENTS_DLQ = "click-events-dlq";
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
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    queue.on("error", (err) => {
      logger.error({ queueName }, err, "Queue error");
    });

    queues.set(queueName, queue);
  }

  return queues.get(queueName);
}

function getClickQueues(redisConnection) {
  return {
    clickQueue: getQueue(CLICK_EVENTS_QUEUE, redisConnection),
    clickDlq: getQueue(CLICK_EVENTS_DLQ, redisConnection),
  };
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

  // 1. Try configurable header (e.g., GEOIP_HEADER_NAME)
  const geoHeader = process.env.GEOIP_HEADER_NAME;
  let country = geoHeader ? req.headers[geoHeader] : null;

  // 2. Fallback to geoip-lite lookup
  if (!country) {
    try {
      const geo = geoip.lookup(clientIp);
      country = geo ? geo.country : null;
    } catch (err) {
      logger.warn({ ipHash }, err, "GeoIP lookup failed");
    }
  }

  // 3. Use "unknown" sentinel for missing/failed lookups
  country = country || "unknown";

    const jobId = `${slug}-${timestamp.getTime()}`;
    try {
      // Fire-and-forget: don't await, add to queue without blocking
      const payload = buildClickEventPayload({
        slug,
        timestamp,
        ipHash,
        userAgent,
        referrer,
        country,
      });

      queue.add("click", payload, {
        jobId,
      });
    } catch (err) {
      // Queue enqueue failure is non-critical; log and continue
      logger.error({ slug, jobId, ipHash }, err, "Failed to enqueue click event");
    }

}

module.exports = {
  CLICK_EVENTS_QUEUE,
  CLICK_EVENTS_DLQ,
  getQueue,
  getClickQueues,
  hashIp,
  getClientIp,
  enqueueClick,
};
