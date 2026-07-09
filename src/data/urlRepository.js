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

async function bulkIncrementUrlClicks(clickCounts) {
  if (!Array.isArray(clickCounts) || clickCounts.length === 0) {
    return { acknowledged: true, modifiedCount: 0 };
  }

  return Url.bulkWrite(
    clickCounts.map(({ slug, count }) => ({
      updateOne: {
        filter: { slug },
        update: { $inc: { totalClicks: count } },
      },
    })),
  );
}

async function findAllUrls(limit = 100, skip = 0) {
  return Url.find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

module.exports = {
  createUrl,
  findUrlBySlug,
  findActiveUrlBySlug,
  incrementUrlClicks,
  bulkIncrementUrlClicks,
  findAllUrls,
};
