const Url = require("../models/url");

async function createUrl(urlInput) {
  return Url.create(urlInput);
}

async function findUrlBySlug(slug) {
  return Url.findOne({ slug }).lean();
}

async function findActiveUrlBySlug(slug, now = new Date()) {
  return Url.findOne({
    slug,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  }).lean();
}

async function incrementUrlClicks(slug, incrementBy = 1) {
  return Url.updateOne({ slug }, { $inc: { totalClicks: incrementBy } });
}

module.exports = {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
};
