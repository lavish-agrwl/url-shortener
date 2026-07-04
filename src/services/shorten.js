const { createUrl, findUrlBySlug } = require("../data");
const { generateDefaultSlug, generateUniqueSlug } = require("../utils/slug");
const { parseShortenRequest } = require("../validation/shortenRequest");

function toIsoString(date) {
  return date ? new Date(date).toISOString() : null;
}

async function createShortUrl(payload, options = {}) {
  const parsedPayload = parseShortenRequest(payload);
  const now = options.now || new Date();
  const createdBy = options.createdBy || null;

  let slug = parsedPayload.customSlug;
  if (!slug) {
    slug = await generateUniqueSlug(async (candidate) => {
      const existing = await findUrlBySlug(candidate);
      return Boolean(existing);
    }, options.slugOptions);
  }

  try {
    const createdUrl = await createUrl({
      slug,
      originalUrl: parsedPayload.url,
      createdAt: now,
      expiresAt: parsedPayload.expiresAt,
      createdBy,
    });

    return {
      slug: createdUrl.slug,
      shortUrl: `${options.baseUrl || ""}/${createdUrl.slug}`,
      originalUrl: createdUrl.originalUrl,
      createdAt: toIsoString(createdUrl.createdAt),
      expiresAt: toIsoString(createdUrl.expiresAt),
    };
  } catch (err) {
    if (err && err.code === 11000) {
      const duplicateSlugError = new Error("slug already exists");
      duplicateSlugError.statusCode = 409;
      throw duplicateSlugError;
    }

    throw err;
  }
}

module.exports = {
  createShortUrl,
  generateDefaultSlug,
};
