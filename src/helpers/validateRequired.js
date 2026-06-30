"use strict";

const BazikValidationError = require("../errors/BazikValidationError");

/**
 * Validate that required fields are present in an object.
 * @param {Record<string, *>} obj
 * @param {string[]} fields
 */
function validateRequired(obj, fields) {
  const missing = fields.filter(
    (f) => obj[f] === undefined || obj[f] === null || obj[f] === ""
  );
  if (missing.length > 0) {
    throw new BazikValidationError(
      `Missing required field(s): ${missing.join(", ")}`
    );
  }
}

module.exports = validateRequired;
