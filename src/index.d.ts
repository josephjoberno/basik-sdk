/**
 * Bazik SDK — TypeScript Definitions
 * @see https://bazik.io/docs/endpoints
 */

// ─── Configuration ───────────────────────────────────────────────────────────

export interface BazikConfig {
  /** Your Bazik user ID (e.g. "bzk_c5b754a0_1757383229") */
  userID: string;
  /** Your secret key */
  secretKey: string;
  /** API base URL (default: "https://api.bazik.io") */
  baseURL?: string;
  /** Automatically refresh token before expiry (default: true) */
  autoRefresh?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Callback fired when token is refreshed */
  onTokenRefresh?: (token: string) => void;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  success: boolean;
  token: string;
  user_id: string;
  expires_at: number;
  message: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface CreatePaymentParams {
  /** Amount in Gourdes (max 75,000) */
  gdes: number;
  /** User identifier */
  userID?: string;
  successUrl?: string;
  errorUrl?: string;
  description?: string;
  referenceId?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResponse {
  orderId: string;
  redirectUrl: string;
  status: "pending" | "successful" | "failed" | "cancelled";
  gourdes: number;
  referenceId: string;
  environment: "sandbox" | "production";
  sender: string;
  receiver: string;
  customerFullName: string;
  successUrl: string;
  errorUrl: string;
  userID: string;
  transactionType: string;
  metadata: Record<string, unknown>;
  payment: {
    mode: string;
    path: string;
    payment_token: { expired: string; created: string; token: string };
    timestamp: number;
    status: number;
    httpStatusCode: number;
  };
}

export interface PaymentVerification {
  orderId: string;
  referenceId: string;
  status: "pending" | "successful" | "failed" | "cancelled";
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    description?: string;
    customerEmail?: string;
    customerName?: string;
    [key: string]: unknown;
  };
}

export interface WithdrawParams {
  /** Amount in HTG */
  gdes: number;
  /** Recipient phone (8 or 11 digits) */
  wallet: string;
  customerFirstName: string;
  customerLastName: string;
  description?: string;
  referenceId?: string;
  customerEmail?: string;
  webhookUrl?: string;
}

export interface WithdrawResponse {
  transaction_id: string;
  status: "pending" | "completed" | "failed";
  provider: "moncash";
  amount: number;
  fees: number;
  total: number;
  currency: string;
  wallet: string;
  recipient: { first_name: string; last_name: string };
  description: string;
  referenceId: string;
  customerEmail: string;
  webhookUrl: string;
  created_at: string;
  environment: "sandbox" | "production";
  message: string;
}

export interface BalanceResponse {
  available: number;
  reserved: number;
  currency: string;
  environment: "sandbox" | "production";
  last_updated: string;
}

export interface WaitOptions {
  /** Polling interval in ms (default: 5000) */
  intervalMs?: number;
  /** Max wait time in ms (default: 300000) */
  timeoutMs?: number;
}

// ─── Transfers ───────────────────────────────────────────────────────────────

export interface TransferParams {
  gdes: number;
  wallet: string;
  customerFirstName: string;
  customerLastName: string;
  description?: string;
  referenceId?: string;
  customerEmail?: string;
  webhookUrl?: string;
}

export interface TransferResponse {
  transaction_id: string;
  status: "pending" | "completed" | "failed";
  provider: "moncash" | "natcash";
  amount: number;
  fees: number;
  total: number;
  currency: string;
  wallet: string;
  recipient: { first_name: string; last_name: string };
  description: string;
  referenceId: string;
  customerEmail: string;
  webhookUrl: string;
  created_at: string;
  environment: "sandbox" | "production";
  message: string;
}

export interface TransferStatusResponse {
  type: "transfer.succeeded" | "transfer.failed";
  transactionId: string;
  status: "successful" | "processing" | "failed" | "cancelled";
  amount: number;
  fees: number;
  total: number;
  currency: string;
  wallet: string;
  description: string;
  recipient: { firstName: string; lastName: string };
  referenceId: string;
  failureReason: string | null;
  timestamp: string;
  provider: "moncash" | "natcash";
  environment: "sandbox" | "production";
}

export interface CustomerStatusResponse {
  customerStatus: {
    type: string;
    status: string[];
  };
  timestamp: number;
  status: number;
  environment: "sandbox" | "production";
}

export interface QuoteResponse {
  delivery_amount: number;
  fee: number;
  total_cost: number;
  currency: string;
  provider: "moncash" | "natcash";
  fee_percentage: number;
  timestamp: string;
  environment: "sandbox" | "production";
}

// ─── Sub-modules ─────────────────────────────────────────────────────────────

export declare class Payments {
  create(params: CreatePaymentParams): Promise<PaymentResponse>;
  verify(orderId: string): Promise<PaymentVerification>;
  waitForCompletion(orderId: string, options?: WaitOptions): Promise<PaymentVerification>;
  withdraw(params: WithdrawParams): Promise<WithdrawResponse>;
  getBalance(): Promise<BalanceResponse>;
}

export declare class Transfers {
  checkCustomer(wallet: string): Promise<CustomerStatusResponse>;
  moncash(params: TransferParams): Promise<TransferResponse>;
  natcash(params: TransferParams): Promise<TransferResponse>;
  getStatus(transactionId: string): Promise<TransferStatusResponse>;
  getQuote(amount: number, provider: "moncash" | "natcash"): Promise<QuoteResponse>;
}

export declare class Wallet {
  getBalance(): Promise<BalanceResponse>;
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export declare class Bazik {
  constructor(config: BazikConfig);

  /** MonCash payment operations */
  readonly payments: Payments;
  /** MonCash & NatCash transfer operations */
  readonly transfers: Transfers;
  /** Wallet balance operations */
  readonly wallet: Wallet;

  /** Authenticate and obtain an access token */
  authenticate(): Promise<AuthResponse>;
  /** Check if current token is still valid */
  isTokenValid(): boolean;
  /** Get a valid token (auto-refreshes if needed) */
  getToken(): Promise<string>;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export declare class BazikError extends Error {
  status: number | null;
  code: string | null;
  details: unknown;
  constructor(message: string, status?: number, code?: string, details?: unknown);
}

export declare class BazikAuthError extends BazikError {}
export declare class BazikValidationError extends BazikError {}
export declare class BazikInsufficientFundsError extends BazikError {}
export declare class BazikRateLimitError extends BazikError {}

export default Bazik;
