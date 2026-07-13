const { findAllUrls } = require("../data/urlRepository");

/**
 * Retrieve a list of all shortened URLs.
 * @param {object} options
 * @param {number} [options.limit=100] - Max number of URLs to return.
 * @param {number} [options.skip=0] - Number of URLs to skip (for pagination).
 * @returns {Promise<Array>} - List of URL records.
 */
async function listUrls({ limit = 100, skip = 0 } = {}) {
  return await findAllUrls(limit, skip);
}

module.exports = {
  listUrls,
};
