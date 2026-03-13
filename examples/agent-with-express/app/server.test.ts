import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  accounts,
} from "x402-fl/testcontainers";
import {
  EvmPrivateKeyWallet,
  DryRunPaymentRequired,
  PayTransaction,
  callMcpTool,
  listMcpTools,
  sendA2AMessage,
  getA2ACard,
  createDryRunFetch,
  createPaymentFetch,
} from "@use-agently/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const TEST_PRIVATE_KEY = generatePrivateKey();
const TEST_ADDRESS = privateKeyToAccount(TEST_PRIVATE_KEY).address;

let container: StartedX402FacilitatorLocalContainer;
let serverProc: ReturnType<typeof Bun.spawn>;
let baseUrl: string;
let wallet: EvmPrivateKeyWallet;

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

beforeAll(async () => {
  // 1. Start x402 facilitator container (forks Base mainnet via Anvil)
  container = await new X402FacilitatorLocalContainer().start();

  // 2. Fund test wallet
  await container.fund(TEST_ADDRESS, "100");

  // 3. Create wallet for payment transactions
  wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, container.getRpcUrl());

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
    expect(await res.json()).toStrictEqual(body);
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
    const card = await getA2ACard(baseUrl);
    expect(card.name).toBe("Agent with Express");
    expect(card.protocolVersion).toBe("0.3.0");
    expect(card.url).toContain("/agent");
  });

  test("sendA2AMessage without payment throws DryRunPaymentRequired", async () => {
    await expect(sendA2AMessage(baseUrl, "hello")).rejects.toThrow(DryRunPaymentRequired);
  });

  test("sendA2AMessage with x402 payment succeeds and debits sender", async () => {
    const senderBefore = await container.balance(TEST_ADDRESS);
    const receiverBefore = await container.balance(accounts.facilitator.address);

    const result = await sendA2AMessage(baseUrl, "convert 0 celsius to fahrenheit", {
      transaction: PayTransaction(wallet),
    });
    expect(result.text).toBeTruthy();
    expect(result.raw).toBeTruthy();

    // $0.001 USDC = 1000 raw units (6 decimals)
    const senderAfter = await container.balance(TEST_ADDRESS);
    const receiverAfter = await container.balance(accounts.facilitator.address);
    expect(senderBefore.value - senderAfter.value).toBe(1000n);
    expect(receiverAfter.value - receiverBefore.value).toBe(1000n);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// MCP routes
// ---------------------------------------------------------------------------
describe("mcp routes", () => {
  test("listMcpTools includes convertTemperature and premiumTemperature", async () => {
    const tools = await listMcpTools(baseUrl);
    const names = tools.map((t) => t.name);
    expect(names).toContain("convertTemperature");
    expect(names).toContain("premiumTemperature");
  });

  test("callMcpTool convertTemperature converts 100°C to 212°F (free)", async () => {
    const result = await callMcpTool(baseUrl, "convertTemperature", {
      value: 100,
      from: "celsius",
      to: "fahrenheit",
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.output.value).toBeCloseTo(212, 5);
    expect(parsed.output.unit).toBe("fahrenheit");
  });

  test("callMcpTool premiumTemperature without payment throws DryRunPaymentRequired", async () => {
    await expect(
      callMcpTool(
        baseUrl,
        "premiumTemperature",
        { value: 373.15, from: "kelvin", to: "celsius" },
        {
          fetchImpl: createDryRunFetch(),
        },
      ),
    ).rejects.toThrow(DryRunPaymentRequired);
  });

  test("callMcpTool premiumTemperature with x402 payment converts 373.15K to 100°C", async () => {
    const senderBefore = await container.balance(TEST_ADDRESS);
    const receiverBefore = await container.balance(accounts.facilitator.address);

    const result = await callMcpTool(
      baseUrl,
      "premiumTemperature",
      { value: 373.15, from: "kelvin", to: "celsius" },
      { transaction: PayTransaction(wallet), fetchImpl: createPaymentFetch(wallet) as fetch },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.output.value).toBeCloseTo(100, 5);
    expect(parsed.output.unit).toBe("celsius");

    // $0.001 USDC = 1000 raw units (6 decimals)
    const senderAfter = await container.balance(TEST_ADDRESS);
    const receiverAfter = await container.balance(accounts.facilitator.address);
    expect(senderBefore.value - senderAfter.value).toBe(1000n);
    expect(receiverAfter.value - receiverBefore.value).toBe(1000n);
  }, 30_000);
});
