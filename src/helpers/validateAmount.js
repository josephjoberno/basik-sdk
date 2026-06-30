"use strict";

const BazikValidationError = require("../errors/BazikValidationError");

/**
 * Validate a positive numeric amount.
 * @param {number} amount
 * @param {number} [max]
 */
function validateAmount(amount, max) {
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    throw new BazikValidationError(
      `Invalid amount: ${amount}. Must be a positive number.`
    );
  }
  if (max !== undefined && amount > max) {
    throw new BazikValidationError(
      `Amount ${amount} exceeds maximum of ${max} HTG.`
    );
  }
}

module.exports = validateAmount;
