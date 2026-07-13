const {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
  bulkIncrementUrlClicks,
} = require("./urlRepository");
const { createClick, createClicksBatch } = require("./clickRepository");
const {
  aggregateTotalClicks,
  aggregateClicksPerDay,
  aggregateTopReferrers,
  aggregateTopCountries,
} = require("./analyticsRepository");

module.exports = {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
  bulkIncrementUrlClicks,
  createClick,
  createClicksBatch,
  aggregateTotalClicks,
  aggregateClicksPerDay,
  aggregateTopReferrers,
  aggregateTopCountries,
};
