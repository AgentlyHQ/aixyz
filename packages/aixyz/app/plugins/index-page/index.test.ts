import { afterEach, describe, expect, mock, test } from "bun:test";
import { AixyzApp } from "../../index";
import { IndexPagePlugin } from "./index";
import { MCPPlugin } from "../mcp";

const defaultSkills = [
  {
    id: "skill-travel",
    name: "Travel Planner",
    description: "Plans trips and itineraries",
    tags: ["travel", "planning"],
    examples: ["Plan a trip to Paris", "Find flights to Tokyo"],
  },
];

const defaultConfig = {
  name: "Test Agent",
  description: "A test agent",
  version: "1.0.0",
  url: "http://localhost:3000/",
  x402: { payTo: "0x0000000000000000000000000000000000000000", network: "eip155:8453" },
  build: { tools: [], agents: [], excludes: [], poweredByHeader: true },
  vercel: { maxDuration: 30 },
  skills: defaultSkills,
};

const defaultRuntimeConfig = {
  name: "Test Agent",
  description: "A test agent",
  version: "1.0.0",
  url: "http://localhost:3000/",
  skills: defaultSkills,
};

function setMockConfig(overrides: { skills?: any[] } = {}) {
  const skills = overrides.skills ?? defaultSkills;
  mock.module("@aixyz/config", () => ({
    getAixyzConfig: () => ({ ...defaultConfig, skills }),
    getAixyzConfigRuntime: () => ({ ...defaultRuntimeConfig, skills }),
  }));
}

setMockConfig();

const htmlHeaders = { Accept: "text/html" };
const markdownHeaders = { Accept: "text/markdown" };

interface CreateAppOpts {
  a2a?: boolean | { paid?: boolean; prefix?: string }[];
  mcp?: Array<{ name: string; description?: string; paid?: boolean }>;
}

async function createApp(opts: CreateAppOpts = {}) {
  const app = new AixyzApp();
  await app.withPlugin(new IndexPagePlugin());

  // Register A2A agent routes
  if (opts.a2a === true) {
    app.route("POST", "/agent", () => new Response("ok"));
  } else if (Array.isArray(opts.a2a)) {
    for (const agent of opts.a2a) {
      const path = agent.prefix ? `/${agent.prefix}/agent` : "/agent";
      const payment = agent.paid ? { payment: { scheme: "exact" as const, price: "$0.005" } } : undefined;
      app.route("POST", path, () => new Response("ok"), payment);
    }
  }

  // Register MCP plugin with tools
  if (opts.mcp) {
    await app.withPlugin(
      new MCPPlugin(
        opts.mcp.map((t) => ({
          name: t.name,
          exports: {
            default: { description: t.description, execute: () => {} } as any,
            accepts: t.paid ? { scheme: "exact" as const, price: "$0.01" } : undefined,
          },
        })),
      ),
    );
  }

  await app.initialize();
  return app;
}

describe("IndexPagePlugin", () => {
  afterEach(() => setMockConfig());

  describe("with A2A", () => {
    test("HTML includes A2A badge and continuation chip", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("A2A");
      expect(html).toContain("Use via:");
      expect(html).toContain("prompt-chip");
      expect(html).toContain("a2a send");
      expect(html).not.toContain("mcp call");
    });

    test("markdown includes a2a commands and examples", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: markdownHeaders }));
      const md = await res.text();

      expect(md).toContain("A2A");
      expect(md).toContain("npx use-agently a2a send --uri http://localhost:3000/ -m 'Plan a trip to Paris'");
      expect(md).toContain("npx use-agently a2a card --uri http://localhost:3000/");
      expect(md).not.toContain("mcp tools");
    });
  });

  describe("with MCP only", () => {
    test("HTML includes MCP badge and continuation chip, no a2a", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("MCP");
      expect(html).toContain("Use via:");
      expect(html).toContain("mcp call");
      expect(html).toContain("search");
      expect(html).not.toContain("a2a send");
    });

    test("markdown includes mcp commands, no a2a examples", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: markdownHeaders }));
      const md = await res.text();

      expect(md).toContain("MCP");
      expect(md).toContain("npx use-agently mcp tools --uri http://localhost:3000/");
      expect(md).not.toContain("a2a send");
      expect(md).not.toContain("Plan a trip to Paris");
    });
  });

  describe("with both A2A and MCP", () => {
    test("HTML includes both badges and continuation chips for both protocols", async () => {
      const app = await createApp({
        a2a: true,
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("A2A");
      expect(html).toContain("MCP");
      expect(html).toContain("a2a send");
      expect(html).toContain("mcp call");
      expect(html).toContain("Use via:");
      // Both chips should exist
      expect(html).toContain("prompt-chip");
    });

    test("markdown includes both commands", async () => {
      const app = await createApp({
        a2a: true,
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: markdownHeaders }));
      const md = await res.text();

      expect(md).toContain("A2A · MCP");
      expect(md).toContain("a2a send");
      expect(md).toContain("mcp tools");
    });
  });

  describe("with no protocols", () => {
    test("HTML has no badges or continuation chips", async () => {
      const app = await createApp();
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("Test Agent");
      expect(html).not.toContain(">A2A</span>");
      expect(html).not.toContain(">MCP</span>");
      expect(html).not.toContain("a2a send");
      expect(html).not.toContain("mcp call");
      expect(html).not.toContain("Use via:");
    });
  });

  describe("continuation chips", () => {
    test("first continuation is pre-selected and included in prompt text", async () => {
      const app = await createApp({
        a2a: true,
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // First chip should have active styling (primary color)
      expect(html).toContain("border-primary/50 bg-primary/10 text-primary");
      // Prompt text should include continuation for the first entry (A2A)
      expect(html).toContain("To call this agent, run:");
      expect(html).toContain("send it a clear message using the command above");
    });

    test("continuation chips show protocol labels", async () => {
      const app = await createApp({
        a2a: true,
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // Protocol badges on chips
      expect(html).toContain(">A2A</span>");
      expect(html).toContain(">MCP</span>");
    });

    test("HTML has no separate Entrypoints section", async () => {
      const app = await createApp({
        a2a: [{ paid: true }, { prefix: "assistant", paid: false }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).not.toContain("Entrypoints");
      // Chips should still exist
      expect(html).toContain("Use via:");
    });

    test("MCP continuation includes tool name and args", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("To call the &quot;search&quot; tool, run:");
      expect(html).toContain("mcp call");
      expect(html).toContain("--tool search");
    });

    test("A2A continuation for sub-path agent uses correct URI", async () => {
      const app = await createApp({
        a2a: [{ prefix: "assistant" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("http://localhost:3000/assistant/");
      expect(html).toContain("assistant");
    });

    test("copy script uses base prompt + active continuation", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // Copy button should reference the window vars
      expect(html).toContain("window.__promptBase+(window.__promptCont||'')");
      // Script should set up the base var and render function
      expect(html).toContain("window.__promptBase=base");
      expect(html).toContain("function render(");
    });
  });

  describe("message selector", () => {
    test("example messages appear as chips when A2A is active", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("Message:");
      expect(html).toContain("msg-chip");
      expect(html).toContain("Plan a trip to Paris");
      expect(html).toContain("Find flights to Tokyo");
    });

    test("selected message replaces placeholder in prompt text", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // Default prompt should include the first example message in "My request:" line
      expect(html).toContain("My request: &quot;Plan a trip to Paris&quot;");
      // The CLI command shows the literal <your message> placeholder
      expect(html).toContain("-m &quot;&lt;your message&gt;&quot;");
    });

    test("message row visible when only MCP chips exist", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // msg-row should exist and be visible (MCP now has hasMessage: true)
      expect(html).toContain('id="msg-row"');
      expect(html).not.toMatch(/id="msg-row"[^>]*hidden/);
    });

    test("custom input option present", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("Custom");
      expect(html).toContain('data-msg-index="custom"');
      expect(html).toContain('id="custom-msg-input"');
    });

    test("no message chips when config has no examples, only custom input", async () => {
      setMockConfig({ skills: [{ id: "s1", name: "Basic", description: "Basic skill", tags: [] }] });

      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // Only the custom chip should exist (no example message chips)
      expect(html).toContain('data-msg-index="custom"');
      // Custom chip should be active (pre-selected) when no examples
      expect(html).toContain("Custom");
      // Custom input should be visible (not hidden) when no examples
      expect(html).toContain('id="custom-input-row"');
    });

    test("A2A continuation uses %MSG% template in script", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // The script should contain the %MSG% template
      expect(html).toContain("%MSG%");
      // And a replaceAll call
      expect(html).toContain("replaceAll('%MSG%'");
    });

    test("MCP continuation includes %MSG% template and My request text", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain("%MSG%");
      expect(html).toContain("My request:");
    });

    test("MCP continuation includes schema args shape", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search the web" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // --args should contain the schema shape (or {} when no schema)
      expect(html).toContain("--args");
      expect(html).toContain("determine the appropriate --args from my request");
      // Should NOT contain the old fill-from-request placeholder
      expect(html).not.toContain("fill from request");
    });

    test("MCP tool with matching skill shows only that skill's examples", async () => {
      setMockConfig({
        skills: [
          {
            id: "skill-travel",
            name: "Travel Planner",
            description: "Plans trips",
            tags: ["travel", "planning"],
            examples: ["Plan a trip to Paris", "Find flights to Tokyo"],
          },
          {
            id: "skill-code",
            name: "Code Helper",
            description: "Writes code",
            tags: ["code", "programming"],
            examples: ["Write a sorting algorithm", "Debug this function"],
          },
        ],
      });

      // MCP tool named "travel" should match skill-travel via tag
      const app = await createApp({
        mcp: [{ name: "travel", description: "Travel search tool" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // Should contain travel examples (matched via tag)
      expect(html).toContain("Plan a trip to Paris");
      expect(html).toContain("Find flights to Tokyo");
      // Should NOT contain code examples
      expect(html).not.toContain("Write a sorting algorithm");
      expect(html).not.toContain("Debug this function");
    });

    test("per-continuation messages: A2A gets all examples, MCP gets matched examples", async () => {
      setMockConfig({
        skills: [
          {
            id: "skill-travel",
            name: "Travel Planner",
            description: "Plans trips",
            tags: ["travel"],
            examples: ["Plan a trip to Paris"],
          },
          {
            id: "skill-code",
            name: "Code Helper",
            description: "Writes code",
            tags: ["code"],
            examples: ["Write a function"],
          },
        ],
      });

      // A2A first (gets all examples), then MCP "code" tool (gets only code examples)
      const app = await createApp({
        a2a: true,
        mcp: [{ name: "code", description: "Code tool" }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      // The JS msgSets should be a 2D array with different sets
      // A2A (index 0) gets all examples, MCP "code" (index 1) gets only code examples
      expect(html).toContain("msgSets");
      // First set (A2A) should have both examples in the script data
      expect(html).toContain("Plan a trip to Paris");
      expect(html).toContain("Write a function");
    });
  });

  describe("entrypoints in markdown", () => {
    test("markdown lists entrypoints with path and paid/free", async () => {
      const app = await createApp({
        a2a: [{ paid: true }],
        mcp: [
          { name: "search", description: "Search the web", paid: false },
          { name: "translate", description: "Translate text", paid: true },
        ],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: markdownHeaders }));
      const md = await res.text();

      expect(md).toContain("## Entrypoints");
      expect(md).toContain("### A2A Agents");
      expect(md).toContain("**agent** `/agent` (paid)");
      expect(md).toContain("### MCP Tools");
      expect(md).toContain("**search** `/mcp` — Search the web (free)");
      expect(md).toContain("**translate** `/mcp` — Translate text (paid)");
    });

    test("x402 badge shown when any entrypoint is paid", async () => {
      const app = await createApp({
        mcp: [{ name: "search", description: "Search", paid: true }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).toContain(">x402</span>");
    });

    test("no x402 badge when all entrypoints are free", async () => {
      const app = await createApp({
        a2a: true,
        mcp: [{ name: "search", description: "Search", paid: false }],
      });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      const html = await res.text();

      expect(html).not.toContain(">x402</span>");
    });
  });

  describe("content negotiation", () => {
    test("serves markdown by default (no Accept header)", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");

      const md = await res.text();
      expect(md).toContain("# Test Agent");
    });

    test("serves HTML when Accept includes text/html", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("Test Agent");
      expect(html).toContain("A test agent");
      expect(html).toContain("1.0.0");
      expect(html).toContain("Travel Planner");
    });

    test("serves HTML for browser-like Accept header", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(
        new Request("http://localhost/", {
          headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        }),
      );
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    test("serves markdown when Accept is */*", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: { Accept: "*/*" } }));
      expect(res.headers.get("content-type")).toContain("text/markdown");
    });

    test("serves markdown when Accept: text/markdown", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: markdownHeaders }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");

      const md = await res.text();
      expect(md).toContain("# Test Agent");
      expect(md).toContain("A test agent");
      expect(md).toContain("v1.0.0");
      expect(md).toContain("Travel Planner");
    });

    test("serves markdown when text/html is explicitly rejected with q=0", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(
        new Request("http://localhost/", { headers: { Accept: "text/html;q=0, text/markdown" } }),
      );
      expect(res.headers.get("content-type")).toContain("text/markdown");
    });

    test("serves HTML for case-insensitive Accept header", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: { Accept: "Text/HTML" } }));
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    test("includes Vary: Accept header for HTML response", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
      expect(res.headers.get("vary")).toBe("Accept");
    });

    test("includes Vary: Accept header for markdown response", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(new Request("http://localhost/"));
      expect(res.headers.get("vary")).toBe("Accept");
    });

    test("markdown Accept header with other types still returns markdown", async () => {
      const app = await createApp({ a2a: true });
      const res = await app.fetch(
        new Request("http://localhost/", { headers: { Accept: "text/markdown, text/plain, */*" } }),
      );
      expect(res.headers.get("content-type")).toContain("text/markdown");
    });
  });

  test("HTML includes copyable prompt with base agent info", async () => {
    const app = await createApp({ a2a: true });
    const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
    const html = await res.text();

    expect(html).toContain("System Prompt");
    expect(html).toContain("paste into any LLM");
    expect(html).toContain(
      "You have access to an AI agent called &quot;Test Agent&quot; at http://localhost:3000/ — a test agent.",
    );
    expect(html).toContain("- Travel Planner: Plans trips and itineraries");
    expect(html).toContain("You can send multiple messages to follow up or refine.");
    expect(html).toContain("navigator.clipboard");
  });

  test("HTML includes skills in prompt", async () => {
    const app = await createApp({ a2a: true });
    const res = await app.fetch(new Request("http://localhost/", { headers: htmlHeaders }));
    const html = await res.text();

    expect(html).toContain("Travel Planner");
    expect(html).toContain("Plans trips and itineraries");
  });

  test("supports custom path", async () => {
    const app = new AixyzApp();
    await app.withPlugin(new IndexPagePlugin("/info"));

    expect(app.routes.has("GET /info")).toBe(true);
    expect(app.routes.has("GET /")).toBe(false);
  });

  test("invalid path throws", async () => {
    const app = new AixyzApp();
    await expect(app.withPlugin(new IndexPagePlugin("no-slash"))).rejects.toThrow(
      'Invalid path: no-slash. Path must start with "/"',
    );
  });
});
