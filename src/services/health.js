const mongoose = require('mongoose');
const IORedis = require('ioredis');
const { Queue } = require('bullmq');

async function checkRedis(redisUrl) {
  const redis = new IORedis(redisUrl, { lazyConnect: true });
  redis.on('error', () => {});

  try {
    await redis.connect();
    await redis.ping();
    return 'connected';
  } catch (err) {
    return 'disconnected';
  } finally {
    redis.disconnect();
  }
}

async function checkMongo(mongoUri) {
  const connection = mongoose.createConnection(mongoUri, {
    serverSelectionTimeoutMS: 2000,
  });
  connection.on('error', () => {});

  try {
    await connection.asPromise();
    return 'connected';
  } catch (err) {
    return 'disconnected';
  } finally {
    await connection.close().catch(() => {});
  }
}

async function getQueueDepth(redisUrl) {
  const connection = new IORedis(redisUrl, { lazyConnect: true });
  connection.on('error', () => {});
  const queue = new Queue('click-events', { connection });

  try {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    return counts.waiting + counts.active + counts.delayed;
  } catch (err) {
    return 0;
  } finally {
    await queue.close().catch(() => {});
    connection.disconnect();
  }
}

async function getHealthStatus(env) {
  const [redisStatus, mongoStatus, queueDepth] = await Promise.all([
    checkRedis(env.REDIS_URL),
    checkMongo(env.MONGODB_URI),
    getQueueDepth(env.REDIS_URL),
  ]);

  return {
    status: redisStatus === 'connected' && mongoStatus === 'connected' ? 'ok' : 'degraded',
    redis: redisStatus,
    mongodb: mongoStatus,
    queueDepth,
  };
}

module.exports = {
  getHealthStatus,
};