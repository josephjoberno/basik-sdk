"use strict";

const validateRequired = require("../helpers/validateRequired");
const validateAmount = require("../helpers/validateAmount");
const validateWallet = require("../helpers/validateWallet");
const BazikValidationError = require("../errors/BazikValidationError");

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

module.exports = Transfers;
