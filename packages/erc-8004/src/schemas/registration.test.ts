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
  name: "Test Agent",
  description: "A test agent",
  image: "https://example.com/image.png",
};

const fullValid = {
  type: ERC8004_REGISTRATION_TYPE,
  $schema: "https://example.com/schema.json",
  name: "Full Agent",
  description: "A fully specified agent",
  image: "ipfs://QmTest",
  services: [
    {
      name: "mcp-server",
      endpoint: "https://example.com/mcp",
      version: "1.0.0",
      tools: ["search", "fetch"],
      prompts: ["greeting"],
      resources: ["docs"],
    },
    {
      name: "oasf-endpoint",
      endpoint: "https://example.com/oasf",
      skills: ["translation"],
      domains: ["language"],
    },
  ],
  active: true,
  x402support: true,
  registrations: [{ agentId: "42", agentRegistry: "eip155:1:0xabc" }],
  supportedTrust: ["reputation", "tee-attestation"],
  ens: "agent.eth",
  did: "did:example:123",
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
    const result = ServiceSchema.parse({ name: "mcp", endpoint: "https://example.com" });
    expect(result.name).toBe("mcp");
    expect(result.endpoint).toBe("https://example.com");
    expect(result.version).toBeUndefined();
  });

  test("accepts service with all optional fields", () => {
    const result = ServiceSchema.parse({
      name: "mcp",
      endpoint: "https://example.com",
      version: "2.0",
      skills: ["a"],
      domains: ["b"],
      tools: ["c"],
      prompts: ["d"],
      resources: ["e"],
    });
    expect(result.tools).toEqual(["c"]);
    expect(result.skills).toEqual(["a"]);
  });

  test("rejects missing name", () => {
    expect(() => ServiceSchema.parse({ endpoint: "https://example.com" })).toThrow();
  });

  test("rejects missing endpoint", () => {
    expect(() => ServiceSchema.parse({ name: "mcp" })).toThrow();
  });
});

// =============================================================================
// RegistrationEntrySchema
// =============================================================================

describe("RegistrationEntrySchema", () => {
  test("accepts string agentId and transforms to number", () => {
    const result = RegistrationEntrySchema.parse({ agentId: "42", agentRegistry: "eip155:1:0xabc" });
    expect(result.agentId).toBe(42);
  });

  test("accepts numeric agentId", () => {
    const result = RegistrationEntrySchema.parse({ agentId: 42, agentRegistry: "eip155:1:0xabc" });
    expect(result.agentId).toBe(42);
  });

  test("rejects empty string agentId", () => {
    expect(() => RegistrationEntrySchema.parse({ agentId: "", agentRegistry: "eip155:1:0xabc" })).toThrow();
  });

  test("rejects non-numeric string agentId", () => {
    expect(() => RegistrationEntrySchema.parse({ agentId: "abc", agentRegistry: "eip155:1:0xabc" })).toThrow();
  });

  test("rejects negative agentId", () => {
    expect(() => RegistrationEntrySchema.parse({ agentId: -1, agentRegistry: "eip155:1:0xabc" })).toThrow();
  });

  test("rejects float agentId", () => {
    expect(() => RegistrationEntrySchema.parse({ agentId: 1.5, agentRegistry: "eip155:1:0xabc" })).toThrow();
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
    expect(result.name).toBe("Test Agent");
  });

  test("accepts fully specified file", () => {
    const result = RawAgentRegistrationFileSchema.parse(fullValid);
    expect(result.services).toHaveLength(2);
    expect(result.registrations).toHaveLength(1);
    expect(result.active).toBe(true);
    expect(result.ens).toBe("agent.eth");
    expect(result.did).toBe("did:example:123");
  });

  test("type field is optional", () => {
    const result = RawAgentRegistrationFileSchema.parse(minimalValid);
    expect(result.type).toBeUndefined();
  });

  test("accepts endpoints as legacy field", () => {
    const result = RawAgentRegistrationFileSchema.parse({
      ...minimalValid,
      endpoints: [{ name: "legacy", endpoint: "https://example.com" }],
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
    services: [{ name: "mcp", endpoint: "https://example.com" }],
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
        services: [{ name: "mcp", endpoint: "https://example.com" }],
      }),
    ).toThrow();
  });

  test("rejects wrong type literal", () => {
    expect(() =>
      StrictAgentRegistrationFileSchema.parse({
        ...minimalValid,
        type: "wrong-type",
        services: [{ name: "mcp", endpoint: "https://example.com" }],
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
      services: [{ name: "mcp", endpoint: "https://example.com" }],
    });
    expect(result.success).toBe(true);
  });

  test("returns failure when type is missing", () => {
    const result = validateRegistrationFile({
      ...minimalValid,
      services: [{ name: "mcp", endpoint: "https://example.com" }],
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
    const file = { ...minimalValid, services: [{ name: "mcp", endpoint: "https://example.com/mcp" }] };
    expect(getServices(file)).toEqual([{ name: "mcp", endpoint: "https://example.com/mcp" }]);
  });

  test("falls back to endpoints", () => {
    const file = { ...minimalValid, endpoints: [{ name: "legacy", endpoint: "https://example.com/legacy" }] };
    expect(getServices(file)).toEqual([{ name: "legacy", endpoint: "https://example.com/legacy" }]);
  });

  test("prefers services over endpoints", () => {
    const file = {
      ...minimalValid,
      services: [{ name: "new", endpoint: "https://example.com/new" }],
      endpoints: [{ name: "old", endpoint: "https://example.com/old" }],
    };
    expect(getServices(file)).toEqual([{ name: "new", endpoint: "https://example.com/new" }]);
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
