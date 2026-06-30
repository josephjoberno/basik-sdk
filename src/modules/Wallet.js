"use strict";

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

module.exports = Wallet;
