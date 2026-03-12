import { describe, expect, test } from "bun:test";
import { PaymentGateway } from "./payment";
import type { FacilitatorClient } from "@x402/core/server";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";

// Mock facilitator that always succeeds
const mockFacilitator: FacilitatorClient = {
  verify: async () => ({ isValid: true, invalidReason: undefined }),
  settle: async () => ({ success: true }),
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
    extensions: [],
    signers: {},
  }),
} as any;

const mockConfig = {
  x402: {
    payTo: "0x1234567890abcdef1234567890abcdef12345678",
    network: "eip155:8453",
  },
} as any;

/**
 * Helper: get 402 from a gateway, decode requirements, build a valid payment header.
 */
async function createPaymentHeader(gateway: PaymentGateway, method: string, path: string): Promise<string> {
  const res = await gateway.verify(new Request(`http://localhost${path}`, { method }));
  if (!res || res.status !== 402) throw new Error(`Expected 402 but got ${res?.status}`);
  const header = res.headers.get("payment-required");
  if (!header) throw new Error("Missing payment-required header");
  const decoded = decodePaymentRequiredHeader(header);
  return encodePaymentSignatureHeader({
    x402Version: decoded.x402Version,
    resource: decoded.resource,
    accepted: decoded.accepts[0],
    payload: { signature: "0xfake" },
  });
}

describe("PaymentGateway", () => {
  test("verify() returns 402 Response when payment header is missing", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const request = new Request("http://localhost/agent", { method: "POST" });
    const result = await gateway.verify(request);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(402);
  });

  test("verify() throws without initialize()", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    const request = new Request("http://localhost/agent", { method: "POST" });
    expect(gateway.verify(request)).rejects.toThrow("PaymentGateway not initialized");
  });

  test("verify() returns 402 with PAYMENT-REQUIRED header", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.009" });
    await gateway.initialize();

    const request = new Request("http://localhost/agent", { method: "POST" });
    const result = await gateway.verify(request);
    expect(result).not.toBeNull();
    expect(result!.status).toStrictEqual(402);

    const header = result!.headers.get("payment-required");
    expect(header).not.toBeNull();

    const decoded = decodePaymentRequiredHeader(header!);
    expect(decoded.accepts).toBeArrayOfSize(1);
    expect(decoded.accepts[0].scheme).toStrictEqual("exact");
    expect(decoded.accepts[0].network).toStrictEqual("eip155:8453");
    expect(decoded.accepts[0].amount).toStrictEqual("9000"); // $0.009
  });

  test("verify() returns null for routes without payment", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const request = new Request("http://localhost/other", { method: "GET" });
    const result = await gateway.verify(request);
    expect(result).toBeNull();
  });

  // --- Payment Verified Path ---

  test("verify() returns null when valid PAYMENT-SIGNATURE header present", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const paymentHeader = await createPaymentHeader(gateway, "POST", "/agent");
    const request = new Request("http://localhost/agent", {
      method: "POST",
      headers: { "payment-signature": paymentHeader },
    });
    const result = await gateway.verify(request);
    expect(result).toBeNull();
  });

  test("verify() returns 402 when payment header is malformed", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const request = new Request("http://localhost/agent", {
      method: "POST",
      headers: { "payment-signature": "garbage-not-base64-json" },
    });
    const result = await gateway.verify(request);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(402);
  });

  // --- Config Defaults ---

  test("payTo defaults to config value", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const res = await gateway.verify(new Request("http://localhost/agent", { method: "POST" }));
    const decoded = decodePaymentRequiredHeader(res!.headers.get("payment-required")!);
    expect(decoded.accepts[0].payTo).toBe(mockConfig.x402.payTo);
  });

  test("explicit payTo overrides config", async () => {
    const customPayTo = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01", payTo: customPayTo });
    await gateway.initialize();

    const res = await gateway.verify(new Request("http://localhost/agent", { method: "POST" }));
    const decoded = decodePaymentRequiredHeader(res!.headers.get("payment-required")!);
    expect(decoded.accepts[0].payTo).toBe(customPayTo);
  });

  test("network defaults to config value", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const res = await gateway.verify(new Request("http://localhost/agent", { method: "POST" }));
    const decoded = decodePaymentRequiredHeader(res!.headers.get("payment-required")!);
    expect(decoded.accepts[0].network).toBe(mockConfig.x402.network);
  });

  // --- Multiple Routes ---

  test("different prices return correct amounts", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/cheap", { scheme: "exact", price: "$0.001" });
    gateway.addRoute("POST", "/expensive", { scheme: "exact", price: "$1.00" });
    await gateway.initialize();

    const cheapRes = await gateway.verify(new Request("http://localhost/cheap", { method: "POST" }));
    const expensiveRes = await gateway.verify(new Request("http://localhost/expensive", { method: "POST" }));

    const cheapDecoded = decodePaymentRequiredHeader(cheapRes!.headers.get("payment-required")!);
    const expensiveDecoded = decodePaymentRequiredHeader(expensiveRes!.headers.get("payment-required")!);

    expect(cheapDecoded.accepts[0].amount).toBe("1000"); // $0.001 = 1000 (USDC 6 decimals)
    expect(expensiveDecoded.accepts[0].amount).toBe("1000000"); // $1.00 = 1000000
    expect(Number(expensiveDecoded.accepts[0].amount)).toBeGreaterThan(Number(cheapDecoded.accepts[0].amount));
  });

  // --- Response Format ---

  test("402 response has JSON content-type", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const res = await gateway.verify(new Request("http://localhost/agent", { method: "POST" }));
    expect(res!.headers.get("content-type")).toContain("application/json");
  });

  test("402 response body is parseable JSON", async () => {
    const gateway = new PaymentGateway(mockFacilitator, mockConfig);
    gateway.register("eip155:8453");
    gateway.addRoute("POST", "/agent", { scheme: "exact", price: "$0.01" });
    await gateway.initialize();

    const res = await gateway.verify(new Request("http://localhost/agent", { method: "POST" }));
    const body = await res!.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });
});
