const { z } = require("zod");

const customSlugPattern = /^[a-zA-Z0-9-]{3,30}$/;

const shortenRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .url("url must be a valid URL")
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch (_err) {
        return false;
      }
    }, "url must use http or https"),
  customSlug: z
    .string()
    .trim()
    .regex(
      customSlugPattern,
      "customSlug must be 3-30 chars and contain only letters, numbers, or hyphens",
    )
    .optional(),
  expiresAt: z.coerce
    .date({ error: "expiresAt must be a valid date" })
    .optional(),
});

function parseShortenRequest(input) {
  return shortenRequestSchema.parse(input);
}

function safeParseShortenRequest(input) {
  return shortenRequestSchema.safeParse(input);
}

module.exports = {
  shortenRequestSchema,
  parseShortenRequest,
  safeParseShortenRequest,
};
