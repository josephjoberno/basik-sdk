/**
 * Bazik SDK for JavaScript/Node.js
 * Official SDK for the Bazik API — MonCash & NatCash payments, transfers, and wallet management.
 *
 * @see https://bazik.io/docs/endpoints
 * @version 1.0.0
 * @license MIT
 */

"use strict";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://api.bazik.io";
const TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000; // 1 hour before expiry
const MAX_MONCASH_AMOUNT = 75_000;

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

class BazikAuthError extends BazikError {
  constructor(message, status, code, details) {
    super(message, status, code, details);
    this.name = "BazikAuthError";
  }
}

class BazikValidationError extends BazikError {
  constructor(message, details) {
    super(message, 400, "validation_error", details);
    this.name = "BazikValidationError";
  }
}

class BazikInsufficientFundsError extends BazikError {
  constructor(message, details) {
    super(message, 402, "insufficient_funds", details);
    this.name = "BazikInsufficientFundsError";
  }
}

class BazikRateLimitError extends BazikError {
  constructor(message, details) {
    super(message, 429, "rate_limit_exceeded", details);
    this.name = "BazikRateLimitError";
  }
}

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

/**
 * Validate that required fields are present in an object.
 * @param {Record<string, *>} obj
 * @param {string[]} fields
 */
function validateRequired(obj, fields) {
  const missing = fields.filter(
    (f) => obj[f] === undefined || obj[f] === null || obj[f] === ""
  );
  if (missing.length > 0) {
    throw new BazikValidationError(
      `Missing required field(s): ${missing.join(", ")}`
    );
  }
}

// ─── HTTP Client (zero dependencies) ─────────────────────────────────────────

/**
 * Minimal fetch wrapper.
 * @param {string} url
 * @param {RequestInit & { timeout?: number }} options
 * @returns {Promise<{ status: number, data: * }>}
 */
async function request(url, options = {}) {
  const { timeout = 30_000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    let data;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

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

// ─── Payments sub-module ─────────────────────────────────────────────────────

class Payments {
  #client;

  constructor(client) {
    this.#client = client;
  }

  /**
   * Create a MonCash payment. The customer must be redirected to `redirectUrl`.
   *
   * @param {Object} params
   * @param {number} params.gdes              — Amount in Gourdes (max 75,000)
   * @param {string} [params.successUrl]      — Redirect URL on success
   * @param {string} [params.errorUrl]        — Redirect URL on error
   * @param {string} [params.description]     — Payment description
   * @param {string} [params.referenceId]     — Your reference ID
   * @param {string} [params.customerFirstName]
   * @param {string} [params.customerLastName]
   * @param {string} [params.customerEmail]
   * @param {string} [params.webhookUrl]      — Webhook for status updates
   * @param {Object} [params.metadata]        — Arbitrary metadata
   * @returns {Promise<Object>}               — Contains orderId, redirectUrl, status, etc.
   *
   * @example
   * const payment = await bazik.payments.create({
   *   gdes: 1284.00,
   *   successUrl: "https://mysite.com/success",
   *   errorUrl: "https://mysite.com/error",
   *   description: "iPhone Pro Max",
   *   referenceId: "ORDER-001",
   *   customerFirstName: "Franck",
   *   customerLastName: "Jean",
   *   customerEmail: "franck@example.com",
   *   webhookUrl: "https://mysite.com/webhook",
   * });
   *
   * // Redirect the customer to complete the payment
   * console.log("Redirect to:", payment.redirectUrl);
   */
  async create(params) {
    validateRequired(params, ["gdes"]);
    validateAmount(params.gdes, MAX_MONCASH_AMOUNT);

    return this.#client._request("POST", "/moncash/token", params);
  }

  /**
   * Verify a payment status by order ID.
   *
   * @param {string} orderId — The orderId returned by `create()`
   * @returns {Promise<Object>} — Payment details with status, amount, metadata, etc.
   *
   * @example
   * const status = await bazik.payments.verify("BZK_production_98630749_1760032902277_2ibu");
   * if (status.status === "successful") {
   *   console.log("Payment confirmed!");
   * }
   */
  async verify(orderId) {
    if (!orderId) {
      throw new BazikValidationError("orderId is required.");
    }
    return this.#client._request("GET", `/order/${encodeURIComponent(orderId)}`);
  }

  /**
   * Poll payment status until it resolves or times out.
   *
   * @param {string} orderId
   * @param {Object} [options]
   * @param {number} [options.intervalMs=5000]  — Polling interval
   * @param {number} [options.timeoutMs=300000] — Max wait time (5 min)
   * @returns {Promise<Object>} — Final payment status
   *
   * @example
   * const result = await bazik.payments.waitForCompletion("BZK_...", {
   *   intervalMs: 5000,
   *   timeoutMs: 120000,
   * });
   */
  async waitForCompletion(orderId, options = {}) {
    const { intervalMs = 5000, timeoutMs = 300_000 } = options;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const payment = await this.verify(orderId);
      if (payment.status !== "pending") {
        return payment;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new BazikError(
      `Payment verification timed out after ${timeoutMs}ms.`,
      null,
      "timeout"
    );
  }

  /**
   * Send money to a MonCash wallet (withdraw / payout).
   *
   * @param {Object} params
   * @param {number} params.gdes               — Amount in HTG
   * @param {string} params.wallet             — Recipient phone (8 or 11 digits)
   * @param {string} params.customerFirstName  — Recipient first name
   * @param {string} params.customerLastName   — Recipient last name
   * @param {string} [params.description]
   * @param {string} [params.referenceId]
   * @param {string} [params.customerEmail]
   * @param {string} [params.webhookUrl]
   * @returns {Promise<Object>}
   *
   * @example
   * const withdrawal = await bazik.payments.withdraw({
   *   gdes: 500,
   *   wallet: "47556677",
   *   customerFirstName: "Melissa",
   *   customerLastName: "Francois",
   *   description: "Weekly earnings",
   * });
   */
  async withdraw(params) {
    validateRequired(params, [
      "gdes",
      "wallet",
      "customerFirstName",
      "customerLastName",
    ]);
    validateAmount(params.gdes);
    validateWallet(params.wallet);

    return this.#client._request("POST", "/moncash/withdraw", params);
  }

  /**
   * Get account balance (MonCash).
   *
   * @returns {Promise<{ available: number, reserved: number, currency: string, environment: string, last_updated: string }>}
   *
   * @example
   * const balance = await bazik.payments.getBalance();
   * console.log(`Available: ${balance.available} ${balance.currency}`);
   */
  async getBalance() {
    return this.#client._request("GET", "/balance");
  }
}

// ─── Transfers sub-module ────────────────────────────────────────────────────

class Transfers {
  #client;

  constructor(client) {
    this.#client = client;
  }

  /**
   * Check MonCash customer/wallet status before sending a transfer.
   *
   * @param {string} wallet — MonCash phone number (8 digits)
   * @returns {Promise<Object>} — Customer KYC level and status flags
   *
   * @example
   * const status = await bazik.transfers.checkCustomer("37123456");
   * console.log(status.customerStatus.type); // "fullkyc"
   */
  async checkCustomer(wallet) {
    validateWallet(wallet);
    return this.#client._request("POST", "/moncash/customers/status", {
      wallet,
    });
  }

  /**
   * Create a MonCash transfer (send money to a wallet).
   *
   * @param {Object} params
   * @param {number} params.gdes               — Amount in HTG
   * @param {string} params.wallet             — Recipient phone (8 digits)
   * @param {string} params.customerFirstName
   * @param {string} params.customerLastName
   * @param {string} [params.description]
   * @param {string} [params.referenceId]
   * @param {string} [params.customerEmail]
   * @param {string} [params.webhookUrl]
   * @returns {Promise<Object>}
   *
   * @example
   * const transfer = await bazik.transfers.moncash({
   *   gdes: 500,
   *   wallet: "47556677",
   *   customerFirstName: "Melissa",
   *   customerLastName: "Francois",
   *   description: "Pou ou peye lekol la",
   * });
   * console.log(transfer.transaction_id); // "TRF_..."
   */
  async moncash(params) {
    validateRequired(params, [
      "gdes",
      "wallet",
      "customerFirstName",
      "customerLastName",
    ]);
    validateAmount(params.gdes);
    validateWallet(params.wallet);

    return this.#client._request("POST", "/moncash/transfers", params);
  }

  /**
   * Create a NatCash transfer.
   *
   * @param {Object} params
   * @param {number} params.gdes               — Amount in HTG
   * @param {string} params.wallet             — Recipient phone (8 digits)
   * @param {string} params.customerFirstName
   * @param {string} params.customerLastName
   * @param {string} [params.description]
   * @param {string} [params.referenceId]
   * @param {string} [params.customerEmail]
   * @param {string} [params.webhookUrl]
   * @returns {Promise<Object>}
   *
   * @example
   * const transfer = await bazik.transfers.natcash({
   *   gdes: 50,
   *   wallet: "44556677",
   *   customerFirstName: "Marie",
   *   customerLastName: "Pierre",
   * });
   */
  async natcash(params) {
    validateRequired(params, [
      "gdes",
      "wallet",
      "customerFirstName",
      "customerLastName",
    ]);
    validateAmount(params.gdes);
    validateWallet(params.wallet);

    return this.#client._request("POST", "/natcash/transfers", params);
  }

  /**
   * Get transfer status by transaction ID.
   *
   * @param {string} transactionId — e.g. "TRF_1761961466_eafd0ac3"
   * @returns {Promise<Object>}
   *
   * @example
   * const status = await bazik.transfers.getStatus("TRF_1761961466_eafd0ac3");
   * if (status.status === "successful") {
   *   console.log("Transfer completed!");
   * }
   */
  async getStatus(transactionId) {
    if (!transactionId) {
      throw new BazikValidationError("transactionId is required.");
    }
    return this.#client._request(
      "GET",
      `/transfers/${encodeURIComponent(transactionId)}`
    );
  }

  /**
   * Get a fee quote before creating a transfer.
   *
   * @param {number} amount          — Delivery amount in HTG
   * @param {"moncash"|"natcash"} provider
   * @returns {Promise<{ delivery_amount: number, fee: number, total_cost: number, currency: string, provider: string, fee_percentage: number }>}
   *
   * @example
   * const quote = await bazik.transfers.getQuote(1000, "moncash");
   * console.log(`Fee: ${quote.fee} HTG | Total: ${quote.total_cost} HTG`);
   */
  async getQuote(amount, provider) {
    validateAmount(amount);
    if (!["moncash", "natcash"].includes(provider)) {
      throw new BazikValidationError(
        `Invalid provider "${provider}". Must be "moncash" or "natcash".`
      );
    }
    return this.#client._request("POST", "/transfers/quote", {
      amount,
      provider,
    });
  }
}

// ─── Wallet sub-module ───────────────────────────────────────────────────────

class Wallet {
  #client;

  constructor(client) {
    this.#client = client;
  }

  /**
   * Get wallet balance.
   *
   * @returns {Promise<{ available: number, reserved: number, currency: string, environment: string, last_updated: string }>}
   *
   * @example
   * const wallet = await bazik.wallet.getBalance();
   * console.log(`Available: ${wallet.available} HTG`);
   */
  async getBalance() {
    return this.#client._request("GET", "/wallet");
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  Bazik,
  BazikError,
  BazikAuthError,
  BazikValidationError,
  BazikInsufficientFundsError,
  BazikRateLimitError,
};
