// Wraps createWalletFromMethod under a separate module path so that
// sign.test.ts can mock it without affecting index.test.ts which tests ./index directly.
//
// NOTE: A live re-export (`export { createWalletFromMethod } from "./index"`) is intentionally
// avoided here. Bun links re-exported module bindings when mocking, which would cause
// mock.module("./walletFactory.js", ...) to also affect ./index.ts's module namespace.
import { createWalletFromMethod as _impl } from "./index";

export const createWalletFromMethod = (...args: Parameters<typeof _impl>): ReturnType<typeof _impl> => _impl(...args);
