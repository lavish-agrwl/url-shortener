const mongoose = require("mongoose");

const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_SLUG_LENGTH = 7;
const MAX_SLUG_ATTEMPTS = 5;

function encodeBase62(value) {
  let remaining = BigInt(value);

  if (remaining === 0n) {
    return BASE62_ALPHABET[0];
  }

  let encoded = "";
  while (remaining > 0n) {
    const index = Number(remaining % 62n);
    encoded = BASE62_ALPHABET[index] + encoded;
    remaining /= 62n;
  }

  return encoded;
}

function generateDefaultSlug(objectId = new mongoose.Types.ObjectId()) {
  const objectIdHex = objectId.toHexString();
  const objectIdAsBigInt = BigInt(`0x${objectIdHex}`);

  return encodeBase62(objectIdAsBigInt).slice(0, DEFAULT_SLUG_LENGTH);
}

async function generateUniqueSlug(existsFn, options = {}) {
  const maxAttempts = options.maxAttempts || MAX_SLUG_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const slug = generateDefaultSlug(
      options.objectId || new mongoose.Types.ObjectId(),
    );
    const slugExists = await existsFn(slug);

    if (!slugExists) {
      return slug;
    }
  }

  throw new Error("Unable to generate a unique slug after multiple attempts");
}

module.exports = {
  BASE62_ALPHABET,
  DEFAULT_SLUG_LENGTH,
  MAX_SLUG_ATTEMPTS,
  encodeBase62,
  generateDefaultSlug,
  generateUniqueSlug,
};
