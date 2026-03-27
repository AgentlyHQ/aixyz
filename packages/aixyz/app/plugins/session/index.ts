import { AsyncLocalStorage } from "node:async_hooks";
import { BasePlugin, type RegisterContext, type InitializeContext } from "../../plugin";
import type { PaymentGateway } from "../../payment/payment";
import { InMemorySessionStore } from "./memory";

export { InMemorySessionStore, type InMemorySessionStoreOptions } from "./memory";

// ── Storage Interface ────────────────────────────────────────────────

/** Options for {@link SessionStore.set} and {@link SessionStore.setMany}. */
export interface SetOptions {
  /** Per-key TTL in milliseconds. Overrides the store-level default when supported. */
  ttlMs?: number;
}

/** Options for {@link SessionStore.list}. */
export interface ListOptions {
  /** Only return keys starting with this prefix. */
  prefix?: string;
  /** Opaque cursor from a previous `list()` call for pagination. */
  cursor?: string;
  /** Maximum number of entries to return. The store decides its own default when omitted. */
  limit?: number;
  /** If true, values are omitted (all values will be empty strings). */
  keysOnly?: boolean;
}

/** Return type for {@link SessionStore.list}. */
export interface ListResult {
  entries: Record<string, string>;
  /** If present, more results are available — pass to the next `list()` call. */
  cursor?: string;
}

/**
 * Pluggable session storage backend.
 * All methods are async to support external stores (Redis, DB, KV, etc.).
 * Operations are scoped by payer address — the x402 signer for the request.
 */
export interface SessionStore {
  get(payer: string, key: string): Promise<string | undefined>;
  set(payer: string, key: string, value: string, options?: SetOptions): Promise<void>;
  delete(payer: string, key: string): Promise<boolean>;
  list(payer: string, options?: ListOptions): Promise<ListResult>;

  /** Retrieve multiple keys in a single call. */
  getMany?(payer: string, keys: string[]): Promise<Record<string, string | undefined>>;
  /** Set multiple keys in a single call. */
  setMany?(payer: string, entries: Record<string, string>, options?: SetOptions): Promise<void>;
  /** Delete multiple keys in a single call. Returns the number of keys actually removed. */
  deleteMany?(payer: string, keys: string[]): Promise<number>;

  /** Release resources held by the store (connections, timers, etc.). */
  close?(): Promise<void>;
}

// ── Session Handle ───────────────────────────────────────────────────

/**
 * Payer-scoped session handle. All operations target the current
 * x402 payer without requiring the caller to pass an address.
 */
export interface Session {
  readonly payer: string;
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, options?: SetOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: ListOptions): Promise<ListResult>;
}

function createSession(payer: string, store: SessionStore): Session {
  // Normalize the payer address to lowercase so sessions are keyed consistently
  // regardless of whether the x402 verifier returns a checksummed (EIP-55) or
  // lowercase address. The original (possibly checksummed) address is still
  // exposed as `session.payer` for display purposes.
  const storedPayer = payer.toLowerCase();
  return {
    payer,
    get: (key) => store.get(storedPayer, key),
    set: (key, value, options) => store.set(storedPayer, key, value, options),
    delete: (key) => store.delete(storedPayer, key),
    list: (options) => store.list(storedPayer, options),
  };
}

// ── AsyncLocalStorage API ────────────────────────────────────────────

const sessionStorage = new AsyncLocalStorage<Session | undefined>();

/**
 * Get the current payer-scoped session.
 * Returns `undefined` if no x402 payment was made for this request.
 */
export function getSession(): Session | undefined {
  return sessionStorage.getStore();
}

/**
 * Get the current x402 payer address.
 * Shorthand for `getSession()?.payer`.
 */
export function getPayer(): string | undefined {
  return sessionStorage.getStore()?.payer;
}

// ── Plugin ───────────────────────────────────────────────────────────

export interface SessionPluginOptions {
  /** Custom session store. Defaults to {@link InMemorySessionStore}. */
  store?: SessionStore;
}

/**
 * Session plugin for aixyz. Provides payer-scoped key-value storage
 * gated by x402 payment identity.
 *
 * Register **before** other plugins so the session middleware runs first:
 *
 * ```ts
 * await app.withPlugin(new SessionPlugin());
 * await app.withPlugin(new A2APlugin([...]));
 * ```
 *
 * Tools access the session via {@link getSession}:
 *
 * ```ts
 * import { getSession } from "aixyz/app/plugins/session";
 *
 * const session = getSession();
 * await session?.set("key", "value");
 * ```
 */
export class SessionPlugin extends BasePlugin {
  readonly name = "session";
  readonly store: SessionStore;
  private payment?: PaymentGateway;

  constructor(options?: SessionPluginOptions) {
    super();
    this.store = options?.store ?? new InMemorySessionStore();
  }

  register(ctx: RegisterContext): void {
    ctx.use(async (request, next) => {
      const payer = this.payment?.getPayer(request);
      if (payer) {
        const session = createSession(payer, this.store);
        return sessionStorage.run(session, next);
      }
      // Explicitly clear any inherited ALS context so that an unpaid route
      // nested inside a paid handler's app.fetch() doesn't leak the outer session.
      return sessionStorage.run(undefined, next);
    });
  }

  initialize(ctx: InitializeContext): void {
    this.payment = ctx.payment;
    if (!this.payment) {
      console.warn(
        "[session] No payment gateway configured — getSession() will always return undefined. Configure x402 facilitators to enable sessions.",
      );
    }
  }

  /**
   * Run a function within a session context for the given payer.
   * Used by other plugins (e.g., MCPPlugin) to set session context
   * for tool execution when payment is handled at the protocol level.
   *
   * **Security note:** This method bypasses HTTP-level payment verification.
   * Only call it with a payer address that has already been authenticated by a
   * trusted payment mechanism (e.g., the `@x402/mcp` payment wrapper).
   * @internal
   */
  runWithPayer<T>(payer: string, fn: () => T): T {
    const session = createSession(payer, this.store);
    return sessionStorage.run(session, fn);
  }
}

/**
 * Identity helper that provides full type inference for a {@link SessionStore}.
 * Use in `app/session.ts` to get type-safe autocompletion:
 *
 * ```ts
 * import { defineSessionStore } from "aixyz/app/plugins/session";
 *
 * export default defineSessionStore({
 *   async get(payer, key) { ... },
 *   async set(payer, key, value) { ... },
 *   async delete(payer, key) { ... },
 *   async list(payer) { ... },
 * });
 * ```
 */
export function defineSessionStore(store: SessionStore): SessionStore {
  return store;
}
