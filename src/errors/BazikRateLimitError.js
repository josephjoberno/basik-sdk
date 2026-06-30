"use strict";

const BazikError = require("./BazikError");

class BazikRateLimitError extends BazikError {
  constructor(message, details) {
    super(message, 429, "rate_limit_exceeded", details);
    this.name = "BazikRateLimitError";
  }
}

module.exports = BazikRateLimitError;
