"use strict";

const validateRequired = require("../helpers/validateRequired");
const validateAmount = require("../helpers/validateAmount");
const validateWallet = require("../helpers/validateWallet");
const { MAX_MONCASH_AMOUNT } = require("../constants");
const BazikError = require("../errors/BazikError");
const BazikValidationError = require("../errors/BazikValidationError");

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

module.exports = Payments;
