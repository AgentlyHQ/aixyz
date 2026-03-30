import type { HttpMethod, RouteHandler, RouteEntry, RouteOptions, Middleware } from "./types";
import type {
  PaymentGateway,
  BeforeVerifyHook,
  AfterVerifyHook,
  OnVerifyFailureHook,
  BeforeSettleHook,
  AfterSettleHook,
  OnSettleFailureHook,
} from "./payment/payment";

/**
 * Scoped interface for registering x402 payment lifecycle hooks.
 * Exposes only hook registration — not the full PaymentGateway.
 */
export interface PaymentHookContext {
  onBeforeVerify(hook: BeforeVerifyHook): PaymentHookContext;
  onAfterVerify(hook: AfterVerifyHook): PaymentHookContext;
  onVerifyFailure(hook: OnVerifyFailureHook): PaymentHookContext;
  onBeforeSettle(hook: BeforeSettleHook): PaymentHookContext;
  onAfterSettle(hook: AfterSettleHook): PaymentHookContext;
  onSettleFailure(hook: OnSettleFailureHook): PaymentHookContext;
}

/**
 * Scoped context passed to {@link BasePlugin.register}.
 *
 * Intentionally narrow — plugins can only register routes and middleware during
 * the registration phase. Every `route()` call is automatically tracked in
 * {@link BasePlugin.registeredRoutes}, so plugins never need to track their own routes.
 *
 * This follows the Rollup/Vite plugin context pattern: plugins receive a scoped
 * interface rather than the full application instance.
 */
export interface RegisterContext {
  /** Register a route on the application. Automatically tracked in `plugin.registeredRoutes`. */
  route(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions): void;
  /** Append a middleware to the application's middleware chain. */
  use(middleware: Middleware): void;
  /** Register hooks on the x402 payment lifecycle. Undefined when no facilitators configured. */
  readonly paymentHooks?: PaymentHookContext;
}

/**
 * Context passed to {@link BasePlugin.initialize}.
 *
 * Available after all plugins have registered their routes. Provides read access
 * to the full route table, other plugins, and the payment gateway — enabling
 * cross-plugin discovery and late-binding concerns like payment wrapper setup.
 *
 * Route registration should happen in `register()`, not `initialize()`.
 */
export interface InitializeContext {
  /** Read-only view of all registered routes across all plugins. */
  readonly routes: ReadonlyMap<string, RouteEntry>;
  /** Find a registered plugin by name. Returns `undefined` if not found. */
  getPlugin<T extends BasePlugin>(name: string): Readonly<T> | undefined;
  /** Payment gateway instance, if x402 payment is configured. */
  readonly payment?: PaymentGateway;
}

/**
 * Base class for all aixyz plugins.
 *
 * Plugins extend `BasePlugin` and implement one or both lifecycle hooks:
 *
 * - **`register(ctx)`** — Called by {@link AixyzApp.withPlugin}. Use `ctx.route()` and
 *   `ctx.use()` to register routes and middleware. Routes registered here are
 *   automatically tracked in {@link registeredRoutes}.
 *
 * - **`initialize(ctx)`** — Called by {@link AixyzApp.initialize} after all plugins
 *   have registered. Use `ctx.routes`, `ctx.getPlugin()`, and `ctx.payment` for
 *   cross-plugin discovery and late-binding (e.g., payment wrappers, UI generation).
 *
 * Both hooks are optional — a plugin may implement only `register` (most common),
 * only `initialize`, or both.
 *
 * @example
 * ```ts
 * class MyPlugin extends BasePlugin {
 *   readonly name = "my-plugin";
 *
 *   register(ctx: RegisterContext) {
 *     ctx.route("GET", "/health", () => Response.json({ ok: true }));
 *   }
 * }
 * ```
 */
export abstract class BasePlugin {
  /** Unique identifier for this plugin. Used by {@link InitializeContext.getPlugin} for discovery. */
  abstract readonly name: string;

  /**
   * Routes registered by this plugin during {@link register}.
   * Populated automatically by the framework — plugins do not need to manage this.
   */
  readonly registeredRoutes = new Map<string, RouteEntry>();

  /** Register routes and middleware. Called once by {@link AixyzApp.withPlugin}. */
  register?(ctx: RegisterContext): void | Promise<void>;

  /** Late initialization after all plugins have registered. Called once by {@link AixyzApp.initialize}. */
  initialize?(ctx: InitializeContext): void | Promise<void>;
}
