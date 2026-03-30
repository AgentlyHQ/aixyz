import { afterAll, beforeAll, describe, expect, test, setDefaultTimeout } from "bun:test";
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
} from "@use-agently/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

setDefaultTimeout(30_000);

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
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(200);
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

beforeAll(async () => {
  container = await new X402FacilitatorLocalContainer().start();
  await container.fund(TEST_ADDRESS, "100");
  wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, container.getRpcUrl());

  const port = getFreePort();
  baseUrl = `http://localhost:${port}`;

  const projectRoot = resolve(import.meta.dir, "..");
  serverProc = Bun.spawn(["bun", "run", "dev"], {
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

// ── MCP Tools ────────────────────────────────────────────────────────

describe("mcp tools", () => {
  test("listMcpTools includes put-content and get-content", async () => {
    const tools = await listMcpTools(baseUrl);
    const names = tools.map((t) => t.name);
    expect(names).toContain("put-content");
    expect(names).toContain("get-content");
  });

  test("put-content without payment throws DryRunPaymentRequired", async () => {
    await expect(callMcpTool(baseUrl, "put-content", { key: "color", value: "blue" })).rejects.toThrow(
      DryRunPaymentRequired,
    );
  });
});

// ── Session Persistence ──────────────────────────────────────────────

describe("session persistence across paid MCP calls", () => {
  test("put-content stores a value with payment", async () => {
    const result = await callMcpTool(
      baseUrl,
      "put-content",
      { key: "color", value: "blue" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.key).toBe("color");
  });

  test("get-content retrieves value stored in previous request", async () => {
    const result = await callMcpTool(
      baseUrl,
      "get-content",
      { key: "color" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.key).toBe("color");
    expect(parsed.value).toBe("blue");
  });

  test("multiple values persist and can be listed", async () => {
    await callMcpTool(
      baseUrl,
      "put-content",
      { key: "food", value: "pizza" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    await callMcpTool(
      baseUrl,
      "put-content",
      { key: "city", value: "tokyo" },
      {
        transaction: PayTransaction(wallet),
      },
    );

    // List all — omit key to get everything
    const result = await callMcpTool(
      baseUrl,
      "get-content",
      {},
      {
        transaction: PayTransaction(wallet),
      },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.content).toEqual(expect.objectContaining({ color: "blue", food: "pizza", city: "tokyo" }));
    expect(parsed.count).toBeGreaterThanOrEqual(3);
  });

  test("get-content for missing key returns error", async () => {
    const result = await callMcpTool(
      baseUrl,
      "get-content",
      { key: "nonexistent" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("nonexistent");
  });

  test("setting value to null deletes the key", async () => {
    // Ensure the key exists first
    await callMcpTool(
      baseUrl,
      "put-content",
      { key: "to-delete", value: "temp" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const getBeforeDelete = await callMcpTool(
      baseUrl,
      "get-content",
      { key: "to-delete" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const beforeParsed = JSON.parse((getBeforeDelete.content as Array<{ type: string; text: string }>)[0].text);
    expect(beforeParsed.success).toBe(true);
    expect(beforeParsed.value).toBe("temp");

    // Delete by setting value to null
    const delResult = await callMcpTool(
      baseUrl,
      "put-content",
      { key: "to-delete", value: null },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const delParsed = JSON.parse((delResult.content as Array<{ type: string; text: string }>)[0].text);
    expect(delParsed.success).toBe(true);
    expect(delParsed.deleted).toBe(true);

    // Verify the key is gone
    const getResult = await callMcpTool(
      baseUrl,
      "get-content",
      { key: "to-delete" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const getParsed = JSON.parse((getResult.content as Array<{ type: string; text: string }>)[0].text);
    expect(getParsed.success).toBe(false);
    expect(getParsed.error).toContain("to-delete");
  });

  test("overwriting a key updates the value", async () => {
    await callMcpTool(
      baseUrl,
      "put-content",
      { key: "color", value: "red" },
      {
        transaction: PayTransaction(wallet),
      },
    );

    const result = await callMcpTool(
      baseUrl,
      "get-content",
      { key: "color" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.value).toBe("red");
  });
});
