const Click = require("../models/click");

async function createClick(clickInput) {
  return Click.create(clickInput);
}

async function createClicksBatch(clickInputs) {
  if (!Array.isArray(clickInputs) || clickInputs.length === 0) {
    return [];
  }

  return Click.insertMany(clickInputs, { ordered: false });
}

module.exports = {
  createClick,
  createClicksBatch,
};
