const mongoose = require("mongoose");
const constants = require("../config/constants");


function encodeBase62(value) {
  let remaining = BigInt(value);

  if (remaining === 0n) {
    return constants.SLUG.BASE62_ALPHABET[0];
  }

  let encoded = "";
  while (remaining > 0n) {
    const index = Number(remaining % 62n);
    encoded = constants.SLUG.BASE62_ALPHABET[index] + encoded;
    remaining /= 62n;
  }

  return encoded;
}

function generateDefaultSlug(objectId = new mongoose.Types.ObjectId()) {
  const objectIdHex = objectId.toHexString();
  const objectIdAsBigInt = BigInt(`0x${objectIdHex}`);

  const encoded = encodeBase62(objectIdAsBigInt);
  return encoded.padStart(constants.SLUG.DEFAULT_LENGTH, constants.SLUG.BASE62_ALPHABET[0]).slice(-constants.SLUG.DEFAULT_LENGTH);
}

async function generateUniqueSlug(existsFn, options = {}) {
  const maxAttempts = options.maxAttempts || constants.SLUG.MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const objectId = (attempt === 0 && options.objectId) || new mongoose.Types.ObjectId();
    const slug = generateDefaultSlug(objectId);
    const slugExists = await existsFn(slug);

    if (!slugExists) {
      return slug;
    }
  }

  throw new Error("Unable to generate a unique slug after multiple attempts");
}

module.exports = {
  BASE62_ALPHABET: constants.SLUG.BASE62_ALPHABET,
  DEFAULT_SLUG_LENGTH: constants.SLUG.DEFAULT_LENGTH,
  MAX_SLUG_ATTEMPTS: constants.SLUG.MAX_ATTEMPTS,
  encodeBase62,
  generateDefaultSlug,
  generateUniqueSlug,
};
