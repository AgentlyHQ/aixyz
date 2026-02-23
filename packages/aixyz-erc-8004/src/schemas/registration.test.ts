import { describe, expect, test } from "bun:test";
import {
  ERC8004_REGISTRATION_TYPE,
  RawAgentRegistrationFileSchema,
  StrictAgentRegistrationFileSchema,
  TrustMechanismSchema,
  ServiceSchema,
  RegistrationEntrySchema,
  parseRawRegistrationFile,
  validateRegistrationFile,
  getServices,
  hasX402Support,
} from "./registration";

// =============================================================================
// Fixtures
// =============================================================================

const minimalValid = {
  name: "Agently Price Feed",
  description: "Real-time cryptocurrency price feed agent with x402 payment support",
  image: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
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

// =============================================================================
// TrustMechanismSchema
// =============================================================================

describe("TrustMechanismSchema", () => {
  test.each(["reputation", "crypto-economic", "tee-attestation", "social", "governance"])("accepts '%s'", (value) => {
    expect(TrustMechanismSchema.parse(value)).toBe(value);
  });

  test("rejects unknown mechanism", () => {
    expect(() => TrustMechanismSchema.parse("unknown")).toThrow();
  });
});

// =============================================================================
// ServiceSchema
// =============================================================================

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

// =============================================================================
// RegistrationEntrySchema
// =============================================================================

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

// =============================================================================
// RawAgentRegistrationFileSchema
// =============================================================================

describe("RawAgentRegistrationFileSchema", () => {
  test("accepts minimal valid file", () => {
    const result = RawAgentRegistrationFileSchema.parse(minimalValid);
    expect(result.name).toBe("Agently Price Feed");
  });

  test("accepts fully specified file", () => {
    const result = RawAgentRegistrationFileSchema.parse(fullValid);
    expect(result.services).toHaveLength(2);
    expect(result.registrations).toHaveLength(1);
    expect(result.active).toBe(true);
    expect(result.ens).toBe("translate.agently.eth");
    expect(result.did).toBe("did:pkh:eip155:11155111:0x1234567890abcdef1234567890abcdef12345678");
  });

  test("type field is optional", () => {
    const result = RawAgentRegistrationFileSchema.parse(minimalValid);
    expect(result.type).toBeUndefined();
  });

  test("accepts endpoints as legacy field", () => {
    const result = RawAgentRegistrationFileSchema.parse({
      ...minimalValid,
      endpoints: [{ name: "legacy-mcp", endpoint: "https://mcp.acme-agents.com/v0/translate" }],
    });
    expect(result.endpoints).toHaveLength(1);
  });

  test("accepts both x402support casings", () => {
    const r1 = RawAgentRegistrationFileSchema.parse({ ...minimalValid, x402support: true });
    const r2 = RawAgentRegistrationFileSchema.parse({ ...minimalValid, x402Support: true });
    expect(r1.x402support).toBe(true);
    expect(r2.x402Support).toBe(true);
  });

  test("rejects missing name", () => {
    expect(() => RawAgentRegistrationFileSchema.parse({ description: "x", image: "x" })).toThrow();
  });

  test("rejects missing description", () => {
    expect(() => RawAgentRegistrationFileSchema.parse({ name: "x", image: "x" })).toThrow();
  });

  test("rejects missing image", () => {
    expect(() => RawAgentRegistrationFileSchema.parse({ name: "x", description: "x" })).toThrow();
  });

  test("rejects non-object input", () => {
    expect(() => RawAgentRegistrationFileSchema.parse("string")).toThrow();
    expect(() => RawAgentRegistrationFileSchema.parse(null)).toThrow();
    expect(() => RawAgentRegistrationFileSchema.parse(42)).toThrow();
  });
});

// =============================================================================
// StrictAgentRegistrationFileSchema
// =============================================================================

describe("StrictAgentRegistrationFileSchema", () => {
  const strictValid = {
    ...minimalValid,
    type: ERC8004_REGISTRATION_TYPE,
    services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/price-feed" }],
  };

  test("accepts valid strict file", () => {
    const result = StrictAgentRegistrationFileSchema.parse(strictValid);
    expect(result.type).toBe(ERC8004_REGISTRATION_TYPE);
    expect(result.services).toHaveLength(1);
  });

  test("rejects missing type", () => {
    expect(() =>
      StrictAgentRegistrationFileSchema.parse({
        ...minimalValid,
        services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/price-feed" }],
      }),
    ).toThrow();
  });

  test("rejects wrong type literal", () => {
    expect(() =>
      StrictAgentRegistrationFileSchema.parse({
        ...minimalValid,
        type: "wrong-type",
        services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/price-feed" }],
      }),
    ).toThrow();
  });

  test("rejects empty services array", () => {
    expect(() =>
      StrictAgentRegistrationFileSchema.parse({
        ...minimalValid,
        type: ERC8004_REGISTRATION_TYPE,
        services: [],
      }),
    ).toThrow();
  });

  test("rejects missing services", () => {
    expect(() =>
      StrictAgentRegistrationFileSchema.parse({
        ...minimalValid,
        type: ERC8004_REGISTRATION_TYPE,
      }),
    ).toThrow();
  });
});

// =============================================================================
// parseRawRegistrationFile
// =============================================================================

describe("parseRawRegistrationFile", () => {
  test("returns success for valid data", () => {
    const result = parseRawRegistrationFile(minimalValid);
    expect(result.success).toBe(true);
  });

  test("returns failure for invalid data (does not throw)", () => {
    const result = parseRawRegistrationFile({ bad: "data" });
    expect(result.success).toBe(false);
  });

  test("returns failure for null", () => {
    const result = parseRawRegistrationFile(null);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// validateRegistrationFile
// =============================================================================

describe("validateRegistrationFile", () => {
  test("returns success for strict-valid data", () => {
    const result = validateRegistrationFile({
      ...minimalValid,
      type: ERC8004_REGISTRATION_TYPE,
      services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/price-feed" }],
    });
    expect(result.success).toBe(true);
  });

  test("returns failure when type is missing", () => {
    const result = validateRegistrationFile({
      ...minimalValid,
      services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/price-feed" }],
    });
    expect(result.success).toBe(false);
  });

  test("returns failure when services is empty", () => {
    const result = validateRegistrationFile({
      ...minimalValid,
      type: ERC8004_REGISTRATION_TYPE,
      services: [],
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// getServices
// =============================================================================

describe("getServices", () => {
  test("returns services when present", () => {
    const file = {
      ...minimalValid,
      services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/translate" }],
    };
    expect(getServices(file)).toEqual([{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/translate" }]);
  });

  test("falls back to endpoints", () => {
    const file = {
      ...minimalValid,
      endpoints: [{ name: "legacy-mcp", endpoint: "https://mcp.acme-agents.com/v0/translate" }],
    };
    expect(getServices(file)).toEqual([{ name: "legacy-mcp", endpoint: "https://mcp.acme-agents.com/v0/translate" }]);
  });

  test("prefers services over endpoints", () => {
    const file = {
      ...minimalValid,
      services: [{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/translate" }],
      endpoints: [{ name: "legacy-mcp", endpoint: "https://mcp.acme-agents.com/v0/translate" }],
    };
    expect(getServices(file)).toEqual([{ name: "mcp-server", endpoint: "https://mcp.acme-agents.com/v1/translate" }]);
  });

  test("returns empty array when neither present", () => {
    expect(getServices(minimalValid as any)).toEqual([]);
  });
});

// =============================================================================
// hasX402Support
// =============================================================================

describe("hasX402Support", () => {
  test("returns true for x402support: true", () => {
    expect(hasX402Support({ ...minimalValid, x402support: true })).toBe(true);
  });

  test("returns true for x402Support: true", () => {
    expect(hasX402Support({ ...minimalValid, x402Support: true })).toBe(true);
  });

  test("returns false when both are false", () => {
    expect(hasX402Support({ ...minimalValid, x402support: false, x402Support: false })).toBe(false);
  });

  test("returns false when neither is set", () => {
    expect(hasX402Support(minimalValid as any)).toBe(false);
  });
});
