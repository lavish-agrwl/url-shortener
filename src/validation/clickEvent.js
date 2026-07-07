const { z } = require("zod");

const clickEventSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
  timestamp: z
    .string()
    .datetime({ message: "timestamp must be an ISO datetime string" }),
  ipHash: z.string().trim().length(64, "ipHash must be a SHA-256 hex digest"),
  userAgent: z.string().trim(),
  referrer: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
});

function parseClickEvent(input) {
  return clickEventSchema.parse(input);
}

function buildClickEventPayload({
  slug,
  timestamp,
  ipHash,
  userAgent,
  referrer = null,
  country = null,
}) {
  return parseClickEvent({
    slug,
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
    ipHash,
    userAgent,
    referrer,
    country,
  });
}

module.exports = {
  clickEventSchema,
  parseClickEvent,
  buildClickEventPayload,
};
