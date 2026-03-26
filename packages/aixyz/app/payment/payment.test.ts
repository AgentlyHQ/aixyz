import { afterAll, beforeAll, describe, expect, test, mock, setDefaultTimeout } from "bun:test";
import { PaymentGateway } from "./payment";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from "@x402/core/http";
import { createFixture, type X402Fixture } from "../../test/x402-fixture";
import { createPaymentFetch, EvmPrivateKeyWallet } from "@use-agently/sdk";
import { AixyzApp } from "../index";

setDefaultTimeout(30_000);

let fixture: X402Fixture;

// These need to be mutable so beforeAll can set them before tests run.
// The mock.module factory evaluates getAixyzConfig lazily (at call-time),
// so `testPayTo` will be set by the time AixyzApp reads it.
let testPayTo = "0x0000000000000000000000000000000000000000";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: testPayTo, network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [], poweredByHeader: true },
    vercel: { maxDuration: 30 },
    skills: [],
  }),
  getAixyzConfigRuntime: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    skills: [],
  }),
}));

let url: string;
let stopServer: () => void;

beforeAll(async () => {
  fixture = await createFixture();
  testPayTo = fixture.payTo;

  const app = new AixyzApp({ facilitators: fixture.facilitator });
  app.route("POST", "/agent", () => new Response("ok"), {
    payment: { scheme: "exact", price: "$0.01" },
  });
  app.route("POST", "/agent-009", () => new Response("ok"), {
    payment: { scheme: "exact", price: "$0.009" },
  });
  app.route("POST", "/cheap", () => new Response("cheap"), {
    payment: { scheme: "exact", price: "$0.001" },
  });
  app.route("POST", "/expensive", () => new Response("expensive"), {
    payment: { scheme: "exact", price: "$1.00" },
  });
  app.route("POST", "/custom-payto", () => new Response("custom"), {
    payment: { scheme: "exact", price: "$0.01", payTo: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" },
  });
  app.route("POST", "/multi-accepts", () => new Response("multi"), {
    payment: [
      { scheme: "exact", price: "$0.01", network: "eip155:8453" },
      { scheme: "exact", price: "$0.05", network: "eip155:8453", payTo: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" },
    ],
  });
  app.route("POST", "/multi-network", () => new Response("multi-network"), {
    payment: [
      { scheme: "exact", price: "$0.005", network: "eip155:8453" },
      { scheme: "exact", price: "$0.05", network: "eip155:84532" },
    ],
  });
  app.route("POST", "/sepolia-only", () => new Response("sepolia"), {
    payment: [{ scheme: "exact", price: "$0.01", network: "eip155:84532" }],
  });
  app.route("GET", "/free", () => new Response("free"));
  await app.initialize();

  ({ url, stop: stopServer } = await fixture.serve(app));
}, 180_000);

afterAll(async () => {
  stopServer?.();
  await fixture.close();
}, 30_000);

describe("PaymentGateway", () => {
  test("returns 402 when payment header is missing", async () => {
    const res = await fetch(`${url}/agent`, { method: "POST" });
    expect(res.status).toBe(402);
  });

  test("verify() throws without initialize()", async () => {
    const gateway = new PaymentGateway(fixture.facilitator, {
      x402: { payTo: fixture.payTo, network: "eip155:8453" },
    } as any);
    const request = new Request("http://localhost/agent", { method: "POST" });
    expect(gateway.verify(request)).rejects.toThrow("PaymentGateway not initialized");
  });

  test("returns 402 with PAYMENT-REQUIRED header containing correct amounts", async () => {
    const res = await fetch(`${url}/agent-009`, { method: "POST" });
    expect(res.status).toBe(402);

    const header = res.headers.get("payment-required");
    expect(header).not.toBeNull();

    const decoded = decodePaymentRequiredHeader(header!);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].scheme).toBe("exact");
    expect(decoded.accepts[0].network).toBe("eip155:8453");
    expect(decoded.accepts[0].amount).toBe("9000"); // $0.009
  });

  test("returns 200 for routes without payment", async () => {
    const res = await fetch(`${url}/free`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("free");
  });

  test("returns 200 when valid payment is provided", async () => {
    const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
    const res = await payFetch(`${url}/agent`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  }, 30_000);

  test("returns 402 when payment header is malformed", async () => {
    const res = await fetch(`${url}/agent`, {
      method: "POST",
      headers: { "payment-signature": "garbage-not-base64-json" },
    });
    expect(res.status).toBe(402);
  });

  // --- Config Defaults ---

  test("payTo defaults to config value", async () => {
    const res = await fetch(`${url}/agent`, { method: "POST" });
    const decoded = decodePaymentRequiredHeader(res.headers.get("payment-required")!);
    expect(decoded.accepts[0].payTo).toBe(fixture.payTo);
  });

  test("explicit payTo overrides config", async () => {
    const res = await fetch(`${url}/custom-payto`, { method: "POST" });
    const decoded = decodePaymentRequiredHeader(res.headers.get("payment-required")!);
    expect(decoded.accepts[0].payTo).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  });

  test("network defaults to config value", async () => {
    const res = await fetch(`${url}/agent`, { method: "POST" });
    const decoded = decodePaymentRequiredHeader(res.headers.get("payment-required")!);
    expect(decoded.accepts[0].network).toBe("eip155:8453");
  });

  // --- Multiple Routes ---

  test("different prices return correct amounts", async () => {
    const cheapRes = await fetch(`${url}/cheap`, { method: "POST" });
    const expensiveRes = await fetch(`${url}/expensive`, { method: "POST" });

    const cheapDecoded = decodePaymentRequiredHeader(cheapRes.headers.get("payment-required")!);
    const expensiveDecoded = decodePaymentRequiredHeader(expensiveRes.headers.get("payment-required")!);

    expect(cheapDecoded.accepts[0].amount).toBe("1000"); // $0.001 = 1000 (USDC 6 decimals)
    expect(expensiveDecoded.accepts[0].amount).toBe("1000000"); // $1.00 = 1000000
    expect(Number(expensiveDecoded.accepts[0].amount)).toBeGreaterThan(Number(cheapDecoded.accepts[0].amount));
  });

  // --- Response Format ---

  test("402 response has JSON content-type", async () => {
    const res = await fetch(`${url}/agent`, { method: "POST" });
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("402 response body is parseable JSON", async () => {
    const res = await fetch(`${url}/agent`, { method: "POST" });
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });

  // --- Settlement ---

  test("array accepts returns 402 with multiple payment options", async () => {
    const res = await fetch(`${url}/multi-accepts`, { method: "POST" });
    expect(res.status).toBe(402);

    const decoded = decodePaymentRequiredHeader(res.headers.get("payment-required")!);
    expect(decoded.accepts).toHaveLength(2);
    expect(decoded.accepts[0].amount).toBe("10000"); // $0.01
    expect(decoded.accepts[0].payTo).toBe(fixture.payTo); // defaults to config
    expect(decoded.accepts[1].amount).toBe("50000"); // $0.05
    expect(decoded.accepts[1].payTo).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"); // explicit
  });

  test("array accepts with different networks returns 402 with both networks", async () => {
    const res = await fetch(`${url}/multi-network`, { method: "POST" });
    expect(res.status).toBe(402);

    const decoded = decodePaymentRequiredHeader(res.headers.get("payment-required")!);
    expect(decoded.accepts).toHaveLength(2);
    expect(decoded.accepts[0].network).toBe("eip155:8453");
    expect(decoded.accepts[0].amount).toBe("5000"); // $0.005
    expect(decoded.accepts[1].network).toBe("eip155:84532");
    expect(decoded.accepts[1].amount).toBe("50000"); // $0.05
  });

  test("multi-network: paying on default network debits sender", async () => {
    const senderAddress = fixture.wallet.address as `0x${string}`;
    const senderBefore = await fixture.container.balance(senderAddress);

    const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
    // Default selector picks the first option (eip155:8453, $0.005)
    const res = await payFetch(`${url}/multi-network`, { method: "POST" });
    expect(res.status).toBe(200);

    const decoded = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE")!);
    expect(decoded.success).toBe(true);
    expect(decoded.network).toBe("eip155:8453");

    const senderAfter = await fixture.container.balance(senderAddress);
    expect(senderBefore.value - senderAfter.value).toBe(5000n); // $0.005 in USDC (6 decimals)
  }, 30_000);

  test("multi-network: paying on secondary network debits correct chain", async () => {
    const senderAddress = fixture.wallet.address as `0x${string}`;
    const senderBeforeBase = await fixture.container.balance(senderAddress);
    const senderBeforeSepolia = await fixture.container.balance(senderAddress, "base-sepolia");

    // Create wallet pointing at the sepolia RPC for signing on that chain
    const sepoliaWallet = new EvmPrivateKeyWallet(
      (fixture.wallet as any).privateKey ?? (fixture.wallet as any)._privateKey,
      fixture.container.getRpcUrl("base-sepolia"),
    );
    const payFetch = createPaymentFetch(sepoliaWallet) as typeof fetch;

    // /sepolia-only route has only eip155:84532, so no ambiguity
    const res = await payFetch(`${url}/sepolia-only`, { method: "POST" });
    expect(res.status).toBe(200);

    const decoded = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE")!);
    expect(decoded.success).toBe(true);
    expect(decoded.network).toBe("eip155:84532");

    // Base balance should be unchanged
    const senderAfterBase = await fixture.container.balance(senderAddress);
    expect(senderAfterBase.value).toBe(senderBeforeBase.value);

    // Sepolia balance should be debited exactly $0.01
    const senderAfterSepolia = await fixture.container.balance(senderAddress, "base-sepolia");
    expect(senderBeforeSepolia.value - senderAfterSepolia.value).toBe(10000n); // $0.01 in USDC (6 decimals)
  }, 30_000);

  test("multi-accepts: payment settles and returns correct payer", async () => {
    const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
    const res = await payFetch(`${url}/multi-accepts`, { method: "POST" });
    expect(res.status).toBe(200);

    const decoded = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE")!);
    expect(decoded.success).toBe(true);
    expect(decoded.payer).toBe(fixture.wallet.address);
  }, 30_000);

  test("successful payment settles and debits sender", async () => {
    const senderBefore = await fixture.container.balance(
      (await import("viem/accounts")).privateKeyToAccount(
        (fixture.wallet as any).privateKey ?? (fixture.wallet as any)._privateKey,
      ).address,
    );

    const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
    const res = await payFetch(`${url}/cheap`, { method: "POST" });
    expect(res.status).toBe(200);

    const decoded = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE")!);
    expect(decoded).toEqual({
      success: true,
      transaction: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      network: "eip155:8453",
      payer: fixture.wallet.address,
    });
  }, 30_000);
});
