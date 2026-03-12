import { describe, expect, mock, test } from "bun:test";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: "0x1234", network: "eip155:8453" },
    build: { tools: [], agents: [], excludes: [] },
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

import { AixyzApp } from "./index";

describe("AixyzApp", () => {
  test("route() registers a handler and fetch() dispatches it", async () => {
    const app = new AixyzApp();
    app.route("GET", "/hello", () => new Response("world"));

    const res = await app.fetch(new Request("http://localhost/hello"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("world");
  });

  test("fetch() returns 404 for unregistered routes", async () => {
    const app = new AixyzApp();
    const res = await app.fetch(new Request("http://localhost/missing"));
    expect(res.status).toBe(404);
  });

  test("fetch() matches method correctly", async () => {
    const app = new AixyzApp();
    app.route("POST", "/submit", () => new Response("ok"));

    const getRes = await app.fetch(new Request("http://localhost/submit", { method: "GET" }));
    expect(getRes.status).toBe(404);

    const postRes = await app.fetch(new Request("http://localhost/submit", { method: "POST" }));
    expect(postRes.status).toBe(200);
  });

  test("use() adds global middleware that wraps handlers", async () => {
    const app = new AixyzApp();
    app.use(async (req, next) => {
      const res = await next();
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), "x-middleware": "applied" },
      });
    });
    app.route("GET", "/test", () => new Response("hello"));

    const res = await app.fetch(new Request("http://localhost/test"));
    expect(res.headers.get("x-middleware")).toBe("applied");
    expect(await res.text()).toBe("hello");
  });

  test("middleware chain executes in order", async () => {
    const app = new AixyzApp();
    const order: number[] = [];

    app.use(async (_req, next) => {
      order.push(1);
      const res = await next();
      order.push(4);
      return res;
    });
    app.use(async (_req, next) => {
      order.push(2);
      const res = await next();
      order.push(3);
      return res;
    });
    app.route("GET", "/", () => new Response("ok"));

    await app.fetch(new Request("http://localhost/"));
    expect(order).toEqual([1, 2, 3, 4]);
  });

  test("routes map is publicly accessible", () => {
    const app = new AixyzApp();
    app.route("GET", "/a", () => new Response("a"));
    app.route("POST", "/b", () => new Response("b"), { payment: { scheme: "exact", price: "$0.01" } });

    expect(app.routes.size).toBe(2);
    expect(app.routes.has("GET /a")).toBe(true);
    expect(app.routes.get("POST /b")?.payment).toEqual({ scheme: "exact", price: "$0.01" });
  });
});

const mockFacilitator = {
  verify: async () => ({ isValid: true, invalidReason: undefined }),
  settle: async () => ({ success: true }),
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
    extensions: [],
    signers: {},
  }),
} as any;

/**
 * Helper: get 402 from app, decode requirements, build a valid payment header.
 */
async function createPaymentHeaderFromApp(app: AixyzApp, method: string, path: string): Promise<string> {
  const res = await app.fetch(new Request(`http://localhost${path}`, { method }));
  if (res.status !== 402) throw new Error(`Expected 402 but got ${res.status}`);
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

describe("AixyzApp with payment", () => {
  test("fetch() returns 402 for payment-gated route without X-PAYMENT header", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator, network: "eip155:8453" });
    app.route("POST", "/agent", () => new Response("ok"), {
      payment: { scheme: "exact", price: "$0.01", payTo: "0x1234", network: "eip155:8453" },
    });
    await app.initialize();

    const res = await app.fetch(new Request("http://localhost/agent", { method: "POST" }));
    expect(res.status).toBe(402);
  });

  test("fetch() passes through for routes without payment", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator, network: "eip155:8453" });
    app.route("GET", "/free", () => new Response("free"));
    await app.initialize();

    const res = await app.fetch(new Request("http://localhost/free"));
    expect(res.status).toBe(200);
  });

  test("fetch() returns 200 after valid payment", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator, network: "eip155:8453" });
    app.route("POST", "/agent", () => new Response("agent response"), {
      payment: { scheme: "exact", price: "$0.01" },
    });
    await app.initialize();

    const paymentHeader = await createPaymentHeaderFromApp(app, "POST", "/agent");
    const res = await app.fetch(
      new Request("http://localhost/agent", {
        method: "POST",
        headers: { "payment-signature": paymentHeader },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("agent response");
  });

  test("middleware runs after payment verified", async () => {
    const app = new AixyzApp({ facilitators: mockFacilitator, network: "eip155:8453" });
    app.use(async (_req, next) => {
      const res = await next();
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...Object.fromEntries(res.headers), "x-custom": "middleware-ran" },
      });
    });
    app.route("POST", "/agent", () => new Response("ok"), {
      payment: { scheme: "exact", price: "$0.01" },
    });
    await app.initialize();

    const paymentHeader = await createPaymentHeaderFromApp(app, "POST", "/agent");
    const res = await app.fetch(
      new Request("http://localhost/agent", {
        method: "POST",
        headers: { "payment-signature": paymentHeader },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-custom")).toBe("middleware-ran");
  });

  test("app without facilitators ignores payment config", async () => {
    const app = new AixyzApp();
    app.route("POST", "/agent", () => new Response("free-pass"), {
      payment: { scheme: "exact", price: "$0.01" },
    });

    const res = await app.fetch(new Request("http://localhost/agent", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("free-pass");
  });
});
