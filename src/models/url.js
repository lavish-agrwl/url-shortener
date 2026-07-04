const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: undefined,
    },
    totalClicks: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
      default: undefined,
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

urlSchema.index({ slug: 1 }, { unique: true, name: "urls_slug_unique" });
urlSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "urls_expiresAt_ttl", sparse: true },
);

module.exports = mongoose.models.Url || mongoose.model("Url", urlSchema);
