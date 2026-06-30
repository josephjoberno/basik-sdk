"use strict";

const BazikError = require("./BazikError");

class BazikInsufficientFundsError extends BazikError {
  constructor(message, details) {
    super(message, 402, "insufficient_funds", details);
    this.name = "BazikInsufficientFundsError";
  }
}

module.exports = BazikInsufficientFundsError;
