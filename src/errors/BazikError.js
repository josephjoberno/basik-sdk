"use strict";

// ─── Errors ──────────────────────────────────────────────────────────────────

class BazikError extends Error {
  /**
   * @param {string} message
   * @param {number} [status]
   * @param {string} [code]
   * @param {*} [details]
   */
  constructor(message, status, code, details) {
    super(message);
    this.name = "BazikError";
    this.status = status ?? null;
    this.code = code ?? null;
    this.details = details ?? null;
  }
}

module.exports = BazikError;
