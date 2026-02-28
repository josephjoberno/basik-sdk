# AGENTS.md — Bazik JavaScript SDK

Instructions for AI coding agents working on this codebase.

## Project Overview

This is an unofficial JavaScript/Node.js SDK for the **Bazik API**, a payment gateway for MonCash and NatCash mobile money services in Haiti. The SDK wraps the REST API at `https://api.bazik.io` with a zero-dependency client.

## Architecture

```
bazik-sdk/
├── src/
│   ├── index.js        # Main SDK — single-file, all logic here (CommonJS)
│   ├── index.mjs       # ESM wrapper — re-exports from index.js
│   └── index.d.ts      # TypeScript declarations
├── tests/
│   └── bazik.test.js   # Test suite (Node.js built-in test runner)
├── examples/
│   └── quick-start.js  # Usage example
├── package.json
├── README.md
├── AGENTS.md           # (this file)
├── CLAUDE.md           # Claude-specific coding guidance
└── llms.txt            # LLM-readable project summary
```

### Key Design Decisions

1. **Single-file SDK** — All logic lives in `src/index.js`. No internal module splitting. This keeps things simple and avoids bundler issues.
2. **Dual CJS/ESM** — Source is CommonJS (`src/index.js`), with an ESM wrapper (`src/index.mjs`). The `exports` field in `package.json` routes `import` to `.mjs` and `require` to `.js`.
3. **Zero dependencies** — Uses native `fetch` (Node.js 18+). No axios, no node-fetch.
4. **Private class fields** — Credentials and tokens stored with `#private` fields. Never exposed.
5. **Sub-modules** — The client exposes `bazik.payments`, `bazik.transfers`, and `bazik.wallet` as organized namespaces.
6. **Auto-refresh** — Token refresh happens transparently. On 401, the SDK retries once after re-authenticating.

## Working With the Code

### Running Tests

```bash
node --test tests/bazik.test.js
```

Tests use Node.js built-in `node:test` and `node:assert`. No external test framework. Tests mock `globalThis.fetch` — no network calls.

### Adding a New Endpoint

1. Identify which sub-module it belongs to (`Payments`, `Transfers`, or `Wallet`), or create a new one.
2. Add the method to the class in `src/index.js`.
3. Add input validation using `validateRequired()`, `validateAmount()`, `validateWallet()`.
4. Call `this.#client._request(method, path, body)` — this handles auth, retries, and error mapping.
5. Add TypeScript types in `src/index.d.ts`.
6. If the new class/export is public, add it to `src/index.mjs` re-exports.
7. Add tests in `tests/bazik.test.js`.

### Error Handling Pattern

All API errors are mapped to typed error classes:

| HTTP Status | Error Class |
|-------------|-------------|
| 400 | `BazikValidationError` (or `BazikError`) |
| 401 | `BazikAuthError` |
| 402 | `BazikInsufficientFundsError` |
| 429 | `BazikRateLimitError` |
| 4xx/5xx | `BazikError` |

Client-side validation throws `BazikValidationError` before making a request.

## API Reference (Quick)

Base URL: `https://api.bazik.io`

| Method | Endpoint | SDK Method |
|--------|----------|------------|
| POST | `/token` | `bazik.authenticate()` |
| POST | `/moncash/token` | `bazik.payments.create(params)` |
| GET | `/order/{orderId}` | `bazik.payments.verify(orderId)` |
| POST | `/moncash/withdraw` | `bazik.payments.withdraw(params)` |
| GET | `/balance` | `bazik.payments.getBalance()` |
| POST | `/moncash/customers/status` | `bazik.transfers.checkCustomer(wallet)` |
| POST | `/moncash/transfers` | `bazik.transfers.moncash(params)` |
| POST | `/natcash/transfers` | `bazik.transfers.natcash(params)` |
| GET | `/transfers/{id}` | `bazik.transfers.getStatus(id)` |
| POST | `/transfers/quote` | `bazik.transfers.getQuote(amount, provider)` |
| GET | `/wallet` | `bazik.wallet.getBalance()` |

## Conventions

- **Formatting** — 2-space indent. Semicolons. Standard JS style.
- **Naming** — `camelCase` for methods/variables, `PascalCase` for classes, `UPPER_SNAKE` for constants.
- **JSDoc** — All public methods have JSDoc with `@param`, `@returns`, and `@example`.
- **Exports** — Source is CommonJS (`module.exports`). ESM consumers use the `.mjs` wrapper. Both are exposed via the `exports` field in `package.json`.

## Important Constraints

- MonCash max payment: **75,000 HTG** per transaction.
- Wallet numbers: **8 or 11 digits** only.
- Tokens expire after **24 hours**.
- Transfer fees: **5% platform fee** (calculated by the API).
- The API uses **HTG (Haitian Gourdes)** as currency.
