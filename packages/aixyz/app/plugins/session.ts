import { AsyncLocalStorage } from "node:async_hooks";
import { BasePlugin, type RegisterContext, type InitializeContext } from "../plugin";
import type { PaymentGateway } from "../payment/payment";

// ── Storage Interface ────────────────────────────────────────────────

/**
 * Pluggable session storage backend.
 * All methods are async to support external stores (Redis, DB, KV, etc.).
 * Operations are scoped by payer address — the x402 signer for the request.
 */
export interface SessionStore {
  get(payer: string, key: string): Promise<string | undefined>;
  set(payer: string, key: string, value: string): Promise<void>;
  delete(payer: string, key: string): Promise<boolean>;
  list(payer: string): Promise<Record<string, string>>;
}

/** Default in-memory implementation of {@link SessionStore}. */
export class InMemorySessionStore implements SessionStore {
  private data = new Map<string, Map<string, string>>();

  async get(payer: string, key: string): Promise<string | undefined> {
    return this.data.get(payer)?.get(key);
  }

  async set(payer: string, key: string, value: string): Promise<void> {
    let store = this.data.get(payer);
    if (!store) {
      store = new Map();
      this.data.set(payer, store);
    }
    store.set(key, value);
  }

  async delete(payer: string, key: string): Promise<boolean> {
    return this.data.get(payer)?.delete(key) ?? false;
  }

  async list(payer: string): Promise<Record<string, string>> {
    const store = this.data.get(payer);
    if (!store) return {};
    return Object.fromEntries(store);
  }
}

// ── Session Handle ───────────────────────────────────────────────────

/**
 * Payer-scoped session handle. All operations target the current
 * x402 payer without requiring the caller to pass an address.
 */
export interface Session {
  readonly payer: string;
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<Record<string, string>>;
}

function createSession(payer: string, store: SessionStore): Session {
  return {
    payer,
    get: (key) => store.get(payer, key),
    set: (key, value) => store.set(payer, key, value),
    delete: (key) => store.delete(payer, key),
    list: () => store.list(payer),
  };
}

// ── AsyncLocalStorage API ────────────────────────────────────────────

const sessionStorage = new AsyncLocalStorage<Session>();

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
      return next();
    });
  }

  initialize(ctx: InitializeContext): void {
    this.payment = ctx.payment;
  }

  /**
   * Run a function within a session context for the given payer.
   * Used by other plugins (e.g., MCPPlugin) to set session context
   * for tool execution when payment is handled at the protocol level.
   */
  runWithPayer<T>(payer: string, fn: () => T): T {
    const session = createSession(payer, this.store);
    return sessionStorage.run(session, fn);
  }
}
