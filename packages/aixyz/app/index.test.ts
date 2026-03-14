import { afterAll, beforeAll, describe, expect, mock, test, setDefaultTimeout } from "bun:test";
import { createFixture, type X402Fixture } from "../test/x402-fixture";
import { createPaymentFetch } from "@use-agently/sdk";
import { decodePaymentResponseHeader } from "@x402/core/http";

setDefaultTimeout(30_000);

let testPayTo = "0x0000000000000000000000000000000000000000";

mock.module("@aixyz/config", () => ({
  getAixyzConfig: () => ({
    name: "Test Agent",
    description: "A test agent",
    version: "1.0.0",
    url: "http://localhost:3000",
    x402: { payTo: testPayTo, network: "eip155:8453" },
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

let fixture: X402Fixture;

beforeAll(async () => {
  fixture = await createFixture();
  testPayTo = fixture.payTo;
}, 120_000);

afterAll(async () => {
  await fixture.close();
}, 30_000);

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

describe("AixyzApp with payment", () => {
  let url: string;
  let stopServer: () => void;

  beforeAll(async () => {
    const app = new AixyzApp({ facilitators: fixture.facilitator });
    app.route("POST", "/agent", () => new Response("agent response"), {
      payment: { scheme: "exact", price: "$0.01" },
    });
    app.route("GET", "/free", () => new Response("free"));
    await app.initialize();

    ({ url, stop: stopServer } = await fixture.serve(app));
  });

  afterAll(() => {
    stopServer?.();
  });

  test("returns 402 for payment-gated route without payment header", async () => {
    const res = await fetch(`${url}/agent`, { method: "POST" });
    expect(res.status).toBe(402);
  });

  test("passes through for routes without payment", async () => {
    const res = await fetch(`${url}/free`);
    expect(res.status).toBe(200);
  });

  test("returns 200 after valid payment", async () => {
    const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
    const res = await payFetch(`${url}/agent`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("agent response");
  }, 30_000);

  test("middleware runs after payment verified", async () => {
    const app = new AixyzApp({ facilitators: fixture.facilitator });
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

    const { url: mwUrl, stop } = await fixture.serve(app);
    try {
      const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
      const res = await payFetch(`${mwUrl}/agent`, { method: "POST" });
      expect(res.status).toBe(200);
      expect(res.headers.get("x-custom")).toBe("middleware-ran");
    } finally {
      stop();
    }
  }, 30_000);

  test("includes payment-response header after successful payment", async () => {
    const payFetch = createPaymentFetch(fixture.wallet) as typeof fetch;
    const res = await payFetch(`${url}/agent`, { method: "POST" });
    expect(res.status).toBe(200);
    const decoded = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE")!);
    expect(decoded).toEqual({
      success: true,
      transaction: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      network: "eip155:8453",
      payer: fixture.wallet.address,
    });
  }, 30_000);

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
