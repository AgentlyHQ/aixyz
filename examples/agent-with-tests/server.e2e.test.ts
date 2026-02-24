import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "fs";
import { resolve } from "path";

const AGENT_DIR = resolve(import.meta.dir);
const OUTPUT_DIR = resolve(AGENT_DIR, ".aixyz/output");
const SERVER_JS = resolve(OUTPUT_DIR, "server.js");
const PORT = "19879";
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess: ReturnType<typeof Bun.spawn> | null = null;

/**
 * Parse an SSE (Server-Sent Events) response body and return all data payloads as parsed JSON.
 */
function parseSseData(text: string): unknown[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)));
}

beforeAll(async () => {
  // Build the standalone output from the agent-with-tests example
  const build = Bun.spawnSync(["bun", "run", "build"], {
    cwd: AGENT_DIR,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (build.exitCode !== 0) {
    throw new Error("standalone build failed");
  }

  // Start the built server on the designated test port
  serverProcess = Bun.spawn(["bun", SERVER_JS], {
    cwd: AGENT_DIR,
    env: { ...process.env, PORT },
    stdout: "inherit",
    stderr: "inherit",
  });

  // Wait for the agent card endpoint to become available (up to 30 s)
  for (let i = 0; i < 30; i++) {
    await Bun.sleep(1000);
    try {
      const res = await fetch(`${BASE_URL}/.well-known/agent-card.json`);
      if (res.ok) break;
    } catch {
      // Server not ready yet
    }
  }
}, 60_000);

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await serverProcess.exited;
  }
});

describe("standalone output e2e", () => {
  test("build produces expected output files", () => {
    expect(existsSync(SERVER_JS)).toBe(true);
    expect(existsSync(resolve(OUTPUT_DIR, "package.json"))).toBe(true);
  });

  test("index page responds with agent info", async () => {
    const res = await fetch(`${BASE_URL}/`);
    expect(res.ok).toBe(true);
    const text = await res.text();
    expect(text).toContain("Unit Conversion Agent");
  });

  test("A2A agent card endpoint returns correct data", async () => {
    const res = await fetch(`${BASE_URL}/.well-known/agent-card.json`);
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toContain("application/json");

    const card = (await res.json()) as Record<string, unknown>;
    expect(card.name).toBe("Unit Conversion Agent");
    expect(card.protocolVersion).toBe("0.3.0");
    expect(card.url).toContain("/agent");
    expect(card.capabilities).toBeDefined();
  });

  test("MCP endpoint responds to initialize request", async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // StreamableHTTPServerTransport requires both media types in Accept
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      }),
    });

    expect(res.ok).toBe(true);

    // The transport responds with SSE; extract the data payload
    const text = await res.text();
    const [message] = parseSseData(text) as Array<Record<string, unknown>>;

    expect(message).toBeDefined();
    expect(message.jsonrpc).toBe("2.0");
    expect(message.id).toBe(1);

    const result = message.result as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.protocolVersion).toBeDefined();

    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo.name).toBe("Unit Conversion Agent");
    expect(serverInfo.version).toBe("0.1.0");
  });
});
