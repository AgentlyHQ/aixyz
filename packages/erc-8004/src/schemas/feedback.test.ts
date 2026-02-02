import { describe, expect, test } from "bun:test";
import { RawFeedbackFileSchema, parseRawFeedbackFile } from "./feedback";

// =============================================================================
// Fixtures
// =============================================================================

const minimalWithValue = {
  agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  agentId: 42,
  clientAddress: "eip155:11155111:0x1234567890abcdef1234567890abcdef12345678",
  createdAt: "2026-01-15T12:00:00Z",
  value: 100,
  valueDecimals: 0,
};

const minimalWithScore = {
  agentRegistry: "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  agentId: 42,
  clientAddress: "eip155:11155111:0x1234567890abcdef1234567890abcdef12345678",
  createdAt: "2026-01-15T12:00:00Z",
  score: 85,
};

const fullValid = {
  ...minimalWithValue,
  tag1: "quality",
  tag2: "response-time",
  endpoint: "https://mcp.acme-agents.com/v1/translate",
  mcp: { tool: "translate", prompt: "system-translate", resource: "supported-languages" },
  a2a: { skills: ["translation"], contextId: "ctx-a1b2c3d4", taskId: "task-e5f6g7h8" },
  oasf: { skills: ["translation", "summarization"], domains: ["language", "nlp"] },
  proofOfPayment: {
    fromAddress: "0x1234567890abcdef1234567890abcdef12345678",
    toAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    chainId: 11155111,
    txHash: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  },
};

// =============================================================================
// Required fields
// =============================================================================

describe("RawFeedbackFileSchema required fields", () => {
  test("accepts minimal file with value/valueDecimals", () => {
    const result = RawFeedbackFileSchema.safeParse(minimalWithValue);
    expect(result.success).toBe(true);
  });

  test("rejects missing agentRegistry", () => {
    const { agentRegistry, ...rest } = minimalWithValue;
    expect(RawFeedbackFileSchema.safeParse(rest).success).toBe(false);
  });

  test("rejects missing agentId", () => {
    const { agentId, ...rest } = minimalWithValue;
    expect(RawFeedbackFileSchema.safeParse(rest).success).toBe(false);
  });

  test("accepts agentId as string and transforms to number", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, agentId: "42" });
    expect(result.agentId).toBe(42);
  });

  test("rejects whitespace-only agentId", () => {
    expect(RawFeedbackFileSchema.safeParse({ ...minimalWithValue, agentId: " " }).success).toBe(false);
  });

  test("rejects empty string agentId", () => {
    expect(RawFeedbackFileSchema.safeParse({ ...minimalWithValue, agentId: "" }).success).toBe(false);
  });

  test("rejects non-numeric string agentId", () => {
    expect(RawFeedbackFileSchema.safeParse({ ...minimalWithValue, agentId: "abc" }).success).toBe(false);
  });

  test("rejects negative agentId", () => {
    expect(RawFeedbackFileSchema.safeParse({ ...minimalWithValue, agentId: -1 }).success).toBe(false);
  });

  test("rejects float agentId", () => {
    expect(RawFeedbackFileSchema.safeParse({ ...minimalWithValue, agentId: 1.5 }).success).toBe(false);
  });

  test("rejects missing clientAddress", () => {
    const { clientAddress, ...rest } = minimalWithValue;
    expect(RawFeedbackFileSchema.safeParse(rest).success).toBe(false);
  });

  test("rejects missing createdAt", () => {
    const { createdAt, ...rest } = minimalWithValue;
    expect(RawFeedbackFileSchema.safeParse(rest).success).toBe(false);
  });

  test("rejects invalid createdAt (not ISO 8601)", () => {
    const result = RawFeedbackFileSchema.safeParse({ ...minimalWithValue, createdAt: "not-a-date" });
    expect(result.success).toBe(false);
  });

  test("rejects non-object input", () => {
    expect(RawFeedbackFileSchema.safeParse("string").success).toBe(false);
    expect(RawFeedbackFileSchema.safeParse(null).success).toBe(false);
    expect(RawFeedbackFileSchema.safeParse(42).success).toBe(false);
  });
});

// =============================================================================
// Value / Score backward compatibility
// =============================================================================

describe("value/score backward compatibility", () => {
  test("accepts value + valueDecimals", () => {
    const result = RawFeedbackFileSchema.parse(minimalWithValue);
    expect(result.value).toBe(100n);
    expect(result.valueDecimals).toBe(0);
  });

  test("accepts value as string", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, value: "100" });
    expect(result.value).toBe(100n);
  });

  test("accepts value as bigint", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, value: 100n });
    expect(result.value).toBe(100n);
  });

  test("accepts large int128 values without precision loss", () => {
    const largeValue = "170141183460469231731687303715884105727"; // max int128
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, value: largeValue });
    expect(result.value).toBe(BigInt(largeValue));
  });

  test("accepts negative value (int128 is signed)", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, value: -50 });
    expect(result.value).toBe(-50n);
  });

  test("accepts large negative int128 value", () => {
    const minValue = "-170141183460469231731687303715884105728"; // min int128
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, value: minValue });
    expect(result.value).toBe(BigInt(minValue));
  });

  test("accepts score and maps to value with valueDecimals=0", () => {
    const result = RawFeedbackFileSchema.parse(minimalWithScore);
    expect(result.value).toBe(85n);
    expect(result.valueDecimals).toBe(0);
  });

  test("value takes precedence over score", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      score: 50,
    });
    expect(result.value).toBe(100n);
    expect(result.valueDecimals).toBe(0);
  });

  test("rejects when neither value nor score is provided", () => {
    const { value, valueDecimals, ...rest } = minimalWithValue;
    expect(RawFeedbackFileSchema.safeParse(rest).success).toBe(false);
  });

  test("rejects value without valueDecimals", () => {
    const { valueDecimals, ...rest } = minimalWithValue;
    const result = RawFeedbackFileSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Optional fields
// =============================================================================

describe("optional fields", () => {
  test("accepts full file with all optional fields", () => {
    const result = RawFeedbackFileSchema.safeParse(fullValid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tag1).toBe("quality");
      expect(result.data.tag2).toBe("response-time");
      expect(result.data.endpoint).toContain("acme-agents.com");
    }
  });

  test("tags are nullable", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, tag1: null, tag2: null });
    expect(result.tag1).toBeNull();
    expect(result.tag2).toBeNull();
  });

  test("endpoint rejects invalid URL", () => {
    const result = RawFeedbackFileSchema.safeParse({ ...minimalWithValue, endpoint: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// MCP schema
// =============================================================================

describe("mcp field", () => {
  test("accepts mcp with all fields", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      mcp: { tool: "translate", prompt: "system-translate", resource: "supported-languages" },
    });
    expect(result.mcp?.tool).toBe("translate");
  });

  test("accepts mcp with partial fields", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, mcp: { tool: "detect-language" } });
    expect(result.mcp?.tool).toBe("detect-language");
    expect(result.mcp?.prompt).toBeUndefined();
  });

  test("accepts null mcp", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, mcp: null });
    expect(result.mcp).toBeNull();
  });
});

// =============================================================================
// A2A schema
// =============================================================================

describe("a2a field", () => {
  test("accepts a2a with all fields", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      a2a: { skills: ["translation"], contextId: "ctx-a1b2c3d4", taskId: "task-e5f6g7h8" },
    });
    expect(result.a2a?.skills).toEqual(["translation"]);
    expect(result.a2a?.contextId).toBe("ctx-a1b2c3d4");
  });

  test("accepts null a2a", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, a2a: null });
    expect(result.a2a).toBeNull();
  });
});

// =============================================================================
// OASF schema
// =============================================================================

describe("oasf field", () => {
  test("accepts oasf with all fields", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      oasf: { skills: ["summarize"], domains: ["language"] },
    });
    expect(result.oasf?.skills).toEqual(["summarize"]);
    expect(result.oasf?.domains).toEqual(["language"]);
  });

  test("accepts null oasf", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, oasf: null });
    expect(result.oasf).toBeNull();
  });
});

// =============================================================================
// ProofOfPayment schema
// =============================================================================

describe("proofOfPayment field", () => {
  test("accepts full proof", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: {
        fromAddress: "0x1234567890abcdef1234567890abcdef12345678",
        toAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        chainId: 11155111,
        txHash: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      },
    });
    expect(result.proofOfPayment?.txHash).toBe("0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    expect(result.proofOfPayment?.chainId).toBe(11155111);
  });

  test("accepts chainId as string and transforms to number", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { chainId: "11155111" },
    });
    expect(result.proofOfPayment?.chainId).toBe(11155111);
  });

  test("transforms whitespace-only chainId to null", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { chainId: " " },
    });
    expect(result.proofOfPayment?.chainId).toBeNull();
  });

  test("transforms empty string chainId to null", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { chainId: "" },
    });
    expect(result.proofOfPayment?.chainId).toBeNull();
  });

  test("transforms float chainId to null", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { chainId: 1.5 },
    });
    expect(result.proofOfPayment?.chainId).toBeNull();
  });

  test("transforms negative chainId to null", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { chainId: -1 },
    });
    expect(result.proofOfPayment?.chainId).toBeNull();
  });

  test("transforms non-numeric chainId string to null", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { chainId: "not-a-number" },
    });
    expect(result.proofOfPayment?.chainId).toBeNull();
  });

  test("accepts null proofOfPayment", () => {
    const result = RawFeedbackFileSchema.parse({ ...minimalWithValue, proofOfPayment: null });
    expect(result.proofOfPayment).toBeNull();
  });

  test("accepts partial proof with nullable fields", () => {
    const result = RawFeedbackFileSchema.parse({
      ...minimalWithValue,
      proofOfPayment: { txHash: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2" },
    });
    expect(result.proofOfPayment?.txHash).toBe("0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    expect(result.proofOfPayment?.fromAddress).toBeUndefined();
  });
});

// =============================================================================
// Loose mode (extra fields)
// =============================================================================

describe("loose mode", () => {
  test("allows unknown extra fields", () => {
    const result = RawFeedbackFileSchema.safeParse({ ...minimalWithValue, customField: "hello" });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// parseRawFeedbackFile helper
// =============================================================================

describe("parseRawFeedbackFile", () => {
  test("returns success for valid data", () => {
    const result = parseRawFeedbackFile(minimalWithValue);
    expect(result.success).toBe(true);
  });

  test("returns failure for invalid data (does not throw)", () => {
    const result = parseRawFeedbackFile({ bad: "data" });
    expect(result.success).toBe(false);
  });

  test("returns failure for null", () => {
    const result = parseRawFeedbackFile(null);
    expect(result.success).toBe(false);
  });
});
