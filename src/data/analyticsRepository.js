const Click = require("../models/click");
const logger = require("../lib/logger");

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

function getThirtyDaysAgo(now = new Date()) {
  return new Date(now.getTime() - THIRTY_DAYS_IN_MS);
}

async function aggregateTotalClicks(slug) {
  try {
    const [result] = await Click.aggregate([
      { $match: { slug } },
      { $count: "totalClicks" },
    ]);

    return result ? result.totalClicks : 0;
  } catch (err) {
    logger.error({ slug, err }, "Database error aggregating total clicks");
    throw err;
  }
}

async function aggregateClicksPerDay(slug, now = new Date()) {
  const thirtyDaysAgo = getThirtyDaysAgo(now);
  return Click.aggregate([
    {
      $match: {
        slug,
        timestamp: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$timestamp",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        count: 1,
      },
    },
  ]);
}

async function aggregateTopField(slug, fieldName) {
  return Click.aggregate([
    {
      $match: {
        slug,
        [fieldName]: { $ne: null },
      },
    },
    { $group: { _id: `$${fieldName}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        [fieldName]: "$_id",
        count: 1,
      },
    },
  ]);
}

async function aggregateTopReferrers(slug) {
  return aggregateTopField(slug, "referrer");
}

async function aggregateTopCountries(slug) {
  return aggregateTopField(slug, "country");
}

module.exports = {
  aggregateTotalClicks,
  aggregateClicksPerDay,
  aggregateTopReferrers,
  aggregateTopCountries,
};
