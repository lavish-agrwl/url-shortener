const IORedis = require("ioredis");

const clients = new Map();

function getRedisClient(redisUrl) {
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
