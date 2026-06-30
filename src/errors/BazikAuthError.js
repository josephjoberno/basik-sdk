"use strict";

const BazikError = require("./BazikError");

class BazikAuthError extends BazikError {
  constructor(message, status, code, details) {
    super(message, status, code, details);
    this.name = "BazikAuthError";
  }
}

module.exports = BazikAuthError;
