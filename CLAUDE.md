# CLAUDE.md — Claude Code Instructions for bazik-sdk

## What is this project?

`bazik-sdk` is the official JavaScript SDK for **Bazik** (https://bazik.io), a payment API gateway for Haiti's mobile money ecosystem (MonCash by Digicel and NatCash). This SDK wraps the REST API with a clean, typed, zero-dependency Node.js client.

## Build & Test Commands

```bash
# Run all tests (36 tests, no deps needed)
node --test tests/bazik.test.js

# Run tests with verbose output
node --test --test-reporter spec tests/bazik.test.js

# Run example
node examples/quick-start.js
```

There is no build step. The SDK ships as plain JavaScript with a `.d.ts` file for TypeScript users.

## Code Structure

The SDK logic lives in **one file**: `src/index.js` (CommonJS). An ESM wrapper at `src/index.mjs` re-exports everything for `import` users. Don't split the source into multiple files unless the codebase grows past ~800 lines.

```
src/index.js      — All SDK logic (CommonJS, module.exports)
src/index.mjs     — ESM wrapper (re-exports from index.js)
src/index.d.ts    — TypeScript type definitions
```

The `exports` field in `package.json` handles dual CJS/ESM resolution:
- `require("bazik-sdk")` → `src/index.js`
- `import { Bazik } from "bazik-sdk"` → `src/index.mjs`

### Internal flow

```
User calls bazik.payments.create({ gdes: 500 })
  → Payments.create() validates input
  → calls this.#client._request("POST", "/moncash/token", body)
    → Bazik._request() calls getToken() (auto-authenticates if needed)
    → Bazik._request() sends fetch() with Bearer token
    → On 401: retry once after re-auth
    → On 402/429/4xx: throw typed error
    → Return parsed JSON
```

## Key Patterns

### Adding new endpoints

Follow this exact pattern:

```javascript
async newMethod(params) {
  // 1. Validate inputs
  validateRequired(params, ["field1", "field2"]);
  validateAmount(params.amount);

  // 2. Call internal request handler
  return this.#client._request("POST", "/new/endpoint", params);
}
```

Then add types in `src/index.d.ts`, re-export in `src/index.mjs` if needed, and tests in `tests/bazik.test.js`.

### Test pattern

Tests mock `globalThis.fetch`. Pattern:

```javascript
it("should do something", async () => {
  const client = await authClient(200, { /* mock response */ });
  const result = await client.someModule.someMethod(args);
  assert.equal(result.field, expected);
});
```

## Things to watch out for

1. **Don't add dependencies.** The zero-dep constraint is a feature, not a limitation.
2. **Private fields (#)** are used for credentials/tokens — never expose them.
3. **Token auto-refresh**: The SDK retries exactly once on 401. Don't add infinite retry loops.
4. **Wallet validation**: Must be 8 or 11 digits. The regex is `/^\d{8}(\d{3})?$/`.
5. **MonCash limit**: 75,000 HTG max per payment. Validated client-side.
6. **The `/moncash/token` endpoint creates payments** (confusing name) — it's not an auth endpoint.
7. **ESM wrapper**: When adding new public exports to `src/index.js`, also add them to `src/index.mjs`.

## API Documentation

Full API docs: https://bazik.io/docs/endpoints

Key endpoints:
- `POST /token` → Auth (userID + secretKey → Bearer token, 24h TTL)
- `POST /moncash/token` → Create payment → returns redirectUrl
- `GET /order/{id}` → Verify payment status
- `POST /moncash/transfers` → Send money via MonCash
- `POST /natcash/transfers` → Send money via NatCash
- `POST /transfers/quote` → Fee calculator
- `GET /wallet` → Balance check
