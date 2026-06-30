"use strict";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://api.bazik.io";
const TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000; // 1 hour before expiry
const MAX_MONCASH_AMOUNT = 75_000;

module.exports = {
  DEFAULT_BASE_URL,
  TOKEN_REFRESH_MARGIN_MS,
  MAX_MONCASH_AMOUNT,
};
