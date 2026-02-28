<p align="center">
  <img src="logo.svg" alt="Bazik SDK" width="320" />
</p>

<h3 align="center">Unofficial JavaScript SDK for the Bazik API</h3>

<p align="center">
  MonCash & NatCash payments, transfers, and wallet management for Haiti.
</p>

<p align="center">
  <a href="https://bazik.io/docs/endpoints">Documentation</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#api-reference">API Reference</a> ·
  <a href="https://github.com/bazik-io/bazik-sdk-js/issues">Report Bug</a>
</p>

---

## Features

- **Zero dependencies** — Uses native `fetch` (Node.js 18+)
- **ESM & CommonJS** — Works with `import` and `require` out of the box
- **Automatic token management** — Handles auth token lifecycle, refresh, and retry
- **Full TypeScript support** — Complete `.d.ts` type definitions included
- **Input validation** — Catches errors before they hit the API
- **Structured errors** — Typed error classes for every failure mode
- **MonCash payments** — Create, verify, and poll payment status
- **MonCash & NatCash transfers** — Send money to wallets directly
- **Wallet management** — Check balance, get fee quotes

## Installation

```bash
npm install bazik-sdk
```

## Quick Start

```javascript
// ESM
import { Bazik } from "bazik-sdk";

// CommonJS
const { Bazik } = require("bazik-sdk");

const bazik = new Bazik({
  userID: "bzk_c5b754a0_1757383229",
  secretKey: "sk_5b0ff521b331c73db55313dc82f17cab",
});

// Authentication happens automatically on first API call.
// You can also authenticate explicitly:
await bazik.authenticate();
```

### Accept a Payment

```javascript
// 1. Create the payment
const payment = await bazik.payments.create({
  gdes: 1284.0,
  successUrl: "https://mysite.com/success",
  errorUrl: "https://mysite.com/error",
  description: "iPhone Pro Max",
  referenceId: "ORDER-001",
  customerFirstName: "Franck",
  customerLastName: "Jean",
  customerEmail: "franck@example.com",
  webhookUrl: "https://mysite.com/webhook",
});

// 2. Redirect customer to MonCash payment page
console.log("Redirect →", payment.redirectUrl);

// 3. Verify the payment (after redirect or via webhook)
const status = await bazik.payments.verify(payment.orderId);
console.log("Status:", status.status); // "successful" | "pending" | "failed"
```

### Send Money (Transfer)

```javascript
// Check recipient wallet first
const customer = await bazik.transfers.checkCustomer("37123456");
console.log("KYC:", customer.customerStatus.type);

// Get a fee quote
const quote = await bazik.transfers.getQuote(500, "moncash");
console.log(`Fee: ${quote.fee} HTG | Total: ${quote.total_cost} HTG`);

// Send via MonCash
const transfer = await bazik.transfers.moncash({
  gdes: 500,
  wallet: "47556677",
  customerFirstName: "Melissa",
  customerLastName: "Francois",
  description: "Salary payment",
});

console.log("Transaction:", transfer.transaction_id);

// Or send via NatCash
const natTransfer = await bazik.transfers.natcash({
  gdes: 50,
  wallet: "44556677",
  customerFirstName: "Marie",
  customerLastName: "Pierre",
});
```

### Check Balance

```javascript
const wallet = await bazik.wallet.getBalance();
console.log(`Available: ${wallet.available} ${wallet.currency}`);
console.log(`Reserved: ${wallet.reserved} ${wallet.currency}`);
```

## API Reference

### `new Bazik(config)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userID` | `string` | *required* | Your Bazik user ID |
| `secretKey` | `string` | *required* | Your secret key |
| `baseURL` | `string` | `https://api.bazik.io` | API base URL |
| `autoRefresh` | `boolean` | `true` | Auto-refresh token before expiry |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `onTokenRefresh` | `function` | — | Callback when token refreshes |

### `bazik.payments`

| Method | Description |
|--------|-------------|
| `.create(params)` | Create a MonCash payment (max 75,000 HTG) |
| `.verify(orderId)` | Get payment status by order ID |
| `.waitForCompletion(orderId, opts?)` | Poll until payment resolves |
| `.withdraw(params)` | Send money to a MonCash wallet |
| `.getBalance()` | Get account balance |

### `bazik.transfers`

| Method | Description |
|--------|-------------|
| `.checkCustomer(wallet)` | Check MonCash wallet KYC status |
| `.moncash(params)` | Create a MonCash transfer |
| `.natcash(params)` | Create a NatCash transfer |
| `.getStatus(transactionId)` | Get transfer status |
| `.getQuote(amount, provider)` | Get fee quote before transfer |

### `bazik.wallet`

| Method | Description |
|--------|-------------|
| `.getBalance()` | Get wallet balance (available + reserved) |

## Error Handling

The SDK provides typed error classes for precise error handling:

```javascript
import {
  Bazik,
  BazikError,                  // Base error
  BazikAuthError,              // 401 — Invalid credentials
  BazikValidationError,        // 400 — Invalid input
  BazikInsufficientFundsError, // 402 — Not enough balance
  BazikRateLimitError,         // 429 — Too many requests
} from "bazik-sdk";

try {
  await bazik.payments.create({ gdes: 500 });
} catch (err) {
  if (err instanceof BazikInsufficientFundsError) {
    console.error("Top up your account!");
  } else if (err instanceof BazikAuthError) {
    console.error("Check your credentials.");
  } else if (err instanceof BazikValidationError) {
    console.error("Invalid input:", err.details);
  } else if (err instanceof BazikRateLimitError) {
    console.error("Slow down — retry later.");
  } else {
    console.error("Unexpected:", err.message);
  }
}
```

Every error has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable description |
| `status` | `number \| null` | HTTP status code |
| `code` | `string \| null` | Machine-readable error code |
| `details` | `any` | Additional context |

## Polling Payment Status

Instead of using webhooks, you can poll for payment completion:

```javascript
try {
  const result = await bazik.payments.waitForCompletion(payment.orderId, {
    intervalMs: 5000,  // check every 5s
    timeoutMs: 120000, // give up after 2min
  });
  console.log("Final status:", result.status);
} catch (err) {
  if (err.code === "timeout") {
    console.log("Customer hasn't completed payment yet.");
  }
}
```

## Testing

```bash
node --test tests/
```

No external test framework required — uses Node.js built-in test runner.

## Requirements

- Node.js >= 18.0.0 (for native `fetch`)

## Links

- [Bazik Documentation](https://bazik.io/docs/endpoints)
- [Bazik Dashboard](https://bazik.io)
- [API Status](https://bazik.io)

## License

MIT — see [LICENSE](LICENSE) for details.
