const IORedis = require("ioredis");

const clients = new Map();

function getRedisClient(redisUrl) {
  // Use mock client only if explicitly requested or in test mode without a real REDIS_URL override
  if (process.env.NODE_ENV === "test" && !process.env.USE_REAL_REDIS) {
    const IORedisMock = require("ioredis-mock");
    if (!clients.has(redisUrl)) {
      const client = new IORedisMock(redisUrl);
      client.on("error", () => {});
      clients.set(redisUrl, client);
    }
    return clients.get(redisUrl);
  }

  if (!clients.has(redisUrl)) {
    const client = new IORedis(redisUrl);
    client.on("error", () => {});
    clients.set(redisUrl, client);
  }

  return clients.get(redisUrl);
}

module.exports = {
  getRedisClient,
};
