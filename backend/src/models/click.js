const mongoose = require("mongoose");
const constants = require("../config/constants");


const clickSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ipHash: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      required: true,
      trim: true,
    },
    referrer: {
      type: String,
      default: null,
      trim: true,
    },
    country: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    versionKey: false,
  },
);

clickSchema.index(
  { slug: 1, timestamp: -1 },
  { name: "clicks_slug_timestamp_idx" },
);
clickSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: constants.TIME.NINETY_DAYS_IN_SECONDS, name: "clicks_timestamp_ttl" },
);

module.exports = mongoose.models.Click || mongoose.model("Click", clickSchema);
