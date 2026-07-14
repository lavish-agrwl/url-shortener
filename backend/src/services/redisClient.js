const IORedis = require("ioredis");
const constants = require("../config/constants");

const clients = new Map();

function getRedisClient(redisUrl) {
  const url = redisUrl || process.env.REDIS_URL || constants.REDIS.DEFAULT_URL;

  if (!clients.has(url)) {
    const client = new IORedis(url);
    client.on("error", () => {});
    clients.set(url, client);
  }

  return clients.get(url);
}

module.exports = {
  getRedisClient,
};
