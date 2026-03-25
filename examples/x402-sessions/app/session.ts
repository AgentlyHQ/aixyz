import { AsyncLocalStorage } from "node:async_hooks";

/**
 * AsyncLocalStorage that holds the current x402 payer address for the request.
 * Set by middleware after payment verification, read by tools during execution.
 */
export const signerStorage = new AsyncLocalStorage<string>();

/**
 * Get the current payer/signer address from the request context.
 * Returns undefined if no x402 payment was made (e.g., free routes).
 */
export function getSigner(): string | undefined {
  return signerStorage.getStore();
}

/**
 * In-memory content store: signer address -> key -> value.
 * Each signer gets their own isolated namespace.
 */
const contentStore = new Map<string, Map<string, string>>();

export function putContent(signer: string, key: string, value: string): void {
  let store = contentStore.get(signer);
  if (!store) {
    store = new Map();
    contentStore.set(signer, store);
  }
  store.set(key, value);
}

export function getContent(signer: string, key: string): string | undefined {
  return contentStore.get(signer)?.get(key);
}

export function listContent(signer: string): Record<string, string> {
  const store = contentStore.get(signer);
  if (!store) return {};
  return Object.fromEntries(store);
}

export function deleteContent(signer: string, key: string): boolean {
  return contentStore.get(signer)?.delete(key) ?? false;
}

/**
 * In-memory session history: signer address -> conversation summary.
 * The agent can load this to maintain continuity across requests.
 */
const sessionStore = new Map<string, string>();

export function getSessionContext(signer: string): string | undefined {
  return sessionStore.get(signer);
}

export function setSessionContext(signer: string, context: string): void {
  sessionStore.set(signer, context);
}
