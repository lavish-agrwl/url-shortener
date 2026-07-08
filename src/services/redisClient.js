const IORedis = require("ioredis");

const clients = new Map();

function getRedisClient(redisUrl) {
  // During tests we use an in‑memory mock client to avoid external Redis dependency
  if (process.env.NODE_ENV === "test") {
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
