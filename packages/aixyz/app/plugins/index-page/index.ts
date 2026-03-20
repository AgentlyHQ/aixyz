import { getAixyzConfigRuntime } from "@aixyz/config";
import { z } from "zod";
import { BasePlugin } from "../../plugin";
import type { AixyzApp } from "../../index";
import type { MCPPlugin } from "../mcp";
import { renderHtml } from "./html";

export type AixyzConfigRuntime = ReturnType<typeof getAixyzConfigRuntime>;

export interface Entrypoint {
  protocol: "a2a" | "mcp";
  name: string;
  path: string;
  description?: string;
  paid: boolean;
  inputSchema?: Record<string, unknown>;
}

export interface ProtocolInfo {
  a2a: boolean;
  mcp: boolean;
  entrypoints: Entrypoint[];
}

function prefersHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (!/text\/html/i.test(accept)) return false;
  return !/text\/html\s*;\s*q\s*=\s*0(\.0*)?\s*(,|$)/i.test(accept);
}

function renderMarkdown(config: AixyzConfigRuntime, protocols: ProtocolInfo): string {
  const url = config.url ?? "AGENT_URL";

  let md = `# ${config.name}\n\n`;
  md += `${config.description} Use the \`use-agently\` CLI (npx use-agently) to interact with this agent.\n\n`;
  md += `> v${config.version}`;
  if (config.url) md += ` · ${config.url}`;
  md += `\n\n`;

  const badges: string[] = [];
  if (protocols.a2a) badges.push("A2A");
  if (protocols.mcp) badges.push("MCP");
  if (protocols.entrypoints.some((e) => e.paid)) badges.push("x402");
  if (badges.length > 0) md += `${badges.join(" · ")}\n\n`;

  if (config.skills && config.skills.length > 0) {
    md += `## Skills\n\n`;
    for (const skill of config.skills) {
      md += `### ${skill.name}\n\n`;
      md += `${skill.description}\n\n`;
      if (skill.tags && skill.tags.length > 0) {
        md += `Tags: ${skill.tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
      }
      if (skill.examples && skill.examples.length > 0 && protocols.a2a) {
        md += `**Examples:**\n\n`;
        md += `\`\`\`sh\n`;
        for (const example of skill.examples) {
          const safeExample = example.replace(/'/g, "'\\''");
          md += `npx use-agently a2a send --uri ${url} -m '${safeExample}'\n`;
        }
        md += `\`\`\`\n\n`;
      }
    }
  }

  if (protocols.entrypoints.length > 0) {
    md += `## Entrypoints\n\n`;
    const a2aEntries = protocols.entrypoints.filter((e) => e.protocol === "a2a");
    const mcpEntries = protocols.entrypoints.filter((e) => e.protocol === "mcp");
    if (a2aEntries.length > 0) {
      md += `### A2A Agents\n\n`;
      for (const e of a2aEntries) {
        md += `- **${e.name}** \`${e.path}\`${e.description ? ` — ${e.description}` : ""} (${e.paid ? "paid" : "free"})\n`;
      }
      md += `\n`;
    }
    if (mcpEntries.length > 0) {
      md += `### MCP Tools\n\n`;
      for (const e of mcpEntries) {
        md += `- **${e.name}** \`${e.path}\`${e.description ? ` — ${e.description}` : ""} (${e.paid ? "paid" : "free"})\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n\n`;
  md += `Use this agent:\n\n`;
  md += `\`\`\`sh\n`;
  if (protocols.a2a) {
    md += `# Send a message via A2A\n`;
    md += `npx use-agently a2a send --uri ${url} -m "your prompt here"\n\n`;
    md += `# View agent card\n`;
    md += `npx use-agently a2a card --uri ${url}\n`;
  }
  if (protocols.mcp) {
    if (protocols.a2a) md += `\n`;
    md += `# List tools via MCP\n`;
    md += `npx use-agently mcp tools --uri ${url}\n`;
  }
  md += `\`\`\`\n`;

  return md;
}

/** Plugin that serves agent info with content negotiation: markdown for agents, HTML for humans. */
export class IndexPagePlugin extends BasePlugin {
  readonly name = "index-page";
  private protocols: ProtocolInfo = { a2a: false, mcp: false, entrypoints: [] };

  constructor(private path = "/") {
    super();
  }

  register(app: AixyzApp): void {
    const config = getAixyzConfigRuntime();
    if (!this.path.startsWith("/")) {
      throw new Error(`Invalid path: ${this.path}. Path must start with "/"`);
    }

    // Default to serve markdown, else explicitly asked for HTML (which browsers do by default)
    app.route("GET", this.path, (request: Request) => {
      if (prefersHtml(request)) {
        return new Response(renderHtml(config, this.protocols), {
          headers: { "Content-Type": "text/html; charset=utf-8", Vary: "Accept" },
        });
      }
      return new Response(renderMarkdown(config, this.protocols), {
        headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
      });
    });
  }

  initialize(app: AixyzApp): void {
    const entrypoints: Entrypoint[] = [];

    // Detect A2A agents from routes (POST */agent pattern)
    for (const [key, entry] of app.routes) {
      if (key.startsWith("POST ") && entry.path.endsWith("/agent")) {
        const prefix = entry.path.slice(1, -"/agent".length); // e.g. "" or "foo"
        const name = prefix || "agent";
        entrypoints.push({
          protocol: "a2a",
          name,
          path: entry.path,
          paid: entry.payment?.scheme === "exact",
        });
      }
    }

    // Detect MCP tools from MCPPlugin
    const mcpPlugin = app.getPlugin<MCPPlugin>("mcp");
    if (mcpPlugin?.registeredTools) {
      for (const tool of mcpPlugin.registeredTools) {
        let inputSchema: Record<string, unknown> | undefined;
        try {
          const jsonSchema = z.toJSONSchema(tool.tool.inputSchema as z.ZodType);
          const props = (jsonSchema as any).properties as
            | Record<string, { type?: string; description?: string }>
            | undefined;
          if (props && Object.keys(props).length > 0) {
            const example: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(props)) {
              example[key] = `<${val.description || key}>`;
            }
            inputSchema = example;
          }
        } catch {}

        entrypoints.push({
          protocol: "mcp",
          name: tool.name,
          path: "/mcp",
          description: tool.tool.description,
          paid: tool.accepts?.scheme === "exact",
          inputSchema,
        });
      }
    }

    this.protocols.a2a = entrypoints.some((e) => e.protocol === "a2a");
    this.protocols.mcp = entrypoints.some((e) => e.protocol === "mcp");
    this.protocols.entrypoints = entrypoints;
  }
}
