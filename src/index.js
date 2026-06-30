/**
 * Bazik SDK for JavaScript/Node.js
 * Unofficial SDK for the Bazik API — MonCash & NatCash payments, transfers, and wallet management.
 *
 * @see https://bazik.io/docs/endpoints
 * @version 1.0.0
 * @license MIT
 */

"use strict";

const Bazik = require("./modules/Bazik");
const BazikError = require("./errors/BazikError");
const BazikAuthError = require("./errors/BazikAuthError");
const BazikValidationError = require("./errors/BazikValidationError");
const BazikInsufficientFundsError = require("./errors/BazikInsufficientFundsError");
const BazikRateLimitError = require("./errors/BazikRateLimitError");

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  Bazik,
  BazikError,
  BazikAuthError,
  BazikValidationError,
  BazikInsufficientFundsError,
  BazikRateLimitError,
};
