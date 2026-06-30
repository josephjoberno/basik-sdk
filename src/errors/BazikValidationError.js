"use strict";

const BazikError = require("./BazikError");

class BazikValidationError extends BazikError {
  constructor(message, details) {
    super(message, 400, "validation_error", details);
    this.name = "BazikValidationError";
  }
}

module.exports = BazikValidationError;
