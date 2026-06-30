"use strict";

const {
  DEFAULT_BASE_URL,
  TOKEN_REFRESH_MARGIN_MS,
} = require("../constants");
const BazikError = require("../errors/BazikError");
const BazikAuthError = require("../errors/BazikAuthError");
const BazikValidationError = require("../errors/BazikValidationError");
const BazikInsufficientFundsError = require("../errors/BazikInsufficientFundsError");
const BazikRateLimitError = require("../errors/BazikRateLimitError");
const request = require("../http/request");
const Payments = require("./Payments");
const Transfers = require("./Transfers");
const Wallet = require("./Wallet");

// ─── Bazik Client ────────────────────────────────────────────────────────────

class Bazik {
  #userID;
  #secretKey;
  #baseURL;
  #token;
  #tokenExpiresAt;
  #autoRefresh;
  #timeout;
  #onTokenRefresh;

  /**
   * Create a new Bazik client.
   *
   * @param {Object} config
   * @param {string} config.userID       — Your Bazik user ID (e.g. "bzk_c5b754a0_1757383229")
   * @param {string} config.secretKey    — Your secret key (e.g. "sk_...")
   * @param {string} [config.baseURL]    — API base URL (default: https://api.bazik.io)
   * @param {boolean} [config.autoRefresh] — Automatically refresh token before expiry (default: true)
   * @param {number} [config.timeout]    — Request timeout in ms (default: 30000)
   * @param {(token: string) => void} [config.onTokenRefresh] — Callback when token is refreshed
   *
   * @example
   * // CommonJS
   * const { Bazik } = require("bazik-sdk");
   *
   * // ESM
   * import { Bazik } from "bazik-sdk";
   *
   * const bazik = new Bazik({
   *   userID: "bzk_c5b754a0_1757383229",
   *   secretKey: "sk_5b0ff521b331c73db55313dc82f17cab",
   * });
   */
  constructor(config) {
    if (!config || !config.userID || !config.secretKey) {
      throw new BazikValidationError(
        "Both userID and secretKey are required to initialize the Bazik client."
      );
    }

    this.#userID = config.userID;
    this.#secretKey = config.secretKey;
    this.#baseURL = (config.baseURL || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#autoRefresh = config.autoRefresh !== false;
    this.#timeout = config.timeout || 30_000;
    this.#onTokenRefresh = config.onTokenRefresh || null;
    this.#token = null;
    this.#tokenExpiresAt = 0;

    // Bind sub-modules
    this.payments = new Payments(this);
    this.transfers = new Transfers(this);
    this.wallet = new Wallet(this);
  }

  // ── Token management ────────────────────────────────────────────────────

  /**
   * Authenticate and obtain an access token.
   * The token is cached internally and reused for subsequent requests.
   *
   * @returns {Promise<{ success: boolean, token: string, user_id: string, expires_at: number, message: string }>}
   *
   * @example
   * const auth = await bazik.authenticate();
   * console.log("Token expires at:", new Date(auth.expires_at));
   */
  async authenticate() {
    const { status, data } = await request(`${this.#baseURL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: this.#timeout,
      body: JSON.stringify({
        userID: this.#userID,
        secretKey: this.#secretKey,
      }),
    });

    if (status === 429) {
      throw new BazikRateLimitError(
        "Too many authentication attempts. Please wait before retrying.",
        data
      );
    }

    if (status === 401) {
      throw new BazikAuthError(
        data?.error?.message || "Invalid credentials.",
        status,
        data?.error?.code,
        data?.error?.details
      );
    }

    if (status !== 200 || !data?.token) {
      throw new BazikError(
        data?.error?.message || "Authentication failed.",
        status,
        data?.error?.code,
        data
      );
    }

    this.#token = data.token;
    this.#tokenExpiresAt = data.expires_at;

    if (this.#onTokenRefresh) {
      this.#onTokenRefresh(data.token);
    }

    return data;
  }

  /**
   * Returns true if the current token is still valid (with a safety margin).
   * @returns {boolean}
   */
  isTokenValid() {
    if (!this.#token) return false;
    return Date.now() < this.#tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS;
  }

  /**
   * Get a valid token, refreshing if needed.
   * @returns {Promise<string>}
   */
  async getToken() {
    if (!this.#token || (this.#autoRefresh && !this.isTokenValid())) {
      await this.authenticate();
    }
    return this.#token;
  }

  /**
   * Internal: make an authenticated API request.
   * @param {string} method
   * @param {string} path
   * @param {*} [body]
   * @returns {Promise<*>}
   */
  async _request(method, path, body) {
    const token = await this.getToken();

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const opts = { method, headers, timeout: this.#timeout };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const { status, data } = await request(
      `${this.#baseURL}${path}`,
      opts
    );

    // Handle common error statuses
    if (status === 401) {
      // Token may have expired — try one refresh
      if (this.#autoRefresh) {
        await this.authenticate();
        const retryHeaders = {
          Authorization: `Bearer ${this.#token}`,
          "Content-Type": "application/json",
        };
        const retry = await request(`${this.#baseURL}${path}`, {
          ...opts,
          headers: retryHeaders,
        });
        if (retry.status === 401) {
          throw new BazikAuthError(
            "Authentication failed after token refresh.",
            401,
            "unauthorized",
            retry.data
          );
        }
        return retry.data;
      }
      throw new BazikAuthError(
        data?.error?.message || "Unauthorized.",
        401,
        data?.error?.code,
        data
      );
    }

    if (status === 402) {
      throw new BazikInsufficientFundsError(
        data?.error?.message || "Insufficient funds.",
        data
      );
    }

    if (status === 429) {
      throw new BazikRateLimitError(
        data?.error?.message || "Rate limit exceeded.",
        data
      );
    }

    if (status >= 400) {
      throw new BazikError(
        data?.error?.message || data?.message || `Request failed with status ${status}`,
        status,
        data?.error?.code,
        data
      );
    }

    return data;
  }
}

module.exports = Bazik;
