"use strict";

const BazikValidationError = require("../errors/BazikValidationError");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate that a wallet number is 8 or 11 digits.
 * @param {string} wallet
 */
function validateWallet(wallet) {
  if (typeof wallet !== "string" || !/^\d{8}(\d{3})?$/.test(wallet)) {
    throw new BazikValidationError(
      `Invalid wallet number "${wallet}". Must be 8 or 11 digits.`
    );
  }
}

module.exports = validateWallet;
