import { describe, expect, test } from "bun:test";
import {
  ERC8004_REGISTRATION_TYPE,
  AgentRegistrationFileSchema,
  TrustMechanismSchema,
  ServiceSchema,
  RegistrationEntrySchema,
} from "./registration";

const minimalValid = {
  type: ERC8004_REGISTRATION_TYPE,
  name: "Agently Price Feed",
  description: "Real-time cryptocurrency price feed agent with x402 payment support",
  image: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/price-feed" }],
};

const fullValid = {
  type: ERC8004_REGISTRATION_TYPE,
  $schema: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Agently Translation Service",
  description: "Multi-language translation agent supporting MCP and A2A protocols",
  image: "ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX",
  services: [
    {
      name: "mcp-server",
      endpoint: "https://mcp.acme-agents.com/v1/translate",
      version: "1.0.0",
      tools: ["translate", "detect-language"],
      prompts: ["system-translate"],
      resources: ["supported-languages"],
    },
    {
      name: "oasf-spec",
      endpoint: "https://oasf.acme-agents.com/v1/translate",
      skills: ["translation", "language-detection"],
      domains: ["language", "nlp"],
    },
  ],
  active: true,
  x402support: true,
  registrations: [{ agentId: "42", agentRegistry: "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }],
  supportedTrust: ["reputation", "tee-attestation"],
  ens: "translate.agently.eth",
  did: "did:pkh:eip155:11155111:0x1234567890abcdef1234567890abcdef12345678",
};

describe("TrustMechanismSchema", () => {
  test.each(["reputation", "crypto-economic", "tee-attestation", "social", "governance"])("accepts '%s'", (value) => {
    expect(TrustMechanismSchema.parse(value)).toBe(value);
  });

  test("rejects unknown mechanism", () => {
    expect(() => TrustMechanismSchema.parse("unknown")).toThrow();
  });
});

describe("ServiceSchema", () => {
  test("accepts minimal service", () => {
    const result = ServiceSchema.parse({ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/translate" });
    expect(result.name).toBe("mcp-server");
    expect(result.endpoint).toBe("https://mcp.acme-agents.com/v1/translate");
    expect(result.version).toBeUndefined();
  });

  test("accepts service with all optional fields", () => {
    const result = ServiceSchema.parse({
      name: "mcp-server",
      endpoint: "https://mcp.acme-agents.com/v1/translate",
      version: "2.0.0",
      skills: ["translation", "summarization"],
      domains: ["language", "nlp"],
      tools: ["translate", "detect-language"],
      prompts: ["system-translate"],
      resources: ["supported-languages"],
    });
    expect(result.tools).toEqual(["translate", "detect-language"]);
    expect(result.skills).toEqual(["translation", "summarization"]);
  });

  test("rejects missing name", () => {
    expect(() => ServiceSchema.parse({ endpoint: "https://mcp.acme-agents.com/v1/translate" })).toThrow();
  });

  test("rejects missing endpoint", () => {
    expect(() => ServiceSchema.parse({ name: "mcp-server" })).toThrow();
  });
});

describe("RegistrationEntrySchema", () => {
  test("accepts string agentId and transforms to number", () => {
    const result = RegistrationEntrySchema.parse({
      agentId: "42",
      agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    });
    expect(result.agentId).toBe(42);
  });

  test("accepts numeric agentId", () => {
    const result = RegistrationEntrySchema.parse({
      agentId: 42,
      agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    });
    expect(result.agentId).toBe(42);
  });

  test("rejects whitespace-only agentId", () => {
    expect(() =>
      RegistrationEntrySchema.parse({
        agentId: " ",
        agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      }),
    ).toThrow();
  });

  test("rejects empty string agentId", () => {
    expect(() =>
      RegistrationEntrySchema.parse({
        agentId: "",
        agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      }),
    ).toThrow();
  });

  test("rejects non-numeric string agentId", () => {
    expect(() =>
      RegistrationEntrySchema.parse({
        agentId: "abc",
        agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      }),
    ).toThrow();
  });

  test("rejects negative agentId", () => {
    expect(() =>
      RegistrationEntrySchema.parse({
        agentId: -1,
        agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      }),
    ).toThrow();
  });

  test("rejects float agentId", () => {
    expect(() =>
      RegistrationEntrySchema.parse({
        agentId: 1.5,
        agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      }),
    ).toThrow();
  });

  test("rejects missing agentRegistry", () => {
    expect(() => RegistrationEntrySchema.parse({ agentId: "1" })).toThrow();
  });
});

describe("RawAgentRegistrationFileSchema", () => {
  test("accepts minimal valid file", () => {
    const result = AgentRegistrationFileSchema.parse(minimalValid);
    expect(result.name).toBe("Agently Price Feed");
  });

  test("accepts fully specified file", () => {
    const result = AgentRegistrationFileSchema.parse(fullValid);
    expect(result.services).toHaveLength(2);
    expect(result.registrations).toHaveLength(1);
    expect(result.active).toBe(true);
    expect(result.ens).toBe("translate.agently.eth");
    expect(result.did).toBe("did:pkh:eip155:11155111:0x1234567890abcdef1234567890abcdef12345678");
  });

  test("accepts x402support", () => {
    const result = AgentRegistrationFileSchema.parse({ ...minimalValid, x402support: true });
    expect(result.x402support).toBe(true);
  });

  test("rejects missing name", () => {
    expect(() => AgentRegistrationFileSchema.parse({ description: "x", image: "x" })).toThrow();
  });

  test("rejects missing description", () => {
    expect(() => AgentRegistrationFileSchema.parse({ name: "x", image: "x" })).toThrow();
  });

  test("rejects missing image", () => {
    expect(() => AgentRegistrationFileSchema.parse({ name: "x", description: "x" })).toThrow();
  });

  test("rejects non-object input", () => {
    expect(() => AgentRegistrationFileSchema.parse("string")).toThrow();
    expect(() => AgentRegistrationFileSchema.parse(null)).toThrow();
    expect(() => AgentRegistrationFileSchema.parse(42)).toThrow();
  });
});

describe("AgentRegistrationFileSchema.safeParse", () => {
  test("returns success for valid data", () => {
    const result = AgentRegistrationFileSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });

  test("returns failure for invalid data (does not throw)", () => {
    const result = AgentRegistrationFileSchema.safeParse({ bad: "data" });
    expect(result.success).toBe(false);
  });

  test("returns failure for null", () => {
    const result = AgentRegistrationFileSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});
