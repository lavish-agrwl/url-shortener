const {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
} = require("./urlRepository");
const { createClick, createClicksBatch } = require("./clickRepository");

module.exports = {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
  createClick,
  createClicksBatch,
};
