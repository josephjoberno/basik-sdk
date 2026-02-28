/**
 * Bazik SDK — Quick Start Example
 *
 * Replace the credentials below with your own from https://bazik.io
 * Then run: node examples/quick-start.js
 */

const { Bazik, BazikError, BazikInsufficientFundsError } = require("../src/index.js");

const bazik = new Bazik({
  userID: "bzk_c5b754a0_1757383229",
  secretKey: "sk_5b0ff521b331c73db55313dc82f17cab",
});

async function main() {
  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    console.log("Authenticating...");
    const auth = await bazik.authenticate();
    console.log(`   Token obtained (expires: ${new Date(auth.expires_at).toISOString()})`);

    // ── 2. Check wallet balance ──────────────────────────────────────────
    console.log("\nChecking wallet balance...");
    const wallet = await bazik.wallet.getBalance();
    console.log(`   Available: ${wallet.available} ${wallet.currency}`);
    console.log(`   Reserved:  ${wallet.reserved} ${wallet.currency}`);

    // ── 3. Create a payment ──────────────────────────────────────────────
    console.log("\nCreating MonCash payment...");
    const payment = await bazik.payments.create({
      gdes: 100.0,
      description: "Test payment",
      referenceId: `TEST-${Date.now()}`,
      successUrl: "https://example.com/success",
      errorUrl: "https://example.com/error",
      customerFirstName: "Test",
      customerLastName: "User",
      customerEmail: "test@example.com",
    });
    console.log(`   Order ID:    ${payment.orderId}`);
    console.log(`   Redirect URL: ${payment.redirectUrl}`);
    console.log(`   Status:      ${payment.status}`);

    // ── 4. Get a transfer quote ──────────────────────────────────────────
    console.log("\nGetting transfer quote...");
    const quote = await bazik.transfers.getQuote(500, "moncash");
    console.log(`   Delivery: ${quote.delivery_amount} HTG`);
    console.log(`   Fee:      ${quote.fee} HTG (${quote.fee_percentage}%)`);
    console.log(`   Total:    ${quote.total_cost} HTG`);

    console.log("\nAll done!");
  } catch (err) {
    if (err instanceof BazikInsufficientFundsError) {
      console.error("Insufficient funds — top up your Bazik wallet.");
    } else if (err instanceof BazikError) {
      console.error(`Bazik error [${err.status}]: ${err.message}`);
    } else {
      console.error("Unexpected error:", err);
    }
  }
}

main();
