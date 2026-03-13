import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  accounts,
} from "x402-fl/testcontainers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ClientFactory, JsonRpcTransportFactory } from "@a2a-js/sdk/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";

const TEST_PRIVATE_KEY = generatePrivateKey();
const TEST_ADDRESS = privateKeyToAccount(TEST_PRIVATE_KEY).address;

let container: StartedX402FacilitatorLocalContainer;
let serverProc: ReturnType<typeof Bun.spawn>;
let baseUrl: string;
let paymentFetch: typeof fetch;

function getFreePort(): number {
  const server = Bun.serve({ fetch: () => new Response(), port: 0 });
  const { port } = server;
  server.stop(true);
  return port!;
}

async function waitForServer(url: string, timeout = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(200);
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

function createTestPaymentFetch(rpcUrl: string): typeof fetch {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const signer = toClientEvmSigner(account, publicClient);
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*" as const, client: new ExactEvmScheme(signer) }],
  });
}

beforeAll(async () => {
  // 1. Start x402 facilitator container (forks Base mainnet via Anvil)
  container = await new X402FacilitatorLocalContainer().start();

  // 2. Fund test wallet
  await container.fund(TEST_ADDRESS, "100");

  // 3. Create payment-aware fetch pointed at the local Anvil fork
  paymentFetch = createTestPaymentFetch(container.getRpcUrl());

  // 4. Start Express server pointing to the local facilitator
  const port = getFreePort();
  baseUrl = `http://localhost:${port}`;

  const projectRoot = resolve(import.meta.dir, "..");
  serverProc = Bun.spawn(["bun", "run", "app/server.ts"], {
    cwd: projectRoot,
    stdout: "ignore",
    stderr: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      X402_FACILITATOR_URL: container.getFacilitatorUrl(),
      X402_PAY_TO: accounts.facilitator.address,
      X402_NETWORK: "eip155:8453",
    },
  });

  await waitForServer(baseUrl);
}, 120_000);

afterAll(async () => {
  if (serverProc) {
    serverProc.kill();
    await serverProc.exited;
  }
  if (container) await container.stop();
}, 30_000);

// ---------------------------------------------------------------------------
// Express-native routes (not managed by AixyzApp)
// ---------------------------------------------------------------------------
describe("express routes", () => {
  test("GET /health returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("GET / returns index page with agent name", async () => {
    const res = await fetch(baseUrl);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Agent with Express");
  });

  test("POST /echo returns request body", async () => {
    const body = { message: "hello", nested: { value: 42 } };
    const res = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
  });

  test("unknown route returns 404", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// A2A routes
// ---------------------------------------------------------------------------
describe("a2a routes", () => {
  test("agent card is valid", async () => {
    const res = await fetch(`${baseUrl}/.well-known/agent-card.json`);
    expect(res.status).toBe(200);
    const card = (await res.json()) as Record<string, unknown>;
    expect(card.name).toBe("Agent with Express");
    expect(card.protocolVersion).toBe("0.3.0");
    expect(card.url).toContain("/agent");
  });

  test("POST /agent without payment returns 402", async () => {
    const res = await fetch(`${baseUrl}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          message: {
            messageId: crypto.randomUUID(),
            role: "user",
            parts: [{ kind: "text", text: "hello" }],
          },
        },
        id: 1,
      }),
    });
    expect(res.status).toBe(402);
  });

  test("POST /agent with x402 payment succeeds and debits sender", async () => {
    const factory = new ClientFactory({
      transports: [new JsonRpcTransportFactory({ fetchImpl: paymentFetch })],
    });
    const client = await factory.createFromUrl(`${baseUrl}/`);

    const senderBefore = await container.balance(TEST_ADDRESS);
    const receiverBefore = await container.balance(accounts.facilitator.address);

    const result = await client.sendMessage({
      message: {
        kind: "message",
        messageId: crypto.randomUUID(),
        role: "user",
        parts: [{ kind: "text", text: "convert 0 celsius to fahrenheit" }],
      },
    });
    expect(result).toBeTruthy();

    // $0.001 USDC = 1000 raw units (6 decimals)
    const senderAfter = await container.balance(TEST_ADDRESS);
    const receiverAfter = await container.balance(accounts.facilitator.address);
    expect(senderBefore.value - senderAfter.value).toBe(1000n);
    expect(receiverAfter.value - receiverBefore.value).toBe(1000n);
  }, 30_000);

  test("POST /agent with x402 payment includes payment-response header", async () => {
    const res = await paymentFetch(`${baseUrl}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          message: {
            messageId: crypto.randomUUID(),
            role: "user",
            parts: [{ kind: "text", text: "convert 0 celsius to fahrenheit" }],
          },
        },
        id: 1,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.has("PAYMENT-RESPONSE")).toBe(true);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// MCP routes
// ---------------------------------------------------------------------------
describe("mcp routes", () => {
  test("tools/list includes convertTemperature", async () => {
    const client = new Client({ name: "test", version: "1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("convertTemperature");
    } finally {
      await client.close();
    }
  });

  test("tools/call convertTemperature converts 100°C to 212°F", async () => {
    const client = new Client({ name: "test", version: "1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    await client.connect(transport);
    try {
      const result = await client.callTool({
        name: "convertTemperature",
        arguments: { value: 100, from: "celsius", to: "fahrenheit" },
      });
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.output.value).toBeCloseTo(212, 5);
      expect(parsed.output.unit).toBe("fahrenheit");
    } finally {
      await client.close();
    }
  });
});
