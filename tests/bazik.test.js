/**
 * Bazik SDK Test Suite
 * Uses Node.js built-in test runner (no dependencies).
 *
 * Run: node --test tests/bazik.test.js
 */

const { describe, it, mock, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  Bazik,
  BazikError,
  BazikAuthError,
  BazikValidationError,
  BazikInsufficientFundsError,
  BazikRateLimitError,
} = require("../src/index.js");

// ─── Mock fetch ──────────────────────────────────────────────────────────────

function mockFetch(status, body) {
  return mock.fn(() =>
    Promise.resolve({
      status,
      headers: {
        get: () => "application/json",
      },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

function setupClient(fetchMock) {
  globalThis.fetch = fetchMock;
  return new Bazik({
    userID: "bzk_test_123",
    secretKey: "sk_test_secret",
    autoRefresh: false,
  });
}

// ─── Constructor tests ───────────────────────────────────────────────────────

describe("Bazik Constructor", () => {
  it("should throw if userID is missing", () => {
    assert.throws(
      () => new Bazik({ secretKey: "sk_test" }),
      BazikValidationError
    );
  });

  it("should throw if secretKey is missing", () => {
    assert.throws(
      () => new Bazik({ userID: "bzk_test" }),
      BazikValidationError
    );
  });

  it("should throw if config is empty", () => {
    assert.throws(() => new Bazik({}), BazikValidationError);
  });

  it("should create client with valid config", () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
    });
    assert.ok(client);
    assert.ok(client.payments);
    assert.ok(client.transfers);
    assert.ok(client.wallet);
  });

  it("should accept custom baseURL", () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      baseURL: "https://sandbox.bazik.io",
    });
    assert.ok(client);
  });
});

// ─── Authentication tests ────────────────────────────────────────────────────

describe("Authentication", () => {
  it("should authenticate successfully", async () => {
    const mockResponse = {
      success: true,
      token: "eyJ0ZXN0IjoidG9rZW4ifQ==",
      user_id: "bzk_test_123",
      expires_at: Date.now() + 86_400_000,
      message: "Authentication successful",
    };

    const fetchFn = mockFetch(200, mockResponse);
    const client = setupClient(fetchFn);
    const result = await client.authenticate();

    assert.equal(result.success, true);
    assert.equal(result.token, mockResponse.token);
    assert.equal(result.user_id, "bzk_test_123");
    assert.equal(fetchFn.mock.calls.length, 1);
  });

  it("should throw BazikAuthError on 401", async () => {
    const fetchFn = mockFetch(401, {
      success: false,
      error: {
        code: "invalid_credentials",
        message: "Invalid userID or secretKey",
      },
    });
    const client = setupClient(fetchFn);

    await assert.rejects(() => client.authenticate(), BazikAuthError);
  });

  it("should throw BazikRateLimitError on 429", async () => {
    const fetchFn = mockFetch(429, {
      error: { message: "Too many requests" },
    });
    const client = setupClient(fetchFn);

    await assert.rejects(() => client.authenticate(), BazikRateLimitError);
  });

  it("should report token as invalid when not authenticated", () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });
    assert.equal(client.isTokenValid(), false);
  });

  it("should fire onTokenRefresh callback", async () => {
    let refreshedToken = null;
    const fetchFn = mockFetch(200, {
      success: true,
      token: "new_token",
      user_id: "bzk_test",
      expires_at: Date.now() + 86_400_000,
      message: "ok",
    });
    globalThis.fetch = fetchFn;

    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
      onTokenRefresh: (token) => {
        refreshedToken = token;
      },
    });

    await client.authenticate();
    assert.equal(refreshedToken, "new_token");
  });
});

// ─── Payment tests ───────────────────────────────────────────────────────────

describe("Payments", () => {
  /** Helper: authenticate then swap fetch for the next call. */
  async function authClient(nextStatus, nextBody) {
    const authFetch = mockFetch(200, {
      success: true,
      token: "test_token",
      user_id: "bzk_test",
      expires_at: Date.now() + 86_400_000,
      message: "ok",
    });
    const client = setupClient(authFetch);
    await client.authenticate();

    globalThis.fetch = mockFetch(nextStatus, nextBody);
    return client;
  }

  it("should create a payment", async () => {
    const client = await authClient(200, {
      orderId: "BZK_test_001",
      redirectUrl: "https://moncash.example.com/pay",
      status: "pending",
    });

    const payment = await client.payments.create({
      gdes: 500,
      description: "Test",
    });

    assert.equal(payment.orderId, "BZK_test_001");
    assert.ok(payment.redirectUrl);
  });

  it("should reject payment over 75,000 HTG", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.payments.create({ gdes: 80_000 }),
      BazikValidationError
    );
  });

  it("should reject payment with zero amount", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.payments.create({ gdes: 0 }),
      BazikValidationError
    );
  });

  it("should reject payment with negative amount", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.payments.create({ gdes: -100 }),
      BazikValidationError
    );
  });

  it("should reject payment without gdes", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.payments.create({}),
      BazikValidationError
    );
  });

  it("should verify a payment", async () => {
    const client = await authClient(200, {
      orderId: "BZK_test_001",
      status: "successful",
      amount: 500,
      currency: "HTG",
    });

    const result = await client.payments.verify("BZK_test_001");
    assert.equal(result.status, "successful");
  });

  it("should reject verify without orderId", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.payments.verify(""),
      BazikValidationError
    );
  });

  it("should create a withdrawal", async () => {
    const client = await authClient(201, {
      transaction_id: "TRF_test_001",
      status: "pending",
      amount: 500,
      fees: 25,
      total: 525,
    });

    const result = await client.payments.withdraw({
      gdes: 500,
      wallet: "47556677",
      customerFirstName: "Test",
      customerLastName: "User",
    });

    assert.equal(result.transaction_id, "TRF_test_001");
    assert.equal(result.total, 525);
  });

  it("should reject withdrawal with invalid wallet", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () =>
        client.payments.withdraw({
          gdes: 500,
          wallet: "123", // too short
          customerFirstName: "A",
          customerLastName: "B",
        }),
      BazikValidationError
    );
  });

  it("should get balance", async () => {
    const client = await authClient(200, {
      available: 1000,
      reserved: 200,
      currency: "HTG",
    });

    const balance = await client.payments.getBalance();
    assert.equal(balance.available, 1000);
    assert.equal(balance.currency, "HTG");
  });
});

// ─── Transfer tests ──────────────────────────────────────────────────────────

describe("Transfers", () => {
  async function authClient(nextStatus, nextBody) {
    const authFetch = mockFetch(200, {
      success: true,
      token: "test_token",
      user_id: "bzk_test",
      expires_at: Date.now() + 86_400_000,
      message: "ok",
    });
    const client = setupClient(authFetch);
    await client.authenticate();
    globalThis.fetch = mockFetch(nextStatus, nextBody);
    return client;
  }

  it("should check customer status", async () => {
    const client = await authClient(200, {
      customerStatus: { type: "fullkyc", status: ["registered", "active"] },
    });

    const result = await client.transfers.checkCustomer("37123456");
    assert.equal(result.customerStatus.type, "fullkyc");
  });

  it("should reject invalid wallet in checkCustomer", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.transfers.checkCustomer("abc"),
      BazikValidationError
    );
  });

  it("should create MonCash transfer", async () => {
    const client = await authClient(201, {
      transaction_id: "TRF_mc_001",
      status: "pending",
      provider: "moncash",
      amount: 500,
      fees: 25,
      total: 525,
    });

    const result = await client.transfers.moncash({
      gdes: 500,
      wallet: "47556677",
      customerFirstName: "Melissa",
      customerLastName: "Francois",
    });

    assert.equal(result.provider, "moncash");
    assert.equal(result.transaction_id, "TRF_mc_001");
  });

  it("should create NatCash transfer", async () => {
    const client = await authClient(201, {
      transaction_id: "TRF_nc_001",
      status: "pending",
      provider: "natcash",
    });

    const result = await client.transfers.natcash({
      gdes: 50,
      wallet: "44556677",
      customerFirstName: "Marie",
      customerLastName: "Pierre",
    });

    assert.equal(result.provider, "natcash");
  });

  it("should get transfer status", async () => {
    const client = await authClient(200, {
      type: "transfer.succeeded",
      transactionId: "TRF_001",
      status: "successful",
    });

    const result = await client.transfers.getStatus("TRF_001");
    assert.equal(result.status, "successful");
  });

  it("should reject getStatus without transactionId", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.transfers.getStatus(""),
      BazikValidationError
    );
  });

  it("should get a quote for moncash", async () => {
    const client = await authClient(200, {
      delivery_amount: 1000,
      fee: 50,
      total_cost: 1050,
      provider: "moncash",
    });

    const quote = await client.transfers.getQuote(1000, "moncash");
    assert.equal(quote.total_cost, 1050);
    assert.equal(quote.fee, 50);
  });

  it("should get a quote for natcash", async () => {
    const client = await authClient(200, {
      delivery_amount: 500,
      fee: 25,
      total_cost: 525,
      provider: "natcash",
    });

    const quote = await client.transfers.getQuote(500, "natcash");
    assert.equal(quote.provider, "natcash");
  });

  it("should reject invalid provider in getQuote", async () => {
    const client = new Bazik({
      userID: "bzk_test",
      secretKey: "sk_test",
      autoRefresh: false,
    });

    await assert.rejects(
      () => client.transfers.getQuote(100, "paypal"),
      BazikValidationError
    );
  });

  it("should handle 402 insufficient funds", async () => {
    const client = await authClient(402, {
      error: { message: "Insufficient funds" },
    });

    await assert.rejects(
      () =>
        client.transfers.moncash({
          gdes: 999999,
          wallet: "47556677",
          customerFirstName: "A",
          customerLastName: "B",
        }),
      BazikInsufficientFundsError
    );
  });
});

// ─── Wallet tests ────────────────────────────────────────────────────────────

describe("Wallet", () => {
  it("should get wallet balance", async () => {
    const authFetch = mockFetch(200, {
      success: true,
      token: "test_token",
      user_id: "bzk_test",
      expires_at: Date.now() + 86_400_000,
      message: "ok",
    });
    const client = setupClient(authFetch);
    await client.authenticate();

    globalThis.fetch = mockFetch(200, {
      available: 440,
      reserved: 60,
      currency: "HTG",
      environment: "production",
    });

    const balance = await client.wallet.getBalance();
    assert.equal(balance.available, 440);
    assert.equal(balance.reserved, 60);
  });
});

// ─── Error classes ───────────────────────────────────────────────────────────

describe("Error classes", () => {
  it("BazikError should have correct properties", () => {
    const err = new BazikError("test", 500, "server_error", { foo: "bar" });
    assert.equal(err.message, "test");
    assert.equal(err.status, 500);
    assert.equal(err.code, "server_error");
    assert.deepEqual(err.details, { foo: "bar" });
    assert.equal(err.name, "BazikError");
    assert.ok(err instanceof Error);
  });

  it("BazikAuthError should extend BazikError", () => {
    const err = new BazikAuthError("unauthorized", 401);
    assert.ok(err instanceof BazikError);
    assert.ok(err instanceof Error);
    assert.equal(err.name, "BazikAuthError");
  });

  it("BazikValidationError should have status 400", () => {
    const err = new BazikValidationError("bad input");
    assert.equal(err.status, 400);
    assert.equal(err.code, "validation_error");
  });

  it("BazikInsufficientFundsError should have status 402", () => {
    const err = new BazikInsufficientFundsError("no funds");
    assert.equal(err.status, 402);
  });

  it("BazikRateLimitError should have status 429", () => {
    const err = new BazikRateLimitError("slow down");
    assert.equal(err.status, 429);
  });
});
