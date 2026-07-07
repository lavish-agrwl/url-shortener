const {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
  bulkIncrementUrlClicks,
} = require("./urlRepository");
const { createClick, createClicksBatch } = require("./clickRepository");

module.exports = {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
  bulkIncrementUrlClicks,
  createClick,
  createClicksBatch,
};
